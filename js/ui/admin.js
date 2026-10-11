/** لوحة الإدارة: التقارير، تحديث البيانات، الإعدادات (تُحمَّل عند الضغط على «الإدارة» فقط) */
import { $, esc, toast } from '../lib/dom.js';
import { LS } from '../lib/storage.js';
import { govName } from '../lib/labels.js';
import { CFG, state, setRows } from '../data/store.js';
import { ymd } from '../data/analytics.js';
import { tabBroadcast, tabAlerts, tabSecurity } from './adminExtra.js';
import { FIELD_LABELS } from './fields.js';
import { ICONS } from '../lib/icons.js';

const Core = window.BotCore;

/* ---------------- لوحة الإدارة ---------------- */
const api = (path, opt = {}) => fetch(path, { ...opt, headers: { 'content-type': 'application/json', authorization: `Bearer ${cred}`, ...(opt.headers || {}) }, cache: 'no-store' });
let cred = null;                       // رمز الجلسة (من الخادم) في الذاكرة فقط
let weakPw = false;                   // كلمة المرور ما زالت الافتراضية                       // "user:password" في الذاكرة فقط (يُرسل للخادم عند النشر)
const isAdmin = () => Boolean(cred);
const dlg = $('#dlg');
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
function openDlg() { if (!dlg.open) dlg.showModal(); }
const closeBtn = '<button class="btn ghost" type="button" onclick="document.getElementById(\'dlg\').close()" aria-label="إغلاق">✕</button>';
function login(err) {
  dlg.style.width = 'min(400px,calc(100vw - 20px))';
  dlg.innerHTML = `<div class="dh"><b>🔐 دخول الإدارة</b>${closeBtn}</div><div class="db"><form class="form" id="lf" autocomplete="off">
    <div><label>اسم المستخدم</label><input class="inp ltr" id="lu" autocapitalize="off" autocomplete="username" required></div>
    <div><label>كلمة المرور</label><input class="inp ltr" id="lp" type="password" autocomplete="current-password" required></div>
    <button class="btn pri" style="justify-content:center;height:46px">دخول</button><div class="err" id="le">${err || ''}</div></form></div>`;
  setTimeout(() => $('#lu') && $('#lu').focus(), 50);
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    const user = $('#lu').value.trim(), pass = $('#lp').value, btn = $('#lf button'), le = $('#le');
    btn.disabled = true; le.textContent = '';
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user, pass }), cache: 'no-store' });
      if (res.ok) { const j = await res.json(); cred = j.token; weakPw = j.weak; return panel(); }
      const j = await res.json().catch(() => ({}));
      if (res.status === 429) le.textContent = `محاولات كثيرة خاطئة. أعد المحاولة بعد ${j.retryMin || 15} دقيقة.`;
      else if (res.status === 501) le.textContent = 'تخزين الخادم (KV) غير مربوط بعد، لا يمكن فتح الإدارة. اربط KV باسم DATA وأعد النشر.';
      else le.textContent = `اسم المستخدم أو كلمة المرور غير صحيحة${j.left != null ? ` (متبقي ${j.left} محاولات)` : ''}`;
    } catch { le.textContent = 'تعذّر الاتصال بالخادم. تأكد من الإنترنت.'; }
    btn.disabled = false;
  };
}
let tab = 'rep';
function panel() {
  dlg.style.width = '';
  dlg.innerHTML = `<div class="dh"><b>⚙️ لوحة الإدارة</b><div style="display:flex;gap:8px"><button class="btn ghost" id="lo" type="button">خروج</button>${closeBtn}</div></div>
    <div class="tabs"><button class="tab" data-t="rep">${ICONS.chart} التقارير</button><button class="tab" data-t="alr">${ICONS.bell} التنبيهات</button><button class="tab" data-t="bc">${ICONS.megaphone} البث</button><button class="tab" data-t="upd">${ICONS.upload} البيانات</button><button class="tab" data-t="sec">${ICONS.shield} الأمان</button></div>${weakPw ? '<div class="note warn" style="margin:10px 10px 0">⚠️ كلمة المرور ما زالت الافتراضية. غيّرها من تبويب «الأمان».</div>' : ''}<div class="db" id="tb"></div>`;
  $('#lo').onclick = () => { cred = null; dlg.close(); };
  dlg.querySelectorAll('.tab').forEach(b => b.onclick = () => { tab = b.dataset.t; showTab(); });
  showTab();
}
function showTab() {
  dlg.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  ({ rep: tabReports, alr: (el) => tabAlerts(el, api, () => tab), bc: (el) => tabBroadcast(el, api, () => tab), upd: tabUpdate, sec: tabSecurity })[tab]($('#tb'));
}

/* ----- التقارير ----- */
const fmtDay = (k) => `${k.slice(6)}/${k.slice(4, 6)}`;
const bars = (rows, max, ltr) => rows.map(([name, n]) => `<div class="bar"><span${ltr ? ' class="en" style="direction:ltr;text-align:start"' : ''}>${esc(name)}</span><i style="width:${Math.round(n / max * 100)}%"></i><em>${n}</em></div>`).join('');
const merge = (lists) => { const m = {}; lists.forEach((l) => (l || []).forEach(([k, n]) => { m[k] = (m[k] || 0) + n; })); return Object.entries(m).sort((a, b) => b[1] - a[1]); };

async function loadStats(range) {
  const res = await api(`/api/stats?days=${range}`);
  if (res.status === 501) throw new Error('not-configured');
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error(`http-${res.status}`);
  return res.json();
}

/** خريطة حرارية: الأيام × ساعات اليوم */
function heatmap(days) {
  const max = Math.max(1, ...days.flatMap((d) => d.h));
  if (!days.some((d) => d.s)) return '';
  const rows = days.map((d) => `<div class="hmr"><span>${d.label}</span><div>${d.h.map((n, i) => `<i title="${d.label} ${i}:00 — ${n}" style="--v:${(n / max).toFixed(2)}"></i>`).join('')}</div></div>`).join('');
  return `<div class="h4">خريطة حرارية: متى يُستخدم التطبيق (الأيام × الساعات)</div><div class="hm">${rows}<div class="hmr hml"><span></span><div><b>0</b><b>6</b><b>12</b><b>18</b><b>23</b></div></div></div>`;
}

async function tabReports(el) {
  const range = Number(LS.get('brm_range', 14)) || 14;
  el.innerHTML = '<div class="skel h"></div><div class="skel"></div><div class="skel"></div><div class="skel h"></div>';
  let st = null, why = '';
  try { st = await loadStats(range); } catch (e) { why = e.message; }
  if (tab !== 'rep' || !el.isConnected) return;

  const localLog = LS.get('brm_log', []);
  let days;
  if (st) days = st.days.map((d) => ({ ...d, label: fmtDay(d.day) }));
  else {
    const by = {}; localLog.forEach((l) => { const k = ymd(new Date(l[0])); (by[k] ||= [0, 0]); by[k][0]++; if (!l[2]) by[k][1]++; });
    days = Array.from({ length: range }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (range - 1 - i)); const k = ymd(d); const v = by[k] || [0, 0]; return { day: k, label: fmtDay(k), s: v[0], m: v[1], u: 0, h: Array(24).fill(0), top: [], miss: [] }; });
  }
  const sum = (n, f = 's') => days.slice(-n).reduce((t, x) => t + x[f], 0);
  const today = days.at(-1), y = days.at(-2) || { s: 0 };
  const rate = (a, b) => (b ? Math.round((1 - a / b) * 100) : 0);
  const max = Math.max(1, ...days.map((x) => x.s));
  const W = 560, H = 190, bw = W / days.length;
  const chart = days.map((x, i) => {
    const h = Math.round((x.s / max) * (H - 50)), bx = i * bw + bw * .17, w = bw * .66, by = H - 24 - h;
    const hit = x.m ? Math.round(x.m / max * (H - 50)) : 0;
    return `<g><rect x="${bx.toFixed(1)}" y="${by}" width="${w.toFixed(1)}" height="${Math.max(h, 2)}" rx="5" fill="${i === days.length - 1 ? 'var(--acc)' : 'color-mix(in srgb,var(--acc) 45%,transparent)'}"/>${hit ? `<rect x="${bx.toFixed(1)}" y="${H - 24 - hit}" width="${w.toFixed(1)}" height="${hit}" rx="3" fill="var(--s2)" opacity=".85"/>` : ''}<text class="val" x="${(bx + w / 2).toFixed(1)}" y="${by - 5}" text-anchor="middle">${x.s || ''}</text>${days.length <= 15 || i % 2 === 0 ? `<text x="${(bx + w / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${x.label}</text>` : ''}</g>`;
  }).join('');
  const hours = Array(24).fill(0); days.forEach((d) => d.h.forEach((n, i) => { hours[i] += n; }));
  const hMax = Math.max(1, ...hours), peak = hours.indexOf(Math.max(...hours));
  const hrs = hours.map((n, i) => `<i title="${i}:00 — ${n}" style="height:${Math.max(3, Math.round(n / hMax * 100))}%;${i === peak && n ? 'background:var(--acc)' : ''}"></i>`).join('');
  const top = st ? merge(days.map((d) => d.top)).slice(0, 10) : Object.entries(localLog.reduce((a, l) => { if (l[2]) a[l[1]] = (a[l[1]] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const miss = st ? merge(days.map((d) => d.miss)).slice(0, 10) : [];
  const recent = st ? st.recent.slice(0, 15) : localLog.slice().reverse().slice(0, 15).map((l) => [l[0], l[1], l[2], 'هذا']);
  const govDemand = st ? merge(days.map((d) => d.gov)).map(([g, n]) => [govName(g) || g, n]).slice(0, 8) : [];
  const gv = {}; state.rows.forEach((r) => { const g = govName(r.gov) || 'غير محدد'; gv[g] = (gv[g] || 0) + 1; });
  const gvl = Object.entries(gv).sort((a, b) => b[1] - a[1]);
  const delta = y.s ? Math.round((today.s - y.s) / y.s * 100) : 0;

  const banner = st ? '<div class="note ok">🟢 متصل بالخادم — الأرقام لكل المستخدمين ومن كل الأجهزة.</div>'
    : why === 'not-configured' ? '<div class="note warn">⚠️ تخزين الخادم (KV) غير مربوط بالمشروع، لذلك التقارير من هذا الجهاز فقط. اربط مساحة KV باسم <b class="en">DATA</b> ثم أعد النشر.</div>'
    : why === 'unauthorized' ? '<div class="note warn">⚠️ بيانات الدخول غير مقبولة من الخادم. سجّل الخروج وادخل من جديد.</div>'
    : '<div class="note warn">⚠️ تعذّر الاتصال بالخادم (إنترنت أو انقطاع مؤقت). الأرقام من هذا الجهاز فقط — اضغط تحديث للمحاولة مجدداً.</div>';

  el.innerHTML = `${banner}
    <div class="rbar"><div class="seg">${[7, 14, 30].map((n) => `<button type="button" data-r="${n}" class="${n === range ? 'on' : ''}">${n} يوم</button>`).join('')}</div><span style="flex:1"></span><button class="btn" id="rfr" type="button">${ICONS.refresh}تحديث</button><button class="btn" id="rcsv" type="button">${ICONS.download}CSV</button></div>
    <div class="kpis"><div class="kpi acc"><small>بحث اليوم</small><b>${today.s}</b>${y.s ? `<em class="${delta >= 0 ? 'up' : 'dn'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% عن أمس</em>` : ''}</div>
      <div class="kpi"><small>أمس</small><b>${y.s}</b></div><div class="kpi"><small>آخر 7 أيام</small><b>${sum(7)}</b></div><div class="kpi"><small>آخر ${range} يوم</small><b>${sum(range)}</b></div>
      ${st ? `<div class="kpi"><small>أجهزة فريدة اليوم</small><b>${today.u}</b></div>` : ''}
      <div class="kpi bad"><small>بدون نتيجة (${range} يوم)</small><b>${sum(range, 'm')}</b><em>${rate(sum(range, 'm'), sum(range)) }% نجاح</em></div></div>
    <div class="h4">عدد عمليات البحث يومياً <span class="lg"><i></i>غير موجود</span></div>
    <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="عدد عمليات البحث اليومية">${chart}</svg></div>
    ${st ? `<div class="h4">ساعات الذروة (بتوقيت بغداد) ${hours[peak] ? `— الأعلى ${peak}:00` : ''}</div><div class="hrs">${hrs}</div><div class="hlab"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>` : ''}
    ${st ? heatmap(days) : ''}
    ${govDemand.length ? `<div class="h4">المحافظات الأكثر طلباً (من مواقع وُجدت)</div>${bars(govDemand, govDemand[0][1])}` : ''}
    ${top.length ? `<div class="h4">الأكثر بحثاً ${st ? '(كل المستخدمين)' : '(هذا الجهاز)'}</div>${bars(top, top[0][1], true)}` : ''}
    ${miss.length ? `<div class="h4">بحث بلا نتيجة — مواقع مطلوبة وغير موجودة</div>${bars(miss, miss[0][1], true)}` : ''}
    <div class="h4">توزيع المواقع حسب المحافظة</div>${bars(gvl, gvl[0]?.[1] || 1)}
    <div class="h4">آخر عمليات البحث ${st ? '(كل الأجهزة)' : '(هذا الجهاز)'}</div>
    ${recent.length ? `<table class="tbl"><tr><th>الوقت</th><th>البحث</th><th>الجهاز</th><th>النتيجة</th></tr>${recent.map((l) => `<tr><td>${new Date(l[0]).toLocaleString('en-GB', { hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td><td style="direction:ltr;text-align:start">${esc(l[1])}</td><td class="en muted">${esc(l[3] || '')}</td><td>${l[2] ? '✅' : '❌'}</td></tr>`).join('')}</table>` : '<div class="muted">لا توجد عمليات بعد.</div>'}
    <div class="sp"></div><button class="btn ghost" id="clrlog" type="button">مسح سجل هذا الجهاز</button>`;

  el.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => { LS.set('brm_range', Number(b.dataset.r)); tabReports(el); });
  $('#rfr').onclick = () => tabReports(el);
  $('#clrlog').onclick = () => { LS.del('brm_log'); document.dispatchEvent(new CustomEvent('botrm:log')); toast('تم المسح'); tabReports(el); };
  $('#rcsv').onclick = () => {
    const csv = ['التاريخ,عدد البحث,بدون نتيجة,أجهزة فريدة'].concat(days.map((d) => `${d.day},${d.s},${d.m},${d.u}`)).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `botrm-report-${ymd()}.csv`; document.body.appendChild(a); a.click(); a.remove();
  };
}

/* ----- تحديث البيانات ----- */
let staged = null;
function tabUpdate(el) {
  el.innerHTML = `<div class="note">ارفع ملف الإكسل الجديد (نفس الشكل: ورقة <b>الجدول العام</b>). سيتم فحصه ومقارنته بالبيانات الحالية قبل النشر.</div>
    <label class="drop" id="dz"><input type="file" id="fi" accept=".xlsx,.xlsm,.xls" hidden><b>اضغط لاختيار الملف أو اسحبه هنا</b>Excel (.xlsx)</label>
    <div id="prev"></div>
    <div class="h4">✏️ تعديل موقع واحد</div>
    <form class="row" id="edq" autocomplete="off"><input class="inp ltr" id="edid" inputmode="numeric" placeholder="رقم الموقع" style="min-width:120px"><button class="btn" type="submit">${ICONS.search} فتح</button></form><div id="edform"></div>
    <div class="h4">🕘 سجل النسخ المنشورة</div><div id="vers"><div class="note">جارٍ التحميل…</div></div>`;
  loadVersions();
  $('#edq').onsubmit = (e) => { e.preventDefault(); editSite($('#edid').value.trim()); };
  const fi = $('#fi'), dz = $('#dz');
  fi.onchange = () => fi.files[0] && handleFile(fi.files[0]);
  ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('on'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('on'); }));
  dz.addEventListener('drop', e => e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]));
  if (staged) showStaged();
}
const SEVS = ['', 'S1', 'S2', 'S3'];
function editSite(id) {
  const box = $('#edform'), r = state.byId.get(id) || state.byId.get(String(parseInt(id, 10)));
  if (!r) { box.innerHTML = '<div class="note warn">لا يوجد موقع بهذا الرقم.</div>'; return; }
  const f = (k, label, ltr) => `<div><label>${label}</label><input class="inp${ltr ? ' ltr' : ''}" data-k="${k}" value="${esc(r[k] || '')}"></div>`;
  box.innerHTML = `<div class="note">تعديل الموقع <b class="en">${esc(r.id)}</b>. التعديل يُنشر لكل المستخدمين ويُسجَّل في سجل النسخ. <br><small>تنبيه: رفع ملف إكسل جديد لاحقاً يستبدل هذه التعديلات، فعدّلها في الإكسل أيضاً.</small></div>
    <div class="form" id="edf">${f('nm', 'العنوان')}${f('cl', 'الكلستر')}${f('mn', 'اسم الفني')}${f('mp', 'رقم الفني (الهاتف)', 1)}
    <div><label>الخطورة</label><select class="inp" data-k="sev">${SEVS.map((v) => `<option value="${v}"${(r.sev || '') === v ? ' selected' : ''}>${v || 'غير محدد'}</option>`).join('')}</select></div>
    <button class="btn pri" id="edsave" type="button" style="height:46px">${ICONS.save} حفظ ونشر للجميع</button><div class="err" id="eder"></div></div>`;
  $('#edsave').onclick = async () => {
    const b = $('#edsave'); b.disabled = true; $('#eder').textContent = '';
    try {
      const changes = {}; box.querySelectorAll('[data-k]').forEach((i) => { if (String(r[i.dataset.k] || '') !== i.value.trim()) changes[i.dataset.k] = i.value.trim(); });
      if (!Object.keys(changes).length) throw new Error('لم تغيّر أي حقل.');
      const rows = state.rows.map((x) => { const o = { ...x }; for (const k of Object.keys(o)) if (k.startsWith('_')) delete o[k]; return o.id === r.id ? { ...o, ...changes } : o; });
      const packet = await Core.seal(rows, '');
      await publishToAll(packet, { add: 0, chg: 1, rem: 0, name: `تعديل موقع ${r.id}` });
      setRows(rows, packet);
      document.dispatchEvent(new CustomEvent('botrm:data'));
      toast('تم حفظ التعديل ونشره'); box.innerHTML = '<div class="note ok">✅ تم حفظ التعديل ونشره لكل المستخدمين.</div>'; loadVersions();
    } catch (e) { $('#eder').textContent = '❌ ' + (e.message || e); b.disabled = false; }
  };
}

async function loadVersions() {
  const box = $('#vers'); if (!box) return;
  let log = [], backups = [];
  try {
    const r = await api('/api/versions');
    if (!r.ok) { box.innerHTML = `<div class="muted">${r.status === 501 ? 'غير متاح: KV غير مربوط.' : 'تعذّر تحميل السجل.'}</div>`; return; }
    const j = await r.json(); log = j.log; backups = j.backups || [];
  } catch { box.innerHTML = '<div class="muted">تعذّر الاتصال.</div>'; return; }
  if (!$('#vers')) return;
  const bk = backups.length ? `<div class="h4">🛟 نسخ احتياطية يومية (آخر ${backups.length})</div>${backups.map((v) => `<div class="alr"><span class="ai">🛟</span><div style="flex:1"><b>${new Date(v.ts).toLocaleDateString('en-GB')}</b><span>${v.count} موقع</span><br><button class="btn" data-restore="${esc(v.id)}" type="button">↩️ استعادة هذه النسخة</button></div></div>`).join('')}` : '';
  box.innerHTML = (log.length ? log.map((v, i) => `<div class="alr ${i === 0 ? 'ok' : ''}"><span class="ai">${v.restored ? '↩️' : '📦'}</span><div style="flex:1"><b>${esc(v.name || 'نسخة')} ${i === 0 ? '<small>(الحالية)</small>' : ''}</b>
      <span>${new Date(v.ts).toLocaleString('en-GB', { hour12: false })} · ${v.count} موقع${v.add || v.chg || v.rem ? ` · +${v.add} ~${v.chg} −${v.rem}` : ''}</span>
      ${i ? `<br><button class="btn" data-restore="${esc(v.id)}" type="button">↩️ تراجع لهذه النسخة</button>` : ''}</div></div>`).join('')
    : '<div class="muted">لا توجد نسخ بعد. تُسجَّل كل عملية نشر هنا مع إمكانية التراجع.</div>') + bk;
  box.querySelectorAll('[data-restore]').forEach((b) => b.onclick = async () => {
    if (!confirm('سيتم استبدال البيانات المنشورة لكل المستخدمين بهذه النسخة. متابعة؟')) return;
    b.disabled = true;
    const r = await api('/api/versions', { method: 'POST', body: JSON.stringify({ id: b.dataset.restore }) });
    if (r.ok) { toast('تم التراجع، سيصل المستخدمين خلال ثوانٍ'); try { const { fetchPacket, unlockPacket } = await import('../data/store.js'); const p = await fetchPacket(true); const rows = await unlockPacket(p); if (rows) { setRows(rows, p); document.dispatchEvent(new CustomEvent('botrm:data')); } } catch {} loadVersions(); }
    else { toast('فشل التراجع'); b.disabled = false; }
  });
}
function ensureXlsx() {
  return new Promise((res, rej) => {
    if (window.XLSX) return res();
    const s = document.createElement('script'); s.src = 'xlsx.mini.min.js'; s.onload = res; s.onerror = () => rej(new Error('تعذّر تحميل مكتبة Excel')); document.head.appendChild(s);
  });
}
async function handleFile(f) {
  const pv = $('#prev'); pv.innerHTML = '<div class="note">جارٍ قراءة الملف…</div>';
  try {
    await ensureXlsx();
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellFormula: false, cellStyles: false, cellNF: false, sheetStubs: false });
    const r = Core.parseWorkbook(XLSX, wb);
    if (!r.rows.length) throw new Error('لا توجد صفوف صالحة.');
    const flat = (r) => { const o = { ...r, ...(r.x || {}) }; delete o._s; delete o.x; return o; };
    const old = new Map(state.rows.map((x) => [x.id, flat(x)]));
    let add = 0, chg = 0, same = 0; const seen = new Set(), changes = [], added = [];
    r.rows.forEach((x) => {
      seen.add(x.id);
      const o = old.get(x.id);
      if (!o) { add++; added.push(x); return; }
      const n = flat(x), diffs = [];
      new Set([...Object.keys(o), ...Object.keys(n)]).forEach((k) => { if (String(o[k] ?? '') !== String(n[k] ?? '')) diffs.push([k, o[k], n[k]]); });
      if (diffs.length) { chg++; changes.push({ id: x.id, diffs }); } else same++;
    });
    const removed = []; old.forEach((v, k) => { if (!seen.has(k)) removed.push(v); });
    const rem = removed.length;
    staged = { rows: r.rows, warnings: r.warnings, sheet: r.sheet, name: f.name, add, chg, same, rem, changes, added, removed };
    showStaged();
  } catch (e) { pv.innerHTML = `<div class="note warn">❌ ${esc(e.message || e)}</div>`; }
}
/** يرسل الملف المشفّر إلى دالة النشر في الاستضافة ليصل لكل المستخدمين */
async function publishToAll(packet, meta) {
  let res;
  try {
    res = await api('/api/publish', { method: 'POST', headers: { 'x-meta': encodeURIComponent(JSON.stringify(meta)) }, body: JSON.stringify(packet) });
  } catch { throw new Error('تعذّر الاتصال بالخادم. تأكد من الإنترنت.'); }
  if (res.ok) return;
  const { error } = await res.json().catch(() => ({}));
  if (error === 'not-configured') throw new Error('تخزين النشر غير مفعّل في الاستضافة بعد (خطوة واحدة تُعمل مرة واحدة فقط).');
  if (error === 'unauthorized') throw new Error('انتهت الجلسة. سجّل الخروج ثم ادخل من جديد.');
  throw new Error(`فشل النشر (${res.status})`);
}

const cut = (v) => { const t = String(v ?? '').trim(); return t ? (t.length > 40 ? t.slice(0, 40) + '…' : t) : '—'; };
function diffHtml(s) {
  const lbl = (k) => FIELD_LABELS[k] || k;
  const ch = s.changes.slice(0, 40).map((c) => `<div class="dfr"><b class="en">${esc(c.id)}</b>${c.diffs.slice(0, 6).map(([k, o, n]) => `<div><span>${esc(lbl(k))}</span><del>${esc(cut(o))}</del><ins>${esc(cut(n))}</ins></div>`).join('')}${c.diffs.length > 6 ? `<small>+${c.diffs.length - 6} حقول أخرى</small>` : ''}</div>`).join('');
  const list = (arr, n = 30) => arr.slice(0, n).map((r) => `<span class="chip en">${esc(r.id)}</span>`).join('') + (arr.length > n ? `<small>+${arr.length - n}</small>` : '');
  return `${s.chg ? `<details><summary>✏️ المواقع المعدّلة (${s.chg}) — ما كان وما صار</summary><div class="dfs">${ch}${s.chg > 40 ? `<small>يعرض أول 40 من ${s.chg}</small>` : ''}</div></details>` : ''}
    ${s.add ? `<details><summary>➕ مواقع جديدة (${s.add})</summary><div class="chips">${list(s.added)}</div></details>` : ''}
    ${s.rem ? `<details open><summary>🗑️ مواقع ستُحذف (${s.rem})</summary><div class="chips">${list(s.removed)}</div></details>` : ''}`;
}

function showStaged() {
  const s = staged, pv = $('#prev');
  pv.innerHTML = `<div class="sp"></div><div class="kpis"><div class="kpi acc"><small>إجمالي المواقع</small><b>${s.rows.length}</b></div><div class="kpi"><small>جديدة</small><b>${s.add}</b></div><div class="kpi"><small>معدّلة</small><b>${s.chg}</b></div><div class="kpi bad"><small>محذوفة</small><b>${s.rem}</b></div></div>
    <div class="note">الملف: <b class="en">${esc(s.name)}</b> · الورقة: <b>${esc(s.sheet)}</b> · بدون تغيير: ${s.same}</div>
    ${s.warnings.length ? `<div class="note warn">${s.warnings.map(esc).join('<br>')}</div>` : ''}
    ${diffHtml(s)}
    <div class="form"><button class="btn pri" id="pub" type="button" style="height:48px;font-size:16px">🚀 نشر للجميع</button>
    <div class="err" id="ue"></div><div id="um"></div></div>`;
  $('#pub').onclick = async () => {
    const b = $('#pub'); b.disabled = true; $('#ue').textContent = ''; $('#um').innerHTML = '<div class="note">جارٍ النشر…</div>';
    try {
      const packet = await Core.seal(s.rows, '');
      await publishToAll(packet, { add: s.add, chg: s.chg, rem: s.rem, name: s.name });
      state.code = ''; LS.set('brm_code', ''); setRows(s.rows, packet);
      document.dispatchEvent(new CustomEvent('botrm:data'));
      $('#um').innerHTML = '<div class="note ok">✅ تم النشر. يصل التحديث لكل المستخدمين خلال ثوانٍ. إن حدث خطأ يمكنك التراجع من «سجل النسخ» أدناه.</div>';
      loadVersions();
      staged = null;
    } catch (e) { $('#um').innerHTML = ''; $('#ue').textContent = '❌ ' + (e.message || e); b.disabled = false; }
  };
}

export function openAdmin() {
  openDlg();
  isAdmin() ? panel() : login();
}
