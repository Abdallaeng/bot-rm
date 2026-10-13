/** POST /api/login { user, pass } → { token, exp, weak }
 *  التحقق في الخادم + حدّ 5 محاولات فاشلة كل 15 دقيقة لكل عنوان IP. */
import { sha256, json, signToken, currentHash, ADMIN_HASH, SESSION_HOURS, getCtl, audit } from '../_shared.js';

const WINDOW = 900;

export async function onRequestPost({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);
  const ctl = (await getCtl(env)).c;                       // تحكمات الأمان من لوحة الإدارة
  const MAX_FAILS = ctl.maxFails || 5, HOURS = ctl.sessHours || SESSION_HOURS;
  const ip = request.headers.get('cf-connecting-ip') || 'x';
  const rlKey = `rl:${ip}`;
  const fails = Number(await env.DATA.get(rlKey)) || 0;
  if (fails >= MAX_FAILS) { if (fails === MAX_FAILS) await audit(env, request, 'login', 'محاولات دخول خاطئة كثيرة — تم القفل 15 دقيقة', false); return json({ error: 'locked', retryMin: Math.ceil(WINDOW / 60) }, 429); }

  let body; try { body = await request.json(); } catch { return json({ error: 'bad-json' }, 400); }
  const user = String(body.user || '').trim().toLowerCase(), pass = String(body.pass || '');
  const hash = await currentHash(env);
  if ((await sha256(`${user}:${pass}`)) !== hash) {
    await env.DATA.put(rlKey, String(fails + 1), { expirationTtl: WINDOW });
    if (fails + 1 >= 3) await audit(env, request, 'login', `محاولة دخول فاشلة (${fails + 1} من ${MAX_FAILS})`, false);
    return json({ error: 'bad-credentials', left: MAX_FAILS - fails - 1 }, 401);
  }
  await env.DATA.delete(rlKey);
  await audit(env, request, 'login', 'تسجيل دخول ناجح');
  return json({ token: await signToken(env, user, HOURS), exp: Date.now() + HOURS * 3600e3, weak: hash === ADMIN_HASH });
}
