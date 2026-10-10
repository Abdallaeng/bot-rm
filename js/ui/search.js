/** البحث: رقم الموقع (تطابق تام + اقتراحات) أو نص (عنوان/اسم/كلستر) */
import { $, $$, esc, isTouchDevice } from '../lib/dom.js';
import { latinDigits, normalizeArabic } from '../lib/text.js';
import { govName } from '../lib/labels.js';
import { state } from '../data/store.js';
import { track } from '../data/analytics.js';
import { renderCard, wireCard } from './card.js';
import { pingSite } from './effects.js';
import { renderRecent } from './home.js';

const COMMIT_DELAY = 700;      // مهلة الصمت قبل اعتبار البحث نهائياً
let commitTimer = null;
let shownId = null;            // آخر موقع عُرض (لتشغيل التأثير مرة واحدة)

const input = () => $('#q');
const currentQuery = () => latinDigits(input().value).trim();

/** على الهاتف: أخفِ لوحة المفاتيح بعد ظهور النتيجة حتى لا تحجب الشاشة */
function dismissKeyboard() { if (isTouchDevice()) input().blur(); }

export function setQuery(value) {
  input().value = value;
  onInput();
  clearTimeout(commitTimer);
  search(true);
}

function onInput() {
  const q = input();
  const normalized = latinDigits(q.value);           // الأرقام العربية تتحول إلى إنكليزية داخل الحقل نفسه
  if (normalized !== q.value) q.value = normalized;
  $('#clr').hidden = !q.value;
  search(false);
  clearTimeout(commitTimer);
  commitTimer = setTimeout(() => search(true), COMMIT_DELAY);
}

function similarChips(sites, withoutTitle) {
  if (!sites.length) return '';
  const chips = sites.map((r) => `<button class="chip" type="button" data-id="${esc(r.id)}">${esc(r.id)}</button>`).join('');
  return `<div class="simi"><small>${withoutTitle ? '' : 'مواقع مشابهة'}</small><div>${chips}</div></div>`;
}

const notFound = (title, hint) => `<div class="notfound"><b>${title}</b>${hint}</div>`;

function listItem(r) {
  const sub = [govName(r.gov), r.cl].filter(Boolean).map(esc).join(' · ');
  return `<button class="li" type="button" data-id="${esc(r.id)}"><span class="n">${esc(r.id)}</span><span class="t">${esc(r.nm || '—')}<br><span class="g">${sub}</span></span></button>`;
}

function wireLinks() {
  $$('#out [data-id]').forEach((b) => {
    b.onclick = () => { setQuery(b.dataset.id); dismissKeyboard(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  });
}

function showId(raw, out) {
  const hit = state.byId.get(raw) || state.byId.get(String(parseInt(raw, 10)));
  const similar = state.rows.filter((r) => r !== hit && r.id.startsWith(raw)).slice(0, 8);
  if (hit) {
    out.innerHTML = renderCard(hit) + similarChips(similar);
    wireCard(hit);
    if (shownId !== hit.id) { shownId = hit.id; pingSite(); }
  } else if (similar.length) {
    out.innerHTML = notFound(`لا يوجد موقع بالرقم ${esc(raw)}`, 'هل تقصد أحد هذه؟') + similarChips(similar, true);
  } else {
    out.innerHTML = notFound(`لا يوجد موقع بالرقم ${esc(raw)}`, 'تأكد من الرقم وأعد المحاولة.');
  }
  return { found: Boolean(hit), exact: Boolean(hit) };
}

function showText(raw, out) {
  const tokens = normalizeArabic(raw).split(' ').filter(Boolean);
  const results = state.rows.filter((r) => tokens.every((t) => r._s.includes(t))).slice(0, 30);
  out.innerHTML = results.length
    ? `<div class="list">${results.map(listItem).join('')}</div>`
    : notFound('لا توجد نتائج', 'جرّب رقم الموقع أو جزءاً من العنوان.');
  return { found: results.length > 0, exact: false };
}

function search(commit) {
  const raw = currentQuery(), out = $('#out');
  document.body.classList.toggle('has-result', Boolean(raw));
  if (!raw) {
    out.innerHTML = ''; shownId = null;
    history.replaceState(null, '', location.pathname);
    return;
  }
  history.replaceState(null, '', `#${encodeURIComponent(raw)}`);
  const { found, exact } = /^\d+$/.test(raw) ? showId(raw, out) : showText(raw, out);
  wireLinks();
  if (commit) {
    track(raw, found);
    if (exact) dismissKeyboard();
  }
}

export function initSearch() {
  const q = input();
  q.disabled = false;
  q.addEventListener('input', onInput);
  $('#form').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(commitTimer); search(true); q.blur(); });
  $('#clr').addEventListener('click', () => { q.value = ''; onInput(); q.focus(); });
  document.addEventListener('botrm:log', () => renderRecent(setQuery));
  renderRecent(setQuery);

  const initial = decodeURIComponent(location.hash.slice(1));
  if (initial) { q.value = initial; onInput(); } else q.focus({ preventScroll: true });
}
