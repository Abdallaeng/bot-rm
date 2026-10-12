/** GET /api/audit — سجل عمليات الإدارة (للإدارة فقط). */
import { authed, json } from '../_shared.js';

export async function onRequestGet({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);
  if (!(await authed(request, env))) return json({ error: 'unauthorized' }, 401);
  return json({ log: (await env.DATA.get('audit', 'json')) || [] });
}
