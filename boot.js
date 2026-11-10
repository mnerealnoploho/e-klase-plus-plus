(function(){
  const kind=document.currentScript?.dataset.upstream||'family';
  const origin=location.origin;
  const family='https://family.e-klase.lv';
  const auth='https://auth.e-klase.lv';
  function local(value){
    const url=new URL(value,document.baseURI);
    if(url.origin===family)return origin+url.pathname+url.search+url.hash;
    if(url.origin===auth)return origin+'/_auth'+url.pathname+url.search+url.hash;
    if(kind==='auth'&&url.origin===origin&&!url.pathname.startsWith('/_auth/')&&!url.pathname.startsWith('/++/'))return origin+'/_auth'+url.pathname+url.search+url.hash;
    return url.href;
  }
  const fetchOriginal=window.fetch.bind(window);
  window.fetch=function(input,options){const value=input instanceof Request?new Request(local(input.url),input):local(input instanceof URL?input.href:String(input));return fetchOriginal(value,options);};
  const open=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url,...rest){return open.call(this,method,local(url),...rest);};
  const cookie=Object.getOwnPropertyDescriptor(Document.prototype,'cookie');
  const prefix='ekp_'+kind+'_';
  if(cookie?.get&&cookie?.set)Object.defineProperty(document,'cookie',{configurable:true,get(){return cookie.get.call(document).split(';').map(value=>value.trim()).filter(value=>value.startsWith(prefix)).map(value=>value.slice(prefix.length)).join('; ');},set(value){const parts=String(value).split(';'),index=parts[0].indexOf('=');if(index<1)return;parts[0]=prefix+parts[0];const filtered=parts.filter((part,index)=>index===0||!/^\s*(domain|path)\s*=/i.test(part));filtered.push('Path=/');cookie.set.call(document,filtered.join('; '));}});
  if(kind==='family'){
    if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
    if('caches'in window)caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('eklase-plus-')&&!key.startsWith('eklase-plus-tools-')).map(key=>caches.delete(key)))).catch(()=>{});
  }
}());
