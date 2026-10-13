/** كل بيانات الموقع من ملف الإكسل، مجمّعة في أقسام (تظهر عند «عرض المزيد»).
 *  المفاتيح القصيرة (id, st, nm…) من الورقة الرئيسية، والباقي في r.x من الأوراق الإضافية (انظر core.js). */
import { esc } from '../lib/dom.js';
import { IO, govName } from '../lib/labels.js';
import { formatIsoDate } from '../lib/text.js';
import { ctl } from '../data/controls.js';

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  site: svg('<path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'),
  net: svg('<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/><path d="M2 9a14 14 0 0 1 20 0"/>'),
  team: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  note: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>'),
  pin: svg('<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/>'),
};

/* type: date → تاريخ، sev → شارة خطورة، ltr → اتجاه لاتيني. المصدر: مفتاح في الصف الرئيسي أو في x */
const GROUPS = [
  { id: 'site', title: 'بيانات الموقع', icon: ICON.site, fields: [
    ['st', 'نوع الموقع (Site Type)', { ltr: 1 }], ['t2', 'التصنيف', { ltr: 1 }], ['tower', 'نوع البرج', { ltr: 1 }],
    ['sev', 'الخطورة', { sev: 1 }], ['io', 'داخلي / خارجي', { map: IO }], ['gov', 'المحافظة', { map: 'gov' }],
    ['city', 'المدينة', { ltr: 1 }], ['region', 'المنطقة (Region)', { ltr: 1 }], ['subRegion', 'المنطقة الفرعية', { ltr: 1 }],
    ['siteStatus', 'حالة الموقع', { ltr: 1 }], ['as', 'المواقع المرتبطة', {}], ['oldId', 'رقم الموقع القديم', { ltr: 1 }],
    ['ven', 'المورّد (Vendor)', { ltr: 1 }], ['sub', 'المقاول الفرعي', { ltr: 1 }], ['client', 'العميل', { ltr: 1 }],
    ['onAir', 'تاريخ التشغيل (On air)', { date: 1 }], ['annDate', 'تاريخ الإعلان (سجل الموقع)', { date: 1 }],
    ['ad', 'تاريخ الإعلان', { date: 1 }], ['ah', 'إعلان Hybrid', { date: 1 }], ['an', 'إعلان Normal', { date: 1 }],
    ['lat', 'خط العرض', { ltr: 1 }], ['lon', 'خط الطول', { ltr: 1 }],
  ] },
  { id: 'net', title: 'الشبكة', icon: ICON.net, fields: [
    ['st2g', 'حالة 2G', { ltr: 1 }], ['sev2g', 'خطورة 2G', { sev: 1 }], ['sev3g', 'خطورة 3G', { sev: 1 }], ['sev4g', 'خطورة 4G', { sev: 1 }],
    ['nm2g', 'اسم الموقع 2G', { ltr: 1 }], ['nm3g', 'اسم الموقع 3G', { ltr: 1 }], ['nm4g', 'اسم الموقع 4G', { ltr: 1 }],
    ['code3g', 'كود 3G', { ltr: 1 }], ['codeU900', 'كود U900', { ltr: 1 }], ['code4g', 'كود 4G', { ltr: 1 }],
    ['bsc', 'BSC', { ltr: 1 }], ['rnc', 'RNC', { ltr: 1 }], ['special', 'نوع خاص (Special)', { ltr: 1 }],
  ] },
  { id: 'team', title: 'الإدارة والمسؤولون', icon: ICON.team, fields: [
    ['rmResp', 'مسؤول RM', { ltr: 1 }], ['omRm', 'O&M RM', { ltr: 1 }], ['omAm', 'O&M AM', { ltr: 1 }],
    ['propRm', 'Property RM', { ltr: 1 }], ['propAm', 'Property AM', { ltr: 1 }], ['grTeam', 'فريق GR', { ltr: 1 }],
    ['teamResp', 'مسؤولية الفريق', { ltr: 1 }], ['omCat', 'تصنيف O&M', { ltr: 1 }], ['project', 'نوع المشروع', { ltr: 1 }],
    ['powerSc', 'مقاول الطاقة (Power SC)', { ltr: 1 }], ['tenant', 'كود المستأجر', { ltr: 1 }],
  ] },
  { id: 'equip', title: 'المعدات والتشغيل', icon: ICON.gear, fields: [
    ['cabType', 'نوع الخزانة', { ltr: 1 }], ['cabModel', 'موديل الخزانة', { ltr: 1 }], ['asp', 'ASP', { ltr: 1 }],
    ['gens', 'المولدات', { ltr: 1 }], ['cpConn', 'CP متصل', { ltr: 1 }], ['cpLegal', 'CP قانوني', { ltr: 1 }],
    ['huawei', 'تحويل Huawei', { ltr: 1 }], ['outage', 'Outage', { ltr: 1 }], ['alarm', 'Alarm', { ltr: 1 }],
    ['subType', 'Sub. And Type', { ltr: 1, wide: 1 }], ['billable', 'تاريخ الفوترة', { date: 1 }],
  ] },
];

const norm = (s) => String(s || '').replace(/[\s\-–_.,،'"()]/g, '').toLowerCase();
const read = (r, key) => (key in r ? r[key] : r.x?.[key]);

function valueHtml(v, opt) {
  if (opt.sev && /^S[123]$/i.test(v)) return `<span class="bd ${String(v).toLowerCase()}">${esc(v)}</span>`;
  let text = v;
  if (opt.date) text = formatIsoDate(v);
  else if (opt.map === 'gov') text = govName(v);
  else if (opt.map) text = opt.map[v] || v;
  return opt.ltr ? `<span class="en">${esc(text)}</span>` : esc(text);
}

function fieldHtml(label, v, opt) {
  return `<div class="f${opt.wide ? ' full' : ''}"><label>${label}</label><div>${valueHtml(v, opt)}</div></div>`;
}

function group(g, body, count) {
  return `<section class="grp grp-${g.id}"><h3><span class="gi">${g.icon}</span>${g.title}<em>${count}</em></h3><div class="grid">${body}</div></section>`;
}

/** قسم العناوين: العنوان الرئيسي موجود في البطاقة، وهنا فقط العناوين المختلفة من الأوراق الأخرى */
function addressGroup(r) {
  const seen = new Set([norm(r.nm)]);
  const items = [['btsAddr', 'عنوان (قاعدة BTS)'], ['siteAddr', 'عنوان (سجل الموقع)'], ['addr7', 'عنوان (الموقع المنقول)']]
    .map(([k, label]) => [label, read(r, k)])
    .filter(([, v]) => v && !seen.has(norm(v)) && seen.add(norm(v)));
  if (!items.length) return { html: '', count: 0 };
  const body = items.map(([l, v]) => `<div class="f full"><label>${l}</label><div>${esc(v)}</div></div>`).join('');
  return { html: group({ id: 'addr', title: 'عناوين أخرى', icon: ICON.pin }, body, items.length), count: items.length };
}

/** ملاحظات وبيانات اتصال نصية من الورقة الرئيسية (مثل «لا يوجد») */
function notesGroup(r) {
  const rows = [['own', 'رقم صاحب الموقع'], ['cm', 'ملاحظات (Comment)'], ['note2', 'ملاحظات (سجل الموقع)']]
    .map(([k, l]) => [l, read(r, k)]).filter(([, v]) => v);
  const nonPhone = (v) => !/^[\d\s+]{7,}$/.test(String(v));
  const items = rows.filter(([l, v]) => l.startsWith('ملاحظات') || nonPhone(v));
  if (!items.length) return { html: '', count: 0 };
  const body = items.map(([l, v]) => `<div class="f full"><label>${l}</label><div>${esc(v)}</div></div>`).join('');
  return { html: group({ id: 'note', title: 'ملاحظات', icon: ICON.note }, body, items.length), count: items.length };
}

/** يعيد { html, count } لكل الحقول المتوفرة (count = عدد الحقول التي لها قيمة) */
export function renderMore(r) {
  let total = 0, html = '';
  const GATE = { net: 'cGrpNet', team: 'cGrpTeam', equip: 'cGrpEquip' };
  for (const g of GROUPS) {
    if (GATE[g.id] && !ctl(GATE[g.id])) continue;                 // قسم أوقفته الإدارة
    const cells = g.fields.map(([key, label, opt]) => [label, read(r, key), opt]).filter(([, v]) => v !== '' && v != null);
    if (!cells.length) continue;
    total += cells.length;
    html += group(g, cells.map(([l, v, o]) => fieldHtml(l, v, o)).join(''), cells.length);
  }
  for (const part of [addressGroup(r), notesGroup(r)]) { html += part.html; total += part.count; }
  return { html, count: total };
}

/** اسم عربي لكل مفتاح (للمقارنة قبل النشر) */
export const FIELD_LABELS = Object.fromEntries(
  [['id', 'رقم الموقع'], ['nm', 'العنوان'], ['gov', 'المحافظة'], ['cl', 'الكلستر'], ['mn', 'الفني'], ['mp', 'الهاتف']]
    .concat(GROUPS.flatMap((g) => g.fields.map((f) => [f[0], f[1]]))),
);
