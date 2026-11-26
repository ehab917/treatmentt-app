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

    # ---- 12-hour time everywhere
    page.click('[data-nav="meds"]'); page.wait_for_timeout(300)
    txt = page.evaluate("() => document.body.innerText")
    print('12h time shown (ص/م, no 14:00):', ('ص' in txt or 'م' in txt) and '14:00' not in txt and '08:00' not in txt)
    print('alarm timeLabel sent:', page.evaluate("() => window.__calls.alarms.alarms.slice(0,2).map(a => a.time + ' -> ' + a.timeLabel)"))
    page.evaluate("() => window.__tr.store.updateSettings({ timeFormat: '24' })"); page.wait_for_timeout(300)
    page.click('[data-nav="settings"]'); page.wait_for_timeout(200); page.click('[data-nav="meds"]'); page.wait_for_timeout(300)
    print('24h option works:', '14:00' in page.evaluate("() => document.body.innerText"))
    page.evaluate("() => window.__tr.store.updateSettings({ timeFormat: '12' })")

    # ---- medication photo: crop editor, then save with no name
    page.click('[data-act="add-med"]'); page.wait_for_timeout(400)
    page.set_input_files('#photo-input-gal-0', '/tmp/pill.jpg'); page.wait_for_timeout(900)
    print('crop editor opened:', page.evaluate("() => !document.getElementById('photo-editor-0').hidden"))
    # drag + zoom + rotate inside the editor
    box = page.query_selector('#pe-canvas-0').bounding_box()
    page.mouse.move(box['x'] + box['width']/2, box['y'] + box['height']/2)
    page.mouse.down(); page.mouse.move(box['x'] + box['width']/2 + 40, box['y'] + box['height']/2 + 10, steps=5); page.mouse.up()
    page.evaluate("() => { const z = document.getElementById('pe-zoom-0'); z.value = '1.8'; z.dispatchEvent(new Event('input', { bubbles: true })); }")
    page.click('[data-act="pe-rotate"]'); page.wait_for_timeout(200)
    page.click('[data-act="pe-done"]'); page.wait_for_timeout(500)
    print('editor closed & preview square image:', page.evaluate("() => { const im = document.querySelector('#photo-preview-0 img'); return document.getElementById('photo-editor-0').hidden && !!im; }"))
    page.evaluate("() => { const f = document.querySelector('#modal-form'); f.querySelector('[name=dose_0]').value = '1'; }")
    page.click('[data-act="save-med"]'); page.wait_for_timeout(900)
    r2 = page.evaluate("() => { const m = window.__tr.store.getState().meds.find(x => x.photo && !x.nameAr); return m ? { name: m.nameAr, photoKb: Math.round(m.photo.length / 1024), id: m.id } : null; }")
    print('med saved with photo & no name:', r2)
    print('thumbnail in list:', page.evaluate("() => !!document.querySelector('.med-card img.mc-photo')"))
    page.wait_for_timeout(1500)
    print('photo synced natively:', page.evaluate("() => window.__calls.photos ? Object.keys(window.__calls.photos.photos) : null"))

    # ---- add 3 medicines at the same time in ONE form
    before = page.evaluate("() => window.__tr.store.getState().meds.length")
    page.click('[data-act="add-med"]'); page.wait_for_timeout(400)
    page.click('[data-act="set-count"][data-n="3"]'); page.wait_for_timeout(200)
    print('blocks visible after choosing 3:', page.evaluate("() => [...document.querySelectorAll('.med-block')].filter(b => !b.hidden).length"),
          '| titles shown:', page.evaluate("() => getComputedStyle(document.querySelector('.mb-title')).display"))
    page.fill('[name=nameAr_0]', 'دواء س'); page.fill('[name=nameAr_1]', 'دواء ص')
    page.set_input_files('#photo-input-gal-2', '/tmp/pill.jpg'); page.wait_for_timeout(700)
    page.click('[data-act="pe-done"][data-idx="2"]'); page.wait_for_timeout(300)
    page.click('[data-act="save-med"]'); page.wait_for_timeout(900)
    after = page.evaluate("() => window.__tr.store.getState().meds.length")
    print('meds added in one go:', after - before)
    # same schedule -> grouped alarm contains all of them
    page.wait_for_timeout(1500)
    print('grouped alarm sizes:', page.evaluate("() => [...new Set(window.__calls.alarms.alarms.filter(a => a.time === '08:00').map(a => a.items.length))]"))
    # validation: block without name/photo is rejected
    page.click('[data-act="add-med"]'); page.wait_for_timeout(400)
    page.click('[data-act="set-count"][data-n="2"]'); page.fill('[name=nameAr_0]', 'فقط واحد')
    page.click('[data-act="save-med"]'); page.wait_for_timeout(400)
    print('rejects empty 2nd block:', page.evaluate("() => window.__tr.store.getState().meds.length") == after)
    page.evaluate("() => { const d=document.querySelector('#modal'); if (d.open) d.close(); }")

    # ---- phone ringtone list: preview stops on close
    page.click('[data-nav="settings"]'); page.wait_for_timeout(300)
    page.evaluate("() => { window.__calls.stops = 0; window.__calls.played = []; }")
    page.click('[data-act="pick-system-tone"]'); page.wait_for_timeout(500)
    print('ringtone rows:', page.evaluate("() => document.querySelectorAll('.rt-row').length"))
    page.click('.rt-row[data-title="Tone B"]'); page.wait_for_timeout(200)
    print('played on tap:', page.evaluate("() => window.__calls.played"))
    page.evaluate("() => document.querySelector('#modal').close()"); page.wait_for_timeout(300)
    print('stopped on close (stops >= 1):', page.evaluate("() => window.__calls.stops"))
    page.click('[data-act="pick-system-tone"]'); page.wait_for_timeout(400)
    page.click('.rt-row[data-title="Tone A"]'); page.click('[data-act="rt-save"]'); page.wait_for_timeout(500)
    print('saved ringtone:', page.evaluate("() => window.__tr.store.getState().settings.sysToneName + ' | ' + window.__tr.store.getState().settings.sysToneUri"))
    page.evaluate("() => { const d=document.querySelector('#modal'); if (d.open) d.close(); }")
    # auto-stop after 3s without closing
    page.evaluate("() => { window.__calls.stops = 0; }")
    page.click('[data-act="preview-tone"][data-tone="system"]'); page.wait_for_timeout(3500)
    print('auto-stop after 3s:', page.evaluate("() => window.__calls.stops"))

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
