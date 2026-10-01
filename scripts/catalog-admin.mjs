import {products as defaults,extrasByCategory as defaultExtras,categories} from '../dist/js/catalog.js';
export function currentCatalog(shop){return shop.catalog||{products:defaults,extrasByCategory:defaultExtras};}
export function validateCatalog(input){
 const clean=(value,max)=>{if(typeof value!=='string'||!value.trim()||value.length>max||/[<>"&]/.test(value))throw new Error('Confira os textos do cardápio.');return value.trim();};
 const price=value=>{if(!Number.isInteger(value)||value<0||value>100000)throw new Error('Preço inválido.');return value;};
 if(!Array.isArray(input.products)||!input.products.length||input.products.length>100)throw new Error('Informe até 100 produtos.');
 const ids=new Set();const products=input.products.map(p=>{
  if(!/^[a-z0-9-]{1,60}$/.test(p.id)||ids.has(p.id)||!categories.includes(p.category)||p.category==='all')throw new Error('Produto ou categoria inválida.');ids.add(p.id);
  const image=clean(p.image,1500);if(!/^\/?assets\/[a-zA-Z0-9_./-]+$/.test(image)){const u=new URL(image);if(u.protocol!=='https:'||u.username||u.password)throw new Error('Use uma foto HTTPS ou da pasta assets.');}
  return {id:p.id,name:clean(p.name,80),category:p.category,price:price(p.price),description:clean(p.description,300),image};
 });
 const extrasByCategory={},extrasByProduct={};for(const category of [...categories.filter(c=>c!=='all'),...products.map(p=>p.id)]){
  const byProduct=ids.has(category);if(byProduct&&!Object.hasOwn(input.extrasByProduct||{},category))continue;const list=(byProduct?input.extrasByProduct?.[category]:input.extrasByCategory?.[category])||[];if(!Array.isArray(list)||list.length>10)throw new Error('Máximo de 10 adicionais por categoria.');const seen=new Set();
  (byProduct?extrasByProduct:extrasByCategory)[category]=list.map(e=>{if(!/^[a-z0-9-]{1,60}$/.test(e.id)||seen.has(e.id))throw new Error('Adicional inválido.');seen.add(e.id);return{id:e.id,name:clean(e.name,60),price:price(e.price)};});
 }
 return {products,extrasByCategory,extrasByProduct};
}
