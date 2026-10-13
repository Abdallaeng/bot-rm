/** يطبّق تحكمات الإدارة على الواجهة: أصناف على <html> (تُخفي عناصر عبر css/controls.css)، نصوص، شاشة الصيانة،
 *  وإجراءات «إجبار التحديث». الأجهزة تجلب /api/controls فقط عند تغيّر رقم الإصدار tv في /api/sync. */
import { $, toast } from '../lib/dom.js';
import { LS } from '../lib/storage.js';
import { CONTROLS } from '../data/controlsSchema.js';
import { ctl, saveControls, loadSavedControls } from '../data/controls.js';
import { state, setRows, fetchPacket, unlockPacket } from '../data/store.js';
import { countReq } from '../data/analytics.js';
import { renderStats, renderConn } from './home.js';

const BOOLS = CONTROLS.filter((c) => c.type === 'bool' && c.k !== 'maint').map((c) => c.k);
const DEF = { h1: null, p: null, ph: null };                     // النصوص الأصلية (تُحفظ أول مرة)

function setText(sel, key, store) {
  const el = $(sel); if (!el) return;
  if (DEF[store] == null) DEF[store] = store === 'ph' ? el.placeholder : el.textContent;
  const v = ctl(key);
  if (store === 'ph') el.placeholder = v || DEF.ph; else el.textContent = v || DEF[store];
}

function maintenance() {
  const on = ctl('maint');
  document.documentElement.classList.toggle('is-maint', on);
  let box = $('#maint');
  if (!on) { box?.remove(); return; }
  if (!box) { box = document.createElement('section'); box.id = 'maint'; box.className = 'maint'; $('#main').prepend(box); }
  const until = ctl('maintUntil');
  box.innerHTML = `<div class="maint-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/></svg><h2>التطبيق في صيانة</h2><p></p>${until ? '<small></small>' : ''}<button class="btn" type="button" id="maintRetry">إعادة المحاولة</button></div>`;
  box.querySelector('p').textContent = ctl('maintMsg');
  if (until) box.querySelector('small').textContent = `العودة المتوقعة: ${until}`;
  $('#maintRetry').onclick = () => document.dispatchEvent(new CustomEvent('botrm:sync'));
}

/** يطبّق كل شيء (آمن للاستدعاء المتكرر) */
export function applyControls({ reindex = true } = {}) {
  const root = document.documentElement;
  for (const k of BOOLS) root.classList.toggle(`x-${k}`, !ctl(k));
  root.classList.toggle('x-forceTheme', ctl('forceTheme') !== 'user');
  root.classList.toggle('x-forceAccent', ctl('forceAccent') !== 'user');
  setText('.hero h1', 'hTitle', 'h1'); setText('.hero > p', 'hSub', 'p'); setText('#q', 'sHint', 'ph');
  maintenance();
  const q = $('#q'); if (q && state.rows.length) q.disabled = ctl('maint');
  if (reindex && state.rows.length) { setRows(state.rows, state.meta); renderStats(); document.dispatchEvent(new CustomEvent('botrm:log')); renderConn(); document.dispatchEvent(new CustomEvent('botrm:data')); }
  document.dispatchEvent(new CustomEvent('botrm:ctl'));
}

async function reloadData() {
  try { const p = await fetchPacket(true); const rows = await unlockPacket(p); if (rows) { setRows(rows, p); document.dispatchEvent(new CustomEvent('botrm:data')); toast('تم تحديث البيانات'); } } catch { /* نحاول لاحقاً */ }
}
async function reloadApp() {
  try { (await navigator.serviceWorker?.getRegistrations?.() || []).forEach((r) => r.unregister()); (await caches.keys()).forEach((k) => caches.delete(k)); } catch { /* */ }
  location.reload();
}

/** عند فتح التطبيق: القيم المحفوظة تُطبَّق فوراً بلا شبكة */
export function initControls() { loadSavedControls(); applyControls({ reindex: false }); }

/** من دورة المزامنة: نجلب القائمة فقط إن تغيّر الإصدار tv */
export async function refreshControls(tv) {
  const saved = LS.get('brm_ctl', { v: 0 });
  if (tv == null || saved.v === tv) return;
  try {
    countReq();
    const r = await fetch('/api/controls', { cache: 'no-store' });
    if (!r.ok) return;
    const doc = await r.json();
    saveControls(doc);
    applyControls();
    if (doc.fd && doc.fd !== (saved.fd || 0)) await reloadData();            // إجبار تنزيل البيانات
    if (doc.fa && doc.fa !== (saved.fa || 0)) await reloadApp();             // إجبار تحديث التطبيق
  } catch { /* الدورة القادمة */ }
}
