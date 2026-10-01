import webpush from 'web-push';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export function validSubscription(value){
 try{const url=new URL(value?.endpoint);return url.protocol==='https:'&&!url.username&&!url.password&&(!url.port||url.port==='443')&&['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(url.hostname)&&url.href.length<2048&&/^[a-zA-Z0-9_-]{40,200}$/.test(value.keys?.p256dh)&&/^[a-zA-Z0-9_-]{16,100}$/.test(value.keys?.auth);}catch{return false;}
}
export async function setupPush(data,db){
 const path=join(data,'push-keys.json');let keys;
 try{keys=JSON.parse(await readFile(path,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;keys=webpush.generateVAPIDKeys();await writeFile(path,JSON.stringify(keys),{mode:0o600});}
 webpush.setVapidDetails(process.env.PUSH_SUBJECT||'https://renato.invalid',keys.publicKey,keys.privateKey);
 db.exec('CREATE TABLE IF NOT EXISTS push_subscriptions(endpoint TEXT PRIMARY KEY,payload TEXT NOT NULL)');
 async function send(test=false,endpoint){
  const rows=endpoint?db.prepare('SELECT * FROM push_subscriptions WHERE endpoint=?').all(endpoint):db.prepare('SELECT * FROM push_subscriptions').all();
  const results=await Promise.all(rows.map(async row=>{try{await webpush.sendNotification(JSON.parse(row.payload),JSON.stringify({title:test?'Teste do Renato':'Novo pedido no trailer',body:test?'O aviso chegou. Confira também o som do celular.':'Abra o painel para conferir a fila.',tag:test?'renato-test':'renato-new-order'}),{TTL:300,timeout:8000});return true;}catch(error){if([404,410].includes(error.statusCode))db.prepare('DELETE FROM push_subscriptions WHERE endpoint=?').run(row.endpoint);return false;}}));
  return {sent:results.filter(Boolean).length,failed:results.filter(result=>!result).length};
 }
 return {publicKey:keys.publicKey,send};
}
