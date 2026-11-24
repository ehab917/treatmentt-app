import LANGS from './i18n.js';
import { isNative, LN, FS, SHARE, APP, DS } from './native.js';
import { playTone, vibrate, TONES, VIB_PATTERNS, readAudioFile, phoneSoundSteps } from './sounds.js';

// --- إدارة الحالة والبيانات ---
const DB_KEY = 'treatment_reminder_db_v16';

let state = {
  lang: 'ar',
  theme: 'system',
  medications: [],
  logs: [], // { date, medId, action: 'taken'|'skipped'|'snoozed' }
  settings: {
    tone: 'bell',
    vibration: 'medium',
    customSoundUrl: '',
    alarmMode: true, // Use native AlarmManager if possible
    exactAlarm: true,
    repeatInterval: 5, // minutes
    maxRepeats: 6,
    screenOn: true
  }
};

function loadState() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...state, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load state', e);
  }
}

function saveState() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state', e);
  }
}

function t(key) {
  const keys = key.split('.');
  let val = state.lang === 'ar' ? LANGS.ar : LANGS.en;
  for (const k of keys) {
    if (val && typeof val === 'object') val = val[k];
    else return key;
  }
  return val || key;
}

// --- منطق الجدولة (Scheduling Logic) ---
// نحسب المواعيد القادمة ونجدولها باستخدام Local Notifications أو Native Alarms

function getUpcomingDoses(medications, daysAhead = 7) {
  const doses = [];
  const now = new Date();
  
  medications.forEach(med => {
    const [h, m] = med.time.split(':').map(Number);
    const intervalHours = parseInt(med.interval) || 24;
    
    let currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    if (currentDate < now) {
      // If time has passed today, start from tomorrow or adjust based on interval
      currentDate.setDate(currentDate.getDate() + 1); 
    }

    for (let i = 0; i < daysAhead * 24 / Math.max(1, intervalHours); i++) {
      doses.push({
        id: `${med.id}_${currentDate.toISOString()}`,
        medId: med.id,
        name: med.name,
        dosage: med.dosage,
        timeStr: currentDate.toISOString(),
        time: currentDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        date: currentDate.toISOString().split('T')[0],
        interval: intervalHours
      });
      
      // Move forward by interval
      const next = new Date(currentDate.getTime() + intervalHours * 60 * 60 * 1000);
      if (next > new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)) break;
      currentDate = next;
    }
  });
  
  return doses.sort((a, b) => new Date(a.timeStr) - new Date(b.timeStr));
}

async function scheduleAllNotifications() {
  if (!isNative) return;
  
  const LNPlugin = LN();
  if (!LNPlugin) return;

  // Cancel old notifications
  await LNPlugin.cancelAll();

  const upcoming = getUpcomingDoses(state.medications, 7); // Schedule next 7 days
  
  upcoming.forEach(dose => {
    const date = new Date(dose.timeStr);
    // Capacitor Local Notifications expects a specific date format
    LNPlugin.scheduleNotification({
      id: parseInt(dose.id.split('_')[1]) || Math.random(),
      title: t('messages.reminder_title'),
      body: `${dose.name} (${dose.dosage})`,
      schedule: {
        at: date
      },
      sound: null, // We handle sound in the activity or use system default
      largeText: `${t('dashboard.next_dose')}: ${dose.time}\n${dose.name}`,
      actionTypeId: dose.medId, // Link to med ID
      extra: { medId: dose.medId, timeStr: dose.timeStr }
    });
  });
}

// --- واجهة المستخدم (UI Rendering) ---

function renderApp() {
  document.documentElement.dir = LANGS[state.lang].dir;
  document.title = t('title');
  document.getElementById('app-title').textContent = t('title');
  document.getElementById('app-tagline').textContent = t('tagline');
  
  // Theme handling
  applyTheme();

  // Render current view (default: Today/Dashboard)
  renderDashboard();
  updateTabBar();
}

function applyTheme() {
  const root = document.documentElement;
  const isDark = state.theme === 'dark' || 
                 (state.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  if (isDark) {
    root.classList.add('dark');
    document.body.style.backgroundColor = '#121212';
  } else {
    root.classList.remove('dark');
    document.body.style.backgroundColor = '#f4f7f6';
  }
}

function renderDashboard() {
  const main = document.getElementById('view');
  const upcoming = getUpcomingDoses(state.medications, 1).filter(d => new Date(d.timeStr) >= new Date());
  
  let html = `<header class="section-header"><h2>${t('dashboard.upcoming')}</h2></header>`;
  
  if (state.medications.length === 0) {
    html += `<div class="empty-state">
               <p>${t('dashboard.no_meds')}</p>
               <button onclick="showModal('add-med')" class="btn primary">${t('meds.add_med')}</button>
             </div>`;
  } else if (upcoming.length === 0) {
    html += `<div class="empty-state"><p>${t('dashboard.empty_schedule')}</p></div>`;
  } else {
    html += `<ul class="dose-list">`;
    upcoming.forEach(dose => {
      html += `
        <li class="dose-item" onclick="markTaken('${dose.medId}', '${dose.timeStr}')">
          <div class="dose-info">
            <strong>${dose.name}</strong>
            <span>${dose.dosage} @ ${dose.time}</span>
          </div>
          <div class="dose-actions">
            <button class="icon-btn" onclick="event.stopPropagation(); snoozeDose('${dose.medId}', '${dose.timeStr}')">⏰</button>
          </div>
        </li>
      `;
    });
    html += `</ul>`;
  }
  
  // Add Med Button Floating Action Button
  html += `<button class="fab" onclick="showModal('add-med')">+</button>`;
  
  main.innerHTML = html;
}

// --- Actions ---

window.showModal = (type, data = null) => {
  const modal = document.getElementById('modal');
  let content = '';
  
  if (type === 'add-med') {
    content = `
      <form id="med-form" onsubmit="saveMed(event)">
        <h3>${t('meds.add_med')}</h3>
        <label>${t('meds.name')}</label>
        <input type="text" id="m-name" required placeholder="${t('meds.placeholder_name')}">
        
        <label>${t('meds.dosage')}</label>
        <input type="text" id="m-dosage" required placeholder="${t('meds.placeholder_dosage')}">
        
        <label>${t('meds.time')}</label>
        <input type="time" id="m-time" required value="08:00">
        
        <label>${t('meds.interval')}</label>
        <select id="m-interval">
          <option value="24">يومياً</option>
          <option value="12">كل 12 ساعة</option>
          <option value="8">كل 8 ساعات</option>
          <option value="6">كل 6 ساعات</option>
        </select>
        
        <label>${t('meds.notes')}</label>
        <textarea id="m-notes" placeholder="${t('meds.placeholder_notes')}"></textarea>
        
        <div class="modal-actions">
          <button type="button" class="btn ghost" onclick="closeModal()">إلغاء</button>
          <button type="submit" class="btn primary">${t('meds.save')}</button>
        </div>
      </form>
    `;
  } else if (type === 'settings') {
     content = `
       <h3>${t('settings.title')}</h3>
       <div class="setting-row">
         <span>${t('settings.language')}</span>
         <select onchange="changeLang(this.value)">
           <option value="ar" ${state.lang==='ar'?'selected':''}>العربية</option>
           <option value="en" ${state.lang==='en'?'selected':''}>English</option>
         </select>
       </div>
       <div class="setting-row">
         <span>${t('settings.theme')}</span>
         <select onchange="changeTheme(this.value)">
           <option value="light">${t('settings.theme_light')}</option>
           <option value="dark">${t('settings.theme_dark')}</option>
           <option value="system">${t('settings.theme_system')}</option>
         </select>
       </div>
       <button class="btn primary full-width" onclick="testNotification()">${t('settings.test_notification')}</button>
       <button class="btn ghost full-width" onclick="closeModal()">إغلاق</button>
     `;
  }

  modal.innerHTML = content;
  modal.showModal();
};

window.closeModal = () => {
  document.getElementById('modal').close();
};

window.saveMed = async (e) => {
  e.preventDefault();
  const name = document.getElementById('m-name').value;
  const dosage = document.getElementById('m-dosage').value;
  const time = document.getElementById('m-time').value;
  const interval = document.getElementById('m-interval').value;
  const notes = document.getElementById('m-notes').value;
  
  const newMed = {
    id: Date.now().toString(),
    name, dosage, time, interval, notes
  };
  
  state.medications.push(newMed);
  saveState();
  
  // Reschedule notifications
  if (isNative) await scheduleAllNotifications();
  
  closeModal();
  renderDashboard();
  showToast(t('messages.saved'));
};

window.markTaken = async (medId, timeStr) => {
  const med = state.medications.find(m => m.id === medId);
  if (!med) return;
  
  // Log it
  state.logs.push({
    date: new Date().toISOString(),
    medId,
    action: 'taken',
    timestamp: Date.now()
  });
  saveState();
  
  // Cancel specific notification for this time
  if (isNative) {
    const LNPlugin = LN();
    if(LNPlugin) {
        // Find ID roughly based on timeStr or just cancel all and reschedule to be safe/simple
        await LNPlugin.cancelAll();
        await scheduleAllNotifications();
    }
  }
  
  renderDashboard();
  showToast(`${t('dashboard.taken')}: ${med.name}`);
};

window.snoozeDose = async (medId, timeStr) => {
  // Simple snooze: add 15 mins
  const date = new Date(timeStr);
  date.setMinutes(date.getMinutes() + 15);
  
  const newTime = date.toTimeString().slice(0,5);
  const LNPlugin = LN();
  if(isNative && LNPlugin) {
      // Schedule a one-off local notification
      LNPlugin.scheduleNotification({
          id: Date.now(),
          title: t('messages.reminder_title'),
          body: `${t('dashboard.pending')} (+15 min)`,
          schedule: { at: date }
      });
  }
  showToast(t('messages.snoozed'));
};

window.changeLang = (lang) => {
  state.lang = lang;
  saveState();
  renderApp();
};

window.changeTheme = (theme) => {
  state.theme = theme;
  saveState();
  applyTheme();
};

window.testNotification = async () => {
  if (isNative) {
    const LNPlugin = LN();
    if (LNPlugin) {
        LNPlugin.scheduleNotification({
            id: Date.now(),
            title: t('settings.test_notification'),
            body: 'جربنا الشغل! 🚀',
            schedule: { at: new Date(Date.now() + 1000) }
        });
    }
  } else {
    alert(t('settings.test_notification') + ': ' + 'تم إرسال إشعار تجريبي');
  }
};

function updateTabBar() {
  const tabbar = document.getElementById('tabbar');
  tabbar.innerHTML = `
    <button class="tab active" onclick="renderDashboard()">${t('nav.today')}</button>
    <button class="tab" onclick="alert('${t('nav.calendar')} - قريباً')">📅</button>
    <button class="tab" onclick="showModal('settings')">${t('nav.settings')}</button>
  `;
}

function showToast(msg) {
  const wrap = document.getElementById('toast-wrap');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  wrap.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  renderApp();
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'system') applyTheme();
  });
});