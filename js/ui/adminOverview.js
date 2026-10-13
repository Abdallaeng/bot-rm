/** تبويبا «نظرة عامة» و«سجل العمليات» في لوحة الإدارة */
import { esc } from '../lib/dom.js';
import { govName } from '../lib/labels.js';
import { state, stats as dataStats } from '../data/store.js';
import { ICONS } from '../lib/icons.js';
import { countUp } from './effects.js';
import { dataChecks } from './adminExtra.js';
import { pgHead, pn, kpi, pill, dl, table, bars, dayChart, fmtDay, fmtDT, rel, num, pct, gauge, skeleton } from './adminUI.js';
import { healthPanel } from './adminTools.js';

let liveTimer = 0;
const json = async (r) => (r.ok ? r.json() : null);
const settle = (p) => p.then(json).catch(() => null);

/* ---------------- نظرة عامة ---------------- */
export async function tabOverview(el, ctx) {
  el.innerHTML = skeleton('kpi');
  const [st, ver, bc, au] = await Promise.all([
    settle(ctx.api('/api/stats?days=7')), settle(ctx.api('/api/versions')),
    settle(fetch('/api/broadcast', { cache: 'no-store' })), settle(ctx.api('/api/audit')),
  ]);
  if (ctx.tab() !== 'ov' || !el.isConnected) return;
  ctx.status(Boolean(st));
  if (st) ctx.live(st.live);

  const ds = dataStats();
  const upd = state.meta.updated ? new Date(state.meta.updated) : null;
  const age = upd && !isNaN(upd) ? Math.floor((Date.now() - upd) / 86400e3) : null;
  const days = st?.days.map((d) => ({ ...d, label: fmtDay(d.day) })) || [];
  const today = days.at(-1) || { s: 0, m: 0, u: 0, w: 0, h: Array(24).fill(0), top: [] }, y = days.at(-2) || { s: 0 };
  const week = days.reduce((t, d) => t + d.s, 0);
  const delta = y.s ? Math.round(((today.s - y.s) / y.s) * 100) : null;
  const peak = today.h.indexOf(Math.max(...today.h));
  const checks = dataChecks().filter((c) => c[0] !== 'ok');
  const nBad = checks.filter((c) => c[0] === 'bad').length;
  ctx.badge('alr', nBad || checks.length || 0, nBad ? 'bad' : 'warn');
  const last = ver?.log?.[0];
  const cur = bc?.b;

  const server = pn('الخادم والتخزين', 'Cloudflare Pages + KV', dl([
    ['الحالة', st ? pill('متصل', 'ok') : pill('غير متصل', 'bad')],
    ['التتبّع', st ? pill('يعمل', 'ok') : pill('متوقف', 'warn')],
    ['جلسة الإدارة', `<span id="ovSess">${ctx.sessionText()}</span>`],
  ]) + `<div class="ggs">${gauge('كتابات KV اليوم', today.w || 0, 1000, { note: 'الحد المجاني ≈ 1,000 كتابة يومياً' })}${gauge('طلبات الخادم اليوم', today.q || 0, 100000, { approx: true, note: 'تقدير من الأجهزة التي أرسلت إحصاءات (الرقم الفعلي أعلى قليلاً)' })}</div>`, { icon: ICONS.server });

  const data = pn('بيانات المواقع', 'النسخة التي يراها المستخدمون الآن', dl([
    ['عدد المواقع', `<b class="en">${num(ds.sites)}</b>`],
    ['الكلسترات / المحافظات', `<span class="en">${ds.clusters}</span> / <span class="en">${ds.governorates}</span>`],
    ['آخر تحديث', upd ? `<span class="en">${fmtDT(upd)}</span>` : '—'],
    ['العمر', age == null ? '—' : age > 60 ? pill(`${age} يوم — قديمة`, 'bad') : age > 30 ? pill(`${age} يوم`, 'warn') : pill(age === 0 ? 'محدّثة اليوم' : `${age} يوم`, 'ok')],
  ]), { icon: ICONS.database });

  const publish = pn('آخر نشر', 'من سجل النسخ', last ? dl([
    ['العملية', esc(last.name || 'نشر')],
    ['الوقت', `${rel(last.ts)} <small class="muted en">${fmtDT(last.ts)}</small>`],
    ['التغييرات', last.add || last.chg || last.rem ? `<span class="up">+${last.add}</span> · <span>~${last.chg}</span> · <span class="dn">−${last.rem}</span>` : '—'],
    ['النسخ المحفوظة', `${(ver.log || []).length} نشر · ${(ver.backups || []).length} يومية`],
  ]) : '<div class="muted pn-empty">لا يوجد نشر مسجّل بعد.</div>', { icon: ICONS.upload, actions: '<button class="btn sm" data-go="upd" type="button">سجل النسخ</button>' });

  const bcast = pn('الإعلان الحالي', 'شريط التنبيه للمستخدمين', cur
    ? `<div class="pvbc ${esc(cur.level)}">${esc(cur.text)}</div><div class="muted sm">${cur.expires ? `ينتهي ${fmtDT(cur.expires)}` : 'بدون انتهاء'} · أُرسل ${rel(cur.created)}</div>`
    : '<div class="muted pn-empty">لا يوجد إعلان نشط.</div>', { icon: ICONS.megaphone, actions: '<button class="btn sm" data-go="bc" type="button">إدارة البث</button>' });

  const topRows = (today.top || []).slice(0, 6).map(([q, n]) => {
    const r = state.byId.get(q);
    return `<div class="trow"><b class="en">${esc(q)}</b><span>${r ? esc([r.cl, govName(r.gov)].filter(Boolean).join(' · ') || r.nm || '') : '<i class="muted">—</i>'}</span><em>${n}</em></div>`;
  }).join('') || '<div class="muted pn-empty">لا توجد عمليات بحث اليوم بعد.</div>';

  const TYPES = ICONS_BY_TYPE;
  const acts = (au?.log || []).slice(0, 6).map((a) => `<div class="arow ${a.ok ? '' : 'bad'}"><span class="ai2">${TYPES[a.type] || ICONS.info}</span><div><b>${esc(a.text)}</b><small>${rel(a.t)} · ${esc(a.dev || '')}</small></div></div>`).join('') || '<div class="muted pn-empty">لا نشاط مسجّل بعد.</div>';

  const alerts = checks.slice(0, 4).map(([lv, ic, t, d]) => `<div class="alr ${lv}"><span class="ai">${ic}</span><div><b>${esc(t)}</b><span>${esc(d)}</span></div></div>`).join('');

  const hc = healthPanel(ctx);
  el.innerHTML = `${pgHead('نظرة عامة', 'حالة النظام والبيانات والاستخدام في لمحة واحدة', '<button class="btn sm" id="ovRf" type="button">' + ICONS.refresh + 'تحديث</button>')}
    ${st ? '' : '<div class="note warn">تعذّر الاتصال بالخادم أو أن تخزين KV غير مربوط، لذلك تظهر أرقام الاستخدام فارغة.</div>'}
    <div class="kcs c5">
      ${kpi('بحث اليوم', num(today.s), { tone: 'acc', icon: ICONS.search, delta, n: today.s })}
      ${kpi('نسبة النجاح اليوم', today.s ? `${100 - pct(today.m, today.s)}%` : '—', { icon: ICONS.check, sub: today.m ? `${today.m} بلا نتيجة` : 'كل البحث وُجد' })}
      ${kpi('أجهزة اليوم', num(today.u), { icon: ICONS.users, n: today.u, sub: st?.live?.n ? `${st.live.n} نشط الآن` : '' })}
      ${kpi('ساعة الذروة', today.s ? `${peak}:00` : '—', { icon: ICONS.clock, sub: 'بتوقيت بغداد' })}
      ${kpi('آخر 7 أيام', num(week), { icon: ICONS.chart, n: week })}
    </div>
    <div class="grid2">${server}${data}${publish}${bcast}</div>
    ${pn('النشاط آخر 7 أيام', 'عدد عمليات البحث اليومية (البرتقالي = بلا نتيجة)', days.length ? dayChart(days, { H: 170 }) : '<div class="muted pn-empty">لا توجد بيانات.</div>', { icon: ICONS.chart, actions: '<button class="btn sm" data-go="rep" type="button">التقارير الكاملة</button>' })}
    <div class="grid2">
      ${pn('الأكثر بحثاً اليوم', 'رقم الموقع · الكلستر والمحافظة · العدد', `<div class="tlist">${topRows}</div>`, { icon: ICONS.search })}
      ${pn('آخر نشاط للإدارة', 'من سجل العمليات', `<div class="alist">${acts}</div>`, { icon: ICONS.log, actions: '<button class="btn sm" data-go="log" type="button">السجل كاملاً</button>' })}
    </div>
    ${alerts ? pn('يحتاج انتباهك', `${nBad} عاجل · ${checks.length - nBad} للمراجعة`, alerts, { icon: ICONS.alert, actions: '<button class="btn sm" data-go="alr" type="button">كل التنبيهات</button>' }) : pn('التنبيهات', '', '<div class="note ok" style="margin:0">✅ لا توجد تنبيهات: كل الفحوصات سليمة.</div>', { icon: ICONS.check })}
    ${hc.html}
    ${pn('إجراءات سريعة', '', `<div class="qa">
      <button class="qa-b" data-go="upd" type="button">${ICONS.upload}<b>رفع بيانات جديدة</b><small>إكسل ← مراجعة ← نشر</small></button>
      <button class="qa-b" data-go="bc" type="button">${ICONS.megaphone}<b>إرسال إعلان</b><small>لكل المستخدمين</small></button>
      <button class="qa-b" data-go="rep" type="button">${ICONS.chart}<b>التقارير</b><small>تحليل الاستخدام</small></button>
      <button class="qa-b" data-go="log" type="button">${ICONS.log}<b>سجل العمليات</b><small>من فعل ماذا ومتى</small></button>
      <button class="qa-b" data-go="sec" type="button">${ICONS.shield}<b>الأمان</b><small>كلمة المرور والجلسات</small></button>
    </div>`, { icon: ICONS.home })}`;

  countUp(el);
  hc.wire();
  clearInterval(liveTimer);
  liveTimer = setInterval(async () => {                          // تحديث هادئ لمؤشر «مباشر» كل دقيقتين والتبويب ظاهر
    if (ctx.tab() !== 'ov' || !el.isConnected || document.hidden || !el.closest('dialog')?.open) return clearInterval(liveTimer);
    const s2 = await settle(ctx.api('/api/stats?days=1'));
    if (s2) ctx.live(s2.live);
  }, 120000);
  el.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => ctx.go(b.dataset.go); });
  el.querySelector('#ovRf').onclick = () => tabOverview(el, ctx);
}

/* ---------------- سجل العمليات ---------------- */
const ICONS_BY_TYPE = { login: ICONS.key, publish: ICONS.upload, restore: ICONS.history, broadcast: ICONS.megaphone, security: ICONS.shield };
const LABELS = { login: 'دخول', publish: 'نشر', restore: 'استعادة', broadcast: 'بث', security: 'أمان' };
let filter = 'all';

export async function tabAudit(el, ctx) {
  el.innerHTML = skeleton('list');
  let log = null, err = '';
  try {
    const r = await ctx.api('/api/audit');
    if (r.ok) log = (await r.json()).log; else err = r.status === 501 ? 'تخزين الخادم (KV) غير مربوط.' : 'تعذّر تحميل السجل.';
  } catch { err = 'تعذّر الاتصال بالخادم.'; }
  if (ctx.tab() !== 'log' || !el.isConnected) return;
  if (!log) { el.innerHTML = pgHead('سجل العمليات', '') + `<div class="note warn">${err}</div>`; return; }

  const counts = { all: log.length };
  log.forEach((a) => { counts[a.type] = (counts[a.type] || 0) + 1; });
  const fails = log.filter((a) => !a.ok).length;
  const rows = log.filter((a) => filter === 'all' || a.type === filter || (filter === 'fail' && !a.ok));
  const csv = () => {
    const out = ['الوقت,النوع,الوصف,النتيجة,الجهاز,المكان,IP'].concat(log.map((a) => [fmtDT(a.t), LABELS[a.type] || a.type, `"${a.text.replace(/"/g, '""')}"`, a.ok ? 'نجاح' : 'فشل', a.dev || '', a.where || '', a.ip || ''].join(',')));
    const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob(['﻿' + out.join('\n')], { type: 'text/csv;charset=utf-8' }));
    l.download = 'botrm-audit.csv'; document.body.appendChild(l); l.click(); l.remove();
  };
  const chip = (k, label) => `<button type="button" class="fchip${filter === k ? ' on' : ''}" data-f="${k}">${label} <span>${counts[k] || 0}</span></button>`;

  el.innerHTML = `${pgHead('سجل العمليات', 'كل ما يحدث في لوحة الإدارة: من دخل، ومن نشر، وما الذي تغيّر (آخر 200 عملية)', `<button class="btn sm" id="auRf" type="button">${ICONS.refresh}تحديث</button><button class="btn sm" id="auCsv" type="button">${ICONS.download}CSV</button>`)}
    ${fails ? `<div class="note warn">⚠️ ${fails} عملية فاشلة في السجل (محاولات دخول خاطئة أو رفض). راجعها من المرشّح «فاشلة».</div>` : ''}
    <div class="fchips">${chip('all', 'الكل')}${Object.keys(LABELS).filter((k) => counts[k]).map((k) => chip(k, LABELS[k])).join('')}${fails ? chip('fail', 'فاشلة') : ''}</div>
    ${pn('العمليات', `${rows.length} عملية`, table(['الوقت', 'العملية', 'التفاصيل', 'الجهاز والمكان'], rows.map((a) => [
    `<b>${rel(a.t)}</b><small class="muted en">${fmtDT(a.t)}</small>`,
    `<span class="atype ${a.ok ? '' : 'bad'}">${ICONS_BY_TYPE[a.type] || ICONS.info}${LABELS[a.type] || a.type}</span>`,
    esc(a.text),
    `${esc(a.dev || '—')}<small class="muted">${esc([a.where, a.ip].filter(Boolean).join(' · '))}</small>`,
  ]), { empty: 'لا توجد عمليات تطابق المرشّح.' }), { icon: ICONS.log })}`;
  el.querySelectorAll('[data-f]').forEach((b) => { b.onclick = () => { filter = b.dataset.f; tabAudit(el, ctx); }; });
  el.querySelector('#auRf').onclick = () => tabAudit(el, ctx);
  el.querySelector('#auCsv').onclick = csv;
}
