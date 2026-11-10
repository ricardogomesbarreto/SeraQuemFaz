'use strict';
/*
 * Navegação autenticada por páginas (client-side routes).
 * Cada URL ?pagina=<papel>/<tela> mostra APENAS o módulo selecionado.
 * O HTML estático é compartilhado para preservar eventos e formulários
 * já conectados ao Supabase, sem duplicar dados nem acesso de usuário.
 */
(()=>{
 const $=id=>document.getElementById(id);
 const pages={
  cliente:[
   {slug:'visao-geral',label:'Visão geral',description:'Resumo da conta e atalhos rápidos',ids:['accountSummaryCard','clientDashboard']},
   {slug:'editar-perfil',label:'Editar perfil',description:'Fotografia, nome e cidade da sua conta',ids:['profileSettings']},
   {slug:'atividades',label:'Atividades e orçamentos',description:'Suas solicitações, conversas, avaliações e propostas',ids:['sqfRequestPortal','sqfQuoteCompare','clientEngagementCard','clientReviewsCard','clientUpdatesCard']},
   {slug:'favoritos',label:'Favoritos',description:'Profissionais e categorias que você deseja acompanhar',ids:['clientFavoritesCard','sqfCategoryFavorites']},
   {slug:'agenda',label:'Agenda',description:'Datas propostas e atendimentos confirmados',ids:['sqfAppointmentHub']},
   {slug:'configuracoes',label:'Configurações',description:'Notificações, privacidade, segurança e suporte',ids:['sqfNotificationHub','accountSettings','sqfSupportHub']}
  ],
  prestador:[
   {slug:'visao-geral',label:'Visão geral',description:'Resumo do perfil, atividades e preparação para publicação',ids:['providerOverview','accountSummaryCard','providerReadiness']},
   {slug:'editar-perfil',label:'Editar perfil',description:'Foto profissional, cidade, apresentação e formas de atendimento',ids:['profileSettings','providerDetailsCard']},
   {slug:'solicitacoes',label:'Solicitações e mensagens',description:'Orçamentos, conversas e serviços realizados',ids:['sqfRequestPortal','providerEngagementsCard']},
   {slug:'servicos',label:'Meus serviços',description:'Cadastre, atualize e organize os serviços oferecidos',ids:['providerServicesSection']},
   {slug:'portfolio',label:'Portfólio',description:'Fotografias dos trabalhos organizadas por serviço',ids:['providerPortfolioSection']},
   {slug:'agenda',label:'Agenda',description:'Horários propostos, confirmados e histórico',ids:['sqfAppointmentHub']},
   {slug:'desempenho',label:'Desempenho',description:'Indicadores reais e avaliações recebidas',ids:['sqfPerformanceHub','providerReviewsSection']},
   {slug:'verificacao',label:'Verificação cadastral',description:'Análise de publicação, requisitos e situação da conta',ids:['providerVerificationCard']},
   {slug:'assinatura',label:'Assinatura',description:'Seu plano e a situação de pagamentos',ids:['billingPanel']},
   {slug:'configuracoes',label:'Configurações',description:'Notificações, LGPD, privacidade e suporte',ids:['sqfNotificationHub','accountSettings','sqfSupportHub']}
  ]
 };
 const aliases={
  accountSummaryCard:'visao-geral',clientDashboard:'visao-geral',providerOverview:'visao-geral',
  profileSettings:'editar-perfil',clientEngagementCard:'atividades',clientReviewsCard:'atividades',
  clientUpdatesCard:'atividades',clientFavoritesCard:'favoritos',privacyRequestCard:'configuracoes',
  clientPrivacySection:'configuracoes',accountSettings:'configuracoes',sqfSupportHub:'configuracoes',
  sqfNotificationHub:'configuracoes',sqfAppointmentHub:'agenda',
  providerServicesCard:'servicos',providerPortfolioCard:'portfolio',providerReviewsCard:'desempenho',
  providerDetailsCard:'editar-perfil',providerReadiness:'visao-geral',
  providerVerificationCard:'verificacao',providerEngagementsCard:'solicitacoes',
  billingPanel:'assinatura',sqfPerformanceHub:'desempenho',sqfQuoteCompare:'atividades'
 };
 let active=null,role=null,definitions=[],lastFocused=null,initialised=false;
 const currentKey=()=>role==='prestador'?'prestador':'cliente';
 const pageUrl=slug=>{
  const u=new URL(location.href);
  u.searchParams.set('pagina',currentKey()+'/'+slug);
  u.hash='';
  return u.pathname+u.search;
 };
 function resolve(slug){
  return definitions.find(p=>p.slug===slug)||definitions[0];
 }
 function togglePage(slug,{historyMode='none',focus=false}={}){
  if(!initialised)return;
  const p=resolve(slug);
  if(!p)return;
  const next=p.slug;
  document.querySelectorAll('[data-sqf-route]').forEach(node=>{
   node.hidden=node.dataset.sqfRoute!==next;
   node.setAttribute('aria-hidden',node.hidden?'true':'false');
  });
  const nav=$('providerAsideBrand')?.hidden===false
   ?$('providerAsideBrand'): $('clientInfo');
  nav?.querySelectorAll('[data-sqf-page]').forEach(link=>{
   const selected=link.dataset.sqfPage===next;
   if(selected)link.setAttribute('aria-current','page');
   else link.removeAttribute('aria-current');
  });
  const title=$('sqfViewTitle'),description=$('sqfViewDescription');
  if(title)title.textContent=p.label;
  if(description)description.textContent=p.description;
  if(p.slug==='configuracoes' && $('accountSettings'))$('accountSettings').open=true;
  if(historyMode!=='none'){
   const target=pageUrl(next);
   const method=historyMode==='push'?'pushState':'replaceState';
   history[method]({sqfPage:next},'',target);
  }
  if(active!==next){
   active=next;
   const root=$('sqfRouteContent');
   if(root)root.scrollIntoView({block:'start',behavior:'instant'});
   if(focus&&title){title.setAttribute('tabindex','-1');title.focus({preventScroll:true});}
  }
  document.title=p.label+' | Minha conta | SERÁ QUEM FAZ?';
  window.dispatchEvent(new CustomEvent('sqf:page-change',{detail:{role,page:next}}));
 }
 function routeFromLocation(){
  const selected=new URLSearchParams(location.search).get('pagina')||'';
  const parts=selected.split('/');
  if(parts.length===2&&parts[0]===currentKey()){
   const hit=definitions.find(x=>x.slug===parts[1]);
   if(hit)return hit.slug;
  }
  const id=decodeURIComponent(location.hash.slice(1)||'');
  if(!id)return 'visao-geral';
  const node=$(id);
  if(node?.closest('[data-sqf-route]'))return node.closest('[data-sqf-route]').dataset.sqfRoute;
  const a=aliases[id];
  if(a&&definitions.some(x=>x.slug===a))return a;
  if(id==='sqfRequestPortal')return role==='prestador'?'solicitacoes':'atividades';
  return 'visao-geral';
 }
 function createScreen(page,root){
  const section=document.createElement('section');
  section.className='sqf-route';
  section.dataset.sqfRoute=page.slug;
  section.setAttribute('aria-label',page.label);
  section.hidden=true;
  const inner=document.createElement('div');
  inner.className='sqf-route-modules';
  for(const id of page.ids){
   const el=$(id);
   if(el){
    // Um módulo que estava oculto por design pode permanecer assim até que
    // a consulta autenticada o libere (como cobrança ou notificações).
    inner.append(el);
    if(['clientDashboard','providerOverview','providerEditor'].includes(id))el.hidden=false;
   }
  }
  section.append(inner);
  root.append(section);
 }
 function setupNavigation(){
  const sidebar=role==='prestador'?$('providerAsideBrand'):$('clientInfo');
  if(!sidebar)return;
  const nav=sidebar.querySelector('.sqf-client-side-nav');
  if(!nav)return;
  nav.replaceChildren();
  const icons={
   'visao-geral':'⌂','editar-perfil':'✎','atividades':'▤',
   favoritos:'♡',agenda:'▦',configuracoes:'⚙',solicitacoes:'✉',
   servicos:'▣',portfolio:'▧',desempenho:'↗',verificacao:'✓',assinatura:'◇'
  };
  for(const page of definitions){
   const a=document.createElement('a');
   a.href=pageUrl(page.slug);
   a.dataset.sqfPage=page.slug;
   const symbol=document.createElement('span');
   symbol.textContent=icons[page.slug]||'•';
   symbol.setAttribute('aria-hidden','true');
   a.append(symbol,document.createTextNode(page.label));
   nav.append(a);
  }
  // Mesmo shell visual para ambos os papéis.
  sidebar.classList.add('sqf-unified-sidebar');
 }
 function interceptLinks(e){
  const link=e.target.closest('a[href]');
  if(!link||e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
  if(link.closest('.sqf-unified-sidebar')&&link.dataset.sqfPage){
   e.preventDefault();togglePage(link.dataset.sqfPage,{historyMode:'push',focus:true});return;
  }
  const href=link.getAttribute('href');
  if(!href||!href.startsWith('#'))return;
  const destination=$(href.slice(1));
  const view=destination?.closest('[data-sqf-route]');
  if(!view)return;
  e.preventDefault();
  togglePage(view.dataset.sqfRoute,{historyMode:'push',focus:true});
  if(href==='#accountSettings')$('accountSettings').open=true;
 }
 function init(event){
  if(initialised)return;
  role=event?.detail?.role;
  if(!pages[role])return;
  const main=$('accountSharedGrid')?.querySelector('.dashboard-main-col');
  if(!main)return;
  definitions=pages[role];
  const body=document.body;
  body.classList.add('sqf-routed-dashboard');
  // As seções de cliente estavam dentro de um grid multicolunas. São movidas
  // inteiras para telas independentes: os formulários não são recriados.
  const root=document.createElement('div');
  root.id='sqfRouteContent';root.className='sqf-route-content';
  main.prepend(root);
  for(const page of definitions)createScreen(page,root);
  const header=document.createElement('header');
  header.className='sqf-view-header';
  header.innerHTML='<span class="section-kicker">MINHA CONTA</span><h2 id="sqfViewTitle" tabindex="-1"></h2><p id="sqfViewDescription" class="muted"></p>';
  main.prepend(header);
  // Não mostrar novamente a tela gigante antiga; ela servia apenas como
  // contêiner de blocos do prestador agora movidos.
  if($('providerEditor'))$('providerEditor').hidden=true;
  if($('accountToolbar'))$('accountToolbar').hidden=true;
  setupNavigation();
  initialised=true;
  document.addEventListener('click',interceptLinks);
  window.addEventListener('popstate',()=>togglePage(routeFromLocation()));
  window.addEventListener('hashchange',()=>{
   if(location.hash)togglePage(routeFromLocation(),{historyMode:'replace'});
  });
  togglePage(routeFromLocation(),{historyMode:'replace'});
 }
 window.addEventListener('sqf:account-ready',init,{once:true});
})();
