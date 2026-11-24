/* app.js — واجهة المستخدم + محرّك التذكيرات
   تطبيق تذكير العلاج */

import * as S from './store.js';
import { t, setLang, getLang } from './i18n.js';
import * as SOUND from './sounds.js';
import * as NATIVE from './native.js';

/* ================= أدوات مساعدة ================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]); }

const locale = () => (getLang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');

function fmtTime(hhmm) {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  const d = new Date(2000, 0, 1, h || 0, m || 0);
  try { return new Intl.DateTimeFormat(locale(), { hour: 'numeric', minute: '2-digit' }).format(d); }
  catch (e) { return hhmm; }
}
function fmtDate(dateISO, opts) {
  const o = opts || { day: 'numeric', month: 'long' };
  try { return new Intl.DateTimeFormat(locale(), o).format(S.fromISO(dateISO)); }
  catch (e) { return dateISO; }
}
function fmtWeekday(dateISO) {
  try { return new Intl.DateTimeFormat(locale(), { weekday: 'long' }).format(S.fromISO(dateISO)); }
  catch (e) { return ''; }
}
function fmtMonthShort(dateISO) {
  try { return new Intl.DateTimeFormat(locale(), { month: 'short' }).format(S.fromISO(dateISO)); }
  catch (e) { return ''; }
}
function dayLabel(dateISO) {
  const today = S.todayISO();
  if (dateISO === today) return t('common.today');
  if (dateISO === S.addDaysISO(today, 1)) return t('common.tomorrow');
  if (dateISO === S.addDaysISO(today, -1)) return t('common.yesterday');
  return fmtDate(dateISO, { weekday: 'long', day: 'numeric', month: 'short' });
}
/* عدد + وحدة بالتصريف الصحيح (مفرد/جمع) */
function countUnit(n, oneKey, manyKey) {
  return `${n} ${n === 1 ? t(oneKey) : t(manyKey)}`;
}
function relCountdown(ts) {
  const diff = ts - Date.now();
  const mins = Math.round(diff / 60000);
  if (mins < 0) return '';
  if (mins < 60) return countUnit(mins, 'common.minute', 'common.minutes');
  const hours = Math.floor(mins / 60);
  if (hours < 24) return countUnit(hours, 'common.hour', 'common.hours');
  const days = Math.floor(hours / 24);
  return countUnit(days, 'common.day', 'common.days');
}
function medName(med) { return localized(med.nameAr, med.nameEn) || '—'; }

/** يختار الاسم المناسب للغة الحالية مع الرجوع للغة الأخرى عند غيابه */
function localized(nameAr, nameEn, lang) {
  const l = lang || getLang();
  const primary = l === 'ar' ? nameAr : nameEn;
  const other = l === 'ar' ? nameEn : nameAr;
  return (primary && primary.trim()) || (other && other.trim()) || '';
}
function medDoseText(med) {
  const parts = [];
  if (med.dose) parts.push(`${med.dose} ${t('meds.unit')}`);
  if (med.form) parts.push(t('meds.forms.' + med.form) === 'meds.forms.' + med.form ? med.form : t('meds.forms.' + med.form));
  return parts.join(' · ');
}

/* ================= التنبيهات داخل التطبيق ================= */
let toastTimer = null;
function toast(msg) {
  const wrap = $('#toast-wrap');
  wrap.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  wrap.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2400);
}

/* ================= النوافذ المنبثقة ================= */
const modal = () => $('#modal');

function openModal({ title, body, footer, onMount }) {
  const dlg = modal();
  dlg.innerHTML = `
    <form method="dialog" id="modal-form">
      <div class="modal-head">
        <h3>${title}</h3>
        <button type="button" class="x-btn" data-act="close-modal" aria-label="${esc(t('common.close'))}">✕</button>
      </div>
      <div class="modal-body">${body}</div>
      <div class="modal-foot">${footer || ''}</div>
    </form>`;
  dlg.showModal();
  if (onMount) onMount(dlg);
  return dlg;
}
function closeModal() { const dlg = modal(); if (dlg.open) dlg.close(); }

function confirmDialog(title, message, okLabel) {
  return new Promise((resolve) => {
    const dlg = openModal({
      title,
      body: `<p style="font-size:.92rem;line-height:1.6">${esc(message)}</p>`,
      footer: `<button type="button" class="btn ghost" data-act="confirm-no">${esc(t('common.cancel'))}</button>
               <button type="button" class="btn danger" data-act="confirm-yes">${esc(okLabel || t('common.yes'))}</button>`
    });
    dlg.addEventListener('click', function handler(e) {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'confirm-yes') { dlg.removeEventListener('click', handler); closeModal(); resolve(true); }
      if (act.dataset.act === 'confirm-no') { dlg.removeEventListener('click', handler); closeModal(); resolve(false); }
    });
  });
}

/* ================= الرسوم البيانية ================= */
function ringSVG(pct, opts) {
  const o = Object.assign({ size: 84, stroke: 9, variant: 'hero' }, opts || {});
  const r = (o.size - o.stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct || 0));
  const off = c * (1 - p / 100);
  const track = o.variant === 'hero' ? 'rgba(255,255,255,.25)' : 'color-mix(in srgb, var(--muted) 14%, transparent)';
  const bar = o.variant === 'hero' ? '#fff' : 'var(--brand)';
  return `<div class="ring" style="width:${o.size}px;height:${o.size}px">
    <svg width="${o.size}" height="${o.size}" viewBox="0 0 ${o.size} ${o.size}">
      <circle cx="${o.size / 2}" cy="${o.size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${o.stroke}"/>
      <circle class="ring-bar" cx="${o.size / 2}" cy="${o.size / 2}" r="${r}" fill="none" stroke="${bar}"
              stroke-width="${o.stroke}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/>
    </svg>
    <div class="ring-label">${p}%${o.label ? `<small>${esc(o.label)}</small>` : ''}</div>
  </div>`;
}

/* ================= المظهر (الثيم) ================= */
function applyTheme() {
  const theme = S.getState().settings.theme || 'auto';
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

/* ================= حجم الخط ================= */
const FONT_SCALES = { small: 1, medium: 1.08, large: 1.2 };
function applyFontSize() {
  const k = S.getState().settings.fontSize || 'medium';
  document.documentElement.style.setProperty('--fs', String(FONT_SCALES[k] || FONT_SCALES.medium));
}

/* ================= النغمة والاهتزاز ================= */
const TONE_LABELS = {
  none: 'toneNone', beep: 'toneBeep', bell: 'toneBell', chime: 'toneChime',
  marimba: 'toneMarimba', digital: 'toneDigital', urgent: 'toneUrgent',
  soft: 'toneSoft', custom: 'toneCustom', system: 'toneSystem'
};
const VIB_LABELS = {
  none: 'vibNone', light: 'vibLight', medium: 'vibMedium',
  double: 'vibDouble', heartbeat: 'vibHeartbeat', strong: 'vibStrong'
};
function toneLabel(name) { return t('sound.' + (TONE_LABELS[name] || 'toneNone')); }
function vibLabel(name) { return t('sound.' + (VIB_LABELS[name] || 'vibNone')); }

/** تشغيل النغمة المختارة + الاهتزاز */
let phoneToneTimer = null;
function playPhoneTone() {
  const DS = NATIVE.DS();
  const s = S.getState().settings;
  if (!DS) return;
  DS.playRingtone({ uri: s.sysToneUri || '' }).catch(() => {});
  clearTimeout(phoneToneTimer);
  phoneToneTimer = setTimeout(() => { DS.stopRingtone().catch(() => {}); }, 4000);
}

function alertSound() {
  const s = S.getState().settings;
  if (!s.sound) return;
  if (NATIVE.isNative && NATIVE.DS()) {
    playPhoneTone();
    const patN = (s.vibPattern && s.vibPattern.length) ? s.vibPattern : (SOUND.VIB_PATTERNS[s.vibration] || []);
    SOUND.vibrate(patN);
    return;
  }
  SOUND.playTone(s.tone || 'chime', s.volume == null ? 0.8 : s.volume, s.customTone || '');
  const pat = (s.vibPattern && s.vibPattern.length) ? s.vibPattern
    : (SOUND.VIB_PATTERNS[s.vibration] || []);
  SOUND.vibrate(pat);
}

/** نغمة تجريبية من الإعدادات */
function previewTone(name) {
  const s = S.getState().settings;
  if (NATIVE.isNative && NATIVE.DS()) {
    playPhoneTone();
    return;
  }
  const key = name === 'custom' ? 'custom' : name;
  const ok = SOUND.playTone(key, s.volume == null ? 0.8 : s.volume, s.customTone || '');
  if (ok) SOUND.vibrate((SOUND.VIB_PATTERNS[s.vibration] || []).slice());
  else toast(t('sound.soundOn'));
}

/** نافذة خطوات اختيار نغمة الهاتف */
function showPhoneSteps() {
  const steps = SOUND.phoneSoundSteps(getLang());
  const body = `
    <p class="muted small" style="margin-bottom:12px">${esc(t('sound.phoneToneHint'))}</p>
    <ol style="padding-inline-start:20px;margin:0;display:flex;flex-direction:column;gap:9px;font-size:.88rem;line-height:1.6">
      ${steps.map((x) => `<li>${esc(x)}</li>`).join('')}
    </ol>`;
  const footer = `<button type="button" class="btn ghost" data-act="close-modal">${esc(t('common.close'))}</button>
    <button type="button" class="btn" data-act="copy-steps">${esc(t('sound.phoneStepsCopy'))}</button>
    <button type="button" class="btn primary" data-act="open-notif-settings">${esc(t('sound.phoneStepsOpen'))}</button>`;
  openModal({ title: t('sound.phoneStepsTitle'), body, footer });
}

/* ================= شاشات التطبيق ================= */
let currentScreen = 'today';

function viewToday() {
  const state = S.getState();
  const today = S.todayISO();
  const stats = S.dayStats(today);
  const doses = S.expectedDoses(today);
  const st = S.streakInfo();
  const hour = new Date().getHours();
  const greet = hour < 12 ? t('today.greeting') + ' ☀️' : hour < 18 ? t('today.greeting') + ' 🌤️' : t('today.greeting') + ' 🌙';
  const name = state.settings.patientName ? esc(state.settings.patientName) + ' — ' : '';

  const apptsToday = state.appointments
    .filter((a) => a.date === today && a.status === 'planned')
    .sort((a, b) => a.time.localeCompare(b.time));
  const nextAppt = S.upcomingAppts()[0];
  const nextDose = findNextDose();

  let html = '';

  html += `<section class="card hero">
    <div class="hero-text">
      <h2>${name}${esc(greet)}</h2>
      <p>${doses.length ? esc(t('today.dosesTaken', { n: stats.taken, m: stats.expected })) : esc(t('today.noDoses'))}</p>
      <div class="hero-badges">
        ${st.streak > 0 ? `<span class="hero-badge">🔥 ${st.streak} ${esc(t('today.streak'))}</span>` : ''}
        ${nextDose ? `<span class="hero-badge">⏰ ${esc(nextDose.medName)} — ${esc(fmtTime(nextDose.time))}</span>` : ''}
        ${nextAppt ? `<span class="hero-badge">📅 ${esc(relCountdown(S.apptDateTime(nextAppt).getTime()))}</span>` : ''}
      </div>
    </div>
    ${ringSVG(stats.pct || 0)}
  </section>`;

  S.lowStockMeds().forEach((m) => {
    const out = Number(m.stock) <= 0;
    html += `<div class="banner" style="display:flex;gap:8px;align-items:center;justify-content:space-between;background:var(--warn-soft);border:1.5px solid var(--warn)">
      <span>⚠️ ${esc(out ? t('stock.outBanner', { name: medName(m) }) : t('stock.lowBanner', { name: medName(m), n: fmtNum(m.stock), d: S.stockDaysLeft(m) }))}</span>
      <button type="button" class="btn sm primary" data-act="refill-med" data-id="${m.id}">＋ ${esc(t('stock.refillBtn'))}</button>
    </div>`;
  });

  if (!doses.length) {
    html += `<section class="card empty">
      <div class="ico">💊</div>
      <h3>${esc(t('today.noDoses'))}</h3>
      <p>${esc(t('today.noDosesHint'))}</p>
      <button class="btn primary" data-act="add-med">${esc(t('today.addMed'))}</button>
    </section>`;
  } else {
    html += `<div class="section-head">
      <h2>${esc(t('today.upcoming'))}</h2>
      <span class="count">${esc(t('today.dosesTaken', { n: stats.taken, m: stats.expected }))}</span>
    </div>`;
    html += '<div class="dose-list">';
    doses.forEach((d) => {
      const st2 = S.doseStatus(today, d.medId, d.time);
      const statusChip = {
        taken: `<span class="chip ok">✓ ${esc(t('today.taken'))}</span>`,
        skipped: `<span class="chip muted">— ${esc(t('today.skipped'))}</span>`,
        missed: `<span class="chip danger">✕ ${esc(t('today.missed'))}</span>`,
        pending: `<span class="chip info">◷ ${esc(t('today.pending'))}</span>`
      }[st2];
      const actions = st2 === 'taken'
        ? `<button class="btn sm soft" data-act="undo-dose" data-med="${d.medId}" data-time="${d.time}">${esc(t('today.actionUndo'))}</button>`
        : `<button class="btn sm primary" data-act="take-dose" data-med="${d.medId}" data-time="${d.time}">${esc(t('today.actionTake'))}</button>
           <button class="btn sm ghost" data-act="skip-dose" data-med="${d.medId}" data-time="${d.time}">${esc(t('today.actionSkip'))}</button>`;
      html += `<div class="dose ${st2 === 'taken' ? 'done' : st2 === 'missed' ? 'missed' : ''}">
        <div class="dose-time">${esc(fmtTime(d.time))}<small>${statusChip}</small></div>
        <div class="dose-info">
          <div class="dose-name"><span class="dot" style="background:${esc(d.med.color)}"></span>${esc(medName(d.med))}</div>
          <div class="dose-meta">${esc(medDoseText(d.med)) || esc(t('meds.daily'))}</div>
        </div>
        <div class="dose-actions">${actions}</div>
      </div>`;
    });
    html += '</div>';

    if (stats.expected > 0 && stats.taken === stats.expected) {
      html += `<div class="banner">🎉 <span>${esc(t('today.allDone'))}</span></div>`;
    }
  }

  html += `<div class="section-head"><h2>${esc(t('today.apptsToday'))}</h2></div>`;
  if (!apptsToday.length) {
    html += `<section class="card flat"><p class="muted small">${esc(t('today.noApptsToday'))} ${esc(t('today.noApptsHint'))}</p></section>`;
  } else {
    apptsToday.forEach((a) => { html += apptCard(a, true); });
  }

  html += `<button class="btn block soft" data-act="add-appt">＋ ${esc(t('appts.add'))}</button>`;
  return html;
}

function findNextDose() {
  const today = S.todayISO();
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const date = S.addDaysISO(today, i);
    const doses = S.expectedDoses(date);
    for (const d of doses) {
      const [h, m] = d.time.split(':').map(Number);
      const ts = new Date(S.fromISO(date).getFullYear(), S.fromISO(date).getMonth(), S.fromISO(date).getDate(), h, m).getTime();
      if (ts > now.getTime()) {
        if (S.getLog(date, d.medId, d.time)) continue;
        return { medId: d.medId, medName: medName(d.med), time: d.time, date, ts };
      }
    }
  }
  return null;
}

function fmtNum(n) { return String(Math.round(Number(n) * 100) / 100); }

function stockLine(med) {
  if (med.stock == null) return '';
  const days = S.stockDaysLeft(med);
  const limit = Number(S.getState().settings.stockAlertDays) || 3;
  const cls = Number(med.stock) <= 0 ? 'empty' : (days <= limit ? 'low' : '');
  const icon = cls ? '⚠️' : '📦';
  return `<div class="stock-line ${cls}">${icon} ${esc(t('stock.left'))}: ${esc(fmtNum(med.stock))} ${esc(t('stock.pillsShort'))} · ${esc(t('stock.lasts'))} ~${days} ${esc(t('stock.daysShort'))}</div>`;
}

function medCard(med) {
  const st = S.streakInfo();
  const chips = (med.times || []).map((tm) => `<span class="time-pill">${esc(fmtTime(tm))}</span>`).join('');
  const active = !med.paused;
  return `<article class="med-card" data-med-card="${med.id}">
    <div class="med-color" style="background:${esc(med.color)}"></div>
    <div class="med-body">
      <div class="med-title">${esc(medName(med))}
        ${active ? `<span class="chip ok">${esc(t('meds.active'))}</span>` : `<span class="chip muted">${esc(t('meds.paused'))}</span>`}
      </div>
      <div class="med-sub">${esc(medDoseText(med)) || '—'}</div>
      ${stockLine(med)}
      <div class="med-times">${chips || `<span class="chip muted">${esc(t('meds.noTimes'))}</span>`}</div>
      ${med.notes ? `<div class="med-notes">⚠️ ${esc(med.notes)}</div>` : ''}
      <div class="med-actions">
        <button class="btn sm" data-act="edit-med" data-id="${med.id}">${esc(t('common.edit'))}</button>
        ${med.stock != null ? `<button class="btn sm soft" data-act="refill-med" data-id="${med.id}">＋ ${esc(t('stock.refillBtn'))}</button>` : ''}
        <button class="btn sm ghost" data-act="toggle-med" data-id="${med.id}">${esc(active ? t('meds.pause') : t('meds.resume'))}</button>
        <button class="btn sm danger" data-act="delete-med" data-id="${med.id}">${esc(t('common.delete'))}</button>
      </div>
    </div>
  </article>`;
}

function viewMeds() {
  const state = S.getState();
  if (!state.meds.length) {
    return `<section class="card empty">
      <div class="ico">💊</div>
      <h3>${esc(t('meds.empty'))}</h3>
      <p>${esc(t('meds.emptyHint'))}</p>
      <button class="btn primary" data-act="add-med">${esc(t('meds.add'))}</button>
    </section>`;
  }
  let html = `<button class="btn primary block" data-act="add-med">＋ ${esc(t('meds.add'))}</button>`;
  html += '<div style="display:flex;flex-direction:column;gap:10px">';
  state.meds.forEach((m) => { html += medCard(m); });
  html += '</div>';
  return html;
}

function apptCard(a, todayStyle) {
  const d = S.apptDateTime(a);
  const past = d.getTime() < Date.now();
  const title = localized(a.titleAr, a.titleEn) || '—';
  const where = [a.clinic, a.doctor].filter(Boolean).join(' · ');
  const countdown = past ? '' : relCountdown(d.getTime());
  const statusChip = a.status === 'done' ? `<span class="chip ok">✓ ${esc(t('appts.done'))}</span>`
    : a.status === 'missed' ? `<span class="chip danger">✕ ${esc(t('appts.markMissed'))}</span>`
      : past ? `<span class="chip muted">${esc(t('appts.past'))}</span>` : '';
  return `<article class="appt ${past ? 'past' : ''}">
    <div class="appt-date">
      <div class="d">${S.fromISO(a.date).getDate()}</div>
      <div class="m">${esc(fmtMonthShort(a.date))}</div>
    </div>
    <div class="appt-body">
      <div class="appt-title">${esc(title)} ${statusChip}</div>
      <div class="appt-meta">${esc(fmtTime(a.time))} ${where ? ' · ' + esc(where) : ''}</div>
      ${countdown ? `<div class="appt-meta">⏳ ${esc(t('today.in'))} ${esc(countdown)}</div>` : ''}
      ${a.notes ? `<div class="appt-meta" style="margin-top:6px">📝 ${esc(a.notes)}</div>` : ''}
      <div class="appt-actions">
        ${a.status === 'planned' ? `
          <button class="btn sm primary" data-act="appt-done" data-id="${a.id}">${esc(t('appts.markDone'))}</button>
          <button class="btn sm" data-act="edit-appt" data-id="${a.id}">${esc(t('common.edit'))}</button>
          <button class="btn sm ghost" data-act="appt-missed" data-id="${a.id}">${esc(t('appts.markMissed'))}</button>
          <button class="btn sm danger" data-act="delete-appt" data-id="${a.id}">${esc(t('common.delete'))}</button>` : `
          <button class="btn sm" data-act="edit-appt" data-id="${a.id}">${esc(t('common.edit'))}</button>
          <button class="btn sm danger" data-act="delete-appt" data-id="${a.id}">${esc(t('common.delete'))}</button>`}
      </div>
    </div>
  </article>`;
}

function viewAppts() {
  const state = S.getState();
  const now = Date.now();
  const planned = state.appointments.filter((a) => a.status === 'planned');
  const upcoming = planned.filter((a) => S.apptDateTime(a).getTime() >= now - 3600000)
    .sort((a, b) => S.apptDateTime(a) - S.apptDateTime(b));
  const past = state.appointments.filter((a) => a.status !== 'planned' || S.apptDateTime(a).getTime() < now - 3600000)
    .sort((a, b) => S.apptDateTime(b) - S.apptDateTime(a));

  if (!state.appointments.length) {
    return `<section class="card empty">
      <div class="ico">📅</div>
      <h3>${esc(t('appts.empty'))}</h3>
      <p>${esc(t('appts.emptyHint'))}</p>
      <button class="btn primary" data-act="add-appt">${esc(t('appts.add'))}</button>
    </section>`;
  }

  let html = `<button class="btn primary block" data-act="add-appt">＋ ${esc(t('appts.add'))}</button>`;
  html += `<div class="section-head"><h2>${esc(t('appts.upcoming'))}</h2><span class="count">${upcoming.length}</span></div>`;
  if (!upcoming.length) html += `<section class="card flat"><p class="muted small">${esc(t('appts.empty'))}</p></section>`;
  else { html += '<div style="display:flex;flex-direction:column;gap:10px">'; upcoming.forEach((a) => { html += apptCard(a); }); html += '</div>'; }

  if (past.length) {
    html += `<div class="section-head"><h2>${esc(t('appts.past'))}</h2><span class="count">${past.length}</span></div>`;
    html += '<div style="display:flex;flex-direction:column;gap:10px">';
    past.slice(0, 20).forEach((a) => { html += apptCard(a); });
    html += '</div>';
  }
  return html;
}

function viewStats() {
  const state = S.getState();
  if (!state.meds.length) {
    return `<section class="card empty">
      <div class="ico">📊</div>
      <h3>${esc(t('stats.noData'))}</h3>
      <p>${esc(t('stats.noMeds'))}</p>
      <button class="btn primary" data-act="add-med">${esc(t('meds.add'))}</button>
    </section>`;
  }
  const today = S.todayISO();
  const r30 = S.rangeStats(S.addDaysISO(today, -29), today);
  const r7 = S.rangeStats(S.addDaysISO(today, -6), today);
  const st = S.streakInfo();
  const perMed = S.perMedStats(30);

  let html = '';

  html += `<section class="card">
    <div style="display:flex;align-items:center;gap:16px">
      ${ringSVG(r30.pct, { size: 96, stroke: 10, variant: 'card' })}
      <div style="flex:1;min-width:0">
        <h3 style="font-size:1rem">${esc(t('stats.overall30'))}</h3>
        <p class="muted small" style="margin-top:2px">${esc(t('today.dosesTaken', { n: r30.taken, m: r30.expected }))}</p>
        <div class="hero-badges" style="margin-top:9px">
          <span class="chip ok">🔥 ${st.streak} ${esc(t('stats.streak'))}</span>
        </div>
      </div>
    </div>
  </section>`;

  html += `<div class="stat-row">
    <div class="stat-box"><div class="v" style="color:var(--ok)">${r30.taken}</div><div class="l">${esc(t('stats.taken'))}</div></div>
    <div class="stat-box"><div class="v" style="color:var(--danger)">${r30.missed}</div><div class="l">${esc(t('stats.missed'))}</div></div>
    <div class="stat-box"><div class="v" style="color:var(--warn)">${r30.skipped}</div><div class="l">${esc(t('stats.skipped'))}</div></div>
    <div class="stat-box"><div class="v">${r30.expected}</div><div class="l">${esc(t('stats.expected'))}</div></div>
  </div>`;

  /* آخر 7 أيام */
  html += `<section class="card">
    <div class="section-head"><h2>${esc(t('stats.week'))}</h2><span class="count">${r7.pct}%</span></div>
    <div class="bars">`;
  for (let i = 6; i >= 0; i--) {
    const date = S.addDaysISO(today, -i);
    const s = S.dayStats(date);
    const pct = s.pct === null ? 0 : s.pct;
    const cls = s.pct === null ? 'zero' : pct < 50 ? 'low' : '';
    html += `<div class="bar-col">
      <div class="bar-track"><div class="bar-fill ${cls}" style="height:${Math.max(3, pct)}%"></div></div>
      <div class="bar-label">${esc(fmtDate(date, { weekday: 'narrow' }))}</div>
    </div>`;
  }
  html += `</div></section>`;

  /* حسب الدواء */
  html += `<section class="card">
    <div class="section-head"><h2>${esc(t('stats.byMed'))}</h2><span class="count">${esc(t('stats.last30'))}</span></div>`;
  perMed.forEach((m) => {
    const pct = m.pct === null ? 0 : m.pct;
    const color = pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--danger)';
    html += `<div class="med-stat">
      <span class="name" title="${esc(medName(m.med))}">${esc(medName(m.med))}</span>
      <span class="progress-line"><i style="width:${pct}%;background:${color}"></i></span>
      <span class="pct">${pct}%</span>
    </div>`;
  });
  html += '</section>';

  /* خريطة الالتزام */
  const hm = S.heatmapData(12);
  html += `<section class="card">
    <div class="section-head"><h2>${esc(t('stats.heatmap'))}</h2></div>
    <div class="heatmap">`;
  hm.cols.forEach((col) => {
    html += '<div class="hm-col">';
    col.forEach((cell) => {
      if (!cell) { html += '<div class="hm-cell"></div>'; return; }
      const lvl = cell.expected === 0 ? '' : cell.pct >= 100 ? 'l5' : cell.pct >= 75 ? 'l4' : cell.pct >= 50 ? 'l3' : cell.pct > 0 ? 'l2' : 'l1';
      html += `<div class="hm-cell ${lvl}" title="${esc(fmtDate(cell.date))} · ${cell.pct === null ? '—' : cell.pct + '%'}"></div>`;
    });
    html += '</div>';
  });
  html += `</div>
    <div class="hm-legend">
      <span>${esc(t('stats.taken'))} ↑</span>
      <span class="hm-cell l1"></span><span class="hm-cell l2"></span><span class="hm-cell l3"></span>
      <span class="hm-cell l4"></span><span class="hm-cell l5"></span>
    </div>
  </section>`;

  return html;
}

function viewSettings() {
  const state = S.getState();
  const s = state.settings;
  const perm = NATIVE.isNative ? nativePerm : (('Notification' in window) ? Notification.permission : 'unsupported');
  const installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  let html = '';

  html += `<section class="card">
    <div class="setting">
      <div class="txt"><b>${esc(t('settings.theme'))}</b><span>${esc(t('settings.themeHint'))}</span></div>
      <div class="ctl seg" id="theme-seg">
        <button data-act="set-theme" data-theme="auto" class="${s.theme === 'auto' ? 'active' : ''}">${esc(t('settings.themeAuto'))}</button>
        <button data-act="set-theme" data-theme="light" class="${s.theme === 'light' ? 'active' : ''}">${esc(t('settings.themeLight'))}</button>
        <button data-act="set-theme" data-theme="dark" class="${s.theme === 'dark' ? 'active' : ''}">${esc(t('settings.themeDark'))}</button>
      </div>
    </div>
    <div class="setting">
      <div class="txt"><b>${esc(t('ui.fontSize'))}</b><span>${esc(t('ui.fontHint'))}</span></div>
      <div class="ctl seg" id="font-seg">
        ${['small', 'medium', 'large'].map((k) => `<button data-act="set-font" data-size="${k}" class="${(s.fontSize || 'medium') === k ? 'active' : ''}">${esc(t('ui.font_' + k))}</button>`).join('')}
      </div>
    </div>
    <div class="setting">
      <div class="txt"><b>${esc(t('settings.language'))}</b></div>
      <div class="ctl seg" id="lang-seg">
        <button data-act="set-lang" data-lang="ar" class="${getLang() === 'ar' ? 'active' : ''}">${esc(t('settings.arabic'))}</button>
        <button data-act="set-lang" data-lang="en" class="${getLang() === 'en' ? 'active' : ''}">${esc(t('settings.english'))}</button>
      </div>
    </div>
    <div class="setting">
      <div class="txt"><b>${esc(t('settings.patientName'))}</b></div>
      <div class="ctl" style="width:55%">
        <input type="text" id="patient-name" value="${esc(s.patientName || '')}" placeholder="${esc(t('settings.patientNamePh'))}">
      </div>
    </div>
  </section>`;

  html += `<section class="card">
    <div class="section-head"><h2>${esc(t('settings.notifications'))}</h2></div>
    <div class="setting">
      <div class="txt"><b>${esc(t('settings.enableNotif'))}</b>
        ${perm === 'denied' ? `<span style="color:var(--danger)">${esc(t('settings.notifBlocked'))}</span>` : ''}
        ${perm === 'unsupported' ? `<span style="color:var(--danger)">${esc(t('settings.notifUnsupported'))}</span>` : ''}
      </div>
      <label class="ctl switch" aria-label="${esc(t('settings.enableNotif'))}">
        <input type="checkbox" id="opt-notify" ${s.notify ? 'checked' : ''} ${perm === 'unsupported' ? 'disabled' : ''}>
        <span class="track"></span>
      </label>
    </div>
    ${NATIVE.isNative && perm === 'granted' && nativeExact !== 'granted' ? `<div class="banner" style="margin:6px 0;display:flex;gap:8px;align-items:center;justify-content:space-between"><span class="small">${esc(t('native.exactWarn'))}</span><button type="button" class="btn sm primary" data-act="native-exact">${esc(t('native.exactBtn'))}</button></div>` : ''}
    <div class="btn-row grow" style="margin-top:4px">
      <button type="button" class="btn soft" data-act="test-notification">🔔 ${esc(t('settings.testNotification'))}</button>
      <button type="button" class="btn soft" data-act="test-alert">🔊 ${esc(t('settings.testSound'))}</button>
    </div>
    <div class="setting">
      <div class="txt"><b>${esc(t('settings.sound'))}</b></div>
      <label class="ctl switch" aria-label="${esc(t('settings.sound'))}">
        <input type="checkbox" id="opt-sound" ${s.sound ? 'checked' : ''}>
        <span class="track"></span>
      </label>
    </div>
    <div class="setting">
      <div class="txt"><b>${esc(t('settings.dailySummary'))}</b><span>${esc(t('settings.dailySummaryHint'))}</span></div>
      <div class="ctl"><input type="time" id="opt-summary" value="${esc(s.dailySummary || '20:00')}" style="width:120px"></div>
    </div>
    <div class="setting">
      <div class="txt"><b>${esc(t('settings.snooze'))}</b><span>${esc(t('settings.snoozeHint'))}</span></div>
      <div class="ctl"><input type="number" id="opt-snooze" min="1" max="120" value="${s.snoozeMin}" style="width:90px"></div>
    </div>
    <div class="setting">
      <div class="txt"><b>${esc(t('settings.grace'))}</b><span>${esc(t('settings.graceHint'))}</span></div>
      <div class="ctl"><input type="number" id="opt-grace" min="0" max="240" value="${s.graceMin}" style="width:90px"></div>
    </div>
  </section>`;

  /* ---------- النغمة والاهتزاز ---------- */
  const curTone = s.tone || 'chime';
  const toneRows = (NATIVE.isNative ? ['system'] : []).concat(SOUND.TONE_ORDER, curTone === 'custom' && !NATIVE.isNative ? ['custom'] : [])
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .map((name) => `
      <div class="tone-row ${curTone === name ? 'active' : ''}">
        <button type="button" class="tone-pick" data-act="set-tone" data-tone="${name}">
          <span class="radio-dot"></span>
          <span class="tone-name">${esc(toneLabel(name))}${name === 'system' && s.sysToneName ? ` <small class="muted">(${esc(s.sysToneName)})</small>` : ''}</span>
          ${curTone === name ? `<span class="chip ok">${esc(t('sound.selected'))}</span>` : ''}
        </button>
        <button type="button" class="btn sm ghost" data-act="preview-tone" data-tone="${name}">▶ ${esc(t('sound.preview'))}</button>
      </div>`).join('');

  html += `<section class="card">
    <div class="section-head"><h2>${esc(t('sound.title'))}</h2></div>
    ${NATIVE.isNative ? '' : `
    <div class="setting" style="border-bottom:none;padding-bottom:2px">
      <div class="txt"><b>${esc(t('sound.appTone'))}</b><span>${esc(t('sound.appToneHint'))}</span></div>
    </div>
    <div class="tone-list">${toneRows}</div>
    <div class="setting">
      <div class="txt"><b>${esc(t('sound.volume'))}</b><span id="vol-val">${Math.round((s.volume == null ? 0.8 : s.volume) * 100)}%</span></div>
      <div class="ctl" style="width:46%">
        <input type="range" id="opt-volume" min="0" max="100" step="5" value="${Math.round((s.volume == null ? 0.8 : s.volume) * 100)}">
      </div>
    </div>
`}
    <div class="setting">
      <div class="txt"><b>${esc(t('sound.vibration'))}</b></div>
      <div class="ctl">
        <select id="opt-vibration" style="width:auto;min-width:120px">
          ${SOUND.VIB_ORDER.map((v) => `<option value="${v}" ${s.vibration === v ? 'selected' : ''}>${esc(vibLabel(v))}</option>`).join('')}
        </select>
      </div>
    </div>
    ${NATIVE.isNative ? `<div class="setting">
      <div class="txt"><b>${esc(t('sound.systemPick'))}</b><span>${esc(s.sysToneName || t('sound.systemDefault'))}</span></div>
      <div class="ctl" style="display:flex;gap:6px"><button type="button" class="btn sm ghost" data-act="preview-tone" data-tone="system">▶</button><button type="button" class="btn sm primary" data-act="pick-system-tone">${esc(t('sound.systemBtn'))}</button></div>
    </div>
    <p class="tiny muted" style="margin:4px 0 0">${esc(t('sound.systemHint'))}</p>` : ''}
    ${NATIVE.isNative ? '' : `
    <div class="setting">
      <div class="txt"><b>${esc(t('sound.custom'))}</b><span id="custom-name">${esc(s.customToneName || t('sound.customNone'))}</span></div>
      <div class="ctl"><button type="button" class="btn sm" data-act="pick-custom-tone">${esc(t('sound.customPick'))}</button></div>
    </div>
    <div class="banner" style="margin-top:10px;display:block">
      <b>🔔 ${esc(t('sound.phoneTone'))}</b>
      <p class="tiny" style="margin:4px 0 8px;opacity:.9">${esc(t('sound.phoneToneHint'))}</p>
      <button type="button" class="btn sm soft" data-act="phone-steps">${esc(t('sound.phoneSteps'))}</button>
    </div>
`}
  </section>`;

  if (NATIVE.isNative) html += nativeReliabilityCard();

  html += `<section class="card">
    <div class="section-head"><h2>${esc(t('settings.data'))}</h2></div>
    <div class="btn-row grow" style="margin-bottom:10px">
      <button class="btn soft" data-act="export-json">${esc(t('settings.exportJson'))}</button>
      <button class="btn" data-act="import-json">${esc(t('settings.importJson'))}</button>
    </div>
    <div class="btn-row grow" style="margin-bottom:10px">
      <button class="btn soft" data-act="export-ics">${esc(t('settings.exportIcs'))}</button>
    </div>
    <p class="muted tiny" style="margin-bottom:12px">${esc(t('settings.exportHint'))}</p>
    <button class="btn danger block" data-act="reset-all">${esc(t('settings.reset'))}</button>
  </section>`;

  html += `<section class="card">
    <div class="section-head"><h2>${esc(t('settings.about'))}</h2><span class="count">${esc(t('settings.version'))} 1.6.0</span></div>
    <p class="muted small">${esc(t('settings.privacy'))}</p>
  </section>`;

  if (!NATIVE.isNative) html += `<button class="btn ${installed ? 'ghost' : 'primary'} block" data-act="install" ${installed ? 'disabled' : ''}>
    ${installed ? '✓ ' + esc(t('settings.installed')) : '⤓ ' + esc(t('settings.install'))}
  </button>`;

  return html;
}

/* ================= التنقل ================= */
const NAV_ICONS = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 9-9a4.95 4.95 0 1 0-7-7l-9 9a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>',
  meds: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>',
  appts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/></svg>',
  stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7.5 15v3M12 9v9M16.5 5v13"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.46V21a2 2 0 1 1-4 0v-.08a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.46-.97H3a2 2 0 1 1 0-4h.08a1.6 1.6 0 0 0 1.46-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9 4.6a1.6 1.6 0 0 0 .97-1.46V3a2 2 0 1 1 4 0v.08a1.6 1.6 0 0 0 .97 1.46 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 19.4 9v.03a1.6 1.6 0 0 0 1.46.97H21a2 2 0 1 1 0 4h-.08a1.6 1.6 0 0 0-1.46.97Z"/></svg>'
};

function renderNav() {
  const bar = $('#tabbar');
  const items = ['today', 'meds', 'appts', 'stats', 'settings'];
  bar.innerHTML = items.map((key) => `
    <button data-nav="${key}" class="${currentScreen === key ? 'active' : ''}" aria-label="${esc(t('nav.' + key))}">
      ${NAV_ICONS[key]}
      <span class="lbl">${esc(t('nav.' + key))}</span>
    </button>`).join('');
}

function render() {
  const view = $('#view');
  const screens = { today: viewToday, meds: viewMeds, appts: viewAppts, stats: viewStats, settings: viewSettings };
  view.innerHTML = (screens[currentScreen] || viewToday)();
  $('#app-title').textContent = t('app.name');
  $('#app-tagline').textContent = t('app.tagline');
  $('#lang-label').textContent = getLang() === 'ar' ? 'EN' : 'ع';
  renderNav();
}

/* ================= نماذج الإدخال ================= */
let formState = null;

function medForm(med) {
  const isEdit = !!med;
  const m = med || {
    nameAr: '', nameEn: '', dose: '', form: '', notes: '',
    times: ['08:00'], startDate: S.todayISO(), endDate: '',
    color: S.PALETTE[S.getState().meds.length % S.PALETTE.length]
  };
  formState = { type: 'med', id: med ? med.id : null, times: (m.times || []).slice(), color: m.color };

  const body = `
    <label class="fld"><span>${esc(t('meds.nameAr'))}</span>
      <input type="text" name="nameAr" value="${esc(m.nameAr)}" placeholder="${esc(t('meds.nameArPh'))}" required></label>
    <label class="fld"><span>${esc(t('meds.nameEn'))}</span>
      <input type="text" name="nameEn" value="${esc(m.nameEn)}" placeholder="${esc(t('meds.nameEnPh'))}"></label>
    <div class="grid-2">
      <label class="fld"><span>${esc(t('meds.dose'))} (${esc(t('meds.unit'))})</span>
        <input type="text" name="dose" value="${esc(m.dose)}" placeholder="${esc(t('meds.dosePh'))}"></label>
      <label class="fld"><span>${esc(t('meds.form'))}</span>
        <select name="form">
          ${['tablet', 'capsule', 'injection', 'syrup', 'drops', 'cream', 'inhaler', 'suppository', 'other'].map((key) => `
            <option value="${key}" ${(m.form === key || (!m.form && key === 'tablet')) ? 'selected' : ''}>${esc(t('meds.forms.' + key))}</option>`).join('')}
        </select></label>
    </div>
    <div class="grid-2">
      <label class="fld"><span>${esc(t('stock.have'))} (${esc(t('common.optional'))})</span>
        <input type="number" name="stock" min="0" step="1" inputmode="decimal" value="${m.stock == null ? '' : esc(m.stock)}"></label>
      <label class="fld"><span>${esc(t('stock.perDose'))}</span>
        <input type="number" name="perDose" min="0.25" step="0.25" inputmode="decimal" value="${esc(m.perDose || 1)}"></label>
    </div>
    <div class="fld"><span>${esc(t('meds.times'))}</span>
      <div id="times-editor" style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px"></div>
      <button type="button" class="btn sm soft" data-act="add-time">＋ ${esc(t('meds.addTime'))}</button>
      <span class="muted tiny" style="display:block;margin-top:6px">${esc(t('meds.timesHint'))}</span>
    </div>
    <div class="grid-2">
      <label class="fld"><span>${esc(t('meds.startDate'))}</span>
        <input type="date" name="startDate" value="${esc(m.startDate)}"></label>
      <label class="fld"><span>${esc(t('meds.endDate'))} (${esc(t('common.optional'))})</span>
        <input type="date" name="endDate" value="${esc(m.endDate || '')}"></label>
    </div>
    <label class="fld"><span>${esc(t('meds.notes'))}</span>
      <textarea name="notes" placeholder="${esc(t('meds.notesPh'))}">${esc(m.notes)}</textarea></label>
    <div class="fld"><span>${esc(t('meds.color'))}</span>
      <div class="btn-row" id="color-picker">${S.PALETTE.map((c) => `
        <button type="button" data-act="pick-color" data-color="${c}"
          style="width:34px;height:34px;border-radius:11px;background:${c};border:3px solid ${c === formState.color ? 'var(--text)' : 'transparent'};cursor:pointer"></button>`).join('')}
      </div>
    </div>`;

  const dlg = openModal({
    title: isEdit ? t('common.edit') : t('meds.add'),
    body,
    footer: `<button type="button" class="btn ghost" data-act="close-modal">${esc(t('common.cancel'))}</button>
             <button type="button" class="btn primary" data-act="save-med">${esc(t('common.save'))}</button>`,
    onMount: () => renderTimesEditor()
  });
  return dlg;
}

function renderTimesEditor() {
  const box = $('#times-editor');
  if (!box || !formState) return;
  box.innerHTML = formState.times.map((tm, i) => `
    <div style="display:flex;gap:8px;align-items:center">
      <input type="time" value="${esc(tm)}" data-time-idx="${i}">
      <button type="button" class="btn sm danger" data-act="remove-time" data-idx="${i}">✕</button>
    </div>`).join('');
}

function apptForm(appt) {
  const isEdit = !!appt;
  const a = appt || {
    titleAr: '', titleEn: '', doctor: '', clinic: '', notes: '',
    date: S.todayISO(), time: '10:00', remindBeforeMin: 120
  };
  formState = { type: 'appt', id: appt ? appt.id : null };
  const body = `
    <label class="fld"><span>${esc(t('appts.titleAr'))}</span>
      <input type="text" name="titleAr" value="${esc(a.titleAr)}" placeholder="${esc(t('appts.titleArPh'))}" required></label>
    <label class="fld"><span>${esc(t('appts.titleEn'))}</span>
      <input type="text" name="titleEn" value="${esc(a.titleEn)}" placeholder="${esc(t('appts.titleEnPh'))}"></label>
    <div class="grid-2">
      <label class="fld"><span>${esc(t('appts.doctor'))}</span>
        <input type="text" name="doctor" value="${esc(a.doctor)}"></label>
      <label class="fld"><span>${esc(t('appts.clinic'))}</span>
        <input type="text" name="clinic" value="${esc(a.clinic)}"></label>
    </div>
    <div class="grid-2">
      <label class="fld"><span>${esc(t('appts.date'))}</span>
        <input type="date" name="date" value="${esc(a.date)}"></label>
      <label class="fld"><span>${esc(t('appts.time'))}</span>
        <input type="time" name="time" value="${esc(a.time)}"></label>
    </div>
    <label class="fld"><span>${esc(t('appts.remindBefore'))}</span>
      <select name="remindBeforeMin">
        ${[0, 15, 30, 60, 120, 180, 360, 1440].map((v) => `
          <option value="${v}" ${Number(a.remindBeforeMin) === v ? 'selected' : ''}>
            ${v === 0 ? t('common.none') : v === 1440 ? '1 ' + t('common.day') : v === 60 ? '1 ' + t('common.hour') : v === 120 ? '2 ' + t('common.hours') : v + ' ' + t('common.minutes')}
          </option>`).join('')}
      </select></label>
    <label class="fld"><span>${esc(t('appts.notes'))}</span>
      <textarea name="notes" placeholder="${esc(t('appts.notesPh'))}">${esc(a.notes)}</textarea></label>`;

  return openModal({
    title: isEdit ? t('common.edit') : t('appts.add'),
    body,
    footer: `<button type="button" class="btn ghost" data-act="close-modal">${esc(t('common.cancel'))}</button>
             <button type="button" class="btn primary" data-act="save-appt">${esc(t('common.save'))}</button>`
  });
}

/* ================= تصدير الملفات ================= */
function download(filename, content, mime) {
  if (NATIVE.isNative) { nativeShareFile(filename, content, mime); return; }
  const blob = new Blob([content], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ================= محرّك التذكيرات ================= */
const alarmTimers = new Map();
const snoozed = JSON.parse(localStorage.getItem('tr.snooze') || '{}');

function saveSnooze() { localStorage.setItem('tr.snooze', JSON.stringify(snoozed)); }

function doseTs(dateISO, time) {
  const d = S.fromISO(dateISO);
  const [h, m] = time.split(':').map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0).getTime();
}

/** كل الأحداث القادمة خلال 48 ساعة */
function upcomingEvents() {
  const events = [];
  const now = Date.now();
  const today = S.todayISO();
  for (let i = 0; i < 2; i++) {
    const date = S.addDaysISO(today, i);
    S.expectedDoses(date).forEach((d) => {
      const ts = doseTs(date, d.time);
      if (ts <= now) return;
      events.push({
        key: `dose:${date}:${d.medId}:${d.time}`,
        type: 'dose', ts, date, time: d.time, medId: d.medId, med: d.med
      });
    });
  }
  S.getState().appointments.forEach((a) => {
    if (a.status !== 'planned') return;
    const ts = S.apptNotifyTime(a).getTime();
    if (ts <= now) return;
    events.push({ key: `appt:${a.id}`, type: 'appt', ts, appt: a });
  });
  /* الملخص اليومي — الموعد التالي بعد الآن */
  const s = S.getState().settings;
  let summaryDate = today;
  let summaryTs = doseTs(today, s.dailySummary || '20:00');
  if (summaryTs <= now) {
    summaryDate = S.addDaysISO(today, 1);
    summaryTs = doseTs(summaryDate, s.dailySummary || '20:00');
  }
  events.push({ key: `summary:${summaryDate}`, type: 'summary', ts: summaryTs, date: summaryDate });
  return events.sort((a, b) => a.ts - b.ts);
}

function scheduleAll() {
  if (NATIVE.isNative) { nativeScheduleSoon(); return; }
  scheduleWebTimers();
}

function scheduleWebTimers() {
  alarmTimers.forEach((id) => clearTimeout(id));
  alarmTimers.clear();
  const now = Date.now();
  upcomingEvents().forEach((ev) => {
    if (ev.ts <= now) return;
    const delay = Math.min(ev.ts - now, 2147483000);
    const id = setTimeout(() => fireEvent(ev), delay);
    alarmTimers.set(ev.key, id);
  });
}

function eventFromDoseKey(key) {
  const parts = String(key || '').split(':');
  if (parts.length < 4 || parts[0] !== 'dose') return null;
  const [, date, medId, ...timeParts] = parts;
  const time = timeParts.join(':');
  const med = S.getState().meds.find((m) => m.id === medId);
  if (!med || !date || !S.isValidTime(time)) return null;
  return { key, type: 'dose', ts: doseTs(date, time), date, time, medId, med };
}

function scheduleSnoozedDose(key, timestamp) {
  if (NATIVE.isNative) { nativeScheduleSoon(); return; }
  const ev = eventFromDoseKey(key);
  if (!ev) return;
  const delay = Math.max(0, Math.min(timestamp - Date.now(), 2147483000));
  const old = alarmTimers.get(key);
  if (old) clearTimeout(old);
  alarmTimers.set(key, setTimeout(() => fireEvent(ev), delay));
}

function notify(title, body, opts) {
  if (NATIVE.isNative) return;
  const o = opts || {};
  if (!S.getState().settings.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  const options = {
    body: body || '',
    icon: './icons/icon-192.png',
    badge: './icons/favicon-64.png',
    tag: o.tag || 'tr',
    renotify: false,
    data: o.data || {},
    requireInteraction: false,
    /* نغمة التطبيق المختارة تُشغَّل داخل التطبيق؛ لذلك نُسكِت صوت النظام
       عندما يكون التطبيق ظاهرًا على الشاشة حتى لا يتكرر الصوت مرتين */
    silent: o.silent == null ? (!S.getState().settings.sound || document.visibilityState === 'visible') : !!o.silent,
    dir: getLang() === 'ar' ? 'rtl' : 'ltr',
    lang: getLang()
  };
  if (o.actions) options.actions = o.actions;
  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, options)).catch(() => {
      try { new Notification(title, options); } catch (e) { /* ignore */ }
    });
  } else {
    try { new Notification(title, options); } catch (e) { /* ignore */ }
  }
}

async function testNotification() {
  const permission = await requestNotifPermission();
  if (permission !== 'granted') {
    toast(t('settings.notifBlocked'));
    return;
  }
  S.updateSettings({ notify: true });
  if (NATIVE.isNative) {
    const msg = await nativeTestNotification();
    toast(msg || t('settings.testNotificationSent'));
    render();
    nativeEnsureExact().then(nativeEnsureBattery).then(nativeEnsureOverlay);
    return;
  }
  notify(t('notif.doseTitle'), t('settings.testNotificationBody'), {
    tag: 'treatment-reminder-test', silent: false, data: { screen: 'settings' }
  });
  toast(t('settings.testNotificationSent'));
  render();
}

function testAlert() {
  const s = S.getState().settings;
  const ok = SOUND.playTone(s.tone === 'none' ? 'urgent' : (s.tone || 'urgent'),
    Math.max(0.9, s.volume == null ? 0.9 : s.volume), s.customTone || '');
  SOUND.vibrate(SOUND.VIB_PATTERNS.strong);
  toast(ok ? t('settings.testSoundPlayed') : t('sound.soundOn'));
}

function fireEvent(ev) {
  if (ev.type === 'dose') {
    const med = S.getState().meds.find((m) => m.id === ev.medId);
    if (!med || med.paused) return;
    if (S.getLog(ev.date, ev.medId, ev.time)) return;
    const snoozeTs = snoozed[ev.key];
    if (snoozeTs && snoozeTs > Date.now()) {
      const id = setTimeout(() => fireEvent(ev), snoozeTs - Date.now());
      alarmTimers.set(ev.key, id);
      return;
    }
    const name = medName(med);
    notify(t('notif.doseTitle'), `${name}${med.dose ? ' — ' + med.dose + ' ' + t('meds.unit') : ''}`, {
      tag: ev.key,
      data: { date: ev.date, medId: ev.medId, time: ev.time, screen: 'today' },
      actions: [
        { action: 'taken', title: t('notif.takenAction') },
        { action: 'snooze', title: t('notif.snoozeAction') }
      ]
    });
    inAppReminder(ev, name);
    scheduleAll();
  } else if (ev.type === 'appt') {
    const a = ev.appt;
    const title = localized(a.titleAr, a.titleEn);
    notify(t('notif.apptTitle'), `${title} — ${fmtTime(a.time)}`, {
      tag: ev.key,
      data: { apptId: a.id, screen: 'appts' }
    });
    scheduleAll();
  } else if (ev.type === 'summary') {
    const date = ev.date;
    const doses = S.expectedDoses(date);
    const remaining = doses.filter((d) => S.doseStatus(date, d.medId, d.time) === 'pending');
    if (remaining.length) {
      notify(t('notif.summaryTitle'), `${remaining.length} ${t('notif.remaining')}`, { tag: ev.key });
    }
    scheduleAll();
  }
}

function inAppReminder(ev, name, silent) {
  const view = $('#view');
  if (!view || document.visibilityState !== 'visible') return;
  const box = document.createElement('div');
  box.className = 'banner';
  box.style.cssText = 'background:var(--brand-soft);color:var(--brand-dark);justify-content:space-between';
  box.innerHTML = `<span>💊 ${esc(name)} — ${esc(t('notif.doseTitle'))} ${esc(fmtTime(ev.time))}</span>
    <button class="btn sm primary" data-act="take-dose" data-med="${ev.medId}" data-time="${ev.time}">${esc(t('today.actionTake'))}</button>`;
  view.insertBefore(box, view.firstChild);
  if (!silent) alertSound();
  setTimeout(() => box.remove(), 30000);
}

function snoozeDose(key, minutes) {
  const timestamp = Date.now() + Math.max(1, Number(minutes) || 10) * 60000;
  snoozed[key] = timestamp;
  saveSnooze();
  scheduleSnoozedDose(key, timestamp);
}


/* ================= الوضع الأصلي (Capacitor / أندرويد) =================
   في التطبيق الأصلي لا نعتمد على مؤقّتات الصفحة. بدلًا من ذلك نجدول كل التنبيهات
   القادمة (14 يومًا) كتنبيهات محلية في نظام أندرويد نفسه (AlarmManager)،
   فتصل في وقتها حتى لو التطبيق مغلق أو الهاتف في وضع السكون، وتُستعاد بعد إعادة التشغيل. */
let nativePerm = 'prompt';
let nativeExact = 'granted';
let nativeBatteryOk = true;
let nativeMaker = '';
let nativeFullScreen = true;
let nativeOverlay = true;
let nativePollTimer = null;
const NATIVE_PKG = 'com.treatmentreminder.app';
let nativeTimer = null;
let nativeBusy = false;
let nativeDirty = false;
const NATIVE_HORIZON_DAYS = 14;
const NATIVE_MAX = 300;
const NATIVE_TEST_ID = 2147483000;

function nativeId(key, used) {
  let h = 7;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  let id = (Math.abs(h) % 2147000000) + 1;
  while (used.has(id)) id++;
  used.add(id);
  return id;
}

function nativeChannel(kind) {
  const s = S.getState().settings;
  const ar = getLang() === 'ar';
  if (kind !== 'dose') {
    return { id: 'general_v1', name: ar ? 'المواعيد والملخص' : 'Appointments & summary', importance: 4, vibration: true };
  }
  const vib = (s.vibration || 'medium') !== 'none';
  const tone = s.sound ? (s.tone || 'chime') : 'none';
  if (tone === 'none') {
    return { id: `dose_silent_${vib ? 'v' : 'n'}`, name: ar ? 'الجرعات — صامت' : 'Doses — silent', importance: 2, vibration: vib };
  }
  const builtIn = tone !== 'custom' && Object.prototype.hasOwnProperty.call(SOUND.TONES, tone);
  const ch = {
    id: `dose_${builtIn ? tone : 'system'}_${vib ? 'v' : 'n'}`,
    name: `${ar ? 'الجرعات' : 'Doses'} — ${builtIn ? toneLabel(tone) : (ar ? 'صوت النظام' : 'System sound')}`,
    importance: 4,
    vibration: vib
  };
  if (builtIn) ch.sound = `tone_${tone}.wav`;
  return ch;
}

async function nativeRefreshPerm() {
  const LN = NATIVE.LN();
  if (!LN) return;
  try { nativePerm = (await LN.checkPermissions()).display; } catch (e) { /* ignore */ }
  try { nativeExact = (await LN.checkExactNotificationSetting()).exact_alarm; } catch (e) { /* ignore */ }
  const DS = NATIVE.DS();
  if (DS) {
    try {
      const st = await DS.getStatus();
      nativeBatteryOk = !!st.ignoringBattery;
      nativeMaker = st.manufacturer || '';
      nativeFullScreen = st.fullScreen !== false;
      nativeOverlay = st.overlay !== false;
    } catch (e) { /* ignore */ }
  }
}

async function nativeRequestPermission() {
  const LN = NATIVE.LN();
  if (!LN) return 'unsupported';
  try {
    let r = await LN.checkPermissions();
    if (r.display !== 'granted') r = await LN.requestPermissions();
    nativePerm = r.display;
  } catch (e) { return 'denied'; }
  if (nativePerm === 'granted') nativeScheduleSoon();
  return nativePerm === 'granted' ? 'granted' : 'denied';
}

/** أندرويد 12+ يحتاج إذن «المنبّهات والتذكيرات» لتصل التنبيهات في الدقيقة المحددة */
async function nativeEnsureExact() {
  const LN = NATIVE.LN();
  if (!LN || nativePerm !== 'granted') return;
  try {
    nativeExact = (await LN.checkExactNotificationSetting()).exact_alarm;
    if (nativeExact === 'granted' || localStorage.getItem('tr.exactAsked')) return;
    localStorage.setItem('tr.exactAsked', '1');
    const ok = await confirmDialog(t('native.exactTitle'), t('native.exactBody'), t('native.exactOk'));
    if (ok) await LN.changeExactNotificationSetting();
  } catch (e) { /* ignore */ }
}

function nativeFmtTs(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

/** تقرير تشخيصي: يوضّح أين تتعطل التنبيهات (صلاحيات، جدولة، تشغيل الصوت، ظهور الشاشة) */
async function nativeBuildDiagnostics() {
  const DS = NATIVE.DS();
  if (!DS) return null;
  const ar = getLang() === 'ar';
  const d = await DS.getDiagnostics();
  const ok = (v) => (v ? '✅' : '❌');
  const rows = [
    [ar ? 'الهاتف' : 'Device', `${d.manufacturer} ${d.model} (Android API ${d.sdk})`],
    [ar ? 'إشعارات التطبيق مفعّلة' : 'Notifications enabled', ok(d.notificationsEnabled)],
    [ar ? 'المنبّهات الدقيقة' : 'Exact alarms', ok(d.canExact)],
    [ar ? 'استثناء البطارية' : 'Battery exemption', ok(d.ignoringBattery)],
    [ar ? 'العرض فوق التطبيقات' : 'Display over other apps', ok(d.overlay)],
    [ar ? 'الإشعار بملء الشاشة' : 'Full-screen notifications', ok(d.fullScreen)],
    [ar ? 'صوت المنبّه' : 'Alarm volume', `${d.alarmVolume}/${d.alarmVolumeMax}`],
    [ar ? 'منبّهات قادمة محفوظة' : 'Pending alarms', String(d.pending)],
    [ar ? 'أقرب منبّه (التطبيق)' : 'Next alarm (app)', nativeFmtTs(d.nextAt)],
    [ar ? 'أقرب منبّه (النظام)' : 'Next alarm (system)', nativeFmtTs(d.nextAlarmClock)]
  ];
  const log = (d.log || []).slice(-25);
  const text = rows.map((r) => `${r[0]}: ${r[1]}`).join('\n') + '\n\n' + (ar ? 'السجل' : 'Log') + ':\n' + log.join('\n');
  return { rows, log, text };
}

async function nativeShowDiagnostics() {
  let rep;
  try { rep = await nativeBuildDiagnostics(); } catch (e) { rep = null; }
  if (!rep) { toast(t('toast.error')); return; }
  const body = `<div style="font-size:.85rem;line-height:1.7">
    ${rep.rows.map((r) => `<div style="display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid var(--line, #e5e7eb);padding:3px 0"><span>${esc(r[0])}</span><b dir="ltr">${esc(r[1])}</b></div>`).join('')}
    <h3 style="margin:12px 0 4px;font-size:.9rem">${esc(t('native.diagLog'))}</h3>
    <pre dir="ltr" style="white-space:pre-wrap;font-size:.72rem;max-height:200px;overflow:auto;margin:0">${esc(rep.log.join('\n') || '—')}</pre>
  </div>`;
  const dlg = openModal({
    title: t('native.diagTitle'),
    body,
    footer: `<button type="button" class="btn ghost" data-act="close-modal">${esc(t('common.close'))}</button>
             <button type="button" class="btn primary" data-act="native-share-diag">${esc(t('native.diagShare'))}</button>`
  });
  dlg.addEventListener('click', async function h(e) {
    const a = e.target.closest('[data-act="native-share-diag"]');
    if (!a) return;
    const SH = NATIVE.SHARE();
    if (SH) { try { await SH.share({ title: 'diagnostics', text: rep.text }); } catch (er) { /* cancelled */ } }
  });
}

/** فتح منتقي نغمات الهاتف الأصلي وحفظ الاختيار */
async function pickSystemTone() {
  const DS = NATIVE.DS();
  if (!DS) return;
  const cur = S.getState().settings;
  try {
    const r = await DS.pickRingtone({ title: t('sound.systemPick'), current: cur.sysToneUri || '' });
    if (r && !r.cancelled) {
      S.updateSettings({ sysToneUri: r.uri || '', sysToneName: r.title || '', tone: 'system', sound: true });
      toast(t('toast.saved'));
      render();
      previewTone('system');
    }
  } catch (e) { toast(t('toast.error')); }
}

/** استثناء التطبيق من توفير البطارية: أهم شرط لوصول التنبيه والشاشة مقفلة */
async function nativeEnsureBattery() {
  const DS = NATIVE.DS();
  if (!DS || nativePerm !== 'granted') return;
  await nativeRefreshPerm();
  if (nativeBatteryOk || localStorage.getItem('tr.battAsked')) return;
  localStorage.setItem('tr.battAsked', '1');
  const ok = await confirmDialog(t('native.batteryTitle'), t('native.batteryBody'), t('native.batteryOk'));
  if (ok) await DS.requestIgnoreBatteryOptimizations();
}

/** العرض فوق التطبيقات: شرط ظهور شاشة المنبّه تلقائيًا فوق القفل (خصوصًا أوبو/شاومي) */
async function nativeEnsureOverlay() {
  const DS = NATIVE.DS();
  if (!DS || nativePerm !== 'granted') return;
  await nativeRefreshPerm();
  if (nativeOverlay || localStorage.getItem('tr.overlayAsked')) return;
  localStorage.setItem('tr.overlayAsked', '1');
  const ok = await confirmDialog(t('native.overlayTitle'), t('native.overlayBody'), t('native.batteryOk'));
  if (ok) await DS.openOverlaySettings();
}

function nativeOemHint() {
  const ar = getLang() === 'ar';
  const m = nativeMaker;
  if (/xiaomi|redmi|poco/.test(m)) return ar ? 'شاومي: فعّل «التشغيل التلقائي» (Autostart) ثم من الأمان ← البطارية اختر «بدون قيود».' : 'Xiaomi: enable Autostart, then set Battery saver to "No restrictions".';
  if (/oppo|realme|oneplus/.test(m)) return ar ? 'أوبو/ريلمي: (1) لا تسحب التطبيق من قائمة التطبيقات الأخيرة، فهذا يوقفه ويلغي المنبّهات؛ بدلًا من ذلك اقفله 🔒 من القائمة. (2) فعّل «التشغيل التلقائي» و«السماح بالنشاط في الخلفية». (3) فعّل «العرض فوق التطبيقات».' : 'Oppo/Realme: (1) never swipe the app away from Recents (it force-stops the app and cancels alarms); lock it with the 🔒 instead. (2) Enable Auto-launch and Background activity. (3) Enable Display over other apps.';
  if (/vivo|iqoo/.test(m)) return ar ? 'فيفو: فعّل «التشغيل التلقائي» و«استهلاك البطارية في الخلفية ← السماح».' : 'Vivo: enable Autostart and allow High background power consumption.';
  if (/huawei|honor/.test(m)) return ar ? 'هواوي/هونر: البطارية ← تشغيل التطبيقات ← تذكير العلاج ← «إدارة يدوية» وفعّل الثلاثة خيارات.' : 'Huawei/Honor: Battery > App launch > this app > Manage manually, enable all three.';
  if (/samsung/.test(m)) return ar ? 'سامسونج: البطارية ← حدود الاستخدام في الخلفية ← «التطبيقات التي لا تنام أبدًا» وأضف تذكير العلاج.' : 'Samsung: Battery > Background usage limits > Never sleeping apps, add this app.';
  return ar ? 'إن تأخر التنبيه، افتح إعدادات التطبيق ← البطارية واختر «بدون قيود».' : 'If alerts are late, open app settings > Battery and choose Unrestricted.';
}

function nativeReliabilityCard() {
  return `<section class="card">
    <div class="section-head"><h2>${esc(t('native.reliabilityTitle'))}</h2></div>
    <div class="setting">
      <div class="txt"><b>${esc(t('native.batteryRow'))}</b><span>${esc(nativeBatteryOk ? t('native.batteryGood') : t('native.batteryBad'))}</span></div>
      <div class="ctl"><button type="button" class="btn sm ${nativeBatteryOk ? 'ghost' : 'primary'}" data-act="native-battery">${esc(nativeBatteryOk ? t('native.recheck') : t('native.batteryFix'))}</button></div>
    </div>
    <div class="setting">
      <div class="txt"><b>${esc(t('native.fullScreenRow'))}</b><span>${esc(nativeFullScreen ? t('native.fullScreenGood') : t('native.fullScreenBad'))}</span></div>
      <div class="ctl">${nativeFullScreen ? '' : `<button type="button" class="btn sm primary" data-act="native-fullscreen">${esc(t('native.batteryFix'))}</button>`}</div>
    </div>
    <div class="setting">
      <div class="txt"><b>${esc(t('native.overlayRow'))}</b><span>${esc(nativeOverlay ? t('native.overlayGood') : t('native.overlayBad'))}</span></div>
      <div class="ctl">${nativeOverlay ? '' : `<button type="button" class="btn sm primary" data-act="native-overlay">${esc(t('native.batteryFix'))}</button>`}</div>
    </div>
    <div class="setting">
      <div class="txt"><b>${esc(t('native.alarmMode'))}</b><span>${esc(t('native.alarmModeHint'))}</span></div>
      <label class="ctl switch" aria-label="${esc(t('native.alarmMode'))}">
        <input type="checkbox" id="opt-alarm-mode" ${S.getState().settings.alarmMode !== false ? 'checked' : ''}>
        <span class="track"></span>
      </label>
    </div>
    <div class="setting">
      <div class="txt"><b>${esc(t('native.repeatEvery'))}</b></div>
      <div class="ctl"><select id="opt-repeat-min" style="width:auto;min-width:100px">
        ${[2, 3, 5, 10, 15].map((v) => `<option value="${v}" ${(S.getState().settings.repeatMin || 5) === v ? 'selected' : ''}>${v} ${esc(t('native.minShort'))}</option>`).join('')}
      </select></div>
    </div>
    <div class="setting">
      <div class="txt"><b>${esc(t('native.repeatCount'))}</b></div>
      <div class="ctl"><select id="opt-repeat-max" style="width:auto;min-width:100px">
        ${[0, 3, 6, 10, 20].map((v) => `<option value="${v}" ${(S.getState().settings.repeatMax == null ? 6 : S.getState().settings.repeatMax) === v ? 'selected' : ''}>${v === 0 ? esc(t('native.repeatNone')) : v}</option>`).join('')}
      </select></div>
    </div>
    <div class="btn-row grow" style="margin:8px 0">
      <button type="button" class="btn soft" data-act="native-notif-settings">${esc(t('native.notifSettings'))}</button>
      <button type="button" class="btn soft" data-act="native-app-details">${esc(t('native.appDetails'))}</button>
    </div>
    <p class="tiny muted" style="margin:0">${esc(nativeOemHint())}</p>
    <div class="btn-row grow" style="margin-top:10px">
      <button type="button" class="btn soft" data-act="native-diagnose">🔍 ${esc(t('native.diagBtn'))}</button>
      <button type="button" class="btn soft" data-act="native-test-2min">⏱ ${esc(t('native.test2min'))}</button>
    </div>
  </section>`;
}

function nativeEvents() {
  const events = [];
  const now = Date.now();
  const today = S.todayISO();
  const st = S.getState();
  for (let i = 0; i < NATIVE_HORIZON_DAYS; i++) {
    const date = S.addDaysISO(today, i);
    S.expectedDoses(date).forEach((d) => {
      if (!d.med || d.med.paused) return;
      const ts = doseTs(date, d.time);
      if (ts <= now || S.getLog(date, d.medId, d.time)) return;
      events.push({ key: `dose:${date}:${d.medId}:${d.time}`, type: 'dose', ts, date, time: d.time, medId: d.medId, med: d.med });
    });
  }
  Object.keys(snoozed).forEach((key) => {
    const ts = snoozed[key];
    const ev = eventFromDoseKey(key);
    if (!ev || !ts || ts <= now || S.getLog(ev.date, ev.medId, ev.time) || ev.med.paused) return;
    events.push({ ...ev, key: key + ':snz', ts });
  });
  st.appointments.forEach((a) => {
    if (a.status !== 'planned') return;
    const ts = S.apptNotifyTime(a).getTime();
    if (ts > now) events.push({ key: `appt:${a.id}`, type: 'appt', ts, appt: a });
  });
  const low = S.lowStockMeds();
  if (low.length) {
    for (let i = 0; i < 3; i++) {
      const date = S.addDaysISO(today, i);
      const ts = doseTs(date, '09:00');
      if (ts > now) events.push({ key: `stock:${date}`, type: 'stock', ts, low });
    }
  }
  const hhmm = st.settings.dailySummary;
  if (hhmm && S.isValidTime(hhmm)) {
    for (let i = 0; i < 3; i++) {
      const date = S.addDaysISO(today, i);
      const ts = doseTs(date, hhmm);
      if (ts > now) events.push({ key: `summary:${date}`, type: 'summary', ts, date });
    }
  }
  return events.sort((a, b) => a.ts - b.ts).slice(0, NATIVE_MAX);
}

function nativeBuild(ev, used, doseCh, genCh) {
  const at = new Date(ev.ts);
  const base = { id: nativeId(ev.key, used), schedule: { at, allowWhileIdle: true }, autoCancel: true };
  if (ev.type === 'dose') {
    const name = medName(ev.med);
    return {
      ...base,
      title: t('notif.doseTitle'),
      body: `${name}${ev.med.dose ? ' — ' + ev.med.dose + ' ' + t('meds.unit') : ''}`,
      channelId: doseCh.id,
      actionTypeId: 'DOSE',
      extra: { type: 'dose', date: ev.date, medId: ev.medId, time: ev.time, screen: 'today' }
    };
  }
  if (ev.type === 'appt') {
    const a = ev.appt;
    return {
      ...base,
      title: t('notif.apptTitle'),
      body: `${localized(a.titleAr, a.titleEn)} — ${fmtTime(a.time)}`,
      channelId: genCh.id,
      extra: { type: 'appt', apptId: a.id, screen: 'appts' }
    };
  }
  if (ev.type === 'stock') {
    const parts = ev.low.map((m) => (Number(m.stock) <= 0
      ? t('stock.outShort', { name: medName(m) })
      : `${medName(m)}: ${fmtNum(m.stock)} ${t('stock.pillsShort')} (~${S.stockDaysLeft(m)} ${t('stock.daysShort')})`));
    return { ...base, title: t('stock.notifTitle'), body: parts.join('، '), channelId: genCh.id, extra: { type: 'stock', screen: 'meds' } };
  }
  /* الملخص اليومي: اليوم نعرف العدد المتبقي، وللأيام القادمة نص عام */
  let body = t('notif.summaryGeneric');
  if (ev.date === S.todayISO()) {
    const left = S.expectedDoses(ev.date).filter((d) => d.med && !d.med.paused && !S.getLog(ev.date, d.medId, d.time)).length;
    if (!left) return null;
    body = `${left} ${t('notif.remaining')}`;
  }
  return { ...base, title: t('notif.summaryTitle'), body, channelId: genCh.id, extra: { type: 'summary', screen: 'today' } };
}

function nativeToneInfo() {
  const s = S.getState().settings;
  const pat = (s.vibPattern && s.vibPattern.length) ? s.vibPattern : (SOUND.VIB_PATTERNS[s.vibration] || []);
  return { silent: !s.sound, uri: s.sysToneUri || '', pattern: pat.slice() };
}

/** إعدادات المنبّه الأصلي: النغمة، التكرار، ونصوص شاشة المنبّه */
function nativeAlarmConfig() {
  const s = S.getState().settings;
  const snooze = s.snoozeMin || 10;
  return {
    ...nativeToneInfo(),
    ringSec: s.ringSec || 60,
    repeatMin: s.repeatMin || 5,
    repeatMax: s.repeatMax == null ? 6 : s.repeatMax,
    snoozeMin: snooze,
    labels: {
      taken: '✅  ' + t('native.takenBtn'),
      takenSel: '✅  ' + t('native.takenSel'),
      pickOne: t('native.pickOne'),
      snooze: `⏰  ${t('native.snoozeBtn')} ${snooze} ${t('native.minShort')}`,
      skip: t('native.skipBtn'),
      slide: t('native.slideLabel'),
      more: t('native.moreLabel'),
      rtl: getLang() === 'ar'
    }
  };
}

/** أدوية نفس الموعد = منبّه واحد يعرضها كلها ويُسجَّل كل دواء على حدة */
function nativeGroupAlarms(events) {
  const groups = new Map();
  events.filter((e) => e.type === 'dose' && !e.key.endsWith(':snz')).forEach((ev) => {
    const gk = `${ev.date}|${ev.time}`;
    if (!groups.has(gk)) groups.set(gk, { at: ev.ts, date: ev.date, time: ev.time, list: [] });
    groups.get(gk).list.push(ev);
  });
  return Array.from(groups.values()).map((g) => {
    const items = g.list.map((ev) => ({
      medId: ev.medId,
      name: medName(ev.med),
      dose: ev.med.dose ? `${ev.med.dose} ${t('meds.unit')}` : ''
    }));
    return {
      at: g.at, key: `grp:${g.date}:${g.time}`, type: 'dose', date: g.date, time: g.time,
      medId: items[0].medId, title: t('notif.doseTitle'),
      body: items.map((i) => (i.dose ? `${i.name} — ${i.dose}` : i.name)).join('\n'),
      items
    };
  });
}

function nativeAlarmFromEvent(ev) {
  const dose = ev.med.dose ? ' — ' + ev.med.dose + ' ' + t('meds.unit') : '';
  return {
    at: ev.ts, key: ev.key, type: 'dose', date: ev.date, medId: ev.medId, time: ev.time,
    title: t('notif.doseTitle'), body: medName(ev.med) + dose
  };
}

/** مفاتيح الجرعات المسجَّلة (مأخوذة/متخطاة) لإلغاء تكراراتها في الجزء الأصلي */
function nativeDoneKeys() {
  const keys = [];
  const today = S.todayISO();
  for (let i = -1; i < NATIVE_HORIZON_DAYS; i++) {
    const date = S.addDaysISO(today, i);
    S.expectedDoses(date).forEach((d) => {
      if (S.getLog(date, d.medId, d.time)) keys.push(`dose:${date}:${d.medId}:${d.time}`);
    });
  }
  return keys;
}

/** نتائج ضغط المريض على «أخذتها/تخطي» من شاشة المنبّه (حتى لو كان التطبيق مغلقًا) */
async function nativePollResults() {
  const DS = NATIVE.DS();
  if (!DS) return;
  try {
    const r = await DS.popResults();
    const list = (r && r.results) || [];
    if (!list.length) return;
    list.forEach((x) => {
      if (x.date && x.medId && x.time && !S.getLog(x.date, x.medId, x.time)) {
        S.setDoseStatus(x.date, x.medId, x.time, x.status === 'skipped' ? 'skipped' : 'taken');
      }
    });
    render();
  } catch (e) { /* ignore */ }
}

function strHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** ينشئ (أو يعيد استخدام) قناة الجرعات بالنغمة والاهتزاز المختارين ويعيد معرّفها */
async function nativeDoseChannelId() {
  const DS = NATIVE.DS();
  const info = nativeToneInfo();
  const ar = getLang() === 'ar';
  if (!DS) {
    const ch = nativeChannel('general');
    await NATIVE.LN().createChannel(ch);
    return ch.id;
  }
  const s = S.getState().settings;
  const key = info.silent ? 'silent' : 'sys' + strHash(info.uri);
  const id = `d3_${key}_${strHash(info.pattern.join('-') || 'n')}`;
  await DS.createChannel({
    id,
    name: `${ar ? 'الجرعات' : 'Doses'} — ${info.silent ? (ar ? 'صامت' : 'Silent') : (s.sysToneName || (ar ? 'نغمة الهاتف' : 'Phone ringtone'))}`,
    uri: info.uri,
    silent: info.silent,
    pattern: info.pattern.length ? [0].concat(info.pattern) : []
  });
  return id;
}

async function nativeScheduleNow() {
  const LN = NATIVE.LN();
  if (!LN) return;
  const s = S.getState().settings;
  try {
    const pend = await LN.getPending();
    const ids = (pend.notifications || []).filter((n) => n.id !== NATIVE_TEST_ID).map((n) => ({ id: n.id }));
    if (ids.length) await LN.cancel({ notifications: ids });
    const DS = NATIVE.DS();
    if (!s.notify || nativePerm !== 'granted') {
      if (DS) { try { await DS.cancelAlarms(); } catch (e) { /* ignore */ } }
      return;
    }
    const events = nativeEvents();
    let alarmOk = false;
    if (DS && s.alarmMode !== false) {
      try {
        const alarms = nativeGroupAlarms(events);
        await DS.scheduleAlarms({ alarms, doneKeys: nativeDoneKeys(), config: nativeAlarmConfig() });
        alarmOk = true;
      } catch (e) { console.warn('alarm schedule failed, falling back to notifications', e); }
    } else if (DS) {
      try { await DS.cancelAlarms(); } catch (e) { /* ignore */ }
    }
    await LN.registerActionTypes({
      types: [{ id: 'DOSE', actions: [
        { id: 'taken', title: t('notif.takenAction') },
        { id: 'snooze', title: t('notif.snoozeAction') }
      ] }]
    });
    const doseCh = { id: await nativeDoseChannelId() };
    const genCh = nativeChannel('general');
    await LN.createChannel(genCh);
    const used = new Set([NATIVE_TEST_ID]);
    const list = events
      .filter((ev) => !(alarmOk && ev.type === 'dose'))
      .map((ev) => nativeBuild(ev, used, doseCh, genCh))
      .filter(Boolean);
    if (list.length) await LN.schedule({ notifications: list });
  } catch (e) {
    console.warn('native schedule failed', e);
  }
}

/** تجميع الطلبات المتتالية في جدولة واحدة (كل تغيير بيانات يستدعيها) */
function nativeScheduleSoon() {
  clearTimeout(nativeTimer);
  nativeTimer = setTimeout(async () => {
    if (nativeBusy) { nativeDirty = true; return; }
    nativeBusy = true;
    try { await nativeScheduleNow(); } finally { nativeBusy = false; }
    if (nativeDirty) { nativeDirty = false; nativeScheduleSoon(); }
  }, 500);
}

async function nativeTestNotification() {
  const LN = NATIVE.LN();
  if (!LN) return '';
  const DS = NATIVE.DS();
  if (DS && S.getState().settings.alarmMode !== false) {
    try {
      await DS.testAlarm({ delaySec: 5, title: t('notif.doseTitle'), body: t('settings.testNotificationBody'), config: nativeAlarmConfig() });
      return t('native.testAlarmStarted');
    } catch (e) { /* fall back to a plain notification */ }
  }
  try {
    const ch = { id: await nativeDoseChannelId() };
    await LN.schedule({ notifications: [{
      id: NATIVE_TEST_ID,
      title: t('notif.doseTitle'),
      body: t('settings.testNotificationBody'),
      schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true },
      channelId: ch.id,
      extra: { type: 'test', screen: 'settings' }
    }] });
  } catch (e) { toast(t('toast.error')); }
  return '';
}

async function nativeShareFile(filename, content, mime) {
  const FS = NATIVE.FS();
  const SH = NATIVE.SHARE();
  if (!FS || !SH) { toast(t('toast.error')); return; }
  try {
    const w = await FS.writeFile({ path: filename, data: content, directory: 'CACHE', encoding: 'utf8' });
    await SH.share({ title: filename, url: w.uri, dialogTitle: filename });
  } catch (e) {
    if (!/cancel/i.test(String(e && e.message))) toast(t('toast.error'));
  }
}

function nativeHandleAction(ev) {
  const x = (ev.notification && ev.notification.extra) || {};
  const LN = NATIVE.LN();
  const dismiss = () => { if (LN && ev.notification) LN.removeDeliveredNotifications({ notifications: [{ id: ev.notification.id }] }).catch(() => {}); };
  if (x.type === 'dose' && ev.actionId === 'taken') {
    S.setDoseStatus(x.date, x.medId, x.time, 'taken');
    toast(t('toast.saved'));
    dismiss();
  } else if (x.type === 'dose' && ev.actionId === 'snooze') {
    snoozeDose(`dose:${x.date}:${x.medId}:${x.time}`, S.getState().settings.snoozeMin || 10);
    toast(t('notif.snoozed'));
    dismiss();
  } else if (x.screen && ['today', 'meds', 'appts', 'stats', 'settings'].includes(x.screen)) {
    currentScreen = x.screen;
  }
  render();
}

async function nativeInit() {
  const LN = NATIVE.LN();
  document.documentElement.classList.add('native');
  if (!LN) return;
  LN.addListener('localNotificationActionPerformed', nativeHandleAction);
  /* وصل التنبيه والتطبيق مفتوح: نُظهر شريط «أخذتها» داخل الصفحة دون صوت مكرر */
  LN.addListener('localNotificationReceived', (n) => {
    const x = (n && n.extra) || {};
    if (x.type !== 'dose') return;
    const med = S.getState().meds.find((m) => m.id === x.medId);
    if (med) inAppReminder({ medId: x.medId, time: x.time }, medName(med), true);
  });
  const APP = NATIVE.APP();
  if (APP) {
    APP.addListener('backButton', () => {
      const dlg = modal();
      if (dlg && dlg.open) { closeModal(); return; }
      if (currentScreen !== 'today') { currentScreen = 'today'; render(); return; }
      APP.exitApp();
    });
    APP.addListener('appStateChange', async (st) => {
      if (!st.isActive) return;
      await nativeRefreshPerm();
      await nativePollResults();
      render();
      nativeScheduleSoon();
    });
  }
  S.subscribe(() => nativeScheduleSoon());
  await nativeRefreshPerm();
  await nativePollResults();
  clearInterval(nativePollTimer);
  nativePollTimer = setInterval(() => { if (document.visibilityState === 'visible') nativePollResults(); }, 4000);
  if (S.getState().settings.notify && nativePerm !== 'granted' && S.getState().settings.onboarded) {
    await nativeRequestPermission();
  }
  if (S.getState().settings.onboarded) nativeEnsureExact().then(nativeEnsureBattery).then(nativeEnsureOverlay);
  render();
  nativeScheduleSoon();
}

/* ================= Service Worker ================= */
let deferredInstall = null;
async function initSW() {
  if (NATIVE.isNative || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    reg.addEventListener('updatefound', () => { /* التحديث عند إعادة الفتح */ });
    navigator.serviceWorker.addEventListener('message', (event) => {
      const d = event.data || {};
      if (d.type === 'notification-action') {
        if (d.action === 'taken' && d.data) {
          S.setDoseStatus(d.data.date, d.data.medId, d.data.time, 'taken');
          toast(t('toast.saved'));
          render();
        } else if (d.action === 'snooze' && d.data) {
          snoozeDose(`dose:${d.data.date}:${d.data.medId}:${d.data.time}`, S.getState().settings.snoozeMin || 10);
          toast(t('notif.snoozed'));
        }
      }
    });
  } catch (e) {
    console.warn('SW registration failed', e);
  }
}

/* ================= أدوات النظام ================= */
async function requestNotifPermission() {
  if (NATIVE.isNative) return nativeRequestPermission();
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try { return await Notification.requestPermission(); } catch (e) { return Notification.permission; }
}

function handleInstall() {
  if (deferredInstall) {
    deferredInstall.prompt();
    deferredInstall.userChoice.then(() => { deferredInstall = null; });
  } else {
    toast(t('settings.install'));
  }
}

/* ================= معالجة الأحداث ================= */
function bindEvents() {
  document.addEventListener('click', async (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      currentScreen = nav.dataset.nav;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const a = act.dataset.act;

    switch (a) {
      case 'add-med': medForm(null); break;
      case 'edit-med': {
        const med = S.getState().meds.find((m) => m.id === act.dataset.id);
        if (med) medForm(med);
        break;
      }
      case 'save-med': {
        const form = $('#modal-form');
        const fd = new FormData(form);
        const data = {
          nameAr: fd.get('nameAr') || '',
          nameEn: fd.get('nameEn') || '',
          dose: fd.get('dose') || '',
          form: fd.get('form') || '',
          notes: fd.get('notes') || '',
          times: formState.times.filter((x) => S.isValidTime(x)),
          startDate: fd.get('startDate') || S.todayISO(),
          endDate: fd.get('endDate') || '',
          stock: fd.get('stock'),
          perDose: fd.get('perDose'),
          color: formState.color
        };
        if (!data.nameAr.trim() && !data.nameEn.trim()) { toast(t('meds.medName')); return; }
        if (!data.times.length) { toast(t('meds.noTimes')); return; }
        if (formState.id) { S.updateMed(formState.id, data); } else { S.addMed(data); }
        closeModal();
        toast(t('toast.saved'));
        render();
        scheduleAll();
        break;
      }
      case 'refill-med': {
        const med = S.getState().meds.find((x) => x.id === act.dataset.id);
        if (!med) break;
        formState = { type: 'refill', id: med.id };
        openModal({
          title: `${t('stock.refillTitle')} — ${medName(med)}`,
          body: `<label class="fld"><span>${esc(t('stock.refillAdd'))}</span>
            <input type="number" name="qty" min="1" step="1" inputmode="decimal" required autofocus></label>`,
          footer: `<button type="button" class="btn ghost" data-act="close-modal">${esc(t('common.cancel'))}</button>
                   <button type="button" class="btn primary" data-act="save-refill">${esc(t('common.save'))}</button>`
        });
        break;
      }
      case 'save-refill': {
        const qty = Number(new FormData($('#modal-form')).get('qty'));
        if (!(qty > 0)) { toast(t('stock.refillAdd')); return; }
        S.refillMed(formState.id, qty);
        closeModal();
        toast(t('toast.saved'));
        render();
        scheduleAll();
        break;
      }
      case 'add-time': {
        formState.times.push('12:00');
        renderTimesEditor();
        break;
      }
      case 'remove-time': {
        formState.times.splice(Number(act.dataset.idx), 1);
        renderTimesEditor();
        break;
      }
      case 'pick-color': {
        formState.color = act.dataset.color;
        $$('#color-picker [data-act="pick-color"]').forEach((b) => {
          b.style.border = `3px solid ${b.dataset.color === formState.color ? 'var(--text)' : 'transparent'}`;
        });
        break;
      }
      case 'toggle-med': {
        S.toggleMedPaused(act.dataset.id);
        render(); scheduleAll();
        break;
      }
      case 'delete-med': {
        const med = S.getState().meds.find((m) => m.id === act.dataset.id);
        if (!med) return;
        const ok = await confirmDialog(t('common.delete'), t('meds.deleteConfirm', { name: medName(med) }), t('common.delete'));
        if (ok) { S.deleteMed(med.id); toast(t('toast.deleted')); render(); scheduleAll(); }
        break;
      }
      case 'take-dose': {
        S.setDoseStatus(S.todayISO(), act.dataset.med, act.dataset.time, 'taken');
        toast(t('toast.saved'));
        render(); scheduleAll();
        break;
      }
      case 'skip-dose': {
        S.setDoseStatus(S.todayISO(), act.dataset.med, act.dataset.time, 'skipped');
        render(); scheduleAll();
        break;
      }
      case 'undo-dose': {
        S.setDoseStatus(S.todayISO(), act.dataset.med, act.dataset.time, null);
        render(); scheduleAll();
        break;
      }
      case 'add-appt': apptForm(null); break;
      case 'edit-appt': {
        const ap = S.getState().appointments.find((x) => x.id === act.dataset.id);
        if (ap) apptForm(ap);
        break;
      }
      case 'save-appt': {
        const fd = new FormData($('#modal-form'));
        const data = {
          titleAr: fd.get('titleAr') || '',
          titleEn: fd.get('titleEn') || '',
          doctor: fd.get('doctor') || '',
          clinic: fd.get('clinic') || '',
          date: fd.get('date') || S.todayISO(),
          time: fd.get('time') || '10:00',
          remindBeforeMin: Number(fd.get('remindBeforeMin')) || 0,
          notes: fd.get('notes') || ''
        };
        if (!data.titleAr.trim() && !data.titleEn.trim()) { toast(t('appts.titleAr')); return; }
        if (formState && formState.id) S.updateAppt(formState.id, data); else S.addAppt(data);
        closeModal();
        toast(t('toast.saved'));
        render(); scheduleAll();
        break;
      }
      case 'appt-done': { S.setApptStatus(act.dataset.id, 'done'); toast(t('toast.saved')); render(); break; }
      case 'appt-missed': { S.setApptStatus(act.dataset.id, 'missed'); render(); break; }
      case 'delete-appt': {
        const ap = S.getState().appointments.find((x) => x.id === act.dataset.id);
        const title = ap ? localized(ap.titleAr, ap.titleEn) : '';
        const ok = await confirmDialog(t('common.delete'), `${title} — ${t('appts.deleteConfirm')}`, t('common.delete'));
        if (ok) { S.deleteAppt(act.dataset.id); toast(t('toast.deleted')); render(); scheduleAll(); }
        break;
      }
      case 'set-lang': {
        const lang = act.dataset.lang;
        setLang(lang);
        S.updateSettings({ lang });
        toast(t('toast.lang'));
        render(); scheduleAll();
        break;
      }
      case 'export-json': {
        download(`treatment-reminder-backup-${S.todayISO()}.json`, JSON.stringify(S.exportPayload(), null, 2), 'application/json');
        toast(t('toast.exported'));
        break;
      }
      case 'import-json': {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'application/json,.json';
        input.onchange = () => {
          const file = input.files && input.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              S.importPayload(JSON.parse(reader.result));
              setLang(S.getState().settings.lang || 'ar');
              toast(t('toast.imported'));
              render(); scheduleAll();
            } catch (err) { toast(t('toast.importFailed')); }
          };
          reader.readAsText(file);
        };
        input.click();
        break;
      }
      case 'export-ics': {
        download(`treatment-reminder-${S.todayISO()}.ics`, S.buildICS(getLang()), 'text/calendar;charset=utf-8');
        toast(t('toast.exported'));
        break;
      }
      case 'reset-all': {
        const ok = await confirmDialog(t('settings.reset'), t('settings.resetConfirm'), t('common.yes'));
        if (ok) { S.resetAll(); toast(t('toast.deleted')); render(); scheduleAll(); }
        break;
      }
      case 'set-font': {
        S.updateSettings({ fontSize: act.dataset.size || 'medium' });
        applyFontSize();
        render();
        break;
      }
      case 'set-theme': {
        S.updateSettings({ theme: act.dataset.theme || 'auto' });
        applyTheme();
        render();
        break;
      }
      case 'set-tone': {
        const chosen = act.dataset.tone || 'chime';
        if (chosen === 'system' && NATIVE.isNative && !S.getState().settings.sysToneName) {
          await pickSystemTone();
          break;
        }
        S.updateSettings({ tone: chosen });
        render();
        break;
      }
      case 'preview-tone': {
        previewTone(act.dataset.tone);
        break;
      }
      case 'test-notification': {
        await testNotification();
        break;
      }
      case 'test-alert': {
        testAlert();
        break;
      }
      case 'pick-custom-tone': {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = async () => {
          const file = input.files && input.files[0];
          if (!file) return;
          try {
            const dataUrl = await SOUND.readAudioFile(file);
            S.updateSettings({ customTone: dataUrl, customToneName: file.name, tone: 'custom' });
            render();
            toast(t('toast.saved'));
            previewTone('custom');
          } catch (err) {
            toast(err && err.message === 'too big' ? t('sound.customTooBig') : t('toast.error'));
          }
        };
        input.click();
        break;
      }
      case 'phone-steps': {
        showPhoneSteps();
        break;
      }
      case 'copy-steps': {
        const steps = SOUND.phoneSoundSteps(getLang()).map((s, i) => `${i + 1}. ${s}`).join('\n');
        try {
          await navigator.clipboard.writeText(steps);
          toast(t('sound.phoneStepsCopied'));
        } catch (e) {
          toast(t('toast.error'));
        }
        break;
      }
      case 'open-notif-settings': {
        if (NATIVE.isNative || !SOUND.openSystemNotificationSettings()) toast(t('sound.phoneSteps'));
        break;
      }
      case 'pick-system-tone': {
        await pickSystemTone();
        break;
      }
      case 'native-battery': {
        const DS = NATIVE.DS();
        if (!DS) break;
        if (nativeBatteryOk) { await nativeRefreshPerm(); render(); break; }
        await DS.requestIgnoreBatteryOptimizations();
        break;
      }
      case 'native-overlay': {
        const DS = NATIVE.DS();
        if (DS) await DS.openOverlaySettings();
        break;
      }
      case 'native-diagnose': await nativeShowDiagnostics(); break;
      case 'native-test-2min': {
        const DS = NATIVE.DS();
        if (!DS) break;
        try {
          await DS.testAlarm({ delaySec: 120, title: t('notif.doseTitle'), body: t('settings.testNotificationBody'), config: nativeAlarmConfig() });
          toast(t('native.test2minStarted'));
        } catch (e) { toast(t('toast.error')); }
        break;
      }
      case 'native-fullscreen': {
        const DS = NATIVE.DS();
        if (DS) await DS.openFullScreenSettings();
        break;
      }
      case 'native-notif-settings': {
        const DS = NATIVE.DS();
        if (DS) await DS.openAppNotificationSettings();
        break;
      }
      case 'native-app-details': {
        const DS = NATIVE.DS();
        if (DS) await DS.openAppDetails();
        break;
      }
      case 'native-exact': {
        const LN = NATIVE.LN();
        if (LN) { try { await LN.changeExactNotificationSetting(); } catch (e) { toast(t('toast.error')); } }
        break;
      }
      case 'install': handleInstall(); break;
      case 'close-modal': closeModal(); break;
      case 'onb-start': finishOnboarding(); break;
      case 'onb-later': {
        S.updateSettings({ onboarded: true });
        closeModal(); render();
        break;
      }
    }
  });

  /* Enter داخل النموذج = حفظ (بدون إغلاق مفاجئ) */
  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'modal-form') return;
    e.preventDefault();
    const btn = document.querySelector('#modal .btn.primary');
    if (btn) btn.click();
  });

  /* تغيير الوقت داخل محرّر الأوقات */
  document.addEventListener('change', (e) => {
    const ti = e.target.closest('[data-time-idx]');
    if (ti && formState) {
      formState.times[Number(ti.dataset.timeIdx)] = ti.value;
      renderTimesEditor();
    }
    const id = e.target.id;
    const st = S.getState().settings;
    if (id === 'patient-name') { S.updateSettings({ patientName: e.target.value }); render(); }
    if (id === 'opt-sound') { S.updateSettings({ sound: e.target.checked }); }
    if (id === 'opt-volume') {
      S.updateSettings({ volume: Number(e.target.value) / 100 });
      const lbl = $('#vol-val');
      if (lbl) lbl.textContent = e.target.value + '%';
    }
    if (id === 'opt-vibration') { S.updateSettings({ vibration: e.target.value }); }
    if (id === 'opt-alarm-mode') { S.updateSettings({ alarmMode: e.target.checked }); }
    if (id === 'opt-repeat-min') { S.updateSettings({ repeatMin: Number(e.target.value) || 5 }); }
    if (id === 'opt-repeat-max') { S.updateSettings({ repeatMax: Number(e.target.value) }); }
    if (id === 'opt-summary') { S.updateSettings({ dailySummary: e.target.value }); scheduleAll(); }
    if (id === 'opt-snooze') { S.updateSettings({ snoozeMin: Number(e.target.value) || 10 }); }
    if (id === 'opt-grace') { S.updateSettings({ graceMin: Number(e.target.value) || 0 }); render(); }
    if (id === 'opt-notify') {
      if (e.target.checked) {
        requestNotifPermission().then((p) => {
          S.updateSettings({ notify: p === 'granted' });
          if (p === 'granted') { toast(t('toast.notifOn')); scheduleAll(); nativeEnsureExact().then(nativeEnsureBattery).then(nativeEnsureOverlay); }
          else { toast(t('toast.notifOff')); }
          render();
        });
      } else {
        S.updateSettings({ notify: false });
        toast(t('toast.notifOff'));
      }
    }
  });

  $('#btn-lang').addEventListener('click', () => {
    const next = getLang() === 'ar' ? 'en' : 'ar';
    setLang(next);
    S.updateSettings({ lang: next });
    toast(t('toast.lang'));
    render(); scheduleAll();
  });
  $('#btn-install').addEventListener('click', handleInstall);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    $('#btn-install').hidden = false;
  });
  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    $('#btn-install').hidden = true;
    toast(t('toast.installed'));
  });

  document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); scheduleAll(); } });
  window.addEventListener('focus', () => { render(); scheduleAll(); });
}

/* ================= الترحيب ================= */
function showOnboarding() {
  const body = `
    <p class="muted" style="margin-bottom:14px">${esc(t('onb.subtitle'))}</p>
    <label class="fld"><span>${esc(t('onb.name'))}</span>
      <input type="text" id="onb-name" placeholder="${esc(t('settings.patientNamePh'))}"></label>
    <button type="button" class="btn soft block" id="onb-notif">🔔 ${esc(t('onb.notif'))}</button>
    <p class="muted tiny" style="margin-top:8px">${esc(t('onb.notifDesc'))}</p>`;
  const dlg = openModal({
    title: t('onb.title'),
    body,
    footer: `<button type="button" class="btn ghost" data-act="onb-later">${esc(t('onb.later'))}</button>
             <button type="button" class="btn primary" data-act="onb-start">${esc(t('onb.start'))}</button>`
  });
  dlg.addEventListener('click', (e) => {
    const b = e.target.closest('#onb-notif');
    if (b) {
      requestNotifPermission().then((p) => {
        S.updateSettings({ notify: p === 'granted' });
        toast(p === 'granted' ? t('toast.notifOn') : t('toast.notifOff'));
      });
    }
  });
}

async function finishOnboarding() {
  const input = $('#onb-name');
  if (input && input.value.trim()) S.updateSettings({ patientName: input.value.trim() });
  S.updateSettings({ onboarded: true });
  closeModal();
  render();
  scheduleAll();
  if (NATIVE.isNative) setTimeout(() => nativeEnsureExact().then(nativeEnsureBattery).then(nativeEnsureOverlay), 500);
}

/* ================= بدء التشغيل ================= */
function handleUrlParams() {
  const p = new URLSearchParams(location.search);
  if (p.get('screen') && ['today', 'meds', 'appts', 'stats', 'settings'].includes(p.get('screen'))) {
    currentScreen = p.get('screen');
  }
  const act = p.get('act');
  if (act === 'taken' && p.get('med')) {
    S.setDoseStatus(p.get('date') || S.todayISO(), p.get('med'), p.get('time') || '', 'taken');
    toast(t('toast.saved'));
  } else if (act === 'snooze' && p.get('med')) {
    snoozeDose(`dose:${p.get('date') || S.todayISO()}:${p.get('med')}:${p.get('time') || ''}`,
      S.getState().settings.snoozeMin || 10);
    toast(t('notif.snoozed'));
  }
  if (act) {
    history.replaceState(null, '', './index.html' + (p.get('screen') ? '?screen=' + p.get('screen') : ''));
  }
}

let appStarted = false;
function init() {
  if (appStarted) return;
  appStarted = true;
  const state = S.getState();
  const savedLang = state.settings.lang;
  const browserLang = (navigator.language || '').toLowerCase().startsWith('en') ? 'en' : 'ar';
  setLang(savedLang || browserLang);
  applyTheme();
  applyFontSize();
  handleUrlParams();
  bindEvents();
  render();
  initSW();
  if (NATIVE.isNative) nativeInit();
  scheduleAll();

  /* إعادة الحساب كل 5 دقائق + تحديث الواجهة كل 30 ثانية */
  setInterval(() => { scheduleAll(); }, 5 * 60000);
  setInterval(() => { if (document.visibilityState === 'visible') render(); }, 30000);

  /* تذكير Permissions */
  if (!NATIVE.isNative && state.settings.notify && 'Notification' in window && Notification.permission === 'default') {
    setTimeout(() => {
      requestNotifPermission().then((p) => {
        S.updateSettings({ notify: p === 'granted' });
        if (p === 'granted') scheduleAll();
      });
    }, 2500);
  }

  if (!state.settings.onboarded) setTimeout(showOnboarding, 400);

  /* زر التثبيت في الشريط العلوي */
  if (NATIVE.isNative || window.matchMedia('(display-mode: standalone)').matches) $('#btn-install').hidden = true;
}

document.addEventListener('DOMContentLoaded', init);
if (document.readyState !== 'loading') init();

/* خطاف تشخيص/اختبار — لا يؤثر على عمل التطبيق */
window.__tr = {
  get store() { return S; },
  applyTheme,
  fireEvent,
  scheduleAll,
  upcomingEvents,
  alarmCount: () => alarmTimers.size,
  snoozeDose,
  get snoozed() { return snoozed; }
};
