import {clientAddress,proxyAddresses} from './client-address.mjs';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { loadAccess, matches, verifier, saveAccess, removeInitialPassword } from './access.mjs';
import {setupPush,validSubscription} from './push.mjs';
import {validatePix,pixCode} from './pix.mjs';
import { DatabaseSync } from 'node:sqlite';
import {currentCatalog,validateCatalog} from './catalog-admin.mjs';
import { products, extrasByCategory, categories } from '../dist/js/catalog.js';
if(process.env.NODE_ENV==='production'&&!/^https:\/\/[^/]+$/.test(process.env.PUBLIC_ORIGIN||''))throw new Error('Configure PUBLIC_ORIGIN com o domínio HTTPS antes de iniciar em produção.');
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const data = resolve(process.env.DATA_DIR || fileURLToPath(new URL('../data/', import.meta.url)));
if (data === resolve(root) || data.startsWith(resolve(root) + sep)) throw new Error('DATA_DIR deve ficar fora da pasta pública dist.');
await mkdir(data, { recursive: true });
let access = await loadAccess(data);
const db = new DatabaseSync(resolve(data, 'pedidos.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, request_key TEXT UNIQUE NOT NULL, token TEXT UNIQUE NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', payment TEXT NOT NULL DEFAULT 'pending', version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, order_id INTEGER, action TEXT NOT NULL, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY, request_key TEXT UNIQUE NOT NULL, amount INTEGER NOT NULL, description TEXT NOT NULL, created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at);`);
db.prepare('INSERT OR IGNORE INTO settings VALUES(1, ?)').run(JSON.stringify({ open: false, preparationMinutes: 30, deliveryFee: 0, paused: [], version: 1 }));
const push=await setupPush(data,db);
const settings = () => JSON.parse(db.prepare('SELECT value FROM settings WHERE id=1').get().value);
const trustedProxies=proxyAddresses(process.env.TRUST_PROXY_FROM);
const sessions = new Map(), limits = new Map(), stages = ['new', 'accepted', 'preparing', 'ready', 'delivered'];
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.webmanifest':'application/manifest+json' };
function metricsDay(date){
     const start=date+'T00:00:00-03:00', end=new Date(Date.parse(start)+86400000).toISOString();
     const since=new Date(start).toISOString();
     const paid=db.prepare("SELECT o.payload FROM orders o WHERE o.payment='paid' AND COALESCE((SELECT MAX(a.created_at) FROM audit a WHERE a.order_id=o.id AND json_extract(a.action,'$.payment')='paid' AND json_extract(a.action,'$.previousPayment')!='paid'),o.created_at)>=? AND COALESCE((SELECT MAX(a.created_at) FROM audit a WHERE a.order_id=o.id AND json_extract(a.action,'$.payment')='paid' AND json_extract(a.action,'$.previousPayment')!='paid'),o.created_at)<?").all(since,end).map(row=>JSON.parse(row.payload));
     const expenses=db.prepare('SELECT * FROM expenses WHERE created_at>=? AND created_at<? ORDER BY created_at DESC').all(since,end);
     const received=paid.reduce((sum,o)=>sum+o.total,0), deliveryFees=paid.reduce((sum,o)=>sum+o.deliveryFee,0), spent=expenses.reduce((sum,e)=>sum+e.amount,0);
     const created=db.prepare('SELECT COUNT(*) count FROM orders WHERE created_at>=? AND created_at<?').get(since,end).count;
     const delivered=db.prepare("SELECT COUNT(DISTINCT order_id) count FROM audit WHERE json_extract(action,'$.status')='delivered' AND json_extract(action,'$.previousStatus')!='delivered' AND created_at>=? AND created_at<?").get(since,end).count;
     return {date,received,deliveryFees,foodReceived:received-deliveryFees,spent,balance:received-spent,created,delivered,paidCount:paid.length,expenses};
}
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function rate(req, bucket, max) {
 const key = `${bucket}:${clientAddress(req,trustedProxies)}`, now = Date.now();
 let record = limits.get(key);
 if (!record || now > record.until) { record = { count: 0, until: now + 60000 }; limits.set(key, record); }
 if (++record.count > max) fail(429, 'Muitas tentativas. Aguarde um minuto.');
 if (limits.size > 10000) for (const [k, v] of limits) if (now > v.until) limits.delete(k);
}
async function body(req,maximum=262144) {
 if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'Envie JSON.');
 let size = 0; const chunks = [];
 for await (const chunk of req) { size += chunk.length; if (size > maximum) fail(413, 'Pedido muito grande.'); chunks.push(chunk); }
 try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { fail(400, 'Dados inválidos.'); }
}
function text(value, max, required = false) {
 if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) fail(400, 'Confira os campos do pedido.');
 return value.trim();
}
function auth(req) {
 const token = /(?:^|;\s*)renato_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
 const expires = sessions.get(token);
 if (!expires || expires < Date.now()) { sessions.delete(token); fail(401, 'Entre no painel para continuar.'); }
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
const server = createServer(async (req, res) => {
 const json = (status, value, headers = {}) => res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }).end(JSON.stringify(value));
 res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin'); res.setHeader('X-Frame-Options', 'DENY');
 res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
 res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
 if (process.env.PUBLIC_ORIGIN?.startsWith('https:')) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
 try {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname.startsWith('/api/')) {
   if (!['GET', 'POST', 'PATCH', 'PUT'].includes(req.method)) fail(405, 'Método não permitido.');
   if (req.method !== 'GET' && (!req.headers.origin || req.headers.origin !== (process.env.PUBLIC_ORIGIN || `http://${req.headers.host}`))) fail(403, 'Origem não permitida.');
   if (pathname === '/api/store' && req.method === 'GET') {const {pix,...shop}=settings();return json(200,{...shop,pixAvailable:!!pix?.enabled});}
   if(pathname==='/api/order-pix'&&req.method==='POST'){
    rate(req,'pix',60);const input=await body(req);if(!/^[a-zA-Z0-9_-]{32}$/.test(input?.token||''))fail(404,'Pedido não encontrado.');
    const row=db.prepare('SELECT * FROM orders WHERE token=?').get(input.token);if(!row)fail(404,'Pedido não encontrado.');
    const config=settings().pix;if(!config?.enabled)fail(409,'Pix ainda não configurado pelo Renato.');
    if(row.status==='cancelled'||row.payment==='paid')fail(409,'Este pedido não tem pagamento Pix pendente.');
    const order=JSON.parse(row.payload);if(order.paymentMethod!=='pix')fail(409,'Este pedido usa outra forma de pagamento.');
    return json(200,{code:pixCode(config,order.total,row.id),name:config.name,amount:order.total});
   }
   if (pathname === '/api/orders' && req.method === 'POST') {
    rate(req, 'orders', 20); const input = await body(req);
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(input?.requestKey || '')) fail(400, 'Identificador inválido.');
    const existing = db.prepare('SELECT * FROM orders WHERE request_key=?').get(input.requestKey);
    if (existing) return json(200, view(existing));
    const payload = createPayload(input, settings()), now = new Date().toISOString(), token = randomBytes(24).toString('base64url');
    const result = db.prepare('INSERT INTO orders(request_key,token,payload,created_at,updated_at) VALUES(?,?,?,?,?)').run(input.requestKey, token, JSON.stringify(payload), now, now);
    void push.send().catch(()=>{});
    return json(201, view(db.prepare('SELECT * FROM orders WHERE id=?').get(result.lastInsertRowid)));
   }
   if (pathname === '/api/order-status' && req.method === 'POST') {
    rate(req, 'tracking', 240); const input = await body(req);
    if (!/^[a-zA-Z0-9_-]{32}$/.test(input?.token || '')) fail(404, 'Pedido não encontrado.');
    const row = db.prepare('SELECT * FROM orders WHERE token=?').get(input.token);
    if (!row) fail(404, 'Pedido não encontrado.'); return json(200, view(row));
   }
   if (pathname === '/api/admin/login' && req.method === 'POST') {
    rate(req, 'login', 5); const input = await body(req);
    if (input?.username !== (process.env.ADMIN_USER || 'renato') || typeof input?.password !== 'string' || input.password.length > 200 || !matches(input.password, access)) fail(401, 'Usuário ou senha incorretos.');
    for (const [key, expiry] of sessions) if (expiry < Date.now()) sessions.delete(key);
    const token = randomBytes(32).toString('base64url'); sessions.set(token, Date.now() + 12 * 3600000);
    return json(200, { ok: true }, { 'Set-Cookie': `renato_session=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=43200${process.env.PUBLIC_ORIGIN?.startsWith('https:') ? '; Secure' : ''}` });
   }
   if (pathname.startsWith('/api/admin/')) {
    const token = auth(req);
    if(pathname==='/api/admin/push-key'&&req.method==='GET')return json(200,{publicKey:push.publicKey});
    if(pathname==='/api/admin/push-subscribe'&&req.method==='POST'){
     const input=await body(req);if(!validSubscription(input))fail(400,'Assinatura de notificação inválida ou navegador não suportado.');
     if(db.prepare('SELECT COUNT(*) count FROM push_subscriptions').get().count>=20&&!db.prepare('SELECT endpoint FROM push_subscriptions WHERE endpoint=?').get(input.endpoint))fail(409,'Limite de aparelhos atingido.');
     db.prepare('INSERT OR REPLACE INTO push_subscriptions VALUES(?,?)').run(input.endpoint,JSON.stringify({endpoint:input.endpoint,keys:input.keys}));return json(200,{ok:true});
    }
    if(pathname==='/api/admin/push-unsubscribe'&&req.method==='POST'){const input=await body(req);db.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').run(String(input?.endpoint||''));return json(200,{ok:true});}
    if(pathname==='/api/admin/push-test'&&req.method==='POST'){rate(req,'push-test',5);const input=await body(req);const result=await push.send(true,String(input?.endpoint||''));return json(200,result);}
    if(pathname==='/api/admin/pix'&&req.method==='POST'){rate(req,'pix-config',5);
     const input=await body(req);if(!matches(input?.currentPassword,access))fail(403,'Confirme a senha do painel para alterar o Pix.');let config;try{config=validatePix(input);}catch(error){fail(400,error.message);}
     const shop={...settings(),pix:config,version:settings().version+1};db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(shop));return json(200,{pix:config});
    }
    if (pathname === '/api/admin/password' && req.method === 'POST') {
     rate(req,'password',5); const input=await body(req);
     if(process.env.ADMIN_PASSWORD) fail(409,'A senha é gerenciada pela hospedagem. Altere no ambiente seguro.');
     if(!matches(input?.currentPassword,access)) fail(403,'Senha atual incorreta.');
     if(typeof input.newPassword !== 'string' || input.newPassword.length<12 || input.newPassword.length>200) fail(400,'Use entre 12 e 200 caracteres.');
     const next=verifier(input.newPassword); await saveAccess(data,next); access=next; sessions.clear();db.prepare("DELETE FROM push_subscriptions").run(); await removeInitialPassword(data);
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
      const series=Array.from({length:count},(_,i)=>{const day=metricsDay(new Date(Date.parse(from+'T12:00:00Z')+i*86400000).toISOString().slice(0,10));return {date:day.date,received:day.received,spent:day.spent,deliveryFees:day.deliveryFees};});
      return json(200,{series});
     }
     return json(200,metricsDay(date));
    }
    if(pathname==='/api/admin/expenses' && req.method==='POST') {
     const input=await body(req); if(!Number.isInteger(input?.amount) || input.amount<=0 || input.amount>10000000) fail(400,'Informe um valor de saída válido.');
     const description=text(input.description,120,true), now=new Date().toISOString();
     if(!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestKey || '')) fail(400,'Identificador inválido.');
     const existing=db.prepare('SELECT * FROM expenses WHERE request_key=?').get(input.requestKey);
     if(existing) { if(existing.amount!==input.amount || existing.description!==description) fail(409,'Essa saída já foi registrada com outros dados.'); return json(200,{id:existing.id}); }
     const result=db.prepare('INSERT INTO expenses(request_key,amount,description,created_at) VALUES(?,?,?,?)').run(input.requestKey,input.amount,description,now);
     return json(201,{id:Number(result.lastInsertRowid)});
    }
    if (pathname === '/api/admin/logout' && req.method === 'POST') { sessions.delete(token); return json(200, { ok: true }, { 'Set-Cookie': 'renato_session=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0' }); }
    if (pathname === '/api/admin/state' && req.method === 'GET') return json(200, { store: settings(), orders: db.prepare("SELECT * FROM orders WHERE status NOT IN ('delivered','cancelled') OR id IN (SELECT id FROM orders WHERE status IN ('delivered','cancelled') ORDER BY id DESC LIMIT 200) ORDER BY id DESC").all().map(row => view(row, true)), products: currentCatalog(settings()).products, catalog:currentCatalog(settings()) });
    if (pathname === '/api/admin/store' && req.method === 'PATCH') {
     const input = await body(req), previous = settings();
     if (input?.version !== previous.version) fail(409, 'A loja mudou em outro aparelho. Atualize e tente novamente.');
     if (typeof input.open !== 'boolean' || !Number.isInteger(input.preparationMinutes) || input.preparationMinutes < 5 || input.preparationMinutes > 180 || !Number.isInteger(input.deliveryFee) || input.deliveryFee < 0 || input.deliveryFee > 10000 || !Array.isArray(input.paused) || input.paused.some(id => !currentCatalog(previous).products.some(p => p.id === id))) fail(400, 'Confira tempo, taxa e produtos.');
     const next = { ...previous, open: input.open, preparationMinutes: input.preparationMinutes, deliveryFee: input.deliveryFee, paused: [...new Set(input.paused)], version: previous.version + 1 };
     db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(next)); return json(200, next);
    }
    if(pathname==='/api/admin/photo'&&req.method==='POST'){
     rate(req,'photo',10);const input=await body(req,3000000);if(typeof input.image!=='string'||! /^[A-Za-z0-9+/]+={0,2}$/.test(input.image))fail(400,'Foto inválida.');
     const photo=Buffer.from(input.image,'base64');if(photo.length>2000000||photo.length<8||photo[0]!==255||photo[1]!==216||photo[2]!==255||photo.at(-2)!==255||photo.at(-1)!==217)fail(400,'Use uma foto JPEG de até 2 MB.');
     const directory=resolve(data,'photos');await mkdir(directory,{recursive:true});if((await readdir(directory)).length>=200)fail(409,'Limite de fotos atingido. Use o endereço de uma foto existente.');
     const filename=randomBytes(16).toString('hex')+'.jpg';await writeFile(resolve(directory,filename),photo,{flag:'wx',mode:0o600});return json(201,{url:'/assets/uploads/'+filename});
    }
    if(pathname==='/api/admin/catalog'&&req.method==='PUT'){
     const input=await body(req),previous=settings();if(input.version!==previous.version)fail(409,'O cardápio mudou. Atualize e tente novamente.');
     let catalog;try{catalog=validateCatalog(input.catalog);}catch(error){fail(400,error.message);}
     db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify({...previous,catalog,paused:previous.paused.filter(id=>catalog.products.some(p=>p.id===id)),version:previous.version+1}));return json(200,{ok:true});
    }
    const match = /^\/api\/admin\/orders\/(\d+)$/.exec(pathname);
    if (match && req.method === 'PATCH') {
     const input = await body(req), row = db.prepare('SELECT * FROM orders WHERE id=?').get(Number(match[1]));
     if (!row) fail(404, 'Pedido não encontrado.');
     if (input?.version !== row.version) fail(409, 'Este pedido mudou. Atualize e tente novamente.');
     const status = input.status ?? row.status, payment = input.paymentStatus ?? row.payment;
     if (status === 'cancelled' && status !== row.status && !['new','accepted'].includes(row.status)) fail(409, 'O preparo já começou. Esse pedido não pode mais ser cancelado.');
     if (status !== row.status && !(status === stages[stages.indexOf(row.status) + 1] && row.status !== 'cancelled') && !(status === 'cancelled' && ['new','accepted'].includes(row.status))) fail(400, 'Etapa inválida para este pedido.');
     if (!['pending', 'paid'].includes(payment)) fail(400, 'Pagamento inválido.');
     if(['accepted','preparing','ready'].includes(status)&&JSON.parse(row.payload).paymentTiming==='before'&&payment!=='paid')fail(409,'Confira o Pix no Nubank e confirme o recebimento antes de aceitar.');
     if (status === 'delivered' && payment !== 'paid') fail(409, 'Confira o recebimento e marque como pago antes de entregar.');
     const now = new Date().toISOString(); db.exec('BEGIN IMMEDIATE');
     try {
      db.prepare('UPDATE orders SET status=?,payment=?,version=version+1,updated_at=? WHERE id=?').run(status, payment, now, row.id);
      db.prepare('INSERT INTO audit(order_id,action,created_at) VALUES(?,?,?)').run(row.id, JSON.stringify({ status, payment, previousStatus: row.status, previousPayment: row.payment }), now); db.exec('COMMIT');
     } catch (error) { db.exec('ROLLBACK'); throw error; }
     return json(200, view(db.prepare('SELECT * FROM orders WHERE id=?').get(row.id), true));
    }
   }
   fail(404, 'Rota não encontrada.');
  }
  if(pathname.startsWith('/assets/uploads/')&&req.method==='GET'){
   const filename=pathname.slice('/assets/uploads/'.length);if(!/^[a-f0-9]{32}\.jpg$/.test(filename))fail(404,'Foto não encontrada.');let photo;try{photo=await readFile(resolve(data,'photos',filename));}catch{fail(404,'Foto não encontrada.');}return res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=31536000, immutable'}).end(photo);
  }
  if(pathname==='/js/catalog.js'&&req.method==='GET'){
   const catalog=currentCatalog(settings());return res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}).end('export const categories='+JSON.stringify(categories)+';export const products='+JSON.stringify(catalog.products)+';export const extrasByCategory='+JSON.stringify(catalog.extrasByCategory)+';export const extrasByProduct='+JSON.stringify(catalog.extrasByProduct||{})+';export const currency=value=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value/100);');
  }
  const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname === '/painel' || pathname === '/painel/' ? '/painel.html' : pathname));
  if (!path.startsWith(resolve(root) + sep)) fail(403, 'Acesso não permitido.');
  if (pathname.split(/[\\/]/).some(part => part.startsWith('.')) || !Object.hasOwn(mime, extname(path))) fail(404, 'Arquivo não encontrado.');
  let content; try { content = await readFile(path); } catch { fail(404, 'Arquivo não encontrado.'); }
  res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(content);
 } catch (error) {
  if (typeof error.code !== 'number') console.error('Falha no servidor:', error.message);
  json(typeof error.code === 'number' ? error.code : 500, { error: typeof error.code === 'number' ? error.message : 'Não foi possível concluir. Tente novamente.' });
 }
});
const port = Number(process.env.PORT || 4173);
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Renato: http://127.0.0.1:${server.address().port} · Painel: http://127.0.0.1:${server.address().port}/painel`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));


