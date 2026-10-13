/** تتبّع الاستخدام: سجل محلي + إرسال دفعات إلى /api/track (تخزين KV في الاستضافة).
 *  توفيراً لحصة الكتابة في KV: الأحداث تُجمَّع في طابور محلي (يبقى محفوظاً) ولا تُرسل إلا عند
 *  (أ) تجمّع 25 حدثاً، أو (ب) مرور 15 دقيقة على أقدم حدث غير مرسل، فيصل كل ذلك بكتابة واحدة. */
import { LS } from '../lib/storage.js';

export const ymd = (d = new Date()) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');

const device = () => {
  let id = LS.get('brm_dev', '');
  if (!id) { id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3); LS.set('brm_dev', id); }
  return id;
};

/* عدّادات مرافقة تُرسل مع الدفعة نفسها (بلا أي طلب أو كتابة إضافية): طلبات الخادم، أداء الفتح والبحث */
export const countReq = (n = 1) => LS.set('brm_rq', (LS.get('brm_rq', 0) || 0) + n);
export const perfBoot = (ms) => { const p = LS.get('brm_pf', { b: 0, sn: 0, ss: 0 }); p.b = Math.round(ms); LS.set('brm_pf', p); };
export const perfSearch = (ms) => { const p = LS.get('brm_pf', { b: 0, sn: 0, ss: 0 }); p.sn++; p.ss += Math.round(ms); LS.set('brm_pf', p); };
const installed = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const BATCH = 25, MAX_AGE = 15 * 60e3;
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
  if (q.length >= BATCH) flushPending(true);
  else if (!timer) timer = setTimeout(() => { timer = 0; flushPending(); }, MAX_AGE);
  document.dispatchEvent(new CustomEvent('botrm:log'));
}

let sending = false;
export async function flushPending(force = false) {
  const q = LS.get('brm_evq', []);
  if (!q.length || sending || !navigator.onLine) return;
  const now = Date.now();
  if (now < LS.get('brm_notrack', 0)) return;            // الخادم غير مفعّل أو طلب منّا الانتظار
  if (!force && q.length < BATCH && now - q[0][0] < MAX_AGE) return;   // لم يحن موعد الإرسال بعد
  sending = true;
  const batch = q.slice(0, 50);
  try {
    const res = await fetch('/api/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ d: device(), e: batch, nw: LS.get('brm_seen', 0) ? 0 : 1, pw: installed() ? 1 : 0, rq: LS.get('brm_rq', 0), pf: LS.get('brm_pf', null) }), keepalive: true });
    if (res.status === 501 || res.status === 404) LS.set('brm_notrack', Date.now() + 3600_000);
    else if (res.status === 429) { const j = await res.json().catch(() => ({})); LS.set('brm_notrack', Date.now() + (Math.min(+j.retry || 240, 900) + 5) * 1000); }
    else if (res.ok) {
      LS.set('brm_seen', 1); LS.set('brm_rq', 0); LS.del('brm_pf');
      const rest = LS.get('brm_evq', []).filter((x) => !batch.some((b) => b[0] === x[0] && b[1] === x[1]));
      LS.set('brm_evq', rest);
      if (rest.length) { sending = false; return flushPending(); }
    }
  } catch { /* نعيد المحاولة لاحقاً */ }
  sending = false;
}

/* عند إخفاء التطبيق نرسل فقط ما استحق الإرسال (قاعدة flushPending)، والباقي يبقى في الطابور ويُرسل لاحقاً أو عند الفتح القادم */
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushPending(); });

/** آخر المواقع التي بحث عنها هذا الجهاز (بدون تكرار) */
export function recentSearches(max = 8) {
  const log = LS.get('brm_log', []), seen = [];
  for (let i = log.length - 1; i >= 0 && seen.length < max; i--) if (log[i][2] && !seen.includes(log[i][1])) seen.push(log[i][1]);
  return seen;
}
