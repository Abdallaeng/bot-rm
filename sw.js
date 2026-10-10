const V='botrm-v1';
const SHELL=['./','index.html','style.css','app.js','core.js','config.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);if(u.origin!==location.origin)return; // لا نتدخل في العدّاد/GitHub/الخطوط
  const fresh=/data\.json$|config\.js$|app\.js$|core\.js$|style\.css$|index\.html$|\/$/.test(u.pathname);
  if(fresh){ // الشبكة أولاً ثم الكاش (حتى يصل التحديث فوراً)
    e.respondWith(fetch(r,{cache:'no-cache'}).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));return res}).catch(()=>caches.match(r,{ignoreSearch:true})));
  }else{
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));return res})));
  }
});
