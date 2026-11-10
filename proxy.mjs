const hosts={family:'family.e-klase.lv',auth:'auth.e-klase.lv'};

export function targetFor(requestUrl) {
  const source=new URL(requestUrl);
  const auth=source.pathname.startsWith('/_auth/');
  const path=auth?source.pathname.slice(6):source.pathname;
  const target=new URL('https://'+hosts[auth?'auth':'family']);
  target.pathname=path;target.search=source.search;
  return {target,kind:auth?'auth':'family',source};
}

export function toLocal(value,origin) {
  if(typeof value!=='string')return value;
  let result=value.replaceAll('https://family.e-klase.lv',origin).replaceAll('https://auth.e-klase.lv',origin+'/_auth');
  result=result.replaceAll('//family.e-klase.lv',origin).replaceAll('//auth.e-klase.lv',origin+'/_auth');
  result=result.replaceAll('https:\\/\\/family.e-klase.lv',origin.replaceAll('/','\\/')).replaceAll('https:\\/\\/auth.e-klase.lv',(origin+'/_auth').replaceAll('/','\\/'));
  return result;
}

export function toUpstream(value,origin) {
  if(typeof value!=='string')return value;
  let result=value.replaceAll(origin+'/_auth','https://auth.e-klase.lv').replaceAll(origin,'https://family.e-klase.lv');
  let local=origin,remote='https://family.e-klase.lv';
  for(let level=0;level<2;level+=1){local=encodeURIComponent(local);remote=encodeURIComponent(remote);result=result.replaceAll(local,remote);}
  return result;
}

export function localCookie(cookie,kind) {
  const parts=cookie.split(';'),separator=parts[0].indexOf('=');
  if(separator<1)return null;
  const name=parts[0].slice(0,separator).trim();
  const result=['ekp_'+kind+'_'+name+'='+parts[0].slice(separator+1)];
  for(const part of parts.slice(1))if(!/^\s*(domain|path)\s*=/i.test(part))result.push(part.trim());
  result.push('Path=/');
  return result.join('; ');
}

export function upstreamCookies(value,kind) {
  const prefix='ekp_'+kind+'_';
  return (value||'').split(';').map(part=>part.trim()).filter(part=>part.startsWith(prefix)).map(part=>part.slice(prefix.length)).join('; ');
}

export function rewriteText(text,kind,origin,type) {
  let result=toLocal(text,origin);
  if(kind==='auth'&&/(javascript|ecmascript)/i.test(type))result=result.replace(/(["'`])\/(?!\/|_auth\/)([a-zA-Z][\w./-]*(?:[?#][^"'`\s]*)?)\1/g,(_,quote,path)=>quote+'/_auth/'+path+quote);
  if(kind==='auth'&&/json/i.test(type)){
    try{
      const data=JSON.parse(result);
      const original=JSON.parse(text);
      for(const key of ['issuer','iss'])if(typeof original[key]==='string')data[key]=original[key];
      const visit=value=>{if(Array.isArray(value))return value.map(visit);if(value&&typeof value==='object'){for(const key of Object.keys(value)){if(typeof value[key]==='string'&&/url|uri|location|redirect|return|callback/i.test(key)&&value[key].startsWith('/')&&!value[key].startsWith('//')&&!value[key].startsWith('/_auth/'))value[key]='/_auth'+value[key];else value[key]=visit(value[key]);}}return value;};
      result=JSON.stringify(visit(data));
    }catch{}
  }
  if(/text\/css/i.test(type)&&kind==='auth')result=result.replace(/url\(\s*(["']?)\/(?!\/|_auth\/)/g,(_,quote)=>'url('+quote+'/_auth/');
  return result;
}

export function rewriteHtml(text,kind,origin,nonce) {
  let result=rewriteText(text,kind,origin,'text/html');
  if(kind==='auth')result=result.replace(/\b(src|href|action|poster)\s*=\s*(["'])\/(?!\/|_auth\/)/gi,(_,name,quote)=>name+'='+quote+'/_auth/');
  result=result.replace(/\sintegrity\s*=\s*(["']).*?\1/gi,'');
  const insertion='<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="apple-mobile-web-app-capable" content="yes"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="stylesheet" href="/++/page.css"><script nonce="'+nonce+'" src="/++/boot.js" data-upstream="'+kind+'"></script>';
  if(/<head\b[^>]*>/i.test(result))result=result.replace(/<head\b[^>]*>/i,match=>match+insertion);
  else result=insertion+result;
  if(kind==='family')result=result.replace(/<\/body>/i,'<script nonce="'+nonce+'" src="/++/enhance.js" defer></script></body>');
  return result;
}

export async function proxy(request,options={}) {
  const {target,kind,source}=targetFor(request.url);
  for(const key of ['redirect_uri','returnUrl','return_uri','post_logout_redirect_uri'])if(target.searchParams.has(key))target.searchParams.set(key,toUpstream(target.searchParams.get(key),source.origin));
  const headers=new Headers();
  for(const key of ['accept','accept-language','user-agent','content-type','range','if-none-match','if-modified-since','authorization','x-requested-with','x-profile-id','x-class-id'])if(request.headers.has(key))headers.set(key,request.headers.get(key));
  const cookies=upstreamCookies(request.headers.get('cookie'),kind);if(cookies)headers.set('cookie',cookies);
  if(request.headers.has('origin'))headers.set('origin',request.headers.has('referer')?new URL(toUpstream(request.headers.get('referer'),source.origin)).origin:target.origin);
  if(request.headers.has('referer'))headers.set('referer',toUpstream(request.headers.get('referer'),source.origin));
  let body;
  if(!['GET','HEAD'].includes(request.method)) {
    body=await request.arrayBuffer();
    if(body.byteLength>25_000_000)return new Response('The upload exceeds the test server limit.',{status:413});
    const content=headers.get('content-type')||'';
    if(kind==='auth'&&content.includes('application/x-www-form-urlencoded')) {
      const fields=new URLSearchParams(new TextDecoder().decode(body));
      for(const [key,value]of fields)if(/redirect|return|callback/i.test(key))fields.set(key,toUpstream(value,source.origin));
      body=fields.toString();
    } else if(kind==='auth'&&content.includes('application/json')) {
      try {
        const value=JSON.parse(new TextDecoder().decode(body));
        for(const key of Object.keys(value))if(/redirect|return|callback/i.test(key)&&typeof value[key]==='string')value[key]=toUpstream(value[key],source.origin);
        body=JSON.stringify(value);
      }catch{}
    }
  }
  const result=await(options.fetch||fetch)(target,{method:request.method,headers,body,redirect:'manual',signal:AbortSignal.timeout(30000)});
  const output=new Headers(result.headers);
  output.delete('content-length');output.delete('set-cookie');output.delete('clear-site-data');
  output.set('referrer-policy','same-origin');output.set('x-content-type-options','nosniff');
  const setCookies=typeof result.headers.getSetCookie==='function'?result.headers.getSetCookie():[];
  for(const cookie of setCookies){const translated=localCookie(cookie,kind);if(translated)output.append('set-cookie',translated);}
  const location=result.headers.get('location');
  if(location)output.set('location',toLocal(new URL(location,target).href,source.origin));
  const type=result.headers.get('content-type')||'';
  output.set('cache-control',/(javascript|text\/css|image\/|font\/)/i.test(type)?'private, max-age=1800':'no-store');
  if(request.method==='HEAD'||[204,304].includes(result.status))return new Response(null,{status:result.status,headers:output});
  if(result.headers.get('cf-mitigated')==='challenge')return new Response('E-klase requires verification that this test host cannot complete. Open the official site.',{status:502,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  if(/(text\/html|javascript|ecmascript|text\/css|application\/json|manifest\+json)/i.test(type)) {
    output.delete('content-encoding');
    const original=await result.text();
    if(original.length>15_000_000)return new Response('This resource exceeds the test host limit.',{status:502});
    const nonce=crypto.randomUUID().replaceAll('-','');
    let policy=output.get('content-security-policy');
    if(policy){policy=policy.replaceAll('https://auth.e-klase.lv',source.origin).replaceAll('https://family.e-klase.lv',source.origin);policy=policy.replace(/script-src([^;]*)/g,(_,values)=>"script-src"+values+" 'nonce-"+nonce+"'");output.set('content-security-policy',policy);}
    const changed=/text\/html/i.test(type)?rewriteHtml(original,kind,source.origin,nonce):rewriteText(original,kind,source.origin,type);
    return new Response(changed,{status:result.status,headers:output});
  }
  return new Response(result.body,{status:result.status,headers:output});
}
