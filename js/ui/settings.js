/** تخصيص المظهر: لون التطبيق وحجم الخط (يُحفظ على الجهاز) */
import { $ } from '../lib/dom.js';
import { LS } from '../lib/storage.js';
import { ctl } from '../data/controls.js';

const ACCENTS = [
  ['teal', 'الأزرق المخضر', null],
  ['blue', 'أزرق', ['#1d62d8', '#6ea8ff']],
  ['green', 'أخضر', ['#0f8a55', '#4fe0a0']],
  ['purple', 'بنفسجي', ['#7a3fd1', '#b794ff']],
  ['orange', 'برتقالي', ['#d5680c', '#ffab5c']],
  ['red', 'أحمر', ['#c8283f', '#ff7a8e']],
];
const TYPES = [['on', 'عادي'], ['fast', 'سريع'], ['off', 'متوقف']];
const SIZES = [['0.92', 'صغير'], ['1', 'عادي'], ['1.12', 'كبير'], ['1.25', 'كبير جداً']];

export function applyPrefs() {
  const root = document.documentElement;
  const forced = ctl('forceAccent');                                  // لون مفروض من الإدارة
  const acc = ACCENTS.find((a) => a[0] === (forced !== 'user' ? forced : LS.get('brm_accent', 'teal')));
  if (acc && acc[2]) root.style.setProperty('--acc', `light-dark(${acc[2][0]}, ${acc[2][1]})`);
  else root.style.removeProperty('--acc');
  root.style.zoom = LS.get('brm_zoom', '1') === '1' ? '' : LS.get('brm_zoom', '1');
}

function open() {
  const m = document.createElement('div');
  m.className = 'pv';
  const accent = LS.get('brm_accent', 'teal'), zoom = LS.get('brm_zoom', '1');
  m.innerHTML = `<div class="pvbox setbox"><h3>تخصيص المظهر</h3>
    <div class="h4" style="margin-top:0">لون التطبيق</div>
    <div class="swatches">${ACCENTS.map(([k, label, c]) => `<button type="button" class="sw${k === accent ? ' on' : ''}" data-acc="${k}" aria-label="${label}" title="${label}" style="--c:${c ? c[0] : '#157a94'}"></button>`).join('')}</div>
    <div class="h4">حجم الخط</div>
    <div class="seg szs">${SIZES.map(([v, l]) => `<button type="button" data-z="${v}" class="${v === zoom ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="h4">أنميشن الكتابة</div>
    <div class="seg tys">${TYPES.map(([v, l]) => `<button type="button" data-t="${v}" class="${v === LS.get('brm_type', 'on') ? 'on' : ''}">${l}</button>`).join('')}</div>
    <button class="btn" data-a="sync" type="button" style="width:100%;margin-top:10px">تحقق من التحديثات الآن</button>
    <div class="pvbar" style="grid-template-columns:1fr 1fr;margin-top:6px"><button class="btn" data-a="reset" type="button">استعادة الافتراضي</button><button class="btn pri" data-a="x" type="button">تم</button></div></div>`;
  const refresh = () => {
    m.querySelectorAll('[data-acc]').forEach((b) => b.classList.toggle('on', b.dataset.acc === LS.get('brm_accent', 'teal')));
    m.querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === LS.get('brm_type', 'on')));
    m.querySelectorAll('[data-z]').forEach((b) => b.classList.toggle('on', b.dataset.z === LS.get('brm_zoom', '1')));
  };
  m.onclick = (e) => {
    if (e.target === m) return m.remove();
    const t = e.target.closest('[data-t]'), a = e.target.closest('[data-acc]'), z = e.target.closest('[data-z]'), act = e.target.closest('[data-a]')?.dataset.a;
    if (a) LS.set('brm_accent', a.dataset.acc);
    if (z) LS.set('brm_zoom', z.dataset.z);
    if (t) LS.set('brm_type', t.dataset.t);
    if (act === 'x') return m.remove();
    if (act === 'sync') { document.dispatchEvent(new CustomEvent('botrm:sync')); e.target.textContent = 'جارٍ التحقق…'; setTimeout(() => { e.target.textContent = 'تم التحقق ✓'; }, 900); return; }
    if (act === 'reset') { LS.set('brm_accent', 'teal'); LS.set('brm_zoom', '1'); LS.set('brm_type', 'on'); }
    applyPrefs(); refresh();
  };
  document.body.appendChild(m);
}

export function initSettings() {
  applyPrefs();
  document.addEventListener('botrm:ctl', applyPrefs);
  $('#settingsBtn').addEventListener('click', open);
}
