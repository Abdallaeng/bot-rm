/** وضع العرض: تلقائي (حسب الجهاز) ← نهاري ← ليلي ← حسب الوقت (نهاري 6ص–6م) */
import { $, toast } from '../lib/dom.js';
import { LS } from '../lib/storage.js';
import { ctl } from '../data/controls.js';

const ORDER = ['auto', 'light', 'dark', 'time'];
const LABEL = { auto: 'الوضع التلقائي (حسب الجهاز)', light: 'الوضع النهاري', dark: 'الوضع الليلي', time: 'حسب الوقت: نهاري من 6 صباحاً إلى 6 مساءً' };
const BAR = { light: '#2d8aa4', dark: '#06222b' };
const byClock = (d = new Date()) => (d.getHours() >= 6 && d.getHours() < 18 ? 'light' : 'dark');

function paint(mode) {
  const root = document.documentElement;
  root.dataset.mode = mode;
  const fm = ctl('forceTheme');                                      // وضع مفروض من الإدارة
  const forced = fm !== 'user' ? fm : mode === 'time' ? byClock() : mode;
  if (forced === 'auto') delete root.dataset.theme; else root.dataset.theme = forced;
  const effective = forced === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : forced;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', BAR[effective]);
}

/** انتقال ناعم (تلاشي) بين الوضعين عند التبديل، إن دعمه المتصفح */
function apply(mode, smooth) {
  if (smooth && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(() => paint(mode));
  else paint(mode);
}

export function initTheme() {
  let mode = LS.get('brm_theme', 'auto');
  apply(mode, false);
  let timer = 0;
  const schedule = () => {                       // مؤقت واحد حتى أقرب 6 ص أو 6 م (بلا استطلاع دوري)
    clearTimeout(timer);
    if (mode !== 'time') return;
    const n = new Date(), next = new Date(n);
    next.setMinutes(0, 5, 0);
    next.setHours(n.getHours() < 6 ? 6 : n.getHours() < 18 ? 18 : 30);   // 30 = 6 ص اليوم التالي
    timer = setTimeout(() => { apply('time', true); schedule(); }, next - n);
  };
  schedule();
  document.addEventListener('visibilitychange', () => { if (!document.hidden && mode === 'time') { apply('time', true); schedule(); } });
  $('#themeBtn').addEventListener('click', () => {
    mode = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    LS.set('brm_theme', mode);
    apply(mode, true);
    schedule();
    toast(LABEL[mode]);
  });
  document.addEventListener('botrm:ctl', () => apply(mode, false));
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => mode === 'auto' && apply('auto', false));
}
