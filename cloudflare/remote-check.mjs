import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.argv[2];if(!origin?.startsWith('https://'))throw new Error('Informe a URL HTTPS do Worker.');
const password=(await readFile(new URL('../data/acesso-cloudflare.txt',import.meta.url),'utf8')).trim();
const page=await fetch(origin);assert.equal(page.status,200);assert.ok(page.headers.get('Content-Security-Policy'));
for(const path of ['/painel','/painel/']){const panel=await fetch(origin+path);assert.equal(panel.status,200,path);assert.ok((await panel.text()).includes('panel-design.css'));}
const store=await(await fetch(origin+'/api/store')).json();assert.equal(store.open,false);assert.equal(store.pix,undefined);
assert.equal((await fetch(origin+'/api/admin/state')).status,401);
const bad=await fetch(origin+'/api/admin/login',{method:'POST',headers:{Origin:'https://invalid.example','Content-Type':'application/json'},body:JSON.stringify({username:'renato',password})});assert.equal(bad.status,403);
const login=await fetch(origin+'/api/admin/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'renato',password})});
assert.equal(login.status,200,await login.clone().text());const cookie=login.headers.get('Set-Cookie').split(';')[0];assert.match(login.headers.get('Set-Cookie'),/Secure/);
for(const path of ['/api/admin/state','/api/admin/metrics','/api/admin/metrics?from=2026-01-01&to=2026-12-31','/api/admin/push-key']){
 const response=await fetch(origin+path,{headers:{Cookie:cookie}});assert.equal(response.status,200,path+': '+await response.clone().text());
 const result=await response.json();if(path==='/api/admin/state'){assert.equal(result.orders.length,0);assert.equal(result.store.open,false);}
}
for(const path of ['/data/acesso-painel.txt','/.env','/cloudflare/worker.mjs','/package.json','/scripts/server.mjs','/js/nav-dock.js.map'])assert.equal((await fetch(origin+path)).status,404,path);
const logout=await fetch(origin+'/api/admin/logout',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:'{}'});assert.equal(logout.status,200);
assert.equal((await fetch(origin+'/api/admin/state',{headers:{Cookie:cookie}})).status,401);
console.log('Cloudflare: HTTPS, acesso, isolamento de dados, métricas anuais e chaves push verificados. Loja fechada, sem pedidos de teste.');
