import {test} from 'node:test';
import assert from 'node:assert/strict';
import {crc16,pixCode,validatePix} from './pix.mjs';
import {validSubscription} from './push.mjs';
test('Pix usa centavos exatos e CRC16 conhecido',()=>{
 assert.equal(crc16('123456789'),'29B1');
 const p=pixCode({enabled:true,key:'teste@example.com',name:'Renato',city:'Fortaleza'},1750,123);
 assert.ok(p.includes('540517.50'));assert.ok(p.includes('RENATO123'));assert.equal(p.slice(-4),crc16(p.slice(0,-4)));
 assert.throws(()=>pixCode({enabled:true,key:'invalida',name:'Renato',city:'Fortaleza'},1750,123));
 assert.deepEqual(validatePix({enabled:false}),{enabled:false});
});
test('push rejeita rede privada e destino arbitrário',()=>{
 const keys={p256dh:'a'.repeat(87),auth:'a'.repeat(22)};
 for(const endpoint of ['http://fcm.googleapis.com/test','https://localhost/test','https://127.0.0.1/test','https://evil.example/test','https://fcm.googleapis.com:8443/test'])assert.equal(validSubscription({endpoint,keys}),false);
 assert.equal(validSubscription({endpoint:'https://fcm.googleapis.com/test',keys}),true);
});
