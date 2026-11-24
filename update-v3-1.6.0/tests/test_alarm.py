"""اختبار وضع المنبّه الأصلي + دمج الأدوية + المخزون + حجم الخط بمحاكاة Capacitor داخل Chromium."""
import json
from playwright.sync_api import sync_playwright

MOCK = open(__file__.replace('test_alarm.py', 'test_native.py')).read().split('MOCK = r"""')[1].split('"""')[0]
CLOSE = "() => { const d=document.querySelector('#modal'); if (d.open) d.close(); }"

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
    page.evaluate("""() => {
      const S = window.__tr.store;
      S.updateSettings({ onboarded: true, sysToneUri: 'content://media/internal/audio/media/42', sysToneName: 'X', vibration: 'medium', dailySummary: '20:00', repeatMin: 3, repeatMax: 4 });
      S.addMed({ nameAr: 'دواء أ', dose: '1', times: ['08:00','14:00'], startDate: S.todayISO(), stock: 10, perDose: 1 });
      S.addMed({ nameAr: 'دواء ب', dose: '2', times: ['08:00'], startDate: S.todayISO() });
    }""")
    page.wait_for_timeout(1800)
    r = page.evaluate("""() => { const c = window.__calls; const al = c.alarms ? c.alarms.alarms : [];
      const g = al.find(a => a.items && a.items.length === 2);
      return { n: al.length, group: g ? { key: g.key, items: g.items.map(i => i.name), body: g.body } : null,
               cfg: c.alarms ? { uri: c.alarms.config.uri, silent: c.alarms.config.silent, pattern: c.alarms.config.pattern } : null,
               doseInLN: window.__pending().filter(n => n.extra && n.extra.type === 'dose').length } }""")
    print('ALARMS', r['n'], '| LN doses:', r['doseInLN'])
    print('GROUP (2 meds same time):', json.dumps(r['group'], ensure_ascii=False))
    print('CONFIG', r['cfg'])

    # partial result from alarm screen: only first med taken -> stock decreases, group pruned for that med
    res = page.evaluate("""async () => {
      const g = window.__calls.alarms.alarms.find(a => a.items && a.items.length === 2);
      const first = g.items[0];
      window.__calls.results = [{ key: 'dose:'+g.date+':'+first.medId+':'+g.time, date: g.date, medId: first.medId, time: g.time, status: 'taken' }];
      await new Promise(r => setTimeout(r, 5200));
      const st = window.__tr.store.doseStatus(g.date, first.medId, g.time);
      const med = window.__tr.store.getState().meds.find(m => m.id === first.medId);
      const done = window.__calls.alarms.doneKeys.includes('dose:'+g.date+':'+first.medId+':'+g.time);
      return { st, stockNow: med.stock, done };
    }""")
    print('RESULT APPLIED', res)

    # UI checks
    page.evaluate(CLOSE)
    page.click('[data-nav="settings"]'); page.wait_for_timeout(300)
    print('clock buttons removed:', page.evaluate("() => !document.querySelector('[data-act=native-sync-clock]') && !document.querySelector('[data-act=native-open-clock]')"))
    print('test buttons kept:', page.evaluate("() => ['test-notification','test-alert','native-test-2min','native-diagnose'].map(a => !!document.querySelector('[data-act='+a+']'))"))
    print('built-in tone list hidden:', page.evaluate("() => !document.querySelector('.tone-list') && !document.getElementById('opt-volume')"))
    print('phone ringtone picker:', page.evaluate("() => !!document.querySelector('[data-act=pick-system-tone]')"))
    page.click('[data-act="set-font"][data-size="large"]'); page.wait_for_timeout(300)
    print('font large --fs:', page.evaluate("() => getComputedStyle(document.documentElement).getPropertyValue('--fs') + ' / html px=' + getComputedStyle(document.documentElement).fontSize"))
    page.click('[data-act="set-font"][data-size="medium"]'); page.wait_for_timeout(200)

    # stock: low stock banner + refill
    page.evaluate("() => { const S = window.__tr.store; const m = S.getState().meds.find(x => x.nameAr === 'دواء أ'); S.updateMed(m.id, { stock: 3 }); }")
    page.wait_for_timeout(1500)
    page.click('[data-nav="today"]'); page.wait_for_timeout(300)
    print('low stock banner on Today:', page.evaluate("() => !!document.querySelector('.banner [data-act=refill-med]')"))
    print('stock notification scheduled:', page.evaluate("() => window.__pending().filter(n => n.extra && n.extra.type === 'stock').map(n => n.body)"))
    page.click('.banner [data-act="refill-med"]'); page.wait_for_timeout(300)
    page.fill('#modal input[name=qty]', '30'); page.click('[data-act="save-refill"]'); page.wait_for_timeout(500)
    print('after refill stock:', page.evaluate("() => window.__tr.store.getState().meds.find(x => x.nameAr === 'دواء أ').stock"),
          '| banner gone:', page.evaluate("() => !document.querySelector('.banner [data-act=refill-med]')"))
    print('stock notifs after refill:', page.evaluate("() => window.__pending().filter(n => n.extra && n.extra.type === 'stock').length"))

    # undo dose returns stock
    u = page.evaluate("""() => { const S = window.__tr.store; const m = S.getState().meds.find(x => x.nameAr === 'دواء أ'); const d = S.todayISO();
       const before = m.stock; S.setDoseStatus(d, m.id, '14:00', 'taken'); const mid = m.stock; S.setDoseStatus(d, m.id, '14:00', null); return [before, mid, m.stock]; }""")
    print('stock before/taken/undo:', u)

    # test alarm buttons
    page.click('[data-nav="settings"]'); page.wait_for_timeout(300)
    page.click('[data-act="native-test-2min"]'); page.wait_for_timeout(500)
    print('2-min test alarm:', page.evaluate("() => window.__calls.testAlarm && window.__calls.testAlarm.delaySec"))
    # notify off -> alarms cancelled
    page.evaluate("() => window.__tr.store.updateSettings({ notify: false })")
    page.wait_for_timeout(1500)
    print('alarms cancelled on notify off:', page.evaluate("() => !!window.__calls.alarmsCancelled"))
    page.screenshot(path='/tmp/settings_v16.png', full_page=True)
    b.close()
print('ERRORS', errors)
