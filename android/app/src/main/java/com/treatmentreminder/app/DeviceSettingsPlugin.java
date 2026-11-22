package com.treatmentreminder.app;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

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
            Uri uri = (s == null || s.isEmpty()) ? Settings.System.DEFAULT_NOTIFICATION_URI : Uri.parse(s);
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
