/** بطاقة تفاصيل الموقع */
import { esc, copyText } from '../lib/dom.js';
import { IO, govName } from '../lib/labels.js';
import { renderMore } from './fields.js';

const svg = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const ICON = {
  call: svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
  whatsapp: svg('<path d="M3 21l1.7-5A9 9 0 1 1 8 19.3z"/><path d="M9 10c0 3 2 5 5 5l1.5-1.5-2-1-1 .8c-1-.4-1.8-1.2-2.2-2.2l.8-1-1-2z"/>'),
  map: svg('<path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'),
  share: svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'),
  copy: svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  cluster: svg('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
  tech: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  address: svg('<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
};

/* ---------- الهاتف ---------- */
const splitPhones = (v) => (v ? String(v).split(/\s*[-–—+،,/]\s*|\s{2,}/).map((s) => s.trim()).filter(Boolean) : []);
const isPhone = (s) => s.replace(/\D/g, '').length >= 7 && /^[\d\s+]+$/.test(s);

function whatsappUrl(num) {
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

function contactsBlock(r) {
  const list = collectNumbers(r);
  if (!list.length) return '';
  const pills = list.map(({ label, num }) => {
    const tel = `tel:${esc(num.replace(/\s/g, ''))}`;
    return `<div class="pill"><a class="pn" href="${tel}" aria-label="اتصال ${esc(label)}"><small>${esc(label)}</small><span>${esc(num)}</span></a><a class="mini wa" href="${whatsappUrl(num)}" target="_blank" rel="noopener" aria-label="واتساب ${esc(label)}">${ICON.whatsapp}</a></div>`;
  }).join('');
  return `<div class="contacts${list.length > 4 ? ' dense' : ''}">${pills}</div>`;
}

/* ---------- مكوّنات ---------- */
const mapUrl = (r) => `https://www.google.com/maps?q=${r.lat},${r.lon}`;
const NONE = '<b class="k-none">غير محدد في الملف</b>';

const tile = (cls, icon, label, body, extra = '') =>
  `<div class="k ${cls}"><span class="ki">${icon}</span><div class="kb"><small>${label}</small>${body}</div>${extra}</div>`;

export function renderCard(r) {
  const sev = r.sev ? r.sev.toLowerCase() : '';
  const hasGeo = Boolean(r.lat && r.lon);

  const badges = [
    r.sev && `<span class="bd ${sev}">${esc(r.sev)}</span>`,
    r.st && `<span class="bd">${esc(r.st)}</span>`,
    r.ven && `<span class="bd">${esc(r.ven)}</span>`,
    r.io && `<span class="bd" style="direction:rtl">${esc(IO[r.io] || r.io)}</span>`,
  ].filter(Boolean).join('');

  const more = renderMore(r);

  return `<article class="card${sev ? ` sev-${sev}` : ''}">
    <div class="head">
      <div><div class="id">رقم الموقع</div><div class="id-n">${esc(r.id)}</div><div class="badges">${badges}</div></div>
      <div class="acts">
        ${hasGeo ? `<a class="btn pri icon" href="${mapUrl(r)}" target="_blank" rel="noopener" aria-label="فتح الخريطة" title="الخريطة">${ICON.map}</a>` : ''}
        <button class="btn icon" id="shareBtn" type="button" aria-label="مشاركة" title="مشاركة">${ICON.share}</button>
        <button class="btn icon" id="copyBtn" type="button" aria-label="نسخ" title="نسخ">${ICON.copy}</button>
      </div>
    </div>
    <div class="key">
      ${tile(`k-cl${r.cl ? '' : ' none'}`, ICON.cluster, 'الكلستر', r.cl ? `<b>${esc(r.cl)}</b>` : NONE)}
      ${tile('k-gov', ICON.map, 'المحافظة', `<b>${esc(govName(r.gov) || '—')}</b>`)}
      ${tile('k-tech', ICON.tech, 'الفني', r.mn ? `<b>${esc(r.mn)}</b>` : NONE, contactsBlock(r))}
      ${tile('k-addr', ICON.address, 'العنوان', r.nm ? `<b>${esc(r.nm)}</b>` : NONE)}
    </div>
    ${more.count ? `<details class="more"><summary><span>عرض المزيد</span><em>${more.count} حقل من الملف</em></summary><div class="more-body">${more.html}</div></details>` : ''}
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

export function wireCard(r) {
  document.getElementById('shareBtn')?.addEventListener('click', () => shareSite(r));
  document.getElementById('copyBtn')?.addEventListener('click', () => copyText(plainText(r)));
}

