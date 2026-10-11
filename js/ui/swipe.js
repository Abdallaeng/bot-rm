/** التنقل بين المواقع بالسحب (يمين/يسار) أو الأزرار، ضمن آخر قائمة تم فتح موقع منها */
let ids = [];
export const setNavList = (list) => { ids = [...new Set(list)].slice(0, 600); };

export function navFor(id) {
  const i = ids.indexOf(id);
  return i < 0 || ids.length < 2 ? null : { i, n: ids.length, prev: ids[i - 1], next: ids[i + 1] };
}

export function navBar(id) {
  const nav = navFor(id);
  if (!nav) return '';
  const btn = (to, label, dir) => `<button class="btn" type="button" data-nav="${to || ''}" ${to ? '' : 'disabled'} aria-label="${label}">${dir === 'p' ? '›' : '‹'} ${label}</button>`;
  return `<div class="navbar">${btn(nav.prev, 'السابق', 'p')}<span>${nav.i + 1} / ${nav.n}</span>${btn(nav.next, 'التالي', 'n')}</div>`;
}

export function initSwipe(go) {
  const out = document.getElementById('out');
  let x0 = 0, y0 = 0, t0 = 0, track = false;
  out.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || e.target.closest('input, textarea, select, .chips, .contacts')) { track = false; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now(); track = true;
  }, { passive: true });
  out.addEventListener('touchend', (e) => {
    if (!track) return; track = false;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 1.8 || Date.now() - t0 > 700) return;
    const id = out.querySelector('.card .id-n')?.textContent;
    const nav = id && navFor(id);
    const to = nav && (dx < 0 ? nav.next : nav.prev);        // السحب لليسار = التالي (اتجاه عربي)
    if (to) { navigator.vibrate?.(8); go(to); }
  }, { passive: true });
  out.addEventListener('click', (e) => { const b = e.target.closest('[data-nav]'); if (b?.dataset.nav) go(b.dataset.nav); });
}
