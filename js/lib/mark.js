/** تظليل الجزء المطابق من النص (يتجاهل الفروق: التشكيل، أ/إ/آ، ة/ه، ى/ي، الأرقام العربية) */
import { esc } from './dom.js';
import { normalizeArabic } from './text.js';

export const tokensOf = (raw) => normalizeArabic(raw || '').split(' ').filter(Boolean);

export function mark(text, tokens) {
  text = String(text ?? '');
  if (!tokens || !tokens.length || !text) return esc(text);
  let norm = '';
  const map = [];
  for (let i = 0; i < text.length; i++) {
    const n = /\s/.test(text[i]) ? ' ' : normalizeArabic(text[i]);
    for (const c of n) { norm += c; map.push(i); }
  }
  const ranges = [];
  for (const t of tokens) {
    if (!t) continue;
    for (let at = norm.indexOf(t); at >= 0; at = norm.indexOf(t, at + t.length)) ranges.push([map[at], map[at + t.length - 1] + 1]);
  }
  if (!ranges.length) return esc(text);
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0].slice()];
  for (const [s, e] of ranges.slice(1)) { const last = merged.at(-1); if (s <= last[1]) last[1] = Math.max(last[1], e); else merged.push([s, e]); }
  let out = '', pos = 0;
  for (const [s, e] of merged) { out += esc(text.slice(pos, s)) + `<mark class="hl">${esc(text.slice(s, e))}</mark>`; pos = e; }
  return out + esc(text.slice(pos));
}
