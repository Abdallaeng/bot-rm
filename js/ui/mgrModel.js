/** نموذج بيانات صفحة المدير: التصنيف (زين/تاسك/هايبرد)، الأبعاد، الفلاتر العامة، القوائم الجاهزة، فحوص الجودة، والتفضيلات.
 *  لا يلمس DOM ولا الشبكة: كل الأرقام تُحسب من state.rows (بعد التصحيحات). */
import { state } from '../data/store.js';
import { govName } from '../lib/labels.js';
import { FIELD_LABELS } from './fields.js';

/* ---------------- التصنيف ---------------- */
/** زين / تاسك من «نوع الموقع» (Site Type)، والهايبرد من (HYB) فيه — هذا هو المرجع، لا حقل «نوع البرج». */
export const opOf = (r) => (/^\s*zain/i.test(r.st || '') ? 'Z' : /^\s*tasc/i.test(r.st || '') ? 'T' : '');
export const isHyb = (r) => /\(\s*hyb/i.test(r.st || '');
export const cell = (r) => `${opOf(r) || 'O'}${isHyb(r) ? 'h' : 'p'}`;           // Zp Zh Tp Th Op Oh
export const hasGeo = (r) => Boolean(+r.lon && +r.lat);

const X = (r, k) => r.x?.[k];
const nz = (v) => (v == null || String(v).trim() === '' ? '—' : String(v).trim());
const techOf = (r) => [X(r, 'nm2g') && '2G', X(r, 'nm3g') && '3G', X(r, 'nm4g') && '4G'].filter(Boolean).join(' + ') || '—';
const yearOf = (r) => (/^(\d{4})/.exec(String(X(r, 'onAir') || X(r, 'annDate') || '')) || [])[1] || '—';

/** [المعرّف، التسمية، دالة المفتاح، ترتيب: 'n' بالعدد | 'k' بالمفتاح] */
export const DIMS = [
  ['gov', 'المحافظة', (r) => govName(r.gov) || '—', 'n'],
  ['cl', 'الكلستر', (r) => r.cl || '—', 'n'],
  ['ven', 'المورّد', (r) => r.ven || '—', 'n'],
  ['sev', 'الخطورة', (r) => r.sev || '—', 'k'],
  ['t2', 'التصنيف', (r) => r.t2 || '—', 'n'],
  ['io', 'داخلي / خارجي', (r) => r.io || '—', 'n'],
  ['stat', 'حالة الموقع', (r) => nz(X(r, 'siteStatus')), 'n'],
  ['cab', 'نوع الخزانة', (r) => nz(X(r, 'cabType')), 'n'],
  ['tech', 'التقنيات', techOf, 'n'],
  ['reg', 'المنطقة', (r) => nz(X(r, 'region')), 'n'],
  ['mn', 'الفني', (r) => nz(r.mn), 'n'],
  ['rm', 'مدير RM', (r) => nz(X(r, 'omRm')), 'n'],
  ['yr', 'سنة التشغيل', yearOf, 'k'],
  ['prj', 'المشروع', (r) => nz(X(r, 'project')), 'n'],
];
export const dimOf = (id) => DIMS.find((d) => d[0] === id);
export const shown = (k) => (k === '—' ? 'غير محدد' : k);

/* ---------------- الفلاتر العامة ---------------- */
const FK = ['op', 'hyb', 'gov', 'cl', 'ven', 'sev'];
export const F = Object.fromEntries(FK.map((k) => [k, '']));
try { Object.assign(F, JSON.parse(localStorage.getItem('brm_mgr_f') || '{}')); } catch { /* */ }
const saveF = () => { try { localStorage.setItem('brm_mgr_f', JSON.stringify(F)); } catch { /* */ } };
export const setFilter = (k, v) => { if (FK.includes(k)) { F[k] = v; saveF(); } };
export const resetFilters = () => { FK.forEach((k) => { F[k] = ''; }); saveF(); };
export const filterCount = () => FK.filter((k) => F[k] !== '').length;
export const matchF = (r) => (!F.op || opOf(r) === F.op) && (F.hyb === '' || (F.hyb === '1') === isHyb(r)) && (!F.gov || r.gov === F.gov)
  && (!F.cl || (r.cl || '') === F.cl) && (!F.ven || (r.ven || '') === F.ven) && (!F.sev || r.sev === F.sev);
let cacheRows = null, cacheKey = '', cacheVal = [];
export function rowsF() {
  const k = JSON.stringify(F);
  if (cacheRows !== state.rows || cacheKey !== k) { cacheRows = state.rows; cacheKey = k; cacheVal = state.rows.filter(matchF); }
  return cacheVal;
}
/** قيم الفلاتر المتاحة (من كل البيانات لا من المفلتر، كي لا يضيع الخيار) */
export function filterOptions() {
  const uniq = (fn) => [...new Set(state.rows.map(fn).filter(Boolean))];
  const gov = uniq((r) => r.gov).map((g) => [g, govName(g)]).sort((a, b) => a[1].localeCompare(b[1], 'ar'));
  return { gov, cl: uniq((r) => r.cl).sort((a, b) => a.localeCompare(b, 'ar')), ven: uniq((r) => r.ven).sort(), sev: uniq((r) => r.sev).sort() };
}

/* ---------------- الحساب ---------------- */
const blank = () => ({ Zp: 0, Zh: 0, Tp: 0, Th: 0, Op: 0, Oh: 0 });
export function tally(rows, keyFn) {
  const m = new Map();
  for (const r of rows) { const k = keyFn(r); const o = m.get(k) || blank(); o[cell(r)]++; m.set(k, o); }
  return [...m.entries()].map(([k, o]) => ({ k, ...o, Z: o.Zp + o.Zh, T: o.Tp + o.Th, all: o.Zp + o.Zh + o.Tp + o.Th + o.Op + o.Oh }));
}
export const summary = (rows = rowsF()) => tally(rows, () => 'all')[0] || { ...blank(), Z: 0, T: 0, all: 0 };
export function sorted(dimId, rows = rowsF()) {
  const [, , fn, mode] = dimOf(dimId);
  return tally(rows, fn).sort((a, b) => (mode === 'k' ? String(a.k).localeCompare(String(b.k)) : b.all - a.all));
}

/** مطابقة مرشّح نقرة: { op, hyb, dim, val, id, preset } فوق مجموعة الصفوف المفلترة */
export function pred(f) {
  const dim = f.dim && dimOf(f.dim), dim2 = f.dim2 && dimOf(f.dim2), pre = f.preset && PRESETS.find((p) => p.id === f.preset);
  return (r) => (!f.id || r.id === f.id) && (!f.op || opOf(r) === f.op) && (f.hyb == null || (f.hyb ? isHyb(r) : !isHyb(r)))
    && (!dim || dim[2](r) === f.val) && (!dim2 || dim2[2](r) === f.val2) && (!pre || pre.fn(r));
}
export const titleOf = (f) => (f.id ? `الموقع ${f.id}` : f.preset ? PRESETS.find((p) => p.id === f.preset)?.label : [f.op === 'Z' ? 'زين' : f.op === 'T' ? 'تاسك' : 'كل المشغّلين', f.hyb === 1 ? 'هايبرد' : f.hyb === 0 ? 'عادي' : 'الكلي', f.dim ? `${dimOf(f.dim)[1]}: ${shown(f.val)}` : '', f.dim2 ? `${dimOf(f.dim2)[1]}: ${shown(f.val2)}` : ''].filter(Boolean).join(' · '));

/* ---------------- القوائم الجاهزة وفحوص الجودة ---------------- */
const inactive = (r) => { const s = String(X(r, 'siteStatus') || ''); return s !== '' && !/^(active|on-air|on air)$/i.test(s); };
/** kind: 'list' قائمة للمراقبة | 'dq' فحص جودة (الأعداد المرتفعة تستدعي مراجعة الإكسل) */
export const PRESETS = [
  { id: 's1', kind: 'list', label: 'مواقع الخطورة S1', fn: (r) => r.sev === 'S1' },
  { id: 'hyb', kind: 'list', label: 'كل مواقع الهايبرد', fn: isHyb },
  { id: 'hybz', kind: 'list', label: 'هايبرد زين', fn: (r) => isHyb(r) && opOf(r) === 'Z' },
  { id: 'hybt', kind: 'list', label: 'هايبرد تاسك', fn: (r) => isHyb(r) && opOf(r) === 'T' },
  { id: 'indoor', kind: 'list', label: 'مواقع داخلية (Indoor)', fn: (r) => r.io === 'Indoor' },
  { id: 'nofni', kind: 'list', label: 'بدون فني صيانة', fn: (r) => /بدون\s*فني/.test(r.mn || '') },
  { id: 'inact', kind: 'list', label: 'مواقع غير فعّالة (Plan / Long Term / Dismantled…)', fn: inactive },
  { id: 'nocl', kind: 'dq', label: 'بلا كلستر', fn: (r) => !r.cl },
  { id: 'nogeo', kind: 'dq', label: 'بلا إحداثيات', fn: (r) => !hasGeo(r) },
  { id: 'nomp', kind: 'dq', label: 'بلا رقم فني', fn: (r) => !r.mp },
  { id: 'nomn', kind: 'dq', label: 'بلا اسم فني', fn: (r) => !r.mn },
  { id: 'nost', kind: 'dq', label: 'نوع الموقع ليس زين ولا تاسك', fn: (r) => !opOf(r) },
  { id: 'nosev', kind: 'dq', label: 'بلا خطورة', fn: (r) => !r.sev },
  { id: 'nonm', kind: 'dq', label: 'بلا عنوان', fn: (r) => !r.nm },
];

/* ---------------- سجل التغييرات (r.ch) ---------------- */
const CH_LABELS = { cl: 'الكلستر', mn: 'الفني', mp: 'رقم الفني', sev: 'الخطورة', gov: 'المحافظة', nm: 'العنوان', st: 'نوع الموقع', io: 'داخلي/خارجي', lat: 'خط العرض', lon: 'خط الطول', __new: 'موقع جديد' };
export const chLabel = (k) => CH_LABELS[k] || FIELD_LABELS[k] || k;
export function changeFeed(rows, limit = 30) {
  const all = [];
  for (const r of rows) for (const [t, k, o, n] of r.ch || []) all.push({ t, id: r.id, k, o, n });
  all.sort((a, b) => b.t - a.t);
  const day = (t) => new Date(t + 3 * 3600e3).toISOString().slice(0, 10), days = new Map();
  for (const e of all) days.set(day(e.t), (days.get(day(e.t)) || 0) + 1);
  return { list: all.slice(0, limit), total: all.length, days: [...days.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14) };
}

/* ---------------- تفضيلات اللوحة ---------------- */
export const SECTIONS = [['ops', 'زين مقابل تاسك'], ['map', 'خريطة الانتشار'], ['reports', 'تقارير الشبكة'], ['pivot', 'الجدول المحوري'], ['techs', 'عبء الفنيين'], ['quality', 'جودة البيانات'], ['changes', 'آخر التغييرات'], ['list', 'قوائم المواقع']];
export const PREF_DEFAULT = { sec: Object.fromEntries(SECTIONS.map(([k]) => [k, true])), view: 'chart', topN: 12, density: 'comfy', theme: 'auto', refresh: 0, slideSec: 12, autoplay: false, pageSize: 25 };
export const prefs = JSON.parse(JSON.stringify(PREF_DEFAULT));
try { const s = JSON.parse(localStorage.getItem('brm_mgr_p') || '{}'); Object.assign(prefs, s, { sec: { ...PREF_DEFAULT.sec, ...(s.sec || {}) } }); } catch { /* */ }
export const savePrefs = () => { try { localStorage.setItem('brm_mgr_p', JSON.stringify(prefs)); } catch { /* */ } };
export function resetPrefs() { Object.assign(prefs, JSON.parse(JSON.stringify(PREF_DEFAULT))); savePrefs(); }
