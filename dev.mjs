import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
execFileSync(process.execPath,['build.mjs'],{stdio:'inherit'});
const worker=(await import('./dist/server/index.js')).default;
const fallback='local-preview-only-42';
const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('e-klase-plus-plus:'+fallback));
const env={SESSION_KEY:process.env.SESSION_KEY||randomBytes(48).toString('hex'),APP_PASSWORD_HASH:process.env.APP_PASSWORD_HASH||Buffer.from(digest).toString('hex')};
createServer(async(req,res)=>{
  try{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const host=req.headers.host||'localhost:3000';
    const request=new Request('http://'+host+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
    const result=await worker.fetch(request,env);
    res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Preview request failed');}
}).listen(Number(process.env.PORT||(process.argv.includes('--port')?process.argv[process.argv.indexOf('--port')+1]:3000)),process.argv.includes('--host')?process.argv[process.argv.indexOf('--host')+1]:'127.0.0.1',()=>console.log('Test server ready. Run npm run setup for your own password.'));
