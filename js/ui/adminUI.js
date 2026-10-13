/** مكوّنات واجهة لوحة الإدارة المشتركة: لوحات، بطاقات مؤشرات، جداول، مخططات، تنسيق التواريخ */
import { esc } from '../lib/dom.js';

/* ---------- تنسيق ---------- */
export const fmtDay = (k) => `${k.slice(6)}/${k.slice(4, 6)}`;
export const fmtDT = (t) => new Date(t).toLocaleString('en-GB', { hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const fmtTime = (t) => new Date(t).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });
export const rel = (t) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 45) return 'الآن';
  const m = Math.round(s / 60); if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.round(m / 60); if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.round(h / 24); return d === 1 ? 'أمس' : `قبل ${d} يوم`;
};
export const num = (n) => Number(n || 0).toLocaleString('en');
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/* ---------- هيكل الصفحة ---------- */
/** رأس الصفحة: عنوان + وصف + أزرار */
export const pgHead = (title, sub = '', actions = '') =>
  `<div class="pg-h"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${actions ? `<div class="pg-a">${actions}</div>` : ''}</div>`;

/** لوحة (بطاقة) بعنوان وشرح وأزرار اختيارية */
export const pn = (title, sub, body, { actions = '', cls = '', icon = '', id = '' } = {}) =>
  `<section class="pn ${cls}"${id ? ` id="${id}"` : ''}><header class="pn-h">${icon ? `<span class="pn-i">${icon}</span>` : ''}<div class="pn-tt"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>${actions ? `<div class="pn-a">${actions}</div>` : ''}</header><div class="pn-b">${body}</div></section>`;

/** بطاقة مؤشر: قيمة كبيرة + عنوان + مؤشر تغيّر اختياري */
export const kpi = (label, value, { sub = '', tone = '', icon = '', delta = null, title = '', n = null } = {}) =>
  `<div class="kc ${tone}"${title ? ` title="${esc(title)}"` : ''}>${icon ? `<span class="kc-i">${icon}</span>` : ''}<div class="kc-b"><small>${label}</small><b${n != null ? ` data-n="${n}"` : ''}>${value}</b>${delta != null ? `<em class="${delta >= 0 ? 'up' : 'dn'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}%</em>` : ''}${sub ? `<span class="kc-s">${sub}</span>` : ''}</div></div>`;

/** شارة حالة صغيرة */
export const pill = (text, tone = '') => `<span class="pill ${tone}">${text}</span>`;

/** صف «اسم: قيمة» في قوائم التفاصيل */
export const dl = (rows) => `<dl class="dl">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;

/** جدول: cols = [عنوان...]، rows = مصفوفة صفوف HTML جاهزة (خلايا) */
export const table = (cols, rows, { cls = '', empty = 'لا توجد بيانات.' } = {}) => rows.length
  ? `<div class="tbl-wrap"><table class="tbl2 ${cls}"><thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
  : `<div class="muted pn-empty">${empty}</div>`;

/* ---------- مخططات ---------- */
/** خط مصغّر (Sparkline) لسلسلة أرقام: يُظهر اتجاه الطلب عبر الأيام */
export const spark = (vals, w = 64) => {
  if (!vals || vals.length < 2 || !vals.some((v) => v)) return '<span class="muted">—</span>';
  const H = 20, mx = Math.max(...vals), step = w / (vals.length - 1);
  const pts = vals.map((v, i) => `${(i * step).toFixed(1)},${(H - 2 - (v / mx) * (H - 5)).toFixed(1)}`);
  const last = pts.at(-1).split(',');
  return `<svg class="spk" style="width:${w}px" viewBox="0 0 ${w} ${H}" aria-hidden="true"><polyline pathLength="1" points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${last[0]}" cy="${last[1]}" r="2.2" fill="currentColor"/></svg>`;
};

/** أعمدة أفقية: rows = [[اسم, عدد, مفتاح?]] */
export const bars = (rows, max, { ltr = false, series = null, unit = '' } = {}) => rows.map(([name, n, key]) =>
  `<div class="bar${series ? ' sp' : ''}"><span${ltr ? ' class="en" style="direction:ltr;text-align:start"' : ''} title="${esc(name)}">${esc(name)}</span><i style="width:${Math.max(2, Math.round((n / (max || 1)) * 100))}%"></i><em>${num(n)}${unit}</em>${series ? spark(series(key ?? name)) : ''}</div>`).join('');

/** يدمج قوائم [مفتاح، عدد] ويرتّبها تنازلياً */
export const merge = (lists) => { const m = {}; lists.forEach((l) => (l || []).forEach(([k, n]) => { m[k] = (m[k] || 0) + n; })); return Object.entries(m).sort((a, b) => b[1] - a[1]); };

/** مخطط أعمدة يومي: days = [{label, s, m}] */
export function dayChart(days, { H = 190 } = {}) {
  const W = 560, bw = W / days.length, max = Math.max(1, ...days.map((x) => x.s));
  const bars = days.map((x, i) => {
    const h = Math.round((x.s / max) * (H - 50)), bx = i * bw + bw * 0.17, w = bw * 0.66, by = H - 24 - h;
    const hit = x.m ? Math.round((x.m / max) * (H - 50)) : 0;
    return `<g style="--i:${i}"><title>${x.label}: ${x.s} بحث${x.m ? `، منها ${x.m} بلا نتيجة` : ''}</title><rect x="${bx.toFixed(1)}" y="${by}" width="${w.toFixed(1)}" height="${Math.max(h, 2)}" rx="5" fill="${i === days.length - 1 ? 'var(--acc)' : 'color-mix(in srgb,var(--acc) 45%,transparent)'}"/>${hit ? `<rect x="${bx.toFixed(1)}" y="${H - 24 - hit}" width="${w.toFixed(1)}" height="${hit}" rx="3" fill="var(--s2)" opacity=".85"/>` : ''}<text class="val" x="${(bx + w / 2).toFixed(1)}" y="${by - 5}" text-anchor="middle">${x.s || ''}</text>${days.length <= 15 || i % 2 === 0 ? `<text x="${(bx + w / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${x.label}</text>` : ''}</g>`;
  }).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="عدد عمليات البحث اليومية">${bars}</svg></div>`;
}

/** أعمدة الساعات (0–23) */
export function hoursChart(hours) {
  const hMax = Math.max(1, ...hours), peak = hours.indexOf(Math.max(...hours));
  return `<div class="hrs">${hours.map((n, i) => `<i title="${i}:00 — ${n}" style="--i:${i};height:${Math.max(3, Math.round((n / hMax) * 100))}%;${i === peak && n ? 'background:var(--acc)' : ''}"></i>`).join('')}</div><div class="hlab"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>`;
}

/* ---------- مؤشر حد الاستهلاك (gauge) ---------- */
/** n من max: شريط ملوّن (أخضر < 70% ≤ برتقالي < 90% ≤ أحمر) + نسبة + ملاحظة */
export function gauge(label, n, max, { note = '', approx = false } = {}) {
  const p = Math.min(100, (n / max) * 100), tone = p >= 90 ? 'bad' : p >= 70 ? 'warn' : 'ok';
  const txt = tone === 'bad' ? 'قريب جداً من الحد' : tone === 'warn' ? 'انتبه' : 'آمن';
  return `<div class="gg ${tone}"><div class="gg-h"><b>${label}</b>${pill(txt, tone)}</div><div class="gg-v"><b class="en">${approx ? '≈ ' : ''}${num(n)}</b><span class="gg-of">من <span class="en">${num(max)}</span></span><span class="gg-p en">${p < 10 && p > 0 ? p.toFixed(1) : Math.round(p)}%</span></div><div class="meter"><i style="width:${Math.max(p ? 2 : 0, p).toFixed(1)}%" class="${tone === 'ok' ? '' : 'hot'}"></i></div>${note ? `<small class="muted">${note}</small>` : ''}</div>`;
}

/* ---------- هياكل التحميل (skeleton) بنفس شكل الصفحة ---------- */
/** kind: 'kpi' = رأس + صف مؤشرات + لوحتان، 'list' = رأس + لوحة جدول */
export const skeleton = (kind = 'kpi') => `<div class="sk-pg" aria-hidden="true"><div class="sk-h"><i class="sk w40"></i><i class="sk w65 s"></i></div>${kind === 'kpi' ? `<div class="sk-k">${'<div class="sk-c"><i class="sk sq"></i><div><i class="sk w50 s"></i><i class="sk w75"></i></div></div>'.repeat(5)}</div><div class="sk-g"><div class="sk-p"><i class="sk w50"></i><i class="sk blk"></i></div><div class="sk-p"><i class="sk w50"></i><i class="sk blk"></i></div></div>` : ''}<div class="sk-p"><i class="sk w40"></i>${'<i class="sk row"></i>'.repeat(kind === 'kpi' ? 3 : 6)}</div></div>`;
