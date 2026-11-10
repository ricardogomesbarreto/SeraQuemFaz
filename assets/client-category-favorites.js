'use strict';
/* Categorias favoritas: autorização sempre via RLS, nunca via parâmetros
 * de URL ou dados arbitrários da sessão. Buscas recentes apenas nesta aba. */
(()=>{
 const $=id=>document.getElementById(id);
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 const storageKey='sqf-search-history-session';
 const readHistory=()=>{
  try{const list=JSON.parse(sessionStorage.getItem(storageKey)||'[]');
   return Array.isArray(list)?list.filter(x=>typeof x.q==='string' && /^[0-9]{7}$/.test(x.city||'')).slice(0,6):[];
  }catch{return [];}
 };
 function rememberSearch(){
  const u=new URL(location.href),q=(u.searchParams.get('q')||'').trim().slice(0,100);
  const city=u.searchParams.get('cidade')||'';
  if(!q||!/^[0-9]{7}$/.test(city)||/[@\n\r]/.test(q))return;
  try{
   const existing=readHistory().filter(x=>!(x.q===q&&x.city===city));
   sessionStorage.setItem(storageKey,JSON.stringify([{q,city},...existing].slice(0,6)));
  }catch{/* Desativar histórico em navegadores que não o permitem. */}
 }
 if(document.querySelector('#catalogSidebar')){
  rememberSearch();
  document.querySelector('#categorySearch')?.addEventListener('submit',()=>queueMicrotask(rememberSearch));
 }
 async function init(){
  if(!$('sqfCategoryFavoritesList')&&!$('sqfSaveCategory'))return;
  const client=window.getSQFClient?.();if(!client)return;
  const {data, error}=await client.auth.getUser();
  if(error||!data?.user)return;
  const user=data.user;
  const {data:profile,error:pe}=await client.from('profiles').select('account_type').eq('id',user.id).maybeSingle();
  if(pe||profile?.account_type!=='cliente')return;
  const list=$('sqfCategoryFavoritesList');
  async function renderFavorites(){
   if(!list)return;
   list.replaceChildren(make('p','muted','Consultando suas categorias...'));
   try{
    const {data:entries,error:ee}=await client.from('sqf_client_category_favorites')
      .select('category_id,created_at').eq('client_id',user.id)
      .order('created_at',{ascending:false}).limit(30);
    if(ee)throw ee;
    const ids=(entries||[]).map(x=>x.category_id);
    if(!ids.length){list.replaceChildren(make('p','sqf-empty-state','Você ainda não salvou categorias. Explore o catálogo para adicionar suas favoritas.'));return;}
    const {data:categories,error:ce}=await client.from('categories').select('id,name,description').in('id',ids).eq('status','active');
    if(ce)throw ce;
    const names=new Map((categories||[]).map(x=>[x.id,x]));
    list.replaceChildren();
    for(const id of ids){
     const category=names.get(id);if(!category)continue;
     const row=make('div','sqf-favorite-category-row');
     const link=make('a','',category.name);
     link.href='categorias.html?q='+encodeURIComponent(category.name);
     const subtitle=make('small','',category.description||'Pesquisar profissionais dessa categoria');
     const info=make('div');info.append(link,subtitle);
     const remove=make('button','button button-outline button-small','Remover');
     remove.type='button';
     remove.addEventListener('click',async()=>{
      remove.disabled=true;
      const {error:de}=await client.from('sqf_client_category_favorites').delete()
       .eq('client_id',user.id).eq('category_id',id);
      if(de){remove.disabled=false;return;}
      await renderFavorites();
     });
     row.append(info,remove);list.append(row);
    }
    if(!list.childElementCount)list.append(make('p','sqf-empty-state','Nenhuma das categorias salvas está ativa no momento.'));
   }catch{
    list.replaceChildren(make('p','sqf-empty-state','Não foi possível carregar suas categorias. Confira a atualização do banco.'));
   }
  }
  function renderHistory(){
   const target=$('sqfRecentSearches');
   if(!target)return;
   target.replaceChildren();
   const rows=readHistory();
   if(!rows.length){target.append(make('p','muted','Nenhuma pesquisa registrada nesta sessão.'));return;}
   for(const row of rows){
    const link=make('a','sqf-recent-search','⌕ '+row.q);
    link.href='categorias.html?cidade='+encodeURIComponent(row.city)+'&q='+encodeURIComponent(row.q);
    target.append(link);
   }
  }
  $('sqfClearRecentSearches')?.addEventListener('click',()=>{
   try{sessionStorage.removeItem(storageKey);}catch{}
   renderHistory();
  });
  await renderFavorites();renderHistory();
 }
 async function initSaveCategory(){
  const button=$('sqfSaveCategory');if(!button)return;
  const categoryId=new URL(location.href).searchParams.get('id')||'';
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(categoryId))return;
  const client=window.getSQFClient?.();if(!client)return;
  const {data,error}=await client.auth.getUser();if(error||!data?.user)return;
  const user=data.user;
  const {data:profile}=await client.from('profiles').select('account_type').eq('id',user.id).maybeSingle();
  if(profile?.account_type!=='cliente')return;
  button.hidden=false;
  let saved=false;
  const {data:row,error:selectError}=await client.from('sqf_client_category_favorites')
    .select('category_id').eq('client_id',user.id).eq('category_id',categoryId).maybeSingle();
  if(selectError){button.hidden=true;return;}
  saved=Boolean(row);
  const feedback=$('sqfCategorySaveStatus');
  const sync=()=>{button.textContent=saved?'♥ Categoria salva':'♡ Salvar categoria';button.setAttribute('aria-pressed',String(saved));};
  sync();
  button.addEventListener('click',async()=>{
   button.disabled=true;
   try{
    const res=saved
      ?await client.from('sqf_client_category_favorites').delete().eq('client_id',user.id).eq('category_id',categoryId)
      :await client.from('sqf_client_category_favorites').insert({client_id:user.id,category_id:categoryId});
    if(res.error)throw res.error;
    saved=!saved;sync();
    if(feedback)feedback.textContent=saved?'Categoria adicionada aos favoritos.':'Categoria removida dos favoritos.';
   }catch{
    if(feedback)feedback.textContent='Não foi possível alterar seus favoritos. Confira as permissões e tente novamente.';
   }finally{button.disabled=false;}
  });
 }
 window.addEventListener('sqf:account-ready',()=>void init(),{once:true});
 if($('sqfSaveCategory'))void initSaveCategory();
})();
