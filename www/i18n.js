/* i18n — ترجمة الواجهة (عربي / إنجليزي) */

const STRINGS = {
  ar: {
    app: { name: 'تذكير العلاج', tagline: 'ما تنساش جرعتك', patient: 'المريض' },
    nav: { today: 'اليوم', meds: 'الأدوية', appts: 'المواعيد', stats: 'الالتزام', settings: 'الإعدادات' },
    common: {
      save: 'حفظ', cancel: 'إلغاء', delete: 'حذف', edit: 'تعديل', close: 'إغلاق', ok: 'حسنًا',
      add: 'إضافة', yes: 'نعم', no: 'لا', today: 'اليوم', tomorrow: 'غدًا', yesterday: 'أمس',
      day: 'يوم', days: 'أيام', hour: 'ساعة', hours: 'ساعات', minute: 'دقيقة', minutes: 'دقائق',
      none: 'لا يوجد', optional: 'اختياري', all: 'الكل', from: 'من', to: 'إلى', back: 'رجوع'
    },
    today: {
      title: 'اليوم', greeting: 'أهلاً', nextDose: 'الجرعة القادمة', nextAppt: 'الموعد القادم',
      progress: 'إنجاز اليوم', taken: 'أُخذت', missed: 'فاتت', pending: 'قادمة', skipped: 'متخطاة',
      noDoses: 'لا توجد جرعات اليوم', noDosesHint: 'أضف دواءًا لتبدأ استقبال التذكيرات.',
      addMed: 'إضافة دواء', markAll: 'تعليم الكل كمأخوذ', undo: 'تراجع',
      apptsToday: 'مواعيد اليوم', noApptsToday: 'لا مواعيد اليوم', noApptsHint: 'استمتع بيومك 😊',
      streak: 'أيام متواصلة', upcoming: 'جدول اليوم', actionTake: 'أخذتها', actionSkip: 'تخطّيت',
      actionUndo: 'تراجع', allDone: 'كل الجرعات اتأخذت — أحسنت! 🎉', tookToday: 'أُخذت اليوم',
      dosesTaken: 'أُخذت {n} من {m} جرعة',
      in: 'بعد', at: 'في', everyDay: 'يوميًا', since: 'منذ'
    },
    meds: {
      title: 'الأدوية', add: 'إضافة دواء', empty: 'لا توجد أدوية بعد',
      emptyHint: 'ابدأ بإضافة أول دواء وأوقات صرفه لتذكيرك يوميًا.',
      nameAr: 'الاسم بالعربية', nameEn: 'الاسم بالإنجليزية',
      nameArPh: 'مثال: أموكسيسيلين', nameEnPh: 'Example: Amoxicillin',
      dose: 'الجرعة', dosePh: 'مثال: 500', unit: 'ملجم', form: 'الشكل الدوائي',
      formPh: 'مثال: كبسولة / قرص', times: 'أوقات التذكير', addTime: 'إضافة وقت',
      startDate: 'تاريخ البداية', endDate: 'تاريخ النهاية', notes: 'ملاحظات',
      notesPh: 'مثال: بعد الأكل، مع كوب ماء كامل', color: 'اللون', daily: 'جرعات/يوم',
      forms: { tablet: 'قرص', capsule: 'كبسولة', injection: 'حقن', syrup: 'شراب', drops: 'قطرة', cream: 'كريم', inhaler: 'بخاخ', suppository: 'لبوس', other: 'أخرى' },
      active: 'نشط', paused: 'موقوف مؤقتًا', pause: 'إيقاف مؤقت', resume: 'تفعيل',
      deleteConfirm: 'متأكد من حذف «{name}»؟ سيتم حذف سجلات الالتزام المرتبطة به.',
      timesHint: 'اختر كل وقت تحتاج فيه تذكيرًا لهذا الدواء.', important: 'تعليمات مهمة',
      noTimes: 'أضف وقتًا واحدًا على الأقل', medName: 'اسم الدواء'
    },
    appts: {
      title: 'المواعيد', add: 'إضافة موعد', empty: 'لا مواعيد مسجلة',
      emptyHint: 'سجّل مواعيد المتابعة ليصلك تنبيه قبل الموعد.',
      titleAr: 'الوصف بالعربية', titleEn: 'الوصف بالإنجليزية',
      titleArPh: 'مثال: كشف متابعة', titleEnPh: 'Example: Follow-up visit',
      doctor: 'الطبيب', clinic: 'المكان', date: 'التاريخ', time: 'الوقت',
      remindBefore: 'التذكير قبل الموعد', notes: 'ملاحظات', notesPh: 'مثال: اجلب تحاليلك',
      upcoming: 'المواعيد القادمة', past: 'المواعيد السابقة', markDone: 'تم الحضور',
      markMissed: 'لم يحضر', cancelAppt: 'إلغاء', export: 'تصدير المواعيد للتقويم',
      days: 'يوم', hours: 'ساعة', minutes: 'دقيقة', done: 'تمت الزيارة',
      deleteConfirm: 'سيتم حذف هذا الموعد نهائيًا.'
    },
    stats: {
      title: 'الالتزام', overall30: 'الالتزام خلال 30 يومًا', week: 'آخر 7 أيام',
      byMed: 'الالتزام حسب الدواء', heatmap: 'خريطة الالتزام — 12 أسبوعًا',
      taken: 'أُخذت', missed: 'فاتت', skipped: 'متخطاة', expected: 'المتوقع',
      streak: 'أيام متواصلة', perfectDays: 'أيام كاملة', noData: 'لا توجد بيانات كافية بعد',
      last7: 'آخر 7 أيام', last30: 'آخر 30 يومًا', noMeds: 'أضف دواءًا لعرض الإحصاء',
      daily: 'التزام يومي', doseCount: 'جرعة'
    },
    settings: {
      title: 'الإعدادات', language: 'اللغة', arabic: 'العربية', english: 'English',
      patientName: 'اسم المريض', patientNamePh: 'اكتب اسمك (اختياري)',
      notifications: 'الإشعارات', enableNotif: 'تفعيل إشعارات التذكير',
      theme: 'المظهر', themeAuto: 'تلقائي', themeLight: 'فاتح', themeDark: 'داكن', themeHint: 'حسب إعدادات الهاتف',
      notifBlocked: 'الإشعارات محظورة — فعّلها من إعدادات المتصفح لهذا الموقع.',
      notifUnsupported: 'المتصفح لا يدعم الإشعارات', testNotification: 'اختبار إشعار',
      testNotificationBody: 'هذا إشعار تجريبي من تذكير العلاج', testNotificationSent: 'تم إرسال الإشعار التجريبي',
      testSound: 'اختبار الصوت', testSoundPlayed: 'تم تشغيل الصوت العالي', sound: 'صوت التنبيه',
      dailySummary: 'ملخص يومي', dailySummaryHint: 'وقت إرسال ملخص اليوم',
      snooze: 'مدة التأجيل', snoozeHint: 'مدة تأجيل التنبيه عند الضغط على «تأجيل»',
      grace: 'مهلة تأجيل الاعتماد', graceHint: 'بعد هذا الوقت تُسجَّل الجرعة كـ«فاتت»',
      data: 'البيانات', exportJson: 'تصدير نسخة احتياطية', importJson: 'استيراد نسخة احتياطية',
      install: 'تثبيت التطبيق على الهاتف', installed: 'التطبيق مثبّت بالفعل',
      exportIcs: 'تصدير المواعيد والأدوية للتقويم', reset: 'حذف كل البيانات',
      resetConfirm: 'متأكد من حذف كل البيانات؟ لا يمكن التراجع عن هذه الخطوة.',
      about: 'عن التطبيق', version: 'الإصدار', privacy: 'كل البيانات محفوظة على جهازك فقط ولا تُرسل لأي خادم.',
      exportHint: 'صدّر مواعيدك وأوقات أدويتك إلى تقويم هاتفك ليصلك تنبيه حتى لو التطبيق مغلق.'
    },
    notif: {
      doseTitle: 'وقت الجرعة',
      apptTitle: 'تذكير بموعد',
      summaryTitle: 'ملخص اليوم',
      remaining: 'جرعات متبقية اليوم',
      takenAction: 'أخذتها',
      snoozeAction: 'تأجيل',
      snoozed: 'تم تأجيل التنبيه',
      summaryGeneric: 'راجع جرعات اليوم'
    },
    native: {
      exactTitle: 'تنبيه في الوقت بالضبط',
      exactBody: 'ليصلك تنبيه الجرعة في دقيقتها بالضبط حتى والهاتف في وضع السكون، فعّل إذن «المنبّهات والتذكيرات» للتطبيق في الشاشة التالية.',
      exactOk: 'فتح الإعدادات',
      exactWarn: 'التنبيهات قد تتأخر بضع دقائق. فعّل إذن «المنبّهات والتذكيرات» للتنبيه في الوقت بالضبط.',
      exactBtn: 'تفعيل',
      batteryTitle: 'السماح بالعمل في الخلفية',
      batteryBody: 'عشان يوصلك تنبيه الجرعة والشاشة مقفولة، لازم تستثني التطبيق من توفير البطارية. اضغط «فتح» ثم «سماح» في الشاشة التالية.',
      batteryOk: 'فتح',
      reliabilityTitle: 'ضمان وصول التنبيهات',
      batteryRow: 'استثناء البطارية',
      batteryGood: 'مفعّل ✓ — التنبيهات تصل والشاشة مقفلة',
      batteryBad: 'غير مفعّل — قد لا تصل التنبيهات والشاشة مقفلة',
      batteryFix: 'تفعيل',
      recheck: 'تحقق',
      notifSettings: 'إعدادات الإشعارات',
      appDetails: 'إعدادات التطبيق',
      takenBtn: 'أخذتها',
      snoozeBtn: 'تأجيل',
      skipBtn: 'تخطي هذه الجرعة',
      slideLabel: 'اسحب لإيقاف الصوت (سيعود التنبيه إن لم تؤكد)',
      moreLabel: 'جرعات أخرى',
      minShort: 'د',
      testAlarmStarted: 'سيرنّ المنبّه بعد 5 ثوانٍ — اقفل الشاشة الآن',
      alarmMode: 'وضع المنبّه',
      alarmModeHint: 'تنور الشاشة ويرنّ التنبيه ويتكرر حتى تؤكد الجرعة',
      repeatEvery: 'التكرار كل',
      repeatCount: 'عدد مرات التكرار',
      repeatNone: 'بدون تكرار',
      fullScreenRow: 'ظهور المنبّه فوق شاشة القفل',
      fullScreenGood: 'مسموح ✓',
      fullScreenBad: 'غير مسموح — فعّل «الإشعارات بملء الشاشة»',
      overlayTitle: 'ظهور شاشة المنبّه',
      overlayBody: 'لتظهر شاشة المنبّه وتضيء الشاشة تلقائيًا عند موعد الجرعة، فعّل «العرض فوق التطبيقات الأخرى» لهذا التطبيق في الشاشة التالية.',
      test2min: 'اختبار منبّه بعد دقيقتين',
      test2minStarted: 'سيرنّ المنبّه بعد دقيقتين — اقفل الشاشة واتركها',
      overlayRow: 'العرض فوق التطبيقات الأخرى',
      overlayGood: 'مسموح ✓ — شاشة المنبّه تظهر تلقائيًا',
      overlayBad: 'غير مسموح — قد لا تظهر شاشة المنبّه مع القفل',
      diagBtn: 'فحص التنبيهات',
      diagTitle: 'فحص التنبيهات',
      diagLog: 'سجل الأحداث',
      diagShare: 'مشاركة التقرير',
      syncClockBtn: 'إضافة الأدوية إلى منبّه الساعة',
      openClockBtn: 'فتح منبّهات الساعة',
      syncClockTitle: 'إضافة إلى تطبيق الساعة',
      syncClockBody: 'ستُضاف مواعيد الأدوية كمنبّهات يومية في تطبيق الساعة الأصلي بهاتفك (أقوى ضمان للرنين). لا يمكن للتطبيق حذفها لاحقًا، وإن أضفتها مرتين ستتكرر، فاحذف القديمة من تطبيق الساعة. عدد المواعيد:',
      syncClockOk: 'إضافة',
      syncClockDone: 'تمت إضافة المنبّهات',
      syncClockNone: 'لا توجد مواعيد أدوية'
    },
    sound: {
      title: 'نغمة التنبيه والاهتزاز',
      appTone: 'نغمة التنبيه داخل التطبيق',
      appToneHint: 'تعمل مع التطبيق مفتوحًا أو في الخلفية',
      phoneTone: 'نغمة إشعارات الهاتف',
      phoneToneHint: 'لتغيير نغمة الإشعارات وأنت مشغول في تطبيق تاني، غيّرها من إعدادات الهاتف — الخطوات موجودة تحت.',
      phoneSteps: 'خطوات اختيار نغمة الهاتف',
      phoneStepsTitle: 'اختر نغمة من نغمات هاتفك',
      phoneStepsOpen: 'فتح إعدادات الإشعارات',
      phoneStepsCopy: 'نسخ الخطوات',
      phoneStepsCopied: 'تم نسخ الخطوات',
      custom: 'نغمة من ملفاتك',
      customPick: 'اختر ملفًا صوتيًا',
      toneSystem: 'نغمة من الهاتف',
      systemPick: 'نغمات الهاتف',
      systemDefault: 'النغمة الافتراضية للنظام',
      systemBtn: 'اختيار نغمة',
      systemHint: 'تظهر هنا كل نغمات الإشعارات والمنبّهات والرنات الموجودة على هاتفك. شدة الصوت تتبع مستوى صوت المنبّه.',
      customNone: 'لا يوجد ملف مخصّص',
      customTooBig: 'الملف كبير — اختار ملفًا أصغر من 1.5 ميجابايت',
      volume: 'مستوى الصوت',
      vibration: 'الاهتزاز',
      vibNone: 'بدون اهتزاز', vibLight: 'خفيف', vibMedium: 'متوسط',
      vibDouble: 'مزدوج', vibHeartbeat: 'نبض قلب', vibStrong: 'قوي',
      preview: 'تجربة',
      selected: 'مُفعّلة',
      toneNone: 'صامت', toneBeep: 'نبضة قصيرة', toneBell: 'جرس',
      toneChime: 'ثلاث نغمات', toneMarimba: 'ملمبة', toneDigital: 'تنبيه رقمي',
      toneUrgent: 'تنبيه عاجل', toneSoft: 'هادئ', toneCustom: 'ملف مخصّص',
      soundOn: 'تم تشغيل النغمة'
    },
    toast: {
      saved: 'تم الحفظ', deleted: 'تم الحذف', notifOn: 'تم تفعيل الإشعارات',
      notifOff: 'الإشعارات متوقفة', exported: 'تم التصدير بنجاح', imported: 'تم الاستيراد بنجاح',
      lang: 'تم تغيير اللغة', installed: 'تم تثبيت التطبيق', error: 'حدث خطأ، حاول مرة أخرى',
      importFailed: 'الملف غير صالح', copied: 'تم النسخ'
    },
    onb: {
      title: 'أهلاً بك 👋', subtitle: 'نساعدك تاخد جرعتك في ميعادها كل يوم.',
      name: 'اسمك (اختياري)', notif: 'فعّل الإشعارات', notifDesc: 'بنذكّرك في الوقت المحدد لكل جرعة.',
      start: 'ابدأ', later: 'لاحقًا'
    }
  },

  en: {
    app: { name: 'Treatment Reminder', tagline: 'Never miss a dose', patient: 'Patient' },
    nav: { today: 'Today', meds: 'Medicines', appts: 'Appointments', stats: 'Adherence', settings: 'Settings' },
    common: {
      save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', close: 'Close', ok: 'OK',
      add: 'Add', yes: 'Yes', no: 'No', today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday',
      day: 'day', days: 'days', hour: 'hour', hours: 'hours', minute: 'minute', minutes: 'minutes',
      none: 'None', optional: 'optional', all: 'All', from: 'From', to: 'To', back: 'Back'
    },
    today: {
      title: 'Today', greeting: 'Hello', nextDose: 'Next dose', nextAppt: 'Next appointment',
      progress: "Today's progress", taken: 'Taken', missed: 'Missed', pending: 'Upcoming', skipped: 'Skipped',
      noDoses: 'No doses scheduled today', noDosesHint: 'Add a medicine to start getting reminders.',
      addMed: 'Add medicine', markAll: 'Mark all as taken', undo: 'Undo',
      apptsToday: "Today's appointments", noApptsToday: 'No appointments today', noApptsHint: 'Enjoy your day 😊',
      streak: 'Day streak', upcoming: "Today's schedule", actionTake: 'Taken', actionSkip: 'Skip',
      actionUndo: 'Undo', allDone: 'All doses taken — great job! 🎉', tookToday: 'Taken today',
      dosesTaken: '{n} of {m} doses taken',
      in: 'in', at: 'at', everyDay: 'daily', since: 'since'
    },
    meds: {
      title: 'Medicines', add: 'Add medicine', empty: 'No medicines yet',
      emptyHint: 'Add your first medicine and its times to get daily reminders.',
      nameAr: 'Name (Arabic)', nameEn: 'Name (English)',
      nameArPh: 'e.g. Amoxicillin', nameEnPh: 'e.g. Amoxicillin',
      dose: 'Dose', dosePh: 'e.g. 500', unit: 'mg', form: 'Form',
      formPh: 'e.g. Capsule / Tablet', times: 'Reminder times', addTime: 'Add time',
      startDate: 'Start date', endDate: 'End date', notes: 'Notes',
      notesPh: 'e.g. Take after meals with a full glass of water', color: 'Colour', daily: 'doses/day',
      forms: { tablet: 'Tablet', capsule: 'Capsule', injection: 'Injection', syrup: 'Syrup', drops: 'Drops', cream: 'Cream', inhaler: 'Inhaler', suppository: 'Suppository', other: 'Other' },
      active: 'Active', paused: 'Paused', pause: 'Pause', resume: 'Resume',
      deleteConfirm: 'Delete “{name}”? Its adherence records will be removed too.',
      timesHint: 'Pick every time you need a reminder for this medicine.', important: 'Important instructions',
      noTimes: 'Add at least one time', medName: 'Medicine name'
    },
    appts: {
      title: 'Appointments', add: 'Add appointment', empty: 'No appointments',
      emptyHint: 'Save your follow-up visits to get reminded before them.',
      titleAr: 'Description (Arabic)', titleEn: 'Description (English)',
      titleArPh: 'e.g. Follow-up visit', titleEnPh: 'e.g. Follow-up visit',
      doctor: 'Doctor', clinic: 'Clinic', date: 'Date', time: 'Time',
      remindBefore: 'Remind me before', notes: 'Notes', notesPh: 'e.g. Bring your lab results',
      upcoming: 'Upcoming', past: 'Past', markDone: 'Attended',
      markMissed: 'Missed', cancelAppt: 'Cancel', export: 'Export to calendar',
      days: 'day', hours: 'hour', minutes: 'minute', done: 'Visit completed',
      deleteConfirm: 'This appointment will be permanently deleted.'
    },
    stats: {
      title: 'Adherence', overall30: 'Adherence over 30 days', week: 'Last 7 days',
      byMed: 'Adherence by medicine', heatmap: 'Adherence map — 12 weeks',
      taken: 'Taken', missed: 'Missed', skipped: 'Skipped', expected: 'Expected',
      streak: 'Day streak', perfectDays: 'Perfect days', noData: 'Not enough data yet',
      last7: 'Last 7 days', last30: 'Last 30 days', noMeds: 'Add a medicine to see statistics',
      daily: 'Daily adherence', doseCount: 'doses'
    },
    settings: {
      title: 'Settings', language: 'Language', arabic: 'العربية', english: 'English',
      patientName: "Patient's name", patientNamePh: "Enter your name (optional)",
      notifications: 'Notifications', enableNotif: 'Enable reminder notifications',
      theme: 'Appearance', themeAuto: 'Auto', themeLight: 'Light', themeDark: 'Dark', themeHint: 'Follows your phone setting',
      notifBlocked: 'Notifications are blocked — allow them in your browser settings for this site.',
      notifUnsupported: 'This browser does not support notifications', testNotification: 'Test notification',
      testNotificationBody: 'This is a test notification from Treatment Reminder', testNotificationSent: 'Test notification sent',
      testSound: 'Test sound', testSoundPlayed: 'Loud test sound played', sound: 'Alert sound',
      dailySummary: 'Daily summary', dailySummaryHint: 'Time to receive the day summary',
      snooze: 'Snooze duration', snoozeHint: 'How long to delay a reminder when you snooze it',
      grace: 'Adherence grace period', graceHint: 'After this, a dose is recorded as missed',
      data: 'Data', exportJson: 'Export backup', importJson: 'Import backup',
      install: 'Install app on phone', installed: 'App is already installed',
      exportIcs: 'Export appointments & medicines to calendar', reset: 'Delete all data',
      resetConfirm: 'Delete all data? This cannot be undone.',
      about: 'About', version: 'Version', privacy: 'All data stays on your device — nothing is sent to any server.',
      exportHint: 'Export your appointments and medicine times to your phone calendar so you get reminders even when the app is closed.'
    },
    notif: {
      doseTitle: 'Dose time',
      apptTitle: 'Appointment reminder',
      summaryTitle: "Today's summary",
      remaining: 'doses left today',
      takenAction: 'Taken',
      snoozeAction: 'Snooze',
      snoozed: 'Reminder snoozed',
      summaryGeneric: "Review today's doses"
    },
    native: {
      exactTitle: 'Alerts right on time',
      exactBody: 'To get each dose alert at the exact minute even in sleep mode, allow the "Alarms & reminders" permission for this app on the next screen.',
      exactOk: 'Open settings',
      exactWarn: 'Alerts may be a few minutes late. Allow "Alarms & reminders" for exact timing.',
      exactBtn: 'Enable',
      batteryTitle: 'Allow background activity',
      batteryBody: 'To receive dose alerts while the screen is off, exempt the app from battery optimization. Tap Open, then Allow on the next screen.',
      batteryOk: 'Open',
      reliabilityTitle: 'Alert reliability',
      batteryRow: 'Battery exemption',
      batteryGood: 'On ✓ — alerts arrive with the screen off',
      batteryBad: 'Off — alerts may not arrive with the screen off',
      batteryFix: 'Enable',
      recheck: 'Check',
      notifSettings: 'Notification settings',
      appDetails: 'App settings',
      takenBtn: 'Taken',
      snoozeBtn: 'Snooze',
      skipBtn: 'Skip this dose',
      slideLabel: 'Slide to silence (it will ring again unless you confirm)',
      moreLabel: 'more doses',
      minShort: 'min',
      testAlarmStarted: 'The alarm will ring in 5 seconds — lock the screen now',
      alarmMode: 'Alarm mode',
      alarmModeHint: 'Screen turns on and rings, repeating until you confirm the dose',
      repeatEvery: 'Repeat every',
      repeatCount: 'Number of repeats',
      repeatNone: 'No repeat',
      fullScreenRow: 'Show alarm over lock screen',
      fullScreenGood: 'Allowed ✓',
      fullScreenBad: 'Not allowed — enable full-screen notifications',
      overlayTitle: 'Alarm screen',
      overlayBody: 'So the alarm screen can light up the display at dose time, enable "Display over other apps" for this app on the next screen.',
      test2min: 'Test alarm in 2 minutes',
      test2minStarted: 'The alarm will ring in 2 minutes — lock the screen and leave it',
      overlayRow: 'Display over other apps',
      overlayGood: 'Allowed ✓ — alarm screen opens automatically',
      overlayBad: 'Not allowed — the alarm screen may not appear over the lock screen',
      diagBtn: 'Check alerts',
      diagTitle: 'Alert check',
      diagLog: 'Event log',
      diagShare: 'Share report',
      syncClockBtn: 'Add meds to the Clock app alarms',
      openClockBtn: 'Open Clock alarms',
      syncClockTitle: 'Add to the Clock app',
      syncClockBody: 'Medication times will be added as daily alarms in your phone\'s built-in Clock app (strongest ringing guarantee). The app cannot delete them later, and adding twice duplicates them, so remove old ones in the Clock app. Times:',
      syncClockOk: 'Add',
      syncClockDone: 'Alarms added',
      syncClockNone: 'No medication times'
    },
    sound: {
      title: 'Alert tone & vibration',
      appTone: 'In-app alert tone',
      appToneHint: 'Plays while the app is open or in the background',
      phoneTone: 'Phone notification sound',
      phoneToneHint: 'To change the sound when the app is closed, set it from your phone settings — the steps are below.',
      phoneSteps: 'How to use your phone ringtones',
      phoneStepsTitle: 'Pick a sound from your phone',
      phoneStepsOpen: 'Open notification settings',
      phoneStepsCopy: 'Copy steps',
      phoneStepsCopied: 'Steps copied',
      custom: 'Your own sound file',
      customPick: 'Choose an audio file',
      toneSystem: 'Phone ringtone',
      systemPick: 'Phone ringtones',
      systemDefault: 'System default sound',
      systemBtn: 'Choose',
      systemHint: 'Lists all notification, alarm and ringtone sounds on your phone. Volume follows the alarm volume.',
      customNone: 'No custom file',
      customTooBig: 'File too large — pick one under 1.5 MB',
      volume: 'Volume',
      vibration: 'Vibration',
      vibNone: 'No vibration', vibLight: 'Light', vibMedium: 'Medium',
      vibDouble: 'Double', vibHeartbeat: 'Heartbeat', vibStrong: 'Strong',
      preview: 'Preview',
      selected: 'Active',
      toneNone: 'Silent', toneBeep: 'Short beep', toneBell: 'Bell',
      toneChime: 'Three notes', toneMarimba: 'Marimba', toneDigital: 'Digital alert',
      toneUrgent: 'Urgent alert', toneSoft: 'Soft', toneCustom: 'Custom file',
      soundOn: 'Tone played'
    },
    toast: {
      saved: 'Saved', deleted: 'Deleted', notifOn: 'Notifications enabled',
      notifOff: 'Notifications are off', exported: 'Exported successfully', imported: 'Imported successfully',
      lang: 'Language changed', installed: 'App installed', error: 'Something went wrong, try again',
      importFailed: 'Invalid file', copied: 'Copied'
    },
    onb: {
      title: 'Welcome 👋', subtitle: 'We help you take every dose on time, every day.',
      name: 'Your name (optional)', notif: 'Enable notifications', notifDesc: 'We will remind you at the right time for each dose.',
      start: 'Get started', later: 'Later'
    }
  }
};

let currentLang = 'ar';

function getLang() { return currentLang; }

function setLang(lang) {
  currentLang = STRINGS[lang] ? lang : 'ar';
  try { localStorage.setItem('tr.lang', currentLang); } catch (e) { /* storage unavailable */ }
  applyLangToDocument();
  return currentLang;
}

function applyLangToDocument() {
  const html = document.documentElement;
  html.lang = currentLang;
  html.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  const title = currentLang === 'ar' ? STRINGS.ar.app.name : STRINGS.en.app.name;
  document.title = title;
}

/** ترجمة بمسار نقطي: t('today.nextDose') */
function t(path, vars) {
  const parts = String(path).split('.');
  let node = STRINGS[currentLang];
  for (const p of parts) {
    if (node == null) return path;
    node = node[p];
  }
  if (typeof node !== 'string') return path;
  if (vars) {
    Object.keys(vars).forEach((k) => { node = node.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]); });
  }
  return node;
}

/** اسم الحقل حسب اللغة الحالية (ar/en) */
function pick(obj, lang) {
  if (!obj) return '';
  return (obj[lang] || obj.ar || obj.en || '').trim();
}

export { STRINGS, t, setLang, getLang, applyLangToDocument, pick };
