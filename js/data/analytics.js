/** تتبّع الاستخدام: سجل محلي + إرسال دفعات إلى /api/track (تخزين KV في الاستضافة).
 *  الأحداث تُجمَّع في طابور محلي وتُرسل كل دقيقتين أو عند إغلاق الصفحة، وتبقى محفوظة عند انقطاع الشبكة. */
import { LS } from '../lib/storage.js';

export const ymd = (d = new Date()) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');

const device = () => {
  let id = LS.get('brm_dev', '');
  if (!id) { id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3); LS.set('brm_dev', id); }
  return id;
};

let lastTracked = '', timer = 0;
export function track(query, found, gov = '') {
  const sig = `${query}|${found}`;
  if (sig === lastTracked) return;
  lastTracked = sig;
  const now = Date.now();
  const log = LS.get('brm_log', []);
  log.push([now, query, found ? 1 : 0]);
  LS.set('brm_log', log.slice(-600));
  const q = LS.get('brm_evq', []);
  q.push([now, query, found ? 1 : 0, gov]);
  LS.set('brm_evq', q.slice(-300));
  clearTimeout(timer); timer = setTimeout(flushPending, 60_000);
  document.dispatchEvent(new CustomEvent('botrm:log'));
}

let sending = false;
export async function flushPending() {
  const q = LS.get('brm_evq', []);
  if (!q.length || sending || !navigator.onLine) return;
  if (Date.now() < LS.get('brm_notrack', 0)) return;     // الخادم غير مفعّل: لا نكرر المحاولة كثيراً
  sending = true;
  const batch = q.slice(0, 50);
  try {
    const res = await fetch('/api/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ d: device(), e: batch }), keepalive: true });
    if (res.status === 501 || res.status === 404) LS.set('brm_notrack', Date.now() + 3600_000);
    else if (res.ok) {
      const rest = LS.get('brm_evq', []).filter((x) => !batch.some((b) => b[0] === x[0] && b[1] === x[1]));
      LS.set('brm_evq', rest);
      if (rest.length) { sending = false; return flushPending(); }
    }
  } catch { /* نعيد المحاولة لاحقاً */ }
  sending = false;
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushPending(); });

/** آخر المواقع التي بحث عنها هذا الجهاز (بدون تكرار) */
export function recentSearches(max = 8) {
  const log = LS.get('brm_log', []), seen = [];
  for (let i = log.length - 1; i >= 0 && seen.length < max; i--) if (log[i][2] && !seen.includes(log[i][1])) seen.push(log[i][1]);
  return seen;
}
