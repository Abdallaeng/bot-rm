/** بحث متعدد: جدول تكتب فيه أرقام/أسماء مواقع فيظهر لكل صف الكلستر والمحافظة والفني والخطورة. */
import { $, esc, toast, copyText } from '../lib/dom.js';
import { LS } from '../lib/storage.js';
import { latinDigits, normalizeArabic } from '../lib/text.js';
import { govName } from '../lib/labels.js';
import { state } from '../data/store.js';
import { ICONS } from '../lib/icons.js';
import { setQuery } from './search.js';

const START_ROWS = 10;
let values = [];                         // نص كل صف

const save = () => LS.set('brm_multi', values);

function lookup(raw) {
  const q = latinDigits(raw).trim();
  if (!q) return null;
  const hit = state.byId.get(q) || state.byId.get(String(parseInt(q, 10)));
  if (hit && /^\d+$/.test(q)) return { r: hit };
  const tokens = normalizeArabic(q).split(' ').filter(Boolean);
  const found = state.rows.find((r) => tokens.every((t) => r._s.includes(t)));
  return found ? { r: found, approx: true } : { r: null };
}

function cells(raw) {
  const m = lookup(raw);
  if (!m) return '<td></td><td></td><td></td><td></td>';
  if (!m.r) return '<td class="mx" colspan="4">غير موجود</td>';
  const r = m.r;
  const sev = r.sev ? `<span class="bd ${r.sev.toLowerCase()}">${esc(r.sev)}</span>` : '—';
  return `<td><b>${esc(r.cl || 'غير محدد')}</b>${m.approx ? `<small class="ap">الموقع ${esc(r.id)}</small>` : ''}</td><td>${esc(govName(r.gov) || '—')}</td><td>${esc(r.mn || '—')}</td><td>${sev}</td>`;
}

function rowHtml(i) {
  return `<tr data-i="${i}"><td class="n">${i + 1}</td><td><input class="mi" dir="auto" inputmode="search" enterkeyhint="next" autocomplete="off" placeholder="رقم الموقع أو اسمه" value="${esc(values[i] || '')}"></td>${cells(values[i])}</tr>`;
}

function stats() {
  const filled = values.filter((v) => v.trim());
  const miss = filled.filter((v) => lookup(v)?.r === null).length;
  $('#mStat').textContent = filled.length ? `${filled.length} مدخل · ${filled.length - miss} موجود${miss ? ` · ${miss} غير موجود` : ''}` : 'اكتب أو الصق قائمة مواقع (كل موقع في سطر)';
}

function paintRow(i) {
  const tr = $(`#mBody tr[data-i="${i}"]`);
  if (!tr) return;
  const tds = tr.querySelectorAll('td');
  const tmp = document.createElement('tbody');
  tmp.innerHTML = `<tr>${cells(values[i])}</tr>`;
  const fresh = tmp.firstElementChild;
  while (tr.children.length > 2) tr.lastElementChild.remove();
  while (fresh.firstElementChild) tr.appendChild(fresh.firstElementChild);
  void tds;
}

function ensureRows(n) { while (values.length < n) values.push(''); }

function renderAll() {
  $('#mBody').innerHTML = values.map((_, i) => rowHtml(i)).join('');
  stats();
}

function addRow(focus = true) {
  values.push(''); save();
  $('#mBody').insertAdjacentHTML('beforeend', rowHtml(values.length - 1));
  if (focus) $(`#mBody tr[data-i="${values.length - 1}"] input`).focus();
  stats();
}

function onPaste(e, i) {
  const text = (e.clipboardData || window.clipboardData).getData('text');
  const parts = text.split(/[\n\r\t,،;]+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return;
  e.preventDefault();
  ensureRows(i + parts.length);
  parts.forEach((p, k) => { values[i + k] = p; });
  save(); renderAll();
}

function exportRows() {
  return values.map((v) => ({ v, r: lookup(v)?.r })).filter((x) => x.v.trim());
}

async function copyTable() {
  const rows = exportRows();
  if (!rows.length) return toast('الجدول فارغ');
  const tsv = ['المدخل\tرقم الموقع\tالكلستر\tالمحافظة\tالفني\tالخطورة'].concat(rows.map(({ v, r }) => (r ? [v, r.id, r.cl || '', govName(r.gov) || '', r.mn || '', r.sev || ''] : [v, '', 'غير موجود', '', '', '']).join('\t'))).join('\n');
  copyText(tsv);
}

async function shareImage() {
  const rows = exportRows().filter((x) => x.r);
  if (!rows.length) return toast('لا توجد مواقع لتصديرها');
  const btn = $('#mImg'); btn.disabled = true;
  try {
    const [ex, { previewImages }] = await Promise.all([import('./exportImage.js'), import('./preview.js')]);
    const sev = { S1: 0, S2: 0, S3: 0 }; rows.forEach(({ r }) => { if (sev[r.sev] !== undefined) sev[r.sev]++; });
    const meta = { title: 'نتيجة البحث المتعدد', subtitle: 'الكلستر والمحافظة والفني لكل موقع', total: rows.length, sev, date: new Date().toLocaleDateString('en-GB'), note: '' };
    const items = rows.slice(0, 90).map(({ r }) => ({ id: r.id, nm: r.nm, sev: r.sev, govLabel: [r.cl, govName(r.gov)].filter(Boolean).join(' · '), tech: r.mn || '', phone: '' }));
    if (rows.length > 90) meta.note = `عرض أول 90 من ${rows.length}`;
    previewImages(ex, await ex.renderListImages(meta, items), 'بحث_متعدد', `بحث متعدد — ${rows.length} موقع`);
  } catch (e) { console.error(e); alert('تعذّر إنشاء الصورة'); } finally { btn.disabled = false; }
}

function close(fromAction = false) {
  const el = $('#multi');
  if (el.hidden) return;
  document.body.classList.remove('no-scroll');
  el.classList.add('out');
  setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 200);
  if (!fromAction && history.state?.multi) history.back();
  else if (fromAction && history.state?.multi) history.replaceState(null, '', location.pathname + location.hash);
}

export function openMulti() {
  const el = $('#multi');
  values = LS.get('brm_multi', []);
  ensureRows(START_ROWS);
  el.hidden = false;
  document.body.classList.add('no-scroll');
  history.pushState({ multi: 1 }, '');
  renderAll();
  el.querySelector('.bscroll').scrollTop = 0;
}

export function initMulti() {
  $('#multiBtn').addEventListener('click', openMulti);
  $('#multi .bclose').addEventListener('click', () => close());
  window.addEventListener('popstate', () => { if (!$('#multi').hidden) close(true); });
  const body = $('#mBody');
  body.addEventListener('input', (e) => {
    const tr = e.target.closest('tr'); if (!tr) return;
    const i = +tr.dataset.i; values[i] = e.target.value; save(); paintRow(i); stats();
  });
  body.addEventListener('paste', (e) => { const tr = e.target.closest('tr'); if (tr) onPaste(e, +tr.dataset.i); });
  body.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const tr = e.target.closest('tr'), i = +tr.dataset.i;
    if (i === values.length - 1) addRow(); else $(`#mBody tr[data-i="${i + 1}"] input`).focus();
  });
  body.addEventListener('click', (e) => {
    const b = e.target.closest('td.n'); if (!b) return;           // رقم الصف: افتح بطاقة الموقع
    const r = lookup(values[+b.parentElement.dataset.i])?.r;
    if (r) { close(true); setQuery(r.id); window.scrollTo({ top: 0 }); }
  });
  $('#mAdd').addEventListener('click', () => addRow());
  $('#mAdd5').addEventListener('click', () => { for (let k = 0; k < 5; k++) values.push(''); save(); renderAll(); });
  $('#mCopy').addEventListener('click', copyTable);
  $('#mImg').addEventListener('click', shareImage);
  $('#mClear').addEventListener('click', () => { values = Array(START_ROWS).fill(''); save(); renderAll(); });
  $('#mImg').insertAdjacentHTML('afterbegin', ICONS.wa);
  $('#mCopy').insertAdjacentHTML('afterbegin', ICONS.save);
}
