import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
export function verifier(password) {
 const salt = randomBytes(16).toString('hex');
 return { salt, hash: scryptSync(password, salt, 32).toString('hex') };
}
export function matches(password, record) {
 return typeof password === 'string' && password.length <= 200 && timingSafeEqual(scryptSync(password, record.salt, 32), Buffer.from(record.hash, 'hex'));
}
export async function saveAccess(directory, record) {
 const path = resolve(directory, 'auth.json'), temp = path + '.' + randomBytes(8).toString('hex') + '.tmp';
 await writeFile(temp, JSON.stringify(record), {mode:0o600});
 await rename(temp, path);
}
export async function loadAccess(directory) {
 if (process.env.ADMIN_PASSWORD) {
  if (process.env.ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD deve ter pelo menos 12 caracteres.');
  return verifier(process.env.ADMIN_PASSWORD);
 }
 try {
  const record = JSON.parse(await readFile(resolve(directory,'auth.json'),'utf8'));
  if (!/^[a-f0-9]{32}$/.test(record.salt) || !/^[a-f0-9]{64}$/.test(record.hash)) throw new Error('Arquivo de acesso inválido.');
  return record;
 } catch(error) { if (error.code !== 'ENOENT') throw error; }
 const file = resolve(directory,'acesso-painel.txt');
 let password;
 try { password = (await readFile(file,'utf8')).trim(); }
 catch(error) { if(error.code !== 'ENOENT') throw error; password=randomBytes(18).toString('base64url'); await writeFile(file,password+'\n',{mode:0o600}); }
 if(password.length<12) throw new Error('A senha deve ter pelo menos 12 caracteres.');
 const record=verifier(password); await saveAccess(directory,record);
 console.log(`A senha inicial do painel está no arquivo: ${file}`);
 return record;
}
export async function removeInitialPassword(directory) { await rm(resolve(directory,'acesso-painel.txt'),{force:true}); }
