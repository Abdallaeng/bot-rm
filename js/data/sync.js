/** مزامنة خفيفة مع الخادم: طلب واحد /api/sync يعيد إصدار البيانات والإعلان معاً { updated, b }.
 *  - يعمل فقط والتطبيق ظاهر (لا استهلاك في الخلفية)، كل 80–100 ثانية تقريباً (تأخير عشوائي) حتى لا يصل الجميع في لحظة واحدة.
 *  - عند العودة للتطبيق أو عودة الاتصال يُفحص فوراً إن مرّت 30 ثانية.
 *  - الخادم يخدمه من كاش الحافة (20 ثانية) فلا يُقرأ KV مهما كثر المستخدمون. */
import { LS } from '../lib/storage.js';
import { countReq } from './analytics.js';
import { ctl } from './controls.js';

const MIN_GAP = 30e3, JITTER = 20e3;       // الفاصل بين الفحوصات (EVERY) من تحكم الإدارة «فترة فحص التحديثات»
let inflight = null, timer = 0, handler = null;

/** يعيد { updated, b } أو null إن لم يكن مطلوباً/ممكناً. force=true يتجاوز الحد الزمني (زر «تحقق الآن»). */
export function checkSync(force = false) {
  if (inflight) return inflight;
  if (!navigator.onLine) return Promise.resolve(null);
  if (!force && Date.now() - LS.get('brm_sync_ts', 0) < MIN_GAP) return Promise.resolve(null);
  LS.set('brm_sync_ts', Date.now()); countReq();
  inflight = fetch('/api/sync', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .finally(() => { inflight = null; });
  return inflight;
}

function schedule() {
  clearTimeout(timer);
  if (document.visibilityState !== 'visible' || !ctl('autoSync')) return;   // لا فحص والتطبيق مخفي أو الفحص الدوري موقوف
  timer = setTimeout(async () => { await handler(); schedule(); }, ctl('syncEvery') * 1000 + Math.random() * JITTER);
}

/** يبدأ الفحص الدوري: fn تُستدعى عند كل دورة (تتولى هي checkSync وتطبيق النتيجة) */
export function startSyncLoop(fn) {
  handler = fn;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { fn(); schedule(); } else clearTimeout(timer); });
  window.addEventListener('online', () => fn());
  schedule();
}
