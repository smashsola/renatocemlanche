import React from 'react';
import {createRoot} from 'react-dom/client';
import StatsCardsWithLinks from './components/ui/stats-cards-with-links';
const target=document.getElementById('cash-chart');
let root:ReturnType<typeof createRoot>|undefined;
window.addEventListener('renato:metrics', (event:Event)=>{
 if(!target)return;
 if(!(event as CustomEvent).detail){root?.unmount();root=undefined;return;}
 if(!root){root=createRoot(target);root.render(<StatsCardsWithLinks/>);}
});
