/** سجل تغييرات كل موقع: يُحسب عند النشر ويُخزَّن داخل صف الموقع نفسه (r.ch) مشفّراً مع بقية البيانات،
 *  فيراه كل المستخدمين بغضّ النظر عن وقت تحديث أجهزتهم.
 *  الصيغة: r.ch = [[وقت_ms, مفتاح_الحقل, القيمة_القديمة, القيمة_الجديدة], ...] (الأحدث أولاً)، والمفتاح '__new' = أُضيف الموقع. */
const MAX_ENTRIES = 24, PER_UPDATE = 8, MAX_AGE = 365 * 86400e3, CUT = 80;
const PRIORITY = ['cl', 'mn', 'mp', 'sev', 'gov', 'nm', 'st', 'io', 'lat', 'lon'];

const cut = (v) => { const t = String(v ?? '').trim(); return t.length > CUT ? `${t.slice(0, CUT)}…` : t; };
const prune = (list, now) => (Array.isArray(list) ? list : []).filter((e) => now - e[0] < MAX_AGE).slice(0, MAX_ENTRIES);

/** يضيف سجل التغييرات إلى صفوف جديدة (قبل التشفير):
 *  newRows: صفوف الإكسل الجديدة · oldRows: الصفوف المنشورة حالياً · changes: [{id, diffs:[[key,old,new]]}] */
export function applyHistory(newRows, oldRows, changes, now = Date.now()) {
  const oldBy = new Map(oldRows.map((r) => [r.id, r]));
  const diffBy = new Map(changes.map((c) => [c.id, c.diffs]));
  for (const row of newRows) {
    const old = oldBy.get(row.id);
    const prev = prune(old?.ch, now);
    const diffs = diffBy.get(row.id);
    let fresh = [];
    if (diffs) {
      const rank = (k) => { const i = PRIORITY.indexOf(k); return i < 0 ? 99 : i; };
      fresh = diffs.filter(([k]) => k !== 'ch' && !k.startsWith('_')).sort((a, b) => rank(a[0]) - rank(b[0])).slice(0, PER_UPDATE).map(([k, o, n]) => [now, k, cut(o), cut(n)]);
    } else if (!old && oldRows.length) fresh = [[now, '__new', '', '']];
    const ch = fresh.concat(prev).slice(0, MAX_ENTRIES);
    if (ch.length) row.ch = ch; else delete row.ch;
  }
  return newRows;
}

/** تعديل يدوي لموقع واحد: changes = { مفتاح: قيمة_جديدة } */
export function editHistory(oldRow, changes, now = Date.now()) {
  const fresh = Object.entries(changes).map(([k, n]) => [now, k, cut(oldRow[k]), cut(n)]);
  return fresh.concat(prune(oldRow.ch, now)).slice(0, MAX_ENTRIES);
}
