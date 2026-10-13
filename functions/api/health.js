/** GET /api/health — فحص صحة النظام (للإدارة): ربط KV، قراءة KV، كاش الحافة، حزمة البيانات، النسخ الاحتياطية، آخر تتبّع.
 *  قراءات فقط (لا كتابة) فلا يستهلك حصة الكتابة. كل فحص: { id, name, ok, ms, note } */
import { authed, json, dayKey, getAgg } from '../_shared.js';

async function timed(fn) {
  const t = Date.now();
  try {
    const r = await fn();
    if (r && typeof r === 'object') return { ok: r.ok !== false, ms: Date.now() - t, note: r.note || '' };   // {ok, note}
    return { ok: r !== false, ms: Date.now() - t, note: typeof r === 'string' ? r : '' };
  }
  catch (e) { return { ok: false, ms: Date.now() - t, note: String(e.message || e).slice(0, 80) }; }
}

export async function onRequestGet({ request, env }) {
  if (!env.DATA) return json({ error: 'not-configured' }, 501);
  if (!(await authed(request, env))) return json({ error: 'unauthorized' }, 401);
  const checks = [];
  const add = async (id, name, fn) => checks.push({ id, name, ...(await timed(fn)) });

  await add('kv', 'قراءة من KV', async () => { await env.DATA.get('pwv'); return 'تعمل'; });
  await add('cache', 'كاش الحافة', async () => {
    const c = globalThis.caches?.default; if (!c) return false;
    const k = new Request(new URL('/__health', request.url).href);
    await c.put(k, new Response('1', { headers: { 'cache-control': 'public, max-age=5' } }));
    return (await c.match(k)) ? 'يعمل' : false;
  });
  await add('packet', 'حزمة البيانات المنشورة', async () => {
    const m = await env.DATA.get('pmeta', 'json');
    if (!m) return 'لا نشر مخزّن في KV (تُخدم نسخة الملف الثابت)';
    const days = Math.floor((Date.now() - new Date(m.updated).getTime()) / 86400e3);
    return `عمرها ${isNaN(days) ? '؟' : days} يوم`;
  });
  await add('backup', 'النسخ الاحتياطية', async () => {
    const log = (await env.DATA.get('blog', 'json')) || [];
    if (!log.length) return 'لا نسخ بعد (تُنشأ تلقائياً مع أول استخدام بعد كل تحديث)';
    return `آخر نسخة قبل ${Math.max(0, Math.floor((Date.now() - log[0].ts) / 3600e3))} ساعة · ${log.length} محفوظة`;
  });
  await add('track', 'تتبّع الاستخدام اليوم', async () => {
    const a = await getAgg(env, dayKey());
    return a ? `${a.s} بحث · ${a.w || 0} كتابة` : 'لا عمليات اليوم بعد';
  });
  await add('auth', 'حماية الإدارة', async () => {
    const h = await env.DATA.get('adminhash');
    return h ? 'كلمة المرور غُيّرت' : { ok: false, note: 'ما زالت كلمة المرور الافتراضية — غيّرها من «الأمان»' };
  });
  return json({ checks, ok: checks.every((c) => c.ok), at: Date.now() });
}
