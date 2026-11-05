'use strict';
/* Um cliente autenticado pode solicitar serviço; pagar assinatura NÃO aprova perfis. */
(function (scope){
  const $=id=>document.getElementById(id);
  async function setup(client, authUser, providerId, services){
    const panel=$('sqfQuotePanel');if(!panel)return;
    panel.hidden=false;
    const form=$('sqfQuoteForm');
    const feedback=$('sqfQuoteStatus');
    const select=$('sqfQuoteService');
    select.replaceChildren();
    const blank=document.createElement('option');blank.value='';blank.textContent='Selecione o serviço';select.append(blank);
    for(const item of services||[]){
      const option=document.createElement('option');option.value=item.id;option.textContent=item.service_title;select.append(option);
    }
    const date=$('sqfQuoteDate');
    const localDay=(stamp)=>new Date(stamp.getTime()-stamp.getTimezoneOffset()*60000).toISOString().slice(0,10);
    const today=new Date();date.min=localDay(today);
    const maximum=new Date(today);maximum.setDate(maximum.getDate()+365);date.max=localDay(maximum);
    if(!authUser){
      form.hidden=true;const link=document.createElement('a');link.className='button button-outline button-block';
      link.href=`entrar.html?next=${encodeURIComponent('prestador.html?id='+providerId)}`;
      link.textContent='Entrar como cliente para solicitar orçamento';panel.append(link);return;
    }
    const {data:own,error}=await client.from('profiles').select('account_type').eq('id',authUser.id).maybeSingle();
    if(error || own?.account_type!=='cliente'){
      form.hidden=true;feedback.textContent='Solicitações de orçamento estão disponíveis apenas para contas de cliente.';return;
    }
    form.addEventListener('submit',async event=>{
      event.preventDefault();const button=$('sqfQuoteSubmit');
      const description=$('sqfQuoteDescription').value.trim();
      const files=$('sqfQuotePhotos').files;
      if(description.length<25||description.length>2000 || !select.value){feedback.textContent='Selecione o serviço e descreva em pelo menos 25 caracteres.';return;}
      if(files.length>3){feedback.textContent='Escolha no máximo três fotos.';return;}
      const accepted=new Set(['image/jpeg','image/png','image/webp']);
      if(Array.from(files).some(file=>!accepted.has(file.type)||file.size<=0||file.size>5*1024*1024)){
        feedback.textContent='Cada foto deve ser JPG, PNG ou WebP, com até 5 MB. Nenhum pedido foi enviado.';return;
      }
      if(date.value && (date.value<date.min||date.value>date.max)){
        feedback.textContent='Escolha uma data válida dentro dos próximos 365 dias.';return;
      }
      if(!confirm('Enviar uma solicitação privada de orçamento a este prestador?'))return;
      button.disabled=true;feedback.textContent='Enviando solicitação com segurança...';
      try{
        const {data:requestId,error:err}=await client.rpc('sqf_create_request',{
          p_provider:providerId,p_service:select.value,p_description:description,
          p_desired_date:date.value||null
        });
        if(err)throw err;
        let note='Solicitação registrada.';
        if(files.length){
          try{await scope.SQFRequestMedia.upload(client,requestId,authUser.id,files);note+=' Fotografias armazenadas de forma privada.';}
          catch(error){note+=` ${error.message}`;}
        }
        feedback.textContent=note+' Acompanhe as respostas em Minha Conta.';
        const link=document.createElement('a');link.href='painel.html#sqfRequestPortal';link.className='text-link';
        link.textContent='Acompanhar solicitação →';feedback.append(' ',link);form.reset();
      }catch(error){feedback.textContent=error?.message?.includes('function')?'Módulo de orçamentos ainda não implantado no Supabase.':
        (error?.message||'Não foi possível enviar. Confira a sessão e tente novamente.');}
      finally{button.disabled=false;}
    });
  }
  scope.SQFRequestProfile=Object.freeze({setup});
})(window);
