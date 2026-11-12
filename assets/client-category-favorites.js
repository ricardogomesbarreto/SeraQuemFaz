'use strict';
/* Categorias favoritas: autorização sempre via API PHP, nunca via parâmetros
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
 async function initSaveCategory(){
  const button=$('sqfSaveCategory');if(!button)return;
  const categoryId=new URL(location.href).searchParams.get('id')||'';
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(categoryId))return;
  {
   try{const api=window.SQFMySQL,s=await api.session();if(!s.user_id)return;const p=(await api.profile()).data;if(p.account_type!=='cliente')return;
    let saved=(await api.favoriteCategories()).data.some(x=>x.id===categoryId);button.hidden=false;
    const sync=()=>{button.textContent=saved?'♥ Categoria salva':'♡ Salvar categoria';button.setAttribute('aria-pressed',String(saved));};sync();
    button.addEventListener('click',async()=>{button.disabled=true;try{await api.favoriteCategory({category_id:categoryId,saved:!saved});saved=!saved;sync();}catch(e){$('sqfCategorySaveStatus').textContent=e.message;}finally{button.disabled=false;}});
   }catch(e){$('sqfCategorySaveStatus').textContent='Favoritos indisponíveis.';}return;
  }
 }
 if($('sqfSaveCategory'))void initSaveCategory();
})();
