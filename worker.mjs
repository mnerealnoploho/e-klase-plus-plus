import { assets, operations } from './assets.mjs';

const encoder=new TextEncoder();
const decoder=new TextDecoder();
const limits=new Map();

function response(data,status=200,headers={}) {
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
}

function trusted(value) {
  const url=new URL(value);
  if (url.protocol!=='https:'||!['auth.e-klase.lv','family.e-klase.lv'].includes(url.hostname)||url.username||url.password) throw Error('Invalid upstream destination.');
  return url;
}

async function upstream(url,options={}) {
  trusted(url);
  return fetch(url,{...options,redirect:'manual',signal:AbortSignal.timeout(20000)});
}

function encode(bytes) { let value=''; for (const byte of bytes) value+=String.fromCharCode(byte); return btoa(value).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''); }
function decode(value) { return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),char=>char.charCodeAt(0)); }

async function sessionKey(secret) {
  if (typeof secret!=='string'||secret.length<40) throw Error('The server session key is not configured.');
  return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode(secret)),{name:'AES-GCM'},false,['encrypt','decrypt']);
}

async function seal(data,secret,owner) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(owner)},await sessionKey(secret),encoder.encode(JSON.stringify(data)));
  return encode(iv)+'.'+encode(new Uint8Array(encrypted));
}

async function session(request,env,owner) {
  try {
    const cookie=request.headers.get('cookie')?.split(';').map(value=>value.trim()).find(value=>value.startsWith('__Host-ek_session='))?.slice(18);
    if (!cookie||cookie.length>15000) return null;
    const [nonce,sealed]=cookie.split('.');
    const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(nonce),additionalData:encoder.encode(owner)},await sessionKey(env.SESSION_KEY),decode(sealed));
    const value=JSON.parse(decoder.decode(data));
    return value.expires>Date.now()&&typeof value.accessToken==='string' ? value : null;
  } catch { return null; }
}

async function discovery() {
  const config=await upstream('https://family.e-klase.lv/api/auth-config');
  if (!config.ok) throw Error('E-klase authentication configuration is unavailable.');
  const {oidcDiscoveryUrl}=await config.json();
  trusted(oidcDiscoveryUrl);
  const result=await upstream(oidcDiscoveryUrl);
  if (!result.ok) throw Error('E-klase authentication discovery is unavailable.');
  const data=await result.json();
  for (const key of ['authorization_endpoint','token_endpoint']) if (trusted(data[key]).hostname!=='auth.e-klase.lv') throw Error('Unexpected authentication server.');
  return data;
}

function attributes(html) {
  const values={};
  for (const match of html.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) values[match[1].toLowerCase()]=(match[2]??match[3]??match[4]).replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'");
  return values;
}

async function login(credentials) {
  const config=await discovery();
  const verifier=encode(crypto.getRandomValues(new Uint8Array(32)));
  const state=encode(crypto.getRandomValues(new Uint8Array(32)));
  const challenge=encode(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(verifier))));
  const callback='https://family.e-klase.lv/';
  let url=new URL(config.authorization_endpoint);
  url.search=new URLSearchParams({client_id:'web',redirect_uri:callback,response_type:'code',scope:'openid offline_access',state,code_challenge:challenge,code_challenge_method:'S256',ui_locales:'lv'}).toString();
  const cookies=new Map();
  let method='GET',body,submitted=false;
  for (let step=0;step<12;step+=1) {
    if (url.origin==='https://family.e-klase.lv'&&url.pathname==='/') {
      if (url.searchParams.get('state')!==state||!url.searchParams.get('code')) throw Error('Authentication callback validation failed.');
      const token=await upstream(config.token_endpoint,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code:url.searchParams.get('code'),code_verifier:verifier,client_id:'web',redirect_uri:callback})});
      if (!token.ok) throw Error('E-klase did not complete the session exchange.');
      const result=await token.json();
      if (typeof result.access_token!=='string') throw Error('E-klase did not issue a session.');
      return {accessToken:result.access_token,expires:Date.now()+Math.min(12*3600,Number(result.expires_in)||3600)*1000};
    }
    if (url.origin!=='https://auth.e-klase.lv') throw Error('The login requires an unsupported interactive step.');
    const result=await upstream(url,{method,body,headers:{Accept:'text/html',...(body?{'Content-Type':'application/x-www-form-urlencoded',Origin:url.origin}:{}),Cookie:[...cookies].map(([name,value])=>name+'='+value).join('; ')}});
    const entries=typeof result.headers.getSetCookie==='function'?result.headers.getSetCookie():[];
    for (const cookie of entries) { const part=cookie.split(';')[0],index=part.indexOf('='); if (index>0) cookies.set(part.slice(0,index),part.slice(index+1)); }
    const location=result.headers.get('location');
    if ([301,302,303,307,308].includes(result.status)&&location) {
      url=trusted(new URL(location,url));
      if ([301,302,303].includes(result.status)) { method='GET'; body=undefined; }
      continue;
    }
    if (result.status===429) throw Error('E-klase is limiting login requests. Wait before trying again.');
    if (!result.ok) throw Error('E-klase could not complete sign-in.');
    const html=await result.text();
    if (/cf-chl-|g-recaptcha|h-captcha|challenges\.cloudflare/.test(html)||result.headers.get('cf-mitigated')==='challenge') throw Error('E-klase requires interactive verification. This connection does not bypass it.');
    if (submitted&&/const\s+isAuthSuccessful\s*=\s*true\s*;/.test(html)&&html.includes('/realms/family/protocol/openid-connect/authenticate-forward')) {
      url=new URL('/realms/family/protocol/openid-connect/authenticate-forward',url);method='GET';body=undefined;continue;
    }
    if (submitted) throw Error('E-klase did not confirm sign-in. Check your details or use the official site.');
    const forms=[...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)].filter(match=>/<input[^>]*name\s*=\s*["']password["']/i.test(match[2]));
    if (forms.length!==1) throw Error('The current E-klase login needs an interactive browser flow that this connector does not yet support. Your password has not been sent to E-klase.');
    const form=attributes(forms[0][1]);
    if (form.method?.toLowerCase()!=='post'||!form.action) throw Error('The current E-klase login form is not supported. Your password has not been sent to E-klase.');
    url=trusted(new URL(form.action,url));
    if (url.origin!=='https://auth.e-klase.lv') throw Error('Unexpected login destination.');
    body=new URLSearchParams();
    for (const input of forms[0][2].matchAll(/<input\b([^>]*)>/gi)) { const attrs=attributes(input[1]); if (attrs.type==='hidden'&&attrs.name) body.set(attrs.name,attrs.value??''); }
    body.set('username',credentials.username);body.set('password',credentials.password);
    method='POST';submitted=true;
  }
  throw Error('The login exceeded the supported number of steps.');
}

async function route(request,env) {
  const url=new URL(request.url);
  if (!url.pathname.startsWith('/api/')) {
    const path=url.pathname==='/'?'/index.html':url.pathname;
    const asset=assets[path];
    if (!asset) return new Response('Not found',{status:404});
    return new Response(asset.binary?Uint8Array.from(atob(asset.body),value=>value.charCodeAt(0)):asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':path==='/sw.js'?'no-cache':'private, no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",...(path==='/sw.js'?{'Service-Worker-Allowed':'/'}:{})}});
  }
  const owner=request.headers.get('oai-authenticated-user-id')||env.LOCAL_OWNER;
  if (!owner) return response({error:'Sign in to this private app with ChatGPT first.'},401);
  if (request.method==='POST'&&(request.headers.get('origin')!==url.origin||request.headers.get('content-type')?.split(';')[0]!=='application/json')) return response({error:'Invalid request origin or content type.'},403);
  if (Number(request.headers.get('content-length')||0)>20000) return response({error:'Request is too large.'},413);
  if (url.pathname==='/api/session'&&request.method==='GET') return response({connected:!!await session(request,env,owner),configured:!!env.SESSION_KEY});
  if (url.pathname==='/api/logout'&&request.method==='POST') return response({ok:true},200,{'Set-Cookie':'__Host-ek_session=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0'});
  if (url.pathname==='/api/login'&&request.method==='POST') {
    const now=Date.now(),recent=(limits.get(owner)||[]).filter(time=>now-time<60000);
    if (recent.length>=4) return response({error:'Wait a minute before trying again.'},429);
    if (limits.size>1000) limits.clear();
    limits.set(owner,[...recent,now]);
    const raw=await request.text();if(raw.length>10000)return response({error:'Request is too large.'},413);
    const body=JSON.parse(raw);
    if (typeof body.username!=='string'||typeof body.password!=='string'||!body.username||!body.password||body.username.length>200||body.password.length>1024) return response({error:'Enter a valid username and password.'},400);
    try {
      await sessionKey(env.SESSION_KEY);
      const value=await login(body);
      const cookie=await seal(value,env.SESSION_KEY,owner);
      if (cookie.length>3800) return response({error:'The E-klase session is too large for secure cookie storage.'},502);
      return response({connected:true},200,{'Set-Cookie':'__Host-ek_session='+cookie+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+Math.max(0,Math.floor((value.expires-Date.now())/1000))});
    } catch(error) { return response({error:error.message||'Sign-in failed.'},422); }
  }
  if (url.pathname==='/api/read'&&request.method==='POST') {
    const current=await session(request,env,owner);
    if (!current) return response({error:'Connect your E-klase account again to load live data.'},401);
    const input=await request.json(),operation=Object.hasOwn(operations,input.operation)?operations[input.operation]:null;
    if (!operation||input.operation==='auth.config') return response({error:'Unsupported operation.'},400);
    let path=operation.path;
    for (const parameter of path.matchAll(/\{([^}]+)\}/g)) {
      const value=String(input.params?.[parameter[1]]??'');
      if (!/^[\w-]{1,100}$/.test(value)) return response({error:'A valid '+parameter[1]+' is required.'},400);
      path=path.replace(parameter[0],encodeURIComponent(value));
    }
    const destination=new URL('https://family.e-klase.lv/api'+path);
    for (const key of operation.query) if (input.query?.[key]!==undefined) destination.searchParams.set(key,String(input.query[key]).slice(0,1000));
    const headers={Accept:'application/json',Authorization:'Bearer '+current.accessToken};
    if (input.profile) {
      if (!/^[\w-]{1,100}$/.test(String(input.profile.profileId))||!/^\d{1,15}$/.test(String(input.profile.classId))) return response({error:'Invalid profile selection.'},400);
      headers['X-Profile-Id']=String(input.profile.profileId);headers['X-Class-Id']=String(input.profile.classId);
    }
    const result=await upstream(destination,{headers});
    if (!result.ok) return response({error:result.status===403?'E-klase denied this report for the current account.':result.status===401?'Your E-klase session has expired. Sign in again.':'E-klase could not load this section.',upstreamStatus:result.status},result.status===401?401:result.status===429?429:502);
    if (!result.headers.get('content-type')?.includes('json')) return response({error:'E-klase returned an unsupported response.'},502);
    const text=await result.text();
    if (text.length>5_000_000) return response({error:'This report is too large.'},502);
    return response({data:JSON.parse(text),captured:new Date().toISOString(),operation:input.operation});
  }
  return response({error:'Not found.'},404);
}

export default {async fetch(request,env={}) { try {return await route(request,env);} catch {return response({error:'The request could not be completed. No account details have been logged.'},500);} }};
export { trusted, attributes, seal, session };
