/** تأثيرات: نبضة البرج + تبديل أرقام رقم الموقع */
import { $, prefersReducedMotion } from '../lib/dom.js';

export function pingSite() {
  if (prefersReducedMotion()) return;
  const scene = $('#scene');
  if (scene) { scene.classList.remove('ping'); void scene.getBoundingClientRect(); scene.classList.add('ping'); }

  const el = $('.id-n');
  if (!el) return;
  const final = el.textContent;
  let step = 0;
  const timer = setInterval(() => {
    if (++step > 9) { el.textContent = final; clearInterval(timer); return; }
    el.textContent = final.replace(/\d/g, () => Math.floor(Math.random() * 10));
  }, 45);
}

export function countUp(root = document) {
  const els = [...root.querySelectorAll('[data-n]')];
  const fmt = (n) => Math.round(n).toLocaleString('en');
  if (prefersReducedMotion()) { els.forEach((e) => { e.textContent = fmt(+e.dataset.n); }); return; }
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / 1100), eased = 1 - (1 - p) ** 3;
    els.forEach((e) => { e.textContent = fmt(+e.dataset.n * eased); });
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
