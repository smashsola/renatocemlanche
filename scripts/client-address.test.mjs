import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clientAddress,proxyAddresses} from './client-address.mjs';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
test('proxy confiável separa visitantes; conexão direta ignora IP forjado',()=>{
 const req=visitor=>({socket:{remoteAddress:'::ffff:127.0.0.1'},headers:{'cf-connecting-ip':visitor}});
 const trusted=proxyAddresses('127.0.0.1,::1');
 assert.equal(clientAddress(req('203.0.113.10'),trusted),'203.0.113.10');
 assert.equal(clientAddress(req('203.0.113.11'),trusted),'203.0.113.11');
 assert.equal(clientAddress(req('203.0.113.10')),'127.0.0.1');
 assert.equal(clientAddress({socket:{remoteAddress:'198.51.100.20'},headers:{'cf-connecting-ip':'203.0.113.10'}},trusted),'198.51.100.20');
 assert.throws(()=>clientAddress(req('invalid'),trusted));
 assert.throws(()=>proxyAddresses('*'));
});
test('esgotar login de um visitante não bloqueia outro pelo tunnel',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'renato-proxy-')),password=randomUUID()+randomUUID();
 const child=spawn(process.execPath,['scripts/server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,NODE_ENV:'test',PORT:'0',HOST:'127.0.0.1',PUBLIC_ORIGIN:'',DATA_DIR:directory,ADMIN_PASSWORD:password,TRUST_PROXY_FROM:'127.0.0.1,::1'},stdio:['ignore','pipe','pipe']});
 try{
  const base=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Servidor não iniciou.')),10000);child.stdout.on('data',chunk=>{output+=chunk;const match=/127\.0\.0\.1:(\d+)/.exec(output);if(match){clearTimeout(timer);resolve('http://127.0.0.1:'+match[1]);}});child.on('exit',()=>{clearTimeout(timer);reject(Error('Servidor encerrou.'));});});
  const login=(visitor,secret)=>fetch(base+'/api/admin/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','CF-Connecting-IP':visitor},body:JSON.stringify({username:'renato',password:secret})});
  for(let i=0;i<5;i++)assert.equal((await login('203.0.113.10','wrong')).status,401);
  assert.equal((await login('203.0.113.10','wrong')).status,429);
  assert.equal((await login('203.0.113.11',password)).status,200);
 }finally{if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}assert.ok(directory.startsWith(join(tmpdir(),'renato-proxy-')));await rm(directory,{recursive:true,force:true});}
});
