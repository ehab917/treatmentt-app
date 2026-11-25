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
 * شاشة المنبّه. التصميم:
 *  - أعلى: العنوان والوقت (ثابتان).
 *  - وسط: قائمة الأدوية داخل ScrollView، فتظهر كل الصور مهما كثرت الأدوية.
 *  - أسفل: الأزرار وشريط السحب (ثابتان دائمًا ولا يختفيان).
 * دواء واحد: صورة كبيرة بالمنتصف مع الاسم. عدة أدوية: بطاقات بمربعات اختيار.
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

    private GradientDrawable rounded(int fill, int radiusDp, int strokeColor) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(fill);
        g.setCornerRadius(dp(radiusDp));
        if (strokeColor != 0) g.setStroke(dp(1.5f), strokeColor);
        return g;
    }

    private Button button(String text, int color, int heightDp, float sp) {
        Button b = new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setTextSize(sp);
        b.setTextColor(Color.WHITE);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setBackground(rounded(color, 16, 0));
        b.setMinHeight(0);
        b.setMinimumHeight(0);
        b.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(heightDp)));
        return b;
    }

    private Button actionButton(String text, int color, int heightDp, float sp, final String action) {
        Button b = button(text, color, heightDp, sp);
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
        boolean rtl = labels == null || labels.optBoolean("rtl", true);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(0xFF0B3D36);
        root.setPadding(dp(18), dp(40), dp(18), dp(16));
        root.setLayoutDirection(rtl ? View.LAYOUT_DIRECTION_RTL : View.LAYOUT_DIRECTION_LTR);

        /* ---------- أعلى (ثابت) ---------- */
        tvTitle = label(18, 0xFFA7F3D0, true);
        tvTime = label(52, Color.WHITE, true);
        root.addView(tvTitle);
        root.addView(tvTime);

        /* ---------- وسط: قائمة قابلة للتمرير ---------- */
        listBox = new LinearLayout(this);
        listBox.setOrientation(LinearLayout.VERTICAL);
        listBox.setGravity(Gravity.CENTER_HORIZONTAL);
        ScrollView sv = new ScrollView(this);
        sv.setFillViewport(true);
        sv.addView(listBox, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        LinearLayout.LayoutParams svp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f);
        svp.topMargin = dp(10);
        svp.bottomMargin = dp(6);
        root.addView(sv, svp);

        tvMore = label(15, 0xFFFCD34D, false);
        root.addView(tvMore);

        /* ---------- أسفل (ثابت دائمًا) ---------- */
        btnTaken = button(takenLabel, 0xFF16A34A, 60, 20);
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
        LinearLayout.LayoutParams tp = (LinearLayout.LayoutParams) btnTaken.getLayoutParams();
        tp.topMargin = dp(6);
        root.addView(btnTaken);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        Button snooze = actionButton(AlarmService.labelOf(labels, "snooze", "Snooze"), 0xFFD97706, 52, 15, AlarmService.ACT_SNOOZE);
        Button skip = actionButton(AlarmService.labelOf(labels, "skip", "Skip"), 0xFF475569, 52, 15, AlarmService.ACT_SKIP);
        LinearLayout.LayoutParams l1 = new LinearLayout.LayoutParams(0, dp(52), 1f);
        l1.setMarginEnd(dp(8));
        row.addView(snooze, l1);
        row.addView(skip, new LinearLayout.LayoutParams(0, dp(52), 1f));
        LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        rp.topMargin = dp(10);
        root.addView(row, rp);

        TextView slideLabel = label(13, 0xFFCBD5E1, false);
        slideLabel.setText(AlarmService.labelOf(labels, "slide", ""));
        LinearLayout.LayoutParams sl = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        sl.topMargin = dp(14);
        root.addView(slideLabel, sl);

        SeekBar slider = new SeekBar(this);
        slider.setMax(100);
        slider.setPadding(dp(20), dp(8), dp(20), dp(8));
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

        setContentView(root);
    }

    /** صورة الدواء (إن وُجدت) بحواف مستديرة، وإلا مربع بأيقونة 💊 */
    private View photoView(String medId, int sizeDp) {
        File f = AlarmStore.photoFile(this, medId);
        Bitmap bmp = f.exists() ? BitmapFactory.decodeFile(f.getAbsolutePath()) : null;
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp));
        if (bmp != null) {
            ImageView iv = new ImageView(this);
            iv.setImageBitmap(bmp);
            iv.setScaleType(ImageView.ScaleType.CENTER_CROP);
            iv.setBackground(rounded(0xFF134E45, 18, 0x66FFFFFF));
            iv.setClipToOutline(true);
            iv.setLayoutParams(lp);
            return iv;
        }
        TextView ph = label(sizeDp > 120 ? 64 : 30, Color.WHITE, false);
        ph.setText("💊");
        ph.setBackground(rounded(0xFF134E45, 18, 0x66FFFFFF));
        ph.setLayoutParams(lp);
        return ph;
    }

    /** يعيد بناء القائمة فقط عند تغيّرها (حتى لا تضيع اختيارات المريض). */
    private void rebuildList(AlarmItem a) {
        JSONArray items = a.itemsOrSingle();
        String sig = a.key + "|" + items.toString();
        if (sig.equals(shownSig)) return;
        shownSig = sig;
        listBox.removeAllViews();
        boxes.clear();
        boxIds.clear();
        int n = items.length();
        boolean multi = n > 1;

        for (int i = 0; i < n; i++) {
            JSONObject it = items.optJSONObject(i);
            if (it == null) continue;
            String medId = it.optString("medId", "");
            String name = it.optString("name", "");
            String dose = it.optString("dose", "");

            CheckBox cb = new CheckBox(this);
            cb.setChecked(true);
            boxes.add(cb);
            boxIds.add(medId);

            if (!multi) {
                /* دواء واحد: صورة كبيرة بالمنتصف + الاسم + الجرعة */
                LinearLayout one = new LinearLayout(this);
                one.setOrientation(LinearLayout.VERTICAL);
                one.setGravity(Gravity.CENTER_HORIZONTAL);
                View photo = photoView(medId, 190);
                one.addView(photo);
                TextView tvName = label(28, Color.WHITE, true);
                tvName.setText(name);
                LinearLayout.LayoutParams np = new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                np.topMargin = dp(14);
                one.addView(tvName, np);
                if (!dose.isEmpty()) {
                    TextView tvDose = label(18, 0xFFA7F3D0, false);
                    tvDose.setText(dose);
                    one.addView(tvDose);
                }
                listBox.addView(one, new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
                continue;
            }

            /* عدة أدوية: بطاقة لكل دواء (صورة + اسم + جرعة + مربع اختيار) */
            LinearLayout card = new LinearLayout(this);
            card.setOrientation(LinearLayout.HORIZONTAL);
            card.setGravity(Gravity.CENTER_VERTICAL);
            card.setPadding(dp(10), dp(10), dp(12), dp(10));
            card.setBackground(rounded(0x26FFFFFF, 18, 0x44FFFFFF));
            View photo = photoView(medId, n > 2 ? 72 : 88);
            ((LinearLayout.LayoutParams) photo.getLayoutParams()).setMarginEnd(dp(12));
            card.addView(photo);

            LinearLayout texts = new LinearLayout(this);
            texts.setOrientation(LinearLayout.VERTICAL);
            TextView tvName = label(20, Color.WHITE, true);
            tvName.setGravity(Gravity.START);
            tvName.setText(name);
            texts.addView(tvName);
            if (!dose.isEmpty()) {
                TextView tvDose = label(15, 0xFFA7F3D0, false);
                tvDose.setGravity(Gravity.START);
                tvDose.setText(dose);
                texts.addView(tvDose);
            }
            card.addView(texts, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

            cb.setButtonTintList(ColorStateList.valueOf(Color.WHITE));
            cb.setScaleX(1.35f);
            cb.setScaleY(1.35f);
            card.addView(cb, new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            final CheckBox box = cb;
            card.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    box.toggle();
                }
            });
            LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            cp.bottomMargin = dp(10);
            listBox.addView(card, cp);
        }
        btnTaken.setText(multi ? takenSelLabel : takenLabel);
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
