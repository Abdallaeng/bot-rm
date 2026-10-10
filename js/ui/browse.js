/** تصفّح حسب الكلستر: اختر الكلستر ← المحافظة (أو الكل) ← الفني (أو الكل) لترى كل مواقعه.
 *  مستقل عن البحث العام؛ الضغط على موقع يفتح بطاقته. */
import { $, esc } from '../lib/dom.js';
import { LS } from '../lib/storage.js';
import { govName } from '../lib/labels.js';
import { state } from '../data/store.js';
import { setQuery } from './search.js';

const NONE = 'غير محدد';
const PAGE = 80;
const sel = { cluster: null, gov: '', tech: '', text: '' };
let shown = PAGE;

const clusterOf = (r) => r.cl || NONE;
const techOf = (r) => (r.mn || '').trim() || NONE;
const byCount = (map) => [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ar'));
const tally = (rows, fn) => rows.reduce((m, r) => m.set(fn(r), (m.get(fn(r)) || 0) + 1), new Map());

function filtered() {
  const q = sel.text.trim().toLowerCase();
  return state.rows.filter((r) =>
    clusterOf(r) === sel.cluster
    && (!sel.gov || r.gov === sel.gov)
    && (!sel.tech || techOf(r) === sel.tech)
    && (!q || r.id.startsWith(q) || (r.nm || '').toLowerCase().includes(q)));
}

function clusterChips() {
  const counts = byCount(tally(state.rows, clusterOf));
  return counts.map(([name, n]) =>
    `<button type="button" class="cchip${name === sel.cluster ? ' on' : ''}" data-cl="${esc(name)}"><b>${esc(name)}</b><span>${n}</span></button>`).join('');
}

function render() {
  const root = $('#browse .bbody');
  const inCluster = state.rows.filter((r) => clusterOf(r) === sel.cluster);
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

  const rows = list.slice(0, shown).map((r) =>
    `<button class="li" type="button" data-id="${esc(r.id)}"><span class="n">${esc(r.id)}</span><span class="t"><span class="nm">${esc(r.nm || '—')}</span><span class="g">${[govName(r.gov), techOf(r)].filter(Boolean).map(esc).join(' · ')}</span></span>${r.sev ? `<span class="bd ${r.sev.toLowerCase()}">${esc(r.sev)}</span>` : ''}</button>`).join('');

  root.innerHTML = `
    <div class="bsec"><label>الكلستر</label><div class="cchips">${clusterChips()}</div></div>
    ${sel.cluster ? `
      <div class="bsec"><label>المحافظة</label><div class="gchips">${govChips}</div></div>
      <div class="bsec"><label for="bTech">الفني</label><select id="bTech" class="inp">${techOpts}</select></div>
      <div class="bsum"><div><b>${list.length}</b> موقع</div><div class="sevs">${['S1', 'S2', 'S3'].filter((s) => sev.get(s)).map((s) => `<span class="bd ${s.toLowerCase()}">${s} · ${sev.get(s)}</span>`).join('')}</div></div>
      <input id="bText" class="inp" type="search" inputmode="search" placeholder="ابحث داخل النتائج (رقم أو عنوان)" value="${esc(sel.text)}">
      <div class="list">${rows || '<div class="notfound"><b>لا توجد مواقع</b>غيّر المحافظة أو الفني.</div>'}</div>
      ${list.length > shown ? `<button class="btn" id="bMore" type="button" style="width:100%;margin-top:10px">عرض المزيد (${list.length - shown})</button>` : ''}`
      : '<div class="notfound"><b>اختر كلستراً</b>لتظهر كل مواقعه مرتبة حسب المحافظة والفني.</div>'}`;

  root.querySelectorAll('[data-cl]').forEach((b) => b.onclick = () => { sel.cluster = b.dataset.cl; sel.gov = sel.tech = sel.text = ''; shown = PAGE; LS.set('brm_cluster', sel.cluster); render(); });
  root.querySelectorAll('[data-gov]').forEach((b) => b.onclick = () => { sel.gov = b.dataset.gov; sel.tech = ''; shown = PAGE; render(); });
  $('#bTech')?.addEventListener('change', (e) => { sel.tech = e.target.value; shown = PAGE; render(); });
  const text = $('#bText');
  text?.addEventListener('input', (e) => {
    sel.text = e.target.value; shown = PAGE;
    const pos = e.target.selectionStart; render();
    const t = $('#bText'); t.focus(); t.setSelectionRange(pos, pos);
  });
  $('#bMore')?.addEventListener('click', () => { shown += PAGE; render(); });
  root.querySelectorAll('.li[data-id]').forEach((b) => b.onclick = () => { close(true); setQuery(b.dataset.id); window.scrollTo({ top: 0 }); });
}

function close(fromAction = false) {
  const el = $('#browse');
  if (el.hidden) return;
  el.hidden = true;
  document.body.classList.remove('no-scroll');
  if (!fromAction && history.state?.browse) history.back();
  else if (fromAction && history.state?.browse) history.replaceState(null, '', location.pathname + location.hash);
}

export function openBrowse() {
  const el = $('#browse');
  if (!sel.cluster) {
    const saved = LS.get('brm_cluster', null);
    if (saved && state.rows.some((r) => clusterOf(r) === saved)) sel.cluster = saved;
  }
  el.hidden = false;
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
