'use strict';
/* Administração: consultas sempre pela RPC com autorização e MFA no banco.
   Nunca usar service_role, contagens inventadas ou dados privados no HTML. */
(()=>{
 const $=id=>document.getElementById(id);
 if(!$('sqfAdminReportsRefresh'))return;
 const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
 const msg=(id,txt,bad=false)=>{const el=$(id);el.textContent=txt;el.dataset.error=String(bad);};
 const client=()=>window.getSQFClient();
 async function loadMetrics(){
  const target=$('sqfAdminReportsStats'),button=$('sqfAdminReportsRefresh');
  button.disabled=true;msg('sqfAdminReportsStatus','Consultando métricas autorizadas...');
  try{
   const {data,error}=await client().rpc('sqf_staff_dashboard_metrics');
   if(error||!Array.isArray(data)||!data.length)throw error||new Error('Dados indisponíveis');
   const counters=[
    ['Prestadores cadastrados',data[0].providers_total],
    ['Perfis com publicação solicitada',data[0].providers_visible],
    ['Solicitações de serviços',data[0].requests_total],
    ['Atendimentos concluídos',data[0].requests_completed],
    ['Avaliações pendentes',data[0].reviews_pending],
    ['Pedidos de suporte em aberto',data[0].tickets_open]
   ];
   target.replaceChildren();
   for(const [label,num] of counters){
    const card=make('div','admin-stat');
    card.append(make('span','',label),make('strong','',Number.isFinite(Number(num))?String(num):'—'));
    target.append(card);
   }
   msg('sqfAdminReportsStatus','Indicadores atualizados do banco, sujeitos às permissões administrativas.');
  }catch{
   target.replaceChildren();
   msg('sqfAdminReportsStatus','Não foi possível consultar os relatórios. Verifique MFA e a migração de métricas.',true);
  }finally{button.disabled=false;}
 }
 async function loadSupport(){
  const list=$('sqfAdminSupportList'),button=$('sqfAdminSupportRefresh');
  button.disabled=true;msg('sqfAdminSupportStatus','Consultando pedidos de suporte...');
  try{
   const {data,error}=await client().rpc('sqf_staff_support_queue');
   if(error||!Array.isArray(data))throw error||new Error('Consulta indisponível');
   list.replaceChildren();
   if(!data.length){list.append(make('p','sqf-empty-state','Nenhum pedido de suporte registrado.'));return;}
   const names={account:'Conta',budget:'Orçamento',appointment:'Agenda',review:'Avaliação',technical:'Técnico',other:'Outro'};
   const statuses={open:'Recebido',reviewing:'Em análise',resolved:'Resolvido'};
   for(const ticket of data){
    const item=make('article','sqf-activity-item'),content=make('div');
    content.append(make('strong','',names[ticket.topic]||'Suporte'),
      make('small','',statuses[ticket.status]||'Em atendimento'),
      make('p','',ticket.message.slice(0,2000)));
    item.append(content);
    if(ticket.status!=='resolved'){
     const actions=make('div','sqf-request-actions');
     for(const [action,label] of [['review','Iniciar análise'],['resolve','Resolver']]){
      if(action==='review'&&ticket.status==='reviewing')continue;
      const b=make('button','button button-outline button-small',label);
      b.type='button';
      b.addEventListener('click',async()=>{
       if(action==='resolve'&&!confirm('Registrar este pedido como resolvido?'))return;
       b.disabled=true;
       try{
        const {error:err}=await client().rpc('sqf_staff_support_action',{p_ticket:ticket.ticket_id,p_action:action});
        if(err)throw err;
        await loadSupport();
       }catch{
        msg('sqfAdminSupportStatus','Não foi possível atualizar o pedido. Confira sua autorização.',true);
        b.disabled=false;
       }
      });
      actions.append(b);
     }
     item.append(actions);
    }
    list.append(item);
   }
   msg('sqfAdminSupportStatus',data.length+' pedido(s) consultado(s), até 50 mais recentes.');
  }catch{
   list.replaceChildren(make('p','sqf-empty-state','Suporte indisponível para a conta atual.'));
   msg('sqfAdminSupportStatus','MFA e função administrativa no Supabase são obrigatórios.',true);
  }finally{button.disabled=false;}
 }
 $('sqfAdminReportsRefresh').addEventListener('click',()=>void loadMetrics());
 $('sqfAdminSupportRefresh').addEventListener('click',()=>void loadSupport());
})();
