/** أدوات لوحة الإدارة: تبويب «التصحيحات»، فحص الصحة، تنزيل البيانات الحالية كملف إكسل */
import { $, esc, toast } from '../lib/dom.js';
import { LS } from '../lib/storage.js';
import { state, setRows } from '../data/store.js';
import { rawRow, builtinList, setDynamic } from '../data/overrides.js';
import { xlsxBlob } from '../lib/xlsxWrite.js';
import { FIELD_LABELS } from './fields.js';
import { ICONS } from '../lib/icons.js';
import { pgHead, pn, pill, table, skeleton, num } from './adminUI.js';
import { GROUPS, CONTROLS, DEFAULTS, cleanControls } from '../data/controlsSchema.js';
import { saveControls } from '../data/controls.js';
import { applyControls } from './controlsUi.js';

/* ============ التصحيحات ============ */
const FIELDS = [
  ['nm', 'العنوان'], ['st', 'نوع الموقع (Site Type)'], ['x.tower', 'نوع البرج'], ['cl', 'الكلستر'], ['mn', 'اسم الفني'], ['mp', 'رقم الفني'],
  ['inv', 'رقم الفاتورة'], ['own', 'رقم صاحب الموقع'], ['sev', 'الخطورة'], ['io', 'داخلي / خارجي'], ['gov', 'المحافظة'], ['ven', 'المورّد'],
  ['sub', 'المقاول الفرعي'], ['t2', 'التصنيف'], ['cm', 'ملاحظات'], ['x.cabType', 'نوع الخزانة'], ['x.cabModel', 'موديل الخزانة'], ['x.asp', 'ASP'],
  ['x.siteStatus', 'حالة الموقع'], ['x.city', 'المدينة'], ['x.region', 'المنطقة'], ['x.subRegion', 'المنطقة الفرعية'], ['x.siteAddr', 'عنوان (سجل الموقع)'], ['x.btsAddr', 'عنوان (قاعدة BTS)'],
];
const labelOf = (f) => FIELDS.find((x) => x[0] === f)?.[1] || FIELD_LABELS[f.replace(/^x\./, '')] || f;
const rawVal = (id, f) => { const r = state.byId.get(String(id)); if (!r) return null; const o = rawRow(r); return f.startsWith('x.') ? o.x?.[f.slice(2)] : o[f]; };
const today = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const isExpired = (u) => u && u <= today();

let list = [];                                            // قائمة التصحيحات الديناميكية الحالية

async function save(ctx, next) {
  const res = await ctx.api('/api/corrections', { method: 'POST', body: JSON.stringify({ list: next }) });
  if (!res.ok) throw new Error(res.status === 401 ? 'انتهت الجلسة' : 'تعذّر الحفظ');
  const j = await res.json();
  list = j.list; LS.set('brm_corr', { v: j.v, list: j.list });
  setDynamic(j.list); setRows(state.rows, state.meta);            // يظهر فوراً عندك، وعند الآخرين خلال دقيقة تقريباً
  document.dispatchEvent(new CustomEvent('botrm:data'));
}

export async function tabFix(el, ctx) {
  el.innerHTML = skeleton('list');
  try { const r = await fetch('/api/corrections', { cache: 'no-store' }); list = r.ok ? (await r.json()).list || [] : []; ctx.status(r.ok); } catch { list = []; ctx.status(false); }
  if (ctx.tab() !== 'fix' || !el.isConnected) return;

  const render = () => {
    const rows = list.map((c, i) => {
      const old = rawVal(c.id, c.field);
      const st = isExpired(c.until) ? pill('منتهٍ', '') : pill('نشط', 'ok');
      return [`<b class="en">${esc(c.id)}</b>`, esc(labelOf(c.field)), old ? esc(old) : '<span class="muted">—</span>', c.value === '' ? pill('مخفي', 'warn') : esc(c.value), c.until ? `<span class="en">${esc(c.until)}</span>` : '<span class="muted">دائم</span>', st, esc(c.note || ''), `<button class="btn sm" data-del="${i}" type="button">${ICONS.trash}</button>`];
    });
    const built = builtinList().flatMap((o) => [...Object.entries(o.set || {}).map(([k, v]) => [o.id, k, v]), ...(o.dropX || []).map((k) => [o.id, `x.${k}`, ''])])
      .map(([id, f, v]) => [`<b class="en">${esc(id)}</b>`, esc(labelOf(f)), '<span class="muted">—</span>', v === '' ? pill('مخفي', 'warn') : esc(v), '<span class="muted">—</span>', pill('مدمج في الكود', ''), '', '']);
    $('#fxl').innerHTML = table(['الموقع', 'الحقل', 'الأصلي (إكسل)', 'الجديد', 'ينتهي', 'الحالة', 'ملاحظة', ''], rows.concat(built), { empty: 'لا توجد تصحيحات بعد.' });
    $('#fxl').querySelectorAll('[data-del]').forEach((b) => { b.onclick = async () => { b.disabled = true; try { await save(ctx, list.filter((_, i) => i !== +b.dataset.del)); toast('حُذف التصحيح'); render(); } catch (e) { toast(e.message); b.disabled = false; } }; });
  };

  el.innerHTML = `${pgHead('التصحيحات', 'تعديل ما يراه المستخدمون لموقع واحد فوراً، بدون إعادة رفع الإكسل. يعود الأصل تلقائياً عند انتهاء التاريخ.')}
    <div class="note">التصحيح يُطبَّق على العرض فقط ولا يغيّر ملف الإكسل ولا النسخ المنشورة. يصل للمستخدمين خلال دقيقة أو دقيقتين. لإلغاء إخفاء حقل احذف التصحيح.</div>
    ${pn('إضافة تصحيح', 'اختر الموقع والحقل، ثم اكتب القيمة الجديدة (اتركها فارغة لإخفاء الحقل)', `<form class="fxf" id="fxForm" autocomplete="off">
      <label>رقم الموقع<input class="inp ltr" id="fxId" inputmode="numeric" required placeholder="مثال: 4940"></label>
      <label>الحقل<select class="inp" id="fxField">${FIELDS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      <label class="fxw">القيمة الجديدة<input class="inp" id="fxVal" placeholder="اتركه فارغاً لإخفاء الحقل"></label>
      <label>ينتهي في (اختياري)<input class="inp ltr" id="fxUntil" type="date" min="${today()}"></label>
      <label>ملاحظة (اختياري)<input class="inp" id="fxNote" maxlength="80" placeholder="سبب التصحيح"></label>
      <div class="fxo" id="fxOld">اكتب رقم الموقع لعرض قيمته الحالية.</div>
      <button class="btn pri" type="submit">${ICONS.check}إضافة التصحيح</button></form>`, { icon: ICONS.edit })}
    ${pn('التصحيحات الحالية', `${list.length} تصحيح من الإدارة`, '<div id="fxl"></div>', { icon: ICONS.log })}`;
  render();

  const showOld = () => {
    const id = $('#fxId').value.trim(), f = $('#fxField').value, r = state.byId.get(id);
    $('#fxOld').innerHTML = !id ? 'اكتب رقم الموقع لعرض قيمته الحالية.' : !r ? '<span class="dn">هذا الموقع غير موجود في البيانات.</span>' : `القيمة الأصلية في الإكسل: <b>${esc(rawVal(id, f) || 'فارغة')}</b>`;
  };
  $('#fxId').oninput = showOld; $('#fxField').onchange = showOld;
  $('#fxForm').onsubmit = async (e) => {
    e.preventDefault();
    const id = $('#fxId').value.trim().replace(/\D/g, ''), field = $('#fxField').value;
    if (!state.byId.has(id)) return toast('رقم الموقع غير موجود');
    const entry = { id, field, value: $('#fxVal').value.trim(), until: $('#fxUntil').value, note: $('#fxNote').value.trim() };
    const btn = e.submitter; btn.disabled = true;
    try { await save(ctx, list.filter((c) => !(c.id === id && c.field === field)).concat(entry)); toast('تمت الإضافة وسيصل للمستخدمين خلال دقيقة'); $('#fxForm').reset(); showOld(); render(); }
    catch (err) { toast(err.message); }
    btn.disabled = false;
  };
}

/* ============ فحص الصحة ============ */
const CHK_LABEL = { sync: 'مزامنة التطبيق (/api/sync)', data: 'ملف البيانات (data.json)' };
async function clientCheck(id, url, opt) {
  const t = performance.now();
  try { const r = await fetch(url, { cache: 'no-store', ...opt }); return { id, name: CHK_LABEL[id], ok: r.ok, ms: Math.round(performance.now() - t), note: r.ok ? 'يعمل' : `HTTP ${r.status}` }; }
  catch { return { id, name: CHK_LABEL[id], ok: false, ms: Math.round(performance.now() - t), note: 'تعذّر الاتصال' }; }
}

export function healthPanel(ctx) {
  const body = '<div id="hcBody"><div class="muted pn-empty">اضغط «افحص الآن» لاختبار الخادم والتخزين والكاش وحزمة البيانات (قراءات فقط، لا تستهلك الكتابة).</div></div>';
  const html = pn('فحص صحة النظام', 'اختبار فوري لكل أجزاء الخدمة', body, { icon: ICONS.shield, actions: `<button class="btn sm" id="hcGo" type="button">${ICONS.refresh}افحص الآن</button>`, id: 'hcPn' });
  const wire = () => {
    $('#hcGo').onclick = async () => {
      const box = $('#hcBody'), btn = $('#hcGo'); btn.disabled = true; box.innerHTML = '<div class="hc-run"><i class="dot"></i>جارٍ الفحص…</div>';
      const [srv, a, b] = await Promise.all([ctx.api('/api/health').then((r) => (r.ok ? r.json() : null)).catch(() => null), clientCheck('sync', '/api/sync'), clientCheck('data', '/data.json', { method: 'HEAD' })]);
      const checks = [...(srv?.checks || [{ id: 'srv', name: 'اتصال بالخادم (الإدارة)', ok: false, ms: 0, note: 'تعذّر الوصول' }]), a, b];
      const bad = checks.filter((c) => !c.ok).length;
      box.innerHTML = `<div class="hc-sum ${bad ? 'bad' : 'ok'}">${bad ? `${ICONS.alert}${bad} من ${checks.length} يحتاج انتباهاً` : `${ICONS.check}كل الفحوصات سليمة (${checks.length}/${checks.length})`}</div>
        <div class="hc-list">${checks.map((c) => `<div class="hc ${c.ok ? 'ok' : 'bad'}"><i class="dot"></i><b>${esc(c.name)}</b><span>${esc(c.note || '')}</span><em class="en">${num(c.ms)} ms</em></div>`).join('')}</div>`;
      btn.disabled = false;
    };
  };
  return { html, wire };
}

/* ============ تنزيل البيانات الحالية (إكسل) ============ */
const MAIN_COLS = [['id', 'Site ID'], ['cl', 'Cluster'], ['st', 'Site Type'], ['nm', 'Site Name'], ['mn', 'Maintenance Name'], ['mp', 'Maintenance Number'], ['inv', 'Invoice Number'],
  ['sev', 'Severity'], ['io', 'Indoor or Outdoor'], ['gov', 'Govt'], ['own', 'Owner Number'], ['ven', 'Vendor'], ['ad', 'Announcement Date'], ['ah', 'Announcement Hybrid Date'],
  ['an', 'Announcement Normal Date'], ['sub', 'Subcontractor'], ['cm', 'Comment'], ['lon', 'Longitude'], ['lat', 'Latitude'], ['t2', 'Site Type2'], ['as', 'Associated']];

/** ملف إكسل بالبيانات المنشورة حالياً (بدون تصحيحات العرض)، بعناوين الأعمدة الأصلية ليمكن إعادة رفعه، وأعمدة الأوراق الإضافية بعدها */
export function downloadExcel() {
  const rows = state.rows.map(rawRow);
  const xKeys = [...new Set(rows.flatMap((r) => Object.keys(r.x || {})))];
  const head = [...MAIN_COLS.map((c) => c[1]), ...xKeys.map((k) => FIELD_LABELS[k] || k)];
  const data = rows.map((r) => [...MAIN_COLS.map(([k]) => (['lon', 'lat'].includes(k) && typeof r[k] === 'number' ? r[k] : r[k] ?? '')), ...xKeys.map((k) => r.x?.[k] ?? '')]);
  const blob = xlsxBlob([head, ...data], 'ألجدول العام');
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `botrm-data-${new Date().toISOString().slice(0, 10)}.xlsx`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`تم تنزيل ${num(rows.length)} موقع`);
}

/* ============ التحكمات (50 تحكماً) ============ */
let ctlSeq = 0;
export async function tabControls(el, ctx) {
  const my = ++ctlSeq;                                     // استدعاءان متداخلان: يكتمل الأحدث فقط
  el.innerHTML = skeleton('list');
  let doc = { v: 0, c: {}, fd: 0, fa: 0 };
  try { const r = await fetch('/api/controls', { cache: 'no-store' }); if (r.ok) doc = await r.json(); ctx.status(r.ok); } catch { ctx.status(false); }
  if (my !== ctlSeq || ctx.tab() !== 'ctl' || !el.isConnected) return;

  let draft = { ...DEFAULTS, ...doc.c };                   // القيم قيد التحرير (لم تُحفظ بعد)
  const dirtyKeys = () => Object.keys(DEFAULTS).filter((k) => JSON.stringify(draft[k]) !== JSON.stringify({ ...DEFAULTS, ...doc.c }[k]));

  const field = (c) => {
    const v = draft[c.k], id = `ct_${c.k}`;
    if (c.type === 'bool') return `<label class="tgl"><input type="checkbox" id="${id}" data-k="${c.k}"${v ? ' checked' : ''}><i></i><span class="sr">${esc(c.label)}</span></label>`;
    if (c.type === 'num') return `<span class="ctn"><input class="inp ltr" type="number" id="${id}" data-k="${c.k}" min="${c.min}" max="${c.max}" value="${v}" inputmode="numeric"><small>${esc(c.unit)}</small></span>`;
    if (c.type === 'text') return `<input class="inp" type="text" id="${id}" data-k="${c.k}" maxlength="${c.max}" value="${esc(v)}" placeholder="${c.def ? '' : 'الأصلي'}">`;
    if (c.type === 'select') return `<select class="inp" id="${id}" data-k="${c.k}">${c.options.map(([o, l]) => `<option value="${o}"${o === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const at = doc[c.k === 'forceData' ? 'fd' : 'fa'];
    return `<button class="btn" type="button" data-act="${c.k}">${esc(c.btn)}</button>${at ? `<small class="muted ctl-last">آخر مرة: ${new Date(at).toLocaleString('ar-IQ')}</small>` : ''}`;
  };
  const row = (c) => `<div class="ctr" data-key="${c.k}" data-txt="${esc(`${c.label} ${c.hint || ''}`)}"><div class="ctl-t"><b>${esc(c.label)}</b>${c.hint ? `<small>${esc(c.hint)}</small>` : ''}</div><div class="ctl-f">${field(c)}</div></div>`;
  const groupHtml = ([g, title, desc]) => {
    const items = CONTROLS.filter((c) => c.g === g);
    return `<section class="pn ctg" data-g="${g}"><header class="pn-h"><div class="pn-tt"><b>${esc(title)} <span class="muted">(${items.length})</span></b><small>${esc(desc)}</small></div><div class="pn-a"><button class="btn sm" type="button" data-reset="${g}">استعادة الافتراضي</button></div></header><div class="pn-b">${items.map(row).join('')}</div></section>`;
  };

  el.innerHTML = `${pgHead('التحكمات', `${CONTROLS.length} تحكماً في المنصة. التعديل لا يُطبَّق على المستخدمين إلا بعد «حفظ التغييرات».`)}
    <div class="note">تصل التغييرات إلى الأجهزة خلال دقيقة أو دقيقتين تقريباً (بلا إعادة نشر). إن أغلقت الواجهة ثم احتجت للدخول أثناء الصيانة استعمل الرابط <bdi dir="ltr" class="en"><b>/?admin</b></bdi>.</div>
    <div class="ctl-bar"><input class="inp" id="ctF" type="search" placeholder="ابحث في التحكمات…" aria-label="بحث"><span id="ctN" class="muted"></span></div>
    <div id="ctBody">${GROUPS.map(groupHtml).join('')}</div>
    <div class="ctl-save" id="ctS" hidden><span id="ctC"></span><button class="btn" type="button" id="ctX">تراجع</button><button class="btn pri" type="button" id="ctOk">${ICONS.save}حفظ التغييرات</button></div>`;

  const refreshBar = () => { const n = dirtyKeys().length; $('#ctS').hidden = !n; $('#ctC').textContent = `${n} تغيير غير محفوظ`; el.querySelectorAll('.ctr').forEach((r) => r.classList.toggle('dirty', dirtyKeys().includes(r.dataset.key))); };
  const read = (inp) => { const c = CONTROLS.find((x) => x.k === inp.dataset.k); draft[c.k] = c.type === 'bool' ? inp.checked : c.type === 'num' ? Number(inp.value) : inp.value; refreshBar(); };
  const wire = () => {
    el.querySelectorAll('[data-k]').forEach((i) => { i.oninput = () => read(i); i.onchange = () => read(i); });
    el.querySelectorAll('[data-reset]').forEach((b) => { b.onclick = () => { CONTROLS.filter((c) => c.g === b.dataset.reset && c.type !== 'action').forEach((c) => { draft[c.k] = c.def; }); redraw(); }; });
    el.querySelectorAll('[data-act]').forEach((b) => {
      b.onclick = async () => {
        if (!confirm('سيتأثر كل المستخدمين عند فتحهم للتطبيق. المتابعة؟')) return;
        b.disabled = true;
        try { const r = await ctx.api('/api/controls', { method: 'POST', body: JSON.stringify({ action: b.dataset.act }) }); if (!r.ok) throw new Error(); doc = await r.json(); saveControls(doc); toast('تم. سيصل الأمر للأجهزة خلال دقيقة'); redraw(); }
        catch { toast('تعذّر التنفيذ'); b.disabled = false; }
      };
    });
  };
  const redraw = () => { $('#ctBody').innerHTML = GROUPS.map(groupHtml).join(''); wire(); refreshBar(); filter(); };
  const filter = () => {
    const q = $('#ctF').value.trim(); let n = 0;
    el.querySelectorAll('.ctr').forEach((r) => { const hit = !q || r.dataset.txt.includes(q); r.hidden = !hit; if (hit) n++; });
    el.querySelectorAll('.ctg').forEach((g) => { g.hidden = ![...g.querySelectorAll('.ctr')].some((r) => !r.hidden); });
    $('#ctN').textContent = q ? `${n} نتيجة` : '';
  };
  $('#ctF').oninput = filter;
  $('#ctX').onclick = () => { draft = { ...DEFAULTS, ...doc.c }; redraw(); };
  $('#ctOk').onclick = async () => {
    const btn = $('#ctOk'); btn.disabled = true;
    try {
      const r = await ctx.api('/api/controls', { method: 'POST', body: JSON.stringify({ c: cleanControls(draft) }) });
      if (!r.ok) throw new Error(r.status === 401 ? 'انتهت الجلسة' : 'تعذّر الحفظ');
      doc = await r.json(); saveControls(doc); applyControls();
      draft = { ...DEFAULTS, ...doc.c }; toast('تم الحفظ — ظهر عندك الآن وسيصل للباقين خلال دقيقة'); redraw();
    } catch (e) { toast(e.message || 'تعذّر الحفظ'); }
    btn.disabled = false;
  };
  wire(); refreshBar();
}
