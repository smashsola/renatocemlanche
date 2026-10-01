const button=document.getElementById('enable-notifications');
const test=document.getElementById('test-alert');
const say=text=>document.getElementById('admin-feedback').textContent=text;
let registration,subscription,syncing=false;
async function bounded(promise,message,ms=15000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms);})]);}finally{clearTimeout(timer);}}
async function call(path,data){
 const response=await fetch('/api/admin/'+path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(15000)});
 const result=await response.json();if(!response.ok)throw new Error(result.error||'Não foi possível ativar os avisos.');return result;
}
function supported(){if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw new Error('Abra este painel no Chrome ou Edge para receber avisos. No iPhone, adicione à tela inicial e abra por lá.');}
async function worker(){
 supported();
 registration=await bounded(navigator.serviceWorker.register('/panel-worker.js',{scope:'/',updateViaCache:'none'}),'Não foi possível iniciar os avisos. Abra o painel no Chrome ou Edge e tente novamente.');
 registration=await bounded(navigator.serviceWorker.ready,'O serviço de avisos não iniciou. Atualize a página e tente novamente.');return registration;
}
async function registerDevice(create=true){
 await worker();const {publicKey}=await call('push-key');
 const encoded=publicKey.replace(/-/g,'+').replace(/_/g,'/');
 const key=Uint8Array.from(atob(encoded.padEnd(Math.ceil(encoded.length/4)*4,'=')),c=>c.charCodeAt(0));
 subscription=await registration.pushManager.getSubscription();
 if(subscription){const previous=subscription.options?.applicationServerKey;if(previous&&String(new Uint8Array(previous))!==String(key)){await subscription.unsubscribe();subscription=null;}}
 if(!subscription){if(!create)return false;subscription=await bounded(registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key}),'O navegador não conseguiu registrar os avisos. Tente no Chrome ou Edge fora do Codex.',20000);}
 await call('push-subscribe',subscription.toJSON());button.textContent='Notificações ativadas ✓';return true;
}
function explain(error){
 if(error.name==='NotAllowedError')return 'Notificações bloqueadas. Permita os avisos deste site nas configurações do navegador.';
 if(error.name==='AbortError')return 'O navegador não conseguiu conectar ao serviço de avisos. Se estiver no Codex, abra o painel no Chrome ou Edge e tente novamente.';
 if(error.name==='TimeoutError')return 'O serviço de avisos demorou a responder. Confira a conexão e tente novamente.';
 return error.message;
}
button.addEventListener('click',async()=>{
 button.disabled=true;
 try{supported();const permission=await bounded(Notification.requestPermission(),'Permita as notificações no navegador para continuar.');if(permission!=='granted')throw new Error('Notificações bloqueadas. Libere os avisos deste site nas configurações do navegador.');await registerDevice();say('Avisos ativados neste aparelho. Toque em Testar aviso para conferir.');}
 catch(error){say(explain(error));}finally{button.disabled=false;}
});
test.addEventListener('click',async()=>{
 if(test.disabled)return;document.getElementById('enable-sound').click();test.disabled=true;
 try{
  supported();if(Notification.permission!=='granted'){say('Toque em Ativar notificações e permita os avisos antes de testar.');return;}
  test.textContent='Preparando…';await registerDevice();
  say('O aviso será enviado em 5 segundos. Pode minimizar o navegador para conferir.');const deadline=Date.now()+5000;
  while(Date.now()<deadline){test.textContent=`Testar aviso · ${Math.ceil((deadline-Date.now())/1000)}s`;await new Promise(resolve=>setTimeout(resolve,Math.max(0,Math.min(250,deadline-Date.now()))));}
  test.textContent='Enviando…';const result=await call('push-test',{endpoint:subscription.endpoint});
  if(result.sent)say('O serviço aceitou o aviso de teste. Confira a central de notificações e o modo Não perturbe do PC ou celular.');
  else if(result.reason==='subscription-expired')say('A inscrição do navegador expirou. Toque em Ativar notificações e tente de novo.');
  else say('O serviço não aceitou o aviso. Ative as notificações novamente e teste no Chrome ou Edge.');
 }catch(error){say(explain(error));}finally{test.disabled=false;test.textContent='Testar aviso';}
});
async function restoreDevice(){
 if(syncing||document.getElementById('dashboard').hidden||!('Notification' in window)||Notification.permission!=='granted')return;
 syncing=true;try{await registerDevice(false);}catch{button.textContent='Reativar notificações';}finally{syncing=false;}
}
new MutationObserver(()=>{if(document.getElementById('dashboard').hidden)button.textContent='Ativar notificações';else restoreDevice();}).observe(document.getElementById('dashboard'),{attributes:true,attributeFilter:['hidden']});
restoreDevice();
export async function stopPush(){try{const r=await navigator.serviceWorker.getRegistration();const sub=await r?.pushManager.getSubscription();if(sub){await call('push-unsubscribe',{endpoint:sub.endpoint});await sub.unsubscribe();}}catch{}}
