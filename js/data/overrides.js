/** تصحيحات العرض (لا تدخل الحزمة ولا النشر):
 *  1) ثابتة في الكود (LIST) — كل استثناء بتاريخ انتهاء اختياري.
 *  2) ديناميكية من لوحة الإدارة (تبويب «التصحيحات»): تُحمَّل من /api/corrections وتُخزَّن محلياً (LS brm_corr).
 *  عند انتهاء التاريخ يعود النص الأصلي تلقائياً. */
import { LS } from '../lib/storage.js';

const LIST = [
  { id: '1245', until: '2026-10-24', set: { nm: 'الشالجية بيت طه الابرز قرب قرية البوعامر' } },
  /* 4940: نوع الموقع TASC فقط (بدون HYB) ولا يظهر نوع البرج «Hybrid». دائم — عند تصحيح الإكسل يصبح بلا أثر */
  { id: '4940', set: { st: 'TASC' }, dropX: ['tower'] },
];

let dynamic = [];                                   // [{id, field, value, until?, note?}]
export const getDynamic = () => dynamic;
export const builtinList = () => LIST;
export function setDynamic(list) { dynamic = Array.isArray(list) ? list : []; }
export const loadSaved = () => { setDynamic(LS.get('brm_corr', { list: [] }).list); };

const expired = (until, now) => until && now >= Date.parse(until + 'T00:00:00+03:00');

/** يعيد الصف لقيمه الأصلية ثم يطبّق الاستثناءات الحالية (آمن للاستدعاء المتكرر) */
export function applyOverrides(row, now = Date.now()) {
  for (const k of Object.keys(row)) if (k.startsWith('_o_')) { row[k.slice(3)] = row[k]; delete row[k]; }
  const id = String(row.id);
  for (const o of LIST) {
    if (o.id !== id || expired(o.until, now)) continue;
    for (const k of Object.keys(o.set || {})) { row['_o_' + k] = row[k]; row[k] = o.set[k]; }
    if (o.dropX?.length) { row._o_x = row._o_x ?? row.x; row.x = { ...(row.x || {}) }; for (const k of o.dropX) delete row.x[k]; }
  }
  for (const c of dynamic) {
    if (c.id !== id || expired(c.until, now)) continue;
    if (c.field.startsWith('x.')) {
      const k = c.field.slice(2);
      row._o_x = row._o_x ?? row.x; row.x = { ...(row.x || {}) };
      if (c.value === '') delete row.x[k]; else row.x[k] = c.value;
    } else {
      if (!('_o_' + c.field in row)) row['_o_' + c.field] = row[c.field];
      row[c.field] = c.value;
    }
  }
}

/** صف بقيمه الأصلية (للنشر/المقارنة في لوحة الإدارة) */
export function rawRow(row) {
  const o = { ...row };
  for (const k of Object.keys(o)) if (k.startsWith('_o_')) { o[k.slice(3)] = o[k]; delete o[k]; }
  return o;
}
