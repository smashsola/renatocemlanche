import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const origin=process.argv[2];
if(!/^https:\/\/renato-validacao\.[a-z0-9-]+\.workers\.dev$/.test(origin||''))throw new Error('Use somente o Worker isolado renato-validacao. Nunca rode contra produção.');
const {ADMIN_PASSWORD:password}=JSON.parse(await readFile(new URL('../.wrangler/validation-secret.json',import.meta.url),'utf8'));
let cookie;
async function call(path,method='GET',data,admin=false){
 const response=await fetch(origin+path,{method,headers:{...(data?{'Content-Type':'application/json',Origin:origin}:{}),...(admin?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});
 return {response,body:await response.json()};
}
const login=await call('/api/admin/login','POST',{username:'renato',password});assert.equal(login.response.status,200,JSON.stringify(login.body));cookie=login.response.headers.get('Set-Cookie').split(';')[0];
let shop=(await call('/api/store')).body;assert.equal(shop.open,false);
const updates=await Promise.all([call('/api/admin/store','PATCH',{...shop,open:true,deliveryFee:500},true),call('/api/admin/store','PATCH',{...shop,open:true,deliveryFee:500},true)]);
assert.deepEqual(updates.map(r=>r.response.status).sort(),[200,409]);
try{
 let state=(await call('/api/admin/state','GET',null,true)).body;
 const catalog=structuredClone(state.catalog);catalog.extrasByProduct={'x-burguer':[{id:'bacon',name:'Bacon',price:300}]};
 assert.equal((await call('/api/admin/catalog','PUT',{version:state.store.version,catalog},true)).response.status,200);
 const input={requestKey:randomUUID(),customer:'Teste isolado',phone:'88999999999',address:'Endereço fictício',notes:'Teste',fulfillment:'delivery',paymentMethod:'cash',expectedTotal:1500,items:[{id:'x-burguer',quantity:1,extras:['bacon']}]};
 const duplicate=await Promise.all([call('/api/orders','POST',input),call('/api/orders','POST',input)]);
 assert.deepEqual(duplicate.map(r=>r.response.status).sort(),[200,201]);assert.equal(duplicate[0].body.id,duplicate[1].body.id);
 const order=duplicate[0].body;assert.equal(order.total,1500);assert.equal(order.items[0].extras[0].name,'Bacon');assert.equal(order.phone,undefined);assert.equal(order.address,undefined);
 assert.equal((await call('/api/order-status','POST',{token:order.token})).body.id,order.id);
 const step=()=>call('/api/admin/orders/'+order.id,'PATCH',{version:order.version,status:'accepted'},true);
 const concurrent=await Promise.all([step(),step()]);assert.deepEqual(concurrent.map(r=>r.response.status).sort(),[200,409]);
 let row=concurrent.find(r=>r.response.status===200).body;
 row=(await call('/api/admin/orders/'+row.id,'PATCH',{version:row.version,status:'preparing'},true)).body;
 assert.equal((await call('/api/admin/orders/'+row.id,'PATCH',{version:row.version,status:'cancelled'},true)).response.status,409);
 row=(await call('/api/admin/orders/'+row.id,'PATCH',{version:row.version,status:'ready'},true)).body;
 assert.equal((await call('/api/admin/orders/'+row.id,'PATCH',{version:row.version,status:'delivered'},true)).response.status,409);
 row=(await call('/api/admin/orders/'+row.id,'PATCH',{version:row.version,status:'delivered',paymentStatus:'paid'},true)).body;assert.equal(row.status,'delivered');
 const pixConfig={enabled:true,key:'teste@example.com',name:'Teste',city:'Fortaleza',currentPassword:password};assert.equal((await call('/api/admin/pix','POST',pixConfig,true)).response.status,200);
 const pix=(await call('/api/orders','POST',{...input,requestKey:randomUUID(),paymentMethod:'pix'})).body;
 assert.equal((await call('/api/admin/orders/'+pix.id,'PATCH',{version:pix.version,status:'accepted'},true)).response.status,409);
 const qr=(await call('/api/order-pix','POST',{token:pix.token})).body;assert.ok(qr.code.includes('15.00'));
 assert.equal((await call('/api/admin/orders/'+pix.id,'PATCH',{version:pix.version,status:'accepted',paymentStatus:'paid'},true)).response.status,200);
 const date=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 assert.equal((await call('/api/admin/metrics?date='+date,'GET',null,true)).body.received,3000);
 assert.equal((await call('/api/admin/expenses','POST',{requestKey:randomUUID(),amount:400,description:'Teste fictício'},true)).response.status,201);
 const yearly=(await call('/api/admin/metrics?from='+date.slice(0,4)+'-01-01&to='+date.slice(0,4)+'-12-31','GET',null,true)).body;assert.equal(yearly.series.reduce((sum,d)=>sum+d.spent,0),400);
 const photo=Buffer.from([255,216,255,224,1,1,255,217]);const upload=await call('/api/admin/photo','POST',{image:photo.toString('base64')},true);assert.equal(upload.response.status,201,JSON.stringify(upload.body));
 const download=await fetch(origin+upload.body.url);assert.equal(download.status,200);assert.deepEqual(new Uint8Array(await download.arrayBuffer()),new Uint8Array(photo));
 assert.ok((await call('/api/admin/push-key','GET',null,true)).body.publicKey);
 console.log('Cloudflare real: repetição e concorrência, adicionais, Pix, fila, cancelamento, caixa anual e upload D1 passaram no banco isolado.');
}finally{
 shop=(await call('/api/store')).body;
 await call('/api/admin/store','PATCH',{...shop,open:false},true);
 await call('/api/admin/logout','POST',{},true);
}
