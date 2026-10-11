/** GET /api/versions — سجل النسخ المنشورة.  POST { id } — التراجع إلى نسخة سابقة (للإدارة). */
import { authed, json } from '../_shared.js';

export async function onRequestGet({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);
  if (!(await authed(request, env))) return json({ error: 'unauthorized' }, 401);
  return json({ log: (await env.DATA.get('vlog', 'json')) || [], backups: (await env.DATA.get('blog', 'json')) || [] });
}

export async function onRequestPost({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);
  if (!(await authed(request, env))) return json({ error: 'unauthorized' }, 401);
  let body; try { body = await request.json(); } catch { return json({ error: 'bad-json' }, 400); }
  const text = await env.DATA.get(`ver:${String(body.id || '').replace(/\W/g, '')}`);
  if (!text) return json({ error: 'not-found' }, 404);
  const packet = JSON.parse(text);
  packet.updated = new Date().toISOString();            // يجعلها «الأحدث» ليتحدّث بها المستخدمون
  const out = JSON.stringify(packet);
  await env.DATA.put('packet', out);
  await env.DATA.put('pmeta', JSON.stringify({ updated: packet.updated }));
  const id = Date.now().toString(36);
  await env.DATA.put(`ver:${id}`, out);
  const log = (await env.DATA.get('vlog', 'json')) || [];
  log.unshift({ id, ts: Date.now(), count: packet.count, updated: packet.updated, add: 0, chg: 0, rem: 0, name: `تراجع إلى نسخة ${body.id}`, restored: true });
  for (const old of log.splice(8)) await env.DATA.delete(`ver:${old.id}`);
  await env.DATA.put('vlog', JSON.stringify(log));
  return json({ ok: true, count: packet.count });
}
