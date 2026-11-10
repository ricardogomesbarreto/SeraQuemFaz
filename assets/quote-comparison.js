'use strict';
/* Comparação de propostas do próprio cliente: dados reais retornados por RLS.
   Preço sozinho não determina equivalência de escopo, prazo ou qualidade. */
(function(scope){
  const normalize=value=>String(value??'').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
  const groups=Object.freeze({
    quoted:Object.freeze(['quoted']),
    active:Object.freeze(['accepted','in_progress','awaiting_confirmation']),
    completed:Object.freeze(['completed']),
    closed:Object.freeze(['canceled','declined'])
  });
  function filter(quotes,{status='all',query='',order='lowest'}={},names=new Map()){
    if(!Array.isArray(quotes))return [];
    const term=normalize(query).slice(0,100);
    const eligible=(row)=>{
      if(!row||!Number.isSafeInteger(row.quote_cents)||row.quote_cents<0)return false;
      if(status!=='all' && !(groups[status]||[]).includes(row.status))return false;
      if(term){
        const full=normalize([
          row.description,row.quote_terms,names.get(row.provider_id)||''
        ].join(' '));
        if(!full.includes(term))return false;
      }
      return true;
    };
    const timestamp=row=>{
      const value=Date.parse(String(row?.created_at||''));
      return Number.isFinite(value)?value:0;
    };
    return quotes.filter(eligible).sort((a,b)=>{
      if(order==='highest')return b.quote_cents-a.quote_cents||timestamp(b)-timestamp(a);
      if(order==='recent')return timestamp(b)-timestamp(a)||a.quote_cents-b.quote_cents;
      return a.quote_cents-b.quote_cents||timestamp(b)-timestamp(a);
    });
  }
  scope.SQFQuoteComparison=Object.freeze({filter,normalize,groups});
})(typeof window==='undefined'?globalThis:window);
