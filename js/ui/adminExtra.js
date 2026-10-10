/** تبويبا الإدارة: البث (إعلانات لكل المستخدمين) والتنبيهات (فحوصات تلقائية للبيانات والاستخدام). */
import { esc, toast } from '../lib/dom.js';
import { govName } from '../lib/labels.js';
import { state } from '../data/store.js';

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

  el.innerHTML = `${err ? `<div class="note warn">⚠️ ${err}</div>` : ''}
    <div class="note">اكتب رسالة تظهر كشريط في أعلى الموقع لكل المستخدمين عند فتحهم التطبيق (وتتحدّث خلال 5 دقائق لمن هو فاتحه).</div>
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
function dataChecks() {
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
  let stErr = '';
  try {
    const r = await api('/api/stats?days=7');
    if (!r.ok) stErr = explain(r.status);
    else {
      const st = await r.json();
      const s = st.days.reduce((t, d) => t + d.s, 0), m = st.days.reduce((t, d) => t + d.m, 0);
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
  el.innerHTML = `<div class="note ${nBad || nWarn ? 'warn' : 'ok'}">${nBad || nWarn ? `🔔 ${nBad} عاجل · ${nWarn} للمراجعة` : '✅ كل شيء سليم'}</div>
    ${items.map(([lv, ic, t, d]) => `<div class="alr ${lv}"><span class="ai">${ic}</span><div><b>${esc(t)}</b><span>${esc(d)}</span></div></div>`).join('')}
    <button class="btn" id="alrRe" type="button">🔄 إعادة الفحص</button>`;
  el.querySelector('#alrRe').onclick = () => tabAlerts(el, api, current);
}
