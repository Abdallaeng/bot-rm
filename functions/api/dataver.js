/** GET /api/dataver — إصدار البيانات الحالي فقط (بضعة بايتات) كي لا يحمّل الجهاز الملف كاملاً إلا عند وجود تحديث. */
import { json } from '../_shared.js';

export async function onRequestGet({ request, env }) {
  let stored = '';
  if (env.DATA) { try { stored = String(JSON.parse((await env.DATA.get('pmeta')) || '{}').updated || ''); } catch { /* */ } }
  let fixed = '';
  try { fixed = String((await (await env.ASSETS.fetch(new URL('/data.json', request.url))).json()).updated || ''); } catch { /* */ }
  return json({ updated: stored > fixed ? stored : fixed });
}
