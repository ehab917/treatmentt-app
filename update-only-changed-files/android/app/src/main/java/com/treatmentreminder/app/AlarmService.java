package com.treatmentreminder.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;

/**
 * خدمة المنبّه: تشغّل النغمة بالتكرار مع الاهتزاز وتُظهر شاشة المنبّه،
 * وتبقى تعمل حتى يضغط المريض «أخذتها» أو «تخطي» أو «تأجيل» أو يسحب لإيقاف الصوت
 * (وعندها يعود المنبّه بعد مدة التكرار حتى يتم التأكيد أو يصل الحد الأقصى).
 */
public class AlarmService extends Service {
    static final String ACT_START = "com.treatmentreminder.app.ALARM_START";
    static final String ACT_SILENCE = "com.treatmentreminder.app.ALARM_SILENCE";
    static final String ACT_TAKEN = "com.treatmentreminder.app.ALARM_TAKEN";
    static final String ACT_SKIP = "com.treatmentreminder.app.ALARM_SKIP";
    static final String ACT_SNOOZE = "com.treatmentreminder.app.ALARM_SNOOZE";
    private static final int NOTIF_ID = 7100;
    private static final String CH_ID = "alarm_service_v1";

    /** الجرعات التي ترنّ الآن (مشتركة مع شاشة المنبّه داخل نفس العملية) */
    private static final LinkedHashMap<String, AlarmItem> ACTIVE = new LinkedHashMap<>();

    static synchronized AlarmItem head() {
        for (AlarmItem a : ACTIVE.values()) return a;
        return null;
    }

    static synchronized int count() {
        return ACTIVE.size();
    }

    private static synchronized List<AlarmItem> snapshot() {
        return new ArrayList<>(ACTIVE.values());
    }

    private static synchronized AlarmItem find(String key) {
        if (key == null || key.isEmpty()) return head();
        return ACTIVE.get(key);
    }

    private static synchronized void put(AlarmItem a) {
        ACTIVE.put(a.key, a);
    }

    private static synchronized void remove(String key) {
        ACTIVE.remove(key);
    }

    private static synchronized void clearActive() {
        ACTIVE.clear();
    }

    static String labelOf(JSONObject labels, String k, String def) {
        return labels == null ? def : labels.optString(k, def);
    }

    static void start(Context c, AlarmItem a) {
        Intent i = new Intent(c, AlarmService.class).setAction(ACT_START)
                .putExtra("item", a.toJson().toString());
        ContextCompat.startForegroundService(c, i);
    }

    static void sendAction(Context c, String action, String key) {
        Intent i = new Intent(c, AlarmService.class).setAction(action).putExtra("key", key == null ? "" : key);
        c.startService(i);
    }

    private MediaPlayer player;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable autoSilence = new Runnable() {
        @Override
        public void run() {
            silenceAll();
            refreshOrStop();
        }
    };

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        ensureChannel();
        if (ACT_START.equals(action)) {
            AlarmItem a = AlarmItem.parse(intent.getStringExtra("item"));
            if (a == null) {
                goForeground(buildNotification());
                refreshOrStop();
                return START_NOT_STICKY;
            }
            put(a);
            goForeground(buildNotification());
            startAlert();
            armAutoSilence();
            openAlarmScreen();
        } else if (action != null) {
            String key = intent.getStringExtra("key");
            if (ACT_SILENCE.equals(action)) {
                silenceAll();
            } else {
                AlarmItem target = find(key);
                if (target != null) {
                    if (ACT_TAKEN.equals(action)) complete(target, "taken");
                    else if (ACT_SKIP.equals(action)) complete(target, "skipped");
                    else if (ACT_SNOOZE.equals(action)) snooze(target);
                }
            }
            refreshOrStop();
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        stopAlert();
        handler.removeCallbacks(autoSilence);
        super.onDestroy();
    }

    /* ---------------- إجراءات المريض ---------------- */

    private void complete(AlarmItem item, String status) {
        remove(item.key);
        AlarmStore.removeNativeFor(this, item.key);
        if ("dose".equals(item.type)) AlarmStore.addResult(this, item, status);
        AlarmStore.armNext(this);
    }

    private void snooze(AlarmItem item) {
        remove(item.key);
        if ("dose".equals(item.type)) {
            int min = AlarmStore.config(this).optInt("snoozeMin", 10);
            AlarmStore.addFollowUp(this, item, Math.max(1, min) * 60000L, item.n);
        }
        AlarmStore.armNext(this);
    }

    /** إيقاف الصوت (سحب/انتهاء المهلة): يعود المنبّه بعد مدة التكرار إلى أن يصل الحد الأقصى */
    private void silenceAll() {
        handler.removeCallbacks(autoSilence);
        JSONObject cfg = AlarmStore.config(this);
        int repeatMin = Math.max(1, cfg.optInt("repeatMin", 5));
        int max = cfg.optInt("repeatMax", 6);
        for (AlarmItem a : snapshot()) {
            if ("dose".equals(a.type) && a.n + 1 <= max) {
                AlarmStore.addFollowUp(this, a, repeatMin * 60000L, a.n + 1);
            }
        }
        clearActive();
        AlarmStore.armNext(this);
    }

    private void refreshOrStop() {
        if (count() == 0) {
            stopAlert();
            handler.removeCallbacks(autoSilence);
            stopForeground(Service.STOP_FOREGROUND_REMOVE);
            stopSelf();
        } else {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(NOTIF_ID, buildNotification());
        }
    }

    private void armAutoSilence() {
        int sec = Math.max(10, AlarmStore.config(this).optInt("ringSec", 60));
        handler.removeCallbacks(autoSilence);
        handler.postDelayed(autoSilence, sec * 1000L);
    }

    /* ---------------- الصوت والاهتزاز ---------------- */

    private void startAlert() {
        JSONObject cfg = AlarmStore.config(this);
        int sec = Math.max(10, cfg.optInt("ringSec", 60));
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "treatmentreminder:alarm");
            }
            wakeLock.acquire((sec + 20) * 1000L);
        } catch (Exception ignored) { }
        if (player == null && !cfg.optBoolean("silent", false)) startSound(cfg);
        if (vibrator == null) startVibration(cfg);
    }

    private Uri resolveUri(String s) {
        if (s != null && !s.isEmpty()) return Uri.parse(s);
        Uri u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        return u != null ? u : Settings.System.DEFAULT_NOTIFICATION_URI;
    }

    private MediaPlayer prepare(Uri uri) throws Exception {
        MediaPlayer mp = new MediaPlayer();
        mp.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
        mp.setDataSource(this, uri);
        mp.setLooping(true);
        mp.prepare();
        return mp;
    }

    private void startSound(JSONObject cfg) {
        try {
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            int max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM);
            int cur = am.getStreamVolume(AudioManager.STREAM_ALARM);
            if (cur < max * 0.6) am.setStreamVolume(AudioManager.STREAM_ALARM, (int) Math.ceil(max * 0.8), 0);
        } catch (Exception ignored) { }
        MediaPlayer mp = null;
        try {
            mp = prepare(resolveUri(cfg.optString("uri", "")));
        } catch (Exception first) {
            try {
                mp = prepare(Settings.System.DEFAULT_NOTIFICATION_URI);
            } catch (Exception ignored) { }
        }
        if (mp != null) {
            mp.start();
            player = mp;
        }
    }

    private void startVibration(JSONObject cfg) {
        JSONArray p = cfg.optJSONArray("pattern");
        if (p == null || p.length() == 0) return;
        Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (v == null || !v.hasVibrator()) return;
        boolean endsOn = p.length() % 2 == 1;
        long[] t = new long[endsOn ? p.length() + 2 : p.length() + 1];
        t[0] = 0;
        for (int i = 0; i < p.length(); i++) t[i + 1] = p.optLong(i, 100);
        if (endsOn) t[t.length - 1] = 700; else t[t.length - 1] += 700;
        try {
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(t, 0));
            else v.vibrate(t, 0);
            vibrator = v;
        } catch (Exception ignored) { }
    }

    private void stopAlert() {
        try {
            if (player != null) {
                if (player.isPlaying()) player.stop();
                player.release();
            }
        } catch (Exception ignored) { }
        player = null;
        try {
            if (vibrator != null) vibrator.cancel();
        } catch (Exception ignored) { }
        vibrator = null;
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception ignored) { }
    }

    /* ---------------- الإشعار وشاشة المنبّه ---------------- */

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CH_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(CH_ID, "Alarm", NotificationManager.IMPORTANCE_HIGH);
        ch.setSound(null, null);
        ch.enableVibration(false);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }

    private void goForeground(Notification n) {
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIF_ID, n);
        }
    }

    private PendingIntent actionIntent(String action, String key, int req) {
        Intent i = new Intent(this, AlarmService.class).setAction(action).putExtra("key", key);
        return PendingIntent.getService(this, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification buildNotification() {
        AlarmItem h = head();
        JSONObject labels = AlarmStore.config(this).optJSONObject("labels");
        String title = h != null ? h.title : "";
        String text = h != null ? h.body : "";
        int c = count();
        if (c > 1) text = text + " (+" + (c - 1) + ")";
        String key = h != null ? h.key : "";

        Intent screen = new Intent(this, AlarmActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent full = PendingIntent.getActivity(this, 1, screen,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CH_ID)
                .setSmallIcon(R.drawable.ic_stat_pill)
                .setContentTitle(title)
                .setContentText(text)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                .setOnlyAlertOnce(true)
                .setFullScreenIntent(full, true)
                .setContentIntent(full)
                .addAction(0, labelOf(labels, "taken", "OK"), actionIntent(ACT_TAKEN, key, 11))
                .addAction(0, labelOf(labels, "snooze", "Snooze"), actionIntent(ACT_SNOOZE, key, 12));
        return b.build();
    }

    private void openAlarmScreen() {
        try {
            Intent i = new Intent(this, AlarmActivity.class)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(i);
        } catch (Exception ignored) { }
    }
}
