'use strict';
/* Operação: dados recebidos da sessão atual. Nenhuma reserva, autorização ou
   decisão administrativa é realizada por estes auxiliares de apresentação. */
(function(scope){
 const stamp=v=>Date.parse(String(v||''));
 const dayKey=v=>{
   const d=new Date(v);if(!Number.isFinite(d.getTime()))return '';
   const p=n=>String(n).padStart(2,'0');
   return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
 };
 const valid=r=>r&&Number.isFinite(stamp(r.starts_at))&&Number.isFinite(Number(r.duration_minutes))&&Number(r.duration_minutes)>0;
 const end=r=>stamp(r.starts_at)+Number(r.duration_minutes)*60000;
 const active=r=>['proposed','confirmed'].includes(r.status);
 function agenda(rows,{period='upcoming',status='all',day='',now=Date.now()}={}){
   const current=Number(now);
   return (Array.isArray(rows)?rows:[]).filter(valid).filter(r=>{
     if(status!=='all'&&r.status!==status)return false;
     if(day&&dayKey(stamp(r.starts_at))!==day)return false;
     if(period==='upcoming'&&(!active(r)||end(r)<=current))return false;
     if(period==='history'&&active(r)&&end(r)>current)return false;
     return true;
   }).sort((a,b)=>period==='history'?stamp(b.starts_at)-stamp(a.starts_at):stamp(a.starts_at)-stamp(b.starts_at));
 }
 function conflicts(rows){
   const list=(Array.isArray(rows)?rows:[]).filter(r=>valid(r)&&active(r));
   const ids=new Set();
   for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
     const a=list[i],b=list[j];
     if(a.id!==b.id&&stamp(a.starts_at)<end(b)&&stamp(b.starts_at)<end(a)){
       ids.add(a.id);ids.add(b.id);
     }
   }
   return ids;
 }
 function portfolio(rows,{service='',coverOnly=false}={}){
   return (Array.isArray(rows)?rows:[]).filter(r=>r&&(!service||r.service_id===service)&&(!coverOnly||r.is_cover===true))
     .sort((a,b)=>String(a.service_id||'').localeCompare(String(b.service_id||''))||Number(Boolean(b.is_cover))-Number(Boolean(a.is_cover)));
 }
 function count(value){
   if(value===null||value===undefined||String(value).trim()==='')return null;
   const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:null;
 }
 function percentage(a,b){
   const numerator=count(a),denominator=count(b);
   return numerator===null||denominator===null||denominator===0||numerator>denominator
     ?null:Math.round(numerator*1000/denominator)/10;
 }
 scope.SQFOps=Object.freeze({dayKey,agenda,conflicts,portfolio,count,percentage});
})(typeof window==='undefined'?globalThis:window);
