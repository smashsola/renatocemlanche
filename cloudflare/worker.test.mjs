import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import worker from './worker.mjs';

function binding(sqlite){
 return {prepare(sql){let params=[];return {
  bind(...values){params=values.map(v=>Array.isArray(v)?new Uint8Array(v):v);return this;},
  async first(){return sqlite.prepare(sql).get(...params)||null;},
  async all(){return {results:sqlite.prepare(sql).all(...params)};},
  async run(){const r=sqlite.prepare(sql).run(...params);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}
 };},async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
}

test('Worker: pedidos, sessão persistente, Pix manual, fotos, adicionais e concorrência',async()=>{
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(await readFile(new URL('./migrations/0001_initial.sql',import.meta.url),'utf8'));
 const secret=randomUUID()+randomUUID(),origin='https://renato.example';
 const env={DB:binding(sqlite),ADMIN_PASSWORD:secret,PUBLIC_ORIGIN:origin,ASSETS:{fetch:async()=>new Response('site')}};
 let cookie;const background=[];const ctx={waitUntil(p){background.push(p);}};
 async function call(path,method='GET',data,admin=false,extra={}){
  const response=await worker.fetch(new Request(origin+path,{method,headers:{...(data?{'Content-Type':'application/json',Origin:origin}:{}),...(admin?{Cookie:cookie}:{}),'CF-Connecting-IP':'203.0.113.10',...extra},body:data?JSON.stringify(data):undefined}),env,ctx);
  const type=response.headers.get('Content-Type');return {response,body:type?.includes('application/json')?await response.json():await response.text()};
 }
 async function login(password=secret){const r=await call('/api/admin/login','POST',{username:'renato',password});assert.equal(r.response.status,200,JSON.stringify(r.body));cookie=r.response.headers.get('Set-Cookie').split(';')[0];assert.match(r.response.headers.get('Set-Cookie'),/HttpOnly.*SameSite=Strict.*Secure/);}
 try{
  assert.equal((await call('/api/admin/state')).response.status,401);
  assert.equal((await call('/api/admin/login','POST',{username:'renato',password:secret},false,{Origin:'https://evil.example'})).response.status,403);
  await login();assert.equal((await call('/api/admin/state','GET',null,true)).response.status,200);
  assert.notEqual(sqlite.prepare('SELECT token_hash FROM sessions').get().token_hash,cookie.split('=')[1]);
  const input={requestKey:randomUUID(),customer:'Cliente teste',phone:'88999999999',address:'Rua teste 1',notes:'Sem cebola',fulfillment:'delivery',paymentMethod:'cash',expectedTotal:1200,items:[{id:'x-burguer',quantity:1,extras:[]}]};
  assert.equal((await call('/api/orders','POST',input)).response.status,409);
  let store=(await call('/api/store')).body;
  const storePatch={...store,open:true,deliveryFee:500};
  const simultaneous=await Promise.all([call('/api/admin/store','PATCH',storePatch,true),call('/api/admin/store','PATCH',storePatch,true)]);
  assert.deepEqual(simultaneous.map(r=>r.response.status).sort(),[200,409]);
  const duplicate=await Promise.all([call('/api/orders','POST',input),call('/api/orders','POST',input)]);
  assert.deepEqual(duplicate.map(r=>r.response.status).sort(),[200,201]);assert.equal(duplicate[0].body.id,duplicate[1].body.id);
  const order=duplicate[0].body;assert.equal(order.total,1200);assert.equal(order.phone,undefined);assert.equal(order.address,undefined);
  assert.equal((await call('/api/order-status','POST',{token:order.token})).body.number,order.number);
  assert.equal((await call('/api/orders','POST',{...input,requestKey:randomUUID(),expectedTotal:1})).response.status,409);
  assert.equal((await call('/api/order-status','POST',{token:'a'.repeat(32)})).response.status,404);
  let row=order;
  for(const status of ['accepted','preparing']){const r=await call('/api/admin/orders/'+order.id,'PATCH',{version:row.version,status},true);assert.equal(r.response.status,200,JSON.stringify(r.body));row=r.body;}
  assert.equal((await call('/api/admin/orders/'+order.id,'PATCH',{version:row.version,status:'cancelled'},true)).response.status,409);
  row=(await call('/api/admin/orders/'+order.id,'PATCH',{version:row.version,status:'ready'},true)).body;
  assert.equal((await call('/api/admin/orders/'+order.id,'PATCH',{version:row.version,status:'delivered'},true)).response.status,409);
  row=(await call('/api/admin/orders/'+order.id,'PATCH',{version:row.version,status:'delivered',paymentStatus:'paid'},true)).body;
  assert.equal(row.status,'delivered');
  let r=await call('/api/admin/pix','POST',{enabled:true,key:'teste@example.com',name:'Renato',city:'Fortaleza',currentPassword:secret},true);assert.equal(r.response.status,200,JSON.stringify(r.body));
  assert.equal((await call('/api/store')).body.pix,undefined);
  const pix=(await call('/api/orders','POST',{...input,requestKey:randomUUID(),paymentMethod:'pix'})).body;
  assert.equal((await call('/api/admin/orders/'+pix.id,'PATCH',{version:pix.version,status:'accepted'},true)).response.status,409);
  const code=(await call('/api/order-pix','POST',{token:pix.token})).body;assert.ok(code.code.includes('12.00'));
  r=await call('/api/admin/orders/'+pix.id,'PATCH',{version:pix.version,status:'accepted',paymentStatus:'paid'},true);assert.equal(r.response.status,200);
  const state=(await call('/api/admin/state','GET',null,true)).body;
  const catalog=structuredClone(state.catalog);catalog.extrasByProduct={'x-burguer':[{id:'bacon',name:'Bacon',price:300}]};
  assert.equal((await call('/api/admin/catalog','PUT',{version:state.store.version,catalog},true)).response.status,200);
  const custom=(await call('/api/orders','POST',{...input,requestKey:randomUUID(),expectedTotal:1500,items:[{id:'x-burguer',quantity:1,extras:['bacon']}]})).body;
  assert.equal(custom.items[0].extras[0].name,'Bacon');assert.equal(custom.total,1500);
  const image=Buffer.from([255,216,255,224,1,1,255,217]);r=await call('/api/admin/photo','POST',{image:image.toString('base64')},true);assert.equal(r.response.status,201,JSON.stringify(r.body));
  const photo=await worker.fetch(new Request(origin+r.body.url),env,ctx);assert.deepEqual(new Uint8Array(await photo.arrayBuffer()),new Uint8Array(image));
  assert.equal((await call('/api/admin/photo','POST',{image:'eA=='},true)).response.status,400);
  const date=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  assert.equal((await call('/api/admin/metrics?date='+date,'GET',null,true)).body.received,2400);
  const expenses={requestKey:randomUUID(),amount:400,description:'Gelo'};
  assert.equal((await call('/api/admin/expenses','POST',expenses,true)).response.status,201);
  assert.equal((await call('/api/admin/metrics?from='+date+'&to='+date,'GET',null,true)).body.series[0].spent,400);
  const push=(await call('/api/admin/push-key','GET',null,true));assert.equal(push.response.status,200,JSON.stringify(push.body));assert.ok(push.body.publicKey);
  assert.equal((await call('/api/admin/push-subscribe','POST',{endpoint:'https://127.0.0.1/test',keys:{}},true)).response.status,400);
  assert.equal((await call('/api/admin/push-test','POST',{},true)).body.sent,0);
  const nextSecret=randomUUID()+randomUUID();assert.equal((await call('/api/admin/password','POST',{currentPassword:secret,newPassword:nextSecret},true)).response.status,200);
  assert.equal((await call('/api/admin/state','GET',null,true)).response.status,401);await login(nextSecret);
  assert.equal((await call('/api/admin/logout','POST',{},true)).response.status,200);assert.equal((await call('/api/admin/state','GET',null,true)).response.status,401);
  const headers=(await call('/')).response.headers;assert.equal(headers.get('X-Frame-Options'),'DENY');assert.ok(headers.get('Content-Security-Policy'));
  for(let i=0;i<5;i++)assert.equal((await call('/api/admin/login','POST',{username:'renato',password:'wrong'},false,{'CF-Connecting-IP':'203.0.113.99'})).response.status,401);
  assert.equal((await call('/api/admin/login','POST',{username:'renato',password:'wrong'},false,{'CF-Connecting-IP':'203.0.113.99'})).response.status,429);
 }finally{await Promise.allSettled(background);sqlite.close();}
});
