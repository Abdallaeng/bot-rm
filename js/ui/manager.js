/** صفحة المدير: إحصاءات زين وتاسك والهايبرد وتقارير الشبكة للاجتماعات.
 *  الدخول عبر /api/mgr (رمز بدور «مدير» لا يصلح لعمليات الإدارة). الأرقام تُحسب في الجهاز من البيانات نفسها
 *  التي يراها التطبيق (بعد التصحيحات)، فلا كتابة ولا طلبات إضافية على الخادم. */
import { $, $$, esc, toast } from '../lib/dom.js';
import { govName } from '../lib/labels.js';
import { state, fetchPacket, unlockPacket, setRows, storedPacket } from '../data/store.js';
import { loadSaved } from '../data/overrides.js';
import { xlsxBlob } from '../lib/xlsxWrite.js';
import { num, pct } from './adminUI.js';
import { ICONS } from '../lib/icons.js';

const TOKEN_KEY = 'brm_mgr';
const root = $('#m');

/* ---------------- الجلسة ---------------- */
const readTok = () => { try { const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null'); return t && t.exp > Date.now() ? t : null; } catch { return null; } };
const saveTok = (t) => { try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t)); } catch { /* */ } };
const clearTok = () => { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* */ } };

async function tokenValid(t) {
  try { const r = await fetch('/api/mgr', { headers: { authorization: `Bearer ${t.token}` }, cache: 'no-store' }); return r.ok ? (await r.json()).ok === true : false; }
  catch { return true; }                    // بلا اتصال: نكمل بالرمز المحلي (البيانات محفوظة على الجهاز)
}

function showLogin(msg = '') {
  root.innerHTML = `<div class="gate mg-gate"><div class="card">
    <img src="icons/seal.png" alt="" width="64" height="64" class="mg-seal">
    <h2>لوحة المدير</h2><p>شركة ربوع المعالي — تقارير الشبكة للاجتماعات</p>
    <form id="lf"><input class="inp" id="lu" autocomplete="username" placeholder="اسم الدخول" required>
    <input class="inp" id="lp" type="password" autocomplete="current-password" placeholder="كلمة المرور" required>
    <button class="btn pri" style="width:100%;height:46px">دخول</button><div class="err" id="le" role="alert">${esc(msg)}</div></form></div></div>`;
  $('#lu').focus();
  $('#lf').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; $('#le').textContent = '';
    try {
      const r = await fetch('/api/mgr', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: $('#lu').value, pass: $('#lp').value }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.token) { saveTok({ token: j.token, exp: j.exp }); return start(); }
      $('#le').textContent = r.status === 429 ? `تم القفل مؤقتاً بسبب محاولات كثيرة. أعد المحاولة بعد ${j.retryMin || 15} دقيقة.`
        : r.status === 501 ? 'الخادم غير مهيّأ بعد.' : `بيانات الدخول غير صحيحة${j.left != null ? ` (متبقٍّ ${j.left} محاولات)` : ''}.`;
    } catch { $('#le').textContent = 'تعذّر الاتصال بالخادم.'; }
    btn.disabled = false; $('#lp').select();
  };
}

/* ---------------- البيانات ---------------- */
async function loadData() {
  let packet = await storedPacket();
  if (!packet || !packet.ct) packet = await fetchPacket();
  let rows = await unlockPacket(packet);
  if (!rows) {                                                        // البيانات مقفلة برمز الفريق
    const code = prompt('أدخل رمز الفريق');
    if (!code) throw new Error('locked');
    state.code = code.trim(); rows = await unlockPacket(packet);
    if (!rows) throw new Error('locked');
  }
  loadSaved();                                                        // تصحيحات الإدارة المحفوظة (مثل نوع موقع 4940)
  setRows(rows, packet);
  freshen();                                                          // بصمت: نسخة أحدث + تصحيحات الإدارة الحالية
}
async function freshen() {
  try {
    const s = await (await fetch('/api/sync', { cache: 'no-store' })).json();
    let changed = false;
    if (s.cv != null) {
      const c = await (await fetch('/api/corrections', { cache: 'no-store' })).json();
      const { setDynamic } = await import('../data/overrides.js'); setDynamic(c.list || []); changed = true;
    }
    if (s.updated && s.updated !== state.meta.updated) {
      const p = await fetchPacket(true, s.updated), rows = await unlockPacket(p);
      if (rows) { setRows(rows, p); changed = true; }
    } else if (changed) setRows(state.rows, state.meta);
    if (changed && $('#mg')) render();
  } catch { /* نكمل بما هو محفوظ */ }
}

/* ---------------- التصنيف ---------------- */
/** زين / تاسك من «نوع الموقع» (Site Type)، والهايبرد من (HYB) فيه — هذا هو المرجع، لا حقل «نوع البرج». */
const opOf = (r) => (/^\s*zain/i.test(r.st || '') ? 'Z' : /^\s*tasc/i.test(r.st || '') ? 'T' : '');
const isHyb = (r) => /\(\s*hyb/i.test(r.st || '');
const cell = (r) => `${opOf(r) || 'O'}${isHyb(r) ? 'h' : 'p'}`;           // Zp Zh Tp Th Op Oh

const DIMS = [
  ['gov', 'المحافظة', (r) => govName(r.gov) || '—'],
  ['cl', 'الكلستر', (r) => r.cl || '—'],
  ['ven', 'المورّد', (r) => r.ven || '—'],
  ['sev', 'الخطورة', (r) => r.sev || '—'],
  ['t2', 'التصنيف', (r) => r.t2 || '—'],
  ['io', 'داخلي / خارجي', (r) => r.io || '—'],
];

function tally(rows, keyFn) {
  const m = new Map();
  for (const r of rows) { const k = keyFn(r); const o = m.get(k) || { Zp: 0, Zh: 0, Tp: 0, Th: 0, Op: 0, Oh: 0 }; o[cell(r)]++; m.set(k, o); }
  return [...m.entries()].map(([k, o]) => ({ k, ...o, Z: o.Zp + o.Zh, T: o.Tp + o.Th, all: o.Zp + o.Zh + o.Tp + o.Th + o.Op + o.Oh }));
}

/* ---------------- العرض ---------------- */
let activeDim = 'gov';

function summary() {
  const rows = state.rows, o = tally(rows, () => 'all')[0] || { Zp: 0, Zh: 0, Tp: 0, Th: 0, Op: 0, Oh: 0, Z: 0, T: 0, all: 0 };
  return o;
}

const btn = (label, n, filt, cls = '') => `<button type="button" class="mg-n ${cls}" data-f="${esc(JSON.stringify(filt))}" title="عرض المواقع">${num(n)}</button>`;

function kpiCard(tone, label, n, sub, filt, note = '') {
  return `<button type="button" class="mg-k ${tone}" data-f="${esc(JSON.stringify(filt))}"><small>${label}</small><b data-n="${n}">${num(n)}</b><span>${sub}</span>${note ? `<em>${note}</em>` : ''}</button>`;
}

function opBars(S) {
  const max = Math.max(S.Z, S.T, 1);
  const row = (tone, name, p, h, op) => `<div class="mg-ob ${tone}"><div class="mg-ob-h"><b>${name}</b><span>${num(p + h)} موقع · ${pct(p + h, S.all)}% من الإجمالي</span></div>
    <div class="mg-track" style="width:${Math.max(6, Math.round(((p + h) / max) * 100))}%">
      <button type="button" class="seg p" style="flex:${p || 0.001}" data-f="${esc(JSON.stringify({ op, hyb: 0 }))}" title="عادي: ${num(p)}"><span>${num(p)}</span></button>
      <button type="button" class="seg h" style="flex:${h || 0.001}" data-f="${esc(JSON.stringify({ op, hyb: 1 }))}" title="هايبرد: ${num(h)}"><span>${num(h)}</span></button>
    </div><div class="mg-lg"><i class="p"></i>عادي ${num(p)} <i class="h"></i>هايبرد ${num(h)} (${pct(h, p + h)}% من ${name})</div></div>`;
  return row('z', 'زين', S.Zp, S.Zh, 'Z') + row('t', 'تاسك', S.Tp, S.Th, 'T');
}

function matrix(dimId) {
  const [, label, fn] = DIMS.find((d) => d[0] === dimId);
  const data = tally(state.rows, fn).sort((a, b) => (dimId === 'sev' ? String(a.k).localeCompare(String(b.k)) : b.all - a.all));
  const max = Math.max(1, ...data.map((d) => d.all));
  const f = (k, op, hyb) => ({ dim: dimId, val: k, op, hyb });
  const head = `<tr><th rowspan="2">${label}</th><th colspan="3" class="gz">زين</th><th colspan="3" class="gt">تاسك</th><th rowspan="2">الإجمالي</th><th rowspan="2" class="mg-bw"></th></tr>
    <tr><th class="gz">عادي</th><th class="gz">هايبرد</th><th class="gz">الكلي</th><th class="gt">عادي</th><th class="gt">هايبرد</th><th class="gt">الكلي</th></tr>`;
  const tr = (d) => `<tr><td class="nm">${esc(d.k)}</td>
    <td class="gz">${btn('', d.Zp, f(d.k, 'Z', 0))}</td><td class="gz">${btn('', d.Zh, f(d.k, 'Z', 1), 'hy')}</td><td class="gz tot">${btn('', d.Z, f(d.k, 'Z'))}</td>
    <td class="gt">${btn('', d.Tp, f(d.k, 'T', 0))}</td><td class="gt">${btn('', d.Th, f(d.k, 'T', 1), 'hy')}</td><td class="gt tot">${btn('', d.T, f(d.k, 'T'))}</td>
    <td class="tot">${btn('', d.all, { dim: dimId, val: d.k })}</td><td class="mg-bw"><i style="width:${Math.round((d.all / max) * 100)}%"></i></td></tr>`;
  const sum = (k) => data.reduce((a, d) => a + d[k], 0);
  const foot = `<tr class="ft"><td>المجموع</td><td class="gz">${num(sum('Zp'))}</td><td class="gz">${num(sum('Zh'))}</td><td class="gz">${num(sum('Z'))}</td><td class="gt">${num(sum('Tp'))}</td><td class="gt">${num(sum('Th'))}</td><td class="gt">${num(sum('T'))}</td><td>${num(sum('all'))}</td><td class="mg-bw"></td></tr>`;
  return `<div class="tbl-wrap"><table class="tbl2 mg-tbl"><thead>${head}</thead><tbody>${data.map(tr).join('')}</tbody><tfoot>${foot}</tfoot></table></div>`;
}

function insights(S) {
  const out = [];
  const best = (id) => tally(state.rows, DIMS.find((d) => d[0] === id)[2]).sort((a, b) => b.all - a.all);
  const g = best('gov')[0], c = best('cl')[0];
  if (g) out.push(`أكثر محافظة مواقعاً: <b>${esc(g.k)}</b> (${num(g.all)} موقع، زين ${num(g.Z)} · تاسك ${num(g.T)}).`);
  if (c) out.push(`أكبر كلستر: <b class="en">${esc(c.k)}</b> (${num(c.all)} موقع).`);
  const hy = tally(state.rows.filter(isHyb), DIMS[0][2]).sort((a, b) => b.all - a.all)[0];
  if (hy) out.push(`أكثر محافظة بمواقع هايبرد: <b>${esc(hy.k)}</b> (${num(hy.all)}: زين ${num(hy.Z)} · تاسك ${num(hy.T)}).`);
  const s1 = state.rows.filter((r) => r.sev === 'S1');
  if (s1.length) out.push(`مواقع الخطورة S1: <b>${num(s1.length)}</b> (زين ${num(s1.filter((r) => opOf(r) === 'Z').length)} · تاسك ${num(s1.filter((r) => opOf(r) === 'T').length)}).`);
  if (S.Op + S.Oh) out.push(`<span class="dn">تنبيه:</span> ${num(S.Op + S.Oh)} موقع نوعه ليس زين ولا تاسك (راجع «نوع الموقع» في الإكسل).`);
  return out;
}

function render() {
  const S = summary(), hy = S.Zh + S.Th, upd = state.meta.updated ? new Date(state.meta.updated).toLocaleString('en-GB', { hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const keep = $('.mg-tabs [aria-selected=true]')?.dataset.d || activeDim;
  activeDim = keep;
  root.innerHTML = `<div id="mg">
  <header class="mg-top"><div class="mg-brand"><img src="icons/seal.png" alt="" width="44" height="44"><div><h1>لوحة المدير</h1><small>شركة ربوع المعالي · آخر تحديث للبيانات <bdi dir="ltr" class="en">${upd}</bdi></small></div></div>
    <div class="mg-acts">
      <button class="btn" type="button" id="mgPresent">${ICONS.chart || ''}وضع العرض</button>
      <button class="btn" type="button" id="mgPrint">${ICONS.print || ''}طباعة / PDF</button>
      <button class="btn" type="button" id="mgXls">${ICONS.download || ''}Excel</button>
      <button class="btn" type="button" id="mgRef" title="تحديث">${ICONS.refresh || ''}</button>
      <button class="btn" type="button" id="mgOut">${ICONS.logout || ''}خروج</button>
    </div></header>

  <section class="mg-kpis" aria-label="الأرقام الرئيسية">
    ${kpiCard('z', 'زين الكلي', S.Z, `عادي ${num(S.Zp)} + هايبرد ${num(S.Zh)}`, { op: 'Z' })}
    ${kpiCard('t', 'تاسك الكلي', S.T, `عادي ${num(S.Tp)} + هايبرد ${num(S.Th)}`, { op: 'T' })}
    ${kpiCard('z h', 'هايبرد زين', S.Zh, `${pct(S.Zh, S.Z)}% من مواقع زين`, { op: 'Z', hyb: 1 })}
    ${kpiCard('t h', 'هايبرد تاسك', S.Th, `${pct(S.Th, S.T)}% من مواقع تاسك`, { op: 'T', hyb: 1 })}
  </section>
  <div class="mg-strip"><span>إجمالي المواقع <b>${num(state.rows.length)}</b></span><span>إجمالي الهايبرد <b>${num(hy)}</b> (${pct(hy, state.rows.length)}%)</span><span>زين عادي <b>${num(S.Zp)}</b></span><span>تاسك عادي <b>${num(S.Tp)}</b></span></div>

  <section class="pn"><header class="pn-h"><div class="pn-tt"><b>توزيع المواقع بين المشغّلين</b><small>الجزء المخطّط = مواقع هايبرد. اضغط على أي جزء لعرض مواقعه.</small></div></header><div class="pn-b mg-ops">${opBars(S)}</div></section>

  <section class="pn"><header class="pn-h"><div class="pn-tt"><b>ملاحظات سريعة للاجتماع</b><small>تُحسب تلقائياً من البيانات الحالية</small></div></header><div class="pn-b"><ul class="mg-ins">${insights(S).map((t) => `<li>${t}</li>`).join('')}</ul></div></section>

  <section class="pn"><header class="pn-h"><div class="pn-tt"><b>تقارير الشبكة</b><small>اختر التقرير، واضغط أي رقم لعرض المواقع التي يمثّلها</small></div></header>
    <div class="pn-b"><div class="mg-tabs" role="tablist">${DIMS.map(([id, l]) => `<button type="button" role="tab" data-d="${id}" aria-selected="${id === activeDim}">${l}</button>`).join('')}</div>
    ${DIMS.map(([id, l]) => `<div class="mg-rep" data-r="${id}" role="tabpanel"${id === activeDim ? '' : ' hidden'}><h3 class="mg-pt">تقرير الشبكة بحسب ${l}</h3>${matrix(id)}</div>`).join('')}</div></section>
  <footer class="mg-foot">Bot Rm · للاستخدام الداخلي · طُبع ${new Date().toLocaleDateString('en-GB')}</footer>
  </div>
  <dialog id="mgDlg" class="mg-dlg"></dialog>`;
  wire(S);
}

/* ---------------- التفاعل ---------------- */
function pred(f) {
  const dim = f.dim && DIMS.find((d) => d[0] === f.dim);
  return (r) => (!f.op || opOf(r) === f.op) && (f.hyb == null || (f.hyb ? isHyb(r) : !isHyb(r))) && (!dim || dim[2](r) === f.val);
}
const titleOf = (f) => [f.op === 'Z' ? 'زين' : f.op === 'T' ? 'تاسك' : 'كل المشغّلين', f.hyb === 1 ? 'هايبرد' : f.hyb === 0 ? 'عادي' : 'الكلي', f.dim ? `${DIMS.find((d) => d[0] === f.dim)[1]}: ${f.val}` : ''].filter(Boolean).join(' · ');

function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const stamp = () => new Date().toISOString().slice(0, 10);

function openList(f) {
  const rows = state.rows.filter(pred(f)).sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  const dlg = $('#mgDlg'), CAP = 400;
  const row = (r) => `<tr><td class="en"><b>${esc(r.id)}</b></td><td>${esc(r.nm || '—')}</td><td>${esc(govName(r.gov) || '—')}</td><td class="en">${esc(r.cl || '—')}</td><td class="en">${esc(r.st || '—')}</td><td class="en">${esc(r.ven || '—')}</td><td>${esc(r.sev || '—')}</td></tr>`;
  dlg.innerHTML = `<div class="dh"><b>${esc(titleOf(f))} <span class="muted">(${num(rows.length)} موقع)</span></b><button class="btn sm" type="button" id="dX" aria-label="إغلاق">${ICONS.close}</button></div>
    <div class="db"><div class="mg-lbar"><input class="inp" id="dQ" type="search" placeholder="بحث داخل القائمة (رقم، عنوان، كلستر…)"><button class="btn" type="button" id="dXls">${ICONS.download || ''}تنزيل Excel</button></div>
    <div class="tbl-wrap"><table class="tbl2"><thead><tr><th>الموقع</th><th>العنوان</th><th>المحافظة</th><th>الكلستر</th><th>النوع</th><th>المورّد</th><th>الخطورة</th></tr></thead><tbody id="dB"></tbody></table></div><p class="muted" id="dN"></p></div>`;
  const paint = () => {
    const q = $('#dQ').value.trim().toLowerCase();
    const list = q ? rows.filter((r) => [r.id, r.nm, govName(r.gov), r.cl, r.st, r.ven].join(' ').toLowerCase().includes(q)) : rows;
    $('#dB').innerHTML = list.slice(0, CAP).map(row).join('') || '<tr><td colspan="7" class="muted">لا توجد مواقع.</td></tr>';
    $('#dN').textContent = list.length > CAP ? `يعرض أول ${CAP} من ${num(list.length)} — استخدم البحث أو نزّل الملف الكامل.` : '';
  };
  paint();
  $('#dQ').oninput = paint;
  $('#dX').onclick = () => dlg.close();
  $('#dXls').onclick = () => {
    const head = ['رقم الموقع', 'العنوان', 'المحافظة', 'الكلستر', 'نوع الموقع', 'المورّد', 'الخطورة', 'اسم الفني', 'رقم الفني'];
    download(xlsxBlob([head, ...rows.map((r) => [r.id, r.nm || '', govName(r.gov) || '', r.cl || '', r.st || '', r.ven || '', r.sev || '', r.mn || '', r.mp || ''])], 'المواقع'), `botrm-${stamp()}.xlsx`);
  };
  dlg.showModal();
}

function exportSummary() {
  const head = ['التقرير', 'القيمة', 'زين عادي', 'زين هايبرد', 'زين الكلي', 'تاسك عادي', 'تاسك هايبرد', 'تاسك الكلي', 'الإجمالي'];
  const out = [head];
  const S = summary();
  out.push(['الإجمالي', 'كل المواقع', S.Zp, S.Zh, S.Z, S.Tp, S.Th, S.T, state.rows.length]);
  for (const [id, l, fn] of DIMS) for (const d of tally(state.rows, fn).sort((a, b) => b.all - a.all)) out.push([l, d.k, d.Zp, d.Zh, d.Z, d.Tp, d.Th, d.T, d.all]);
  download(xlsxBlob(out, 'ملخص الشبكة'), `botrm-manager-${stamp()}.xlsx`);
  toast('تم تنزيل الملخص');
}

function wire(S) {
  $$('#mg [data-f]').forEach((b) => { b.onclick = () => openList(JSON.parse(b.dataset.f)); });
  $$('.mg-tabs [role=tab]').forEach((t) => {
    t.onclick = () => { activeDim = t.dataset.d; $$('.mg-tabs [role=tab]').forEach((x) => x.setAttribute('aria-selected', x === t)); $$('.mg-rep').forEach((p) => { p.hidden = p.dataset.r !== activeDim; }); };
  });
  $('#mgPrint').onclick = () => window.print();
  $('#mgXls').onclick = exportSummary;
  $('#mgRef').onclick = async () => { toast('جارٍ التحديث…'); await freshen(); toast('البيانات محدَّثة'); };
  $('#mgOut').onclick = () => { clearTok(); showLogin(); };
  $('#mgPresent').onclick = () => {
    const on = !document.body.classList.contains('present');
    document.body.classList.toggle('present', on);
    if (on) document.documentElement.requestFullscreen?.().catch(() => {}); else if (document.fullscreenElement) document.exitFullscreen?.();
  };
  $('#mgDlg').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.body.classList.remove('present'); });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.body.classList.remove('present'); });

/* ---------------- البدء ---------------- */
async function start() {
  const t = readTok();
  if (!t || !(await tokenValid(t))) { clearTok(); return showLogin(t ? 'انتهت الجلسة، سجّل الدخول من جديد.' : ''); }
  root.innerHTML = '<div class="gate"><div class="card"><p>جارٍ تحميل البيانات…</p></div></div>';
  try { await loadData(); } catch { return void (root.innerHTML = '<div class="gate"><div class="card"><h2>⚠️</h2><p>تعذّر تحميل البيانات. تأكد من الاتصال ثم أعد المحاولة.</p><button class="btn pri" onclick="location.reload()">إعادة المحاولة</button></div></div>'); }
  render();
}
start();
