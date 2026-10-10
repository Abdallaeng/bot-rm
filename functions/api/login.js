/** POST /api/login { user, pass } → { token, exp, weak }
 *  التحقق في الخادم + حدّ 5 محاولات فاشلة كل 15 دقيقة لكل عنوان IP. */
import { sha256, json, signToken, currentHash, ADMIN_HASH, SESSION_HOURS } from '../_shared.js';

const MAX_FAILS = 5, WINDOW = 900;

export async function onRequestPost({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);
  const ip = request.headers.get('cf-connecting-ip') || 'x';
  const rlKey = `rl:${ip}`;
  const fails = Number(await env.DATA.get(rlKey)) || 0;
  if (fails >= MAX_FAILS) return json({ error: 'locked', retryMin: Math.ceil(WINDOW / 60) }, 429);

  let body; try { body = await request.json(); } catch { return json({ error: 'bad-json' }, 400); }
  const user = String(body.user || '').trim().toLowerCase(), pass = String(body.pass || '');
  const hash = await currentHash(env);
  if ((await sha256(`${user}:${pass}`)) !== hash) {
    await env.DATA.put(rlKey, String(fails + 1), { expirationTtl: WINDOW });
    return json({ error: 'bad-credentials', left: MAX_FAILS - fails - 1 }, 401);
  }
  await env.DATA.delete(rlKey);
  return json({ token: await signToken(env, user), exp: Date.now() + SESSION_HOURS * 3600e3, weak: hash === ADMIN_HASH });
}
