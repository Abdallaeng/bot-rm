/** جلسة المدير والدخول: كلمة المرور أول مرة فقط، ثم بصمة الجهاز (WebAuthn) عبر /api/mgr. */
import { $, esc } from '../lib/dom.js';

const TOKEN_KEY = 'brm_mgr', PK_KEY = 'brm_mgr_pk';

export const readTok = () => { try { const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY) || 'null'); return t && t.exp > Date.now() ? t : null; } catch { return null; } };
const saveTok = (t) => { try { sessionStorage.setItem(TOKEN_KEY, JSON.stringify(t)); } catch { /* */ } };
export const clearTok = () => { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* */ } };
export const pkId = () => { try { return localStorage.getItem(PK_KEY) || ''; } catch { return ''; } };
export const setPk = (id) => { try { id ? localStorage.setItem(PK_KEY, id) : localStorage.removeItem(PK_KEY); } catch { /* */ } };
const bearer = () => ({ 'content-type': 'application/json', authorization: `Bearer ${readTok()?.token || ''}` });
const post = (body, headers = { 'content-type': 'application/json' }) => fetch('/api/mgr', { method: 'POST', headers, body: JSON.stringify(body) });

export async function tokenValid(t) {
  try { const r = await fetch('/api/mgr', { headers: { authorization: `Bearer ${t.token}` }, cache: 'no-store' }); return r.ok ? (await r.json()).ok === true : false; }
  catch { return true; }                    // بلا اتصال: نكمل بالرمز المحلي (البيانات محفوظة على الجهاز)
}

/* ---------------- البصمة (WebAuthn) ---------------- */
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
export const passkeySupported = () => Boolean(window.PublicKeyCredential && navigator.credentials);
const challenge = async () => (await (await post({ action: 'chal' })).json()).challenge;

async function passkeyLogin() {
  const ch = await challenge(), id = pkId();
  const cred = await navigator.credentials.get({ publicKey: { challenge: new TextEncoder().encode(ch), rpId: location.hostname, userVerification: 'required', timeout: 60000, allowCredentials: id ? [{ type: 'public-key', id: unb64u(id) }] : [] } });
  const a = cred.response;
  const r = await post({ action: 'auth', assertion: { id: cred.id, clientDataJSON: b64u(a.clientDataJSON), authenticatorData: b64u(a.authenticatorData), signature: b64u(a.signature) } });
  return { r, j: await r.json().catch(() => ({})), id: cred.id };
}

export async function passkeyRegister() {
  const ch = await challenge();
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: new TextEncoder().encode(ch), rp: { name: 'Bot Rm', id: location.hostname },
    user: { id: new TextEncoder().encode('manager-omar'), name: 'عمر', displayName: 'المدير عمر' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' }, attestation: 'none', timeout: 60000 } });
  const a = cred.response, ua = navigator.userAgent;
  const label = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'جهاز';
  const r = await post({ action: 'reg', label, cred: { id: cred.id, spki: b64u(a.getPublicKey()), alg: a.getPublicKeyAlgorithm(), clientDataJSON: b64u(a.clientDataJSON) } }, bearer());
  if (!r.ok) throw new Error('reg');
  setPk(cred.id);
}
export async function passkeyRemove() { try { await post({ action: 'rm', id: pkId() }, bearer()); } catch { /* */ } setPk(''); }

/* ---------------- شاشة الدخول ---------------- */
/** onOk(fresh): تُستدعى بعد حفظ الرمز؛ fresh=true عند الدخول بكلمة المرور (لعرض دعوة تفعيل البصمة) */
export function showLogin(root, onOk, msg = '', tryPasskey = true) {
  const hasPk = passkeySupported() && pkId();
  root.innerHTML = `<div class="mg-login"><div class="mg-lcard">
    <img src="icons/seal.png" alt="" width="68" height="68">
    <h1>لوحة المدير</h1><p>شركة ربوع المعالي — مراقبة الشبكة وتقارير الاجتماعات</p>
    ${hasPk ? `<button class="mg-fp" type="button" id="fp"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M12 11v3.5a5.5 5.5 0 0 1-1.3 3.5M8 10.5a4 4 0 0 1 8 0V14c0 1.7-.4 3.3-1.2 4.7M5 11a7 7 0 0 1 14 0v1.5c0 2.6-.5 5-1.5 7M5 14.5c0 1.3-.2 2.5-.6 3.6M12 3v0"/></svg><span>الدخول بالبصمة</span></button>
    <button class="mg-lnk" type="button" id="usePw">استخدم كلمة المرور</button>` : ''}
    <form id="lf"${hasPk ? ' hidden' : ''}><input class="inp" id="lu" autocomplete="username" placeholder="اسم الدخول" required>
    <input class="inp" id="lp" type="password" autocomplete="current-password" placeholder="كلمة المرور" required>
    <button class="btn pri" style="width:100%;height:46px">دخول</button></form>
    <div class="err" id="le" role="alert">${esc(msg)}</div>
    ${hasPk ? '' : '<small class="mg-hint">بعد أول دخول تستطيع تفعيل البصمة فلا تحتاج كلمة المرور بعدها.</small>'}
    <a class="mg-lnk" href="index.html">← العودة إلى التطبيق</a></div></div>`;
  const err = (t) => { $('#le').textContent = t; };
  const lockMsg = (j) => `تم القفل مؤقتاً بسبب محاولات كثيرة. أعد المحاولة بعد ${j.retryMin || 15} دقيقة.`;

  const byPasskey = async () => {
    const b = $('#fp'); b.disabled = true; err('');
    try {
      const { r, j, id } = await passkeyLogin();
      if (r.ok && j.token) { setPk(id); saveTok({ token: j.token, exp: j.exp }); return onOk(false); }
      err(r.status === 429 ? lockMsg(j) : j.error === 'unknown-key' ? 'هذه البصمة لم تعد مسجّلة. ادخل بكلمة المرور وفعّلها من جديد.' : 'تعذّر التحقق من البصمة.');
      if (j.error === 'unknown-key') setPk('');
    } catch (e) { err(e?.name === 'NotAllowedError' ? 'أُلغي طلب البصمة. اضغط الزر للمحاولة من جديد، أو استخدم كلمة المرور.' : 'تعذّر استخدام البصمة على هذا الجهاز.'); }
    b.disabled = false;
  };
  if (hasPk) {
    $('#fp').onclick = byPasskey;
    $('#usePw').onclick = () => { $('#lf').hidden = false; $('#usePw').hidden = true; $('#lu').focus(); };
    if (tryPasskey) byPasskey();
  } else $('#lu').focus();

  $('#lf').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.submitter; btn.disabled = true; err('');
    try {
      const r = await post({ user: $('#lu').value, pass: $('#lp').value });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.token) { saveTok({ token: j.token, exp: j.exp }); return onOk(true); }
      err(r.status === 429 ? lockMsg(j) : r.status === 501 ? 'الخادم غير مهيّأ بعد.' : `بيانات الدخول غير صحيحة${j.left != null ? ` (متبقٍّ ${j.left} محاولات)` : ''}.`);
    } catch { err('تعذّر الاتصال بالخادم.'); }
    btn.disabled = false; $('#lp').select();
  };
}
