/** صفحة المدير: إحصاءات زين وتاسك والهايبرد وتقارير الشبكة للاجتماعات.
 *  الدخول: كلمة المرور أول مرة فقط، ثم بصمة الجهاز (WebAuthn) عبر /api/mgr. الرمز الناتج بدور «مدير» ولا يصلح لعمليات الإدارة.
 *  الأرقام تُحسب في الجهاز من البيانات نفسها التي يراها التطبيق (بعد التصحيحات): لا كتابة ولا طلبات إضافية على الخادم. */
import { $, $$, esc, toast } from '../lib/dom.js';
import { govName } from '../lib/labels.js';
import { state, fetchPacket, unlockPacket, setRows, storedPacket } from '../data/store.js';
import { loadSaved, setDynamic } from '../data/overrides.js';
import { xlsxBlob } from '../lib/xlsxWrite.js';
import { num, pct } from './adminUI.js';
import { ICONS } from '../lib/icons.js';

const TOKEN_KEY = 'brm_mgr', PK_KEY = 'brm_mgr_pk';
const root = $('#m');

/* ---------------- الجلسة ---------------- */
const readTok = () => { try { const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null'); return t && t.exp > Date.now() ? t : null; } catch { return null; } };
const saveTok = (t) => { try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t)); } catch { /* */ } };
const clearTok = () => { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* */ } };
const pkId = () => { try { return localStorage.getItem(PK_KEY) || ''; } catch { return ''; } };
const setPk = (id) => { try { id ? localStorage.setItem(PK_KEY, id) : localStorage.removeItem(PK_KEY); } catch { /* */ } };
const auth = () => ({ 'content-type': 'application/json', authorization: `Bearer ${readTok()?.token || ''}` });
const post = (body, headers = { 'content-type': 'application/json' }) => fetch('/api/mgr', { method: 'POST', headers, body: JSON.stringify(body) });

async function tokenValid(t) {
  try { const r = await fetch('/api/mgr', { headers: { authorization: `Bearer ${t.token}` }, cache: 'no-store' }); return r.ok ? (await r.json()).ok === true : false; }
  catch { return true; }                    // بلا اتصال: نكمل بالرمز المحلي (البيانات محفوظة على الجهاز)
}

/* ---------------- البصمة (WebAuthn) ---------------- */
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const passkeySupported = () => Boolean(window.PublicKeyCredential && navigator.credentials);
const challenge = async () => (await (await post({ action: 'chal' })).json()).challenge;

async function passkeyLogin() {
  const ch = await challenge(), id = pkId();
  const cred = await navigator.credentials.get({ publicKey: { challenge: new TextEncoder().encode(ch), rpId: location.hostname, userVerification: 'required', timeout: 60000, allowCredentials: id ? [{ type: 'public-key', id: unb64u(id) }] : [] } });
  const a = cred.response;
  const r = await post({ action: 'auth', assertion: { id: cred.id, clientDataJSON: b64u(a.clientDataJSON), authenticatorData: b64u(a.authenticatorData), signature: b64u(a.signature) } });
  return { r, j: await r.json().catch(() => ({})), id: cred.id };
}

async function passkeyRegister() {
  const ch = await challenge();
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: new TextEncoder().encode(ch), rp: { name: 'Bot Rm', id: location.hostname },
    user: { id: new TextEncoder().encode('manager-omar'), name: 'عمر', displayName: 'المدير عمر' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' }, attestation: 'none', timeout: 60000 } });
  const a = cred.response, label = /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone/iPad' : /Android/.test(navigator.userAgent) ? 'Android' : /Mac/.test(navigator.userAgent) ? 'Mac' : /Windows/.test(navigator.userAgent) ? 'Windows' : 'جهاز';
  const r = await post({ action: 'reg', label, cred: { id: cred.id, spki: b64u(a.getPublicKey()), alg: a.getPublicKeyAlgorithm(), clientDataJSON: b64u(a.clientDataJSON) } }, auth());
  if (!r.ok) throw new Error('reg');
  setPk(cred.id);
}

/* ---------------- شاشة الدخول ---------------- */
function showLogin(msg = '', tryPasskey = true) {
  const hasPk = passkeySupported() && pkId();
  root.innerHTML = `<div class="mg-login"><div class="mg-lcard">
    <img src="icons/seal.png" alt="" width="68" height="68">
    <h1>لوحة المدير</h1><p>شركة ربوع المعالي — تقارير الشبكة للاجتماعات</p>
    ${hasPk ? `<button class="mg-fp" type="button" id="fp"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M12 11v3.5a5.5 5.5 0 0 1-1.3 3.5M8 10.5a4 4 0 0 1 8 0V14c0 1.7-.4 3.3-1.2 4.7M5 11a7 7 0 0 1 14 0v1.5c0 2.6-.5 5-1.5 7M5 14.5c0 1.3-.2 2.5-.6 3.6M12 3v0"/></svg><span>الدخول بالبصمة</span></button>
    <button class="mg-lnk" type="button" id="usePw">استخدم كلمة المرور</button>` : ''}
    <form id="lf"${hasPk ? ' hidden' : ''}><input class="inp" id="lu" autocomplete="username" placeholder="اسم الدخول" required>
    <input class="inp" id="lp" type="password" autocomplete="current-password" placeholder="كلمة المرور" required>
    <button class="btn pri" style="width:100%;height:46px">دخول</button></form>
    <div class="err" id="le" role="alert">${esc(msg)}</div>
    ${hasPk ? '' : '<small class="mg-hint">بعد أول دخول تستطيع تفعيل البصمة فلا تحتاج كلمة المرور بعدها.</small>'}</div></div>`;
  const err = (t) => { $('#le').textContent = t; };
  const lockMsg = (j) => `تم القفل مؤقتاً بسبب محاولات كثيرة. أعد المحاولة بعد ${j.retryMin || 15} دقيقة.`;

  const byPasskey = async () => {
    const b = $('#fp'); b.disabled = true; err('');
    try {
      const { r, j, id } = await passkeyLogin();
      if (r.ok && j.token) { setPk(id); saveTok({ token: j.token, exp: j.exp }); return start(); }
      err(r.status === 429 ? lockMsg(j) : r.status === 401 && j.error === 'unknown-key' ? 'هذه البصمة لم تعد مسجّلة. ادخل بكلمة المرور وفعّلها من جديد.' : 'تعذّر التحقق من البصمة.');
      if (j.error === 'unknown-key') { setPk(''); }
    } catch (e) { err(e?.name === 'NotAllowedError' ? 'أُلغي طلب البصمة. اضغط الزر للمحاولة من جديد، أو استخدم كلمة المرور.' : 'تعذّر استخدام البصمة على هذا الجهاز.'); }
    b.disabled = false;
  };
  if (hasPk) {
    $('#fp').onclick = byPasskey;
    $('#usePw').onclick = () => { $('#lf').hidden = false; $('#usePw').hidden = true; $('#lu').focus(); };
    if (tryPasskey) byPasskey();
  } else $('#lu').focus();

  $('#lf').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; err('');
    try {
      const r = await post({ user: $('#lu').value, pass: $('#lp').value });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.token) { saveTok({ token: j.token, exp: j.exp }); return start(true); }
      err(r.status === 429 ? lockMsg(j) : r.status === 501 ? 'الخادم غير مهيّأ بعد.' : `بيانات الدخول غير صحيحة${j.left != null ? ` (متبقٍّ ${j.left} محاولات)` : ''}.`);
    } catch { err('تعذّر الاتصال بالخادم.'); }
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
    if (s.cv != null) { const c = await (await fetch('/api/corrections', { cache: 'no-store' })).json(); setDynamic(c.list || []); changed = true; }
    if (s.updated && s.updated !== state.meta.updated) {
      const p = await fetchPacket(true, s.updated), rows = await unlockPacket(p);
      if (rows) { setRows(rows, p); changed = true; }
    } else if (changed) setRows(state.rows, state.meta);
    if (changed && $('#mg')) { render(); if ($('#mgSl')?.classList.contains('on')) showSlide(slideNo); }
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
const dimOf = (id) => DIMS.find((d) => d[0] === id);

function tally(rows, keyFn) {
  const m = new Map();
  for (const r of rows) { const k = keyFn(r); const o = m.get(k) || { Zp: 0, Zh: 0, Tp: 0, Th: 0, Op: 0, Oh: 0 }; o[cell(r)]++; m.set(k, o); }
  return [...m.entries()].map(([k, o]) => ({ k, ...o, Z: o.Zp + o.Zh, T: o.Tp + o.Th, all: o.Zp + o.Zh + o.Tp + o.Th + o.Op + o.Oh }));
}
const summary = () => tally(state.rows, () => 'all')[0] || { Zp: 0, Zh: 0, Tp: 0, Th: 0, Op: 0, Oh: 0, Z: 0, T: 0, all: 0 };
const sorted = (dimId, rows) => tally(rows, dimOf(dimId)[2]).sort((a, b) => (dimId === 'sev' ? String(a.k).localeCompare(String(b.k)) : b.all - a.all));
const J = (f) => esc(JSON.stringify(f));

/* ---------------- مكوّنات العرض ---------------- */
const btn = (n, filt, cls = '') => `<button type="button" class="mg-n ${cls}" data-f="${J(filt)}" title="عرض المواقع">${num(n)}</button>`;
const kpiCard = (tone, label, n, sub, filt) => `<button type="button" class="mg-k ${tone}" data-f="${J(filt)}"><small>${label}</small><b>${num(n)}</b><span>${sub}</span></button>`;
const kpis = (S) => `${kpiCard('z', 'زين الكلي', S.Z, `عادي ${num(S.Zp)} + هايبرد ${num(S.Zh)}`, { op: 'Z' })}${kpiCard('t', 'تاسك الكلي', S.T, `عادي ${num(S.Tp)} + هايبرد ${num(S.Th)}`, { op: 'T' })}${kpiCard('z h', 'هايبرد زين', S.Zh, `${pct(S.Zh, S.Z)}% من مواقع زين`, { op: 'Z', hyb: 1 })}${kpiCard('t h', 'هايبرد تاسك', S.Th, `${pct(S.Th, S.T)}% من مواقع تاسك`, { op: 'T', hyb: 1 })}`;

/** حلقة (Donut): أربعة أجزاء — زين عادي/هايبرد، تاسك عادي/هايبرد؛ الهايبرد مخطّط */
function donut(S) {
  const total = Math.max(1, S.Zp + S.Zh + S.Tp + S.Th), R = 78, C = 2 * Math.PI * R, gap = 2.2;
  const segs = [['Zp', 'زين عادي', 'z', 'p', { op: 'Z', hyb: 0 }], ['Zh', 'زين هايبرد', 'z', 'h', { op: 'Z', hyb: 1 }], ['Tp', 'تاسك عادي', 't', 'p', { op: 'T', hyb: 0 }], ['Th', 'تاسك هايبرد', 't', 'h', { op: 'T', hyb: 1 }]];
  let off = 0;
  const arcs = segs.map(([k, label, tone, kind, f]) => {
    const len = (S[k] / total) * C, dash = Math.max(0, len - gap), o = off; off += len;
    return `<circle class="dn-seg ${tone} ${kind}" r="${R}" cx="100" cy="100" pathLength="${C.toFixed(2)}" style="stroke-dasharray:${dash.toFixed(2)} ${(C - dash).toFixed(2)};stroke-dashoffset:${(-o).toFixed(2)}" tabindex="0" role="button" aria-label="${label}: ${S[k]}" data-lab="${label}" data-n="${num(S[k])}" data-f="${J(f)}"><title>${label}: ${num(S[k])}</title></circle>`;
  }).join('');
  return `<svg class="mg-dn" viewBox="0 0 200 200" role="img" aria-label="توزيع المواقع بين زين وتاسك">
    <defs><pattern id="pz" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" style="fill:var(--zc)"/><rect width="3.2" height="7" fill="rgba(0,0,0,.38)"/></pattern>
    <pattern id="pt" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" style="fill:var(--tc)"/><rect width="3.2" height="7" fill="rgba(0,0,0,.38)"/></pattern></defs>
    <circle r="${R}" cx="100" cy="100" class="dn-bg"/><g transform="rotate(-90 100 100)">${arcs}</g>
    <text x="100" y="96" text-anchor="middle" class="dn-n" id="dnN">${num(state.rows.length)}</text><text x="100" y="118" text-anchor="middle" class="dn-l" id="dnL">إجمالي المواقع</text></svg>`;
}
function donutLegend(S) {
  const rows = [['z', 'p', 'زين عادي', S.Zp, { op: 'Z', hyb: 0 }], ['z', 'h', 'زين هايبرد', S.Zh, { op: 'Z', hyb: 1 }], ['t', 'p', 'تاسك عادي', S.Tp, { op: 'T', hyb: 0 }], ['t', 'h', 'تاسك هايبرد', S.Th, { op: 'T', hyb: 1 }]];
  const tot = Math.max(1, state.rows.length);
  return `<ul class="mg-dl">${rows.map(([tone, kind, label, n, f]) => `<li><button type="button" data-f="${J(f)}"><i class="mk ${tone} ${kind}"></i><span>${label}</span><b>${num(n)}</b><em>${pct(n, tot)}%</em></button></li>`).join('')}</ul>`;
}

function opBars(S) {
  const max = Math.max(S.Z, S.T, 1);
  const row = (tone, name, p, h, op) => `<div class="mg-ob ${tone}"><div class="mg-ob-h"><b>${name}</b><span>${num(p + h)} موقع · ${pct(p + h, S.all)}% من الإجمالي</span></div>
    <div class="mg-track" style="width:${Math.max(8, Math.round(((p + h) / max) * 100))}%">
      <button type="button" class="seg p" style="flex:${p || 0.001}" data-f="${J({ op, hyb: 0 })}" title="عادي: ${num(p)}"><span>${num(p)}</span></button>
      <button type="button" class="seg h" style="flex:${h || 0.001}" data-f="${J({ op, hyb: 1 })}" title="هايبرد: ${num(h)}"><span>${num(h)}</span></button>
    </div><div class="mg-lg"><i class="mk ${tone} p"></i>عادي ${num(p)} <i class="mk ${tone} h"></i>هايبرد ${num(h)} (${pct(h, p + h)}% من ${name})</div></div>`;
  return row('z', 'زين', S.Zp, S.Zh, 'Z') + row('t', 'تاسك', S.Tp, S.Th, 'T');
}

/** مخطط أشرطة مكدّسة لكل فئة: زين عادي | زين هايبرد | تاسك عادي | تاسك هايبرد */
function stackChart(dimId, rows, limit = 12) {
  const all = sorted(dimId, rows), data = all.slice(0, limit), max = Math.max(1, ...data.map((d) => d.all));
  const f = (k, op, hyb) => ({ dim: dimId, val: k, op, hyb });
  const seg = (d, key, op, hyb, tone, kind) => { const n = d[key]; if (!n) return ''; const w = (n / max) * 100; return `<button type="button" class="seg ${tone} ${kind}" style="width:${w.toFixed(2)}%" data-f="${J(f(d.k, op, hyb))}" title="${op === 'Z' ? 'زين' : 'تاسك'} ${hyb ? 'هايبرد' : 'عادي'}: ${num(n)}">${w > 7 ? `<span>${num(n)}</span>` : ''}</button>`; };
  const body = data.map((d) => `<div class="mg-sr"><span class="nm" title="${esc(d.k)}">${esc(d.k)}</span><div class="mg-st">${seg(d, 'Zp', 'Z', 0, 'z', 'p')}${seg(d, 'Zh', 'Z', 1, 'z', 'h')}${seg(d, 'Tp', 'T', 0, 't', 'p')}${seg(d, 'Th', 'T', 1, 't', 'h')}</div><button type="button" class="mg-n tt" data-f="${J({ dim: dimId, val: d.k })}">${num(d.all)}</button></div>`).join('');
  const more = all.length > limit ? `<p class="mg-more">يعرض أعلى ${limit} من ${all.length} — الجدول يعرض الكل.</p>` : '';
  return `<div class="mg-sc">${body}</div>${more}`;
}
const chartKey = () => `<div class="mg-key"><span><i class="mk z p"></i>زين عادي</span><span><i class="mk z h"></i>زين هايبرد</span><span><i class="mk t p"></i>تاسك عادي</span><span><i class="mk t h"></i>تاسك هايبرد</span></div>`;

function matrix(dimId) {
  const [, label] = dimOf(dimId), data = sorted(dimId, state.rows), max = Math.max(1, ...data.map((d) => d.all));
  const f = (k, op, hyb) => ({ dim: dimId, val: k, op, hyb });
  const head = `<tr><th rowspan="2">${label}</th><th colspan="3" class="gz">زين</th><th colspan="3" class="gt">تاسك</th><th rowspan="2">الإجمالي</th><th rowspan="2" class="mg-bw"></th></tr>
    <tr><th class="gz">عادي</th><th class="gz">هايبرد</th><th class="gz">الكلي</th><th class="gt">عادي</th><th class="gt">هايبرد</th><th class="gt">الكلي</th></tr>`;
  const tr = (d) => `<tr><td class="nm">${esc(d.k)}</td>
    <td class="gz">${btn(d.Zp, f(d.k, 'Z', 0))}</td><td class="gz">${btn(d.Zh, f(d.k, 'Z', 1), 'hy')}</td><td class="gz tot">${btn(d.Z, f(d.k, 'Z'))}</td>
    <td class="gt">${btn(d.Tp, f(d.k, 'T', 0))}</td><td class="gt">${btn(d.Th, f(d.k, 'T', 1), 'hy')}</td><td class="gt tot">${btn(d.T, f(d.k, 'T'))}</td>
    <td class="tot">${btn(d.all, { dim: dimId, val: d.k })}</td><td class="mg-bw"><i style="width:${Math.round((d.all / max) * 100)}%"></i></td></tr>`;
  const sum = (k) => data.reduce((a, d) => a + d[k], 0);
  const foot = `<tr class="ft"><td>المجموع</td><td class="gz">${num(sum('Zp'))}</td><td class="gz">${num(sum('Zh'))}</td><td class="gz">${num(sum('Z'))}</td><td class="gt">${num(sum('Tp'))}</td><td class="gt">${num(sum('Th'))}</td><td class="gt">${num(sum('T'))}</td><td>${num(sum('all'))}</td><td class="mg-bw"></td></tr>`;
  return `<div class="tbl-wrap"><table class="tbl2 mg-tbl"><thead>${head}</thead><tbody>${data.map(tr).join('')}</tbody><tfoot>${foot}</tfoot></table></div>`;
}

function insightList(S) {
  const out = [];
  const g = sorted('gov', state.rows)[0], c = sorted('cl', state.rows)[0], hy = sorted('gov', state.rows.filter(isHyb))[0];
  if (g) out.push(`أكثر محافظة مواقعاً: <b>${esc(g.k)}</b> (${num(g.all)} موقع، زين ${num(g.Z)} · تاسك ${num(g.T)}).`);
  if (c) out.push(`أكبر كلستر: <b class="en">${esc(c.k)}</b> (${num(c.all)} موقع).`);
  if (hy) out.push(`أكثر محافظة بمواقع هايبرد: <b>${esc(hy.k)}</b> (${num(hy.all)}: زين ${num(hy.Z)} · تاسك ${num(hy.T)}).`);
  const s1 = state.rows.filter((r) => r.sev === 'S1');
  if (s1.length) out.push(`مواقع الخطورة S1: <b>${num(s1.length)}</b> (زين ${num(s1.filter((r) => opOf(r) === 'Z').length)} · تاسك ${num(s1.filter((r) => opOf(r) === 'T').length)}).`);
  if (S.Op + S.Oh) out.push(`<span class="dn">تنبيه:</span> ${num(S.Op + S.Oh)} موقع نوعه ليس زين ولا تاسك (راجع «نوع الموقع» في الإكسل).`);
  return out;
}

/* ---------------- الصفحة الرئيسية ---------------- */
let activeDim = 'gov', view = 'chart';
const fmtUpd = () => state.meta.updated ? new Date(state.meta.updated).toLocaleString('en-GB', { hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

function render() {
  const S = summary(), hy = S.Zh + S.Th, hasPk = Boolean(pkId());
  root.innerHTML = `<div id="mg">
  <header class="mg-top"><div class="mg-brand"><img src="icons/seal.png" alt="" width="46" height="46"><div><h1>لوحة المدير</h1><small>شركة ربوع المعالي · آخر تحديث للبيانات <bdi dir="ltr" class="en">${fmtUpd()}</bdi></small></div></div>
    <div class="mg-acts">
      <button class="btn pri" type="button" id="mgPresent">${ICONS.chart || ''}عرض الاجتماع</button>
      <button class="btn" type="button" id="mgPrint">${ICONS.print || ''}طباعة / PDF</button>
      <button class="btn" type="button" id="mgXls">${ICONS.download || ''}Excel</button>
      <button class="btn" type="button" id="mgRef" title="تحديث البيانات" aria-label="تحديث البيانات">${ICONS.refresh || ''}</button>
      <button class="btn" type="button" id="mgOut">${ICONS.logout || ''}خروج</button>
    </div></header>
  ${passkeySupported() && !hasPk ? `<div class="mg-pk" id="pkBar"><div><b>فعّل الدخول بالبصمة</b><span>مرة واحدة فقط على هذا الجهاز، وبعدها تدخل بالبصمة أو الوجه بدون كلمة المرور.</span></div><button class="btn pri" type="button" id="pkOn">تفعيل البصمة</button></div>` : ''}

  <section class="mg-hero">
    <div class="mg-hero-c"><div class="mg-dnw">${donut(S)}</div>${donutLegend(S)}</div>
    <div class="mg-kpis" aria-label="الأرقام الرئيسية">${kpis(S)}</div>
  </section>
  <div class="mg-strip"><span>إجمالي المواقع <b>${num(state.rows.length)}</b></span><span>إجمالي الهايبرد <b>${num(hy)}</b> (${pct(hy, state.rows.length)}%)</span><span>زين عادي <b>${num(S.Zp)}</b></span><span>تاسك عادي <b>${num(S.Tp)}</b></span></div>

  <section class="pn"><header class="pn-h"><div class="pn-tt"><b>زين مقابل تاسك</b><small>الجزء المخطّط = مواقع هايبرد. اضغط أي جزء لعرض مواقعه.</small></div></header><div class="pn-b mg-ops">${opBars(S)}</div></section>

  <section class="pn"><header class="pn-h"><div class="pn-tt"><b>تقارير الشبكة</b><small>اختر التقرير، وبدّل بين المخطط والجدول. اضغط أي رقم لعرض مواقعه.</small></div>
    <div class="pn-a"><div class="mg-vs" role="group" aria-label="طريقة العرض"><button type="button" data-v="chart" aria-pressed="${view === 'chart'}">مخطط</button><button type="button" data-v="table" aria-pressed="${view === 'table'}">جدول</button></div></div></header>
    <div class="pn-b"><div class="mg-tabs" role="tablist">${DIMS.map(([id, l]) => `<button type="button" role="tab" data-d="${id}" aria-selected="${id === activeDim}">${l}</button>`).join('')}</div>
    <div class="mg-reps" data-view="${view}">${DIMS.map(([id, l]) => `<div class="mg-rep" data-r="${id}" role="tabpanel"${id === activeDim ? '' : ' hidden'}><h3 class="mg-pt">تقرير الشبكة بحسب ${l}</h3><div class="mg-vc">${chartKey()}${stackChart(id, state.rows)}</div><div class="mg-vt">${matrix(id)}</div></div>`).join('')}</div></div></section>

  <section class="pn"><header class="pn-h"><div class="pn-tt"><b>ملاحظات سريعة للاجتماع</b><small>تُحسب تلقائياً من البيانات الحالية</small></div></header><div class="pn-b"><ul class="mg-ins">${insightList(S).map((t) => `<li>${t}</li>`).join('')}</ul></div></section>
  <footer class="mg-foot">Bot Rm · للاستخدام الداخلي · ${new Date().toLocaleDateString('en-GB')}${hasPk ? ' · <button type="button" class="mg-lnk" id="pkOff">إلغاء بصمة هذا الجهاز</button>' : ''}</footer>
  </div>
  <dialog id="mgDlg" class="mg-dlg"></dialog><div id="mgSl" class="sl" role="dialog" aria-modal="true" aria-label="عرض الاجتماع" hidden></div>`;
  wire(S);
}

/* ---------------- قائمة المواقع ---------------- */
function pred(f) {
  const dim = f.dim && dimOf(f.dim);
  return (r) => (!f.op || opOf(r) === f.op) && (f.hyb == null || (f.hyb ? isHyb(r) : !isHyb(r))) && (!dim || dim[2](r) === f.val);
}
const titleOf = (f) => [f.op === 'Z' ? 'زين' : f.op === 'T' ? 'تاسك' : 'كل المشغّلين', f.hyb === 1 ? 'هايبرد' : f.hyb === 0 ? 'عادي' : 'الكلي', f.dim ? `${dimOf(f.dim)[1]}: ${f.val}` : ''].filter(Boolean).join(' · ');

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
  const out = [['التقرير', 'القيمة', 'زين عادي', 'زين هايبرد', 'زين الكلي', 'تاسك عادي', 'تاسك هايبرد', 'تاسك الكلي', 'الإجمالي']], S = summary();
  out.push(['الإجمالي', 'كل المواقع', S.Zp, S.Zh, S.Z, S.Tp, S.Th, S.T, state.rows.length]);
  for (const [id, l] of DIMS) for (const d of sorted(id, state.rows)) out.push([l, d.k, d.Zp, d.Zh, d.Z, d.Tp, d.Th, d.T, d.all]);
  download(xlsxBlob(out, 'ملخص الشبكة'), `botrm-manager-${stamp()}.xlsx`);
  toast('تم تنزيل الملخص');
}

/* ---------------- عرض الاجتماع (شرائح بملء الشاشة) ---------------- */
let slideNo = 0;
const slides = () => {
  const S = summary(), hy = state.rows.filter(isHyb);
  const dimSlide = (id) => ({ t: `الشبكة بحسب ${dimOf(id)[1]}`, h: `<div class="sl-chart">${chartKey()}${stackChart(id, state.rows, 9)}</div>` });
  return [
    { t: 'الصورة العامة', h: `<div class="sl-ov"><div class="sl-dn">${donut(S)}${donutLegend(S)}</div><div class="mg-kpis sl-k">${kpis(S)}</div></div>` },
    { t: 'زين مقابل تاسك', h: `<div class="mg-ops sl-ops">${opBars(S)}</div>` },
    { t: `مواقع الهايبرد (${num(hy.length)})`, h: `<div class="sl-hy"><div class="sl-hn"><div class="mg-k z h"><small>هايبرد زين</small><b>${num(S.Zh)}</b></div><div class="mg-k t h"><small>هايبرد تاسك</small><b>${num(S.Th)}</b></div></div><div class="sl-chart">${chartKey()}${stackChart('gov', hy, 8)}</div></div>` },
    ...['gov', 'cl', 'ven', 'sev', 't2', 'io'].map(dimSlide),
    { t: 'ملاحظات للاجتماع', h: `<ul class="mg-ins sl-ins">${insightList(S).map((x) => `<li>${x}</li>`).join('')}</ul>` },
  ];
};

function showSlide(n, dir = 1) {
  const list = slides(); slideNo = Math.min(Math.max(0, n), list.length - 1);
  const el = $('#mgSl'), s = list[slideNo];
  el.innerHTML = `<div class="sl-top"><div class="sl-brand"><img src="icons/seal.png" alt="" width="34" height="34"><span>ربوع المعالي</span></div><h2 class="sl-t">${esc(s.t)}</h2><div class="sl-r"><span class="sl-cnt en">${slideNo + 1} / ${list.length}</span><button type="button" class="sl-x" id="slX" aria-label="إنهاء العرض">${ICONS.close}</button></div></div>
    <div class="sl-stage"><div class="sl-s ${dir < 0 ? 'back' : ''}">${s.h}</div></div>
    <div class="sl-nav"><button type="button" id="slP" aria-label="السابق"${slideNo === 0 ? ' disabled' : ''}>›</button><div class="sl-dots">${list.map((_, i) => `<button type="button" data-i="${i}" aria-label="شريحة ${i + 1}" aria-current="${i === slideNo}"></button>`).join('')}</div><button type="button" id="slN" aria-label="التالي"${slideNo === list.length - 1 ? ' disabled' : ''}>‹</button></div>`;
  $('#slX').onclick = closeSlides; $('#slP').onclick = () => showSlide(slideNo - 1, -1); $('#slN').onclick = () => showSlide(slideNo + 1, 1);
  $$('.sl-dots [data-i]').forEach((b) => { b.onclick = () => showSlide(+b.dataset.i, +b.dataset.i < slideNo ? -1 : 1); });
  wireData(el);
}
function openSlides() {
  const el = $('#mgSl'); el.hidden = false; el.classList.add('on'); document.body.classList.add('sl-open');
  el.requestFullscreen?.().catch(() => {});
  showSlide(0);
}
function closeSlides() {
  const el = $('#mgSl'); if (!el || el.hidden) return;
  el.classList.remove('on'); el.hidden = true; document.body.classList.remove('sl-open');
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}
document.addEventListener('keydown', (e) => {
  const el = $('#mgSl'); if (!el || el.hidden || $('#mgDlg')?.open) return;
  const k = e.key;
  if (k === 'Escape') closeSlides();
  else if (['ArrowLeft', 'PageDown', ' ', 'Enter'].includes(k) && !(e.target instanceof HTMLButtonElement && k !== 'ArrowLeft' && k !== 'PageDown')) { e.preventDefault(); showSlide(slideNo + 1, 1); }
  else if (['ArrowRight', 'PageUp'].includes(k)) { e.preventDefault(); showSlide(slideNo - 1, -1); }
  else if (k === 'Home') showSlide(0, -1); else if (k === 'End') showSlide(999, 1);
});
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) closeSlides(); });
let tx = null;
document.addEventListener('touchstart', (e) => { if (!$('#mgSl')?.hidden) tx = e.touches[0].clientX; }, { passive: true });
document.addEventListener('touchend', (e) => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; tx = null; if (Math.abs(dx) > 70) showSlide(slideNo + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); }, { passive: true });

/* ---------------- التفاعل ---------------- */
function wireData(scope) {
  $$('[data-f]', scope).forEach((b) => { b.onclick = (e) => { e.stopPropagation(); openList(JSON.parse(b.dataset.f)); }; });
  $$('.dn-seg', scope).forEach((c) => {
    const set = (l, n) => { const N = $('#dnN', scope), L = $('#dnL', scope); if (N) { N.textContent = n; L.textContent = l; } };
    const on = () => set(c.dataset.lab, c.dataset.n), off = () => set('إجمالي المواقع', num(state.rows.length));
    c.onmouseenter = on; c.onfocus = on; c.onmouseleave = off; c.onblur = off;
    c.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.click(); } };
  });
}

function wire() {
  wireData($('#mg'));
  $$('.mg-tabs [role=tab]').forEach((t) => {
    t.onclick = () => { activeDim = t.dataset.d; $$('.mg-tabs [role=tab]').forEach((x) => x.setAttribute('aria-selected', x === t)); $$('.mg-rep').forEach((p) => { p.hidden = p.dataset.r !== activeDim; }); };
  });
  $$('.mg-vs [data-v]').forEach((b) => { b.onclick = () => { view = b.dataset.v; $('.mg-reps').dataset.view = view; $$('.mg-vs [data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b)); }; });
  $('#mgPrint').onclick = () => window.print();
  $('#mgXls').onclick = exportSummary;
  $('#mgPresent').onclick = openSlides;
  $('#mgRef').onclick = async () => { toast('جارٍ التحديث…'); await freshen(); toast('البيانات محدَّثة'); };
  $('#mgOut').onclick = () => { clearTok(); showLogin('', false); };
  $('#mgDlg').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  $('#pkOn')?.addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { await passkeyRegister(); toast('تم تفعيل البصمة على هذا الجهاز'); render(); }
    catch (err) { toast(err?.name === 'NotAllowedError' ? 'أُلغي طلب البصمة' : 'تعذّر تفعيل البصمة على هذا الجهاز'); b.disabled = false; }
  });
  $('#pkOff')?.addEventListener('click', async () => {
    if (!confirm('إلغاء البصمة على هذا الجهاز؟ ستحتاج كلمة المرور في الدخول القادم.')) return;
    try { await post({ action: 'rm', id: pkId() }, auth()); } catch { /* */ }
    setPk(''); toast('أُلغيت البصمة'); render();
  });
}

/* ---------------- البدء ---------------- */
async function start(fresh = false) {
  const t = readTok();
  if (!t || !(await tokenValid(t))) { clearTok(); return showLogin(t ? 'انتهت الجلسة، سجّل الدخول من جديد.' : ''); }
  root.innerHTML = '<div class="mg-login"><div class="mg-lcard"><p>جارٍ تحميل البيانات…</p></div></div>';
  try { await loadData(); } catch { return void (root.innerHTML = '<div class="mg-login"><div class="mg-lcard"><h1>⚠️</h1><p>تعذّر تحميل البيانات. تأكد من الاتصال ثم أعد المحاولة.</p><button class="btn pri" onclick="location.reload()">إعادة المحاولة</button></div></div>'); }
  render();
  if (fresh) window.scrollTo(0, 0);
}
start();
