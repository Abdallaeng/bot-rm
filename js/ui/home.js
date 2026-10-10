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

export function renderRecent(onPick) {
  const seen = recentSearches();
  $('#recent').innerHTML = seen.length
    ? `<small>آخر ما بحثت عنه</small><div>${seen.map((id) => `<button class="chip" type="button" data-id="${esc(id)}">${esc(id)}</button>`).join('')}</div>`
    : '';
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
