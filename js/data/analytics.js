/** عدّاد الاستخدام: سجل محلي + عدّاد أونلاين (counterapi.dev) مع طابور احتياطي عند انقطاع الشبكة */
import { LS } from '../lib/storage.js';
import { CFG } from './store.js';

const API = `https://api.counterapi.dev/v1/${CFG.counterNs}/`;
export const ymd = (d = new Date()) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');

async function hit(key) {
  const res = await fetch(`${API}${key}/up`, { mode: 'cors' });
  if (!res.ok) throw new Error(`hit ${res.status}`);
}
export async function getCount(key) {
  const res = await fetch(API + key, { mode: 'cors' });
  if (res.status === 404 || res.status === 400) return 0;
  if (!res.ok) throw new Error(`get ${res.status}`);
  return Number((await res.json()).count) || 0;
}

let lastTracked = '';
export function track(query, found) {
  const sig = `${query}|${found}`;
  if (sig === lastTracked) return;
  lastTracked = sig;
  const log = LS.get('brm_log', []);
  log.push([Date.now(), query, found ? 1 : 0]);
  LS.set('brm_log', log.slice(-600));
  const day = ymd(), keys = [`s${day}`];
  if (!found) keys.push(`m${day}`);
  keys.forEach((k) => hit(k).catch(() => queue(k)));
  document.dispatchEvent(new CustomEvent('botrm:log'));
}

const queue = (key) => { const p = LS.get('brm_pending', []); p.push(key); LS.set('brm_pending', p.slice(-300)); };

export async function flushPending() {
  const pending = LS.get('brm_pending', []);
  if (!pending.length) return;
  LS.set('brm_pending', []);
  for (const key of pending) {
    try { await hit(key); } catch { queue(key); break; }
  }
}

/** آخر المواقع التي بحث عنها هذا الجهاز (بدون تكرار) */
export function recentSearches(max = 8) {
  const log = LS.get('brm_log', []), seen = [];
  for (let i = log.length - 1; i >= 0 && seen.length < max; i--) if (log[i][2] && !seen.includes(log[i][1])) seen.push(log[i][1]);
  return seen;
}
