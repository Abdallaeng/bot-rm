/** وضع العرض: تلقائي (حسب الجهاز) ← نهاري ← ليلي */
import { $, toast } from '../lib/dom.js';
import { LS } from '../lib/storage.js';

const ORDER = ['auto', 'light', 'dark'];
const LABEL = { auto: 'الوضع التلقائي (حسب الجهاز)', light: 'الوضع النهاري', dark: 'الوضع الليلي' };
const BAR = { light: '#2d8aa4', dark: '#06222b' };

function apply(mode) {
  const root = document.documentElement;
  root.dataset.mode = mode;
  if (mode === 'auto') delete root.dataset.theme; else root.dataset.theme = mode;
  const effective = mode === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : mode;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', BAR[effective]);
}

export function initTheme() {
  let mode = LS.get('brm_theme', 'auto');
  apply(mode);
  $('#themeBtn').addEventListener('click', () => {
    mode = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    LS.set('brm_theme', mode);
    apply(mode);
    toast(LABEL[mode]);
  });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => mode === 'auto' && apply('auto'));
}
