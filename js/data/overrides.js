/** استثناءات مؤقتة للعرض فقط (لا تدخل الحزمة ولا النشر). كل استثناء ينتهي تلقائياً في تاريخه فيعود النص الأصلي. */
const LIST = [
  { id: '1245', until: '2026-10-24', set: { nm: 'الشالجية بيت طه الابرز قرب قرية البوعامر' } },
  /* 4940: نوع الموقع TASC فقط (بدون HYB) ولا يظهر نوع البرج «Hybrid». دائم — عند تصحيح الإكسل يصبح بلا أثر */
  { id: '4940', set: { st: 'TASC' }, dropX: ['tower'] },
];

export function applyOverrides(row, now = Date.now()) {
  const o = LIST.find((x) => x.id === String(row.id));
  if (!o || (o.until && now >= Date.parse(o.until + 'T00:00:00+03:00'))) return;
  for (const k of Object.keys(o.set || {})) { row['_o_' + k] = row[k]; row[k] = o.set[k]; }
  if (o.dropX?.length) { row._o_x = row.x; row.x = { ...(row.x || {}) }; for (const k of o.dropX) delete row.x[k]; }
}

/** صف بقيمه الأصلية (للنشر/المقارنة في لوحة الإدارة) */
export function rawRow(row) {
  const o = { ...row };
  for (const k of Object.keys(o)) if (k.startsWith('_o_')) { o[k.slice(3)] = o[k]; }
  return o;
}
