import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
execFileSync(process.execPath,['build.mjs'],{stdio:'inherit'});
const worker=(await import('./dist/server/index.js')).default;
const env={LOCAL_OWNER:'local-preview',SESSION_KEY:randomBytes(48).toString('hex')};
createServer(async(req,res)=>{
  try{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const host=req.headers.host||'localhost:3000';
    const request=new Request('http://'+host+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
    const result=await worker.fetch(request,env);
    res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
  }catch{res.writeHead(500);res.end('Preview request failed');}
}).listen(Number(process.env.PORT||(process.argv.includes('--port')?process.argv[process.argv.indexOf('--port')+1]:3000)),process.argv.includes('--host')?process.argv[process.argv.indexOf('--host')+1]:'0.0.0.0',()=>console.log('Preview ready'));
