/** شريط الإعلانات (بث من الإدارة لكل المستخدمين). يُحدَّث عند فتح التطبيق وكل 5 دقائق ويُحفظ للعرض دون إنترنت. */
import { $ } from '../lib/dom.js';
import { LS } from '../lib/storage.js';

const ICON = { info: '📣', warn: '⚠️', alert: '🚨' };
let el;

function show(b) {
  el?.remove(); el = null;
  if (!b || (b.expires && b.expires < Date.now()) || LS.get('brm_bc_seen', '') === b.id) return;
  el = document.createElement('div');
  el.className = `bcast ${b.level}`;
  el.setAttribute('role', b.level === 'alert' ? 'alert' : 'status');
  el.innerHTML = '<span class="bi"></span><p></p><button type="button" aria-label="إغلاق">✕</button>';
  el.querySelector('.bi').textContent = ICON[b.level] || ICON.info;
  el.querySelector('p').textContent = b.text;
  el.querySelector('button').onclick = () => { LS.set('brm_bc_seen', b.id); el.remove(); el = null; };
  document.body.prepend(el);
}

async function poll() {
  try {
    const res = await fetch('/api/broadcast', { cache: 'no-store' });
    if (!res.ok) return;
    const { b } = await res.json();
    LS.set('brm_bc', b || null);
    show(b);
  } catch { show(LS.get('brm_bc', null)); }
}

export function initBroadcast() {
  show(LS.get('brm_bc', null));
  poll();
  setInterval(poll, 300_000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') poll(); });
}
