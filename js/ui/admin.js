/** لوحة الإدارة: التقارير، تحديث البيانات، الإعدادات (تُحمَّل عند الضغط على «الإدارة» فقط) */
import { $, esc, toast } from '../lib/dom.js';
import { LS } from '../lib/storage.js';
import { govName } from '../lib/labels.js';
import { CFG, state, setRows } from '../data/store.js';
import { ymd, getCount } from '../data/analytics.js';

const Core = window.BotCore;

/* ---------------- لوحة الإدارة ---------------- */
const sha = async (s) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map(b => b.toString(16).padStart(2, '0')).join('');
let cred = null;                       // "user:password" في الذاكرة فقط (يُرسل للخادم عند النشر)
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
    const user = $('#lu').value.trim(), pass = $('#lp').value;
    const h = await sha(user.toLowerCase() + ':' + pass);
    if (h === CFG.adminHash) { cred = `${user}:${pass}`; panel(); }
    else { $('#le').textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة'; }
  };
}
let tab = 'rep';
function panel() {
  dlg.style.width = '';
  dlg.innerHTML = `<div class="dh"><b>⚙️ لوحة الإدارة</b><div style="display:flex;gap:8px"><button class="btn ghost" id="lo" type="button">خروج</button>${closeBtn}</div></div>
    <div class="tabs"><button class="tab" data-t="rep">📊 التقارير</button><button class="tab" data-t="upd">⬆️ تحديث البيانات</button></div><div class="db" id="tb"></div>`;
  $('#lo').onclick = () => { cred = null; dlg.close(); };
  dlg.querySelectorAll('.tab').forEach(b => b.onclick = () => { tab = b.dataset.t; showTab(); });
  showTab();
}
function showTab() {
  dlg.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  ({ rep: tabReports, upd: tabUpdate })[tab]($('#tb'));
}

/* ----- التقارير ----- */
async function tabReports(el) {
  el.innerHTML = '<div class="note">جارٍ تحميل التقارير…</div>';
  const days = []; for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ k: ymd(d), d }); }
  const log = LS.get('brm_log', []);
  const localBy = {}; log.forEach(l => { const k = ymd(new Date(l[0])); (localBy[k] = localBy[k] || [0, 0]); localBy[k][0]++; if (!l[2]) localBy[k][1]++; });
  let online = true;
  const res = await Promise.all(days.map(async x => {
    try { const [s, m] = await Promise.all([getCount('s' + x.k), getCount('m' + x.k)]); return { ...x, s, m }; }
    catch (e) { online = false; const l = localBy[x.k] || [0, 0]; return { ...x, s: l[0], m: l[1] }; }
  }));
  if (tab !== 'rep' || !el.isConnected) return;   // المستخدم انتقل لتبويب آخر أثناء التحميل
  if (!online) res.forEach(x => { const l = localBy[x.k] || [0, 0]; x.s = l[0]; x.m = l[1]; });
  const sum = (a, n) => a.slice(-n).reduce((t, x) => t + x.s, 0);
  const today = res[res.length - 1], y = res[res.length - 2];
  const max = Math.max(1, ...res.map(x => x.s));
  const W = 560, H = 190, bw = W / res.length;
  const bars = res.map((x, i) => {
    const h = Math.round((x.s / max) * (H - 50)), bx = i * bw + bw * .17, w = bw * .66, by = H - 24 - h;
    return `<g><rect x="${bx.toFixed(1)}" y="${by}" width="${w.toFixed(1)}" height="${Math.max(h, 2)}" rx="5" fill="${i === res.length - 1 ? 'var(--acc)' : 'color-mix(in srgb,var(--acc) 45%,transparent)'}"/><text class="val" x="${(bx + w / 2).toFixed(1)}" y="${by - 5}" text-anchor="middle">${x.s || ''}</text><text x="${(bx + w / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${String(x.d.getDate()).padStart(2, '0')}/${String(x.d.getMonth() + 1).padStart(2, '0')}</text></g>`;
  }).join('');
  const logRev = log.slice().reverse();
  const cnt = {}; log.forEach(l => { if (l[2]) cnt[l[1]] = (cnt[l[1]] || 0) + 1; });
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topMax = top.length ? top[0][1] : 1;
  const gv = {}; state.rows.forEach(r => { const g = govName(r.gov) || 'غير محدد'; gv[g] = (gv[g] || 0) + 1; });
  const gvl = Object.entries(gv).sort((a, b) => b[1] - a[1]); const gm = gvl[0] ? gvl[0][1] : 1;
  el.innerHTML = `${online ? '' : '<div class="note warn">⚠️ تعذّر الوصول لخدمة العدّاد الأونلاين، الأرقام أدناه من هذا الجهاز فقط.</div>'}
    <div class="kpis"><div class="kpi acc"><small>بحث اليوم</small><b>${today.s}</b></div><div class="kpi"><small>أمس</small><b>${y.s}</b></div><div class="kpi"><small>آخر 7 أيام</small><b>${sum(res, 7)}</b></div><div class="kpi"><small>آخر 14 يوم</small><b>${sum(res, 14)}</b></div><div class="kpi bad"><small>بدون نتيجة (اليوم)</small><b>${today.m}</b></div></div>
    <div class="h4">عدد عمليات البحث يومياً ${online ? '(أونلاين — كل المستخدمين)' : '(هذا الجهاز)'}</div>
    <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="عدد عمليات البحث اليومية">${bars}</svg></div>
    ${top.length ? `<div class="h4">الأكثر بحثاً (على هذا الجهاز)</div>${top.map(t => `<div class="bar"><span class="en" style="direction:ltr;text-align:start">${esc(t[0])}</span><i style="width:${Math.round(t[1] / topMax * 100)}%"></i><em>${t[1]}</em></div>`).join('')}` : ''}
    <div class="h4">توزيع المواقع حسب المحافظة</div>${gvl.map(t => `<div class="bar"><span>${esc(t[0])}</span><i style="width:${Math.round(t[1] / gm * 100)}%"></i><em>${t[1]}</em></div>`).join('')}
    <div class="h4">آخر عمليات البحث (على هذا الجهاز)</div>
    ${logRev.length ? `<table class="tbl"><tr><th>الوقت</th><th>البحث</th><th>النتيجة</th></tr>${logRev.slice(0, 12).map(l => `<tr><td>${new Date(l[0]).toLocaleString('en-GB', { hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td><td style="direction:ltr;text-align:start">${esc(l[1])}</td><td>${l[2] ? '✅' : '❌'}</td></tr>`).join('')}</table>` : '<div class="muted">لا توجد عمليات بعد.</div>'}`;
  el.insertAdjacentHTML('beforeend', '<div class="sp"></div><button class="btn ghost" id="clrlog" type="button">مسح سجل هذا الجهاز</button>');
  $('#clrlog').onclick = () => { LS.del('brm_log'); document.dispatchEvent(new CustomEvent('botrm:log')); toast('تم المسح'); tabReports(el); };
}

/* ----- تحديث البيانات ----- */
let staged = null;
function tabUpdate(el) {
  el.innerHTML = `<div class="note">ارفع ملف الإكسل الجديد (نفس الشكل: ورقة <b>الجدول العام</b>). سيتم فحصه ومقارنته بالبيانات الحالية قبل النشر.</div>
    <label class="drop" id="dz"><input type="file" id="fi" accept=".xlsx,.xlsm,.xls" hidden><b>اضغط لاختيار الملف أو اسحبه هنا</b>Excel (.xlsx)</label>
    <div id="prev"></div>`;
  const fi = $('#fi'), dz = $('#dz');
  fi.onchange = () => fi.files[0] && handleFile(fi.files[0]);
  ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('on'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('on'); }));
  dz.addEventListener('drop', e => e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]));
  if (staged) showStaged();
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
    const old = new Map(state.rows.map(x => { const c = Object.assign({}, x); delete c._s; return [x.id, JSON.stringify(c)]; }));
    let add = 0, chg = 0, same = 0; const seen = new Set();
    r.rows.forEach(x => { seen.add(x.id); if (!old.has(x.id)) add++; else if (old.get(x.id) !== JSON.stringify(x)) chg++; else same++; });
    let rem = 0; old.forEach((v, k) => { if (!seen.has(k)) rem++; });
    staged = { rows: r.rows, warnings: r.warnings, sheet: r.sheet, name: f.name, add, chg, same, rem };
    showStaged();
  } catch (e) { pv.innerHTML = `<div class="note warn">❌ ${esc(e.message || e)}</div>`; }
}
/** يرسل الملف المشفّر إلى دالة النشر في الاستضافة ليصل لكل المستخدمين */
async function publishToAll(packet) {
  let res;
  try {
    res = await fetch('/api/publish', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin': cred }, body: JSON.stringify(packet) });
  } catch { throw new Error('تعذّر الاتصال بالخادم. تأكد من الإنترنت.'); }
  if (res.ok) return;
  const { error } = await res.json().catch(() => ({}));
  if (error === 'not-configured') throw new Error('تخزين النشر غير مفعّل في الاستضافة بعد (خطوة واحدة تُعمل مرة واحدة فقط).');
  if (error === 'unauthorized') throw new Error('بيانات الدخول غير صحيحة. سجّل الخروج ثم ادخل من جديد.');
  throw new Error(`فشل النشر (${res.status})`);
}

function showStaged() {
  const s = staged, pv = $('#prev');
  pv.innerHTML = `<div class="sp"></div><div class="kpis"><div class="kpi acc"><small>إجمالي المواقع</small><b>${s.rows.length}</b></div><div class="kpi"><small>جديدة</small><b>${s.add}</b></div><div class="kpi"><small>معدّلة</small><b>${s.chg}</b></div><div class="kpi bad"><small>محذوفة</small><b>${s.rem}</b></div></div>
    <div class="note">الملف: <b class="en">${esc(s.name)}</b> · الورقة: <b>${esc(s.sheet)}</b> · بدون تغيير: ${s.same}</div>
    ${s.warnings.length ? `<div class="note warn">${s.warnings.map(esc).join('<br>')}</div>` : ''}
    <div class="form"><button class="btn pri" id="pub" type="button" style="height:48px;font-size:16px">🚀 نشر للجميع</button>
    <div class="err" id="ue"></div><div id="um"></div></div>`;
  $('#pub').onclick = async () => {
    const b = $('#pub'); b.disabled = true; $('#ue').textContent = ''; $('#um').innerHTML = '<div class="note">جارٍ النشر…</div>';
    try {
      const packet = await Core.seal(s.rows, '');
      await publishToAll(packet);
      state.code = ''; LS.set('brm_code', ''); setRows(s.rows, packet);
      document.dispatchEvent(new CustomEvent('botrm:data'));
      $('#um').innerHTML = '<div class="note">✅ تم النشر. يصل التحديث لكل المستخدمين خلال ثوانٍ (عند فتحهم للتطبيق).</div>';
      staged = null;
    } catch (e) { $('#um').innerHTML = ''; $('#ue').textContent = '❌ ' + (e.message || e); b.disabled = false; }
  };
}

export function openAdmin() {
  openDlg();
  isAdmin() ? panel() : login();
}
