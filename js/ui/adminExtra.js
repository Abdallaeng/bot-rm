/** تبويبا الإدارة: البث (إعلانات لكل المستخدمين) والتنبيهات (فحوصات تلقائية للبيانات والاستخدام). */
import { esc, toast } from '../lib/dom.js';
import { govName } from '../lib/labels.js';
import { state } from '../data/store.js';
import { ICONS } from '../lib/icons.js';
import { pgHead, pn, dl, pill, table, rel, fmtDT, skeleton } from './adminUI.js';

const LV = { info: ['📣', 'معلومة'], warn: ['⚠️', 'تنبيه'], alert: ['🚨', 'عاجل'] };
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'الآن' : m < 60 ? `قبل ${m} دقيقة` : m < 1440 ? `قبل ${Math.round(m / 60)} ساعة` : `قبل ${Math.round(m / 1440)} يوم`; };
const explain = (status) => status === 501 ? 'تخزين الخادم (KV) غير مربوط بالمشروع بعد.' : status === 401 ? 'بيانات الدخول غير مقبولة، سجّل الخروج وادخل من جديد.' : 'تعذّر الاتصال بالخادم.';

/* ---------------- البث ---------------- */
export async function tabBroadcast(el, api, current) {
  el.innerHTML = '<div class="note">جارٍ التحميل…</div>';
  let cur = null, hist = [], err = '';
  try {
    const [a, b] = await Promise.all([fetch('/api/broadcast', { cache: 'no-store' }), api('/api/bhist')]);
    if (a.ok) cur = (await a.json()).b;
    if (b.ok) hist = (await b.json()).h; else err = explain(b.status);
  } catch { err = explain(0); }
  if (current() !== 'bc' || !el.isConnected) return;

  el.innerHTML = `${pgHead('البث', 'إعلانات تظهر كشريط في أعلى التطبيق لكل المستخدمين')}${err ? `<div class="note warn">⚠️ ${err}</div>` : ''}
    <div class="note">اكتب رسالة تظهر كشريط في أعلى الموقع لكل المستخدمين عند فتحهم التطبيق (وتصل لمن هو فاتحه خلال دقيقة أو دقيقتين).</div>
    ${cur ? `<div class="h4">الإعلان الحالي ${cur.expires ? `— ينتهي ${new Date(cur.expires).toLocaleString('en-GB', { hour12: false })}` : '— بدون انتهاء'}</div><div class="pvbc ${cur.level}">${LV[cur.level][0]} ${esc(cur.text)}</div><div class="sp"></div><button class="btn" id="bcClear" type="button">🗑️ إيقاف الإعلان الحالي</button><div class="sp"></div>` : ''}
    <div class="h4">إعلان جديد</div>
    <div class="form">
      <textarea class="inp" id="bcText" maxlength="400" placeholder="مثال: تم تحديث بيانات المواقع، يرجى إغلاق التطبيق وفتحه من جديد."></textarea>
      <div class="lvls">${Object.entries(LV).map(([k, v], i) => `<label><input type="radio" name="bcl" value="${k}"${i === 0 ? ' checked' : ''}>${v[0]} ${v[1]}</label>`).join('')}</div>
      <div><label for="bcH">مدة العرض</label><select class="inp" id="bcH"><option value="0">حتى أوقفه يدوياً</option><option value="1">ساعة</option><option value="24" selected>يوم واحد</option><option value="72">3 أيام</option><option value="168">أسبوع</option></select></div>
      <div id="bcPrev"></div>
      <button class="btn pri" id="bcSend" type="button" style="height:48px;font-size:16px">📣 إرسال للجميع</button><div class="err" id="bcErr"></div>
    </div>
    ${hist.length ? `<div class="h4">آخر الإعلانات</div>${hist.map((h) => `<button class="alr" type="button" data-h="${esc(h.id)}" style="width:100%;text-align:start"><span class="ai">${LV[h.level]?.[0] || '📣'}</span><div><b>${esc(h.text.slice(0, 70))}${h.text.length > 70 ? '…' : ''}</b><span>${ago(h.created)} · اضغط لإعادة الاستخدام</span></div></button>`).join('')}` : ''}`;

  const txt = el.querySelector('#bcText'), prev = el.querySelector('#bcPrev');
  const lvl = () => el.querySelector('input[name=bcl]:checked').value;
  const draw = () => { prev.innerHTML = txt.value.trim() ? `<div class="h4">معاينة</div><div class="pvbc ${lvl()}">${LV[lvl()][0]} ${esc(txt.value.trim())}</div>` : ''; };
  txt.oninput = draw; el.querySelectorAll('input[name=bcl]').forEach((r) => r.onchange = draw);
  el.querySelectorAll('[data-h]').forEach((b) => b.onclick = () => { const h = hist.find((x) => x.id === b.dataset.h); txt.value = h.text; el.querySelector(`input[value=${h.level}]`).checked = true; draw(); txt.focus(); });
  el.querySelector('#bcClear')?.addEventListener('click', async () => {
    const r = await api('/api/broadcast', { method: 'POST', body: JSON.stringify({ action: 'clear' }) });
    if (r.ok) { toast('تم إيقاف الإعلان'); tabBroadcast(el, api, current); }
  });
  el.querySelector('#bcSend').onclick = async () => {
    const text = txt.value.trim(), e = el.querySelector('#bcErr'); e.textContent = '';
    if (!text) { e.textContent = 'اكتب نص الإعلان أولاً.'; return; }
    const b = el.querySelector('#bcSend'); b.disabled = true;
    try {
      const r = await api('/api/broadcast', { method: 'POST', body: JSON.stringify({ action: 'set', text, level: lvl(), hours: +el.querySelector('#bcH').value }) });
      if (!r.ok) throw new Error(explain(r.status));
      toast('تم إرسال الإعلان'); tabBroadcast(el, api, current);
    } catch (x) { e.textContent = '❌ ' + (x.message || x); b.disabled = false; }
  };
}

/* ---------------- التنبيهات ---------------- */
export function dataChecks() {
  const rows = state.rows, out = [];
  const total = rows.length;
  const upd = state.meta.updated ? new Date(state.meta.updated) : null;
  if (upd && !isNaN(upd)) {
    const d = Math.floor((Date.now() - upd) / 86400e3);
    out.push(d > 60 ? ['bad', '🗓️', `البيانات قديمة (${d} يوم)`, 'آخر تحديث للملف قبل أكثر من شهرين. ارفع نسخة جديدة من تبويب البيانات.']
      : d > 30 ? ['warn', '🗓️', `لم تُحدَّث البيانات منذ ${d} يوم`, 'يُفضّل تحديث الملف شهرياً على الأقل.']
      : ['ok', '🗓️', 'البيانات حديثة', `آخر تحديث قبل ${d} يوم — ${total} موقع.`]);
  }
  const gaps = [
    ['mp', '📵', 'مواقع بلا رقم هاتف'], ['mn', '👷', 'مواقع بلا اسم فني'], ['cl', '🧩', 'مواقع بلا كلستر'],
    ['gov', '🏛️', 'مواقع بلا محافظة'], ['lat', '📍', 'مواقع بلا إحداثيات'],
  ];
  gaps.forEach(([f, ic, title]) => {
    const miss = rows.filter((r) => !String(r[f] ?? '').trim() || r[f] === 0);
    if (!miss.length) return;
    const pct = Math.round(miss.length / total * 100);
    out.push([pct >= 10 ? 'bad' : pct >= 3 ? 'warn' : 'ok', ic, `${title}: ${miss.length}`, `${pct}% من المواقع. مثال: ${miss.slice(0, 6).map((r) => r.id).join('، ')}${miss.length > 6 ? '…' : ''}`]);
  });
  const dup = new Map(); rows.forEach((r) => { const p = String(r.mp || '').match(/\d{9,13}/g) || []; p.forEach((n) => dup.set(n, (dup.get(n) || 0) + 1)); });
  const sev1 = rows.filter((r) => r.sev === 'S1').length;
  out.push(['ok', '🚦', `مواقع S1 (الأعلى أولوية): ${sev1}`, `${Math.round(sev1 / total * 100)}% من إجمالي المواقع.`]);
  const noTech = new Map(); rows.filter((r) => r.sev === 'S1' && !(r.mn || '').trim()).forEach((r) => noTech.set(govName(r.gov) || '—', (noTech.get(govName(r.gov) || '—') || 0) + 1));
  if (noTech.size) out.push(['bad', '🚨', 'مواقع S1 بلا فني', [...noTech].map(([g, n]) => `${g}: ${n}`).join(' · ')]);
  return out;
}

export async function tabAlerts(el, api, current) {
  el.innerHTML = '<div class="note">جارٍ الفحص…</div>';
  const items = dataChecks();
  let stErr = '', digest = '';
  try {
    const r = await api('/api/stats?days=7');
    if (!r.ok) stErr = explain(r.status);
    else {
      const st = await r.json();
      const s = st.days.reduce((t, d) => t + d.s, 0), m = st.days.reduce((t, d) => t + d.m, 0);
      {
        const t = st.days.at(-1), top = t.top.slice(0, 5).map(([q, n]) => `${q} (${n})`).join('، ') || '—', ms = t.miss.slice(0, 5).map(([q, n]) => `${q} (${n})`).join('، ') || '—';
        const peak = t.h.indexOf(Math.max(...t.h));
        digest = `📊 ملخص Bot Rm — ${new Date().toLocaleDateString('en-GB')}\n• عمليات البحث اليوم: ${t.s} (أجهزة: ${t.u})\n• بدون نتيجة: ${t.m}\n• ساعة الذروة: ${t.s ? peak + ':00' : '—'}\n• الأكثر بحثاً: ${top}\n• مطلوبة وغير موجودة: ${ms}\n• آخر 7 أيام: ${s} عملية بحث`;
      }
      const today = st.days.at(-1), prev = st.days.slice(0, -1).filter((d) => d.s);
      const avg = prev.length ? prev.reduce((t, d) => t + d.s, 0) / prev.length : 0;
      if (s && m / s > 0.25) items.unshift(['warn', '🔎', `نسبة البحث بلا نتيجة مرتفعة (${Math.round(m / s * 100)}%)`, 'راجع قائمة "بحث بلا نتيجة" في التقارير: قد تكون مواقع ناقصة من الملف.']);
      const miss = {}; st.days.forEach((d) => d.miss.forEach(([q, n]) => { miss[q] = (miss[q] || 0) + n; }));
      const rep = Object.entries(miss).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8);
      if (rep.length) items.unshift(['bad', '❓', 'مواقع يُبحث عنها كثيراً وغير موجودة', rep.map(([q, n]) => `${q} (${n})`).join(' · ')]);
      if (avg >= 10 && today.s > avg * 2) items.unshift(['warn', '📈', 'ارتفاع غير معتاد في الاستخدام اليوم', `${today.s} عملية بحث مقابل متوسط ${Math.round(avg)} في الأيام السابقة.`]);
      if (avg >= 10 && today.s < avg * 0.3 && new Date().getHours() >= 18) items.unshift(['warn', '📉', 'انخفاض الاستخدام اليوم', `${today.s} عملية بحث مقابل متوسط ${Math.round(avg)}.`]);
      if (!s) items.unshift(['warn', '📭', 'لا توجد عمليات بحث مسجّلة آخر 7 أيام', 'قد يكون التتبّع متوقفاً أو لا يوجد مستخدمون.']);
    }
  } catch { stErr = explain(0); }
  if (current() !== 'alr' || !el.isConnected) return;
  if (stErr) items.unshift(['warn', '🔌', 'تحليلات الاستخدام غير متاحة', stErr]);
  const order = { bad: 0, warn: 1, ok: 2 };
  items.sort((a, b) => order[a[0]] - order[b[0]]);
  const nBad = items.filter((i) => i[0] === 'bad').length, nWarn = items.filter((i) => i[0] === 'warn').length;
  el.innerHTML = `${pgHead('التنبيهات', 'فحوصات تلقائية لجودة البيانات والاستخدام وملخص يومي للمشاركة')}<div class="note ${nBad || nWarn ? 'warn' : 'ok'}">${nBad || nWarn ? `🔔 ${nBad} عاجل · ${nWarn} للمراجعة` : '✅ كل شيء سليم'}</div>
    ${items.map(([lv, ic, t, d]) => `<div class="alr ${lv}"><span class="ai">${ic}</span><div><b>${esc(t)}</b><span>${esc(d)}</span></div></div>`).join('')}
    <button class="btn" id="alrRe" type="button">🔄 إعادة الفحص</button>
    <div class="h4">📝 ملخص اليوم (للمشاركة)</div><textarea class="inp" id="dgText" readonly>${esc(digest)}</textarea>
    <div class="sp"></div><div class="row"><button class="btn pri" id="dgShare" type="button">📤 مشاركة</button><button class="btn" id="dgCopy" type="button">📋 نسخ</button></div>`;
  el.querySelector('#dgCopy').onclick = async () => { try { await navigator.clipboard.writeText(digest); toast('تم النسخ'); } catch { el.querySelector('#dgText').select(); } };
  el.querySelector('#dgShare').onclick = async () => { if (navigator.share) { try { await navigator.share({ text: digest }); } catch { /* ألغى */ } } else { try { await navigator.clipboard.writeText(digest); toast('تم النسخ'); } catch { /* */ } } };
  el.querySelector('#alrRe').onclick = () => tabAlerts(el, api, current);
}

/* ---------------- الأمان ---------------- */
export async function tabSecurity(el, api, ctx) {
  el.innerHTML = skeleton('list');
  let au = [];
  try { const r = await api('/api/audit'); if (r.ok) au = (await r.json()).log; } catch { /* */ }
  if (!el.isConnected) return;
  const logins = au.filter((a) => a.type === 'login').slice(0, 8);
  const lastOk = logins.filter((a) => a.ok)[1];                 // الأول هو الدخول الحالي
  const fails = au.filter((a) => !a.ok && Date.now() - a.t < 86400e3).length;
  const weak = !!document.querySelector('.astrip');

  const checks = [
    [!weak, weak ? 'كلمة المرور افتراضية — غيّرها الآن' : 'كلمة المرور مخصّصة'],
    [fails === 0, fails ? `${fails} محاولة/عملية فاشلة آخر 24 ساعة` : 'لا محاولات فاشلة آخر 24 ساعة'],
    [true, 'التحقق من الدخول في الخادم (لا في المتصفح)'],
    [true, 'قفل 15 دقيقة بعد 5 محاولات خاطئة'],
    [true, 'الجلسات موقّعة وتنتهي بعد 12 ساعة'],
  ];
  el.innerHTML = `${pgHead('الأمان', 'حالة حماية لوحة الإدارة وإدارة كلمة المرور والجلسات')}
    ${pn('حالة الأمان', '', `<ul class="chk">${checks.map(([ok, t]) => `<li class="${ok ? 'ok' : 'bad'}">${ok ? ICONS.check : ICONS.alert}<span>${t}</span></li>`).join('')}</ul>`, { icon: ICONS.shield })}
    <div class="grid2">
    ${pn('تغيير كلمة المرور', 'المستخدم: <span class="en">admin</span> · يُنهي كل الجلسات الأخرى', `<form class="form" id="pwf" autocomplete="off">
      <div><label>كلمة المرور الحالية</label><input class="inp ltr" id="pwo" type="password" autocomplete="current-password" required></div>
      <div><label>كلمة المرور الجديدة (8 أحرف على الأقل، أرقام وحروف)</label><input class="inp ltr" id="pwn" type="password" autocomplete="new-password" minlength="8" required></div>
      <div><label>تأكيد كلمة المرور الجديدة</label><input class="inp ltr" id="pwc" type="password" autocomplete="new-password" required></div>
      <button class="btn pri" style="height:46px">${ICONS.key} تغيير كلمة المرور</button><div class="err" id="pwe"></div></form>`, { icon: ICONS.key })}
    ${pn('الجلسات', 'جلسة واحدة نشطة على هذا الجهاز', `${dl([['الجلسة الحالية', ctx.sessionText()], ['آخر دخول سابق', lastOk ? `${rel(lastOk.t)} · ${lastOk.dev || ''} ${lastOk.where ? '· ' + lastOk.where : ''}` : '—']])}
      <div class="sp"></div><button class="btn" id="outAll" type="button">${ICONS.logout} إنهاء كل الجلسات الآن</button><div class="muted sm" style="margin-top:8px">يخرج كل من سجّل الدخول (بما فيهم أنت) ويلزم الدخول من جديد.</div>`, { icon: ICONS.user })}
    </div>
    ${pn('آخر محاولات الدخول', '', table(['الوقت', 'النتيجة', 'الجهاز والمكان'], logins.map((a) => [`<b>${rel(a.t)}</b><small class="muted en">${fmtDT(a.t)}</small>`, a.ok ? pill('ناجح', 'ok') : pill('فاشل', 'bad'), `${a.dev || '—'}<small class="muted">${[a.where, a.ip].filter(Boolean).join(' · ')}</small>`]), { empty: 'لا توجد محاولات مسجّلة.' }), { icon: ICONS.log })}`;
  el.querySelector('#pwf').onsubmit = async (e) => {
    e.preventDefault();
    const err = el.querySelector('#pwe'); err.textContent = '';
    const next = el.querySelector('#pwn').value;
    if (next !== el.querySelector('#pwc').value) { err.textContent = 'التأكيد لا يطابق كلمة المرور الجديدة.'; return; }
    const r = await api('/api/password', { method: 'POST', body: JSON.stringify({ old: el.querySelector('#pwo').value, next }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { toast('تم تغيير كلمة المرور. سجّل الدخول من جديد.'); document.getElementById('dlg').close(); }
    else err.textContent = j.error === 'wrong-old' ? 'كلمة المرور الحالية غير صحيحة.' : j.error === 'weak' ? `كلمة المرور ضعيفة: ${j.hint}.` : j.error === 'unauthorized' ? 'انتهت الجلسة، ادخل من جديد.' : 'تعذّر تغيير كلمة المرور.';
  };
  el.querySelector('#outAll').onclick = async () => {
    if (!confirm('سيتم إنهاء كل جلسات الإدارة بما فيها هذه. متابعة؟')) return;
    const r = await api('/api/logoutall', { method: 'POST' });
    if (r.ok) { toast('تم إنهاء كل الجلسات'); document.getElementById('dlg').close(); } else toast('تعذّر التنفيذ');
  };
}
