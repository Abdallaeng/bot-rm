/** الصفحة الرئيسية: الإحصاءات وآخر عمليات البحث */
import { $, $$, esc } from '../lib/dom.js';
import { formatDate } from '../lib/text.js';
import { stats } from '../data/store.js';
import { recentSearches } from '../data/analytics.js';
import { countUp } from './effects.js';

export function renderStats() {
  const s = stats();
  const tile = (n, label) => `<div class="stat"><b data-n="${n}">${n}</b><span>${label}</span></div>`;
  $('#stats').innerHTML = tile(s.sites, 'موقع') + tile(s.clusters, 'كلستر') + tile(s.governorates, 'محافظة') +
    (s.updated ? `<div class="stat upd"><b>${formatDate(s.updated)}</b><span>آخر تحديث</span></div>` : '');
  countUp($('#stats'));
}

function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (!(m >= 0)) return '';
  if (m < 60) return 'قبل قليل';
  if (m < 1440) return `قبل ${Math.round(m / 60)} ساعة`;
  const d = Math.round(m / 1440);
  return d === 1 ? 'أمس' : `قبل ${d} يوم`;
}

/** مؤشر الاتصال وعمر البيانات */
export function renderConn() {
  const el = $('#conn'); if (!el) return;
  const on = navigator.onLine, upd = stats().updated;
  const age = upd ? Math.round((Date.now() - new Date(upd)) / 86400e3) : 0;
  el.className = `conn ${on ? (age > 30 ? 'old' : 'on') : 'off'}`;
  el.innerHTML = `<i></i><span>${on ? 'متصل' : 'بدون إنترنت — بيانات محفوظة'}${upd ? ` · البيانات ${ago(upd)}` : ''}</span>`;
}

let popular = [];
export async function loadPopular(onPick) {
  try {
    const r = await fetch('/api/popular');
    if (r.ok) { popular = (await r.json()).top || []; renderRecent(onPick); }
  } catch { /* بدون إنترنت */ }
}

export function renderRecent(onPick) {
  const seen = recentSearches();
  const chips = (list) => `<div>${list.map((id) => `<button class="chip" type="button" data-id="${esc(id)}">${esc(id)}</button>`).join('')}</div>`;
  const pop = popular.filter((id) => !seen.includes(id)).slice(0, 8);
  $('#recent').innerHTML = (seen.length ? `<small>آخر ما بحثت عنه</small>${chips(seen)}` : '') + (pop.length ? `<small style="margin-top:12px">الأكثر بحثاً هذا الأسبوع</small>${chips(pop)}` : '');
  $$('#recent [data-id]').forEach((b) => { b.onclick = () => onPick(b.dataset.id); });
}

export function renderFooter() {
  $('#foot').innerHTML = '<img src="icons/seal.png" alt="" width="52" height="52"><div><b>شركة ربوع المعالي للتجارة والمقاولات العامة المحدودة</b><span>Bot Rm · للاستخدام الداخلي</span></div>';
}

/** زر «تثبيت التطبيق» حيث يدعم المتصفح ذلك (أندرويد/كروم) */
export function initInstallPrompt() {
  const box = $('#install');
  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; box.hidden = false; });
  window.addEventListener('appinstalled', () => { box.hidden = true; deferred = null; });
  box.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null; box.hidden = true;
  });
}
