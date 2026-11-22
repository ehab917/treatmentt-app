package com.treatmentreminder.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** تخزين التنبيهات القادمة وإعدادات المنبّه، وضبط أقرب منبّه في نظام أندرويد. */
final class AlarmStore {
    static final String PREFS = "alarm_prefs";
    static final String ACTION_FIRE = "com.treatmentreminder.app.ALARM_FIRE";
    static final int REQ_FIRE = 7001;
    static final int REQ_SHOW = 7002;
    /** تنبيه فات موعده بأكثر من هذه المدة (مثلًا الهاتف كان مطفأً) لا يُشغَّل */
    static final long STALE_MS = 30L * 60L * 1000L;

    private AlarmStore() { }

    private static SharedPreferences sp(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static int idFor(String s) {
        int h = 7;
        for (int i = 0; i < s.length(); i++) h = h * 31 + s.charAt(i);
        return Math.abs(h % 2000000000) + 1;
    }

    static synchronized List<AlarmItem> load(Context c) {
        List<AlarmItem> out = new ArrayList<>();
        try {
            JSONArray arr = new JSONArray(sp(c).getString("alarms", "[]"));
            for (int i = 0; i < arr.length(); i++) {
                AlarmItem a = AlarmItem.fromJson(arr.getJSONObject(i));
                if (a.at > 0) out.add(a);
            }
        } catch (JSONException ignored) { }
        return out;
    }

    static synchronized void save(Context c, List<AlarmItem> list) {
        JSONArray arr = new JSONArray();
        for (AlarmItem a : list) arr.put(a.toJson());
        sp(c).edit().putString("alarms", arr.toString()).apply();
    }

    static synchronized JSONObject config(Context c) {
        try {
            return new JSONObject(sp(c).getString("config", "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    static synchronized void saveConfig(Context c, String json) {
        sp(c).edit().putString("config", json).apply();
    }

    static synchronized void addResult(Context c, AlarmItem a, String status) {
        try {
            JSONArray arr = new JSONArray(sp(c).getString("results", "[]"));
            JSONObject o = new JSONObject();
            o.put("key", a.key);
            o.put("date", a.date);
            o.put("medId", a.medId);
            o.put("time", a.time);
            o.put("status", status);
            o.put("ts", System.currentTimeMillis());
            arr.put(o);
            sp(c).edit().putString("results", arr.toString()).apply();
        } catch (JSONException ignored) { }
    }

    static synchronized String popResults(Context c) {
        String s = sp(c).getString("results", "[]");
        sp(c).edit().putString("results", "[]").apply();
        return s;
    }

    /** يضيف تنبيه متابعة (تكرار أو تأجيل) لنفس الجرعة. */
    static synchronized void addFollowUp(Context c, AlarmItem base, long delayMs, int n) {
        AlarmItem f = AlarmItem.fromJson(base.toJson());
        f.at = System.currentTimeMillis() + delayMs;
        f.n = n;
        f.src = "native";
        f.id = idFor(base.key + "#f" + f.at);
        List<AlarmItem> list = load(c);
        list.add(f);
        save(c, list);
    }

    /** يزيل كل تنبيهات المتابعة الأصلية لهذه الجرعة. */
    static synchronized void removeNativeFor(Context c, String key) {
        List<AlarmItem> keep = new ArrayList<>();
        for (AlarmItem a : load(c)) {
            if ("native".equals(a.src) && a.key.equals(key)) continue;
            keep.add(a);
        }
        save(c, keep);
    }

    static void cancelAll(Context c) {
        save(c, new ArrayList<AlarmItem>());
        armNext(c);
    }

    /** يضبط أقرب تنبيه فقط عبر setAlarmClock (الأقوى: يوقظ الهاتف ويتجاوز وضع السكون). */
    static void armNext(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent i = new Intent(c, AlarmReceiver.class).setAction(ACTION_FIRE);
        PendingIntent pi = PendingIntent.getBroadcast(c, REQ_FIRE, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.cancel(pi);

        AlarmItem next = null;
        for (AlarmItem a : load(c)) {
            if (next == null || a.at < next.at) next = a;
        }
        if (next == null) return;

        long at = Math.max(next.at, System.currentTimeMillis() + 1000L);
        try {
            PendingIntent show = PendingIntent.getActivity(c, REQ_SHOW,
                    new Intent(c, MainActivity.class),
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), pi);
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }
}
