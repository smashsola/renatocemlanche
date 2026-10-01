import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { products, extrasByCategory } from '../dist/js/catalog.js';

test('diretório de dados privado não pode ficar na pasta pública', async () => {
 const child = spawn(process.execPath,['scripts/server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,DATA_DIR:fileURLToPath(new URL('../dist/',import.meta.url))},stdio:['ignore','ignore','pipe']});
 let message = '';
 child.stderr.on('data',chunk => message += chunk);
 const [code] = await once(child,'exit');
 assert.notEqual(code,0);
 assert.match(message,/DATA_DIR deve ficar fora/);
});

test('pedido persistente, preços do servidor, fila e controle de acesso', async () => {
 const directory = await mkdtemp(join(tmpdir(),'renato-test-'));
 let child, base, cookie;
 const secret = randomUUID() + randomUUID();
 const privateFixture = new URL('../dist/private-review-' + randomUUID() + '.txt', import.meta.url);
 async function start() {
  child = spawn(process.execPath,['scripts/server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0',HOST:'127.0.0.1',PUBLIC_ORIGIN:'',DATA_DIR:directory,ADMIN_PASSWORD:secret},stdio:['ignore','pipe','pipe']});
  let output = '';
  await new Promise((resolve,reject) => {
   const timeout = setTimeout(() => reject(new Error('Servidor não iniciou.')),10000);
   child.stdout.on('data',chunk => {output += chunk; const match = /127\.0\.0\.1:(\d+)/.exec(output); if (match) {base = 'http://127.0.0.1:'+match[1]; clearTimeout(timeout); resolve();}});
   child.on('exit',code => {clearTimeout(timeout); reject(new Error('Servidor encerrou: '+code));});
  });
 }
 async function stop() { if (child && child.exitCode === null) {const finished = once(child,'exit'); child.kill(); await finished;} }
 async function call(path,method='GET',data,authorized=false,origin=base) {
  const response = await fetch(base+path,{method,headers:{...(data ? {'Content-Type':'application/json',Origin:origin} : {}),...(authorized ? {Cookie:cookie} : {})},body:data ? JSON.stringify(data) : undefined});
  return {response,body:await response.json()};
 }
 async function login() {const result = await call('/api/admin/login','POST',{username:'renato',password:secret});assert.equal(result.response.status,200);cookie=result.response.headers.get('set-cookie').split(';')[0];}
 try {
  await start();
  await writeFile(privateFixture, 'Internal fixture, must not be served.');
  assert.equal((await fetch(base + '/' + privateFixture.pathname.split('/').pop())).status,404);
  for (const path of ['/.env','/scripts/server.mjs','/package.json','/js/nav-dock.js.map','/data/acesso-painel.txt']) assert.equal((await fetch(base + path)).status,404);
  assert.equal((await call('/api/admin/state')).response.status,401);
  assert.equal((await call('/api/admin/login','POST',{username:'another',password:secret})).response.status,401);
  const staticPage=await fetch(base+'/');assert.ok(staticPage.headers.get('content-security-policy').includes("script-src 'self'"));assert.equal(staticPage.headers.get('x-frame-options'),'DENY');
  assert.equal((await fetch(base+'/data/pedidos.sqlite')).status,404);
  assert.equal((await fetch(base+'/%2e%2e%2fdata/pedidos.sqlite')).status,403);
  assert.equal((await call('/api/admin/login','POST',{username:'renato',password:secret},false,'https://another.example')).response.status,403);
  await login();
  const input = {requestKey:randomUUID(),customer:'Cliente de teste',phone:'88999999999',address:'',notes:'Sem cebola',fulfillment:'pickup',paymentMethod:'pix',expectedTotal:700,items:[{id:'x-burguer',quantity:1,extras:[]}],total:1};
  assert.equal((await call('/api/orders','POST',input)).response.status,409);
  let shop = (await call('/api/store')).body;
  shop=(await call('/api/admin/store','PATCH',{...shop,open:true,deliveryFee:350},true)).body;
  const wrong = await call('/api/orders','POST',{...input,requestKey:randomUUID(),expectedTotal:1}); assert.equal(wrong.response.status,409);
  const created = await call('/api/orders','POST',input);assert.equal(created.response.status,201);assert.equal(created.body.total,700);assert.equal(created.body.paymentStatus,'pending');
  let order=created.body;
  const pixConfig={enabled:true,key:'teste@example.com',name:'TESTE',city:'FORTALEZA',currentPassword:secret};
  assert.equal((await call('/api/admin/pix','POST',pixConfig)).response.status,401);
  assert.equal((await call('/api/admin/pix','POST',{...pixConfig,currentPassword:'wrong'},true)).response.status,403);
  assert.equal((await call('/api/admin/pix','POST',pixConfig,true)).response.status,200);
  let prepaid=(await call('/api/orders','POST',{...input,requestKey:randomUUID()})).body;
  assert.equal(prepaid.paymentTiming,'before');
  assert.equal((await call('/api/admin/orders/'+prepaid.id,'PATCH',{version:prepaid.version,status:'accepted'},true)).response.status,409);
  assert.equal((await call('/api/admin/orders/'+prepaid.id,'PATCH',{version:prepaid.version,status:'cancelled'},true)).response.status,200);
  let later=(await call('/api/orders','POST',{...input,paymentMethod:'pix-later',requestKey:randomUUID()})).body;
  assert.equal(later.paymentTiming,'on-receipt');assert.equal((await call('/api/admin/orders/'+later.id,'PATCH',{version:later.version,status:'accepted'},true)).response.status,200);
  const pix=(await call('/api/order-pix','POST',{token:order.token})).body;
  assert.equal(pix.amount,700);assert.ok(pix.code.includes('54047.00'));assert.ok(pix.code.includes('teste@example.com'));
  assert.equal((await call('/api/order-status','POST',{token:order.token})).body.paymentStatus,'pending');
  assert.equal((await call('/api/order-pix','POST',{token:'invalid'})).response.status,404);
  assert.equal((await call('/api/admin/push-key')).response.status,401);
  assert.equal((await call('/api/admin/push-key','GET',undefined,true)).body.publicKey.length,87);
  assert.equal((await call('/api/admin/push-subscribe','POST',{endpoint:'https://localhost/private',keys:{p256dh:'x'.repeat(87),auth:'x'.repeat(22)}},true)).response.status,400);
  const publicStore=(await call('/api/store')).body;assert.equal(publicStore.pix,undefined);assert.equal(publicStore.pixAvailable,true);
  shop=(await call('/api/admin/state','GET',undefined,true)).body.store;
  assert.equal(order.phone,undefined);assert.equal(order.address,undefined);assert.equal(order.notes,undefined);assert.equal(order.customer,'Cliente');
  const duplicate=await call('/api/orders','POST',input);assert.equal(duplicate.body.id,order.id);assert.equal(duplicate.body.token,order.token);
  const parallel = await Promise.all(Array.from({length:3},()=>call('/api/orders','POST',input)));assert.ok(parallel.every(result=>result.body.id===order.id));
  const invalid = await call('/api/orders','POST',{...input,requestKey:randomUUID(),items:[{id:'x-burguer',quantity:1,extras:['fake']}]});assert.equal(invalid.response.status,400);
  const extra = extrasByCategory.burgers[0];
  const delivery=await call('/api/orders','POST',{...input,requestKey:randomUUID(),fulfillment:'delivery',address:'Rua de teste, 100',expectedTotal:700+extra.price+350,items:[{id:'x-burguer',quantity:1,extras:[extra.id]}]});assert.equal(delivery.body.total,700+extra.price+350);assert.equal(delivery.body.deliveryFee,350);
  assert.equal(delivery.body.items[0].extras[0].name,extra.name);assert.equal(delivery.body.address,undefined);
  const privateState=(await call('/api/admin/state','GET',undefined,true)).body;
  assert.equal(privateState.orders.find(item=>item.id===delivery.body.id).address,'Rua de teste, 100');
  assert.equal(privateState.orders.find(item=>item.id===delivery.body.id).items[0].extras[0].price,extra.price);
  assert.equal((await call('/api/orders','POST',{...input,requestKey:randomUUID(),fulfillment:'delivery'})).response.status,400);
  const pastry=products.find(item=>item.category==='pastries');
  assert.equal((await call('/api/orders','POST',{...input,requestKey:randomUUID(),items:[{id:pastry.id,quantity:1,extras:[extra.id]}]})).response.status,400);
  shop=(await call('/api/admin/store','PATCH',{...shop,paused:['x-burguer']},true)).body;
  assert.equal((await call('/api/orders','POST',{...input,requestKey:randomUUID()})).response.status,409);
  const stale=await call('/api/admin/store','PATCH',{...shop,version:1},true);assert.equal(stale.response.status,409);
  let sideOrder=delivery.body;
  sideOrder=(await call(`/api/admin/orders/${sideOrder.id}`,'PATCH',{version:sideOrder.version,paymentStatus:'paid'},true)).body;
  sideOrder=(await call(`/api/admin/orders/${sideOrder.id}`,'PATCH',{version:sideOrder.version,status:'accepted'},true)).body;
  assert.equal((await call(`/api/admin/orders/${sideOrder.id}`,'PATCH',{version:sideOrder.version,status:'cancelled'},true)).response.status,200);
  for (const status of ['accepted','preparing','ready']) {
   const changed=await call(`/api/admin/orders/${order.id}`,'PATCH',{version:order.version,status},true);assert.equal(changed.response.status,200);order=changed.body;
   if (['preparing','ready'].includes(status)) assert.equal((await call(`/api/admin/orders/${order.id}`,'PATCH',{version:order.version,status:'cancelled'},true)).response.status,409);
  }
  assert.equal((await call(`/api/admin/orders/${order.id}`,'PATCH',{version:order.version,status:'delivered'},true)).response.status,409);
  assert.equal((await call(`/api/admin/orders/${order.id}`,'PATCH',{version:1,paymentStatus:'paid'},true)).response.status,409);
  const paid=await call(`/api/admin/orders/${order.id}`,'PATCH',{version:order.version,paymentStatus:'paid'},true);order=paid.body;
  const delivered=await call(`/api/admin/orders/${order.id}`,'PATCH',{version:order.version,status:'delivered'},true);assert.equal(delivered.body.status,'delivered');
  assert.equal((await call('/api/admin/metrics')).response.status,401);
  const expense={requestKey:randomUUID(),amount:200,description:'Ingredientes de teste'};
  assert.equal((await call('/api/admin/expenses','POST',expense)).response.status,401);
  const recorded=await call('/api/admin/expenses','POST',expense,true);assert.equal(recorded.response.status,201);
  assert.equal((await call('/api/admin/expenses','POST',expense,true)).body.id,recorded.body.id);
  const metrics=(await call('/api/admin/metrics','GET',undefined,true)).body;
  const date=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  const range=(await call('/api/admin/metrics?from='+date+'&to='+date,'GET',undefined,true)).body;
  assert.equal(range.series.length,1);assert.equal(range.series[0].received,metrics.received);
  const year=(await call('/api/admin/metrics?from='+date.slice(0,4)+'-01-01&to='+date,'GET',undefined,true)).body;
  assert.ok(year.series.length>1);assert.equal(year.series.reduce((sum,row)=>sum+row.received,0),metrics.received);
  assert.equal((await call('/api/admin/metrics?from=2026-02-31&to=2026-03-01','GET',undefined,true)).response.status,400);
  assert.equal((await call('/api/order-pix','POST',{token:created.body.token})).response.status,409);
  assert.equal(metrics.received,700+delivery.body.total);assert.equal(metrics.deliveryFees,350);assert.equal(metrics.spent,200);assert.equal(metrics.balance,500+delivery.body.total);assert.equal(metrics.delivered,1);
  assert.equal((await call('/api/admin/password','POST',{currentPassword:secret,newPassword:randomUUID()},true)).response.status,409);
  assert.equal((await call('/api/order-status','POST',{token:created.body.token})).body.paymentStatus,'paid');
  assert.equal((await call('/api/order-status','POST',{token:'guess'})).response.status,404);
  await stop();await start();
  const restored=await call('/api/order-status','POST',{token:created.body.token});assert.equal(restored.body.status,'delivered');assert.equal(restored.body.total,700);
  assert.equal((await call('/api/store')).body.paused[0],'x-burguer');
  await login();
  assert.equal((await call('/api/admin/state','GET',undefined,true)).body.orders.length,4);
  const jpg=(await readFile(new URL('../CARDAPIO-REFERENCIA.jpeg',import.meta.url))).toString('base64');
  assert.equal((await call('/api/admin/photo','POST',{image:jpg})).response.status,401);
  assert.equal((await call('/api/admin/photo','POST',{image:Buffer.from('<html>not a photo</html>').toString('base64')},true)).response.status,400);
  const uploaded=await call('/api/admin/photo','POST',{image:jpg},true);assert.equal(uploaded.response.status,201);
  const photograph=await fetch(base+uploaded.body.url);assert.equal(photograph.status,200);assert.equal(photograph.headers.get('content-type'),'image/jpeg');
  assert.equal((await fetch(base+'/assets/uploads/../../data/auth.json')).status,404);
  const cs=(await call('/api/admin/state','GET',undefined,true)).body;const edited=structuredClone(cs.catalog);edited.products[0].price=900;edited.products[0].name='Lanche editado';edited.extrasByCategory.burgers[0].price=250;
  assert.equal((await call('/api/admin/catalog','PUT',{version:cs.store.version,catalog:edited})).response.status,401);
  const malicious=structuredClone(edited);malicious.products[0].name='<script>';
  assert.equal((await call('/api/admin/catalog','PUT',{version:cs.store.version,catalog:malicious},true)).response.status,400);
  assert.equal((await call('/api/admin/catalog','PUT',{version:cs.store.version,catalog:edited},true)).response.status,200);
  assert.equal((await call('/api/admin/catalog','PUT',{version:cs.store.version,catalog:edited},true)).response.status,409);
  assert.ok((await (await fetch(base+'/js/catalog.js')).text()).includes('Lanche editado'));
  assert.equal((await call('/api/order-status','POST',{token:created.body.token})).body.total,700);
  await stop();await start();await login();assert.equal((await call('/api/admin/state','GET',undefined,true)).body.catalog.products[0].price,900);
 } finally {await stop();await rm(privateFixture,{force:true});assert.ok(directory.startsWith(join(tmpdir(),'renato-test-')));await rm(directory,{recursive:true,force:true});}
});

test('troca de senha persiste e recuperação só acontece no servidor',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'renato-access-'));
 let child,base;
 const env={...process.env,PORT:'0',HOST:'127.0.0.1',PUBLIC_ORIGIN:'',DATA_DIR:directory};delete env.ADMIN_PASSWORD;
 async function start(){
  child=spawn(process.execPath,['scripts/server.mjs'],{cwd:new URL('../',import.meta.url),env,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{let output='';const timeout=setTimeout(()=>reject(new Error('Servidor não iniciou')),10000);child.stdout.on('data',chunk=>{output+=chunk;const match=/127\.0\.0\.1:(\d+)/.exec(output);if(match){base='http://127.0.0.1:'+match[1];clearTimeout(timeout);resolve();}});child.on('exit',()=>{clearTimeout(timeout);reject(new Error('Servidor encerrou'));});});
 }
 async function stop(){if(child && child.exitCode===null){const done=once(child,'exit');child.kill();await done;}}
 async function post(path,payload,cookie){return fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(payload)});}
 try {
  await start();const initial=(await readFile(join(directory,'acesso-painel.txt'),'utf8')).trim();
  const login=await post('/api/admin/login',{username:'renato',password:initial});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
  const next=randomUUID()+randomUUID();
  assert.equal((await post('/api/admin/password',{currentPassword:initial,newPassword:next})).status,401);
  assert.equal((await post('/api/admin/password',{currentPassword:'wrong',newPassword:next},cookie)).status,403);
  assert.equal((await post('/api/admin/password',{currentPassword:initial,newPassword:'short'},cookie)).status,400);
  assert.equal((await post('/api/admin/password',{currentPassword:initial,newPassword:next},cookie)).status,200);
  assert.equal((await fetch(base+'/api/admin/state',{headers:{Cookie:cookie}})).status,401);
  assert.ok(!(await readFile(join(directory,'auth.json'),'utf8')).includes(next));
  await assert.rejects(readFile(join(directory,'acesso-painel.txt')),{code:'ENOENT'});
  await stop();await start();
  assert.equal((await post('/api/admin/login',{username:'renato',password:initial})).status,401);
  assert.equal((await post('/api/admin/login',{username:'renato',password:next})).status,200);
  await stop();
  const reset=spawn(process.execPath,['scripts/reset-access.mjs'],{cwd:new URL('../',import.meta.url),env,stdio:'ignore'});assert.equal((await once(reset,'exit'))[0],0);
  const recovered=(await readFile(join(directory,'acesso-painel.txt'),'utf8')).trim();assert.notEqual(recovered,next);
  await start();assert.equal((await post('/api/admin/login',{username:'renato',password:next})).status,401);assert.equal((await post('/api/admin/login',{username:'renato',password:recovered})).status,200);
 }finally{await stop();assert.ok(directory.startsWith(join(tmpdir(),'renato-access-')));await rm(directory,{recursive:true,force:true});}
});

