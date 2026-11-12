'use strict';
(function(scope){
  const element=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
  async function panel(api){
    const card=element('article');card.className='card sqf-catalog-diagnostics';
    const heading=element('h2','Diagnóstico do catálogo por município');
    const intro=element('p','Consulte se os prestadores cadastrados têm e-mail confirmado, aprovação, publicação e serviço ativo para aparecer na cidade selecionada. Os dados são agregados e acessíveis somente à administração.');
    const form=element('form');form.className='sqf-catalog-diagnostic-form';
    const label=element('label','Município do IBGE');label.setAttribute('for','staffCatalogCity');
    const citybox=element('div');citybox.className='city-picker';citybox.setAttribute('data-city-picker','');
    const input=element('input');input.id='staffCatalogCity';input.type='search';input.placeholder='Digite o município e a UF';input.autocomplete='off';
    input.setAttribute('list','staffCatalogSuggestions');input.setAttribute('data-city-input','');
    const datalist=element('datalist');datalist.id='staffCatalogSuggestions';
    const code=element('input');code.type='hidden';code.setAttribute('data-city-id','');
    const note=element('small','Carregando municípios do IBGE...');note.setAttribute('data-city-status','');note.setAttribute('aria-live','polite');
    citybox.append(input,datalist,code,note);
    const submit=element('button','Verificar visibilidade');submit.type='submit';submit.className='button button-primary';
    form.append(label,citybox,submit);
    const feedback=element('p','Selecione o município para verificar o catálogo.');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
    const results=element('div');results.className='sqf-catalog-diagnostic-results';results.setAttribute('aria-live','polite');
    card.append(heading,intro,form,feedback,results);
    const picker=scope.SQFCities?.picker(citybox);
    await picker?.ready;
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const selected=picker?.getSelected();
      if(!selected){picker?.validate();return;}
      submit.disabled=true;
      feedback.textContent='Consultando a visibilidade de profissionais em '+scope.SQFCities.format(selected)+'...';
      try{
        const payload=(await api.staffCatalogDiagnostics(selected.id)).data;
        const count=(label,value)=>{const p=element('p');p.append(element('strong',String(value)),document.createTextNode(' — '+label));return p;};
        results.replaceChildren();
        const title=element('h3','Situação em '+payload.municipality.name+' — '+payload.municipality.uf);
        results.append(title,
          count('prestadores cadastrados no município',payload.total),
          count('com e-mail confirmado',payload.email_confirmed),
          count('aguardando verificação cadastral',payload.verification_pending),
          count('com cadastro aprovado',payload.approved),
          count('com aprovação e publicação habilitada',payload.approved_public),
          count('com pelo menos um serviço ativo',payload.with_active_service),
          count('visíveis para clientes no catálogo',payload.visible),
          count('categorias com profissionais disponíveis',payload.visible_categories));
        if(!payload.billing_policy_defined)results.append(element('p','A configuração comercial ainda não está definida. Confira a instalação do banco.'));
        else if(payload.paid_subscription_required)results.append(element('p','A política comercial exige assinatura vigente para publicar profissionais.'));
        if(!payload.visible)results.append(element('p','Se existem cadastros mas nenhum perfil público, confira a confirmação do e-mail, o documento aceito, a aprovação administrativa, a publicação, os serviços ativos e a política comercial. Nenhuma dessas etapas será ignorada automaticamente.'));
        else{
          const link=element('a','Abrir catálogo deste município');link.href='categorias.html?cidade='+encodeURIComponent(payload.municipality.id);link.className='button button-outline';
          results.append(link);
        }
        feedback.textContent='Diagnóstico concluído.';
      }catch(e){results.replaceChildren();feedback.textContent=e.message||'Não foi possível consultar os dados.';}
      finally{submit.disabled=false;}
    });
    return card;
  }
  scope.SQFAdminCatalog=Object.freeze({panel});
})(window);
