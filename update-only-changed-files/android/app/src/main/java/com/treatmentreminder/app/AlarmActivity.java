package com.treatmentreminder.app;

import android.app.Activity;
import android.content.Intent;
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
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;

import org.json.JSONObject;

/** شاشة المنبّه: تظهر فوق القفل وتشعل الشاشة، وفيها أزرار التأكيد والتأجيل والتخطي وشريط سحب لإيقاف الصوت. */
public class AlarmActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView tvTitle;
    private TextView tvTime;
    private TextView tvName;
    private TextView tvMore;
    private String moreLabel = "";
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

    private Button button(String text, int color, final String action) {
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
        b.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                AlarmItem a = AlarmService.head();
                AlarmService.sendAction(AlarmActivity.this, action, a == null ? "" : a.key);
            }
        });
        return b;
    }

    private void buildUi() {
        JSONObject labels = AlarmStore.config(this).optJSONObject("labels");
        moreLabel = AlarmService.labelOf(labels, "more", "");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackgroundColor(0xFF0B3D36);
        root.setPadding(dp(24), dp(56), dp(24), dp(28));
        boolean rtl = labels == null || labels.optBoolean("rtl", true);
        root.setLayoutDirection(rtl ? View.LAYOUT_DIRECTION_RTL : View.LAYOUT_DIRECTION_LTR);

        tvTitle = label(20, 0xFFA7F3D0, true);
        tvTime = label(64, Color.WHITE, true);
        tvName = label(30, Color.WHITE, true);
        tvMore = label(16, 0xFFFCD34D, false);
        root.addView(tvTitle);
        root.addView(tvTime);
        root.addView(tvName);
        root.addView(tvMore);

        View spacer = new View(this);
        root.addView(spacer, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        root.addView(button(AlarmService.labelOf(labels, "taken", "OK"), 0xFF16A34A, AlarmService.ACT_TAKEN));
        root.addView(button(AlarmService.labelOf(labels, "snooze", "Snooze"), 0xFFD97706, AlarmService.ACT_SNOOZE));
        root.addView(button(AlarmService.labelOf(labels, "skip", "Skip"), 0xFF475569, AlarmService.ACT_SKIP));

        TextView slideLabel = label(15, 0xFFCBD5E1, false);
        slideLabel.setText(AlarmService.labelOf(labels, "slide", ""));
        LinearLayout.LayoutParams sl = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        sl.topMargin = dp(28);
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

    private void refresh() {
        AlarmItem a = AlarmService.head();
        if (a == null) {
            finish();
            return;
        }
        tvTitle.setText("⏰  " + a.title);
        tvTime.setText(a.time);
        tvName.setText(a.body);
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
