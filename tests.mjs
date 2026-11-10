import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {defaults,average,weighted,required,estimate,median,csv,calendar,validate,encrypt,decrypt,escape} from './core.mjs';

test('averages keep numeric grades and weights distinct',()=>{
  assert.equal(average([6,8,10]),8);assert.equal(average([]),null);assert.equal(average([NaN]),null);
  assert.equal(weighted([[6,1],[10,3]]),9);assert.equal(weighted([[8,0]]),null);assert.equal(median([8,6,10,7]),7.5);
});
test('target calculation exposes impossible targets',()=>{
  assert.equal(required(8,4,8.5,2),9.5);assert.equal(required(5,8,9,1),41);assert.equal(required(8,0,9,2),null);assert.equal(required(8,4,9,0),null);
});
test('chart estimates use two calibration anchors and uncertainty',()=>{
  assert.deepEqual(estimate(6,120,9,180,156,1),{value:7.8,uncertainty:0.05});assert.equal(estimate(6,100,9,100,150),null);assert.equal(estimate(6,120,9,180,156,-1),null);
});
test('CSV export prevents formula execution and preserves quotes',()=>{
  const output=csv([['=HYPERLINK("bad")','line\nnext','normal']]);assert.ok(output.includes('"\'=HYPERLINK(""bad"")"'));assert.ok(output.includes('"line\nnext"'));
});
test('calendar export includes a UTC event, recurrence and alarm',()=>{
  const value=calendar({id:'sample',due:'2026-11-12T15:00:00Z',title:'Read, revise; practice',note:'First\nNext',repeat:'weekly',reminder:true});
  assert.ok(value.includes('DTSTART:20261112T150000Z'));assert.ok(value.includes('RRULE:FREQ=WEEKLY'));assert.ok(value.includes('TRIGGER:-PT15M'));assert.ok(value.includes('SUMMARY:Read\\, revise\\; practice'));
});
test('untrusted content is encoded before rendering',()=>{assert.equal(escape('<img src=x onerror="bad">'),'&lt;img src=x onerror=&quot;bad&quot;&gt;');});
test('backup round-trip keeps every workspace section',async()=>{
  const data=defaults();data.notes.push({id:'1',title:'Revision',text:'Personal notes',subject:'Physics',day:'2026-11-10'});
  const sealed=await encrypt(data,'a sufficiently long password');assert.ok(!sealed.includes('Personal notes'));assert.deepEqual(await decrypt(sealed,'a sufficiently long password'),data);
});
test('wrong backup password and ciphertext tampering fail closed',async()=>{
  const sealed=await encrypt(defaults(),'a sufficiently long password');await assert.rejects(()=>decrypt(sealed,'a different long password'));
  const envelope=JSON.parse(sealed);envelope.sealed=envelope.sealed.slice(0,5)+'AAAA'+envelope.sealed.slice(9);await assert.rejects(()=>decrypt(JSON.stringify(envelope),'a sufficiently long password'));
});
test('restore validates limits, image type and grade units',()=>{
  const value=defaults();value.settings.background='data:image/svg+xml;base64,abc';assert.throws(()=>validate(value));
  const other=defaults();other.grades.push({id:'1',subject:'Math',value:99,weight:1,scale:'grade'});assert.throws(()=>validate(other));
});

execFileSync(process.execPath,['build.mjs'],{stdio:'pipe'});
const source=await readFile('dist/server/index.js','utf8');
const server=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

const secret='test-session-key-'.repeat(4);
const env={SESSION_KEY:secret,APP_PASSWORD_HASH:await server.passwordHash('synthetic-test-password')};
const cookie='__Host-ek_access='+await server.accessCookie(secret);
function request(path,options={}){return new Request('https://test.example'+path,{...options,headers:{cookie,...options.headers}});}

test('password gate protects pages before any upstream request',async()=>{
  let calls=0;
  const result=await server.default.fetch(new Request('https://test.example/home'),{...env,FETCH:async()=>{calls+=1;return new Response('bad');}});
  assert.equal(result.status,200);assert.ok((await result.text()).includes('Testa vietnes parole'));assert.equal(calls,0);
});
test('gate password is checked server-side and returned cookies are protected',async()=>{
  const result=await server.default.fetch(new Request('https://test.example/++/unlock',{method:'POST',headers:{origin:'https://test.example','content-type':'application/x-www-form-urlencoded'},body:'password=synthetic-test-password&returnTo=%2Fhome'}),env);
  assert.equal(result.status,303);assert.equal(result.headers.get('location'),'/home');
  const value=result.headers.get('set-cookie');assert.ok(value.includes('HttpOnly'));assert.ok(value.includes('Secure'));assert.ok(value.includes('SameSite=Lax'));assert.ok(!value.includes('synthetic-test-password'));
});
test('wrong gate password cannot reach E-klase',async()=>{
  const result=await server.default.fetch(new Request('https://test.example/++/unlock',{method:'POST',headers:{origin:'https://test.example'},body:'password=wrong'}),env);assert.equal(result.status,401);
});
test('gate rejects forged cookies, expiry and foreign-origin submissions',async()=>{
  assert.equal(await server.hasAccess(new Request('https://test.example/home',{headers:{cookie:cookie+'x'}}),env),false);
  assert.equal(await server.hasAccess(new Request('https://test.example/home',{headers:{cookie:'__Host-ek_access='+await server.accessCookie(secret,Date.now()-1000)}}),env),false);
  const result=await server.default.fetch(request('/++/unlock',{method:'POST',headers:{origin:'https://attacker.example'},body:'password=synthetic-test-password'}),env);assert.equal(result.status,403);
});
test('missing host secrets fail closed',async()=>{const result=await server.default.fetch(request('/home'),{});assert.equal(result.status,503);});
test('proxy target is restricted to the two original service hosts',()=>{
  assert.equal(server.targetFor('https://test.example/home').target.href,'https://family.e-klase.lv/home');
  assert.equal(server.targetFor('https://test.example/_auth/connect/authorize?a=1').target.href,'https://auth.e-klase.lv/connect/authorize?a=1');
  assert.equal(server.targetFor('https://test.example//attacker.example/').target.host,'family.e-klase.lv');
});
test('auth and family cookies remain separate and app access cookies never reach upstream',()=>{
  assert.equal(server.upstreamCookies('ekp_auth_session=auth; ekp_family_session=family; __Host-ek_access=private','auth'),'session=auth');
  assert.equal(server.upstreamCookies('ekp_auth_session=auth; ekp_family_session=family; __Host-ek_access=private','family'),'session=family');
  const translated=server.localCookie('session=value; Domain=auth.e-klase.lv; Path=/connect; Secure; HttpOnly; SameSite=Lax','auth');
  assert.ok(translated.startsWith('ekp_auth_session=value'));assert.ok(!translated.includes('Domain='));assert.ok(translated.includes('HttpOnly'));assert.ok(translated.includes('Secure'));
});
test('original E-klase HTML remains the page and receives isolated enhancements',async()=>{
  const upstream='<html><head><title>E-klase</title></head><body><main><h1>Reitingi</h1><button>Žurnāli</button></main></body></html>';
  const result=await server.default.fetch(request('/overview'),{...env,FETCH:async()=>new Response(upstream,{headers:{'content-type':'text/html'}})});
  const html=await result.text();assert.ok(html.includes('<h1>Reitingi</h1>'));assert.ok(html.includes('<button>Žurnāli</button>'));assert.ok(html.includes('/++/enhance.js'));assert.ok(html.includes('/++/boot.js'));assert.equal(result.headers.get('cache-control'),'no-store');
});
test('authorization redirects and callback query strings survive proxying',async()=>{
  const result=await server.default.fetch(request('/home'),{...env,FETCH:async()=>new Response(null,{status:302,headers:{location:'https://auth.e-klase.lv/login/#/?returnUrl=%2Fconnect%2Fauthorize'}})});
  assert.equal(result.status,302);assert.equal(result.headers.get('location'),'https://test.example/_auth/login/#/?returnUrl=%2Fconnect%2Fauthorize');
});
test('PKCE exchange rewrites callback URI without modifying credentials or verifier',async()=>{
  let sent;
  const body=new URLSearchParams({redirect_uri:'https://test.example/',code_verifier:'sample-verifier',password:'https://test.example/ is part of this synthetic password'});
  const result=await server.default.fetch(request('/_auth/connect/token',{method:'POST',headers:{origin:'https://test.example','content-type':'application/x-www-form-urlencoded'},body}),{...env,FETCH:async(url,options)=>{sent={url,options};return Response.json({access_token:'synthetic-token'});}});
  assert.equal(result.status,200);const forwarded=new URLSearchParams(sent.options.body);assert.equal(forwarded.get('redirect_uri'),'https://family.e-klase.lv/');assert.equal(forwarded.get('code_verifier'),'sample-verifier');assert.equal(forwarded.get('password'),body.get('password'));assert.equal(sent.options.headers.get('origin'),'https://auth.e-klase.lv');
});
test('OIDC issuer remains original while connection endpoints use the test host',()=>{
  const result=JSON.parse(server.rewriteText(JSON.stringify({issuer:'https://auth.e-klase.lv/realms/family',authorization_endpoint:'https://auth.e-klase.lv/connect/authorize'}),'auth','https://test.example','application/json'));
  assert.equal(result.issuer,'https://auth.e-klase.lv/realms/family');assert.equal(result.authorization_endpoint,'https://test.example/_auth/connect/authorize');
});
test('auth page resources and return paths are mapped without a custom login parser',()=>{
  const html=server.rewriteHtml('<html><head><script src="/static/login.js"></script></head><body><form action="/login"><input name="password"></form></body></html>','auth','https://test.example','nonce');
  assert.ok(html.includes('src="/_auth/static/login.js"'));assert.ok(html.includes('action="/_auth/login"'));assert.ok(!html.includes('/++/enhance.js'));
});
test('requests are not retried and uploads stay binary',async()=>{
  const bytes=new Uint8Array([0,1,127,255]);let sent,calls=0;
  const result=await server.default.fetch(request('/api/attachments',{method:'POST',headers:{origin:'https://test.example','content-type':'application/octet-stream'},body:bytes}),{...env,FETCH:async(url,options)=>{calls+=1;sent=new Uint8Array(options.body);return Response.json({ok:true});}});
  assert.equal(result.status,200);assert.equal(calls,1);assert.deepEqual(sent,bytes);
});
test('offline storage only includes personal tools and excludes live pages and authentication',async()=>{
  const source=await readFile('sw.js','utf8');assert.ok(source.includes("url.pathname.startsWith('/api/')"));assert.ok(source.includes("url.pathname.startsWith('/_auth/')"));assert.ok(source.includes("const tools=['/++/'"));assert.ok(!source.includes("cache.put('/',"));
});
test('host works without a ChatGPT identity header after unlocking',async()=>{
  const result=await server.default.fetch(request('/++/'),env);assert.equal(result.status,200);assert.ok((await result.text()).includes('/++/app.js'));
  const status=await server.default.fetch(request('/++/status'),env);assert.equal((await status.json()).authenticated,true);
});
test('manifest is installable without disclosing any account data',async()=>{
  const result=await server.default.fetch(new Request('https://test.example/manifest.webmanifest'),{});assert.equal(result.status,200);assert.equal((await result.json()).display,'standalone');
});

