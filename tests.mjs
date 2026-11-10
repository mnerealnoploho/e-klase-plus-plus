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

test('server rejects non-E-klase destinations',()=>{
  assert.equal(server.trusted('https://family.e-klase.lv/api/diary').hostname,'family.e-klase.lv');
  assert.throws(()=>server.trusted('https://family.e-klase.lv.attacker.example/api'));assert.throws(()=>server.trusted('http://auth.e-klase.lv/login'));
});
test('encrypted session cookies are bound to the authenticated owner',async()=>{
  const key='a'.repeat(64),payload={accessToken:'test-token',expires:Date.now()+60000};
  const sealed=await server.seal(payload,key,'owner-a');
  const request=new Request('https://example.test/api/session',{headers:{cookie:'__Host-ek_session='+sealed}});
  assert.deepEqual(await server.session(request,{SESSION_KEY:key},'owner-a'),payload);assert.equal(await server.session(request,{SESSION_KEY:key},'owner-b'),null);
});
test('private API rejects missing identity and cross-origin writes',async()=>{
  const first=await server.default.fetch(new Request('https://example.test/api/session'),{});assert.equal(first.status,401);
  const second=await server.default.fetch(new Request('https://example.test/api/logout',{method:'POST',headers:{'oai-authenticated-user-id':'owner','content-type':'application/json',origin:'https://attacker.example'},body:'{}'}),{});assert.equal(second.status,403);
});
test('service worker excludes account APIs and the worker serves a real manifest',async()=>{
  const worker=await readFile('sw.js','utf8');assert.ok(worker.includes("url.pathname.startsWith('/api/')"));
  const manifest=await server.default.fetch(new Request('https://example.test/manifest.webmanifest'),{});assert.equal(manifest.status,200);assert.equal((await manifest.json()).display,'standalone');
});
