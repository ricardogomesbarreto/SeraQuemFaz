'use strict';
/* Compatibilidade SOMENTE para dados próprios. Não transforma registros legados em
   prestadores aprovados e nunca ignora as permissões do Supabase (RLS). */
(function(scope) {
  const safeName = (value) => String(value || '').trim().slice(0, 120);
  const validPath = (user, value) => typeof value === 'string' &&
    /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i.test(value) && value.startsWith(`${user.id}/`);
  const normalizeRole = value => value === 'prestador' || value === 'ambos' ? 'prestador' : 'cliente';
  const missingTable = error => /PGRST205|42P01|schema cache|could not find the table|relation.*does not exist/i.test(String(error?.code || '') + ' ' + String(error?.message || ''));
  async function read(client, user) {
    const identity = safeName(user?.user_metadata?.full_name || user?.email?.split('@')[0]) || 'Usuário';
    const state = {display_name: identity, city:'', state:'', account_type: normalizeRole(user?.user_metadata?.account_type), avatar_path:null, settingsReady:false, legacyReady:false, source:'auth'};
    try {
      const result = await client.from('user_profiles').select('name,city,state,account_type').eq('user_id', user.id).maybeSingle();
      if (!result.error && result.data) {
        state.display_name = safeName(result.data.name) || state.display_name;
        state.city = String(result.data.city || '').slice(0,120);
        state.state = String(result.data.state || '').slice(0,2).toUpperCase();
        state.account_type = normalizeRole(result.data.account_type);
        state.legacyReady=true;state.source='user_profiles';
      }
    } catch { /* Conta pode estar somente no Auth. */ }
    try {
      const result = await client.from('sqf_account_settings')
        .select('display_name,city,state,avatar_path').eq('user_id', user.id).maybeSingle();
      if (!result.error) {
        state.settingsReady=true;
        if (result.data) {
          state.display_name=safeName(result.data.display_name)||state.display_name;
          state.city=String(result.data.city||'').slice(0,120);
          state.state=String(result.data.state||'').slice(0,2).toUpperCase();
          state.avatar_path=validPath(user,result.data.avatar_path) ? result.data.avatar_path : null;
        }
      }
    } catch { /* Tabela complementar ainda não implantada. */ }
    return state;
  }
  async function signedPhoto(client,user,path) {
    if (!validPath(user,path))return null;
    try {
      const {data,error}=await client.storage.from('sqf-account-photos').createSignedUrl(path,120);
      if(error||!data?.signedUrl)return null;
      const url=new URL(data.signedUrl,location.href);
      const project=new URL(scope.SQFSupabase.url);
      return url.protocol==='https:' && url.host===project.host ? url.href : null;
    }catch{return null;}
  }
  async function save(client,user,record) {
    const display_name=safeName(record.display_name);
    const city=String(record.city||'').trim().slice(0,120);
    const state=String(record.state||'').trim().toUpperCase();
    if(display_name.length<2 || display_name.length>120 || city.length>120 || (state && !/^[A-Z]{2}$/.test(state)))
      throw new Error('Confira o nome, a cidade e a UF (duas letras).');
    const payload={user_id:user.id, display_name, city, state:state||null};
    if(record.avatar_path!==undefined){
      if(record.avatar_path!==null&&!validPath(user,record.avatar_path))throw new Error('Caminho da fotografia inválido.');
      payload.avatar_path=record.avatar_path;
    }
    const {error}=await client.from('sqf_account_settings').upsert(payload,{onConflict:'user_id'});
    if(error)throw error;
    // O nome no Auth permite atualizar o cabeçalho em páginas públicas sem expor dados pessoais.
    const {error:metadataError}=await client.auth.updateUser({data:{full_name:display_name}});
    return {metadataError:metadataError||null};
  }
  const secureUuid=()=>{
    if (typeof crypto.randomUUID==='function') return crypto.randomUUID();
    if (typeof crypto.getRandomValues!=='function') throw new Error('Navegador sem gerador seguro de identificadores. Use HTTPS ou localhost.');
    const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  };
  async function uploadPortrait(client,user,file,options={}){
    if(!file)throw new Error('Escolha uma fotografia.');
    if(!scope.SQFPortrait)throw new Error('Editor de fotografias indisponível.');
    const blob=await scope.SQFPortrait.process(file,options);
    const path=`${user.id}/${secureUuid()}.webp`;
    const {error}=await client.storage.from('sqf-account-photos').upload(path,blob,{contentType:'image/webp',upsert:false,cacheControl:'0'});
    if(error)throw error;
    return path;
  }
  scope.SQFAccountCompat=Object.freeze({read,save,uploadPortrait,signedPhoto,missingTable,validPath});
})(window);
