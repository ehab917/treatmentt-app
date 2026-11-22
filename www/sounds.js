/* sounds.js — نغمات التنبيه والاهتزاز
   • نغمات مدمجة مولَّدة بـ Web Audio (تشتغل بدون ملفات خارجية)
   • نغمة مخصّصة من ملفات الهاتف
   • أنماط اهتزاز (أندرويد)
   • إرشادات ربط نغمة الهاتف (أجراس/تنبيهات النظام) في إعدادات النظام */

/* ---------------- النغمات المدمجة ---------------- */
export const TONES = {
  none: { label: 'صامت', notes: [] },
  beep: {
    label: 'نبضة قصيرة',
    notes: [{ f: 880, t: 0, d: 0.13, type: 'square', g: 0.55 }]
  },
  bell: {
    label: 'جرس',
    notes: [
      { f: 1046.5, t: 0, d: 0.22, type: 'sine', g: 0.6 },
      { f: 1567.98, t: 0.1, d: 0.75, type: 'sine', g: 0.45 }
    ]
  },
  chime: {
    label: 'ثلاث نغمات',
    notes: [
      { f: 880, t: 0, d: 0.18, type: 'triangle', g: 0.5 },
      { f: 1108.73, t: 0.15, d: 0.18, type: 'triangle', g: 0.5 },
      { f: 1318.51, t: 0.3, d: 0.45, type: 'triangle', g: 0.5 }
    ]
  },
  marimba: {
    label: 'ملمبة',
    notes: [
      { f: 523.25, t: 0, d: 0.28, type: 'triangle', g: 0.55 },
      { f: 659.25, t: 0.12, d: 0.28, type: 'triangle', g: 0.5 },
      { f: 783.99, t: 0.24, d: 0.55, type: 'triangle', g: 0.5 }
    ]
  },
  digital: {
    label: 'تنبيه رقمي',
    notes: [
      { f: 1200, t: 0, d: 0.08, type: 'square', g: 0.4 },
      { f: 1200, t: 0.16, d: 0.08, type: 'square', g: 0.4 }
    ]
  },
  urgent: {
    label: 'تنبيه عاجل',
    notes: [
      { f: 660, t: 0, d: 0.14, type: 'square', g: 0.45 },
      { f: 880, t: 0.17, d: 0.14, type: 'square', g: 0.45 },
      { f: 1320, t: 0.34, d: 0.3, type: 'square', g: 0.45 }
    ]
  },
  soft: {
    label: 'هادئ',
    notes: [{ f: 660, t: 0, d: 0.45, type: 'sine', g: 0.35 }]
  }
};

export const TONE_ORDER = ['chime', 'bell', 'beep', 'digital', 'marimba', 'urgent', 'soft', 'none'];

/* ---------------- أنماط الاهتزاز ---------------- */
export const VIB_PATTERNS = {
  none: [],
  light: [45],
  medium: [120, 70, 120],
  strong: [220, 90, 220, 90, 220],
  double: [90, 60, 90],
  heartbeat: [60, 40, 60, 40, 160]
};
export const VIB_ORDER = ['light', 'medium', 'double', 'heartbeat', 'strong', 'none'];

/* ---------------- تشغيل الصوت ---------------- */
let audioCtx = null;
let masterGain = null;
let compressor = null;

function getCtx() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) {
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 12;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.18;
      masterGain.gain.value = 1.7;
      masterGain.connect(compressor);
      compressor.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch (e) { return null; }
}

/** تشغيل نغمة مدمجة. الاسم 'custom' يشغّل الملف المخصّص. */
export function playTone(name, volume = 0.8, customDataUrl = '') {
  const vol = Math.max(0, Math.min(1, Number(volume) || 0));
  if (!vol) return false;

  if (name === 'custom') {
    if (!customDataUrl) return false;
    try {
      const a = new Audio(customDataUrl);
      a.volume = vol;
      a.play().catch(() => {});
      return true;
    } catch (e) { return false; }
  }

  const tone = TONES[name];
  if (!tone || !tone.notes.length) return false;
  const ac = getCtx();
  if (!ac) return false;

  const now = ac.currentTime + 0.03;
  tone.notes.forEach((n) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = n.type || 'sine';
    osc.frequency.setValueAtTime(n.f, now + n.t);
    const peak = Math.max(0.0001, (n.g == null ? 0.5 : n.g) * vol);
    gain.gain.setValueAtTime(0.0001, now + n.t);
    gain.gain.linearRampToValueAtTime(peak, now + n.t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + Math.max(0.05, n.d));
    osc.connect(gain);
    gain.connect(masterGain || ac.destination);
    osc.start(now + n.t);
    osc.stop(now + n.t + n.d + 0.08);
  });
  return true;
}

/** تشغيل اهتزاز بنمط محدد */
export function vibrate(pattern) {
  if (!('vibrate' in navigator)) return false;
  const arr = Array.isArray(pattern) ? pattern : [];
  if (!arr.length) return false;
  try { return navigator.vibrate(arr); } catch (e) { return false; }
}

/** تحديد نظام التشغيل (لتوجيه خطوات اختيار نغمة الهاتف) */
export function deviceOS() {
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Mac/i.test(ua)) return 'mac';
  return 'other';
}

/** خطوات اختيار نغمة الهاتف من إعدادات النظام */
export function phoneSoundSteps(lang) {
  const ar = lang === 'ar';
  const android = ar
    ? [
        'استقبل أول إشعار من التطبيق (حتى يظهر في سجل الإشعارات).',
        'اضغط مطوّلًا على الإشعار ← اضغط ⚙️ أو «الإعدادات».',
        'من «الأصوات» أو «الصوت» اختر أي نغمة من نغمات هاتفك (الأجراس / التنبيهات / نغمات النظام).',
        'بديلًا: إعدادات الهاتف ← التطبيقات ← تذكير العلاج ← الإشعارات ← الأصوات.'
      ]
    : [
        'Receive the app\'s first notification so it appears in your shade.',
        'Long-press the notification, then tap ⚙️ / Settings.',
        'Under Sounds, pick any ringtone from your phone (Ringtones / Notifications / System tones).',
        'Alternative: Phone Settings ← Apps ← Treatment Reminder ← Notifications ← Sound.'
      ];
  const ios = ar
    ? [
        'ثبّت التطبيق على الشاشة الرئيسية أولًا.',
        'افتح: إعدادات الهاتف ← الإشعارات ← ابحث عن «تذكير العلاج».',
        'اضغط «الأصوات» واختر أي نغمة من نغمات الهاتف (الأجراس / التنبيهات).',
        'فعّل «معاينة» لتجربة النغمة قبل الحفظ.'
      ]
    : [
        'Install the app to your Home Screen first.',
        'Open: Settings ← Notifications, then look for "Treatment Reminder".',
        'Tap Sounds and pick any ringtone from your phone (Ringtones / Alerts).',
        'Enable "Preview" to try the sound before saving.'
      ];
  return deviceOS() === 'ios' ? ios : android;
}

/** فتح إعدادات إشعارات الأندرويد مباشرة (إن أمكن) */
export function openSystemNotificationSettings() {
  if (deviceOS() !== 'android') return false;
  try {
    window.location.href = 'intent://#Intent;action=android.settings.NOTIFICATION_SETTINGS;end';
    return true;
  } catch (e) { return false; }
}

/** استقبال ملف صوتي من الهاتف كـ data URL */
export function readAudioFile(file, maxBytes = 1500000) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('no file'));
    if (file.size > maxBytes) return reject(new Error('too big'));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read error'));
    reader.readAsDataURL(file);
  });
}
