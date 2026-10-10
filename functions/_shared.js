/** أدوات مشتركة لدوال Cloudflare Pages */
export const ADMIN_HASH = '47772dfefd02ba53e544691dfc9ac1f62148991ff2b4573d5109e6b8bd0508d7';

export const sha256 = async (text) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('');

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
