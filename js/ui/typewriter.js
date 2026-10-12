/** أنميشن كتابة لكل نصوص الموقع: تظهر الحروف تباعاً مع مؤشر ملوّن.
 *  - لا نفكّك الكلمة إلى حروف منفصلة (حتى لا يتقطع اتصال الحروف العربية)، بل نكشف نصاً متزايداً.
 *  - التخطيط ثابت: الجزء غير المكتوب بعد يبقى في مكانه شفافاً فلا يقفز النص.
 *  - يُطبَّق فقط على النصوص الظاهرة في الشاشة (حدّ أقصى لكل دفعة) ولا يعمل مع «تقليل الحركة». */
import { LS } from '../lib/storage.js';
const MAX_BATCH = 36, SKIP = 'script,style,svg,input,textarea,select,option,pre,code,[data-notype],.tw-v,.tw-h,.tw-c';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const off = /[?&]notype\b/.test(location.search);
const mode = () => LS.get('brm_type', 'on');   // on | fast | off — من الإعدادات
const LETTER = /[\p{L}]/u;
const jobs = new Set();
let raf = 0;

function visible(el) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight + 40;
}

function leaves(root) {
  const out = [];
  const walk = (n) => {
    if (n.nodeType !== 1 || n.matches(SKIP)) return;
    if (!n.firstElementChild) { if (n.textContent.trim().length > 1 && LETTER.test(n.textContent)) out.push(n); return; }
    for (const c of n.children) walk(c);
  };
  walk(root);
  return out;
}

function start(el, delay) {
  const text = el.textContent;
  const len = [...text].length;
  const per = Math.max(10, Math.min(34, 1000 / len)) * (mode() === 'fast' ? 0.4 : 1);   // مجموع الكتابة ≤ ~1 ثانية
  const v = document.createElement('span'), c = document.createElement('span'), h = document.createElement('span');
  v.className = 'tw-v'; c.className = 'tw-c'; h.className = 'tw-h';
  c.setAttribute('aria-hidden', 'true');
  el.textContent = ''; el.append(v, c, h);
  el.setAttribute('aria-label', text.trim());
  jobs.add({ el, v, h, chars: [...text], per, t0: performance.now() + delay, n: -1, text });
  if (!raf) raf = requestAnimationFrame(tick);
}

function tick(now) {
  for (const j of jobs) {
    if (!j.el.isConnected || j.el.firstChild !== j.v) { jobs.delete(j); continue; }   // تغيّر المحتوى من مكان آخر
    const n = Math.min(j.chars.length, Math.max(0, Math.floor((now - j.t0) / j.per)));
    if (n === j.n) continue;
    j.n = n;
    if (n >= j.chars.length) { j.el.textContent = j.text; j.el.removeAttribute('aria-label'); jobs.delete(j); continue; }
    j.v.textContent = j.chars.slice(0, n).join('');
    j.h.textContent = j.chars.slice(n).join('');
  }
  raf = jobs.size ? requestAnimationFrame(tick) : 0;
}

function run(root) {
  if (mode() === 'off') return;
  let i = 0;
  for (const el of leaves(root)) {
    if (i >= MAX_BATCH) break;
    if (!visible(el)) continue;
    start(el, Math.min(i * 55, 520));
    i++;
  }
}

export function initTypewriter() {
  if (reduce || off) return;
  const pending = new Set();
  let timer = 0;
  const flush = () => { timer = 0; const list = [...pending]; pending.clear(); for (const n of list) if (n.isConnected) run(n); };
  new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1 && !n.matches?.('.tw-v,.tw-h,.tw-c')) pending.add(n);
    if (pending.size && !timer) timer = requestAnimationFrame(flush);
  }).observe(document.body, { childList: true, subtree: true });
  run(document.body);
}
