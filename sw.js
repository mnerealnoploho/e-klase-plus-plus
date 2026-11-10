const cacheName='eklase-plus-v1';
const files=['/','/index.html','/styles.css','/app.js','/core.mjs','/icon.svg','/icon-192.png','/icon-512.png','/apple-touch-icon.png','/manifest.webmanifest','/operations.json'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(files)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('eklase-plus-')&&key!==cacheName).map(key=>caches.delete(key)))));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if (event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||!files.includes(url.pathname)) return;
  event.respondWith(fetch(event.request).then(result=>{if(result.ok&&result.url.startsWith(self.location.origin)&&!result.redirected){const copy=result.clone();event.waitUntil(caches.open(cacheName).then(cache=>cache.put(event.request,copy)));}return result;}).catch(()=>caches.match(event.request).then(result=>result||new Response('Open the app online once to enable offline use.',{status:503}))));
});
