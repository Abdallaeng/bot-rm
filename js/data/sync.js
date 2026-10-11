/** مزامنة خفيفة مع الخادم: طلب واحد /api/sync يعيد إصدار البيانات والإعلان معاً.
 *  لا يُرسَل أكثر من مرة كل 5 دقائق (بين التبويبات أيضاً)، والخادم يخدمه من كاش الحافة دون قراءة KV. */
import { LS } from '../lib/storage.js';

const MIN_GAP = 5 * 60e3;
let inflight = null;

/** يعيد { updated, b } أو null إن لم يكن مطلوباً/ممكناً. force=true يتجاوز الحدّ الزمني (لزر «تحديث» اليدوي). */
export function checkSync(force = false) {
  if (inflight) return inflight;
  if (!navigator.onLine) return Promise.resolve(null);
  if (!force && Date.now() - LS.get('brm_sync_ts', 0) < MIN_GAP) return Promise.resolve(null);
  LS.set('brm_sync_ts', Date.now());
  inflight = fetch('/api/sync', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .finally(() => { inflight = null; });
  return inflight;
}
