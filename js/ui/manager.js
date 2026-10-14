/** لوحة المدير: مراقبة الشبكة وتقارير الاجتماعات.
 *  الدخول: كلمة المرور أول مرة ثم بصمة الجهاز (mgrAuth.js). الأرقام تُحسب في الجهاز من البيانات نفسها التي يراها التطبيق
 *  (بعد التصحيحات) فلا كتابة ولا طلبات إضافية على الخادم. النموذج في mgrModel.js. */
import { $, $$, esc, toast } from '../lib/dom.js';
import { govName } from '../lib/labels.js';
import { state, fetchPacket, unlockPacket, setRows, storedPacket } from '../data/store.js';
import { loadSaved, setDynamic } from '../data/overrides.js';
import { xlsxBlob } from '../lib/xlsxWrite.js';
import { num, pct } from './adminUI.js';
import { ICONS } from '../lib/icons.js';
import { readTok, clearTok, tokenValid, pkId, passkeySupported, passkeyRegister, passkeyRemove, showLogin } from './mgrAuth.js';
import * as M from './mgrModel.js';
const { DIMS, dimOf, shown, F, prefs, PRESETS, opOf, isHyb, tally, sorted, summary, rowsF, pred, titleOf } = M;

const root = $('#m');
const J = (f) => esc(JSON.stringify(f));
let activeDim = 'gov', pivot = { r: 'gov', c: 'sev' }, techSort = 'all';
const lst = { preset: '', q: '', sort: 'id', dir: 1, page: 0 };
let refreshTimer = null, lastCheck = Date.now();

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
    lastCheck = Date.now();
    if (changed && $('#mg')) { rerender(); if (!$('#mgSl')?.hidden) showSlide(slideNo); } else if ($('#mgChip')) $('#mgChip').outerHTML = chip();
  } catch { /* نكمل بما هو محفوظ */ }
}

/* ---------------- مكوّنات العرض ---------------- */
const nm = (k) => esc(shown(k));
const btn = (n, filt, cls = '') => `<button type="button" class="mg-n ${cls}" data-f="${J(filt)}" title="عرض المواقع">${num(n)}</button>`;
const kpiCard = (tone, label, n, sub, filt) => `<button type="button" class="mg-k ${tone}" data-f="${J(filt)}"><small>${label}</small><b>${num(n)}</b><span>${sub}</span></button>`;
const kpis = (S) => `${kpiCard('z', 'زين الكلي', S.Z, `عادي ${num(S.Zp)} + هايبرد ${num(S.Zh)}`, { op: 'Z' })}${kpiCard('t', 'تاسك الكلي', S.T, `عادي ${num(S.Tp)} + هايبرد ${num(S.Th)}`, { op: 'T' })}${kpiCard('z h', 'هايبرد زين', S.Zh, `${pct(S.Zh, S.Z)}% من مواقع زين`, { op: 'Z', hyb: 1 })}${kpiCard('t h', 'هايبرد تاسك', S.Th, `${pct(S.Th, S.T)}% من مواقع تاسك`, { op: 'T', hyb: 1 })}`;
const key4 = () => `<div class="mg-key"><span><i class="mk z p"></i>زين عادي</span><span><i class="mk z h"></i>زين هايبرد</span><span><i class="mk t p"></i>تاسك عادي</span><span><i class="mk t h"></i>تاسك هايبرد</span></div>`;

/** حلقة (Donut): أربعة أجزاء — زين عادي/هايبرد، تاسك عادي/هايبرد؛ الهايبرد مخطّط */
function donut(S) {
  const total = Math.max(1, S.Zp + S.Zh + S.Tp + S.Th), R = 78, C = 2 * Math.PI * R, gap = 2.2;
  const segs = [['Zp', 'زين عادي', 'z', 'p', { op: 'Z', hyb: 0 }], ['Zh', 'زين هايبرد', 'z', 'h', { op: 'Z', hyb: 1 }], ['Tp', 'تاسك عادي', 't', 'p', { op: 'T', hyb: 0 }], ['Th', 'تاسك هايبرد', 't', 'h', { op: 'T', hyb: 1 }]];
  let off = 0;
  const arcs = segs.map(([k, label, tone, kind, f]) => {
    const len = (S[k] / total) * C, dash = Math.max(0, len - gap), o = off; off += len;
    return `<circle class="dn-seg ${tone} ${kind}" r="${R}" cx="100" cy="100" style="stroke-dasharray:${dash.toFixed(2)} ${(C - dash).toFixed(2)};stroke-dashoffset:${(-o).toFixed(2)}" tabindex="0" role="button" aria-label="${label}: ${S[k]}" data-lab="${label}" data-n="${num(S[k])}" data-f="${J(f)}"><title>${label}: ${num(S[k])}</title></circle>`;
  }).join('');
  return `<svg class="mg-dn" viewBox="0 0 200 200" role="img" aria-label="توزيع المواقع بين زين وتاسك">
    <defs><pattern id="pz" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" style="fill:var(--zc)"/><rect width="3.2" height="7" fill="rgba(0,0,0,.38)"/></pattern>
    <pattern id="pt" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" style="fill:var(--tc)"/><rect width="3.2" height="7" fill="rgba(0,0,0,.38)"/></pattern></defs>
    <circle r="${R}" cx="100" cy="100" class="dn-bg"/><g transform="rotate(-90 100 100)">${arcs}</g>
    <text x="100" y="96" text-anchor="middle" class="dn-n" id="dnN">${num(rowsF().length)}</text><text x="100" y="118" text-anchor="middle" class="dn-l" id="dnL">${M.filterCount() ? 'المواقع المطابقة' : 'إجمالي المواقع'}</text></svg>`;
}
function donutLegend(S) {
  const rows = [['z', 'p', 'زين عادي', S.Zp, { op: 'Z', hyb: 0 }], ['z', 'h', 'زين هايبرد', S.Zh, { op: 'Z', hyb: 1 }], ['t', 'p', 'تاسك عادي', S.Tp, { op: 'T', hyb: 0 }], ['t', 'h', 'تاسك هايبرد', S.Th, { op: 'T', hyb: 1 }]];
  const tot = Math.max(1, rowsF().length);
  return `<ul class="mg-dl">${rows.map(([tone, kind, label, n, f]) => `<li><button type="button" data-f="${J(f)}"><i class="mk ${tone} ${kind}"></i><span>${label}</span><b>${num(n)}</b><em>${pct(n, tot)}%</em></button></li>`).join('')}</ul>`;
}
function opBars(S) {
  const max = Math.max(S.Z, S.T, 1);
  const row = (tone, name, p, h, op) => `<div class="mg-ob ${tone}"><div class="mg-ob-h"><b>${name}</b><span>${num(p + h)} موقع · ${pct(p + h, S.all)}% من المعروض</span></div>
    <div class="mg-track" style="width:${Math.max(8, Math.round(((p + h) / max) * 100))}%">
      <button type="button" class="seg p" style="flex:${p || 0.001}" data-f="${J({ op, hyb: 0 })}" title="عادي: ${num(p)}"><span>${num(p)}</span></button>
      <button type="button" class="seg h" style="flex:${h || 0.001}" data-f="${J({ op, hyb: 1 })}" title="هايبرد: ${num(h)}"><span>${num(h)}</span></button>
    </div><div class="mg-lg"><i class="mk ${tone} p"></i>عادي ${num(p)} <i class="mk ${tone} h"></i>هايبرد ${num(h)} (${pct(h, p + h)}% من ${name})</div></div>`;
  return row('z', 'زين', S.Zp, S.Zh, 'Z') + row('t', 'تاسك', S.Tp, S.Th, 'T');
}

/** مخطط أشرطة مكدّسة لكل فئة */
function stackChart(dimId, rows, limit) {
  const all = sorted(dimId, rows), data = all.slice(0, limit), max = Math.max(1, ...data.map((d) => d.all));
  const f = (k, op, hyb) => ({ dim: dimId, val: k, op, hyb });
  const seg = (d, key, op, hyb, tone, kind) => { const n = d[key]; if (!n) return ''; const w = (n / max) * 100; return `<button type="button" class="seg ${tone} ${kind}" style="width:${w.toFixed(2)}%" data-f="${J(f(d.k, op, hyb))}" title="${op === 'Z' ? 'زين' : 'تاسك'} ${hyb ? 'هايبرد' : 'عادي'}: ${num(n)}">${w > 7 ? `<span>${num(n)}</span>` : ''}</button>`; };
  const body = data.map((d) => `<div class="mg-sr"><span class="nm" title="${nm(d.k)}">${nm(d.k)}</span><div class="mg-st">${seg(d, 'Zp', 'Z', 0, 'z', 'p')}${seg(d, 'Zh', 'Z', 1, 'z', 'h')}${seg(d, 'Tp', 'T', 0, 't', 'p')}${seg(d, 'Th', 'T', 1, 't', 'h')}</div><button type="button" class="mg-n tt" data-f="${J({ dim: dimId, val: d.k })}">${num(d.all)}</button></div>`).join('');
  return `<div class="mg-sc">${body || '<p class="muted">لا توجد بيانات مطابقة.</p>'}</div>${all.length > limit ? `<p class="mg-more">يعرض أعلى ${limit} من ${all.length} — الجدول يعرض الكل.</p>` : ''}`;
}

function matrix(dimId) {
  const [, label] = dimOf(dimId), data = sorted(dimId), max = Math.max(1, ...data.map((d) => d.all));
  const f = (k, op, hyb) => ({ dim: dimId, val: k, op, hyb });
  const head = `<tr><th rowspan="2">${label}</th><th colspan="3" class="gz">زين</th><th colspan="3" class="gt">تاسك</th><th rowspan="2">الإجمالي</th><th rowspan="2" class="mg-bw"></th></tr>
    <tr><th class="gz">عادي</th><th class="gz">هايبرد</th><th class="gz">الكلي</th><th class="gt">عادي</th><th class="gt">هايبرد</th><th class="gt">الكلي</th></tr>`;
  const tr = (d) => `<tr><td class="nm">${nm(d.k)}</td>
    <td class="gz">${btn(d.Zp, f(d.k, 'Z', 0))}</td><td class="gz">${btn(d.Zh, f(d.k, 'Z', 1), 'hy')}</td><td class="gz tot">${btn(d.Z, f(d.k, 'Z'))}</td>
    <td class="gt">${btn(d.Tp, f(d.k, 'T', 0))}</td><td class="gt">${btn(d.Th, f(d.k, 'T', 1), 'hy')}</td><td class="gt tot">${btn(d.T, f(d.k, 'T'))}</td>
    <td class="tot">${btn(d.all, { dim: dimId, val: d.k })}</td><td class="mg-bw"><i style="width:${Math.round((d.all / max) * 100)}%"></i></td></tr>`;
  const sum = (k) => data.reduce((a, d) => a + d[k], 0);
  const foot = `<tr class="ft"><td>المجموع</td><td class="gz">${num(sum('Zp'))}</td><td class="gz">${num(sum('Zh'))}</td><td class="gz">${num(sum('Z'))}</td><td class="gt">${num(sum('Tp'))}</td><td class="gt">${num(sum('Th'))}</td><td class="gt">${num(sum('T'))}</td><td>${num(sum('all'))}</td><td class="mg-bw"></td></tr>`;
  return `<div class="tbl-wrap"><table class="tbl2 mg-tbl"><thead>${head}</thead><tbody>${data.map(tr).join('')}</tbody><tfoot>${foot}</tfoot></table></div>`;
}

/** الجدول المحوري: بُعدان من اختيارك، بخلايا ملوّنة حسب الكثافة */
function pivotTable() {
  const rows = rowsF(), rd = dimOf(pivot.r), cd = dimOf(pivot.c);
  const cm = new Map(), rm = new Map(), cell = new Map();
  for (const r of rows) {
    const a = rd[2](r), b = cd[2](r), k = `${a}\u0001${b}`;
    cell.set(k, (cell.get(k) || 0) + 1); rm.set(a, (rm.get(a) || 0) + 1); cm.set(b, (cm.get(b) || 0) + 1);
  }
  const ord = (m, mode) => [...m.entries()].sort((x, y) => (mode === 'k' ? String(x[0]).localeCompare(String(y[0])) : y[1] - x[1]));
  const cols = ord(cm, cd[3]).slice(0, 9), rws = ord(rm, rd[3]).slice(0, 16);
  const max = Math.max(1, ...rws.flatMap(([a]) => cols.map(([b]) => cell.get(`${a}\u0001${b}`) || 0)));
  const body = rws.map(([a, tot]) => `<tr><td class="nm">${nm(a)}</td>${cols.map(([b]) => { const v = cell.get(`${a}\u0001${b}`) || 0; return `<td class="hm" style="--h:${(v / max).toFixed(3)}">${v ? btn(v, { dim: pivot.r, val: a, dim2: pivot.c, val2: b }) : '<span class="muted">·</span>'}</td>`; }).join('')}<td class="tot">${btn(tot, { dim: pivot.r, val: a })}</td></tr>`).join('');
  const foot = `<tr class="ft"><td>المجموع</td>${cols.map(([b, n]) => `<td>${btn(n, { dim: pivot.c, val: b })}</td>`).join('')}<td>${num(rows.length)}</td></tr>`;
  const hid = (cm.size > cols.length ? `${cm.size - cols.length} عمود` : '') + (rm.size > rws.length ? ` ${rm.size - rws.length} صف` : '');
  return `<div class="tbl-wrap"><table class="tbl2 mg-tbl mg-pv"><thead><tr><th>${rd[1]} ↓ / ${cd[1]} →</th>${cols.map(([b]) => `<th>${nm(b)}</th>`).join('')}<th>الإجمالي</th></tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table></div>${hid ? `<p class="mg-more">مخفي من الجدول لضيق المساحة: ${hid} (الأقل عدداً).</p>` : ''}`;
}

/** عبء الفنيين */
function techTable() {
  const g = new Map();
  for (const r of rowsF()) {
    const k = r.mn; if (!k || /بدون\s*فني/.test(k)) continue;
    const o = g.get(k) || { k, all: 0, S1: 0, S2: 0, S3: 0, h: 0, gv: new Set() };
    o.all++; if (o[r.sev] != null) o[r.sev]++; if (isHyb(r)) o.h++; if (r.gov) o.gv.add(govName(r.gov)); g.set(k, o);
  }
  const list = [...g.values()].sort((a, b) => b[techSort] - a[techSort] || b.all - a.all).slice(0, 15), max = Math.max(1, ...list.map((o) => o.all));
  const tr = list.map((o, i) => `<tr><td class="rk">${i + 1}</td><td class="nm"><button type="button" class="mg-n lk" data-f="${J({ dim: 'mn', val: o.k })}">${esc(o.k)}</button></td><td><div class="mg-tb"><i style="width:${Math.round((o.all / max) * 100)}%"></i><b>${num(o.all)}</b></div></td><td>${num(o.S1)}</td><td>${num(o.S2)}</td><td>${num(o.S3)}</td><td>${num(o.h)}</td><td class="gv">${esc([...o.gv].slice(0, 2).join('، '))}${o.gv.size > 2 ? '…' : ''}</td></tr>`).join('');
  return `<div class="tbl-wrap"><table class="tbl2 mg-tbl mg-tt"><thead><tr><th>#</th><th>الفني</th><th>عدد المواقع</th><th>S1</th><th>S2</th><th>S3</th><th>هايبرد</th><th>المحافظات</th></tr></thead><tbody>${tr || '<tr><td colspan="8" class="muted">لا توجد بيانات.</td></tr>'}</tbody></table></div><p class="mg-more">أعلى 15 فنياً (من ${num(g.size)}). لا يشمل «بدون فني صيانة».</p>`;
}

/** جودة البيانات */
function qualityGrid() {
  const rows = rowsF(), tot = Math.max(1, rows.length);
  return `<div class="mg-q">${PRESETS.filter((p) => p.kind === 'dq').map((p) => { const n = rows.filter(p.fn).length; return `<button type="button" class="mg-qc ${n ? 'bad' : 'ok'}" data-f="${J({ preset: p.id })}"><b>${num(n)}</b><span>${p.label}</span><em>${n ? `${((n / tot) * 100).toFixed(1)}%` : 'سليم'}</em></button>`; }).join('')}</div>`;
}

const fmtT = (t) => new Date(t).toLocaleString('en-GB', { hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
function changesPanel() {
  const c = M.changeFeed(rowsF(), 25);
  if (!c.total) return '<p class="muted">لا توجد تغييرات مسجّلة في البيانات المنشورة بعد (تظهر هنا بعد نشر تحديثات الإكسل).</p>';
  const mx = Math.max(1, ...c.days.map((d) => d[1]));
  return `<div class="mg-cd">${c.days.map(([d, n]) => `<div title="${d}: ${n} تغيير"><i style="height:${Math.round((n / mx) * 100)}%"></i><small class="en">${d.slice(8)}</small></div>`).join('')}</div>
    <ul class="mg-feed">${c.list.map((e) => `<li><button type="button" data-f="${J({ id: e.id })}" class="en id">${esc(e.id)}</button><span class="k">${esc(M.chLabel(e.k))}</span>${e.k === '__new' ? '' : `<span class="v"><s>${esc(e.o || '—')}</s> ← <b>${esc(e.n || '—')}</b></span>`}<time class="en">${fmtT(e.t)}</time></li>`).join('')}</ul><p class="mg-more">آخر ${c.list.length} من ${num(c.total)} تغييراً مسجّلاً.</p>`;
}

function insightList(S) {
  const rows = rowsF(), out = [];
  if (!rows.length) return ['لا توجد مواقع مطابقة للفلاتر الحالية.'];
  const g = sorted('gov')[0], c = sorted('cl')[0], hy = sorted('gov', rows.filter(isHyb))[0];
  if (g) out.push(`أكثر محافظة مواقعاً: <b>${nm(g.k)}</b> (${num(g.all)} موقع، زين ${num(g.Z)} · تاسك ${num(g.T)}).`);
  if (c) out.push(`أكبر كلستر: <b class="en">${nm(c.k)}</b> (${num(c.all)} موقع).`);
  if (hy) out.push(`أكثر محافظة بمواقع هايبرد: <b>${nm(hy.k)}</b> (${num(hy.all)}: زين ${num(hy.Z)} · تاسك ${num(hy.T)}).`);
  const s1 = rows.filter((r) => r.sev === 'S1');
  if (s1.length) out.push(`مواقع الخطورة S1: <b>${num(s1.length)}</b> (زين ${num(s1.filter((r) => opOf(r) === 'Z').length)} · تاسك ${num(s1.filter((r) => opOf(r) === 'T').length)}).`);
  const nofni = rows.filter(PRESETS.find((p) => p.id === 'nofni').fn).length;
  if (nofni) out.push(`مواقع بدون فني صيانة: <b>${num(nofni)}</b>.`);
  if (S.Op + S.Oh) out.push(`<span class="dn">تنبيه:</span> ${num(S.Op + S.Oh)} موقع نوعه ليس زين ولا تاسك (راجع «نوع الموقع» في الإكسل).`);
  return out;
}

/* ---------------- الصفحة ---------------- */
const dataAge = () => { const u = state.meta.updated; if (!u) return null; return Math.max(0, Math.round((Date.now() - new Date(u)) / 86400e3)); };
function chip() {
  const age = dataAge(), on = navigator.onLine, t = new Date(lastCheck).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const tone = !on ? 'off' : age == null ? 'on' : age > 30 ? 'old' : age > 14 ? 'warn' : 'on';
  return `<span id="mgChip" class="mg-chip ${tone}"><i></i>${on ? 'متصل' : 'بلا إنترنت'} · ${age == null ? '' : age === 0 ? 'البيانات محدّثة اليوم' : `عمر البيانات ${age} يوم`} · آخر فحص <span class="en">${t}</span></span>`;
}
const fmtUpd = () => (state.meta.updated ? new Date(state.meta.updated).toLocaleString('en-GB', { hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

function filterBar() {
  const o = M.filterOptions(), sel = (k, label, opts, all) => `<label class="mg-f"><span>${label}</span><select data-flt="${k}"${F[k] !== '' ? ' class="on"' : ''}><option value="">${all}</option>${opts.map(([v, t]) => `<option value="${esc(v)}"${F[k] === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const n = M.filterCount();
  return `<div class="mg-fb" id="mgFb"><div class="mg-fs">${sel('op', 'المشغّل', [['Z', 'زين'], ['T', 'تاسك']], 'الكل')}${sel('hyb', 'النوع', [['0', 'عادي'], ['1', 'هايبرد']], 'الكل')}${sel('gov', 'المحافظة', o.gov, 'كل المحافظات')}${sel('cl', 'الكلستر', o.cl.map((c) => [c, c]), 'كل الكلسترات')}${sel('ven', 'المورّد', o.ven.map((c) => [c, c]), 'الكل')}${sel('sev', 'الخطورة', o.sev.map((c) => [c, c]), 'الكل')}</div>
    <div class="mg-fi"><span><b>${num(rowsF().length)}</b> من ${num(state.rows.length)} موقع</span>${n ? `<button class="btn sm" type="button" id="fReset">إلغاء ${n === 1 ? 'الفلتر' : `الفلاتر (${n})`}</button>` : ''}</div></div>`;
}

const sec = (id, title, sub, body, actions = '') => (prefs.sec[id] ? `<section class="pn mg-sec" data-sec="${id}"><header class="pn-h"><div class="pn-tt"><b>${title}</b><small>${sub}</small></div>${actions ? `<div class="pn-a">${actions}</div>` : ''}</header><div class="pn-b">${body}</div></section>` : '');
const dimOpts = (cur) => DIMS.map(([id, l]) => `<option value="${id}"${id === cur ? ' selected' : ''}>${l}</option>`).join('');

function listBase() {
  const pre = lst.preset && PRESETS.find((p) => p.id === lst.preset), q = lst.q.trim().toLowerCase();
  let rows = rowsF();
  if (pre) rows = rows.filter(pre.fn);
  if (q) rows = rows.filter((r) => [r.id, r.nm, govName(r.gov), r.cl, r.st, r.ven, r.mn, r.mp].join(' ').toLowerCase().includes(q));
  const val = { id: (r) => r.id, nm: (r) => r.nm || '', gov: (r) => govName(r.gov), cl: (r) => r.cl || '', st: (r) => r.st || '', ven: (r) => r.ven || '', sev: (r) => r.sev || '', mn: (r) => r.mn || '', stat: (r) => r.x?.siteStatus || '' }[lst.sort];
  return rows.slice().sort((a, b) => lst.dir * String(val(a)).localeCompare(String(val(b)), 'ar', { numeric: true }));
}
const LCOLS = [['id', 'الموقع'], ['nm', 'العنوان'], ['gov', 'المحافظة'], ['cl', 'الكلستر'], ['st', 'النوع'], ['ven', 'المورّد'], ['sev', 'الخطورة'], ['mn', 'الفني'], ['stat', 'الحالة']];
function listBody() {
  const all = listBase(), ps = prefs.pageSize, pages = Math.max(1, Math.ceil(all.length / ps));
  lst.page = Math.min(lst.page, pages - 1);
  const slice = all.slice(lst.page * ps, lst.page * ps + ps);
  const tr = (r) => `<tr><td class="en"><a href="index.html#${encodeURIComponent(r.id)}" title="فتح في التطبيق"><b>${esc(r.id)}</b></a></td><td class="wrap">${esc(r.nm || '—')}</td><td>${esc(govName(r.gov) || '—')}</td><td class="en">${esc(r.cl || '—')}</td><td class="en">${esc(r.st || '—')}</td><td class="en">${esc(r.ven || '—')}</td><td>${esc(r.sev || '—')}</td><td class="wrap">${esc(r.mn || '—')}</td><td class="en">${esc(r.x?.siteStatus || '—')}</td></tr>`;
  return `<div class="tbl-wrap"><table class="tbl2 mg-lt"><thead><tr>${LCOLS.map(([k, l]) => `<th><button type="button" class="mg-sh" data-sort="${k}" aria-sort="${lst.sort === k ? (lst.dir > 0 ? 'ascending' : 'descending') : 'none'}">${l}${lst.sort === k ? (lst.dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr></thead><tbody>${slice.map(tr).join('') || '<tr><td colspan="9" class="muted">لا توجد مواقع مطابقة.</td></tr>'}</tbody></table></div>
    <div class="mg-pg"><span class="muted">${num(all.length)} موقع · صفحة ${lst.page + 1} من ${pages}</span><div><button class="btn sm" type="button" data-pg="-1"${lst.page === 0 ? ' disabled' : ''}>السابق</button><button class="btn sm" type="button" data-pg="1"${lst.page >= pages - 1 ? ' disabled' : ''}>التالي</button></div></div>`;
}

function settingsPanel() {
  const hasPk = Boolean(pkId());
  const chk = ([k, l]) => `<label class="mg-ck"><input type="checkbox" data-sec="${k}"${prefs.sec[k] ? ' checked' : ''}><span>${l}</span></label>`;
  const opt = (v, cur, l) => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${l}</option>`;
  const row = (label, hint, ctl) => `<div class="mg-sr2"><div><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</div>${ctl}</div>`;
  return `<section class="pn mg-sec" id="mgSet"><header class="pn-h"><div class="pn-tt"><b>إعدادات اللوحة</b><small>تُحفظ على هذا الجهاز فقط</small></div><div class="pn-a"><button class="btn sm" type="button" id="prReset">استعادة الافتراضي</button></div></header><div class="pn-b mg-set">
    ${row('الأقسام الظاهرة', 'أخفِ ما لا تحتاجه في الاجتماع', `<div class="mg-cks">${M.SECTIONS.map(chk).join('')}</div>`)}
    ${row('العرض الافتراضي للتقارير', '', `<select class="inp" data-pref="view">${opt('chart', prefs.view, 'مخطط')}${opt('table', prefs.view, 'جدول')}</select>`)}
    ${row('عدد الصفوف في المخططات', 'الجدول يعرض الكل دائماً', `<select class="inp" data-pref="topN" data-num="1">${[8, 12, 20, 40].map((n) => opt(n, prefs.topN, n)).join('')}</select>`)}
    ${row('كثافة العرض', '', `<select class="inp" data-pref="density">${opt('comfy', prefs.density, 'مريح')}${opt('dense', prefs.density, 'مضغوط')}</select>`)}
    ${row('المظهر', '', `<select class="inp" data-pref="theme">${opt('auto', prefs.theme, 'تلقائي')}${opt('light', prefs.theme, 'نهاري')}${opt('dark', prefs.theme, 'ليلي')}</select>`)}
    ${row('تحديث البيانات تلقائياً', 'مناسب لشاشة المراقبة المفتوحة طوال اليوم', `<select class="inp" data-pref="refresh" data-num="1">${opt(0, prefs.refresh, 'متوقف')}${[2, 5, 15, 30].map((n) => opt(n, prefs.refresh, `كل ${n} دقيقة`)).join('')}</select>`)}
    ${row('صفوف القوائم في الصفحة', '', `<select class="inp" data-pref="pageSize" data-num="1">${[25, 50, 100].map((n) => opt(n, prefs.pageSize, n)).join('')}</select>`)}
    ${row('مدة كل شريحة في عرض الاجتماع', '', `<select class="inp" data-pref="slideSec" data-num="1">${[6, 10, 12, 20, 30].map((n) => opt(n, prefs.slideSec, `${n} ثانية`)).join('')}</select>`)}
    ${passkeySupported() ? row('الدخول بالبصمة', hasPk ? 'مفعّلة على هذا الجهاز' : 'غير مفعّلة على هذا الجهاز', hasPk ? '<button class="btn" type="button" id="pkOff">إلغاء بصمة هذا الجهاز</button>' : '<button class="btn pri" type="button" id="pkOn2">تفعيل البصمة</button>') : ''}
  </div></section>`;
}

function render() {
  const rows = rowsF(), S = summary(rows), hy = S.Zh + S.Th, hasPk = Boolean(pkId());
  const sev = (s) => rows.filter((r) => r.sev === s).length;
  const techs = new Set(rows.map((r) => r.mn).filter((v) => v && !/بدون\s*فني/.test(v))).size;
  const view = prefs.view;
  root.innerHTML = `<div id="mg" class="${prefs.density === 'dense' ? 'dense' : ''}">
  <header class="mg-top"><div class="mg-brand"><img src="icons/seal.png" alt="" width="46" height="46"><div><h1>لوحة المدير</h1><small>شركة ربوع المعالي · مراقبة الشبكة · آخر تحديث للبيانات <bdi dir="ltr" class="en">${fmtUpd()}</bdi></small></div></div>
    <div class="mg-acts">
      <a class="btn" href="index.html" id="mgBack">← التطبيق</a>
      <button class="btn pri" type="button" id="mgPresent">${ICONS.chart || ''}عرض الاجتماع</button>
      <button class="btn" type="button" id="mgPrint">${ICONS.print || ''}طباعة / PDF</button>
      <button class="btn" type="button" id="mgXls">${ICONS.download || ''}Excel</button>
      <button class="btn" type="button" id="mgRef" title="تحديث البيانات" aria-label="تحديث البيانات">${ICONS.refresh || ''}</button>
      <button class="btn" type="button" id="mgOut">${ICONS.logout || ''}خروج</button>
    </div><div class="mg-status">${chip()}</div></header>
  ${passkeySupported() && !hasPk ? `<div class="mg-pk" id="pkBar"><div><b>فعّل الدخول بالبصمة</b><span>مرة واحدة فقط على هذا الجهاز، وبعدها تدخل بالبصمة أو الوجه بدون كلمة المرور.</span></div><button class="btn pri" type="button" id="pkOn">تفعيل البصمة</button></div>` : ''}
  ${filterBar()}
  <section class="mg-hero">
    <div class="mg-hero-c"><div class="mg-dnw">${donut(S)}</div>${donutLegend(S)}</div>
    <div class="mg-kpis" aria-label="الأرقام الرئيسية">${kpis(S)}</div>
  </section>
  <div class="mg-strip"><span>المواقع <b>${num(rows.length)}</b></span><span>الهايبرد <b>${num(hy)}</b> (${pct(hy, rows.length)}%)</span><span class="s1">S1 <b>${num(sev('S1'))}</b></span><span>S2 <b>${num(sev('S2'))}</b></span><span>S3 <b>${num(sev('S3'))}</b></span><span>الفنيون <b>${num(techs)}</b></span><span>داخلية <b>${num(rows.filter((r) => r.io === 'Indoor').length)}</b></span></div>

  ${sec('ops', 'زين مقابل تاسك', 'الجزء المخطّط = مواقع هايبرد. اضغط أي جزء لعرض مواقعه.', `<div class="mg-ops">${opBars(S)}</div>`)}
  ${sec('reports', 'تقارير الشبكة', 'اختر التقرير وبدّل بين المخطط والجدول. اضغط أي رقم لعرض مواقعه.', `<div class="mg-tabs" role="tablist">${DIMS.map(([id, l]) => `<button type="button" role="tab" data-d="${id}" aria-selected="${id === activeDim}">${l}</button>`).join('')}</div>
    <div class="mg-reps" data-view="${view}">${DIMS.map(([id, l]) => `<div class="mg-rep" data-r="${id}" role="tabpanel"${id === activeDim ? '' : ' hidden'}><h3 class="mg-pt">تقرير الشبكة بحسب ${l}</h3><div class="mg-vc">${key4()}${stackChart(id, rows, prefs.topN)}</div><div class="mg-vt">${matrix(id)}</div></div>`).join('')}</div>`,
    `<div class="mg-vs" role="group" aria-label="طريقة العرض"><button type="button" data-v="chart" aria-pressed="${view === 'chart'}">مخطط</button><button type="button" data-v="table" aria-pressed="${view === 'table'}">جدول</button></div>`)}
  ${sec('pivot', 'الجدول المحوري', 'اربط أي بُعدين ببعض (مثال: المحافظة × الخطورة). الخلايا الأغمق = أكثر مواقع.', `<div class="mg-pvc"><label>الصفوف<select class="inp" id="pvR">${dimOpts(pivot.r)}</select></label><button type="button" class="btn sm" id="pvSwap" aria-label="تبديل الصفوف والأعمدة">⇄</button><label>الأعمدة<select class="inp" id="pvC">${dimOpts(pivot.c)}</select></label></div><div id="pvT">${pivotTable()}</div>`)}
  ${sec('techs', 'عبء الفنيين', 'أكثر الفنيين مواقعاً، ومعها عدد مواقع S1 والهايبرد لكل فني.', `<div class="mg-pvc"><label>رتّب حسب<select class="inp" id="tSort"><option value="all"${techSort === 'all' ? ' selected' : ''}>عدد المواقع</option><option value="S1"${techSort === 'S1' ? ' selected' : ''}>مواقع S1</option><option value="h"${techSort === 'h' ? ' selected' : ''}>مواقع الهايبرد</option></select></label></div><div id="tT">${techTable()}</div>`)}
  ${sec('quality', 'جودة البيانات', 'نواقص في الإكسل تستدعي المراجعة. اضغط أي بطاقة لعرض المواقع المعنية.', qualityGrid())}
  ${sec('changes', 'آخر التغييرات في الشبكة', 'ما تغيّر في بيانات المواقع عند آخر تحديثات الإكسل المنشورة.', changesPanel())}
  ${sec('list', 'قوائم المواقع', 'ابحث ورتّب وصفِّ، ثم نزّل القائمة. رقم الموقع يفتح بطاقته في التطبيق.', `<div class="mg-lbar2"><select class="inp" id="lP"><option value="">كل المواقع المطابقة للفلاتر</option>${['list', 'dq'].map((k) => `<optgroup label="${k === 'list' ? 'قوائم المراقبة' : 'فحوص الجودة'}">${PRESETS.filter((p) => p.kind === k).map((p) => `<option value="${p.id}"${lst.preset === p.id ? ' selected' : ''}>${p.label}</option>`).join('')}</optgroup>`).join('')}</select>
      <input class="inp" id="lQ" type="search" placeholder="بحث (رقم، عنوان، كلستر، فني، هاتف…)" value="${esc(lst.q)}"><button class="btn" type="button" id="lXls">${ICONS.download || ''}تنزيل القائمة</button></div><div id="lB">${listBody()}</div>`)}
  <section class="pn mg-sec" data-sec="notes"><header class="pn-h"><div class="pn-tt"><b>ملاحظات سريعة للاجتماع</b><small>تُحسب تلقائياً من البيانات المعروضة</small></div></header><div class="pn-b"><ul class="mg-ins">${insightList(S).map((t) => `<li>${t}</li>`).join('')}</ul></div></section>
  ${settingsPanel()}
  <footer class="mg-foot">Bot Rm · للاستخدام الداخلي · ${new Date().toLocaleDateString('en-GB')}</footer>
  </div>
  <dialog id="mgDlg" class="mg-dlg"></dialog><div id="mgSl" class="sl" role="dialog" aria-modal="true" aria-label="عرض الاجتماع" hidden></div>`;
  wire();
}
function rerender() { const y = window.scrollY; render(); window.scrollTo(0, y); }

/* ---------------- قائمة المواقع (نافذة) ---------------- */
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const stamp = () => new Date().toISOString().slice(0, 10);
const siteRows = (rows) => [['رقم الموقع', 'العنوان', 'المحافظة', 'الكلستر', 'نوع الموقع', 'المورّد', 'الخطورة', 'اسم الفني', 'رقم الفني', 'حالة الموقع'], ...rows.map((r) => [r.id, r.nm || '', govName(r.gov) || '', r.cl || '', r.st || '', r.ven || '', r.sev || '', r.mn || '', r.mp || '', r.x?.siteStatus || ''])];

function openList(f) {
  const rows = rowsF().filter(pred(f)).sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  const dlg = $('#mgDlg'), CAP = 400;
  const row = (r) => `<tr><td class="en"><a href="index.html#${encodeURIComponent(r.id)}"><b>${esc(r.id)}</b></a></td><td>${esc(r.nm || '—')}</td><td>${esc(govName(r.gov) || '—')}</td><td class="en">${esc(r.cl || '—')}</td><td class="en">${esc(r.st || '—')}</td><td class="en">${esc(r.ven || '—')}</td><td>${esc(r.sev || '—')}</td></tr>`;
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
  $('#dXls').onclick = () => download(xlsxBlob(siteRows(rows), 'المواقع'), `botrm-${stamp()}.xlsx`);
  dlg.showModal();
}

function exportSummary() {
  const out = [['التقرير', 'القيمة', 'زين عادي', 'زين هايبرد', 'زين الكلي', 'تاسك عادي', 'تاسك هايبرد', 'تاسك الكلي', 'الإجمالي']], S = summary();
  out.push(['الإجمالي', M.filterCount() ? 'المواقع المطابقة للفلاتر' : 'كل المواقع', S.Zp, S.Zh, S.Z, S.Tp, S.Th, S.T, S.all]);
  for (const [id, l] of DIMS) for (const d of sorted(id)) out.push([l, shown(d.k), d.Zp, d.Zh, d.Z, d.Tp, d.Th, d.T, d.all]);
  download(xlsxBlob(out, 'ملخص الشبكة'), `botrm-manager-${stamp()}.xlsx`);
  toast('تم تنزيل الملخص');
}

/* ---------------- عرض الاجتماع (شرائح بملء الشاشة) ---------------- */
let slideNo = 0, playTimer = null, playing = false;
const slides = () => {
  const rows = rowsF(), S = summary(rows), hy = rows.filter(isHyb);
  const dimSlide = (id, n = 9) => ({ t: `الشبكة بحسب ${dimOf(id)[1]}`, h: `<div class="sl-chart">${key4()}${stackChart(id, rows, n)}</div>` });
  return [
    { t: 'الصورة العامة', h: `<div class="sl-ov"><div class="sl-dn">${donut(S)}${donutLegend(S)}</div><div class="mg-kpis sl-k">${kpis(S)}</div></div>` },
    { t: 'زين مقابل تاسك', h: `<div class="mg-ops sl-ops">${opBars(S)}</div>` },
    { t: `مواقع الهايبرد (${num(hy.length)})`, h: `<div class="sl-hy"><div class="sl-hn"><div class="mg-k z h"><small>هايبرد زين</small><b>${num(S.Zh)}</b></div><div class="mg-k t h"><small>هايبرد تاسك</small><b>${num(S.Th)}</b></div></div><div class="sl-chart">${key4()}${stackChart('gov', hy, 8)}</div></div>` },
    ...['gov', 'cl', 'ven', 'sev', 't2', 'io', 'stat', 'tech'].map((id) => dimSlide(id)),
    dimSlide('mn', 8),
    { t: 'ملاحظات للاجتماع', h: `<ul class="mg-ins sl-ins">${insightList(S).map((x) => `<li>${x}</li>`).join('')}</ul>` },
  ];
};
function showSlide(n, dir = 1) {
  const list = slides(); slideNo = Math.min(Math.max(0, n), list.length - 1);
  const el = $('#mgSl'), s = list[slideNo];
  el.innerHTML = `<div class="sl-top"><div class="sl-brand"><img src="icons/seal.png" alt="" width="34" height="34"><span>ربوع المعالي</span></div><h2 class="sl-t">${esc(s.t)}</h2><div class="sl-r"><span class="sl-cnt en">${slideNo + 1} / ${list.length}</span><button type="button" class="sl-x" id="slX" aria-label="إنهاء العرض">${ICONS.close}</button></div></div>
    <div class="sl-stage"><div class="sl-s ${dir < 0 ? 'back' : ''}">${s.h}</div></div>
    <div class="sl-nav"><button type="button" id="slP" aria-label="السابق"${slideNo === 0 ? ' disabled' : ''}>›</button><button type="button" id="slPlay" class="sl-play" aria-pressed="${playing}" aria-label="${playing ? 'إيقاف التشغيل التلقائي' : 'تشغيل تلقائي'}">${playing ? '❚❚' : '▶'}</button><div class="sl-dots">${list.map((_, i) => `<button type="button" data-i="${i}" aria-label="شريحة ${i + 1}" aria-current="${i === slideNo}"></button>`).join('')}</div><button type="button" id="slN" aria-label="التالي"${slideNo === list.length - 1 && !playing ? ' disabled' : ''}>‹</button></div>`;
  $('#slX').onclick = closeSlides; $('#slP').onclick = () => { stopPlay(); showSlide(slideNo - 1, -1); }; $('#slN').onclick = () => { stopPlay(); showSlide(slideNo + 1, 1); };
  $('#slPlay').onclick = () => (playing ? stopPlay(true) : startPlay());
  $$('.sl-dots [data-i]').forEach((b) => { b.onclick = () => { stopPlay(); showSlide(+b.dataset.i, +b.dataset.i < slideNo ? -1 : 1); }; });
  wireData(el);
}
function startPlay() { playing = true; clearInterval(playTimer); playTimer = setInterval(() => showSlide(slideNo + 1 >= slides().length ? 0 : slideNo + 1, 1), prefs.slideSec * 1000); showSlide(slideNo); }
function stopPlay(redraw = false) { playing = false; clearInterval(playTimer); if (redraw) showSlide(slideNo); }
function openSlides() {
  const el = $('#mgSl'); el.hidden = false; el.classList.add('on'); document.body.classList.add('sl-open');
  el.requestFullscreen?.().catch(() => {});
  playing = false; showSlide(0);
  if (prefs.autoplay) startPlay();
}
function closeSlides() {
  const el = $('#mgSl'); if (!el || el.hidden) return;
  stopPlay(); el.classList.remove('on'); el.hidden = true; document.body.classList.remove('sl-open');
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}
document.addEventListener('keydown', (e) => {
  const el = $('#mgSl'); if (!el || el.hidden || $('#mgDlg')?.open) return;
  const k = e.key;
  if (k === 'Escape') closeSlides();
  else if (['ArrowLeft', 'PageDown', ' ', 'Enter'].includes(k) && !(e.target instanceof HTMLButtonElement && k !== 'ArrowLeft' && k !== 'PageDown')) { e.preventDefault(); stopPlay(); showSlide(slideNo + 1, 1); }
  else if (['ArrowRight', 'PageUp'].includes(k)) { e.preventDefault(); stopPlay(); showSlide(slideNo - 1, -1); }
  else if (k === 'Home') showSlide(0, -1); else if (k === 'End') showSlide(999, 1);
  else if (k === 'p' || k === 'P') (playing ? stopPlay(true) : startPlay());
});
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) closeSlides(); });
let tx = null;
document.addEventListener('touchstart', (e) => { if (!$('#mgSl')?.hidden) tx = e.touches[0].clientX; }, { passive: true });
document.addEventListener('touchend', (e) => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; tx = null; if (Math.abs(dx) > 70) { stopPlay(); showSlide(slideNo + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); } }, { passive: true });

/* ---------------- التفاعل ---------------- */
function wireData(scope) {
  $$('[data-f]', scope).forEach((b) => { b.onclick = (e) => { e.stopPropagation(); openList(JSON.parse(b.dataset.f)); }; });
  $$('.dn-seg', scope).forEach((c) => {
    const set = (l, n) => { const N = $('#dnN', scope), L = $('#dnL', scope); if (N) { N.textContent = n; L.textContent = l; } };
    const on = () => set(c.dataset.lab, c.dataset.n), off = () => set(M.filterCount() ? 'المواقع المطابقة' : 'إجمالي المواقع', num(rowsF().length));
    c.onmouseenter = on; c.onfocus = on; c.onmouseleave = off; c.onblur = off;
    c.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.click(); } };
  });
}

function applyPrefs() {
  const h = document.documentElement;
  if (prefs.theme === 'auto') { delete h.dataset.theme; h.dataset.mode = 'auto'; } else { h.dataset.theme = prefs.theme; h.dataset.mode = prefs.theme; }
  clearInterval(refreshTimer);
  if (prefs.refresh > 0) refreshTimer = setInterval(() => { if (!document.hidden) freshen(); }, prefs.refresh * 60000);
}

function wire() {
  wireData($('#mg'));
  $$('[data-flt]').forEach((s) => { s.onchange = () => { M.setFilter(s.dataset.flt, s.value); lst.page = 0; rerender(); }; });
  $('#fReset')?.addEventListener('click', () => { M.resetFilters(); rerender(); });
  $$('.mg-tabs [role=tab]').forEach((t) => {
    t.onclick = () => { activeDim = t.dataset.d; $$('.mg-tabs [role=tab]').forEach((x) => x.setAttribute('aria-selected', x === t)); $$('.mg-rep').forEach((p) => { p.hidden = p.dataset.r !== activeDim; }); };
  });
  $$('.mg-vs [data-v]').forEach((b) => { b.onclick = () => { prefs.view = b.dataset.v; M.savePrefs(); $('.mg-reps').dataset.view = prefs.view; $$('.mg-vs [data-v]').forEach((x) => x.setAttribute('aria-pressed', x === b)); const sv = $('select[data-pref=view]'); if (sv) sv.value = prefs.view; }; });
  const redoPivot = () => { $('#pvT').innerHTML = pivotTable(); wireData($('#pvT')); };
  $('#pvR')?.addEventListener('change', (e) => { pivot.r = e.target.value; redoPivot(); });
  $('#pvC')?.addEventListener('change', (e) => { pivot.c = e.target.value; redoPivot(); });
  $('#pvSwap')?.addEventListener('click', () => { [pivot.r, pivot.c] = [pivot.c, pivot.r]; $('#pvR').value = pivot.r; $('#pvC').value = pivot.c; redoPivot(); });
  $('#tSort')?.addEventListener('change', (e) => { techSort = e.target.value; $('#tT').innerHTML = techTable(); wireData($('#tT')); });

  const redoList = () => { $('#lB').innerHTML = listBody(); wireList(); };
  const wireList = () => {
    $$('[data-sort]').forEach((b) => { b.onclick = () => { lst.dir = lst.sort === b.dataset.sort ? -lst.dir : 1; lst.sort = b.dataset.sort; redoList(); }; });
    $$('[data-pg]').forEach((b) => { b.onclick = () => { lst.page += +b.dataset.pg; redoList(); }; });
  };
  $('#lP')?.addEventListener('change', (e) => { lst.preset = e.target.value; lst.page = 0; redoList(); });
  let qt; $('#lQ')?.addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { lst.q = e.target.value; lst.page = 0; redoList(); }, 200); });
  $('#lXls')?.addEventListener('click', () => { download(xlsxBlob(siteRows(listBase()), 'قائمة المواقع'), `botrm-list-${stamp()}.xlsx`); toast('تم تنزيل القائمة'); });
  if ($('#lB')) wireList();

  $('#mgPrint').onclick = () => window.print();
  $('#mgXls').onclick = exportSummary;
  $('#mgPresent').onclick = openSlides;
  $('#mgRef').onclick = async () => { toast('جارٍ التحديث…'); await freshen(); toast('البيانات محدَّثة'); };
  $('#mgOut').onclick = () => { clearTok(); showLogin(root, begin, '', false); };
  $('#mgDlg').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

  const enablePk = async (e) => {
    const b = e.currentTarget; b.disabled = true;
    try { await passkeyRegister(); toast('تم تفعيل البصمة على هذا الجهاز'); rerender(); }
    catch (err) { toast(err?.name === 'NotAllowedError' ? 'أُلغي طلب البصمة' : 'تعذّر تفعيل البصمة على هذا الجهاز'); b.disabled = false; }
  };
  $('#pkOn')?.addEventListener('click', enablePk); $('#pkOn2')?.addEventListener('click', enablePk);
  $('#pkOff')?.addEventListener('click', async () => {
    if (!confirm('إلغاء البصمة على هذا الجهاز؟ ستحتاج كلمة المرور في الدخول القادم.')) return;
    await passkeyRemove(); toast('أُلغيت البصمة'); rerender();
  });

  $$('#mgSet [data-sec]').forEach((c) => { c.onchange = () => { prefs.sec[c.dataset.sec] = c.checked; M.savePrefs(); rerender(); }; });
  $$('#mgSet [data-pref]').forEach((s) => {
    s.onchange = () => { const k = s.dataset.pref; prefs[k] = s.dataset.num ? Number(s.value) : s.value; M.savePrefs(); applyPrefs(); rerender(); };
  });
  $('#prReset')?.addEventListener('click', () => { M.resetPrefs(); applyPrefs(); rerender(); toast('أُعيدت الإعدادات الافتراضية'); });
}

/* ---------------- البدء ---------------- */
async function begin() {
  const t = readTok();
  if (!t || !(await tokenValid(t))) { clearTok(); return showLogin(root, begin, t ? 'انتهت الجلسة، سجّل الدخول من جديد.' : ''); }
  root.innerHTML = '<div class="mg-login"><div class="mg-lcard"><p>جارٍ تحميل البيانات…</p></div></div>';
  try { await loadData(); } catch { return void (root.innerHTML = '<div class="mg-login"><div class="mg-lcard"><h1>⚠️</h1><p>تعذّر تحميل البيانات. تأكد من الاتصال ثم أعد المحاولة.</p><button class="btn pri" onclick="location.reload()">إعادة المحاولة</button></div></div>'); }
  applyPrefs(); render();
}
window.addEventListener('online', () => $('#mgChip') && ($('#mgChip').outerHTML = chip()));
window.addEventListener('offline', () => $('#mgChip') && ($('#mgChip').outerHTML = chip()));
begin();
