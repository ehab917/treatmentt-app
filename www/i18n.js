/* i18n.js — الترجمة (دعم العربية - اللهجة المصرية) */

const LANGS = {
  ar: {
    dir: 'rtl',
    title: 'تذكير العلاج',
    tagline: 'خُذ دواك في وقته.. صحتك أمانة.',
    
    // القوائم الرئيسية
    nav: {
      today: 'اليوم',
      calendar: 'التقويم',
      history: 'التاريخ',
      settings: 'الإعدادات'
    },

    // الصفحة الرئيسية
    dashboard: {
      upcoming: 'الدواء الجاي',
      no_meds: 'مفيش أدوية مسجلة.. ابدأ رحلتك بالصحة!',
      add_first: 'أضف أول دواء دلوقتي',
      taken: 'أخدته ✅',
      pending: 'لسه متأخر ⏰',
      missed: 'فات ❌',
      next_dose: 'الدواء الجاي الساعة',
      dose_log: 'سجل الجرعات اليوم',
      empty_schedule: 'الجدول فاضي النهارده.. استمتع بوقتك!'
    },

    // إدارة الأدوية
    meds: {
      title: 'الأدوية بتاعتي',
      add_med: 'أضف دواء جديد',
      edit_med: 'تعديل الدواء',
      name: 'اسم الدواء',
      dosage: 'الجرعة (مثلاً: قرص واحد)',
      time: 'موعد الجرعة',
      interval: 'تكرار كل (بالساعات)',
      notes: 'ملاحظات (اختياري)',
      save: 'حفظ',
      delete: 'حذف',
      confirm_delete: 'متأكد إنك عايز تحذفه؟',
      placeholder_name: 'اسم الدواء',
      placeholder_dosage: 'مثلاً: قرص أو نصف',
      placeholder_notes: 'مثلاً: بعد الأكل بس'
    },

    // التقويم
    calendar: {
      title: 'التقويم',
      day_of_week: ['أحد', 'إثنين', 'تلات', 'أربع', 'خميس', 'جمعه', 'سبت'],
      month_names: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
      stats: 'إحصائيات الالتزام',
      adherence_rate: 'نسبة الالتزام',
      total_days: 'عدد الأيام',
      perfect_days: 'أيام كاملة (كل الدوا أخده)'
    },

    // الإعدادات
    settings: {
      title: 'الإعدادات',
      theme: 'المظهر',
      theme_light: 'فاتح',
      theme_dark: 'داكن',
      theme_system: 'نظام',
      language: 'اللغة',
      notifications: 'الإشعارات',
      test_notification: 'اختبار إشعار',
      sound: 'النغمة',
      vibration: 'الاهتزاز',
      backup_export: 'تصدير النسخة الاحتياطية',
      import_backup: 'استيراد نسخة احتياطية',
      reset_data: 'مسح كل البيانات',
      confirm_reset: 'هل أنت متأكد إنك عايز تمسح كل حاجة؟ الميوز هتروح للأبد.'
    },

    // رسائل النظام والتنبيهات
    messages: {
      saved: 'تم الحفظ بنجاح 💊',
      deleted: 'تم الحذف',
      error_save: 'في مشكلة في الحفظ...try تاني لو سمحت.',
      error_load: 'مش قادر أحمل البيانات.. تأكد إن الإنترنت شغال.',
      reminder_title: 'وقت الدواء يا كبير! 💊',
      reminder_body: 'يا ريت تاخد جرعتك دلوقتي عشان صحتك.',
      skipped: 'تم التخطي',
      snoozed: 'تم التأجيل (هنذكرك بعد كمان)',
      battery_opt: 'تحسين البطارية',
      battery_text: 'لو الإشعارات بطأت، روح إعدادات الهاتف واخلي التطبيق "بدون قيود" من ناحية البطارية.'
    }
  },
  en: {
    dir: 'ltr',
    title: 'Treatment Reminder',
    tagline: 'Take your meds on time, stay healthy.',
    
    nav: {
      today: 'Today',
      calendar: 'Calendar',
      history: 'History',
      settings: 'Settings'
    },

    dashboard: {
      upcoming: 'Next Dose',
      no_meds: 'No meds registered yet. Start your health journey!',
      add_first: 'Add your first medication',
      taken: 'Taken ✅',
      pending: 'Pending ⏰',
      missed: 'Missed ❌',
      next_dose: 'Next dose at',
      dose_log: 'Today\'s log',
      empty_schedule: 'No schedule for today. Enjoy!'
    },

    meds: {
      title: 'My Medications',
      add_med: 'Add Medication',
      edit_med: 'Edit Medication',
      name: 'Medication Name',
      dosage: 'Dosage (e.g., 1 tablet)',
      time: 'Time',
      interval: 'Repeat every (hours)',
      notes: 'Notes (optional)',
      save: 'Save',
      delete: 'Delete',
      confirm_delete: 'Are you sure you want to delete this?',
      placeholder_name: 'Medication name',
      placeholder_dosage: 'e.g., 1 pill',
      placeholder_notes: 'e.g., After meals'
    },

    calendar: {
      title: 'Calendar',
      day_of_week: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      month_names: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      stats: 'Adherence Stats',
      adherence_rate: 'Adherence Rate',
      total_days: 'Total Days',
      perfect_days: 'Perfect Days'
    },

    settings: {
      title: 'Settings',
      theme: 'Theme',
      theme_light: 'Light',
      theme_dark: 'Dark',
      theme_system: 'System',
      language: 'Language',
      notifications: 'Notifications',
      test_notification: 'Test Notification',
      sound: 'Sound',
      vibration: 'Vibration',
      backup_export: 'Export Backup',
      import_backup: 'Import Backup',
      reset_data: 'Reset Data',
      confirm_reset: 'Are you sure you want to wipe all data?'
    },

    messages: {
      saved: 'Saved successfully 💊',
      deleted: 'Deleted',
      error_save: 'Error saving. Please try again.',
      error_load: 'Could not load data. Check connection.',
      reminder_title: 'Time for your pills! 💊',
      reminder_body: 'Don\'t forget to take your dose now.',
      skipped: 'Skipped',
      snoozed: 'Snoozed',
      battery_opt: 'Battery Optimization',
      battery_text: 'If notifications are delayed, go to phone settings and set the app to "Unrestricted" battery usage.'
    }
  }
};

export default LANGS;