import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {matches} from '../scripts/access.mjs';
const directory=new URL('../data/',import.meta.url);
await mkdir(directory,{recursive:true});
const file=new URL('acesso-cloudflare.txt',directory);
let password;
try{password=(await readFile(file,'utf8')).trim();}catch(error){if(error.code!=='ENOENT')throw error;}
if(!password){
 try{const local=(await readFile(new URL('acesso-painel.txt',directory),'utf8')).trim(),record=JSON.parse(await readFile(new URL('auth.json',directory),'utf8'));if(matches(local,record))password=local;}catch(error){if(error.code!=='ENOENT')throw error;}
 password||=randomBytes(24).toString('base64url');
 await writeFile(file,password+'\n',{mode:0o600});
}
if(password.length<12)throw new Error('Senha privada inválida.');
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','bulk'],{cwd:new URL('../',import.meta.url),stdio:['pipe','inherit','inherit']});
child.stdin.end(JSON.stringify({ADMIN_PASSWORD:password}));
const code=await new Promise(resolve=>child.once('exit',resolve));
if(code!==0)throw new Error('Não foi possível configurar o acesso Cloudflare.');
console.log('Acesso configurado. Senha guardada somente em data/acesso-cloudflare.txt.');
