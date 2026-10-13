/** البحث: رقم الموقع (تطابق تام + اقتراحات) أو نص (عنوان/اسم/كلستر) */
import { $, $$, esc, isTouchDevice } from '../lib/dom.js';
import { latinDigits, normalizeArabic } from '../lib/text.js';
import { govName } from '../lib/labels.js';
import { state } from '../data/store.js';
import { track, perfSearch } from '../data/analytics.js';
import { renderCard, wireCard } from './card.js';
import { pingSite, transition } from './effects.js';
import { mark } from '../lib/mark.js';
import { emptyState } from '../lib/art.js';
import { renderRecent, loadPopular } from './home.js';
import { setNavList, navBar, initSwipe } from './swipe.js';

const COMMIT_DELAY = 700;      // مهلة الصمت قبل اعتبار البحث نهائياً
let commitTimer = null;
let shownSig = '';             // بصمة الموقع المعروض: عند تحديث البيانات لا نعيد رسم بطاقة لم تتغيّر
let shownId = null;            // آخر موقع عُرض (لتشغيل التأثير مرة واحدة)

const sigOf = (r) => JSON.stringify(r, (k, v) => (k.startsWith('_') ? undefined : v));
const input = () => $('#q');
const currentQuery = () => latinDigits(input().value).trim();

/** على الهاتف: أخفِ لوحة المفاتيح بعد ظهور النتيجة حتى لا تحجب الشاشة */
function dismissKeyboard() { if (isTouchDevice()) input().blur(); }

export function setQuery(value) {
  transition(() => {
    input().value = value;
    onInput();
    clearTimeout(commitTimer);
    search(true);
  });
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

const notFound = (title, hint, extra = '') => emptyState('search', title, hint, extra);

/** عنصر قائمة: tokens لتظليل النص المطابق، idq لتظليل بداية الرقم */
function listItem(r, tokens = [], idq = '') {
  const sub = [govName(r.gov), r.cl].filter(Boolean).map((v) => mark(v, tokens)).join(' · ');
  return `<button class="li" type="button" data-id="${esc(r.id)}"${r.sev ? ` data-sev="${esc(r.sev)}"` : ''}><span class="n">${idq ? mark(r.id, [idq]) : esc(r.id)}</span><span class="t"><span class="nm">${mark(r.nm || '—', tokens)}</span><span class="g">${sub}</span></span></button>`;
}

function wireLinks() {
  $$('#out [data-id]').forEach((b) => {
    b.onclick = () => { if (b.classList.contains('li')) setNavList($$('#out .li').map((x) => x.dataset.id)); setQuery(b.dataset.id); dismissKeyboard(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  });
}

function showId(raw, out) {
  const hit = state.byId.get(raw) || state.byId.get(String(parseInt(raw, 10)));
  const similar = state.rows
    .filter((r) => r !== hit && r.id.startsWith(raw))
    .sort((x, y) => x.id.length - y.id.length || x.id - y.id)
    .slice(0, 8);
  if (hit) {
    shownSig = sigOf(hit);
    out.innerHTML = renderCard(hit) + navBar(hit.id) + similarChips(similar);
    wireCard(hit);
    if (shownId !== hit.id) { shownId = hit.id; pingSite(hit.sev); }
  } else if (similar.length) {
    shownSig = '';
    out.innerHTML = `<div class="suggest-title">مواقع تبدأ بـ <b>${esc(raw)}</b></div><div class="list">${similar.map((r) => listItem(r, [], raw)).join('')}</div>`;
  } else {
    const n = Number(raw);
    const near = state.rows.filter((r) => /^\d+$/.test(r.id)).sort((a, b) => Math.abs(a.id - n) - Math.abs(b.id - n)).slice(0, 6);
    out.innerHTML = notFound(`لا يوجد موقع بالرقم ${esc(raw)}`, 'تأكد من الرقم وأعد المحاولة.',
      near.length ? `<small>أقرب المواقع رقماً</small><div class="chips">${near.map((r) => `<button class="chip" type="button" data-id="${esc(r.id)}">${esc(r.id)}</button>`).join('')}</div>` : '');
  }
  return { found: Boolean(hit), exact: Boolean(hit), gov: hit?.gov || '' };
}

/** مسافة التحرير (Levenshtein) مع قطع مبكر عند تجاوز الحد */
function within(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let low = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < low) low = cur[j];
    }
    if (low > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}
const tolerance = (t) => (t.length >= 8 ? 2 : t.length >= 4 ? 1 : 0);

function fuzzyMatch(r, tokens) {
  const words = r._w || (r._w = r._s.split(' '));
  return tokens.every((t) => r._s.includes(t) || words.some((w) => within(t, w, tolerance(t))));
}

function showText(raw, out) {
  const tokens = normalizeArabic(raw).split(' ').filter(Boolean);
  let results = state.rows.filter((r) => tokens.every((t) => r._s.includes(t))).slice(0, 30);
  let approx = false;
  if (!results.length && tokens.some((t) => t.length >= 4)) { results = state.rows.filter((r) => fuzzyMatch(r, tokens)).slice(0, 30); approx = results.length > 0; }
  out.innerHTML = results.length
    ? `${approx ? '<div class="suggest-title">لا يوجد تطابق تام — نتائج <b>مقاربة</b> لما كتبت</div>' : ''}<div class="list">${results.map((r) => listItem(r, tokens)).join('')}</div>`
    : notFound('لا توجد نتائج', 'جرّب رقم الموقع أو جزءاً من العنوان أو اسم الفني.');
  return { found: results.length > 0, exact: false };
}

/** بحث برقم هاتف (7 أرقام فأكثر) */
function showPhone(raw, out) {
  const d = raw.replace(/^0+/, '');
  const results = state.rows.filter((r) => r._p.replace(/ /g, '').includes(d) || r._p.includes(raw)).slice(0, 30);
  out.innerHTML = results.length
    ? `<div class="suggest-title">مواقع مرتبطة بالرقم <b class="en">${esc(raw)}</b></div><div class="list">${results.map((r) => listItem(r)).join('')}</div>`
    : notFound('لا يوجد موقع بهذا الرقم', 'تأكد من رقم الهاتف وأعد المحاولة.');
  return { found: results.length > 0, exact: results.length === 1 };
}

function search(commit) {
  const t0 = performance.now();
  const raw = currentQuery(), out = $('#out');
  document.body.classList.toggle('has-result', Boolean(raw));
  if (!raw) {
    out.innerHTML = ''; shownId = null;
    history.replaceState(null, '', location.pathname);
    return;
  }
  history.replaceState(null, '', `#${encodeURIComponent(raw)}`);
  const isNum = /^\d+$/.test(raw);
  const { found, exact, gov = '' } = isNum ? (raw.length >= 7 ? showPhone(raw, out) : showId(raw, out)) : showText(raw, out);
  wireLinks();
  if (commit) {
    perfSearch(performance.now() - t0);
    track(raw, found, gov);
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
  document.addEventListener('botrm:data', () => {
    const raw = currentQuery();
    if (!raw) return;
    if (shownSig && /^\d+$/.test(raw)) {                           // وصل تحديث: البطاقة المفتوحة لا تُرسم من جديد إلا إذا تغيّر موقعها فعلاً
      const hit = state.byId.get(raw) || state.byId.get(String(parseInt(raw, 10)));
      if (hit && sigOf(hit) === shownSig) return;
    }
    const open = document.querySelector('details.more[open]:not(.hist)') ? true : false;
    search(false);
    if (open) document.querySelector('details.more:not(.hist)')?.setAttribute('open', '');
  });
  renderRecent(setQuery);
  loadPopular(setQuery);
  initSwipe((id) => { setQuery(id); window.scrollTo({ top: 0, behavior: 'smooth' }); });

  const initial = decodeURIComponent(location.hash.slice(1));
  if (initial) { q.value = initial; onInput(); } else q.focus({ preventScroll: true });
}
