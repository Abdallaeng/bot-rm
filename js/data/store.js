/** مخزن البيانات: التحميل وفك التشفير والفهرسة */
import { LS } from '../lib/storage.js';
import { applyOverrides } from './overrides.js';
import { countReq } from './analytics.js';
import { normalizeArabic } from '../lib/text.js';
import { govName } from '../lib/labels.js';
import { idbGet, idbSet } from './idb.js';

export const CFG = window.BOTRM;
const Core = window.BotCore;

export const state = { rows: [], byId: new Map(), meta: {}, code: LS.get('brm_code', '') };

const inIraq = (lon, lat) => lon > 38 && lon < 49.5 && lat > 28.5 && lat < 37.5;

/** بعض الصفوف في الملف فيها خط الطول والعرض مقلوبان — نصحّحها عند التحميل */
export function fixSwappedCoords(row) {
  const lon = +row.lon, lat = +row.lat;
  if (lon && lat && !inIraq(lon, lat) && inIraq(lat, lon)) { row.lon = lat; row.lat = lon; }
}

export function setRows(rows, meta = {}) {
  window.BotCore?.canonClusters?.(rows);          // يوحّد كتابة الكلستر أيضاً في بيانات منشورة سابقاً
  state.rows = rows;
  state.meta = meta;
  state.byId = new Map();
  for (const row of rows) {
    fixSwappedCoords(row);
    applyOverrides(row);
    row._s = normalizeArabic([row.nm, row.mn, row.cl, govName(row.gov), row.gov].filter(Boolean).join(' '));
    row._p = String(row.mp || '').replace(/[^\d+]+/g, ' ').trim();   // أرقام الهواتف للبحث
    state.byId.set(row.id, row);
  }
}

/** الحزمة المحفوظة محلياً (IndexedDB) — أسرع مصدر ولا تحتاج شبكة إطلاقاً */
export const storedPacket = () => idbGet('packet');
export const savePacket = (packet) => idbSet('packet', packet);

/** fresh=false: من الكاش المحلي؛ fresh=true: من الشبكة (بعد أن يخبرنا /api/sync بوجود إصدار أحدث) */
export async function fetchPacket(fresh = false, ver = '') {
  countReq();
  const res = await fetch(fresh ? `${CFG.dataFile}?fresh=1${ver ? `&v=${encodeURIComponent(ver)}` : ''}` : CFG.dataFile);
  if (!res.ok) throw new Error(`data ${res.status}`);
  const packet = await res.json();
  savePacket(packet);
  return packet;
}

/** يجرّب الرمز المحفوظ ثم الرمز الفارغ (الموقع المفتوح). يعيد الصفوف أو null إن لزم رمز. */
export async function unlockPacket(packet) {
  for (const code of new Set([state.code, ''])) {
    try { const rows = await Core.open(packet, code); state.code = code; return rows; } catch { /* جرّب التالي */ }
  }
  return null;
}

export const stats = () => ({
  sites: state.rows.length,
  clusters: new Set(state.rows.map((r) => r.cl).filter(Boolean)).size,
  governorates: new Set(state.rows.map((r) => r.gov).filter(Boolean)).size,
  updated: state.meta.updated,
});
