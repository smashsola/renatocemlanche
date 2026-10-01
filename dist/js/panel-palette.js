const options=new Set(['amarelo','verde','vinho']);
const buttons=document.querySelectorAll('[data-palette-choice]');
function apply(palette){
 document.body.dataset.palette=palette;
 for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.paletteChoice===palette));
 const colors={amarelo:'#11120f',verde:'#101916',vinho:'#1b1117'};
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',colors[palette]);
}
let palette='amarelo';
try{const saved=localStorage.getItem('renato-panel-palette');if(options.has(saved))palette=saved;}catch{}
apply(palette);
for(const button of buttons)button.addEventListener('click',()=>{const value=button.dataset.paletteChoice;if(!options.has(value))return;apply(value);try{localStorage.setItem('renato-panel-palette',value);}catch{}});
