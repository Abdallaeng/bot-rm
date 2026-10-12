/** لوحة الإدارة: نظرة عامة، التقارير، التنبيهات، البث، البيانات، سجل العمليات، الأمان (تُحمَّل عند الضغط على «الإدارة» فقط) */
import { $, esc, toast } from '../lib/dom.js';
import { LS } from '../lib/storage.js';
import { govName } from '../lib/labels.js';
import { CFG, state, setRows, fixSwappedCoords } from '../data/store.js';
import { ymd } from '../data/analytics.js';
import { tabBroadcast, tabAlerts, tabSecurity } from './adminExtra.js';
import { tabOverview, tabAudit } from './adminOverview.js';
import { FIELD_LABELS } from './fields.js';
import { applyHistory, editHistory } from '../data/history.js';
import { ICONS } from '../lib/icons.js';
import { emptyState } from '../lib/art.js';
import { countUp } from './effects.js';
import { pgHead, pn, kpi, pill, table, spark, bars, merge, dayChart, hoursChart, fmtDay, fmtDT, num, pct } from './adminUI.js';

const Core = window.BotCore;

/* ---------------- الجلسة والاتصال ---------------- */
const api = (path, opt = {}) => fetch(path, { ...opt, headers: { 'content-type': 'application/json', authorization: `Bearer ${cred}`, ...(opt.headers || {}) }, cache: 'no-store' });
let cred = null;                       // رمز الجلسة (من الخادم) في الذاكرة فقط
let weakPw = false;                    // كلمة المرور ما زالت الافتراضية
let expAt = 0;                         // وقت انتهاء الجلسة (ms)
let sessTimer = 0;
const isAdmin = () => Boolean(cred) && Date.now() < expAt;
const dlg = $('#dlg');
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
dlg.addEventListener('close', () => { clearInterval(sessTimer); document.body.classList.remove('no-scroll'); });
function openDlg() { if (!dlg.open) dlg.showModal(); }

function sessionText() {
  const m = Math.max(0, Math.floor((expAt - Date.now()) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} ساعة و${m % 60} دقيقة متبقية` : `${m} دقيقة متبقية`;
}

/* ---------------- الدخول ---------------- */
function login(err) {
  dlg.className = 'adm login';
  dlg.innerHTML = `<div class="lg-card">
    <button class="btn ghost icon lg-x" type="button" id="lgX" aria-label="إغلاق">${ICONS.close}</button>
    <img src="icons/seal.png" width="68" height="68" alt="">
    <h2>لوحة الإدارة</h2><p>Bot Rm · شركة ربوع المعالي</p>
    <form class="form" id="lf" autocomplete="off">
      <div class="fld"><label for="lu">اسم المستخدم</label><div class="inw">${ICONS.user}<input id="lu" class="inp ltr" autocapitalize="off" autocomplete="username" required></div></div>
      <div class="fld"><label for="lp">كلمة المرور</label><div class="inw">${ICONS.key}<input id="lp" class="inp ltr" type="password" autocomplete="current-password" required><button type="button" class="eye" id="lpv" aria-label="إظهار كلمة المرور">إظهار</button></div></div>
      <button class="btn pri lg-go">دخول</button><div class="err" id="le" role="alert">${err || ''}</div>
    </form>
    <small class="lg-note">${ICONS.shield}اتصال محمي · يُقفل الدخول 15 دقيقة بعد 5 محاولات خاطئة</small></div>`;
  $('#lgX').onclick = () => dlg.close();
  $('#lpv').onclick = () => { const p = $('#lp'), on = p.type === 'password'; p.type = on ? 'text' : 'password'; $('#lpv').textContent = on ? 'إخفاء' : 'إظهار'; };
  setTimeout(() => $('#lu') && $('#lu').focus(), 50);
  $('#lf').onsubmit = async (e) => {
    e.preventDefault();
    const user = $('#lu').value.trim(), pass = $('#lp').value, btn = $('#lf .lg-go'), le = $('#le');
    btn.disabled = true; btn.textContent = 'جارٍ التحقق…'; le.textContent = '';
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user, pass }), cache: 'no-store' });
      if (res.ok) { const j = await res.json(); cred = j.token; weakPw = j.weak; expAt = j.exp; return panel(); }
      const j = await res.json().catch(() => ({}));
      if (res.status === 429) le.textContent = `محاولات كثيرة خاطئة. أعد المحاولة بعد ${j.retryMin || 15} دقيقة.`;
      else if (res.status === 501) le.textContent = 'تخزين الخادم (KV) غير مربوط بعد، لا يمكن فتح الإدارة. اربط KV باسم DATA وأعد النشر.';
      else le.textContent = `اسم المستخدم أو كلمة المرور غير صحيحة${j.left != null ? ` (متبقي ${j.left} محاولات)` : ''}`;
    } catch { le.textContent = 'تعذّر الاتصال بالخادم. تأكد من الإنترنت.'; }
    btn.disabled = false; btn.textContent = 'دخول';
  };
}

/* ---------------- الهيكل: رأس + قائمة جانبية + محتوى ---------------- */
const NAV = [['ov', 'نظرة عامة', 'home'], ['rep', 'التقارير', 'chart'], ['alr', 'التنبيهات', 'bell'], ['bc', 'البث', 'megaphone'], ['upd', 'البيانات', 'upload'], ['log', 'سجل العمليات', 'log'], ['sec', 'الأمان', 'shield']];
let tab = LS.get('brm_admtab', 'ov');
if (!NAV.some((n) => n[0] === tab)) tab = 'ov';

const ctx = {
  api, tab: () => tab, sessionText,
  go: (t) => { tab = t; LS.set('brm_admtab', t); showTab(); },
  status: (ok) => { const p = $('#stConn'); if (p) { p.className = `pill ${ok ? 'ok' : 'bad'}`; p.innerHTML = `<i class="dot"></i>${ok ? 'متصل بالخادم' : 'غير متصل بالخادم'}`; } },
  badge: (t, n, tone = 'warn') => { const b = $(`.ni[data-t="${t}"] .nb`); if (!b) return; b.hidden = !n; b.textContent = n; b.className = `nb ${tone}`; },
};

function panel() {
  dlg.className = 'adm console';
  dlg.innerHTML = `<header class="ah">
      <div class="ah-brand"><img src="icons/seal.png" width="40" height="40" alt=""><div><b>لوحة الإدارة</b><small>Bot Rm · شركة ربوع المعالي</small></div></div>
      <div class="ah-pills"><span class="pill" id="stConn"><i class="dot"></i>جارٍ الاتصال…</span><span class="pill" id="stSess">${ICONS.clock}<span>${sessionText()}</span></span></div>
      <div class="ah-act"><button class="btn sm" id="lo" type="button">${ICONS.logout}<span>خروج</span></button><button class="btn sm icon" id="ahX" type="button" aria-label="إغلاق">${ICONS.close}</button></div>
    </header>
    ${weakPw ? `<div class="astrip warn" role="alert">${ICONS.alert}<span><span class="long">كلمة مرور الإدارة ما زالت <b>الافتراضية</b> — أي شخص يعرفها يستطيع نشر البيانات وإرسال الإعلانات.</span><span class="short">كلمة المرور <b>افتراضية</b> — غيّرها الآن</span></span><button class="btn sm" id="weakGo" type="button">غيّرها الآن</button></div>` : ''}
    <div class="abody">
      <nav class="anav" aria-label="أقسام الإدارة">${NAV.map(([id, label, ic]) => `<button class="ni" type="button" data-t="${id}">${ICONS[ic]}<span>${label}</span><i class="nb" hidden></i></button>`).join('')}</nav>
      <main class="amain" id="tb" tabindex="-1"></main>
    </div>`;
  $('#lo').onclick = () => { cred = null; expAt = 0; dlg.close(); toast('تم تسجيل الخروج'); };
  $('#ahX').onclick = () => dlg.close();
  $('#weakGo')?.addEventListener('click', () => ctx.go('sec'));
  dlg.querySelectorAll('.ni').forEach((b) => { b.onclick = () => ctx.go(b.dataset.t); });
  clearInterval(sessTimer);
  sessTimer = setInterval(() => {
    if (!isAdmin()) { clearInterval(sessTimer); cred = null; login('انتهت الجلسة، سجّل الدخول من جديد.'); return; }
    const t = $('#stSess span'), o = $('#ovSess'); if (t) t.textContent = sessionText(); if (o) o.textContent = sessionText();
  }, 30000);
  showTab();
}

function showTab() {
  dlg.querySelectorAll('.ni').forEach((b) => { const on = b.dataset.t === tab; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const main = $('#tb');
  main.scrollTop = 0;
  ({ ov: (el) => tabOverview(el, ctx), rep: tabReports, alr: (el) => tabAlerts(el, api, () => tab), bc: (el) => tabBroadcast(el, api, () => tab), upd: tabUpdate, log: (el) => tabAudit(el, ctx), sec: (el) => tabSecurity(el, api, ctx) })[tab](main);
}

/* ---------------- التقارير ---------------- */
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
  if (!days.some((d) => d.s)) return '<div class="muted pn-empty">لا توجد بيانات كافية.</div>';
  const rows = days.map((d) => `<div class="hmr"><span>${d.label}</span><div>${d.h.map((n, i) => `<i title="${d.label} ${i}:00 — ${n}" style="--v:${(n / max).toFixed(2)}"></i>`).join('')}</div></div>`).join('');
  return `<div class="hm">${rows}<div class="hmr hml"><span></span><div><b>0</b><b>6</b><b>12</b><b>18</b><b>23</b></div></div></div>`;
}

const WD = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const dayName = (k) => WD[new Date(`${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6)}T12:00:00`).getDay()];
const siteInfo = (id) => {
  const r = state.byId.get(String(id));
  return r ? [esc(r.cl || '—'), esc(govName(r.gov) || '—'), esc(r.mn || '—'), r.sev ? `<span class="bd ${r.sev.toLowerCase()}">${esc(r.sev)}</span>` : '—'] : ['—', '—', '—', '—'];
};

async function tabReports(el) {
  const range = Number(LS.get('brm_range', 14)) || 14;
  el.innerHTML = '<div class="skel h"></div><div class="skel"></div><div class="skel"></div><div class="skel h"></div>';
  let st = null, why = '';
  try { st = await loadStats(range); } catch (e) { why = e.message; }
  if (tab !== 'rep' || !el.isConnected) return;
  ctx.status(Boolean(st));

  const localLog = LS.get('brm_log', []);
  let days;
  if (st) days = st.days.map((d) => ({ ...d, label: fmtDay(d.day) }));
  else {
    const by = {}; localLog.forEach((l) => { const k = ymd(new Date(l[0])); (by[k] ||= [0, 0]); by[k][0]++; if (!l[2]) by[k][1]++; });
    days = Array.from({ length: range }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (range - 1 - i)); const k = ymd(d); const v = by[k] || [0, 0]; return { day: k, label: fmtDay(k), s: v[0], m: v[1], u: 0, w: 0, h: Array(24).fill(0), top: [], miss: [], gov: [] }; });
  }
  const sum = (n, f = 's') => days.slice(-n).reduce((t, x) => t + x[f], 0);
  const today = days.at(-1), y = days.at(-2) || { s: 0 };
  const delta = y.s ? Math.round(((today.s - y.s) / y.s) * 100) : null;
  const total = sum(range), missTotal = sum(range, 'm'), active = days.filter((d) => d.s).length;
  const seriesOf = (field) => (key) => days.map((d) => (d[field] || []).find(([k]) => k === key)?.[1] || 0);
  const trend = st && days.length > 2;

  const topAll = st ? merge(days.map((d) => d.top)) : Object.entries(localLog.reduce((a, l) => { if (l[2]) a[l[1]] = (a[l[1]] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const top = topAll.slice(0, 15);
  const miss = st ? merge(days.map((d) => d.miss)).slice(0, 15) : [];
  const recent = st ? st.recent.slice(0, 20) : localLog.slice().reverse().slice(0, 20).map((l) => [l[0], l[1], l[2], 'هذا']);
  const hours = Array(24).fill(0); days.forEach((d) => d.h.forEach((n, i) => { hours[i] += n; }));
  const peak = hours.indexOf(Math.max(...hours));

  /* الطلب حسب المحافظة مقابل عدد المواقع */
  const supply = {}; state.rows.forEach((r) => { supply[r.gov || ''] = (supply[r.gov || ''] || 0) + 1; });
  const demand = st ? merge(days.map((d) => d.gov)) : [];
  const govRows = Object.entries(supply).sort((a, b) => b[1] - a[1]).map(([g, n]) => {
    const dm = demand.find(([k]) => k === g)?.[1] || 0;
    return [esc(govName(g) || 'غير محدد'), num(n), num(dm), st ? (n ? (dm / n * 100).toFixed(1) : '0') : '—', trend ? spark(seriesOf('gov')(g)) : '—'];
  });

  /* الطلب حسب الكلستر والفني (من المواقع الأكثر بحثاً) */
  const byCl = {}, byTech = {};
  topAll.forEach(([id, n]) => { const r = state.byId.get(String(id)); if (!r) return; byCl[r.cl || 'غير محدد'] = (byCl[r.cl || 'غير محدد'] || 0) + n; const t = (r.mn || '').trim() || 'بدون فني'; byTech[t] = (byTech[t] || 0) + n; });
  const clList = Object.entries(byCl).sort((a, b) => b[1] - a[1]).slice(0, 8), techList = Object.entries(byTech).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const banner = st ? '<div class="note ok">متصل بالخادم — الأرقام لكل المستخدمين ومن كل الأجهزة.</div>'
    : why === 'not-configured' ? '<div class="note warn">⚠️ تخزين الخادم (KV) غير مربوط بالمشروع، لذلك التقارير من هذا الجهاز فقط. اربط مساحة KV باسم <b class="en">DATA</b> ثم أعد النشر.</div>'
    : why === 'unauthorized' ? '<div class="note warn">⚠️ بيانات الدخول غير مقبولة من الخادم. سجّل الخروج وادخل من جديد.</div>'
    : '<div class="note warn">⚠️ تعذّر الاتصال بالخادم (إنترنت أو انقطاع مؤقت). الأرقام من هذا الجهاز فقط — اضغط تحديث للمحاولة مجدداً.</div>';

  const dailyRows = days.slice().reverse().map((d) => {
    const pk = d.h.indexOf(Math.max(...d.h));
    return [`<b>${d.label}</b> <small class="muted">${dayName(d.day)}</small>`, num(d.s), num(d.s - d.m), d.m ? `<span class="dn">${num(d.m)}</span>` : '0', d.s ? `${100 - pct(d.m, d.s)}%` : '—', st ? num(d.u) : '—', st && d.s ? `${pk}:00` : '—'];
  });

  const topRows = top.map(([q, n]) => [`<b class="en">${esc(q)}</b>`, ...siteInfo(q), num(n), trend ? spark(seriesOf('top')(q)) : '—']);
  const missRows = miss.map(([q, n]) => [`<b class="en">${esc(q)}</b>`, num(n), trend ? spark(seriesOf('miss')(q)) : '—']);
  const devRows = (st?.devs || []).map(([d, n], i) => [`<span class="en">${i + 1}</span>`, `<code class="en">${esc(d.slice(0, 8))}</code>`, num(n), `<div class="meter"><i style="width:${Math.round(n / (st.devs[0][1] || 1) * 100)}%"></i></div>`]);

  el.innerHTML = `${pgHead('التقارير', `تحليل استخدام التطبيق${st ? ' من كل الأجهزة' : ' (هذا الجهاز فقط)'} — آخر ${range} يوم`,
    `<div class="seg">${[7, 14, 30].map((n) => `<button type="button" data-r="${n}" class="${n === range ? 'on' : ''}">${n} يوم</button>`).join('')}</div><button class="btn sm" id="rfr" type="button">${ICONS.refresh}تحديث</button><button class="btn sm" id="rcsv" type="button">${ICONS.download}CSV</button><button class="btn sm" id="rprint" type="button">${ICONS.print}طباعة</button>`)}
    ${banner}
    <div class="kcs c4">
      ${kpi('بحث اليوم', num(today.s), { tone: 'acc', icon: ICONS.search, delta, n: today.s })}
      ${kpi('أمس', num(y.s), { icon: ICONS.clock, n: y.s })}
      ${kpi('آخر 7 أيام', num(sum(7)), { icon: ICONS.chart, n: sum(7) })}
      ${kpi(`آخر ${range} يوم`, num(total), { icon: ICONS.chart, n: total, sub: `متوسط ${num(active ? Math.round(total / active) : 0)} في اليوم النشط` })}
      ${kpi('نسبة النجاح', total ? `${100 - pct(missTotal, total)}%` : '—', { icon: ICONS.check, tone: missTotal > total * 0.25 ? 'bad' : '', sub: `${num(missTotal)} بحث بلا نتيجة` })}
      ${st ? kpi('أجهزة اليوم', num(today.u), { icon: ICONS.users, n: today.u }) : ''}
      ${st ? kpi('ساعة الذروة', hours[peak] ? `${peak}:00` : '—', { icon: ICONS.clock, sub: 'بتوقيت بغداد' }) : ''}
      ${st ? kpi('كتابات KV اليوم', num(today.w), { icon: ICONS.database, title: 'الحد المجاني ≈ 1000 كتابة يومياً', sub: 'من 1,000' }) : ''}
    </div>
    ${pn('النشاط اليومي', 'عدد عمليات البحث كل يوم (البرتقالي = بلا نتيجة)', dayChart(days), { icon: ICONS.chart })}
    ${st ? `<div class="grid2">
      ${pn('ساعات الذروة', `بتوقيت بغداد${hours[peak] ? ` — الأعلى ${peak}:00` : ''}`, hoursChart(hours), { icon: ICONS.clock })}
      ${pn('خريطة الاستخدام', 'الأيام × ساعات اليوم', heatmap(days), { icon: ICONS.chart })}
    </div>` : ''}
    ${st ? pn('الطلب حسب المحافظة', 'عدد المواقع مقابل عمليات البحث (مواقع وُجدت) — «طلب لكل 100» يكشف المحافظات الأكثر حاجة للمتابعة', table(['المحافظة', 'المواقع', 'عمليات البحث', 'طلب لكل 100 موقع', 'الاتجاه'], govRows), { icon: ICONS.database }) : ''}
    ${pn('المواقع الأكثر بحثاً', 'مع الكلستر والمحافظة والفني والخطورة لكل موقع', table(['الموقع', 'الكلستر', 'المحافظة', 'الفني', 'الخطورة', 'مرات البحث', 'الاتجاه'], topRows, { empty: 'لا توجد عمليات بحث بعد.' }), { icon: ICONS.search })}
    ${clList.length ? `<div class="grid2">
      ${pn('الطلب حسب الكلستر', 'من المواقع الأكثر بحثاً', bars(clList, clList[0][1]), { icon: ICONS.database })}
      ${pn('الطلب حسب الفني', 'من المواقع الأكثر بحثاً', bars(techList, techList[0][1]), { icon: ICONS.user })}
    </div>` : ''}
    ${miss.length ? pn('بحث بلا نتيجة', 'مواقع يطلبها المستخدمون وغير موجودة — راجع إن كانت ناقصة من ملف الإكسل', table(['ما كُتب', 'عدد المرات', 'الاتجاه'], missRows), { icon: ICONS.alert, cls: 'warnp' }) : ''}
    ${pn('التفاصيل اليومية', 'كل يوم على حدة', table(['اليوم', 'عمليات البحث', 'وُجد', 'بلا نتيجة', 'نسبة النجاح', 'الأجهزة', 'الذروة'], dailyRows), { icon: ICONS.log })}
    ${st && devRows.length ? pn('أنشط الأجهزة اليوم', 'معرّفات مجهولة للأجهزة (لا أسماء) وعدد عمليات كل جهاز', table(['#', 'الجهاز', 'عمليات البحث', 'الحصة'], devRows), { icon: ICONS.users }) : ''}
    ${pn('آخر عمليات البحث', st ? 'من كل الأجهزة' : 'من هذا الجهاز', table(['الوقت', 'البحث', 'الجهاز', 'النتيجة'], recent.map((l) => [`<span class="en">${new Date(l[0]).toLocaleString('en-GB', { hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>`, `<b class="en" dir="ltr">${esc(l[1])}</b>`, `<code class="en">${esc(l[3] || '')}</code>`, l[2] ? pill('وُجد', 'ok') : pill('لم يوجد', 'bad')]), { empty: 'لا توجد عمليات بعد.' }), { icon: ICONS.clock })}
    <div class="sp"></div><button class="btn ghost sm" id="clrlog" type="button">${ICONS.trash}مسح سجل هذا الجهاز</button>`;

  countUp(el);
  el.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => { LS.set('brm_range', Number(b.dataset.r)); tabReports(el); });
  $('#rfr').onclick = () => tabReports(el);
  $('#clrlog').onclick = () => { LS.del('brm_log'); document.dispatchEvent(new CustomEvent('botrm:log')); toast('تم المسح'); tabReports(el); };
  $('#rprint').onclick = () => { document.body.classList.add('print-admin'); window.print(); setTimeout(() => document.body.classList.remove('print-admin'), 500); };
  $('#rcsv').onclick = () => {
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = ['التقرير اليومي', 'التاريخ,عدد البحث,وُجد,بلا نتيجة,نسبة النجاح %,أجهزة فريدة'].concat(days.map((d) => `${d.day},${d.s},${d.s - d.m},${d.m},${d.s ? 100 - pct(d.m, d.s) : ''},${d.u}`));
    lines.push('', 'الأكثر بحثاً', 'الموقع,الكلستر,المحافظة,الفني,العدد'); topAll.slice(0, 50).forEach(([id, n]) => { const r = state.byId.get(String(id)); lines.push([q(id), q(r?.cl || ''), q(govName(r?.gov) || ''), q(r?.mn || ''), n].join(',')); });
    lines.push('', 'بحث بلا نتيجة', 'ما كُتب,العدد'); merge(days.map((d) => d.miss)).forEach(([k, n]) => lines.push(`${q(k)},${n}`));
    lines.push('', 'الطلب حسب المحافظة', 'المحافظة,المواقع,عمليات البحث'); govRows.forEach((r) => lines.push([q(r[0].replace(/<[^>]+>/g, '')), r[1].replace(/,/g, ''), r[2].replace(/,/g, '')].join(',')));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `botrm-report-${ymd()}.csv`; document.body.appendChild(a); a.click(); a.remove();
  };
}

/* ----- تحديث البيانات ----- */
let staged = null;
function tabUpdate(el) {
  const ds = { sites: state.rows.length, upd: state.meta.updated };
  el.innerHTML = `${pgHead('البيانات', 'رفع ملف إكسل جديد ومراجعة الفروقات قبل نشرها لكل المستخدمين، وتعديل موقع واحد، واستعادة نسخة سابقة')}
    ${pn('تحديث البيانات من ملف إكسل', `النسخة الحالية: ${num(ds.sites)} موقع${ds.upd ? ` · آخر تحديث ${fmtDT(ds.upd)}` : ''}`,
    `<ol class="steps"><li class="on"><b>1</b>اختر الملف</li><li><b>2</b>راجع الفروقات</li><li><b>3</b>انشر للجميع</li></ol>
    <div class="note">الملف المطلوب: نفس شكل الملف الحالي (ورقة <b>الجدول العام</b>). لن يُنشر شيء قبل مراجعتك، ويمكنك التراجع بعد النشر من «سجل النسخ».</div>
    <label class="drop" id="dz"><input type="file" id="fi" accept=".xlsx,.xlsm,.xls" hidden>${ICONS.upload}<b>اضغط لاختيار الملف أو اسحبه هنا</b><span>Excel (.xlsx)</span></label>
    <div id="prev"></div>`, { icon: ICONS.upload })}
    ${pn('تعديل موقع واحد', 'تصحيح سريع يُنشر فوراً ويُسجَّل في سجل التغييرات', `<form class="row" id="edq" autocomplete="off"><input class="inp ltr" id="edid" inputmode="numeric" placeholder="رقم الموقع" style="min-width:120px"><button class="btn" type="submit">${ICONS.search} فتح الموقع</button></form><div id="edform"></div>`, { icon: ICONS.edit })}
    ${pn('سجل النسخ المنشورة', 'آخر 8 نسخ + نسخ احتياطية يومية — يمكن الرجوع لأي منها', '<div id="vers"><div class="note">جارٍ التحميل…</div></div>', { icon: ICONS.history })}`;
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
      const rows = state.rows.map((x) => { const o = { ...x }; for (const k of Object.keys(o)) if (k.startsWith('_')) delete o[k]; return o.id === r.id ? { ...o, ...changes, ch: editHistory(r, changes) } : o; });
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
  const row = (v, i, daily) => [
    `<b>${esc(v.name || 'نسخة')}</b> ${i === 0 && !daily ? pill('الحالية', 'ok') : v.restored ? pill('استعادة', 'warn') : daily ? pill('يومية') : ''}`,
    `<span class="en">${fmtDT(v.ts)}</span>`,
    `<span class="en">${num(v.count)}</span>`,
    v.add || v.chg || v.rem ? `<span class="up">+${v.add}</span> · ~${v.chg} · <span class="dn">−${v.rem}</span>` : '—',
    i || daily ? `<button class="btn sm" data-restore="${esc(v.id)}" type="button">${ICONS.history}استعادة</button>` : '',
  ];
  const cols = ['النسخة', 'التاريخ', 'المواقع', 'التغييرات', ''];
  box.innerHTML = (log.length ? table(cols, log.map((v, i) => row(v, i, false))) : emptyState('inbox', 'لا توجد نسخ بعد', 'تُسجَّل كل عملية نشر هنا مع إمكانية التراجع.'))
    + (backups.length ? `<div class="h4">نسخ احتياطية يومية (آخر ${backups.length})</div>${table(cols, backups.map((v) => row(v, 1, true)))}` : '');
  box.querySelectorAll('[data-restore]').forEach((b) => b.onclick = async () => {
    if (!confirm('سيتم استبدال البيانات المنشورة لكل المستخدمين بهذه النسخة. متابعة؟')) return;
    b.disabled = true;
    const r = await api('/api/versions', { method: 'POST', body: JSON.stringify({ id: b.dataset.restore }) });
    if (r.ok) { toast('تم التراجع، سيصل المستخدمين خلال دقيقة أو دقيقتين'); try { const { fetchPacket, unlockPacket } = await import('../data/store.js'); const p = await fetchPacket(true); const rows = await unlockPacket(p); if (rows) { setRows(rows, p); document.dispatchEvent(new CustomEvent('botrm:data')); } } catch {} loadVersions(); }
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
    const flat = (r) => { const o = { ...r, ...(r.x || {}) }; delete o.x; delete o.ch; Object.keys(o).forEach((k) => { if (k.startsWith('_')) delete o[k]; }); return o; };
    const old = new Map(state.rows.map((x) => [x.id, flat(x)]));
    let add = 0, chg = 0, same = 0; const seen = new Set(), changes = [], added = [];
    r.rows.forEach((x) => {
      seen.add(x.id);
      const o = old.get(x.id);
      if (!o) { add++; added.push(x); return; }
      const n = flat(x), diffs = []; fixSwappedCoords(n);
      new Set([...Object.keys(o), ...Object.keys(n)]).forEach((k) => { if (String(o[k] ?? '') !== String(n[k] ?? '')) diffs.push([k, o[k], n[k]]); });
      if (diffs.length) { chg++; changes.push({ id: x.id, diffs }); } else same++;
    });
    applyHistory(r.rows, state.rows, changes);              // سجل «ماذا تغيّر في هذا الموقع» يُحفظ مع الصف
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
  document.querySelectorAll('.steps li').forEach((li, i) => li.classList.toggle('on', i <= 1));
  pv.innerHTML = `<div class="sp"></div><div class="kcs">${kpi('إجمالي المواقع', num(s.rows.length), { tone: 'acc', icon: ICONS.database })}${kpi('جديدة', num(s.add), { icon: ICONS.check, tone: s.add ? 'ok' : '' })}${kpi('معدّلة', num(s.chg), { icon: ICONS.edit })}${kpi('محذوفة', num(s.rem), { icon: ICONS.trash, tone: s.rem ? 'bad' : '' })}</div>
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
      document.querySelectorAll('.steps li').forEach((li) => li.classList.add('on'));
      state.code = ''; LS.set('brm_code', ''); setRows(s.rows, packet);
      document.dispatchEvent(new CustomEvent('botrm:data'));
      $('#um').innerHTML = '<div class="note ok">✅ تم النشر. يصل التحديث تلقائياً لكل المستخدمين خلال دقيقة إلى دقيقتين دون أن يشعروا به. إن حدث خطأ يمكنك التراجع من «سجل النسخ» أدناه.</div>';
      loadVersions();
      staged = null;
    } catch (e) { $('#um').innerHTML = ''; $('#ue').textContent = '❌ ' + (e.message || e); b.disabled = false; }
  };
}

export function openAdmin() {
  openDlg();
  isAdmin() ? panel() : login();
}
