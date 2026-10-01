import {randomBytes} from 'node:crypto';
import {database,digest,accessRecord,matches,verifier,saveAccess,setupPush} from './platform.mjs';
import {validSubscription} from '../scripts/push.mjs';
import {validatePix,pixCode} from '../scripts/pix.mjs';
import {currentCatalog,validateCatalog} from '../scripts/catalog-admin.mjs';
import {categories} from '../dist/js/catalog.js';
export default {async fetch(request,env,ctx){
 const origin=env.PUBLIC_ORIGIN||new URL(request.url).origin;
 const db=database(env.DB);
 const settings=async()=>JSON.parse((await db.prepare('SELECT value FROM settings WHERE id=1').get()).value);
 let access;
 const push={get publicKey(){return this.instance.publicKey;},instance:null,async send(...args){this.instance||=await setupPush(db,origin);return this.instance.send(...args);}};
 const stages=['new','accepted','preparing','ready','delivered'];
 const req={url:request.url,method:request.method,headers:Object.fromEntries(request.headers),async *[Symbol.asyncIterator](){if(!request.body)return;const reader=request.body.getReader();try{while(true){const {done,value}=await reader.read();if(done)break;yield value;}}finally{reader.releaseLock();}}};
 const res={headers:new Headers(),status:200,setHeader(k,v){this.headers.set(k,v);},writeHead(status,headers){this.status=status;for(const [k,v] of Object.entries(headers))this.headers.set(k,v);return this;},end(body){return new Response(body,{status:this.status,headers:this.headers});}};
async function saveSettings(next,version){
 const result=await db.prepare("UPDATE settings SET value=? WHERE id=1 AND json_extract(value,'$.version')=?").run(JSON.stringify(next),version);
 if(result.changes!==1)fail(409,'A loja mudou. Atualize e tente novamente.');
}
async function metricsDay(date){
     const start=date+'T00:00:00-03:00', end=new Date(Date.parse(start)+86400000).toISOString();
     const since=new Date(start).toISOString();
     const paid=(await db.prepare("SELECT o.payload FROM orders o WHERE o.payment='paid' AND COALESCE((SELECT MAX(a.created_at) FROM audit a WHERE a.order_id=o.id AND json_extract(a.action,'$.payment')='paid' AND json_extract(a.action,'$.previousPayment')!='paid'),o.created_at)>=? AND COALESCE((SELECT MAX(a.created_at) FROM audit a WHERE a.order_id=o.id AND json_extract(a.action,'$.payment')='paid' AND json_extract(a.action,'$.previousPayment')!='paid'),o.created_at)<?").all(since,end)).map(row=>JSON.parse(row.payload));
     const expenses=(await db.prepare('SELECT * FROM expenses WHERE created_at>=? AND created_at<? ORDER BY created_at DESC').all(since,end));
     const received=paid.reduce((sum,o)=>sum+o.total,0), deliveryFees=paid.reduce((sum,o)=>sum+o.deliveryFee,0), spent=expenses.reduce((sum,e)=>sum+e.amount,0);
     const created=(await db.prepare('SELECT COUNT(*) count FROM orders WHERE created_at>=? AND created_at<?').get(since,end)).count;
     const delivered=(await db.prepare("SELECT COUNT(DISTINCT order_id) count FROM audit WHERE json_extract(action,'$.status')='delivered' AND json_extract(action,'$.previousStatus')!='delivered' AND created_at>=? AND created_at<?").get(since,end)).count;
     return {date,received,deliveryFees,foodReceived:received-deliveryFees,spent,balance:received-spent,created,delivered,paidCount:paid.length,expenses};
}
async function metricsRange(from,to,count){
 const since=new Date(from+'T00:00:00-03:00').toISOString(),end=new Date(Date.parse(to+'T00:00:00-03:00')+86400000).toISOString();
 const paid=await db.prepare("SELECT substr(datetime(COALESCE((SELECT MAX(a.created_at) FROM audit a WHERE a.order_id=o.id AND json_extract(a.action,'$.payment')='paid' AND json_extract(a.action,'$.previousPayment')!='paid'),o.created_at),'-3 hours'),1,10) date,SUM(json_extract(o.payload,'$.total')) received,SUM(json_extract(o.payload,'$.deliveryFee')) deliveryFees FROM orders o WHERE o.payment='paid' GROUP BY date HAVING date>=? AND date<=?").all(from,to);
 const spent=await db.prepare("SELECT substr(datetime(created_at,'-3 hours'),1,10) date,SUM(amount) spent FROM expenses WHERE created_at>=? AND created_at<? GROUP BY date").all(since,end);
 const receipts=new Map(paid.map(row=>[row.date,row])),expenses=new Map(spent.map(row=>[row.date,row.spent]));
 return Array.from({length:count},(_,i)=>{const date=new Date(Date.parse(from+'T12:00:00Z')+i*86400000).toISOString().slice(0,10),row=receipts.get(date);return {date,received:row?.received||0,deliveryFees:row?.deliveryFees||0,spent:expenses.get(date)||0};});
}
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
async function rate(req,bucket,max) {
 const now=Date.now(),id=bucket+':'+digest(req.headers['cf-connecting-ip']||'local')+':'+Math.floor(now/60000);
 const row=await db.prepare('INSERT INTO limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').get(id,now+120000);
 if(row.count>max)fail(429,'Muitas tentativas. Aguarde um minuto.');
 ctx.waitUntil(db.prepare('DELETE FROM limits WHERE expires<?').run(now));
}
async function body(req,maximum=262144) {
 if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'Envie JSON.');
 let size = 0; const chunks = [];
 for await (const chunk of req) { size += chunk.length; if (size > maximum) fail(413, 'Pedido muito grande.'); chunks.push(chunk); }
 try { const value=JSON.parse(Buffer.concat(chunks).toString());if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Dados inválidos.');return value; } catch { fail(400, 'Dados inválidos.'); }
}
function text(value, max, required = false) {
 if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) fail(400, 'Confira os campos do pedido.');
 return value.trim();
}
async function auth(req) {
 const token=/(?:^|;\s*)renato_session=([^;]+)/.exec(req.headers.cookie||'')?.[1];
 if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))fail(401,'Entre no painel para continuar.');
 const row=await db.prepare('SELECT expires FROM sessions WHERE token_hash=?').get(digest(token));
 if(!row||row.expires<Date.now())fail(401,'Entre no painel para continuar.');
 return token;
}
function view(row, admin = false) {
 const payload = JSON.parse(row.payload);
 const details = admin ? payload : { customer: payload.customer.split(/\s+/)[0], fulfillment: payload.fulfillment, paymentMethod: payload.paymentMethod, paymentTiming:payload.paymentTiming, items: payload.items, subtotal: payload.subtotal, deliveryFee: payload.deliveryFee, total: payload.total, preparationMinutes: payload.preparationMinutes };
 return { id: row.id, number: String(row.id).padStart(4, '0'), ...details, status: row.status, paymentStatus: row.payment, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at, ...(admin ? {} : { token: row.token }) };
}
function createPayload(input, shop) {
 const {products,extrasByCategory,extrasByProduct}=currentCatalog(shop);
 if (!shop.open) fail(409, 'A loja está fechada agora. Fale com o Renato pelo WhatsApp.');
 if (!['pickup', 'delivery'].includes(input.fulfillment) || !['pix', 'pix-later', 'cash', 'card'].includes(input.paymentMethod)) fail(400, 'Escolha retirada ou entrega e a forma de pagamento.');
 const customer = text(input.customer, 80, true), phone = text(input.phone, 20, true);
 if (!/^\d{10,13}$/.test(phone.replace(/\D/g, ''))) fail(400, 'Informe um telefone com DDD.');
 const address = text(input.address || '', 250, input.fulfillment === 'delivery'), notes = text(input.notes || '', 300);
 if (!Array.isArray(input.items) || !input.items.length || input.items.length > products.length) fail(400, 'Escolha os itens do pedido.');
 const seen = new Set();
 const items = input.items.map(item => {
  const product = products.find(p => p.id === item?.id);
  if (!product || product.price === null || seen.has(product.id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) fail(400, 'Item ou quantidade inválida.');
  seen.add(product.id);
  if (shop.paused.includes(product.id)) fail(409, `${product.name} acabou por hoje. Retire esse item do pedido.`);
  if (!Array.isArray(item.extras) || item.extras.length > 10 || new Set(item.extras).size !== item.extras.length) fail(400, 'Adicionais inválidos.');
  const extras = item.extras.map(id => { const extra = (extrasByProduct?.[product.id] ?? extrasByCategory[product.category] ?? []).find(e => e.id === id); if (!extra) fail(400, 'Adicional inválido.'); return extra; });
  const unitPrice = product.price + extras.reduce((sum, e) => sum + e.price, 0);
  return { id: product.id, name: product.name, quantity: item.quantity, extras, unitPrice, total: unitPrice * item.quantity };
 });
 const subtotal = items.reduce((sum, item) => sum + item.total, 0), deliveryFee = input.fulfillment === 'delivery' ? shop.deliveryFee : 0;
 if (input.expectedTotal !== subtotal + deliveryFee) fail(409, 'O total mudou. Confira o pedido e envie novamente.');
 return { customer, phone, address, notes, fulfillment: input.fulfillment, paymentMethod: input.paymentMethod==='pix-later'?'pix':input.paymentMethod, paymentTiming:input.paymentMethod==='pix'&&shop.pix?.enabled?'before':'on-receipt', items, subtotal, deliveryFee, total: subtotal + deliveryFee, preparationMinutes: shop.preparationMinutes };
}

 const json = (status, value, headers = {}) => res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }).end(JSON.stringify(value));
 res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); res.setHeader('X-Frame-Options', 'DENY');
 res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
 res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
 if (origin?.startsWith('https:')) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
 try {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname.startsWith('/api/')) {
   if (!['GET', 'POST', 'PATCH', 'PUT'].includes(req.method)) fail(405, 'Método não permitido.');
   if (req.method !== 'GET' && (!req.headers.origin || req.headers.origin !== (origin || `http://${req.headers.host}`))) fail(403, 'Origem não permitida.');
   if (pathname === '/api/store' && req.method === 'GET') {const {pix,...shop}=(await settings());return json(200,{...shop,pixAvailable:!!pix?.enabled});}
   if(pathname==='/api/order-pix'&&req.method==='POST'){
    await rate(req,'pix',60);const input=await body(req);if(!/^[a-zA-Z0-9_-]{32}$/.test(input?.token||''))fail(404,'Pedido não encontrado.');
    const row=(await db.prepare('SELECT * FROM orders WHERE token=?').get(input.token));if(!row)fail(404,'Pedido não encontrado.');
    const config=(await settings()).pix;if(!config?.enabled)fail(409,'Pix ainda não configurado pelo Renato.');
    if(row.status==='cancelled'||row.payment==='paid')fail(409,'Este pedido não tem pagamento Pix pendente.');
    const order=JSON.parse(row.payload);if(order.paymentMethod!=='pix')fail(409,'Este pedido usa outra forma de pagamento.');
    return json(200,{code:pixCode(config,order.total,row.id),name:config.name,amount:order.total});
   }
   if (pathname === '/api/orders' && req.method === 'POST') {
    await rate(req, 'orders', 20); const input = await body(req);
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(input?.requestKey || '')) fail(400, 'Identificador inválido.');
    const existing = (await db.prepare('SELECT * FROM orders WHERE request_key=?').get(input.requestKey));
    if (existing) return json(200, view(existing));
    const payload = createPayload(input, (await settings())), now = new Date().toISOString(), token = randomBytes(24).toString('base64url');
    const result = await db.prepare('INSERT OR IGNORE INTO orders(request_key,token,payload,created_at,updated_at) VALUES(?,?,?,?,?)').run(input.requestKey, token, JSON.stringify(payload), now, now);
    if(result.changes)ctx.waitUntil(push.send().catch(()=>{}));
    return json(result.changes?201:200, view(await db.prepare('SELECT * FROM orders WHERE request_key=?').get(input.requestKey)));
   }
   if (pathname === '/api/order-status' && req.method === 'POST') {
    await rate(req, 'tracking', 240); const input = await body(req);
    if (!/^[a-zA-Z0-9_-]{32}$/.test(input?.token || '')) fail(404, 'Pedido não encontrado.');
    const row = (await db.prepare('SELECT * FROM orders WHERE token=?').get(input.token));
    if (!row) fail(404, 'Pedido não encontrado.'); return json(200, view(row));
   }
   if (pathname === '/api/admin/login' && req.method === 'POST') {
    await rate(req, 'login', 5); const input = await body(req);access=await accessRecord(db,env);
    if (input?.username !== (env.ADMIN_USER || 'renato') || typeof input?.password !== 'string' || input.password.length > 200 || !await matches(input.password, access)) fail(401, 'Usuário ou senha incorretos.');
    await db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
    const token = randomBytes(32).toString('base64url'); await db.prepare('INSERT INTO sessions VALUES(?,?)').run(digest(token),Date.now()+12*3600000);
    return json(200, { ok: true }, { 'Set-Cookie': `renato_session=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=43200${origin?.startsWith('https:') ? '; Secure' : ''}` });
   }
   if (pathname.startsWith('/api/admin/')) {
    const token = await auth(req);access=await accessRecord(db,env);
    if(pathname==='/api/admin/push-key'&&req.method==='GET')return json(200,{publicKey:(await setupPush(db,origin)).publicKey});
    if(pathname==='/api/admin/push-subscribe'&&req.method==='POST'){
     const input=await body(req);if(!validSubscription(input))fail(400,'Assinatura de notificação inválida ou navegador não suportado.');
     if((await db.prepare('SELECT COUNT(*) count FROM push_subscriptions').get()).count>=20&&!(await db.prepare('SELECT endpoint FROM push_subscriptions WHERE endpoint=?').get(input.endpoint)))fail(409,'Limite de aparelhos atingido.');
     (await db.prepare('INSERT OR REPLACE INTO push_subscriptions VALUES(?,?)').run(input.endpoint,JSON.stringify({endpoint:input.endpoint,keys:input.keys})));return json(200,{ok:true});
    }
    if(pathname==='/api/admin/push-unsubscribe'&&req.method==='POST'){const input=await body(req);(await db.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').run(String(input?.endpoint||'')));return json(200,{ok:true});}
    if(pathname==='/api/admin/push-test'&&req.method==='POST'){await rate(req,'push-test',5);const input=await body(req);const result=await push.send(true,String(input?.endpoint||''));return json(200,result);}
    if(pathname==='/api/admin/pix'&&req.method==='POST'){await rate(req,'pix-config',5);
     const input=await body(req);if(!await matches(input?.currentPassword,access))fail(403,'Confirme a senha do painel para alterar o Pix.');let config;try{config=validatePix(input);}catch(error){fail(400,error.message);}
     const previous=await settings(),shop={...previous,pix:config,version:previous.version+1};await saveSettings(shop,previous.version);return json(200,{pix:config});
    }
    if (pathname === '/api/admin/password' && req.method === 'POST') {
     await rate(req,'password',5); const input=await body(req);
     
     if(!await matches(input?.currentPassword,access)) fail(403,'Senha atual incorreta.');
     if(typeof input.newPassword !== 'string' || input.newPassword.length<12 || input.newPassword.length>200) fail(400,'Use entre 12 e 200 caracteres.');
     const next=await verifier(input.newPassword); await saveAccess(db,next); access=next; await db.prepare('DELETE FROM sessions').run();(await db.prepare("DELETE FROM push_subscriptions").run());
     return json(200,{ok:true},{'Set-Cookie':'renato_session=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0'});
    }
    if (pathname === '/api/admin/metrics' && req.method === 'GET') {
     const date=new URL(req.url,'http://localhost').searchParams.get('date') || new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
     if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date+'T00:00:00-03:00')) || new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date) fail(400,'Data inválida.');
     const params=new URL(req.url,'http://localhost').searchParams;
     if(params.has('from')||params.has('to')){
      const from=params.get('from'),to=params.get('to');
      const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
      if(!valid(from)||!valid(to))fail(400,'Período inválido.');
      const count=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
      if(count<1||count>366)fail(400,'Escolha até um ano de cada vez.');
      const series=await metricsRange(from,to,count);
      return json(200,{series});
     }
     return json(200,await metricsDay(date));
    }
    if(pathname==='/api/admin/expenses' && req.method==='POST') {
     const input=await body(req); if(!Number.isInteger(input?.amount) || input.amount<=0 || input.amount>10000000) fail(400,'Informe um valor de saída válido.');
     const description=text(input.description,120,true), now=new Date().toISOString();
     if(!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestKey || '')) fail(400,'Identificador inválido.');
     const existing=(await db.prepare('SELECT * FROM expenses WHERE request_key=?').get(input.requestKey));
     if(existing) { if(existing.amount!==input.amount || existing.description!==description) fail(409,'Essa saída já foi registrada com outros dados.'); return json(200,{id:existing.id}); }
     const result=(await db.prepare('INSERT INTO expenses(request_key,amount,description,created_at) VALUES(?,?,?,?)').run(input.requestKey,input.amount,description,now));
     return json(201,{id:Number(result.lastInsertRowid)});
    }
    if (pathname === '/api/admin/logout' && req.method === 'POST') { await db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token)); return json(200, { ok: true }, { 'Set-Cookie': 'renato_session=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0' }); }
    if (pathname === '/api/admin/state' && req.method === 'GET') return json(200, { store: (await settings()), orders: (await db.prepare("SELECT * FROM orders WHERE status NOT IN ('delivered','cancelled') OR id IN (SELECT id FROM orders WHERE status IN ('delivered','cancelled') ORDER BY id DESC LIMIT 200) ORDER BY id DESC").all()).map(row => view(row, true)), products: currentCatalog((await settings())).products, catalog:currentCatalog((await settings())) });
    if (pathname === '/api/admin/store' && req.method === 'PATCH') {
     const input = await body(req), previous = (await settings());
     if (input?.version !== previous.version) fail(409, 'A loja mudou em outro aparelho. Atualize e tente novamente.');
     if (typeof input.open !== 'boolean' || !Number.isInteger(input.preparationMinutes) || input.preparationMinutes < 5 || input.preparationMinutes > 180 || !Number.isInteger(input.deliveryFee) || input.deliveryFee < 0 || input.deliveryFee > 10000 || !Array.isArray(input.paused) || input.paused.some(id => !currentCatalog(previous).products.some(p => p.id === id))) fail(400, 'Confira tempo, taxa e produtos.');
     const next = { ...previous, open: input.open, preparationMinutes: input.preparationMinutes, deliveryFee: input.deliveryFee, paused: [...new Set(input.paused)], version: previous.version + 1 };
     await saveSettings(next,previous.version); return json(200, next);
    }
    if(pathname==='/api/admin/photo'&&req.method==='POST'){
     await rate(req,'photo',10);const input=await body(req,3000000);if(typeof input.image!=='string'||! /^[A-Za-z0-9+/]+={0,2}$/.test(input.image))fail(400,'Foto inválida.');
     const photo=Buffer.from(input.image,'base64');if(photo.length>500000||photo.length<8||photo[0]!==255||photo[1]!==216||photo[2]!==255||photo.at(-2)!==255||photo.at(-1)!==217)fail(400,'Use uma foto JPEG de até 500 KB.');
     if((await db.prepare('SELECT COUNT(*) count FROM photos').get()).count>=200)fail(409,'Limite de fotos atingido. Use o endereço de uma foto existente.');
     const filename=randomBytes(16).toString('hex')+'.jpg';await db.prepare('INSERT INTO photos VALUES(?,?)').run(filename,[...photo]);return json(201,{url:'/assets/uploads/'+filename});
    }
    if(pathname==='/api/admin/catalog'&&req.method==='PUT'){
     const input=await body(req),previous=(await settings());if(input.version!==previous.version)fail(409,'O cardápio mudou. Atualize e tente novamente.');
     let catalog;try{catalog=validateCatalog(input.catalog);}catch(error){fail(400,error.message);}
     await saveSettings({...previous,catalog,paused:previous.paused.filter(id=>catalog.products.some(p=>p.id===id)),version:previous.version+1},previous.version);return json(200,{ok:true});
    }
    const match = /^\/api\/admin\/orders\/(\d+)$/.exec(pathname);
    if (match && req.method === 'PATCH') {
     const input = await body(req), row = (await db.prepare('SELECT * FROM orders WHERE id=?').get(Number(match[1])));
     if (!row) fail(404, 'Pedido não encontrado.');
     if (input?.version !== row.version) fail(409, 'Este pedido mudou. Atualize e tente novamente.');
     const status = input.status ?? row.status, payment = input.paymentStatus ?? row.payment;
     if (status === 'cancelled' && status !== row.status && !['new','accepted'].includes(row.status)) fail(409, 'O preparo já começou. Esse pedido não pode mais ser cancelado.');
     if (status !== row.status && !(status === stages[stages.indexOf(row.status) + 1] && row.status !== 'cancelled') && !(status === 'cancelled' && ['new','accepted'].includes(row.status))) fail(400, 'Etapa inválida para este pedido.');
     if (!['pending', 'paid'].includes(payment)) fail(400, 'Pagamento inválido.');
     if(['accepted','preparing','ready'].includes(status)&&JSON.parse(row.payload).paymentTiming==='before'&&payment!=='paid')fail(409,'Confira o Pix no Nubank e confirme o recebimento antes de aceitar.');
     if (status === 'delivered' && payment !== 'paid') fail(409, 'Confira o recebimento e marque como pago antes de entregar.');
     const now=new Date().toISOString();
     const result=await env.DB.batch([
      env.DB.prepare('INSERT INTO audit(order_id,action,created_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM orders WHERE id=? AND version=?)').bind(row.id,JSON.stringify({status,payment,previousStatus:row.status,previousPayment:row.payment}),now,row.id,row.version),
      env.DB.prepare('UPDATE orders SET status=?,payment=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(status,payment,now,row.id,row.version)
     ]);
     if(result[1].meta.changes!==1)fail(409,'Este pedido mudou. Atualize e tente novamente.');
     return json(200, view((await db.prepare('SELECT * FROM orders WHERE id=?').get(row.id)), true));
    }
   }
   fail(404, 'Rota não encontrada.');
  }
  if(pathname.startsWith('/assets/uploads/')&&req.method==='GET'){
   const filename=pathname.slice('/assets/uploads/'.length);if(!/^[a-f0-9]{32}\.jpg$/.test(filename))fail(404,'Foto não encontrada.');const row=await db.prepare('SELECT content FROM photos WHERE filename=?').get(filename);if(!row)fail(404,'Foto não encontrada.');const photo=new Uint8Array(row.content);return res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=31536000, immutable'}).end(photo);
  }
  if(pathname==='/js/catalog.js'&&req.method==='GET'){
   const catalog=currentCatalog((await settings()));return res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}).end('export const categories='+JSON.stringify(categories)+';export const products='+JSON.stringify(catalog.products)+';export const extrasByCategory='+JSON.stringify(catalog.extrasByCategory)+';export const extrasByProduct='+JSON.stringify(catalog.extrasByProduct||{})+';export const currency=value=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value/100);');
  }
  if(!['GET','HEAD'].includes(req.method))fail(405,'Método não permitido.');
  if(pathname.split(/[\\/]/).some(part=>part.startsWith('.'))||pathname.includes('\\'))fail(404,'Arquivo não encontrado.');
  const assetURL=new URL(req.url);if(pathname==='/')assetURL.pathname='/index.html';if(pathname==='/painel'||pathname==='/painel/')assetURL.pathname='/painel.html';
  const asset=await env.ASSETS.fetch(new Request(assetURL,request));
  const headers=new Headers(asset.headers);for(const [key,value] of res.headers)headers.set(key,value);
  headers.set('Cache-Control','no-cache');
  return new Response(asset.body,{status:asset.status,headers});
 } catch (error) {
  if (typeof error.code !== 'number') console.error('Falha no servidor:', error.message);
  return json(typeof error.code === 'number' ? error.code : 500, { error: typeof error.code === 'number' ? error.message : 'Não foi possível concluir. Tente novamente.' });
 }

}};
