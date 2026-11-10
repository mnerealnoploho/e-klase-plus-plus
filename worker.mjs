import { assets } from './assets.mjs';
import { proxy } from './proxy.mjs';

const encoder=new TextEncoder();
const attempts=new Map();

function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
function base64(bytes){let text='';for(const byte of bytes)text+=String.fromCharCode(byte);return btoa(text).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
function cookieName(url){return url.protocol==='https:'?'__Host-ek_access':'ek_access';}
function constantEqual(first,second){if(typeof first!=='string'||typeof second!=='string'||first.length!==second.length)return false;let result=0;for(let index=0;index<first.length;index+=1)result|=first.charCodeAt(index)^second.charCodeAt(index);return result===0;}

export async function passwordHash(password){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode('e-klase-plus-plus:'+password)));return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');}
async function signature(value,secret){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return base64(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value))));}
export async function accessCookie(secret,expires=Date.now()+7*86400000){const value=expires+'.'+crypto.randomUUID();return value+'.'+await signature(value,secret);}
export async function hasAccess(request,env){
  if(typeof env.SESSION_KEY!=='string'||env.SESSION_KEY.length<40)return false;
  const name=cookieName(new URL(request.url))+'=';
  const cookie=(request.headers.get('cookie')||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(name))?.slice(name.length);
  if(!cookie||cookie.length>500)return false;
  const [expires,nonce,mac]=cookie.split('.');
  const time=Number(expires);
  return Number.isFinite(time)&&time>Date.now()&&time<Date.now()+8*86400000&&!!nonce&&constantEqual(mac,await signature(expires+'.'+nonce,env.SESSION_KEY));
}

function safeReturn(value){return typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')&&!/[\r\n\\]/.test(value)?value:'/home';}
function escape(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');}
function gate(error='',returnTo='/home',status=200){
  const body='<!doctype html><html lang="lv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#4f79e8"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><title>E-klase++ · Testa pieeja</title><style>*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:#f7f8fc;font:16px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#2d3044}.card{width:min(420px,100%);background:white;padding:34px;border-radius:24px;box-shadow:0 12px 55px #303b6710;border:1px solid #edf0f7}.logo{font-size:30px;letter-spacing:-1px;color:#4f79e8;margin-bottom:26px}.logo span{font-size:20px}h1{font-size:23px;line-height:1.3;margin:0 0 10px}p{font-size:14px;color:#6d7182;margin:0 0 22px}label{display:block;font-size:14px;font-weight:600;margin-bottom:8px}input{width:100%;padding:14px;border:1px solid #dce1ee;border-radius:12px;font:inherit;min-height:48px}input:focus{outline:2px solid #4f79e8;outline-offset:2px}button{width:100%;border:0;border-radius:24px;background:#4f79e8;color:white;padding:14px;font:600 15px -apple-system,sans-serif;margin-top:18px;cursor:pointer}.error{color:#b33445;background:#fff2f3;padding:12px;border-radius:10px;font-size:13px;margin-bottom:18px}.note{font-size:12px;line-height:1.6;margin-top:22px;margin-bottom:0}a{color:#4f79e8}</style></head><body><main class="card"><div class="logo">e-klase<span>++</span></div><h1>Testa pieeja</h1><p>Ievadi šīs testa vietnes paroli. Pēc tam varēsi pieslēgties E-klasei ierastajā skatā.</p>'+(error?'<div class="error" role="alert">'+escape(error)+'</div>':'')+'<form method="post" action="/++/unlock"><input type="hidden" name="returnTo" value="'+escape(safeReturn(returnTo))+'"><label for="password">Testa vietnes parole</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="200"><button type="submit">Atvērt E-klase++</button></form><p class="note">Šī ir testa vietnes parole, nevis tava E-klases parole. Pievienošana sākuma ekrānam: Safari → Kopīgot → Pievienot sākuma ekrānam.</p></main></body></html>';
  return new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'self'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",'x-content-type-options':'nosniff','referrer-policy':'same-origin'}});
}

function assetResponse(asset,path){return new Response(asset.binary?Uint8Array.from(atob(asset.body),value=>value.charCodeAt(0)):asset.body,{headers:{'content-type':asset.type,'cache-control':path.endsWith('sw.js')?'no-cache':'private, no-cache','x-content-type-options':'nosniff',...(path.endsWith('sw.js')?{'service-worker-allowed':'/'}:{})}});}

async function route(request,env,context){
  const url=new URL(request.url);
  const path=url.pathname;
  if(['/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png','/apple-touch-icon.png','/sw.js'].includes(path))return assetResponse(assets[path],path);
  if(!/^[a-f\d]{64}$/.test(env.APP_PASSWORD_HASH||'')||typeof env.SESSION_KEY!=='string'||env.SESSION_KEY.length<40)return gate('Testa servera parole vēl nav konfigurēta.','/home',503);
  if(!['GET','HEAD','OPTIONS'].includes(request.method)){
    const origin=request.headers.get('origin');
    const fetchSite=request.headers.get('sec-fetch-site');
    const opaqueSameOrigin=origin==='null'&&fetchSite==='same-origin';
    if(origin&&origin!==url.origin&&!opaqueSameOrigin||fetchSite==='cross-site')return json({error:'The request origin is not allowed.'},403);
  }
  if(path==='/++/unlock'&&request.method==='POST'){
    const key=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')||'local';
    const now=Date.now(),recent=(attempts.get(key)||[]).filter(time=>now-time<60000);
    if(recent.length>=8)return gate('Pārāk daudz mēģinājumu. Uzgaidi vienu minūti.','/home',429);
    if(attempts.size>1000)attempts.clear();attempts.set(key,[...recent,now]);
    const raw=await request.text();if(raw.length>2000)return gate('Nederīgs pieprasījums.','/home',413);
    const form=new URLSearchParams(raw),password=form.get('password')||'';
    const returnTo=safeReturn(form.get('returnTo'));
    if(password.length>200||!constantEqual(await passwordHash(password),env.APP_PASSWORD_HASH))return gate('Nepareiza testa vietnes parole.',returnTo,401);
    attempts.delete(key);
    const cookie=await accessCookie(env.SESSION_KEY);
    return new Response(null,{status:303,headers:{location:returnTo,'set-cookie':cookieName(url)+'='+cookie+'; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800'+(url.protocol==='https:'?'; Secure':''),'cache-control':'no-store'}});
  }
  const allowed=await hasAccess(request,env);
  if(path==='/++/status')return json({authenticated:allowed});
  if(!allowed){
    if(/json/.test(request.headers.get('accept')||'')||request.headers.get('sec-fetch-dest')==='empty'&&path.startsWith('/api/'))return json({error:'Unlock the test site first.',unlock:'/'},401);
    return gate('',path+url.search,200);
  }
  if(path==='/++/lock')return new Response(null,{status:303,headers:{location:'/','set-cookie':cookieName(url)+'=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'+(url.protocol==='https:'?'; Secure':''),'cache-control':'no-store'}});
  if(path==='/++/api/session')return json({connected:false,configured:true});
  if(path.startsWith('/++/api/'))return json({error:'Use E-klase pages for live account actions.'},410);
  if(path.startsWith('/++/')){
    const file=path==='/++/'?'/index.html':path.slice(3);
    const asset=assets[file];
    return asset?assetResponse(asset,file):new Response('Not found',{status:404});
  }
  return proxy(request,{fetch:env.FETCH});
}

export default {async fetch(request,env={},context={}){
  try{return await route(request,env,context);}
  catch{return new Response('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui;padding:28px"><h1>E-klase could not be reached</h1><p>The test host could not complete this request. Your account details have not been logged.</p><p><a href="/home">Try again</a> · <a href="/++/">Open personal tools</a> · <a href="https://family.e-klase.lv/">Official E-klase</a></p></body></html>',{status:502,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});}
}};
