/** تصدير قائمة مواقع (كلستر) إلى صور PNG مرتبة للمشاركة على واتساب — رسم مباشر بـ Canvas بدون مكتبات. */
const W = 1080;
const PAD = 40;
const ROW_H = 138;
const ROW_GAP = 12;
const MAX_PAGE_H = 2100;
const FONT = '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
const SEV = { S1: '#e5395a', S2: '#ee8a1f', S3: '#14a874' };
const C = { ink: '#0d2a33', mut: '#5f7882', paper: '#eef4f6', card: '#ffffff', line: '#d6e3e8', teal: '#157a94', tealDark: '#0a3342', tealMid: '#1f8aa3' };

const font = (size, weight = 400) => `${weight} ${size}px ${FONT}`;

async function loadAssets() {
  try { await Promise.all([400, 500, 600, 700].map((w) => document.fonts.load(font(28, w), 'مرحبا 123'))); } catch { /* نكمل بالخط البديل */ }
  const seal = new Image();
  seal.src = 'icons/seal.png';
  try { await seal.decode(); } catch { /* بدون شعار */ }
  return { seal };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** يقسّم النص إلى أسطر حسب العرض؛ يضيف … إن زاد عن الحد الأقصى */
function wrap(ctx, text, maxW, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '', i = 0;
  for (; i < words.length; i++) {
    const t = cur ? `${cur} ${words[i]}` : words[i];
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur); cur = words[i];
      if (lines.length === maxLines) { cur = ''; break; }
    } else cur = t;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (i < words.length && lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

function text(ctx, str, x, y, { size = 28, weight = 400, color = C.ink, align = 'right', dir = 'rtl' } = {}) {
  ctx.font = font(size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.direction = dir; ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
}

function pill(ctx, label, xRight, y, { bg, fg = '#fff', size = 24, h = 44 }) {
  ctx.font = font(size, 600); ctx.direction = 'ltr';
  const w = ctx.measureText(label).width + 36;
  ctx.fillStyle = bg; roundRect(ctx, xRight - w, y, w, h, h / 2); ctx.fill();
  text(ctx, label, xRight - w / 2, y + h / 2 + size * 0.35, { size, weight: 600, color: fg, align: 'center', dir: 'rtl' });
  return w;
}

/* ---------- رأس الصورة الأولى ---------- */
function drawHeader(ctx, meta, assets, height) {
  const g = ctx.createLinearGradient(0, 0, W, height);
  g.addColorStop(0, C.tealDark); g.addColorStop(0.6, '#0f5f78'); g.addColorStop(1, C.tealMid);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, height);

  // برج + موجات (زخرفة)
  ctx.save(); ctx.globalAlpha = 0.16; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  const tx = 170, ty = height - 20;
  ctx.beginPath(); ctx.moveTo(tx - 70, ty); ctx.lineTo(tx - 8, ty - 230); ctx.moveTo(tx + 70, ty); ctx.lineTo(tx + 8, ty - 230);
  for (let k = 0; k < 5; k++) { const yy = ty - k * 52, w = 70 - k * 12; ctx.moveTo(tx - w, yy); ctx.lineTo(tx + w, yy); if (k < 4) { ctx.moveTo(tx - w, yy); ctx.lineTo(tx + (70 - (k + 1) * 12), yy - 52); } }
  ctx.stroke();
  for (let r = 1; r <= 4; r++) { ctx.globalAlpha = 0.14 - r * 0.025; ctx.beginPath(); ctx.arc(tx, ty - 236, r * 46, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();

  // الشعار + الاسم
  const sx = W - PAD - 64, sy = 70;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, 50, 0, Math.PI * 2); ctx.fill();
  if (assets.seal.complete && assets.seal.naturalWidth) ctx.drawImage(assets.seal, sx - 46, sy - 46, 92, 92);
  text(ctx, 'Bot Rm', sx - 68, sy - 2, { size: 36, weight: 700, color: '#fff', dir: 'ltr' });
  text(ctx, 'شركة ربوع المعالي', sx - 68, sy + 32, { size: 24, weight: 500, color: 'rgba(255,255,255,.82)' });

  // العنوان
  text(ctx, meta.title, W - PAD, 196, { size: 68, weight: 700, color: '#fff' });
  const sub = meta.subtitle;
  if (sub) text(ctx, sub, W - PAD, 246, { size: 30, weight: 500, color: 'rgba(255,255,255,.88)' });

  // شارات الخطورة + العدد
  let x = W - PAD;
  x -= pill(ctx, `${meta.total} موقع`, x, height - 74, { bg: 'rgba(255,255,255,.95)', fg: C.tealDark, size: 26, h: 48 }) + 12;
  for (const s of ['S1', 'S2', 'S3']) {
    if (!meta.sev[s]) continue;
    x -= pill(ctx, `${s} · ${meta.sev[s]}`, x, height - 74, { bg: SEV[s], size: 24, h: 48 }) + 10;
  }
}

function drawMiniHeader(ctx, meta, page, pages) {
  ctx.fillStyle = C.tealDark; ctx.fillRect(0, 0, W, 110);
  text(ctx, meta.title, W - PAD, 68, { size: 40, weight: 700, color: '#fff' });
  text(ctx, `${page} / ${pages}`, PAD, 66, { size: 30, weight: 600, color: 'rgba(255,255,255,.8)', align: 'left', dir: 'ltr' });
}

/* ---------- صف موقع ---------- */
function drawRow(ctx, r, y) {
  ctx.save(); ctx.shadowColor = 'rgba(10,50,66,.14)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  ctx.fillStyle = C.card; roundRect(ctx, PAD, y, W - PAD * 2, ROW_H, 22); ctx.fill(); ctx.restore();
  const sev = SEV[r.sev] || C.line;
  ctx.fillStyle = sev; roundRect(ctx, W - PAD - 10, y + 16, 10, ROW_H - 32, 5); ctx.fill();

  // رقم الموقع
  text(ctx, String(r.id), W - PAD - 34, y + 66, { size: 54, weight: 700, color: C.teal, dir: 'ltr', align: 'right' });
  if (r.sev) pill(ctx, r.sev, W - PAD - 34, y + 80, { bg: sev, size: 20, h: 32 });

  // العنوان + الفني
  const left = PAD + 24, right = W - PAD - 250, maxW = right - left;
  ctx.font = font(27, 600); ctx.direction = 'rtl';
  const lines = wrap(ctx, r.nm || '—', maxW, 2);
  lines.forEach((ln, i) => text(ctx, ln, right, y + 42 + i * 33, { size: 27, weight: 600, color: C.ink }));
  let meta = [r.govLabel, r.tech].filter(Boolean).join('  ·  ');
  ctx.font = font(22, 500);
  const mw = maxW - (r.phone ? 235 : 0);
  if (ctx.measureText(meta).width > mw) { while (meta && ctx.measureText(meta + '…').width > mw) meta = meta.slice(0, -1); meta += '…'; }
  text(ctx, meta, right, y + ROW_H - 20, { size: 22, weight: 500, color: C.mut });
  if (r.phone) text(ctx, r.phone, left, y + ROW_H - 20, { size: 24, weight: 600, color: C.teal, align: 'left', dir: 'ltr' });
}

function drawFooter(ctx, y, page, pages, meta) {
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PAD, y + 8); ctx.lineTo(W - PAD, y + 8); ctx.stroke();
  text(ctx, `Bot Rm · شركة ربوع المعالي`, W - PAD, y + 54, { size: 22, weight: 600, color: C.mut });
  text(ctx, `${meta.date}  ·  ${page}/${pages}`, PAD, y + 54, { size: 22, weight: 500, color: C.mut, align: 'left', dir: 'ltr' });
}

/** meta: {title, subtitle, total, sev:{S1,S2,S3}, date, note?}   rows: [{id, nm, sev, govLabel, tech, phone}] */
export async function renderListImages(meta, rows, opts = {}) {
  const maxH = opts.maxH || MAX_PAGE_H;
  const assets = await loadAssets();
  const HEAD1 = 330, HEAD_N = 140, FOOT = 84;
  const pages = [];
  let cur = [], room = maxH - HEAD1 - FOOT;
  for (const r of rows) {
    if (room < ROW_H + ROW_GAP) { pages.push(cur); cur = []; room = maxH - HEAD_N - FOOT; }
    cur.push(r); room -= ROW_H + ROW_GAP;
  }
  if (cur.length) pages.push(cur);

  const blobs = [];
  for (let p = 0; p < pages.length; p++) {
    const head = p === 0 ? HEAD1 : HEAD_N;
    const H = opts.fixedH ? maxH : head + pages[p].length * (ROW_H + ROW_GAP) + FOOT + (meta.note && p === pages.length - 1 ? 50 : 0);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    if (p === 0) drawHeader(ctx, meta, assets, HEAD1); else drawMiniHeader(ctx, meta, p + 1, pages.length);
    pages[p].forEach((r, i) => drawRow(ctx, r, head + i * (ROW_H + ROW_GAP)));
    let fy = head + pages[p].length * (ROW_H + ROW_GAP);
    if (meta.note && p === pages.length - 1) { text(ctx, meta.note, W / 2, fy + 28, { size: 22, weight: 500, color: C.mut, align: 'center' }); fy += 50; }
    drawFooter(ctx, opts.fixedH ? H - FOOT : fy, p + 1, pages.length, meta);
    blobs.push(await new Promise((res) => (opts.jpeg ? cv.toBlob(res, 'image/jpeg', 0.72) : cv.toBlob(res, 'image/png'))));
  }
  return blobs;
}

/** مشاركة عبر قائمة المشاركة (واتساب وغيره)؛ يعيد false إن لم تدعمها الأداة */
export async function shareImages(blobs, name, text) {
  const files = blobs.map((b, i) => new File([b], `${name}${blobs.length > 1 ? `-${i + 1}` : ''}.png`, { type: 'image/png' }));
  if (navigator.canShare?.({ files })) {
    try { await navigator.share({ files, title: name, text }); return true; }
    catch (e) { if (e.name === 'AbortError') return true; }
  }
  return false;
}

export function downloadImages(blobs, name) {
  blobs.forEach((b, i) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = `${name}${blobs.length > 1 ? `-${i + 1}` : ''}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
}

/** يبني ملف PDF من صور JPEG (كل صورة = صفحة). يعيد Blob. */
export async function imagesToPdf(jpegBlobs, pageW = 595) {
  const enc = new TextEncoder(); const parts = []; const offs = []; let len = 0;
  const push = (d) => { const u = typeof d === 'string' ? enc.encode(d) : d; parts.push(u); len += u.length; };
  const obj = (n, body) => { offs[n] = len; push(`${n} 0 obj\n`); push(body); push('\nendobj\n'); };
  const imgs = [];
  for (const b of jpegBlobs) {
    const bmp = await createImageBitmap(b);
    imgs.push({ w: bmp.width, h: bmp.height, data: new Uint8Array(await b.arrayBuffer()) });
    bmp.close?.();
  }
  const n = imgs.length;
  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${n} /Kids [${imgs.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`);
  imgs.forEach((im, i) => {
    const pg = 3 + i * 3, ct = pg + 1, xo = pg + 2, ph = +(pageW * im.h / im.w).toFixed(2);
    obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${ph}] /Resources << /XObject << /Im0 ${xo} 0 R >> >> /Contents ${ct} 0 R >>`);
    const c = `q ${pageW} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    obj(ct, `<< /Length ${c.length} >>\nstream\n${c}\nendstream`);
    offs[xo] = len; push(`${xo} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.data.length} >>\nstream\n`);
    push(im.data); push('\nendstream\nendobj\n');
  });
  const total = 3 + n * 3, xref = len;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) push(`${String(offs[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}
