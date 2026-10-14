/** خريطة انتشار المواقع (Canvas بلا خدمات خارجية): نقطة لكل موقع — عادي = ممتلئة، هايبرد = حلقة؛ زين ماجنتا، تاسك تركوازي.
 *  تكبير بالأزرار (أو Ctrl+عجلة)، سحب للتحريك، تلميح عند المرور، ونقرة تفتح الموقع. */
import { esc } from '../lib/dom.js';
import { opOf, isHyb, hasGeo } from './mgrModel.js';

const inIraq = (r) => r.lon > 38 && r.lon < 49.5 && r.lat > 28.5 && r.lat < 37.5;

/** لون CSS حقيقي (light-dark تُحلّ على عنصر مؤقت لأن Canvas لا يقرأ المتغيّر الخام) */
function cssColor(el, name) {
  const t = document.createElement('i'); t.style.color = `var(${name})`; el.appendChild(t);
  const c = getComputedStyle(t).color; t.remove(); return c;
}

export function mountMap(box, getRows, onPick) {
  box.innerHTML = '<canvas class="mp-cv" aria-label="خريطة انتشار المواقع" role="img"></canvas><div class="mp-tip" hidden></div><div class="mp-ctl"><button type="button" data-z="1" aria-label="تكبير">+</button><button type="button" data-z="-1" aria-label="تصغير">−</button><button type="button" data-z="0" aria-label="إعادة الضبط">⟲</button></div><div class="mp-note"></div>';
  const cv = box.querySelector('canvas'), tip = box.querySelector('.mp-tip'), note = box.querySelector('.mp-note'), ctx = cv.getContext('2d');
  let W = 0, H = 0, pts = [], zoom = 1, px = 0, py = 0, base = null, colors = null, drag = null, hover = null;

  const layout = () => {
    const rows = getRows().filter((r) => hasGeo(r) && inIraq(r));
    const all = rows.length ? rows : [];
    const lons = all.map((r) => +r.lon), lats = all.map((r) => +r.lat);
    const trim = (a) => { const b = a.slice().sort((x, y) => x - y); if (b.length < 60) return [b[0], b[b.length - 1]]; const k = Math.floor(b.length * 0.005); return [b[k], b[b.length - 1 - k]]; };   // يتجاهل الشاذّ البعيد عند ضبط الإطار
    const [lon0, lon1] = trim(lons), [lat0, lat1] = trim(lats);
    const cos = Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180), pad = 26;
    const s = all.length ? Math.min((W - pad * 2) / Math.max(0.01, (lon1 - lon0) * cos), (H - pad * 2) / Math.max(0.01, lat1 - lat0)) : 1;
    base = { lon0, lat1, cos, s, ox: (W - (lon1 - lon0) * cos * s) / 2, oy: (H - (lat1 - lat0) * s) / 2 };
    pts = all.map((r) => ({ r, bx: (r.lon - lon0) * cos * s + base.ox, by: (lat1 - r.lat) * s + base.oy, o: opOf(r), h: isHyb(r) }));
    note.textContent = `${pts.length.toLocaleString('en')} موقع على الخريطة · ${(getRows().length - pts.length).toLocaleString('en')} بلا إحداثيات صالحة`;
  };
  const pos = (p) => [p.bx * zoom + px, p.by * zoom + py];

  const draw = () => {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    colors ||= { z: cssColor(box, '--zc'), t: cssColor(box, '--tc'), line: cssColor(box, '--line'), tx: cssColor(box, '--tx') };
    ctx.strokeStyle = colors.line; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) { const x = (W / 6) * i, y = (H / 6) * i; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const rad = Math.min(5, 3 + zoom * 0.35);
    for (const p of pts) {
      const [x, y] = pos(p); if (x < -8 || y < -8 || x > W + 8 || y > H + 8) continue;
      const col = p.o === 'Z' ? colors.z : p.o === 'T' ? colors.t : colors.tx;
      ctx.beginPath(); ctx.arc(x, y, p.h ? rad + 0.6 : rad, 0, 6.2832);
      if (p.h) { ctx.lineWidth = 1.7; ctx.strokeStyle = col; ctx.globalAlpha = 0.95; ctx.stroke(); ctx.globalAlpha = 0.2; ctx.fillStyle = col; ctx.fill(); }
      else { ctx.globalAlpha = 0.78; ctx.fillStyle = col; ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    if (hover) { const [x, y] = pos(hover); ctx.beginPath(); ctx.arc(x, y, rad + 4, 0, 6.2832); ctx.lineWidth = 2; ctx.strokeStyle = colors.tx; ctx.stroke(); }
  };

  const resize = () => {
    const r = box.getBoundingClientRect(); if (!r.width) return;
    const d = window.devicePixelRatio || 1; W = r.width; H = r.height;
    cv.width = Math.round(W * d); cv.height = Math.round(H * d); cv.style.width = `${W}px`; cv.style.height = `${H}px`; ctx.setTransform(d, 0, 0, d, 0, 0);
    layout(); draw();
  };
  const nearest = (mx, my) => { let best = null, bd = 100; for (const p of pts) { const [x, y] = pos(p), d = (x - mx) ** 2 + (y - my) ** 2; if (d < bd) { bd = d; best = p; } } return best; };
  const zoomBy = (f, cx = W / 2, cy = H / 2) => { const nz = Math.min(14, Math.max(1, zoom * f)); px = cx - ((cx - px) / zoom) * nz; py = cy - ((cy - py) / zoom) * nz; zoom = nz; if (zoom === 1) { px = 0; py = 0; } draw(); };

  box.querySelector('.mp-ctl').onclick = (e) => { const z = e.target.dataset?.z; if (z === undefined) return; if (z === '0') { zoom = 1; px = py = 0; draw(); } else zoomBy(z === '1' ? 1.6 : 1 / 1.6); };
  cv.addEventListener('wheel', (e) => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const r = cv.getBoundingClientRect(); zoomBy(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, px, py, moved: false }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true; if (drag.moved) { px = drag.px + dx; py = drag.py + dy; draw(); tip.hidden = true; return; } }
    const p = nearest(mx, my); if (p !== hover) { hover = p; draw(); }
    if (p) { tip.hidden = false; tip.innerHTML = `<b class="en">${esc(p.r.id)}</b> ${p.o === 'Z' ? 'زين' : p.o === 'T' ? 'تاسك' : ''}${p.h ? ' · هايبرد' : ''}<br>${esc(p.r.nm || '')}`; const w = tip.offsetWidth; tip.style.left = `${Math.min(Math.max(6, mx - w / 2), W - w - 6)}px`; tip.style.top = `${Math.max(6, my - tip.offsetHeight - 14)}px`; } else tip.hidden = true;
  });
  cv.addEventListener('pointerup', () => { const was = drag; drag = null; if (was && !was.moved && hover) onPick(hover.r.id); });
  cv.addEventListener('pointerleave', () => { hover = null; tip.hidden = true; draw(); });

  const ro = new ResizeObserver(resize); ro.observe(box);
  resize();
  return { redraw() { layout(); draw(); }, destroy() { ro.disconnect(); } };
}
