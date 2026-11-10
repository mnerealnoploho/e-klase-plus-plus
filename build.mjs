import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
const types={'index.html':'text/html; charset=utf-8','styles.css':'text/css; charset=utf-8','app.js':'text/javascript; charset=utf-8','core.mjs':'text/javascript; charset=utf-8','sw.js':'text/javascript; charset=utf-8','manifest.webmanifest':'application/manifest+json','icon.svg':'image/svg+xml','operations.json':'application/json'};
const assets={};
for (const [name,type] of Object.entries(types)) assets['/'+name]={type,body:await readFile(name,'utf8')};
for (const name of ['icon-192.png','icon-512.png','apple-touch-icon.png']) assets['/'+name]={type:'image/png',binary:true,body:(await readFile(name)).toString('base64')};
const operations=JSON.parse(await readFile('operations.json','utf8'));
const prefix='const assets='+JSON.stringify(assets)+';\nconst operations='+JSON.stringify(operations)+';\n';
const worker=(await readFile('worker.mjs','utf8')).replace("import { assets, operations } from './assets.mjs';",prefix);
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js',worker);
try { await copyFile('.openai/hosting.json','dist/.openai/hosting.json'); } catch(error) { if(error.code!=='ENOENT')throw error; }
console.log('Built private PWA and connection server.');
