/** يخدم /data.json: النسخة المنشورة من لوحة الإدارة (KV) إن كانت أحدث من الملف الثابت في المستودع.
 *  الحزمة (≈300KB) تُخزَّن في كاش الحافة بمفتاح يحمل رقم الإصدار، فتُقرأ من KV مرة واحدة فقط لكل إصدار في كل منطقة،
 *  وطلبات لحظة النشر المتزامنة تُدمج في قراءة واحدة (memo يخزّن الوعد). */
import { getVersion, edgeCached, memo, purgeEdge } from './_shared.js';

export async function onRequestGet(ctx) {
  const { request, env } = ctx;
  if (!env.DATA) return env.ASSETS.fetch(request);
  let v = await getVersion(ctx);
  // الجهاز يعرف أن هناك إصداراً أحدث (من /api/sync في منطقة أخرى) وكاش هذه المنطقة متأخر: نعيد الحساب فوراً
  const want = new URL(request.url).searchParams.get('v') || '';
  if (want && want > v.stored && want > v.fixed) { await purgeEdge(request, ['/__ver']); v = await getVersion(ctx); }
  if (!v.stored || v.stored < v.fixed) return env.ASSETS.fetch(request);   // ملف أحدث رُفع عبر GitHub أو لا نسخة منشورة
  const res = await edgeCached(ctx, `/__packet/${encodeURIComponent(v.stored)}`, 86400, async () => {
    const text = await memo(`pk:${v.stored}`, 600, () => env.DATA.get('packet'));
    return text ? new Response(text, { headers: { 'content-type': 'application/json; charset=utf-8' } }) : new Response(null, { status: 404 });
  });
  return res.status === 404 ? env.ASSETS.fetch(request) : res;
}
