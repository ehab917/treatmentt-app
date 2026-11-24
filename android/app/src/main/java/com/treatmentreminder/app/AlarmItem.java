package com.treatmentreminder.app;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** منبّه جرعة (قد يضم عدة أدوية في نفس الموعد)، أو تكرار/تأجيل له. */
final class AlarmItem {
    int id;
    long at;
    /** معرّف المجموعة، مثل grp:2026-11-24:08:00 */
    String key = "";
    String type = "dose";
    String date = "";
    String medId = "";
    String time = "";
    String title = "";
    String body = "";
    /** الأدوية داخل المنبّه: [{medId, name, dose}] */
    JSONArray items = null;
    /** "js" = جاء من واجهة التطبيق، "native" = تكرار/تأجيل أنشأه الجزء الأصلي */
    String src = "js";
    /** رقم مرّة التكرار */
    int n = 0;

    JSONObject toJson() {
        JSONObject o = new JSONObject();
        try {
            o.put("id", id);
            o.put("at", at);
            o.put("key", key);
            o.put("type", type);
            o.put("date", date);
            o.put("medId", medId);
            o.put("time", time);
            o.put("title", title);
            o.put("body", body);
            o.put("src", src);
            o.put("n", n);
            if (items != null) o.put("items", items);
        } catch (JSONException ignored) { }
        return o;
    }

    static AlarmItem fromJson(JSONObject o) {
        AlarmItem a = new AlarmItem();
        a.at = o.optLong("at", 0);
        a.key = o.optString("key", "");
        a.type = o.optString("type", "dose");
        a.date = o.optString("date", "");
        a.medId = o.optString("medId", "");
        a.time = o.optString("time", "");
        a.title = o.optString("title", "");
        a.body = o.optString("body", "");
        a.src = o.optString("src", "js");
        a.n = o.optInt("n", 0);
        a.items = o.optJSONArray("items");
        a.id = o.optInt("id", 0);
        if (a.id == 0) a.id = AlarmStore.idFor(a.key + "#" + a.at);
        return a;
    }

    static AlarmItem parse(String json) {
        if (json == null || json.isEmpty()) return null;
        try {
            return fromJson(new JSONObject(json));
        } catch (JSONException e) {
            return null;
        }
    }

    /** قائمة الأدوية؛ إن لم توجد (تنبيه قديم/اختبار) تُرجع عنصرًا واحدًا. */
    JSONArray itemsOrSingle() {
        if (items != null && items.length() > 0) return items;
        JSONArray arr = new JSONArray();
        try {
            JSONObject it = new JSONObject();
            it.put("medId", medId);
            it.put("name", body);
            it.put("dose", "");
            arr.put(it);
        } catch (JSONException ignored) { }
        return arr;
    }
}
