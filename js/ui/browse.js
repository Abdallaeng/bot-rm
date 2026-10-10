/** تصفّح حسب الكلستر: اختر الكلستر ← المحافظة (أو الكل) ← الفني (أو الكل) لترى كل مواقعه.
 *  مستقل عن البحث العام؛ الضغط على موقع يفتح بطاقته. */
import { $, esc } from '../lib/dom.js';
import { LS } from '../lib/storage.js';
import { govName } from '../lib/labels.js';
import { state } from '../data/store.js';
import { setQuery } from './search.js';
import { ICONS } from '../lib/icons.js';

const NONE = 'غير محدد';
const PAGE = 80;
const sel = { clusters: [], gov: '', tech: '', text: '' };
let shown = PAGE;

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

  const rows = list.slice(0, shown).map((r) =>
    `<button class="li" type="button" data-id="${esc(r.id)}"><span class="n">${esc(r.id)}</span><span class="t"><span class="nm">${esc(r.nm || '—')}</span><span class="g">${[govName(r.gov), techOf(r)].filter(Boolean).map(esc).join(' · ')}</span></span>${r.sev ? `<span class="bd ${r.sev.toLowerCase()}">${esc(r.sev)}</span>` : ''}</button>`).join('');

  root.innerHTML = `
    <div class="bsec"><label>الكلستر <small>(يمكنك اختيار أكثر من كلستر)</small>${sel.clusters.length ? ' <button type="button" class="clr-cl" id="bClear">مسح الاختيار</button>' : ''}</label><div class="cchips">${clusterChips()}</div></div>
    ${sel.clusters.length ? `
      <div class="bsec"><label>المحافظة</label><div class="gchips">${govChips}</div></div>
      <div class="bsec"><label for="bTech">الفني</label><select id="bTech" class="inp">${techOpts}</select></div>
      <div class="bsum"><div><b>${list.length}</b> موقع</div><div class="sevs">${['S1', 'S2', 'S3'].filter((s) => sev.get(s)).map((s) => `<span class="bd ${s.toLowerCase()}">${s} · ${sev.get(s)}</span>`).join('')}</div></div>
      <div class="exp"><button class="btn wa" id="bShare" type="button"${list.length ? '' : ' disabled'}>${ICONS.wa}صورة للواتساب</button><button class="btn pdf" id="bPdf" type="button"${list.length ? '' : ' disabled'}>${ICONS.pdf}تصدير PDF</button></div>
      <input id="bText" class="inp" type="search" inputmode="search" placeholder="ابحث داخل النتائج (رقم أو عنوان)" value="${esc(sel.text)}">
      <div class="list">${rows || '<div class="notfound"><b>لا توجد مواقع</b>غيّر المحافظة أو الفني.</div>'}</div>
      ${list.length > shown ? `<button class="btn" id="bMore" type="button" style="width:100%;margin-top:10px">عرض المزيد (${list.length - shown})</button>` : ''}`
      : '<div class="notfound"><b>اختر كلستراً أو أكثر</b>لتظهر كل مواقعه مرتبة حسب المحافظة والفني.</div>'}`;

  root.querySelectorAll('[data-cl]').forEach((b) => b.onclick = () => {
    const c = b.dataset.cl, i = sel.clusters.indexOf(c);
    if (i < 0) sel.clusters.push(c); else sel.clusters.splice(i, 1);
    sel.gov = sel.tech = sel.text = ''; shown = PAGE; LS.set('brm_clusters', sel.clusters); render();
  });
  $('#bClear')?.addEventListener('click', () => { sel.clusters = []; sel.gov = sel.tech = sel.text = ''; LS.set('brm_clusters', []); render(); });
  root.querySelectorAll('[data-gov]').forEach((b) => b.onclick = () => { sel.gov = b.dataset.gov; sel.tech = ''; shown = PAGE; render(); });
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
  root.querySelectorAll('.li[data-id]').forEach((b) => b.onclick = () => { close(true); setQuery(b.dataset.id); window.scrollTo({ top: 0 }); });
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

function previewPdf(ex, file, text, n) {
  const url = URL.createObjectURL(file);
  const m = document.createElement('div');
  m.className = 'pv';
  m.innerHTML = `<div class="pvbox"><div class="pvdoc"><b>📄 ${esc(file.name)}</b><span>${n} صفحة · ${(file.size / 1048576).toFixed(1)} MB</span></div>
    <div class="pvbar"><button class="btn wa" data-a="share">مشاركة</button><button class="btn" data-a="save">حفظ PDF</button><button class="btn" data-a="x">إغلاق</button></div></div>`;
  const done = () => { URL.revokeObjectURL(url); m.remove(); };
  const save = () => { if (ex.inApp()) { ex.shareViaApp([{ blob: file, name: file.name }], text); return; } const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); };
  m.onclick = async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (e.target === m || a === 'x') return done();
    if (a === 'save') save();
    if (a === 'share') {
      if (ex.inApp()) ex.shareViaApp([{ blob: file, name: file.name }], text);
      else if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: file.name, text }); } catch { /* cancelled */ } }
      else { save(); alert('المشاركة المباشرة غير مدعومة هنا — تم حفظ الملف.'); }
    }
  };
  document.body.appendChild(m);
}

function previewImages(ex, blobs, name, text) {
  const urls = blobs.map((b) => URL.createObjectURL(b));
  const m = document.createElement('div');
  m.className = 'pv';
  m.innerHTML = `<div class="pvbox"><div class="pvimgs">${urls.map((u) => `<img src="${u}" alt="">`).join('')}</div>
    <div class="pvbar"><button class="btn wa" data-a="share">${ICONS.wa}مشاركة على واتساب</button><button class="btn" data-a="save">${ICONS.save}حفظ الصورة</button><button class="btn" data-a="x">إغلاق</button></div></div>`;
  const done = () => { urls.forEach(URL.revokeObjectURL); m.remove(); };
  m.onclick = async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (e.target === m || a === 'x') return done();
    if (a === 'save') ex.downloadImages(blobs, name);
    if (a === 'share' && !(await ex.shareImages(blobs, name, text))) { ex.downloadImages(blobs, name); alert('المشاركة المباشرة غير مدعومة هنا — تم حفظ الصورة، أرسلها من الواتساب.'); }
  };
  document.body.appendChild(m);
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
