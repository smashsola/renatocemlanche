import {isIP} from 'node:net';
const normalize=address=>address?.startsWith('::ffff:')&&isIP(address.slice(7))===4?address.slice(7):address;
export function proxyAddresses(value=''){
 const addresses=value.split(',').map(value=>value.trim()).filter(Boolean);
 if(addresses.some(address=>!isIP(address)))throw Error('TRUST_PROXY_FROM deve listar IPs exatos dos proxies protegidos.');
 return new Set(addresses.map(normalize));
}
export function clientAddress(req,trusted=new Set()){
 const peer=normalize(req.socket.remoteAddress)||'unknown';
 if(!trusted.has(peer))return peer;
 const visitor=req.headers['cf-connecting-ip'];
 if(typeof visitor!=='string'||!isIP(visitor)){const error=Error('Cabeçalho de visitante inválido no proxy configurado.');error.code=400;throw error;}
 return normalize(visitor);
}
