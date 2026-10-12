/** استثناءات مؤقتة للعرض فقط (لا تدخل الحزمة ولا النشر). كل استثناء ينتهي تلقائياً في تاريخه فيعود النص الأصلي. */
const LIST = [
  { id: '1245', until: '2026-11-12', set: { nm: 'الشالجية بيت طه الابرز قرب شيوخ البوعامر' } },
];

export function applyOverrides(row, now = Date.now()) {
  const o = LIST.find((x) => x.id === String(row.id));
  if (!o || now >= Date.parse(o.until + 'T00:00:00+03:00')) return;
  for (const k of Object.keys(o.set)) { row['_o_' + k] = row[k]; row[k] = o.set[k]; }
}

/** صف بقيمه الأصلية (للنشر/المقارنة في لوحة الإدارة) */
export function rawRow(row) {
  const o = { ...row };
  for (const k of Object.keys(o)) if (k.startsWith('_o_')) { o[k.slice(3)] = o[k]; }
  return o;
}
