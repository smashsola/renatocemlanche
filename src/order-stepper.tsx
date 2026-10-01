import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {Stepper,Step} from './components/ui/stepper';
const stages=['new','accepted','preparing','ready','delivered'];
const labels=['Recebido','Aceito','Preparando','Pronto','Entregue'];
let root:Root|undefined;
function render(){
 const container=document.getElementById('order-stepper');
 root?.unmount();root=undefined;
 if(!container)return;
 const stage=container.dataset.status||'new';
 const offline=document.querySelector('#order-tracking')?.classList.contains('tracking-offline');
 root=createRoot(container);
 root.render(<Stepper initialStep={stages.indexOf(stage)} steps={labels.map(label=>({label}))} orientation="horizontal" variant="circle-alt" responsive={false} size="sm" state={stage==='delivered'||offline?undefined:'loading'} className="renato-stepper" styles={{'horizontal-step':'min-w-0','step-label':'text-[10px] sm:text-xs','step-button-container':'shrink-0'}}>{labels.map((label,index)=><Step key={label} label={label} isCompletedStep={stage==='delivered'||index<stages.indexOf(stage)}/>)}</Stepper>);
}
window.addEventListener('renato:tracking-render',render);
const target=document.getElementById('order-tracking');
if(target)new MutationObserver(()=>{
 const host=document.getElementById('order-stepper');
 if(host&&!host.querySelector('.renato-stepper'))render();
}).observe(target,{childList:true});
render();
