/** مخزن البيانات: التحميل وفك التشفير والفهرسة */
import { LS } from '../lib/storage.js';
import { normalizeArabic } from '../lib/text.js';
import { govName } from '../lib/labels.js';

export const CFG = window.BOTRM;
const Core = window.BotCore;

export const state = { rows: [], byId: new Map(), meta: {}, code: LS.get('brm_code', '') };

const inIraq = (lon, lat) => lon > 38 && lon < 49.5 && lat > 28.5 && lat < 37.5;

/** بعض الصفوف في الملف فيها خط الطول والعرض مقلوبان — نصحّحها عند التحميل */
function fixSwappedCoords(row) {
  const lon = +row.lon, lat = +row.lat;
  if (lon && lat && !inIraq(lon, lat) && inIraq(lat, lon)) { row.lon = lat; row.lat = lon; }
}

export function setRows(rows, meta = {}) {
  state.rows = rows;
  state.meta = meta;
  state.byId = new Map();
  for (const row of rows) {
    fixSwappedCoords(row);
    row._s = normalizeArabic([row.nm, row.mn, row.cl, govName(row.gov), row.gov].filter(Boolean).join(' '));
    state.byId.set(row.id, row);
  }
}

export async function fetchPacket() {
  const res = await fetch(`${CFG.dataFile}?t=${Date.now()}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`data ${res.status}`);
  return res.json();
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
