/** صفحة المدير (manager.html): دخول مستقل عن الإدارة.
 *  POST /api/mgr { user, pass } → { token, exp } — رمز بدور «مدير» لا يصلح لأي عملية إدارة.
 *  GET  /api/mgr — يتحقق من الرمز (Bearer) ويعيد { ok } (لا يقرأ KV إلا السرّ المخزّن في الذاكرة).
 *  الدخول بالبصمة (WebAuthn / Passkey): بعد أول دخول بكلمة المرور يسجّل المدير بصمة جهازه (action: reg)
 *  ثم يدخل بها فقط (chal → auth). لا تُخزَّن إلا المفاتيح العامة في KV (`mgrpk`، كتابة عند التسجيل/الإزالة فقط).
 *  كلمة المرور لا تُخزَّن نصاً: PBKDF2-SHA256 (100 ألف دورة) مع ملح. غيّرها بتوليد قيمة جديدة وتحديث الثابتين. */
import { json, signToken, checkToken, audit, memo, forget, hmacB64, b64uEnc, b64uDec } from '../_shared.js';

const SALT = 'cd7be5d809027ac03768fbe383914620';
const HASH = 'd5fb6296ed2ae4eb049a4201fb48f306676b5315825ea219281bbc38d2029321';
const USER = 'عمر';
const HOURS = 8, WINDOW = 900, MAX_FAILS = 5;

const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (s) => Uint8Array.from(s.match(/../g), (h) => parseInt(h, 16));
async function derive(text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(text), 'PBKDF2', false, ['deriveBits']);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(SALT), iterations: 100000 }, key, 256)));
}
const same = (a, b) => { let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0; };

export async function onRequestGet({ request, env }) {
  return json({ ok: (await checkToken(request, env)) === 'm' });
}

/* ---------------- WebAuthn ---------------- */
const enc = new TextEncoder(), dec = new TextDecoder();
const sha = async (data) => new Uint8Array(await crypto.subtle.digest('SHA-256', data));
const getKeys = (env) => memo('mgrpk', 20, async () => (await env.DATA.get('mgrpk', 'json')) || []);
const putKeys = async (env, list) => { await env.DATA.put('mgrpk', JSON.stringify(list)); forget('mgrpk'); };

/** تحدٍّ بلا تخزين: عشوائي.انتهاء.توقيع — صالح 5 دقائق */
async function makeChallenge(env) {
  const base = `${b64uEnc(crypto.getRandomValues(new Uint8Array(18)))}.${Date.now() + 300e3}`;
  return `${base}.${await hmacB64(env, `wa:${base}`)}`;
}
async function challengeOk(env, text) {
  const [r, exp, sig] = String(text).split('.');
  return Boolean(r && exp && sig) && Number(exp) > Date.now() && (await hmacB64(env, `wa:${r}.${exp}`)) === sig;
}
/** clientDataJSON: النوع والتحدي والأصل */
async function checkClient(env, request, clientB64, type) {
  let cd; try { cd = JSON.parse(dec.decode(b64uDec(clientB64))); } catch { return null; }
  if (cd.type !== type || cd.origin !== new URL(request.url).origin) return null;
  if (!(await challengeOk(env, dec.decode(b64uDec(cd.challenge || ''))))) return null;
  return cd;
}
/** توقيع ES256 يصل بصيغة DER؛ WebCrypto يريده خاماً (r‖s) */
function derToRaw(der) {
  let i = 2; if (der[1] & 0x80) i += der[1] & 0x7f;
  const read = () => { const len = der[i + 1]; let v = der.slice(i + 2, i + 2 + len); i += 2 + len; while (v.length > 32 && v[0] === 0) v = v.slice(1); const out = new Uint8Array(32); out.set(v, 32 - v.length); return out; };
  const r = read(), s = read(); return Uint8Array.from([...r, ...s]);
}
async function verifySig(cred, authData, clientHash, sigBytes) {
  const data = Uint8Array.from([...authData, ...clientHash]);
  const spki = b64uDec(cred.pk);
  if (cred.alg === -7) {
    const key = await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(sigBytes), data);
  }
  const key = await crypto.subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sigBytes, data);
}

async function issue(env, request, how) {
  await audit(env, request, 'login', `دخول المدير إلى صفحة التقارير (${how})`);
  return json({ token: await signToken(env, 'mgr', HOURS, 'm'), exp: Date.now() + HOURS * 3600e3 });
}

export async function onRequestPost({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);
  let body; try { body = await request.json(); } catch { return json({ error: 'bad-json' }, 400); }
  const ip = request.headers.get('cf-connecting-ip') || 'x';
  const rlKey = `rlm:${ip}`;
  const fails = Number(await env.DATA.get(rlKey)) || 0;
  const fail = async (code = 'bad-credentials') => { await env.DATA.put(rlKey, String(fails + 1), { expirationTtl: WINDOW }); return json({ error: code, left: MAX_FAILS - fails - 1 }, 401); };
  const action = body.action || 'pass';

  if (action === 'chal') return json({ challenge: await makeChallenge(env), rp: new URL(request.url).hostname });

  /* تسجيل بصمة جديدة: يلزم رمز مدير صالح (أي بعد الدخول بكلمة المرور) */
  if (action === 'reg' || action === 'rm' || action === 'list') {
    if ((await checkToken(request, env)) !== 'm') return json({ error: 'unauthorized' }, 401);
    const keys = await getKeys(env);
    if (action === 'list') return json({ ids: keys.map((k) => k.id) });
    if (action === 'rm') { await putKeys(env, keys.filter((k) => k.id !== body.id)); await audit(env, request, 'login', 'إزالة بصمة دخول المدير'); return json({ ok: true }); }
    const c = body.cred || {};
    if (!c.id || !c.spki || ![-7, -257].includes(c.alg)) return json({ error: 'bad-cred' }, 400);
    if (!(await checkClient(env, request, c.clientDataJSON, 'webauthn.create'))) return json({ error: 'bad-challenge' }, 400);
    if (keys.length >= 5) return json({ error: 'too-many' }, 400);
    const label = String(body.label || '').replace(/[<>]/g, '').slice(0, 40);
    await putKeys(env, keys.filter((k) => k.id !== c.id).concat({ id: c.id, pk: c.spki, alg: c.alg, label, at: Date.now() }));
    await audit(env, request, 'login', `تفعيل الدخول بالبصمة للمدير${label ? ` (${label})` : ''}`);
    return json({ ok: true });
  }

  if (fails >= MAX_FAILS) return json({ error: 'locked', retryMin: Math.ceil(WINDOW / 60) }, 429);

  /* الدخول بالبصمة */
  if (action === 'auth') {
    const a = body.assertion || {};
    const cred = (await getKeys(env)).find((k) => k.id === a.id);
    if (!cred) return fail('unknown-key');
    try {
      if (!(await checkClient(env, request, a.clientDataJSON, 'webauthn.get'))) return fail('bad-challenge');
      const authData = b64uDec(a.authenticatorData);
      const rpHash = await sha(enc.encode(new URL(request.url).hostname));
      if (authData.length < 37 || rpHash.some((v, i) => v !== authData[i])) return fail();
      if (!(authData[32] & 0x01) || !(authData[32] & 0x04)) return fail();            // حضور المستخدم + تحقق (بصمة/وجه/رمز الجهاز)
      if (!(await verifySig(cred, authData, await sha(b64uDec(a.clientDataJSON)), b64uDec(a.signature)))) return fail();
    } catch { return fail(); }
    if (fails) await env.DATA.delete(rlKey);
    return issue(env, request, 'البصمة');
  }

  /* الدخول بكلمة المرور */
  const user = String(body.user || '').trim(), pass = String(body.pass || '');
  const ok = same(await derive(`${user}:${pass}`), HASH) && user === USER;
  if (!ok) return fail();
  if (fails) await env.DATA.delete(rlKey);
  return issue(env, request, 'كلمة المرور');
}
