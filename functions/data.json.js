/** يخدم /data.json: النسخة المنشورة من لوحة الإدارة (KV) إن كانت أحدث من الملف الثابت في المستودع. */
export async function onRequestGet({ request, env }) {
  const asset = await env.ASSETS.fetch(request);
  if (!env.DATA) return asset;                       // لم يُربط التخزين بعد: نخدم الملف الثابت
  const stored = await env.DATA.get('packet');
  if (!stored) return asset;

  let staticUpdated = '';
  try { staticUpdated = String((await asset.clone().json()).updated || ''); } catch { /* الملف الثابت غير صالح */ }
  let storedUpdated = '';
  try { storedUpdated = String(JSON.parse(stored).updated || ''); } catch { return asset; }

  if (storedUpdated < staticUpdated) return asset;   // رُفع ملف أحدث عبر GitHub
  return new Response(stored, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' } });
}
