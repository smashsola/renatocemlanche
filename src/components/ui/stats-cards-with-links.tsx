import React, { useEffect, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, XAxis, Tooltip } from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
const Card=React.forwardRef<HTMLDivElement,React.HTMLAttributes<HTMLDivElement>>(({className,...props},ref)=><div ref={ref} className={cn('rounded-xl border border-[#36362c] bg-[#1d1d17] text-[#f4ead1] shadow-sm',className)} {...props}/>);
Card.displayName='Card';
const CardContent=React.forwardRef<HTMLDivElement,React.HTMLAttributes<HTMLDivElement>>(({className,...props},ref)=><div ref={ref} className={cn('p-4 pb-0',className)} {...props}/>);
CardContent.displayName='CardContent';
export type Day = {date:string; received:number; spent:number; deliveryFees:number};
const money = (value:number) => (value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const today = () => new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
const shift = (date:string, days:number) => new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
export default function StatsCardsWithLinks(){
 const [from,setFrom]=useState(shift(today(),-6)),[to,setTo]=useState(today());
 const [series,setSeries]=useState<Day[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[reload,setReload]=useState(0);
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 useEffect(()=>{
  let active=true; const abort=new AbortController();
  const count=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
  if(!from||!to||!Number.isFinite(count)||count<1||count>366){setError('Escolha um período de até um ano.');setLoading(false);setSeries([]);return;}
  setLoading(true);setError('');setSeries([]);
  (async()=>{const response=await fetch('/api/admin/metrics?from='+from+'&to='+to,{signal:abort.signal});if(!response.ok)throw new Error('Não foi possível carregar o caixa. Tente atualizar.');const result=await response.json();if(active)setSeries(result.series);})().catch(e=>{if(active&&e.name!=='AbortError')setError(e.message);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;abort.abort();};
 },[from,to,reload]);
 useEffect(()=>{const listener=(event:Event)=>{const day=(event as CustomEvent<Day>).detail;if(!day){setSeries([]);return;}setSeries(rows=>rows.map(row=>row.date===day.date?day:row));};window.addEventListener('renato:metrics',listener);return()=>window.removeEventListener('renato:metrics',listener);},[]);
 const cards=[{key:'received',name:'Entrou no caixa',color:'#f7c90d',note:'Pagamentos conferidos pelo Renato'},{key:'spent',name:'Saiu do caixa',color:'#fb9274',note:'Gastos registrados no painel'},{key:'deliveryFees',name:'Taxas de entrega',color:'#95cbb2',note:'Já incluídas no dinheiro recebido'}] as const;
 const selectMonth=(month:string)=>{if(!/^\d{4}-\d{2}$/.test(month))return;const start=month+'-01';const end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0,12)).toISOString().slice(0,10);setFrom(start);setTo(end);};
 const shortcut=(days:number)=>{setFrom(shift(today(),1-days));setTo(today());};
 return <section aria-label="Gráficos do caixa" className="min-w-0">
 <div className="cash-toolbar"><div><h3>Resumo do caixa</h3><p>{from.split('-').reverse().join('/')} — {to.split('-').reverse().join('/')}</p></div></div>
 <div className="cash-presets">{[{label:'Hoje',run:()=>shortcut(1)},{label:'7 dias',run:()=>shortcut(7)},{label:'Este mês',run:()=>selectMonth(today().slice(0,7))},{label:'Mês anterior',run:()=>selectMonth(shift(today().slice(0,7)+'-01',-1).slice(0,7))},{label:'Este ano',run:()=>{setFrom(today().slice(0,4)+'-01-01');setTo(today());}}].map(item=><button type="button" key={item.label} onClick={item.run}>{item.label}</button>)}<button type="button" disabled={loading} onClick={()=>setReload(n=>n+1)}>Atualizar</button></div>

 {error?<p role="alert">{error}</p>:loading?<p role="status">Carregando o caixa…</p>:<dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 m-0">{cards.map(card=><Card key={card.key} className="p-0 min-w-0 overflow-hidden"><CardContent><dt className="text-sm font-medium">{card.name}</dt><dd className="m-0 mt-2 text-2xl font-semibold" style={{color:card.color}}>{money(series.reduce((sum,day)=>sum+day[card.key],0))}</dd><div className="mt-3 h-16 w-full overflow-hidden">{series.length===1?<div className="cash-day-bar" style={{borderColor:card.color}}><span style={{background:card.color,width:series[0][card.key]?"100%":"0"}}/><small>{series[0].date.split("-").reverse().join("/")}</small></div>:<ResponsiveContainer width="100%" height="100%"><AreaChart data={series} margin={{top:5,right:0,left:0,bottom:0}} accessibilityLayer><defs><linearGradient id={'cash-'+card.key} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={card.color} stopOpacity={.3}/><stop offset="95%" stopColor={card.color} stopOpacity={0}/></linearGradient></defs><XAxis dataKey="date" hide/><Tooltip labelFormatter={date=>String(date).split('-').reverse().join('/')} formatter={value=>[money(Number(value)),card.name]} contentStyle={{background:'#191914',borderColor:'#57513b',borderRadius:10,color:'#f4ead1',fontSize:12}}/><Area dataKey={card.key} name={card.name} type="monotone" stroke={card.color} strokeWidth={1.5} fill={'url(#cash-'+card.key+')'} fillOpacity={.4} isAnimationActive={!reduced} animationDuration={450} dot={series.length===1}/></AreaChart></ResponsiveContainer>}</div></CardContent></Card>)}</dl>}
 <p className="cash-footnote">Taxas de entrega já fazem parte das entradas. Os valores aparecem após a confirmação do recebimento.</p>
 </section>;
}
