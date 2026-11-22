/* native.js — جسر Capacitor (أندرويد)
   يكتشف إن كان التطبيق يعمل كتطبيق أصلي ويوفّر الوصول للإضافات الأصلية.
   في المتصفح تعود القيم null. */
const C = typeof window !== 'undefined' ? window.Capacitor : undefined;

export const isNative = !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());

const cache = {};
function plugin(name) {
  if (!isNative) return null;
  if (cache[name]) return cache[name];
  let p = null;
  try {
    if (typeof C.registerPlugin === 'function') p = C.registerPlugin(name);
  } catch (e) { p = null; }
  if (!p && C.Plugins) p = C.Plugins[name] || null;
  cache[name] = p;
  return p;
}

export const LN = () => plugin('LocalNotifications');
export const FS = () => plugin('Filesystem');
export const SHARE = () => plugin('Share');
export const APP = () => plugin('App');
export const DS = () => plugin('DeviceSettings');
