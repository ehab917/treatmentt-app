import json, sys
from playwright.sync_api import sync_playwright

MOCK = r"""
(() => {
  const calls = { schedule: [], cancel: [], channels: [], actions: [], share: [], writes: [] };
  const listeners = {};
  let pending = [];
  const LN = {
    checkPermissions: async () => ({ display: 'granted' }),
    requestPermissions: async () => ({ display: 'granted' }),
    checkExactNotificationSetting: async () => ({ exact_alarm: 'granted' }),
    changeExactNotificationSetting: async () => ({ exact_alarm: 'granted' }),
    getPending: async () => ({ notifications: pending.map(n => ({ id: n.id })) }),
    cancel: async (o) => { calls.cancel.push(o); pending = pending.filter(p => !o.notifications.some(n => n.id === p.id)); },
    registerActionTypes: async (o) => { calls.actions.push(o); },
    createChannel: async (c) => { calls.channels.push(c); },
    schedule: async (o) => { calls.schedule.push(o); pending.push(...o.notifications); },
    removeDeliveredNotifications: async () => {},
    addListener: async (n, fn) => { listeners[n] = fn; return { remove() {} }; }
  };
  const APP = { addListener: async (n, fn) => { listeners['app:' + n] = fn; return { remove() {} }; }, exitApp: async () => { calls.exited = true; } };
  const FS = { writeFile: async (o) => { calls.writes.push(o); return { uri: 'file:///cache/' + o.path }; } };
  const SH = { share: async (o) => { calls.share.push(o); } };
  window.Capacitor = { isNativePlatform: () => true, Plugins: { LocalNotifications: LN, App: APP, Filesystem: FS, Share: SH } };
  window.__calls = calls; window.__listeners = listeners; window.__pending = () => pending;
})();
"""

errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 800})
    ctx.add_init_script(MOCK)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto('http://localhost:8777/index.html')
    page.wait_for_timeout(1200)
    # skip onboarding, add med via store
    page.evaluate("""() => {
      const S = window.__tr.store;
      S.updateSettings({ onboarded: true, tone: 'bell', vibration: 'medium', dailySummary: '20:00' });
      S.addMed({ nameAr: 'دواء تجريبي', dose: '1', times: ['08:00','14:00','21:00'], startDate: S.todayISO() });
    }""")
    page.wait_for_timeout(1500)
    r = page.evaluate("""() => ({ n: window.__pending().length, ch: window.__calls.channels.map(c=>c.id+'|'+(c.sound||'-')+'|'+c.importance),
       first: window.__pending().slice(0,2).map(n=>({id:n.id,title:n.title,body:n.body,at:new Date(n.schedule.at).toISOString(),ch:n.channelId,extra:n.extra})), actions: window.__calls.actions.length,
       withAction: window.__pending().filter(n=>n.actionTypeId==='DOSE').length,
       allowIdle: window.__pending().every(n=>n.schedule.allowWhileIdle) })""")
    print('PENDING', r['n'], 'channels', r['ch'], 'dose-with-actions', r['withAction'], 'allowIdle', r['allowIdle'])
    print('FIRST', json.dumps(r['first'][0], ensure_ascii=False)[:300])
    # take a dose via notification action -> should reschedule without that dose
    ex = page.evaluate("""async () => {
      const first = window.__pending().find(n => n.extra && n.extra.type === 'dose');
      const x = first.extra;
      await window.__listeners['localNotificationActionPerformed']({ actionId: 'taken', notification: { id: first.id, extra: x } });
      await new Promise(r => setTimeout(r, 1500));
      const still = window.__pending().some(n => n.id === first.id);
      return { still, key: x.date + ' ' + x.time, status: window.__tr.store.doseStatus(x.date, x.medId, x.time) };
    }""")
    print('AFTER TAKEN', ex)
    # snooze
    sn = page.evaluate("""async () => {
      const f = window.__pending().find(n => n.extra && n.extra.type === 'dose');
      const x = f.extra; const before = window.__pending().length;
      await window.__listeners['localNotificationActionPerformed']({ actionId: 'snooze', notification: { id: f.id, extra: x } });
      await new Promise(r => setTimeout(r, 1500));
      const snz = window.__pending().filter(n => Math.abs(new Date(n.schedule.at).getTime() - Date.now() - 600000) < 20000);
      return { before, after: window.__pending().length, snoozeNotifs: snz.length };
    }""")
    print('SNOOZE', sn)
    # change tone -> channel changes
    page.evaluate("() => window.__tr.store.updateSettings({ tone: 'marimba' })")
    page.wait_for_timeout(1500)
    print('CHANNELS now', page.evaluate("() => window.__calls.channels.map(c=>c.id).filter((v,i,a)=>a.indexOf(v)===i)"))
    print('DOSE CH of pending', page.evaluate("() => [...new Set(window.__pending().map(n=>n.channelId))]"))
    # disable notify -> all cancelled
    page.evaluate("() => window.__tr.store.updateSettings({ notify: false })")
    page.wait_for_timeout(1500)
    print('PENDING after notify off', page.evaluate("() => window.__pending().length"))
    page.evaluate("() => window.__tr.store.updateSettings({ notify: true })")
    page.wait_for_timeout(1500)
    print('PENDING after notify on', page.evaluate("() => window.__pending().length"))
    # test notification button
    page.evaluate("() => { const d=document.querySelector('#modal'); if (d.open) d.close(); }")
    page.click('[data-nav="settings"]'); page.wait_for_timeout(300)
    page.click('[data-act="test-notification"]'); page.wait_for_timeout(800)
    print('TEST NOTIF pending has test id:', page.evaluate("() => window.__pending().some(n=>n.id===2147483000)"))
    # back button on settings -> goes to today; then exit
    page.evaluate("() => window.__listeners['app:backButton']()"); page.wait_for_timeout(200)
    print('screen after back:', page.evaluate("() => document.querySelector('.tab.active, [data-nav].active')?.dataset.nav"))
    page.screenshot(path='/tmp/native_settings.png')
    # export share
    page.click('[data-nav="settings"]'); page.wait_for_timeout(300)
    btns = page.evaluate("() => [...document.querySelectorAll('[data-act]')].map(b=>b.dataset.act)")
    print('ACTS', [a for a in btns if 'export' in a or 'backup' in a or 'ics' in a])
    b.close()
print('ERRORS', errors)
