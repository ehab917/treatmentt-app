/* native.js — جسر Capacitor (أندرويد)
   يكتشف إن كان التطبيق يعمل كتطبيق أصلي ويوفّر الوصول للإضافات الأصلية
   (إشعارات محلية مجدولة، مشاركة ملفات، زر الرجوع). في المتصفح تعود القيم null. */
const C = typeof window !== 'undefined' ? window.Capacitor : undefined;

export const isNative = !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());

function plugin(name) {
  return (isNative && C.Plugins && C.Plugins[name]) || null;
}

export const LN = () => plugin('LocalNotifications');
export const FS = () => plugin('Filesystem');
export const SHARE = () => plugin('Share');
export const APP = () => plugin('App');
