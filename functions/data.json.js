/** يخدم /data.json: النسخة المنشورة من لوحة الإدارة (KV) إن كانت أحدث من الملف الثابت في المستودع.
 *  الحزمة (≈300KB) تُخزَّن في كاش الحافة بمفتاح يحمل رقم الإصدار، فتُقرأ من KV مرة واحدة فقط لكل إصدار في كل منطقة. */
import { getVersion, edgeCached } from './_shared.js';

export async function onRequestGet(ctx) {
  const { request, env } = ctx;
  if (!env.DATA) return env.ASSETS.fetch(request);
  const v = await getVersion(ctx);
  if (!v.stored || v.stored < v.fixed) return env.ASSETS.fetch(request);   // ملف أحدث رُفع عبر GitHub أو لا نسخة منشورة
  const res = await edgeCached(ctx, `/__packet/${encodeURIComponent(v.stored)}`, 86400, async () => {
    const text = await env.DATA.get('packet');
    return text ? new Response(text, { headers: { 'content-type': 'application/json; charset=utf-8' } }) : new Response(null, { status: 404 });
  });
  return res.status === 404 ? env.ASSETS.fetch(request) : res;
}
