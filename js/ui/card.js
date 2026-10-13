/** بطاقة تفاصيل الموقع */
import { esc, copyText } from '../lib/dom.js';
import { IO, govName } from '../lib/labels.js';
import { renderMore, FIELD_LABELS } from './fields.js';
import { formatDate } from '../lib/text.js';
import { LS } from '../lib/storage.js';

const svg = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const ICON = {
  call: svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
  whatsapp: svg('<path d="M3 21l1.7-5A9 9 0 1 1 8 19.3z"/><path d="M9 10c0 3 2 5 5 5l1.5-1.5-2-1-1 .8c-1-.4-1.8-1.2-2.2-2.2l.8-1-1-2z"/>'),
  map: svg('<path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'),
  share: svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'),
  image: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-8 8"/>'),
  print: svg('<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>'),
  copy: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  cluster: svg('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
  tech: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  address: svg('<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
};

/* ---------- الهاتف ---------- */
const splitPhones = (v) => (v ? String(v).split(/\s*[-–—+،,/]\s*|\s{2,}/).map((s) => s.trim()).filter(Boolean) : []);
const isPhone = (s) => s.replace(/\D/g, '').length >= 7 && /^[\d\s+]+$/.test(s);

export function whatsappUrl(num) {
  let d = num.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = `964${d.slice(1)}`;
  else if (d.length === 10 && d[0] === '7') d = `964${d}`;
  return `https://wa.me/${d}`;
}

/** كل أرقام الاتصال في شبكة مرتبة: رقم الفني (أو أكثر) ثم الفاتورة ثم صاحب الموقع */
function collectNumbers(r) {
  const groups = [['الفني', r.mp], ['الفاتورة', r.inv], ['صاحب الموقع', r.own]];
  return groups.flatMap(([label, value]) => {
    const nums = splitPhones(value).filter(isPhone);
    return nums.map((num, i) => ({ label: nums.length > 1 ? `${label} ${i + 1}` : label, num }));
  });
}

/** أزرار اتصال / واتساب / نسخ مصغّرة لرقم واحد (تُستعمل في الجداول) */
export function phoneActions(num, withCopy = true) {
  const clean = num.replace(/\s/g, '');
  return `<span class="pa"><a class="mini" href="tel:${esc(clean)}" aria-label="اتصال" title="اتصال">${ICON.call}</a><a class="mini wa" href="${whatsappUrl(num)}" target="_blank" rel="noopener" aria-label="واتساب" title="واتساب">${ICON.whatsapp}</a>${withCopy ? `<button class="mini cp" type="button" data-copy="${esc(clean)}" aria-label="نسخ" title="نسخ">${ICON.copy}</button>` : ''}</span>`;
}

function contactsBlock(r) {
  const list = collectNumbers(r);
  if (!list.length) return '';
  const pills = list.map(({ label, num }) => {
    const tel = `tel:${esc(num.replace(/\s/g, ''))}`;
    return `<div class="cpill"><a class="cpn" href="${tel}" aria-label="اتصال ${esc(label)}"><small>${esc(label)}</small><span>${esc(num)}</span></a><a class="mini wa" href="${whatsappUrl(num)}" target="_blank" rel="noopener" aria-label="واتساب ${esc(label)}">${ICON.whatsapp}</a><button class="mini cp" type="button" data-copy="${esc(num.replace(/\s/g, ''))}" aria-label="نسخ رقم ${esc(label)}" title="نسخ الرقم">${ICON.copy}</button></div>`;
  }).join('');
  return `<div class="contacts${list.length > 4 ? ' dense' : ''}">${pills}</div>`;
}

/* ---------- سجل التغييرات (يُحسب عند النشر ويُحفظ في r.ch) ---------- */
function historyBlock(r) {
  if (!Array.isArray(r.ch) || !r.ch.length) return '';
  const byDay = new Map();
  r.ch.forEach((e) => { const d = formatDate(new Date(e[0]).toISOString()); (byDay.get(d) || byDay.set(d, []).get(d)).push(e); });
  const val = (v) => (v ? `<span class="hv">${esc(v)}</span>` : '<span class="hv none">فارغ</span>');
  const body = [...byDay.entries()].map(([day, list]) => `<div class="hday"><b class="en">${esc(day)}</b>${list.map(([, k, o, n]) => k === '__new'
    ? '<div class="hrow new">➕ أُضيف الموقع إلى القائمة</div>'
    : `<div class="hrow"><span class="hk">${esc(FIELD_LABELS[k] || k)}</span>${val(o)}<i aria-hidden="true">←</i>${val(n)}</div>`).join('')}</div>`).join('');
  return `<details class="more hist" data-mem="hist"${openState().hist ? ' open' : ''}><summary><span>سجل التغييرات</span><em>آخر تعديل ${esc(formatDate(new Date(r.ch[0][0]).toISOString()))}</em></summary><div class="more-body">${body}</div></details>`;
}


/* ---------- تحديث حديث (آخر 7 أيام) + تذكّر الأقسام المفتوحة ---------- */
const FRESH_MS = 7 * 86400e3;
const freshKeys = (r, now = Date.now()) => new Set((Array.isArray(r.ch) ? r.ch : []).filter((e) => now - e[0] < FRESH_MS && e[1] !== '__new').map((e) => e[1]));
function freshAge(r, now = Date.now()) {
  const t = Array.isArray(r.ch) && r.ch[0] ? r.ch[0][0] : 0;
  if (!t || now - t >= FRESH_MS) return '';
  const d = Math.floor((now - t) / 86400e3);
  return d < 1 ? 'محدّث اليوم' : d === 1 ? 'محدّث أمس' : `محدّث منذ ${d} أيام`;
}
const OPEN_KEY = 'brm_open';
const openState = () => LS.get(OPEN_KEY, {}) || {};
document.addEventListener('toggle', (e) => {          // لا يتصاعد، لذلك نلتقطه في مرحلة الالتقاط
  const d = e.target;
  if (!(d instanceof HTMLDetailsElement) || !d.dataset.mem) return;
  const st = openState(); if (d.open) st[d.dataset.mem] = 1; else delete st[d.dataset.mem];
  LS.set(OPEN_KEY, st);
}, true);

/* ---------- مكوّنات ---------- */
const mapUrl = (r) => `https://www.google.com/maps?q=${r.lat},${r.lon}`;
const NONE = '<b class="k-none">غير محدد في الملف</b>';

const tile = (cls, icon, label, body, extra = '') =>
  `<div class="k ${cls}"><span class="ki">${icon}</span><div class="kb"><small>${label}</small>${body}</div>${extra}</div>`;

export function renderCard(r) {
  const sev = r.sev ? r.sev.toLowerCase() : '';
  const hasGeo = Boolean(r.lat && r.lon);

  const fk = freshKeys(r), chg = (...keys) => (keys.some((k) => fk.has(k)) ? ' chg' : '');
  const age = freshAge(r);
  const badges = [
    age && `<span class="bd upd" title="آخر تحديث للبيانات">${esc(age)}</span>`,
    r.sev && `<span class="bd ${sev}${chg('sev')}">${esc(r.sev)}</span>`,
    r.st && `<span class="bd${chg('st')}">${esc(r.st)}</span>`,
    r.ven && `<span class="bd">${esc(r.ven)}</span>`,
    r.io && `<span class="bd" style="direction:rtl">${esc(IO[r.io] || r.io)}</span>`,
  ].filter(Boolean).join('');

  const more = renderMore(r);

  return `<article class="card${sev ? ` sev-${sev}` : ''}">
    <div class="head">
      <div><div class="id">رقم الموقع</div><div class="id-n">${esc(r.id)}</div><div class="badges">${badges}</div></div>
      <div class="acts">
        ${hasGeo ? `<a class="btn pri icon" href="${mapUrl(r)}" target="_blank" rel="noopener" aria-label="فتح الخريطة" title="الخريطة">${ICON.map}</a>` : ''}
        <button class="btn icon" id="imgBtn" type="button" aria-label="مشاركة كصورة" title="صورة للواتساب">${ICON.image}</button>
        <button class="btn icon" id="printBtn" type="button" aria-label="طباعة" title="طباعة">${ICON.print}</button>
        <button class="btn icon" id="shareBtn" type="button" aria-label="مشاركة" title="مشاركة">${ICON.share}</button>
        <button class="btn icon" id="copyBtn" type="button" aria-label="نسخ" title="نسخ">${ICON.copy}</button>
      </div>
    </div>
    <div class="key">
      ${tile(`k-cl${r.cl ? '' : ' none'}${chg('cl')}`, ICON.cluster, 'الكلستر', r.cl ? `<b>${esc(r.cl)}</b>` : NONE)}
      ${tile(`k-gov${chg('gov')}`, ICON.map, 'المحافظة', `<b>${esc(govName(r.gov) || '—')}</b>`)}
      ${tile(`k-tech${chg('mn', 'mp')}`, ICON.tech, 'الفني', r.mn ? `<b>${esc(r.mn)}</b>` : NONE, contactsBlock(r))}
      ${tile(`k-addr${chg('nm')}`, ICON.address, 'العنوان', r.nm ? `<b>${esc(r.nm)}</b>` : NONE)}
    </div>
    ${historyBlock(r)}
    ${more.count ? `<details class="more" data-mem="more"${openState().more ? ' open' : ''}><summary><span>عرض المزيد</span><em>${more.count} حقل من الملف</em></summary><div class="more-body">${more.html}</div></details>` : ''}
  </article>`;
}

/* ---------- نسخ ومشاركة ---------- */
export function plainText(r) {
  return [
    `📍 موقع ${r.id}`, r.nm,
    `المحافظة: ${govName(r.gov) || '-'}`,
    `Severity: ${r.sev || '-'}  |  ${r.st || ''}`,
    r.cl && `الكلستر: ${r.cl}`, r.mn && `الفني: ${r.mn}`, r.mp && `رقم الفني: ${r.mp}`,
    r.inv && `رقم الفاتورة: ${r.inv}`, r.own && `رقم صاحب الموقع: ${r.own}`,
    r.lat && r.lon && mapUrl(r),
  ].filter(Boolean).join('\n');
}

export async function shareSite(r) {
  const text = plainText(r);
  if (navigator.share) {
    try { await navigator.share({ title: `موقع ${r.id}`, text }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  copyText(text);
}

/** بطاقة الموقع كصورة جاهزة للواتساب */
async function shareAsImage(r) {
  const btn = document.getElementById('imgBtn');
  btn.disabled = true;
  try {
    const [ex, { previewImages }] = await Promise.all([import('./exportImage.js'), import('./preview.js')]);
    const site = {
      id: r.id, sev: r.sev, st: r.st, gov: govName(r.gov), cl: r.cl, tech: r.mn, addr: r.nm,
      phones: collectNumbers(r).slice(0, 6),
    };
    const blobs = await ex.renderSiteImage(site);
    previewImages(ex, blobs, `موقع_${r.id}`, plainText(r));
  } catch (e) { console.error(e); alert('تعذّر إنشاء الصورة'); } finally { btn.disabled = false; }
}

let printHooked = false;
function hookPrint() {
  if (printHooked) return; printHooked = true;
  let opened = [];
  window.addEventListener('beforeprint', () => { opened = [...document.querySelectorAll('details.more:not([open])')]; opened.forEach((d) => { d.open = true; }); });
  window.addEventListener('afterprint', () => { opened.forEach((d) => { d.open = false; }); opened = []; });
}

export function wireCard(r) {
  hookPrint();
  document.getElementById('imgBtn')?.addEventListener('click', () => shareAsImage(r));
  document.getElementById('printBtn')?.addEventListener('click', () => window.print());
  document.getElementById('shareBtn')?.addEventListener('click', () => shareSite(r));
  document.getElementById('copyBtn')?.addEventListener('click', () => copyText(plainText(r)));
  document.querySelectorAll('.cpill [data-copy]').forEach((b) => b.addEventListener('click', () => copyText(b.dataset.copy)));
}

