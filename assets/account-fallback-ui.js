'use strict';
/* Editor de dados próprios para o esquema anterior (user_profiles), sem acesso
   administrativo e sem alterar/publicar perfis profissionais automaticamente. */
(function(scope){
  const $=id=>document.getElementById(id);
  async function init(client,user) {
    if(!$('fallbackNameForm') || !scope.SQFAccountCompat)return;
    const api=scope.SQFAccountCompat;
    let record=await api.read(client,user);
    let candidate=null,previewUrl=null,version=0;
    const report=(message,error=false)=>{const node=$('fallbackStatus');node.textContent=message;node.dataset.error=String(error);};
    const drawPicture=async()=>{
      const root=$('fallbackPhotoPreview');root.replaceChildren();
      const initials=(record.display_name||'U').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
      root.textContent=initials;
      if(!record.avatar_path)return;
      const url=await api.signedPhoto(client,user,record.avatar_path);
      if(!url)return;
      const img=document.createElement('img');img.alt='Sua fotografia privada';img.src=url;img.referrerPolicy='no-referrer';
      img.addEventListener('error',()=>img.remove(),{once:true});root.append(img);
    };
    function fill(){
      $('fallbackName').value=record.display_name;
      $('fallbackCity').value=record.city||'';
      $('fallbackState').value=record.state||'';
      $('accountFallbackName').textContent=record.display_name;
      $('accountFallbackEmail').textContent=user.email||'Não informado';
      $('accountFallbackRole').textContent=record.account_type==='prestador'?'Prestador de serviços':'Cliente';
    }
    fill();await drawPicture();
    if(!record.settingsReady){
      report('Para salvar cidade e foto com privacidade, é necessário executar o arquivo SQL de compatibilidade v3.9.4 no Supabase. O formulário já pode ser preenchido.',true);
    }
    async function prepare(){
      const file=$('fallbackAvatarFile').files?.[0];const token=++version;
      candidate=null;
      if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
      if(!file){await drawPicture();return;}
      try{
        const blob=await scope.SQFPortrait.process(file,{zoom:Number($('fallbackPhotoZoom').value)/100});
        if(token!==version)return;
        candidate={file,blob};
        previewUrl=URL.createObjectURL(blob);
        const root=$('fallbackPhotoPreview');root.replaceChildren();
        const img=document.createElement('img');img.src=previewUrl;img.alt='Prévia da nova fotografia';root.append(img);
        report('Prévia pronta. A fotografia só será enviada quando salvar.');
      }catch(error){if(token!==version)return;report(error?.message||'Foto inválida.',true);await drawPicture();}
    }
    $('fallbackAvatarFile').addEventListener('change',()=>void prepare());
    $('fallbackPhotoZoom').addEventListener('input',()=>void prepare());
    $('fallbackNameForm').addEventListener('submit',async(event)=>{
      event.preventDefault();
      const save=$('fallbackNameSave');if(save.disabled)return;
      const name=$('fallbackName').value.trim(),city=$('fallbackCity').value.trim(),state=$('fallbackState').value.trim();
      if(name.length<2 || name.length>120 || city.length>120 || (state && !/^[A-Za-z]{2}$/.test(state))){report('Corrija o nome, a cidade e a UF.',true);return;}
      const file=$('fallbackAvatarFile').files?.[0];
      if(file && (!candidate||candidate.file!==file)){report('A fotografia ainda está sendo preparada ou é inválida.',true);return;}
      if(!record.settingsReady){report('Salvamento indisponível: execute primeiro a migração complementar v3.9.4 e atualize a página. Nenhum dado foi alterado.',true);return;}
      save.disabled=true;report('Salvando seus dados privados...');
      let uploadedPath=null;
      try{
        const update={display_name:name,city,state};
        if(file){uploadedPath=await api.uploadPortrait(client,user,candidate.blob);update.avatar_path=uploadedPath;}
        const oldPath=record.avatar_path;
        const result=await api.save(client,user,update);
        record={...record,display_name:name,city,state:state.toUpperCase(),avatar_path:uploadedPath||oldPath};
        fill();await drawPicture();
        if(uploadedPath && oldPath && oldPath!==uploadedPath) {
          // Melhor esforço: se falhar, a foto antiga privada fica para limpeza administrativa.
          await client.storage.from('sqf-account-photos').remove([oldPath]);
        }
        $('fallbackAvatarFile').value='';candidate=null;
        if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
        await scope.SQFAccountNavigation?.refresh();
        report(result.metadataError?'Dados salvos; o nome no login ainda não foi sincronizado.':'Dados e fotografia atualizados com segurança.');
      }catch(error){
        if(uploadedPath)await client.storage.from('sqf-account-photos').remove([uploadedPath]);
        report('Não foi possível salvar. Verifique a migração de compatibilidade, as políticas RLS e o bucket privado. '+String(error?.message||''),true);
      }finally{save.disabled=false;}
    });
  }
  scope.SQFAccountFallback=Object.freeze({init});
})(window);
