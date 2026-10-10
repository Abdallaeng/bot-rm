/** نقطة الدخول: تحميل البيانات ثم تشغيل الواجهة */
import { $, esc, toast } from './lib/dom.js';
import { state, fetchPacket, unlockPacket, setRows } from './data/store.js';
import { flushPending } from './data/analytics.js';
import { initSearch } from './ui/search.js';
import { renderStats, renderFooter, initInstallPrompt } from './ui/home.js';
import { LS } from './lib/storage.js';
import { initTheme } from './ui/theme.js';

function showMessage(title, message, withRetry = true) {
  $('#main').innerHTML = `<div class="gate"><div class="card"><h2>${title}</h2><p>${esc(message)}</p>${withRetry ? '<button class="btn pri" onclick="location.reload()">إعادة المحاولة</button>' : ''}</div></div>`;
}

function showCodeGate(packet, wrong = false) {
  $('#main').innerHTML = `<div class="gate"><div class="card"><h2>🔒 رمز الدخول</h2><p>أدخل رمز الفريق للمتابعة (مرة واحدة على هذا الجهاز).</p>
    <form id="gf"><input class="inp" id="gc" type="password" autocomplete="off" placeholder="الرمز" autofocus>
    <button class="btn pri" style="width:100%;height:46px">دخول</button><div class="err" id="ge">${wrong ? 'الرمز غير صحيح' : ''}</div></form></div></div>`;
  $('#gf').onsubmit = async (e) => {
    e.preventDefault();
    state.code = $('#gc').value.trim();
    const rows = await unlockPacket(packet);
    if (rows && state.code) { LS.set('brm_code', state.code); location.reload(); } else { $('#ge').textContent = 'الرمز غير صحيح'; $('#gc').select(); }
  };
}

/** بعد العرض الفوري من الكاش: تحقّق بصمت من وجود بيانات أحدث وبدّلها */
async function refreshInBackground(current) {
  try {
    const latest = await fetchPacket(true);
    if (latest.updated === current.updated) return;
    const rows = await unlockPacket(latest);
    if (!rows) return;
    setRows(rows, latest);
    document.dispatchEvent(new CustomEvent('botrm:data'));
    toast('تم تحديث البيانات');
  } catch { /* بدون اتصال: نكمل بالنسخة المحفوظة */ }
}

async function boot() {
  let packet;
  try { packet = await fetchPacket(); }
  catch { return showMessage('⚠️', 'تعذّر تحميل البيانات. تأكد من الاتصال بالإنترنت ثم أعد المحاولة.'); }

  const rows = await unlockPacket(packet);
  if (!rows) return showCodeGate(packet);

  setRows(rows, packet);
  flushPending();
  renderStats();
  renderFooter();
  initInstallPrompt();
  initSearch();
  if (!navigator.onLine) toast('أنت غير متصل — يعمل التطبيق بالبيانات المحفوظة');
  document.addEventListener('botrm:data', renderStats);
  refreshInBackground(packet);   // بعد نشر تحديث من لوحة الإدارة
}

initTheme();
window.addEventListener('offline', () => toast('أنت غير متصل — يعمل التطبيق بالبيانات المحفوظة'));
window.addEventListener('online', () => { toast('عاد الاتصال'); flushPending(); });
$('#adminBtn').addEventListener('click', async () => (await import('./ui/admin.js')).openAdmin());
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
