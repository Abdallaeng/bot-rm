/** تصفّح حسب الكلستر: اختر الكلستر ← المحافظة (أو الكل) ← الفني (أو الكل) لترى كل مواقعه.
 *  مستقل عن البحث العام؛ الضغط على موقع يفتح بطاقته. */
import { $, esc } from '../lib/dom.js';
import { LS } from '../lib/storage.js';
import { govName } from '../lib/labels.js';
import { state } from '../data/store.js';
import { setQuery } from './search.js';
import { setNavList } from './swipe.js';
import { ICONS } from '../lib/icons.js';
import { previewImages, previewPdf } from './preview.js';
import { mark, tokensOf } from '../lib/mark.js';
import { emptyState } from '../lib/art.js';
import { tween } from './effects.js';

const NONE = 'غير محدد';
const PAGE = 80;
const sel = { clusters: [], gov: '', tech: '', text: '', sev: [], io: '', noTech: false };
let shown = PAGE;
let lastCount = 0;                   // لتحريك رقم الملخص من القيمة السابقة إلى الجديدة

const clusterOf = (r) => r.cl || NONE;
const techOf = (r) => (r.mn || '').trim() || NONE;
const byCount = (map) => [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ar'));
const tally = (rows, fn) => rows.reduce((m, r) => m.set(fn(r), (m.get(fn(r)) || 0) + 1), new Map());

function filtered() {
  const q = sel.text.trim().toLowerCase();
  return state.rows.filter((r) =>
    sel.clusters.includes(clusterOf(r))
    && (!sel.gov || r.gov === sel.gov)
    && (!sel.tech || techOf(r) === sel.tech)
    && (!sel.sev.length || sel.sev.includes(r.sev))
    && (!sel.io || r.io === sel.io)
    && (!sel.noTech || techOf(r) === NONE)
    && (!q || r.id.startsWith(q) || (r.nm || '').toLowerCase().includes(q)));
}

function clusterChips() {
  const counts = byCount(tally(state.rows, clusterOf));
  return counts.map(([name, n]) =>
    `<button type="button" class="cchip${sel.clusters.includes(name) ? ' on' : ''}" data-cl="${esc(name)}"><b>${esc(name)}</b><span>${n}</span></button>`).join('');
}

function render() {
  const root = $('#browse .bbody');
  const inCluster = state.rows.filter((r) => sel.clusters.includes(clusterOf(r)));
  const govCounts = byCount(tally(inCluster, (r) => r.gov || ''));
  const inGov = sel.gov ? inCluster.filter((r) => r.gov === sel.gov) : inCluster;
  const techCounts = byCount(tally(inGov, techOf));
  if (sel.tech && !techCounts.some(([t]) => t === sel.tech)) sel.tech = '';
  const list = filtered().sort((a, b) => a.id - b.id);
  const sev = tally(list, (r) => r.sev || '');

  const govChips = [`<button type="button" class="gchip${sel.gov ? '' : ' on'}" data-gov="">الكل <span>${inCluster.length}</span></button>`]
    .concat(govCounts.map(([g, n]) => `<button type="button" class="gchip${sel.gov === g ? ' on' : ''}" data-gov="${esc(g)}">${esc(govName(g) || NONE)} <span>${n}</span></button>`)).join('');
  const techOpts = [`<option value="">كل الفنيين (${techCounts.length})</option>`]
    .concat(techCounts.map(([t, n]) => `<option value="${esc(t)}"${sel.tech === t ? ' selected' : ''}>${esc(t)} — ${n}</option>`)).join('');

  const qt = sel.text.trim().toLowerCase(), toks = tokensOf(sel.text);
  const rows = list.slice(0, shown).map((r) =>
    `<button class="li" type="button" data-id="${esc(r.id)}"${r.sev ? ` data-sev="${esc(r.sev)}"` : ''}><span class="n">${qt && r.id.startsWith(qt) ? mark(r.id, [qt]) : esc(r.id)}</span><span class="t"><span class="nm">${mark(r.nm || '—', toks)}</span><span class="g">${[govName(r.gov), techOf(r)].filter(Boolean).map(esc).join(' · ')}</span></span>${r.sev ? `<span class="bd ${r.sev.toLowerCase()}">${esc(r.sev)}</span>` : ''}</button>`).join('');

  root.innerHTML = `
    <div class="bsec"><label>الكلستر <small>(يمكنك اختيار أكثر من كلستر)</small>${sel.clusters.length ? ' <button type="button" class="clr-cl" id="bClear">مسح الاختيار</button>' : ''}</label><div class="cchips">${clusterChips()}</div></div>
    ${sel.clusters.length ? `
      <div class="bsec"><label>المحافظة</label><div class="gchips">${govChips}</div></div>
      <div class="bsec"><label for="bTech">الفني</label><select id="bTech" class="inp">${techOpts}</select></div>
      <div class="bsec"><label>تصفية متقدمة</label><div class="gchips">${['S1', 'S2', 'S3'].map((v) => `<button type="button" class="gchip fl${sel.sev.includes(v) ? ' on' : ''}" data-sev="${v}">${v}</button>`).join('')}${[['Indoor', 'داخلي'], ['Outdoor', 'خارجي']].map(([k, l]) => `<button type="button" class="gchip fl${sel.io === k ? ' on' : ''}" data-io="${k}">${l}</button>`).join('')}<button type="button" class="gchip fl${sel.noTech ? ' on' : ''}" id="bNoTech">بدون فني</button></div></div>
      <div class="bsum"><div><b id="bCount" data-n="${lastCount}">${lastCount.toLocaleString('en')}</b> موقع</div><div class="sevs">${['S1', 'S2', 'S3'].filter((s) => sev.get(s)).map((s) => `<span class="bd ${s.toLowerCase()}">${s} · ${sev.get(s)}</span>`).join('')}</div></div>
      <div class="exp"><button class="btn wa" id="bShare" type="button"${list.length ? '' : ' disabled'}>${ICONS.wa}صورة للواتساب</button><button class="btn pdf" id="bPdf" type="button"${list.length ? '' : ' disabled'}>${ICONS.pdf}تصدير PDF</button></div>
      <input id="bText" class="inp" type="search" inputmode="search" placeholder="ابحث داخل النتائج (رقم أو عنوان)" value="${esc(sel.text)}">
      <div class="list">${rows || emptyState('list', 'لا توجد مواقع', 'غيّر المحافظة أو الفني أو التصفية.')}</div>
      ${list.length > shown ? `<button class="btn" id="bMore" type="button" style="width:100%;margin-top:10px">عرض المزيد (${list.length - shown})</button>` : ''}`
      : emptyState('layers', 'اختر كلستراً أو أكثر', 'لتظهر كل مواقعه مرتبة حسب المحافظة والفني.')}`;

  const cEl = $('#bCount'); if (cEl) { tween(cEl, list.length); lastCount = list.length; }
  root.querySelectorAll('[data-cl]').forEach((b) => b.onclick = () => {
    const c = b.dataset.cl, i = sel.clusters.indexOf(c);
    if (i < 0) sel.clusters.push(c); else sel.clusters.splice(i, 1);
    sel.gov = sel.tech = sel.text = ''; sel.sev = []; sel.io = ''; sel.noTech = false; shown = PAGE; LS.set('brm_clusters', sel.clusters); render();
  });
  $('#bClear')?.addEventListener('click', () => { sel.clusters = []; sel.gov = sel.tech = sel.text = ''; sel.sev = []; sel.io = ''; sel.noTech = false; LS.set('brm_clusters', []); render(); });
  root.querySelectorAll('[data-gov]').forEach((b) => b.onclick = () => { sel.gov = b.dataset.gov; sel.tech = ''; shown = PAGE; render(); });
  root.querySelectorAll('[data-sev]').forEach((b) => b.onclick = () => { const v = b.dataset.sev, i = sel.sev.indexOf(v); if (i < 0) sel.sev.push(v); else sel.sev.splice(i, 1); shown = PAGE; render(); });
  root.querySelectorAll('[data-io]').forEach((b) => b.onclick = () => { sel.io = sel.io === b.dataset.io ? '' : b.dataset.io; shown = PAGE; render(); });
  $('#bNoTech')?.addEventListener('click', () => { sel.noTech = !sel.noTech; if (sel.noTech) sel.tech = ''; shown = PAGE; render(); });
  $('#bTech')?.addEventListener('change', (e) => { sel.tech = e.target.value; shown = PAGE; render(); });
  const text = $('#bText');
  text?.addEventListener('input', (e) => {
    sel.text = e.target.value; shown = PAGE;
    const pos = e.target.selectionStart; render();
    const t = $('#bText'); t.focus(); t.setSelectionRange(pos, pos);
  });
  $('#bShare')?.addEventListener('click', () => exportList('img'));
  $('#bPdf')?.addEventListener('click', () => exportList('pdf'));
  $('#bMore')?.addEventListener('click', () => { shown += PAGE; render(); });
  root.querySelectorAll('.li[data-id]').forEach((b) => b.onclick = () => { setNavList(filtered().sort((a, b) => a.id - b.id).map((r) => r.id)); close(true); setQuery(b.dataset.id); window.scrollTo({ top: 0 }); });
}

const MAXIMG = 90;
const firstPhone = (r) => (String(r.mp || '').match(/\+?\d{9,13}/) || [''])[0].trim();

async function exportList(kind) {
  const btn = $(kind === 'pdf' ? '#bPdf' : '#bShare');
  const all = filtered().sort((a, b) => a.id - b.id);
  const list = kind === 'pdf' ? all : all.slice(0, MAXIMG);
  const sev = tally(all, (r) => r.sev || '');
  const tech = sel.tech && sel.tech !== NONE ? sel.tech : '';
  const multi = sel.clusters.length > 1;
  const names = sel.clusters.join(' + ');
  const meta = {
    title: `${multi ? 'كلسترات' : 'كلستر'} ${names}`,
    subtitle: [sel.gov ? govName(sel.gov) : 'كل المحافظات', tech].filter(Boolean).join(' · '),
    total: all.length,
    sev: { S1: sev.get('S1') || 0, S2: sev.get('S2') || 0, S3: sev.get('S3') || 0 },
    date: new Date().toLocaleDateString('en-GB'),
    note: kind !== 'pdf' && all.length > MAXIMG ? `عرض أول ${MAXIMG} من ${all.length} — حدّد المحافظة أو الفني لعرض الباقي` : '',
  };
  const items = list.map((r) => ({ id: r.id, nm: r.nm, sev: r.sev, govLabel: [multi ? clusterOf(r) : '', govName(r.gov)].filter(Boolean).join(' · '), tech: techOf(r) === NONE ? '' : techOf(r), phone: firstPhone(r) }));
  const old = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'جارٍ الإنشاء…';
  try {
    const ex = await import('./exportImage.js');
    const name = `${meta.title} ${meta.subtitle}`.replace(/[\s/\\]+/g, '_');
    if (kind === 'pdf') {
      const pages = await ex.renderListImages(meta, items, { maxH: 1527, fixedH: true, jpeg: true });
      const pdf = await ex.imagesToPdf(pages);
      const file = new File([pdf], `${name}.pdf`, { type: 'application/pdf' });
      previewPdf(ex, file, `${meta.title} — ${meta.subtitle} (${all.length} موقع)`, pages.length);
    } else {
      const blobs = await ex.renderListImages(meta, items);
      previewImages(ex, blobs, name, `${meta.title} — ${meta.subtitle} (${all.length} موقع)`);
    }
  } catch (e) {
    console.error(e);
    alert('تعذّر الإنشاء');
  } finally { btn.disabled = false; btn.innerHTML = old; }
}

function close(fromAction = false) {
  const el = $('#browse');
  if (el.hidden) return;
  document.body.classList.remove('no-scroll');
  el.classList.add('out');
  setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 200);
  if (!fromAction && history.state?.browse) history.back();
  else if (fromAction && history.state?.browse) history.replaceState(null, '', location.pathname + location.hash);
}

export function openBrowse() {
  const el = $('#browse');
  if (!sel.clusters.length) {
    const saved = LS.get('brm_clusters', []);
    const all = new Set(state.rows.map(clusterOf));
    if (Array.isArray(saved)) sel.clusters = saved.filter((c) => all.has(c));
  }
  el.hidden = false; lastCount = 0;
  document.body.classList.add('no-scroll');
  history.pushState({ browse: 1 }, '');
  render();
  el.querySelector('.bscroll').scrollTop = 0;
}

export function initBrowse() {
  $('#browseBtn').addEventListener('click', openBrowse);
  $('#browse .bclose').addEventListener('click', () => close());
  window.addEventListener('popstate', () => { if (!$('#browse').hidden) close(true); });
}
