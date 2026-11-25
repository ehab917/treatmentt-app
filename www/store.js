/* store.js — طبقة البيانات المحلية + حساب الإحصاء
   كل البيانات محفوظة داخل localStorage على جهاز المستخدم فقط. */

const STORAGE_KEY = 'treatment-reminder.state.v1';
const LOG_KEY = 'treatment-reminder.logs.v1';

const PALETTE = ['#0fb295', '#2f6fed', '#e8833a', '#8b5cf6', '#e0474c', '#0ea5e9', '#16a34a', '#db2777'];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- تواريخ ---------- */
function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayISO() { return toISO(new Date()); }
function fromISO(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function addDaysISO(s, n) {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
function daysBetween(a, b) {
  return Math.round((fromISO(b) - fromISO(a)) / 86400000);
}
function isValidTime(v) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(v); }

/* ---------- الحالة ---------- */
const DEFAULT_STATE = {
  version: 1,
  settings: {
    lang: 'ar',
    patientName: '',
    notify: true,
    sound: true,
    theme: 'auto',
    tone: 'chime',
    volume: 0.8,
    vibration: 'medium',
    vibPattern: null,
    customTone: '',
    customToneName: '',
    dailySummary: '20:00',
    snoozeMin: 10,
    alarmMode: true,
    fontSize: 'medium',
    timeFormat: '12',
    stockAlertDays: 3,
    repeatMin: 5,
    repeatMax: 6,
    ringSec: 60,
    graceMin: 30,
    onboarded: false,
    installDismissed: false
  },
  meds: [],
  appointments: []
};

function loadState() {
  try {
    const raw = storageRead(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    const state = { ...structuredClone(DEFAULT_STATE), ...parsed };
    state.settings = { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) };
    state.meds = Array.isArray(parsed.meds) ? parsed.meds : [];
    state.appointments = Array.isArray(parsed.appointments) ? parsed.appointments : [];
    return state;
  } catch (e) {
    return structuredClone(DEFAULT_STATE);
  }
}

let state = loadState();
const listeners = new Set();

function storageRead(key) {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const value = storage.getItem(key);
      if (value != null) return value;
    } catch (e) { /* بعض المتصفحات تمنع التخزين المحلي */ }
  }
  return null;
}

function storageWrite(key, value) {
  for (const storage of [localStorage, sessionStorage]) {
    try { storage.setItem(key, value); return true; } catch (e) { /* جرّب المخزن البديل */ }
  }
  return false;
}

function save() {
  if (!storageWrite(STORAGE_KEY, JSON.stringify(state))) {
    console.warn('تعذّر حفظ البيانات');
  }
  listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });
}

function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function getState() { return state; }

/* ---------- سجل الجرعات ---------- */
function loadLogs() {
  try {
    const raw = storageRead(LOG_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
let logs = loadLogs();

function saveLogs() {
  if (!storageWrite(LOG_KEY, JSON.stringify(logs))) console.warn('تعذّر حفظ السجل');
  listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });
}

function doseKey(date, medId, time) { return `${date}|${medId}|${time}`; }

function getLog(date, medId, time) {
  return logs.find((l) => l.date === date && l.medId === medId && l.time === time);
}

/** حالة الجرعة: taken | skipped | missed | pending */
function doseStatus(date, medId, time, graceMin) {
  const log = getLog(date, medId, time);
  if (log) return log.status;
  const grace = graceMin == null ? state.settings.graceMin : graceMin;
  const now = new Date();
  const today = todayISO();
  if (date < today) return 'missed';
  if (date > today) return 'pending';
  const [h, m] = time.split(':').map(Number);
  const due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  return now.getTime() - due.getTime() >= grace * 60000 ? 'missed' : 'pending';
}

function adjustStock(medId, sign) {
  const med = state.meds.find((m) => m.id === medId);
  if (!med || med.stock == null) return;
  const per = Number(med.perDose) || 1;
  med.stock = Math.max(0, Math.round((Number(med.stock) + sign * per) * 100) / 100);
  save();
}

function setDoseStatus(date, medId, time, status) {
  const existing = getLog(date, medId, time);
  const wasTaken = !!existing && existing.status === 'taken';
  if (!wasTaken && status === 'taken') adjustStock(medId, -1);
  if (wasTaken && status !== 'taken') adjustStock(medId, +1);
  if (existing) {
    if (status === null) logs = logs.filter((l) => l !== existing);
    else { existing.status = status; existing.ts = Date.now(); }
  } else if (status !== null) {
    logs.push({ id: uid(), date, medId, time, status, ts: Date.now() });
  }
  saveLogs();
}

function clearAllLogs() { logs = []; saveLogs(); }

/* ---------- الأدوية ---------- */
function medActiveOn(med, date) {
  if (med.paused) return false;
  if (med.startDate && date < med.startDate) return false;
  if (med.endDate && date > med.endDate) return false;
  return true;
}

function activeMeds(date) {
  return state.meds.filter((m) => medActiveOn(m, date));
}

/** كل الجرعات المتوقعة في يوم معيّن */
function expectedDoses(date) {
  const out = [];
  activeMeds(date).forEach((med) => {
    (med.times || []).forEach((time) => out.push({ medId: med.id, time, med }));
  });
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

function toStock(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function addMed(data) {
  const med = {
    id: uid(),
    nameAr: (data.nameAr || '').trim(),
    nameEn: (data.nameEn || '').trim(),
    dose: (data.dose || '').trim(),
    form: (data.form || '').trim(),
    notes: (data.notes || '').trim(),
    times: (data.times || []).filter(isValidTime).sort(),
    startDate: data.startDate || todayISO(),
    endDate: data.endDate || '',
    color: data.color || PALETTE[state.meds.length % PALETTE.length],
    paused: false,
    stock: toStock(data.stock),
    perDose: Number(data.perDose) > 0 ? Number(data.perDose) : 1,
    photo: typeof data.photo === 'string' ? data.photo : '',
    createdAt: Date.now()
  };
  state.meds.push(med);
  save();
  return med;
}

function updateMed(id, data) {
  const med = state.meds.find((m) => m.id === id);
  if (!med) return null;
  Object.assign(med, {
    nameAr: (data.nameAr ?? med.nameAr).trim(),
    nameEn: (data.nameEn ?? med.nameEn).trim(),
    dose: (data.dose ?? med.dose).trim(),
    form: (data.form ?? med.form).trim(),
    notes: (data.notes ?? med.notes).trim(),
    times: (data.times || med.times || []).filter(isValidTime).sort(),
    startDate: data.startDate || med.startDate,
    endDate: data.endDate === undefined ? med.endDate : data.endDate,
    color: data.color || med.color,
    paused: data.paused === undefined ? med.paused : !!data.paused,
    photo: data.photo === undefined ? (med.photo || '') : (typeof data.photo === 'string' ? data.photo : ''),
    stock: data.stock === undefined ? med.stock : toStock(data.stock),
    perDose: data.perDose === undefined ? (med.perDose || 1) : (Number(data.perDose) > 0 ? Number(data.perDose) : 1)
  });
  save();
  return med;
}

function refillMed(id, qty) {
  const med = state.meds.find((m) => m.id === id);
  const n = Number(qty);
  if (!med || !(n > 0)) return null;
  med.stock = (med.stock == null ? 0 : Number(med.stock)) + n;
  save();
  return med;
}

/** كم يومًا يكفي المخزون الحالي (null إن لم يُحدَّد مخزون) */
function stockDaysLeft(med) {
  if (!med || med.stock == null) return null;
  const perDay = (Number(med.perDose) || 1) * Math.max(1, (med.times || []).length);
  return Math.floor(Number(med.stock) / perDay);
}

/** الأدوية التي قاربت على النفاد (تكفي أقل من أو تساوي عتبة الأيام) */
function lowStockMeds() {
  const limit = Number(state.settings.stockAlertDays);
  const days = Number.isFinite(limit) ? limit : 3;
  return state.meds.filter((m) => {
    if (m.paused || m.stock == null) return false;
    return stockDaysLeft(m) <= days;
  });
}

function deleteMed(id) {
  state.meds = state.meds.filter((m) => m.id !== id);
  logs = logs.filter((l) => l.medId !== id);
  save();
  saveLogs();
}

function toggleMedPaused(id) {
  const med = state.meds.find((m) => m.id === id);
  if (!med) return;
  med.paused = !med.paused;
  save();
}

/* ---------- المواعيد ---------- */
function addAppt(data) {
  const appt = {
    id: uid(),
    titleAr: (data.titleAr || '').trim(),
    titleEn: (data.titleEn || '').trim(),
    doctor: (data.doctor || '').trim(),
    clinic: (data.clinic || '').trim(),
    date: data.date || todayISO(),
    time: data.time || '09:00',
    remindBeforeMin: data.remindBeforeMin == null ? 120 : Number(data.remindBeforeMin),
    notes: (data.notes || '').trim(),
    status: 'planned',
    createdAt: Date.now()
  };
  state.appointments.push(appt);
  save();
  return appt;
}

function updateAppt(id, data) {
  const a = state.appointments.find((x) => x.id === id);
  if (!a) return null;
  Object.assign(a, {
    titleAr: (data.titleAr ?? a.titleAr).trim(),
    titleEn: (data.titleEn ?? a.titleEn).trim(),
    doctor: (data.doctor ?? a.doctor).trim(),
    clinic: (data.clinic ?? a.clinic).trim(),
    date: data.date || a.date,
    time: data.time || a.time,
    remindBeforeMin: data.remindBeforeMin === undefined ? a.remindBeforeMin : Number(data.remindBeforeMin),
    notes: (data.notes ?? a.notes).trim(),
    status: data.status || a.status
  });
  save();
  return a;
}

function setApptStatus(id, status) {
  const a = state.appointments.find((x) => x.id === id);
  if (!a) return;
  a.status = status;
  save();
}

function deleteAppt(id) {
  state.appointments = state.appointments.filter((a) => a.id !== id);
  save();
}

/** توقيت الموعد كـ Date */
function apptDateTime(a) {
  const [h, m] = (a.time || '09:00').split(':').map(Number);
  const d = fromISO(a.date);
  d.setHours(h, m, 0, 0);
  return d;
}
function apptNotifyTime(a) {
  const d = apptDateTime(a);
  d.setMinutes(d.getMinutes() - (a.remindBeforeMin || 0));
  return d;
}
function upcomingAppts() {
  const now = Date.now();
  return state.appointments
    .filter((a) => a.status === 'planned' && apptDateTime(a).getTime() >= now - 3600000)
    .sort((a, b) => apptDateTime(a) - apptDateTime(b));
}

/* ---------- الإحصاء ---------- */
function dayStats(date) {
  const doses = expectedDoses(date);
  let taken = 0, skipped = 0, missed = 0, pending = 0;
  doses.forEach((d) => {
    const s = doseStatus(date, d.medId, d.time);
    if (s === 'taken') taken++;
    else if (s === 'skipped') skipped++;
    else if (s === 'missed') missed++;
    else pending++;
  });
  const expected = doses.length;
  return {
    date, taken, skipped, missed, pending, expected,
    pct: expected ? Math.round((taken / expected) * 100) : null
  };
}

function rangeStats(fromDate, toDate) {
  let taken = 0, skipped = 0, missed = 0, expected = 0;
  let d = fromDate;
  while (d <= toDate) {
    const s = dayStats(d);
    taken += s.taken; skipped += s.skipped; missed += s.missed; expected += s.expected;
    d = addDaysISO(d, 1);
  }
  return { taken, skipped, missed, expected, pct: expected ? Math.round((taken / expected) * 100) : 0 };
}

/** الالتزام لكل دواء خلال آخر N يوم */
function perMedStats(days = 30) {
  const today = todayISO();
  const from = addDaysISO(today, -(days - 1));
  return state.meds.map((med) => {
    let expected = 0, taken = 0, skipped = 0, missed = 0;
    let d = from;
    while (d <= today) {
      if (medActiveOn(med, d)) {
        (med.times || []).forEach((time) => {
          expected++;
          const s = doseStatus(d, med.id, time);
          if (s === 'taken') taken++;
          else if (s === 'skipped') skipped++;
          else if (s === 'missed') missed++;
        });
      }
      d = addDaysISO(d, 1);
    }
    return { med, expected, taken, skipped, missed, pct: expected ? Math.round((taken / expected) * 100) : null };
  });
}

/** سلسلة الأيام المتواصلة (أيام مكتملة 100%) */
function streakInfo() {
  const today = todayISO();
  let streak = 0;
  let d = addDaysISO(today, -1);
  for (let i = 0; i < 400; i++) {
    const s = dayStats(d);
    if (s.expected === 0) { d = addDaysISO(d, -1); continue; }
    if (s.pct === 100) { streak++; d = addDaysISO(d, -1); }
    else break;
  }
  const t = dayStats(today);
  const todayPerfect = t.expected > 0 && t.pct === 100 && t.pending === 0;
  return { streak, todayPerfect, today: t };
}

/** 12 أسبوعًا (84 يومًا) المنتهية اليوم، مرتّبة بالأسبوع */
function heatmapData(weeks = 12) {
  const today = todayISO();
  const todayDow = fromISO(today).getDay(); // 0=الأحد
  const lastColStart = addDaysISO(today, -todayDow);
  const start = addDaysISO(lastColStart, -(weeks - 1) * 7);
  const cols = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const date = addDaysISO(start, w * 7 + i);
      if (date > today) { col.push(null); continue; }
      const s = dayStats(date);
      col.push({ date, pct: s.pct, expected: s.expected, taken: s.taken });
    }
    cols.push(col);
  }
  return { cols, start, end: today };
}

/* ---------- الإعدادات ---------- */
function updateSettings(patch) {
  Object.assign(state.settings, patch);
  save();
}

/* ---------- نسخة احتياطية ---------- */
function exportPayload() {
  return {
    app: 'treatment-reminder',
    version: 1,
    exportedAt: new Date().toISOString(),
    state: { ...state },
    logs
  };
}

function importPayload(payload) {
  if (!payload || payload.app !== 'treatment-reminder' || !payload.state) {
    throw new Error('invalid');
  }
  state = { ...structuredClone(DEFAULT_STATE), ...payload.state };
  state.settings = { ...DEFAULT_STATE.settings, ...(payload.state.settings || {}) };
  state.meds = Array.isArray(payload.state.meds) ? payload.state.meds : [];
  state.appointments = Array.isArray(payload.state.appointments) ? payload.state.appointments : [];
  logs = Array.isArray(payload.logs) ? payload.logs : [];
  save();
  saveLogs();
}

/* ---------- تصدير التقويم (ICS) ---------- */
function icsEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
function icsDate(dateStr, timeStr) {
  return `${dateStr.replace(/-/g, '')}T${timeStr.replace(':', '')}00`;
}
function buildICS(lang) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Treatment Reminder//AR-EN//EN', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsEscape(lang === 'ar' ? 'تذكير العلاج' : 'Treatment Reminder')
  ];
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  state.appointments.filter((a) => a.status !== 'cancelled').forEach((a) => {
    const title = lang === 'ar' ? (a.titleAr || a.titleEn || 'موعد') : (a.titleEn || a.titleAr || 'Appointment');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${a.id}@treatment-reminder`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART:${icsDate(a.date, a.time)}`);
    lines.push(`DURATION:PT1H`);
    lines.push(`SUMMARY:${icsEscape(title)}`);
    const where = [a.clinic, a.doctor].filter(Boolean).join(' - ');
    if (where) lines.push(`LOCATION:${icsEscape(where)}`);
    if (a.notes) lines.push(`DESCRIPTION:${icsEscape(a.notes)}`);
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY',
      `TRIGGER:-PT${Math.max(0, a.remindBeforeMin || 0)}M`,
      `DESCRIPTION:${icsEscape(title)}`, 'END:VALARM');
    lines.push('END:VEVENT');
  });

  state.meds.filter((m) => !m.paused && (m.times || []).length).forEach((m) => {
    const title = lang === 'ar' ? (m.nameAr || m.nameEn || 'دواء') : (m.nameEn || m.nameAr || 'Medicine');
    const desc = [m.dose && (m.dose + ' mg'), m.form, m.notes].filter(Boolean).join(' - ');
    m.times.forEach((time) => {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${m.id}-${time.replace(':', '')}@treatment-reminder`);
      lines.push(`DTSTAMP:${now}`);
      lines.push(`DTSTART:${icsDate(m.startDate || todayISO(), time)}`);
      if (m.endDate) {
        lines.push(`RRULE:FREQ=DAILY;UNTIL=${m.endDate.replace(/-/g, '')}T235900`);
      } else {
        lines.push('RRULE:FREQ=DAILY');
      }
      lines.push(`SUMMARY:${icsEscape(title)}`);
      if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:PT0M', `DESCRIPTION:${icsEscape(title)}`, 'END:VALARM');
      lines.push('END:VEVENT');
    });
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function resetAll() {
  state = structuredClone(DEFAULT_STATE);
  logs = [];
  save();
  saveLogs();
}

export {
  STORAGE_KEY, LOG_KEY, PALETTE,
  uid, toISO, todayISO, fromISO, addDaysISO, daysBetween, isValidTime,
  getState, save, subscribe, loadState,
  doseKey, getLog, doseStatus, setDoseStatus, clearAllLogs,
  medActiveOn, activeMeds, expectedDoses,
  addMed, updateMed, deleteMed, toggleMedPaused, refillMed, stockDaysLeft, lowStockMeds,
  addAppt, updateAppt, setApptStatus, deleteAppt, apptDateTime, apptNotifyTime, upcomingAppts,
  dayStats, rangeStats, perMedStats, streakInfo, heatmapData,
  updateSettings, exportPayload, importPayload, buildICS, resetAll
};
