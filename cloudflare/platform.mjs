import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import webpush from 'web-push';

export const digest = value => createHash('sha256').update(value).digest('hex');
export function database(binding) {
 return { prepare(sql) { return {
  get: (...args) => binding.prepare(sql).bind(...args).first(),
  all: async (...args) => (await binding.prepare(sql).bind(...args).all()).results,
  run: async (...args) => {const result=await binding.prepare(sql).bind(...args).run();return {...result.meta,lastInsertRowid:result.meta.last_row_id};}
 };}};
}
export async function verifier(password) {
 const salt=randomBytes(16).toString('hex');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const hash=Buffer.from(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256)).toString('hex');
 return {salt,hash};
}
export async function matches(password,record) {
 if(typeof password!=='string'||password.length>200||!record)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const hash=Buffer.from(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(record.salt),iterations:100000,hash:'SHA-256'},key,256));
 return timingSafeEqual(hash,Buffer.from(record.hash,'hex'));
}
export async function accessRecord(db,env) {
 let row=await db.prepare("SELECT value FROM app_secrets WHERE id='access'").get();
 if(!row){
  if(typeof env.ADMIN_PASSWORD!=='string'||env.ADMIN_PASSWORD.length<12)throw new Error('Acesso não configurado.');
  await db.prepare("INSERT OR IGNORE INTO app_secrets VALUES('access',?)").run(JSON.stringify(await verifier(env.ADMIN_PASSWORD)));
  row=await db.prepare("SELECT value FROM app_secrets WHERE id='access'").get();
 }
 return JSON.parse(row.value);
}
export async function saveAccess(db,record) {await db.prepare("UPDATE app_secrets SET value=? WHERE id='access'").run(JSON.stringify(record));}
export async function setupPush(db,origin) {
 let row=await db.prepare("SELECT value FROM app_secrets WHERE id='push'").get();
 if(!row){await db.prepare("INSERT OR IGNORE INTO app_secrets VALUES('push',?)").run(JSON.stringify(webpush.generateVAPIDKeys()));row=await db.prepare("SELECT value FROM app_secrets WHERE id='push'").get();}
 const keys=JSON.parse(row.value);
 async function send(test=false,endpoint){
  const rows=endpoint?await db.prepare('SELECT * FROM push_subscriptions WHERE endpoint=?').all(endpoint):await db.prepare('SELECT * FROM push_subscriptions').all();
  const results=await Promise.all(rows.map(async row=>{let generated=false;try{
   const details=webpush.generateRequestDetails(JSON.parse(row.payload),JSON.stringify({title:test?'Teste do Renato':'Novo pedido no trailer',body:test?'O aviso chegou. Confira também o som do celular.':'Abra o painel para conferir a fila.',tag:test?'renato-test-'+Date.now():'renato-new-order'}),{TTL:300,vapidDetails:{subject:origin,publicKey:keys.publicKey,privateKey:keys.privateKey}});
   generated=true;
   const response=await fetch(details.endpoint,{method:'POST',headers:details.headers,body:details.body,redirect:'error',signal:AbortSignal.timeout(8000)});
   if([404,410].includes(response.status))await db.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').run(row.endpoint);
   return response.ok?'accepted':[404,410].includes(response.status)?'subscription-expired':'provider-rejected';
  }catch{return generated?'network-error':'encryption-error';}}));
  return {sent:results.filter(x=>x==='accepted').length,failed:results.filter(x=>x!=='accepted').length,reason:results.find(x=>x!=='accepted')||(rows.length?'accepted':'not-registered')};
 }
 return {publicKey:keys.publicKey,send};
}
