import QRCode from 'qrcode';
import {createRoot,type Root} from 'react-dom/client';
import React,{useState} from 'react';
function Pix({token}:{token:string}){
 const [image,setImage]=useState(''),[code,setCode]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 async function load(){setBusy(true);try{const response=await fetch('/api/order-pix',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});const result=await response.json();if(!response.ok)throw new Error(result.error);setCode(result.code);setImage(await QRCode.toDataURL(result.code,{width:256,margin:2,errorCorrectionLevel:'M'}));setMessage('Confira o nome '+result.name+' e o valor no app do banco antes de pagar. O Renato confirma o recebimento.');}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível mostrar o Pix.');}finally{setBusy(false);}}
 return <div className="pix-order"><button disabled={busy} type="button" onClick={load}>{busy?'Carregando…':'Pagar com Pix'}</button>{image?<><img src={image} width="256" height="256" alt="QR Code Pix do pedido"/><label>Pix copia e cola<textarea readOnly value={code}/></label><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(code);setMessage('Código copiado. Cole no app do banco e confira destinatário e valor.');}catch{setMessage('Selecione e copie o código acima.');}}}>Copiar código Pix</button></>:null}<p role="status">{message}</p></div>;
}
let root:Root|undefined;
function mount(){const target=document.getElementById('order-pix');root?.unmount();root=undefined;if(target){root=createRoot(target);root.render(<Pix token={target.dataset.token||''}/>);}}
window.addEventListener('renato:tracking-render',mount);
mount();
