export function crc16(text){let crc=0xffff;for(const byte of Buffer.from(text,'utf8')){crc^=byte<<8;for(let i=0;i<8;i++)crc=(crc&0x8000)?((crc<<1)^0x1021)&0xffff:(crc<<1)&0xffff;}return crc.toString(16).toUpperCase().padStart(4,'0');}
const tlv=(id,text)=>id+String(Buffer.byteLength(text,'utf8')).padStart(2,'0')+text;
const normalize=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ]/g,'').trim();
export function validatePix(value){
 if(value?.enabled!==true)return {enabled:false};
 const key=String(value.key||'').trim(),name=normalize(String(value.name||'')),city=normalize(String(value.city||''));
 const valid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)||/^\+55\d{10,11}$/.test(key)||/^\d{11}$/.test(key)||/^\d{14}$/.test(key)||/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
 if(!valid||key.length>77||!name||name.length>25||!city||city.length>15)throw new Error('Confira a chave Pix, nome (até 25 caracteres) e cidade (até 15). Telefone precisa de +55 e DDD.');
 return {enabled:true,key,name,city};
}
export function pixCode(config,cents,id){
 const p=validatePix(config);if(!p.enabled)throw new Error('Pix não configurado.');
 if(!Number.isSafeInteger(cents)||cents<=0||!/^\d+$/.test(String(id)))throw new Error('Pedido inválido.');
 const payload=tlv('00','01')+tlv('26',tlv('00','br.gov.bcb.pix')+tlv('01',p.key))+tlv('52','0000')+tlv('53','986')+tlv('54',(cents/100).toFixed(2))+tlv('58','BR')+tlv('59',p.name)+tlv('60',p.city)+tlv('62',tlv('05','RENATO'+id))+'6304';
 return payload+crc16(payload);
}
