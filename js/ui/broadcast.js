/** شريط الإعلانات (بث من الإدارة لكل المستخدمين). يصل مع المزامنة الخفيفة (مرة كل 5 دقائق كحد أدنى) ويُحفظ للعرض دون إنترنت. */
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

/** يُستدعى من المزامنة الخفيفة (/api/sync) بالإعلان الحالي — لا طلب منفصل للإعلانات */
export function applyBroadcast(b) {
  LS.set('brm_bc', b || null);
  show(b);
}

export function initBroadcast() {
  show(LS.get('brm_bc', null));          // المحفوظ محلياً يظهر فوراً حتى دون إنترنت
}
