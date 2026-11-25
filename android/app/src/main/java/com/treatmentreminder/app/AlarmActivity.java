package com.treatmentreminder.app;

import android.app.Activity;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * شاشة المنبّه: تظهر فوق القفل وتشعل الشاشة. تعرض كل أدوية هذا الموعد بمربعات اختيار،
 * وأزرار «أخذت المحدّد» و«تأجيل» و«تخطي»، وشريط سحب لإيقاف الصوت.
 */
public class AlarmActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView tvTitle;
    private TextView tvTime;
    private TextView tvMore;
    private LinearLayout listBox;
    private Button btnTaken;
    private String moreLabel = "";
    private String takenLabel = "";
    private String takenSelLabel = "";
    private String pickOneLabel = "";
    private String shownSig = "";
    private final List<CheckBox> boxes = new ArrayList<>();
    private final List<String> boxIds = new ArrayList<>();
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            refresh();
            handler.postDelayed(this, 700);
        }
    };

    private int dp(float v) {
        return (int) (v * getResources().getDisplayMetrics().density + 0.5f);
    }

    @SuppressWarnings("deprecation")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        buildUi();
    }

    private TextView label(float sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setTextSize(sp);
        t.setTextColor(color);
        t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private Button button(String text, int color) {
        Button b = new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setTextSize(20);
        b.setTextColor(Color.WHITE);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(color);
        bg.setCornerRadius(dp(18));
        b.setBackground(bg);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(64));
        lp.topMargin = dp(12);
        b.setLayoutParams(lp);
        return b;
    }

    private Button actionButton(String text, int color, final String action) {
        Button b = button(text, color);
        b.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                AlarmItem a = AlarmService.head();
                AlarmService.sendAction(AlarmActivity.this, action, a == null ? "" : a.key);
            }
        });
        return b;
    }

    private String checkedIds() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < boxes.size(); i++) {
            if (boxes.get(i).isChecked()) {
                if (sb.length() > 0) sb.append(',');
                sb.append(boxIds.get(i));
            }
        }
        return sb.toString();
    }

    private void buildUi() {
        JSONObject labels = AlarmStore.config(this).optJSONObject("labels");
        moreLabel = AlarmService.labelOf(labels, "more", "");
        takenLabel = AlarmService.labelOf(labels, "taken", "OK");
        takenSelLabel = AlarmService.labelOf(labels, "takenSel", takenLabel);
        pickOneLabel = AlarmService.labelOf(labels, "pickOne", "");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackgroundColor(0xFF0B3D36);
        root.setPadding(dp(24), dp(48), dp(24), dp(28));
        boolean rtl = labels == null || labels.optBoolean("rtl", true);
        root.setLayoutDirection(rtl ? View.LAYOUT_DIRECTION_RTL : View.LAYOUT_DIRECTION_LTR);

        tvTitle = label(20, 0xFFA7F3D0, true);
        tvTime = label(60, Color.WHITE, true);
        tvMore = label(16, 0xFFFCD34D, false);
        root.addView(tvTitle);
        root.addView(tvTime);

        listBox = new LinearLayout(this);
        listBox.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams lb = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lb.topMargin = dp(16);
        root.addView(listBox, lb);
        root.addView(tvMore);

        View spacer = new View(this);
        root.addView(spacer, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        btnTaken = button(takenLabel, 0xFF16A34A);
        btnTaken.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                AlarmItem a = AlarmService.head();
                if (a == null) return;
                String ids = checkedIds();
                if (ids.isEmpty()) {
                    Toast.makeText(AlarmActivity.this, pickOneLabel, Toast.LENGTH_SHORT).show();
                    return;
                }
                AlarmService.sendAction(AlarmActivity.this, AlarmService.ACT_TAKEN, a.key, ids);
            }
        });
        root.addView(btnTaken);
        root.addView(actionButton(AlarmService.labelOf(labels, "snooze", "Snooze"), 0xFFD97706, AlarmService.ACT_SNOOZE));
        root.addView(actionButton(AlarmService.labelOf(labels, "skip", "Skip"), 0xFF475569, AlarmService.ACT_SKIP));

        TextView slideLabel = label(15, 0xFFCBD5E1, false);
        slideLabel.setText(AlarmService.labelOf(labels, "slide", ""));
        LinearLayout.LayoutParams sl = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        sl.topMargin = dp(24);
        root.addView(slideLabel, sl);

        SeekBar slider = new SeekBar(this);
        slider.setMax(100);
        slider.setPadding(dp(24), dp(12), dp(24), dp(12));
        slider.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar s, int p, boolean fromUser) { }

            @Override
            public void onStartTrackingTouch(SeekBar s) { }

            @Override
            public void onStopTrackingTouch(SeekBar s) {
                if (s.getProgress() >= 90) {
                    AlarmService.sendAction(AlarmActivity.this, AlarmService.ACT_SILENCE, "");
                } else {
                    s.setProgress(0);
                }
            }
        });
        root.addView(slider, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        ScrollView sv = new ScrollView(this);
        sv.setFillViewport(true);
        sv.addView(root, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(sv);
    }

    /** صورة الدواء (إن وُجدت) بحواف مستديرة */
    private ImageView photoView(String medId, int sizeDp) {
        try {
            File f = AlarmStore.photoFile(this, medId);
            if (!f.exists()) return null;
            Bitmap bmp = BitmapFactory.decodeFile(f.getAbsolutePath());
            if (bmp == null) return null;
            ImageView iv = new ImageView(this);
            iv.setImageBitmap(bmp);
            iv.setScaleType(ImageView.ScaleType.CENTER_CROP);
            GradientDrawable bg = new GradientDrawable();
            bg.setColor(0xFF134E45);
            bg.setCornerRadius(dp(18));
            iv.setBackground(bg);
            iv.setClipToOutline(true);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp));
            lp.setMarginEnd(dp(12));
            iv.setLayoutParams(lp);
            return iv;
        } catch (Exception e) {
            return null;
        }
    }

    /** يعيد بناء قائمة الأدوية فقط عند تغيّرها (حتى لا تضيع اختيارات المريض). */
    private void rebuildList(AlarmItem a) {
        JSONArray items = a.itemsOrSingle();
        String sig = a.key + "|" + items.toString();
        if (sig.equals(shownSig)) return;
        shownSig = sig;
        listBox.removeAllViews();
        boxes.clear();
        boxIds.clear();
        for (int i = 0; i < items.length(); i++) {
            JSONObject it = items.optJSONObject(i);
            if (it == null) continue;
            String name = it.optString("name", "");
            String dose = it.optString("dose", "");
            CheckBox cb = new CheckBox(this);
            cb.setText(dose.isEmpty() ? name : name + " — " + dose);
            cb.setTextSize(items.length() > 1 ? 22 : 26);
            cb.setTextColor(Color.WHITE);
            cb.setTypeface(Typeface.DEFAULT_BOLD);
            cb.setChecked(true);
            cb.setButtonTintList(ColorStateList.valueOf(Color.WHITE));
            cb.setPadding(dp(8), dp(10), dp(8), dp(10));
            cb.setVisibility(items.length() > 1 ? View.VISIBLE : View.VISIBLE);
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            row.setGravity(Gravity.CENTER_VERTICAL);
            ImageView photo = photoView(it.optString("medId", ""), items.length() > 1 ? 88 : 140);
            if (photo != null) row.addView(photo);
            row.addView(cb, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            LinearLayout.LayoutParams rlp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            rlp.bottomMargin = dp(8);
            listBox.addView(row, rlp);
            boxes.add(cb);
            boxIds.add(it.optString("medId", ""));
        }
        btnTaken.setText(items.length() > 1 ? takenSelLabel : takenLabel);
    }

    private void refresh() {
        AlarmItem a = AlarmService.head();
        if (a == null) {
            finish();
            return;
        }
        tvTitle.setText("⏰  " + a.title);
        tvTime.setText(a.timeLabel != null && !a.timeLabel.isEmpty() ? a.timeLabel : a.time);
        rebuildList(a);
        int c = AlarmService.count();
        tvMore.setText(c > 1 ? "+" + (c - 1) + " " + moreLabel : "");
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        refresh();
    }

    @Override
    protected void onResume() {
        super.onResume();
        handler.removeCallbacks(tick);
        handler.post(tick);
    }

    @Override
    protected void onPause() {
        handler.removeCallbacks(tick);
        super.onPause();
    }
}
