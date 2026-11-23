package com.treatmentreminder.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import java.util.ArrayList;
import java.util.List;

/** يستقبل موعد المنبّه، وأحداث إعادة التشغيل/تغيير الوقت لإعادة ضبط المنبّهات. */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        AlarmStore.log(context, "receiver: " + action);
        if (AlarmStore.ACTION_FIRE.equals(action)) {
            long now = System.currentTimeMillis();
            List<AlarmItem> keep = new ArrayList<>();
            for (AlarmItem a : AlarmStore.load(context)) {
                if (a.at <= now + 2000L) {
                    if (now - a.at <= AlarmStore.STALE_MS) {
                        AlarmService.start(context, a);
                    } else {
                        AlarmStore.log(context, "dropped stale alarm " + a.key);
                    }
                } else {
                    keep.add(a);
                }
            }
            AlarmStore.save(context, keep);
        }
        AlarmStore.armNext(context);
    }
}
