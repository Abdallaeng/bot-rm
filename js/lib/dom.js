/** أدوات DOM الصغيرة المشتركة */
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

let toastTimer;
export function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('تم النسخ'); }
  catch { toast('تعذّر النسخ'); }
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches;
