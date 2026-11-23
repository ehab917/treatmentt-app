"""اختبار وضع المنبّه الأصلي بمحاكاة Capacitor داخل Chromium."""
import json
from playwright.sync_api import sync_playwright

MOCK = open(__file__.replace('test_alarm.py', 'test_native.py')).read().split('MOCK = r"""')[1].split('"""')[0]

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
      S.updateSettings({ onboarded: true, tone: 'system', sysToneUri: 'content://media/internal/audio/media/42', sysToneName: 'X', vibration: 'medium', dailySummary: '20:00', repeatMin: 3, repeatMax: 4 });
      S.addMed({ nameAr: 'دواء', dose: '1', times: ['08:00','14:00','21:00'], startDate: S.todayISO() });
    }""")
    page.wait_for_timeout(1800)
    r = page.evaluate("""() => { const c = window.__calls; return {
        alarms: c.alarms ? c.alarms.alarms.length : -1,
        first: c.alarms ? c.alarms.alarms[0] : null,
        cfg: c.alarms ? c.alarms.config : null,
        doseInLN: window.__pending().filter(n => n.extra && n.extra.type === 'dose').length,
        others: [...new Set(window.__pending().map(n => n.extra && n.extra.type))] } }""")
    print('ALARMS', r['alarms'], '| doses left in LN:', r['doseInLN'], '| LN types:', r['others'])
    print('FIRST', json.dumps(r['first'], ensure_ascii=False))
    print('CONFIG', json.dumps(r['cfg'], ensure_ascii=False))
    # result from alarm screen -> dose marked taken, then excluded from alarms
    res = page.evaluate("""async () => {
      const a = window.__calls.alarms.alarms[0];
      window.__calls.results = [{ key: a.key, date: a.date, medId: a.medId, time: a.time, status: 'taken' }];
      window.dispatchEvent(new Event('focus'));
      await new Promise(r => setTimeout(r, 5200));
      const st = window.__tr.store.doseStatus(a.date, a.medId, a.time);
      const done = window.__calls.alarms.doneKeys.includes(a.key);
      const still = window.__calls.alarms.alarms.some(x => x.key === a.key);
      return { st, done, still };
    }""")
    print('RESULT APPLIED', res)
    # test alarm
    page.evaluate("() => { const d=document.querySelector('#modal'); if (d.open) d.close(); }")
    page.click('[data-nav="settings"]'); page.wait_for_timeout(300)
    print('alarm settings controls:', page.evaluate("() => ['opt-alarm-mode','opt-repeat-min','opt-repeat-max'].map(i => !!document.getElementById(i))"))
    page.click('[data-act="test-notification"]'); page.wait_for_timeout(800)
    print('TEST ALARM called:', page.evaluate("() => !!window.__calls.testAlarm && window.__calls.testAlarm.delaySec"))
    # diagnostics modal
    page.evaluate("() => { const d=document.querySelector('#modal'); if (d.open) d.close(); }")
    page.click('[data-act="native-diagnose"]'); page.wait_for_timeout(600)
    print('diag modal rows:', page.evaluate("() => document.querySelectorAll('#modal .modal-body > div > div').length"), '| has log:', page.evaluate("() => document.querySelector('#modal pre').textContent.includes('armNext')"))
    page.evaluate("() => { const d=document.querySelector('#modal'); if (d.open) d.close(); }")
    # overlay row + button
    print('overlay fix button shown:', page.evaluate("() => !!document.querySelector('[data-act=native-overlay]')"))
    # sync to system clock
    page.evaluate("() => { const d=document.querySelector('#modal'); if (d.open) d.close(); }")
    page.click('[data-act="native-sync-clock"]'); page.wait_for_timeout(400)
    page.click('[data-act="confirm-yes"]'); page.wait_for_timeout(5200)
    print('system alarms created:', page.evaluate("() => (window.__calls.sysAlarms||[]).map(a => a.hour+':'+a.minute+' '+a.label+' daily='+a.daily)"), '| opened clock:', page.evaluate("() => !!window.__calls.openedClock"))
    # alarm mode off -> LN notifications return for doses
    page.evaluate("() => window.__tr.store.updateSettings({ alarmMode: false })")
    page.wait_for_timeout(1500)
    print('doses in LN after alarmMode off:', page.evaluate("() => window.__pending().filter(n => n.extra && n.extra.type === 'dose').length"))
    # notify off -> alarms cancelled
    page.evaluate("() => window.__tr.store.updateSettings({ notify: false })")
    page.wait_for_timeout(1500)
    print('alarms cancelled on notify off:', page.evaluate("() => !!window.__calls.alarmsCancelled"))
    b.close()
print('ERRORS', errors)
