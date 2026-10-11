/** معاينة الصور وPDF قبل المشاركة (مشتركة بين تصدير الكلستر وبطاقة الموقع) */
import { esc } from '../lib/dom.js';
import { ICONS } from '../lib/icons.js';

export function previewPdf(ex, file, text, n) {
  const url = URL.createObjectURL(file);
  const m = document.createElement('div');
  m.className = 'pv';
  m.innerHTML = `<div class="pvbox"><div class="pvdoc"><b>📄 ${esc(file.name)}</b><span>${n} صفحة · ${(file.size / 1048576).toFixed(1)} MB</span></div>
    <div class="pvbar"><button class="btn wa" data-a="share">مشاركة</button><button class="btn" data-a="save">حفظ PDF</button><button class="btn" data-a="x">إغلاق</button></div></div>`;
  const done = () => { URL.revokeObjectURL(url); m.remove(); };
  const save = () => { if (ex.inApp()) { ex.shareViaApp([{ blob: file, name: file.name }], text); return; } const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); };
  m.onclick = async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (e.target === m || a === 'x') return done();
    if (a === 'save') save();
    if (a === 'share') {
      if (ex.inApp()) ex.shareViaApp([{ blob: file, name: file.name }], text);
      else if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: file.name, text }); } catch { /* cancelled */ } }
      else { save(); alert('المشاركة المباشرة غير مدعومة هنا — تم حفظ الملف.'); }
    }
  };
  document.body.appendChild(m);
}

export function previewImages(ex, blobs, name, text) {
  const urls = blobs.map((b) => URL.createObjectURL(b));
  const m = document.createElement('div');
  m.className = 'pv';
  m.innerHTML = `<div class="pvbox"><div class="pvimgs">${urls.map((u) => `<img src="${u}" alt="">`).join('')}</div>
    <div class="pvbar"><button class="btn wa" data-a="share">${ICONS.wa}مشاركة على واتساب</button><button class="btn" data-a="save">${ICONS.save}حفظ الصورة</button><button class="btn" data-a="x">إغلاق</button></div></div>`;
  const done = () => { urls.forEach(URL.revokeObjectURL); m.remove(); };
  m.onclick = async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (e.target === m || a === 'x') return done();
    if (a === 'save') ex.downloadImages(blobs, name);
    if (a === 'share' && !(await ex.shareImages(blobs, name, text))) { ex.downloadImages(blobs, name); alert('المشاركة المباشرة غير مدعومة هنا — تم حفظ الصورة، أرسلها من الواتساب.'); }
  };
  document.body.appendChild(m);
}

