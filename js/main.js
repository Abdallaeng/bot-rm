/** نقطة الدخول: تحميل البيانات ثم تشغيل الواجهة */
import { $, esc, toast } from './lib/dom.js';
import { state, fetchPacket, unlockPacket, setRows, storedPacket } from './data/store.js';
import { checkSync, startSyncLoop } from './data/sync.js';
import { flushPending } from './data/analytics.js';
import { initBroadcast, applyBroadcast } from './ui/broadcast.js';
import { initSearch } from './ui/search.js';
import { renderStats, renderFooter, renderConn, initInstallPrompt } from './ui/home.js';
import { LS } from './lib/storage.js';
import { initTheme } from './ui/theme.js';
import { initBrowse, openBrowse } from './ui/browse.js';
import { initHaptics } from './lib/haptic.js';
import { initSettings } from './ui/settings.js';
import { initTypewriter } from './ui/typewriter.js';
import { initMulti } from './ui/multi.js';

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
let current = null;
async function refreshInBackground(force = false) {
  try {
    const sync = await checkSync(force);    // طلب واحد خفيف (إصدار + إعلان)، محدود بمرة كل 5 دقائق
    if (!sync) return;
    if ('b' in sync) applyBroadcast(sync.b);
    if (!current || !sync.updated || sync.updated === current.updated) return;
    await new Promise((r) => setTimeout(r, Math.random() * 2500));   // تأخير عشوائي: لا يصل الجميع في اللحظة نفسها
    const latest = await fetchPacket(true, sync.updated);            // لا يُحمَّل الملف إلا عند وجود إصدار جديد فعلاً
    if (latest.updated === current.updated) return;
    const rows = await unlockPacket(latest);
    if (!rows) return;
    setRows(rows, latest); current = latest;
    document.dispatchEvent(new CustomEvent('botrm:data'));
    toast('✅ وصلت بيانات جديدة');
  } catch { /* بدون اتصال: نكمل بالنسخة المحفوظة */ }
}

async function boot() {
  let packet = await storedPacket();                    // الأسرع: من التخزين المحلي بلا أي طلب شبكة
  if (!packet || !packet.ct) {
    try { packet = await fetchPacket(); }
    catch { return showMessage('⚠️', 'تعذّر تحميل البيانات. تأكد من الاتصال بالإنترنت ثم أعد المحاولة.'); }
  }

  const rows = await unlockPacket(packet);
  if (!rows) return showCodeGate(packet);

  setRows(rows, packet); current = packet;
  $('#out .skel')?.remove();
  flushPending();
  renderStats();
  renderFooter();
  initInstallPrompt();
  initSearch();
  initBrowse();
  initMulti();
  initBroadcast();
  const qs = new URLSearchParams(location.search);       // اختصارات الشاشة الرئيسية
  if (qs.has('browse')) openBrowse(); else if (qs.has('focus')) $('#q').focus();
  if (!navigator.onLine) toast('أنت غير متصل — يعمل التطبيق بالبيانات المحفوظة');
  renderConn();
  document.addEventListener('botrm:data', () => { renderStats(); renderConn(); });
  ['online', 'offline'].forEach((ev) => window.addEventListener(ev, renderConn));
  // تحديث تلقائي: عند الفتح، وكل دقيقتين تقريباً أثناء الاستخدام، وعند العودة للتطبيق (انظر data/sync.js)
  refreshInBackground(qs.has('sync'));
  document.addEventListener('botrm:sync', () => refreshInBackground(true));
  startSyncLoop(() => { refreshInBackground(); renderConn(); });
}

initTheme();
initSettings();
initHaptics();
initTypewriter();
window.addEventListener('offline', () => toast('أنت غير متصل — يعمل التطبيق بالبيانات المحفوظة'));
window.addEventListener('online', () => { toast('عاد الاتصال'); flushPending(); });
$('#adminBtn').addEventListener('click', async () => (await import('./ui/admin.js')).openAdmin());
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
