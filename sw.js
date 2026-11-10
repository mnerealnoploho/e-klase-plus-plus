const cacheName='eklase-plus-tools-v2';
const tools=['/++/','/++/index.html','/++/styles.css','/++/app.js','/++/core.mjs','/++/operations.json'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(tools)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('eklase-plus-')&&key!==cacheName).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/_auth/')||url.pathname.startsWith('/++/unlock')||url.pathname.startsWith('/++/api/'))return;
  if(tools.includes(url.pathname)){
    event.respondWith(fetch(event.request).then(result=>{if(result.ok&&!result.redirected&&result.headers.get('content-type')?.includes(url.pathname.endsWith('.js')||url.pathname.endsWith('.mjs')?'javascript':url.pathname.endsWith('.css')?'text/css':url.pathname.endsWith('.json')?'json':'text/html')){const copy=result.clone();event.waitUntil(caches.open(cacheName).then(cache=>cache.put(event.request,copy)));}return result;}).catch(()=>caches.match(event.request).then(result=>result||Response.error())));
  }else if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match('/++/').then(result=>result||new Response('Connect to the internet to load E-klase. Personal tools become available offline after their first visit.',{status:503}))));
});
