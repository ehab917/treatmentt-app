package com.treatmentreminder.app;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * جسر أصلي صغير: اختيار نغمات الهاتف الأصلية، إنشاء قنوات إشعار بنغمة/اهتزاز مخصّصين،
 * وفتح شاشات الإعدادات اللازمة لضمان وصول التنبيهات (البطارية، الإشعارات، المنبّهات).
 */
@CapacitorPlugin(name = "DeviceSettings")
public class DeviceSettingsPlugin extends Plugin {

    private Ringtone previewRingtone;

    /* ---------------- اختيار نغمة من نغمات الهاتف ---------------- */
    @PluginMethod
    public void pickRingtone(PluginCall call) {
        Intent intent = new Intent(RingtoneManager.ACTION_RINGTONE_PICKER);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALL);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_DEFAULT_URI, Settings.System.DEFAULT_NOTIFICATION_URI);
        intent.putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, call.getString("title", ""));
        String current = call.getString("current");
        if (current != null && !current.isEmpty()) {
            intent.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(current));
        }
        startActivityForResult(call, intent, "pickRingtoneResult");
    }

    @SuppressWarnings("deprecation")
    @ActivityCallback
    private void pickRingtoneResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject out = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            out.put("cancelled", true);
            call.resolve(out);
            return;
        }
        Uri uri = result.getData().getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);
        out.put("cancelled", false);
        out.put("uri", uri == null ? "" : uri.toString());
        String title = "";
        try {
            Uri target = uri == null ? Settings.System.DEFAULT_NOTIFICATION_URI : uri;
            Ringtone r = RingtoneManager.getRingtone(getContext(), target);
            if (r != null) title = r.getTitle(getContext());
        } catch (Exception ignored) { }
        out.put("title", title);
        call.resolve(out);
    }

    /* ---------------- معاينة نغمة الهاتف ---------------- */
    @PluginMethod
    public void playRingtone(PluginCall call) {
        stopPreview();
        try {
            String s = call.getString("uri");
            Uri uri = (s == null || s.isEmpty()) ? RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM) : Uri.parse(s);
            previewRingtone = RingtoneManager.getRingtone(getContext(), uri);
            if (previewRingtone != null) previewRingtone.play();
        } catch (Exception ignored) { }
        call.resolve();
    }

    @PluginMethod
    public void stopRingtone(PluginCall call) {
        stopPreview();
        call.resolve();
    }

    private void stopPreview() {
        try {
            if (previewRingtone != null && previewRingtone.isPlaying()) previewRingtone.stop();
        } catch (Exception ignored) { }
        previewRingtone = null;
    }

    /* ---------------- قناة إشعار بنغمة واهتزاز مخصّصين ---------------- */
    @PluginMethod
    public void createChannel(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve();
            return;
        }
        String id = call.getString("id");
        if (id == null || id.isEmpty()) {
            call.reject("missing id");
            return;
        }
        String name = call.getString("name", id);
        String uriStr = call.getString("uri");
        boolean silent = Boolean.TRUE.equals(call.getBoolean("silent", false));
        JSArray pattern = call.getArray("pattern");

        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel ch = new NotificationChannel(
                id, name, silent ? NotificationManager.IMPORTANCE_LOW : NotificationManager.IMPORTANCE_HIGH);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        ch.setShowBadge(true);

        if (silent) {
            ch.setSound(null, null);
        } else {
            Uri uri = (uriStr == null || uriStr.isEmpty()) ? Settings.System.DEFAULT_NOTIFICATION_URI : Uri.parse(uriStr);
            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            ch.setSound(uri, attrs);
        }

        long[] vib = null;
        if (pattern != null && pattern.length() > 0) {
            try {
                vib = new long[pattern.length()];
                for (int i = 0; i < vib.length; i++) vib[i] = pattern.getLong(i);
            } catch (Exception e) {
                vib = null;
            }
        }
        if (vib != null) {
            ch.enableVibration(true);
            ch.setVibrationPattern(vib);
        } else {
            ch.enableVibration(false);
        }
        nm.createNotificationChannel(ch);
        call.resolve();
    }

    /* ---------------- البطارية والمنبّهات والإشعارات ---------------- */
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject out = new JSObject();
        boolean ignoring = true;
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            ignoring = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        } catch (Exception ignored) { }
        out.put("ignoringBattery", ignoring);
        boolean fullScreen = true;
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
                fullScreen = nm.canUseFullScreenIntent();
            }
        } catch (Exception ignored) { }
        out.put("fullScreen", fullScreen);
        out.put("overlay", Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(getContext()));
        out.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase());
        out.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(out);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                    Uri.parse("package:" + getContext().getPackageName()));
            launch(i);
        } catch (Exception e) {
            try {
                launch(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
            } catch (Exception e2) {
                openDetails();
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void openAppNotificationSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            launch(i);
        } catch (Exception e) {
            openDetails();
        }
        call.resolve();
    }

    @PluginMethod
    public void openAppDetails(PluginCall call) {
        openDetails();
        call.resolve();
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                        Uri.parse("package:" + getContext().getPackageName()));
                launch(i);
            }
        } catch (Exception e) {
            openDetails();
        }
        call.resolve();
    }

    /* ---------------- منبّه الجرعات الأصلي ---------------- */
    @PluginMethod
    public void scheduleAlarms(PluginCall call) {
        Context c = getContext();
        try {
            JSObject cfg = call.getObject("config");
            if (cfg != null) AlarmStore.saveConfig(c, cfg.toString());
            Set<String> done = new HashSet<>();
            JSArray doneArr = call.getArray("doneKeys");
            if (doneArr != null) {
                for (int i = 0; i < doneArr.length(); i++) done.add(doneArr.getString(i));
            }
            List<AlarmItem> keep = new ArrayList<>();
            for (AlarmItem a : AlarmStore.load(c)) {
                if (!"native".equals(a.src)) continue;
                if (a.items != null && a.items.length() > 0) {
                    JSONArray rest = new JSONArray();
                    for (int k = 0; k < a.items.length(); k++) {
                        JSONObject it = a.items.optJSONObject(k);
                        if (it == null) continue;
                        String mk = "dose:" + a.date + ":" + it.optString("medId") + ":" + a.time;
                        if (!done.contains(mk)) rest.put(it);
                    }
                    if (rest.length() == 0) continue;
                    a.items = rest;
                    keep.add(a);
                } else if (!done.contains(a.key)) {
                    keep.add(a);
                }
            }
            JSArray arr = call.getArray("alarms");
            if (arr != null) {
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject o = arr.getJSONObject(i);
                    AlarmItem a = AlarmItem.fromJson(o);
                    a.src = "js";
                    a.id = AlarmStore.idFor(a.key + "#" + a.at);
                    keep.add(a);
                }
            }
            AlarmStore.save(c, keep);
            AlarmStore.armNext(c);
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void cancelAlarms(PluginCall call) {
        AlarmStore.cancelAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void popResults(PluginCall call) {
        JSObject out = new JSObject();
        try {
            out.put("results", new JSArray(AlarmStore.popResults(getContext())));
        } catch (Exception e) {
            out.put("results", new JSArray());
        }
        call.resolve(out);
    }

    @PluginMethod
    public void testAlarm(PluginCall call) {
        Context c = getContext();
        try {
            JSObject cfg = call.getObject("config");
            if (cfg != null) AlarmStore.saveConfig(c, cfg.toString());
            int delay = call.getInt("delaySec", 5);
            AlarmItem a = new AlarmItem();
            a.at = System.currentTimeMillis() + Math.max(1, delay) * 1000L;
            a.key = "test:" + a.at;
            a.type = "test";
            a.title = call.getString("title", "");
            a.body = call.getString("body", "");
            a.src = "native";
            a.id = AlarmStore.idFor(a.key);
            List<AlarmItem> list = AlarmStore.load(c);
            list.add(a);
            AlarmStore.save(c, list);
            AlarmStore.armNext(c);
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void openFullScreenSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                launch(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                        Uri.parse("package:" + getContext().getPackageName())));
            } else {
                openDetails();
            }
        } catch (Exception e) {
            openDetails();
        }
        call.resolve();
    }

    /* ---------------- التشخيص ---------------- */
    @PluginMethod
    public void getDiagnostics(PluginCall call) {
        Context c = getContext();
        JSObject out = new JSObject();
        out.put("sdk", Build.VERSION.SDK_INT);
        out.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        out.put("model", Build.MODEL == null ? "" : Build.MODEL);
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        boolean canExact = true;
        try {
            if (Build.VERSION.SDK_INT >= 31 && am != null) canExact = am.canScheduleExactAlarms();
        } catch (Exception ignored) { }
        out.put("canExact", canExact);
        boolean ignoring = true;
        try {
            PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
            ignoring = pm.isIgnoringBatteryOptimizations(c.getPackageName());
        } catch (Exception ignored) { }
        out.put("ignoringBattery", ignoring);
        out.put("overlay", Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c));
        boolean fullScreen = true;
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
                fullScreen = nm.canUseFullScreenIntent();
            }
        } catch (Exception ignored) { }
        out.put("fullScreen", fullScreen);
        out.put("notificationsEnabled", NotificationManagerCompat.from(c).areNotificationsEnabled());
        List<AlarmItem> list = AlarmStore.load(c);
        long next = 0;
        for (AlarmItem a : list) {
            if (next == 0 || a.at < next) next = a.at;
        }
        out.put("pending", list.size());
        out.put("nextAt", next);
        long clock = 0;
        try {
            AlarmManager.AlarmClockInfo info = am == null ? null : am.getNextAlarmClock();
            if (info != null) clock = info.getTriggerTime();
        } catch (Exception ignored) { }
        out.put("nextAlarmClock", clock);
        try {
            AudioManager audio = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            out.put("alarmVolume", audio.getStreamVolume(AudioManager.STREAM_ALARM));
            out.put("alarmVolumeMax", audio.getStreamMaxVolume(AudioManager.STREAM_ALARM));
        } catch (Exception ignored) { }
        try {
            out.put("log", new JSArray(AlarmStore.readLog(c)));
        } catch (Exception e) {
            out.put("log", new JSArray());
        }
        call.resolve(out);
    }

    @PluginMethod
    public void clearLog(PluginCall call) {
        AlarmStore.clearLog(getContext());
        call.resolve();
    }

    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        try {
            launch(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getContext().getPackageName())));
        } catch (Exception e) {
            openDetails();
        }
        call.resolve();
    }

    private void openDetails() {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + getContext().getPackageName()));
            launch(i);
        } catch (Exception ignored) { }
    }

    private void launch(Intent i) {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
    }
}
