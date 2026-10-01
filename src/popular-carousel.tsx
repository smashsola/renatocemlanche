import {createRoot} from 'react-dom/client';
import SocialCards from './components/ui/card-fan-carousel';
type Product={id:string;name:string;description:string;price:number;image:string};
const ids=['x-bacon','duplo-x-tudo','x-burguer','x-tudo','yakisoba-frango','egg-x-burguer','x-salada','yakisoba-carne','triplo-x-tudo'];
const root=document.getElementById('popular-products');
const catalogUrl='/js/catalog.js';
if(root) import(/* @vite-ignore */ catalogUrl).then(({products,currency}:{products:Product[];currency:(value:number)=>string})=>{
 const cards=ids.map(id=>products.find(p=>p.id===id)).filter((p):p is Product=>Boolean(p)).map(p=>({imgUrl:p.image,alt:`${p.name}, foto ilustrativa`,title:p.name,description:p.description,price:currency(p.price),productId:p.id}));
 createRoot(root).render(<SocialCards cards={cards}/>);
}).catch(()=>{root.textContent='Veja os lanches no cardápio abaixo.';});
