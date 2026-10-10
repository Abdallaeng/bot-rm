/** GET /api/bhist — سجل الإعلانات السابقة (للإدارة). */
import { authed, json } from '../_shared.js';
export async function onRequestGet({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);
  if (!(await authed(request))) return json({ error: 'unauthorized' }, 401);
  return json({ h: (await env.DATA.get('bhist', 'json')) || [] });
}
