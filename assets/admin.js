'use strict';
// O frontend não concede permissões; TODAS as consultas e decisões são verificadas pelo Postgres.
(() => {
  const $ = (id) => document.getElementById(id);
  const status = (message, problem=false) => { $('adminStatus').textContent=message; $('adminStatus').dataset.error=String(problem); };
  const note = (id, message) => { $(id).textContent=message; };
  const make = (tag, cls, value) => { const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=String(value);return el; };
  const actions = {
    providers: {pending:[['approve','Aprovar para exibição'],['reject','Rejeitar'],['suspend','Suspender']],approved:[['suspend','Suspender']], rejected:[['reopen','Reabrir análise']], suspended:[['reopen','Reabrir análise']]},
    reviews: {pending:[['publish','Publicar avaliação'],['reject','Rejeitar']],published:[['hide','Ocultar']],hidden:[['restore','Restaurar']],rejected:[]},
    disputes: {pending:[['review','Iniciar investigação'],['uphold','Acolher e ocultar avaliação'],['dismiss','Manter avaliação']],reviewing:[['uphold','Acolher e ocultar avaliação'],['dismiss','Manter avaliação']],upheld:[],dismissed:[]},
    responses: {pending:[['publish','Publicar resposta'],['reject','Rejeitar resposta']],published:[['hide','Ocultar resposta']],hidden:[['restore','Restaurar resposta']],rejected:[]},
    reports: {pending:[['review','Iniciar análise'],['resolve','Resolver'],['dismiss','Descartar']],reviewing:[['resolve','Resolver'],['dismiss','Descartar']],resolved:[],dismissed:[]},
    privacy: {pending:[['review','Iniciar análise']],reviewing:[['resolve','Concluir atendimento']],resolved:[]}
  };
  let client=null, role=null, factorId=null, queueBusy=false, lastQueueItems=[];

  async function rpc(name, params={}) {
    const {data,error}=await client.rpc(name,params);
    if(error)throw error;
    return data;
  }
  async function updateSession() {
    const {data,error}=await client.auth.getUser();
    if(error || !data?.user){status('Faça login na sua conta para continuar.',true);return false;}
    const own=await rpc('sqf_staff_whoami');
    if(!own?.role){status('Sua conta não possui permissão administrativa. Acesso negado.',true);return false;}
    role=own.role;
    if(!own.mfa_ready){
      $('mfaSection').hidden=false; $('adminContent').hidden=true;
      status('Sua conta precisa concluir o segundo fator de autenticação.');
      const {data:factors,error:factorError}=await client.auth.mfa.listFactors();
      if(factorError)throw factorError;
      factorId=factors?.totp?.find(item=>item.status==='verified')?.id || null;
      $('mfaEnroll').hidden=Boolean(factorId);
      note('mfaStatus',factorId?'Informe o código do seu aplicativo autenticador.':'Configure um autenticador TOTP e confirme o primeiro código.');
      return true;
    }
    $('mfaSection').hidden=true;$('adminContent').hidden=false;$('mfaSecret').textContent='';
    $('adminRole').textContent=role==='admin'?'Administrador':'Moderador';
    $('adminQueue').querySelectorAll('option').forEach(option=>{
      option.disabled=role!=='admin' && ['providers','privacy','audit'].includes(option.value);
    });
    if(role!=='admin' && ['providers','privacy','audit'].includes($('adminQueue').value))$('adminQueue').value='reviews';
    status('Acesso autorizado com MFA. As decisões serão registradas na auditoria.');
    await refresh();return true;
  }
  async function refresh() {
    if(queueBusy)return;
    queueBusy=true;
    $('queueResults').replaceChildren(make('p','muted','Carregando solicitações...'));
    try{
      const overview=await rpc('sqf_staff_overview');
      const stats=$('adminStats');stats.replaceChildren();
      const labels={providers:'Prestadores pendentes',reviews:'Avaliações pendentes',reports:'Denúncias abertas',privacy:'Pedidos LGPD'};
      for(const [key,label] of Object.entries(labels)){
        if(key==='privacy'&&role!=='admin')continue;
        if(key==='providers'&&role!=='admin')continue;
        const card=make('div','admin-stat');card.append(make('span','',label),make('strong','',overview[key]??'—'));stats.append(card);
      }
      await loadQueue();
    }catch{
      status('Não foi possível consultar as filas. Confira sua sessão MFA e a configuração do Supabase.',true);
      $('queueResults').replaceChildren(make('p','muted','Consulta indisponível.'));
    }finally{queueBusy=false;}
  }
  async function loadQueue(){
    const q=$('adminQueue').value;
    const items=['disputes','responses'].includes(q)
      ? await rpc('sqf_staff_review_cases',{p_queue:q,p_limit:40})
      : await rpc('sqf_staff_queue',{p_queue:q,p_limit:40});
    lastQueueItems=Array.isArray(items)?items:[];
    renderQueue();
  }
  function renderQueue(){
    const q=$('adminQueue').value;
    const search=$('adminSearch')?.value.trim().toLocaleLowerCase('pt-BR')||'';
    const filter=$('adminStateFilter')?.value||'';
    const items=lastQueueItems.filter(item => (!filter||item.status===filter) &&
      (!search || `${item.title||''} ${item.subtitle||''} ${item.summary||''}`.toLocaleLowerCase('pt-BR').includes(search)));
    const area=$('queueResults');area.replaceChildren();
    if($('adminFilteredCount'))$('adminFilteredCount').textContent=`${items.length} de ${lastQueueItems.length} registros nesta fila (limite da consulta: 40)`;
    if(!items.length){area.append(make('p','muted','Nenhum registro corresponde aos filtros.'));return;}
    for(const item of items){
      const article=make('article','admin-item');
      const top=make('div','admin-item-head');
      const heading=make('h3','',item.title || 'Registro');
      top.append(heading,make('span','admin-tag',item.status||'—'));
      if(q==='reports' && ['pending','reviewing'].includes(item.status))top.append(make('span','admin-priority','Denúncia aberta · requer triagem'));
      article.append(top);
      const meta=make('p','muted',`${item.subtitle||''} · ${new Date(item.created_at).toLocaleDateString('pt-BR')}`);
      article.append(meta);
      if(item.summary)article.append(make('p','admin-summary',item.summary));
      if(item.original_comment){
        const original=make('div','provider-response');
        original.append(make('strong','','Avaliação original para análise'),make('p','',`${item.original_rating||'—'}/5 — ${item.original_comment}`));
        article.append(original);
      }
      if(q==='providers'){
        article.append(make('p','muted',`Serviços cadastrados: ${item.service_count ?? 0}. A aprovação não substitui análise documental externa.`));
        const checkButton=make('button','button button-outline button-small','Conferir fotografia frontal');
        checkButton.type='button';
        const holder=make('div','portrait-admin-review');
        checkButton.addEventListener('click',async()=>{
          checkButton.disabled=true;
          try{
            const record=await rpc('sqf_staff_provider_portrait',{p_provider:item.id});
            holder.replaceChildren();
            if(!record?.path){holder.append(make('p','muted','O prestador não cadastrou uma foto de perfil.'));return;}
            // O banco devolve um caminho, nunca HTML. A imagem exige host e padrão conhecidos.
            if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/i.test(record.path)){
              holder.append(make('p','muted','Formato antigo ou incompatível. Solicite ao prestador uma nova foto 3×4 WebP.'));
              return;
            }
            const url=client.storage.from('sqf-avatars').getPublicUrl(record.path)?.data?.publicUrl;
            const expected=new URL(window.SQFSupabase.url);
            const candidate=new URL(url);
            if(candidate.protocol!=='https:'||candidate.host!==expected.host)throw new Error('Origem de imagem não autorizada');
            const photo=make('img','admin-portrait');photo.src=candidate.href;
            photo.alt='Foto declarada pelo prestador. Verifique rosto frontal, pessoa única, nitidez e enquadramento frontal.';
            holder.append(photo,make('p','muted',record.accepted?'Retrato já conferido para esta versão.':'Retrato ainda não aprovado para a versão atual do perfil.'));
            const form=make('form','review-case-form');
            const label=make('label','','Justificativa da inspeção da foto');
            const comments=make('textarea');comments.minLength=20;comments.maxLength=1000;
            comments.placeholder='Descreva se o rosto está frontal, visível, sem terceiros ou filtros.';
            comments.required=true;comments.rows=3;
            const buttons=make('div','admin-actions');
            const message=make('p','form-feedback');message.setAttribute('role','status');
            const verdicts=[[true,'Aprovar enquadramento'],[false,'Rejeitar retrato']];
            for(const [accepted,name] of verdicts){
              const button=make('button','button button-outline button-small',name);button.type='button';
              button.addEventListener('click',async()=>{
                if(comments.value.trim().length<20){message.textContent='Justifique a análise com pelo menos 20 caracteres.';return;}
                if(!confirm(`Registrar decisão de retrato: ${name}?`))return;
                [...buttons.querySelectorAll('button')].forEach(b=>b.disabled=true);
                try{
                  await rpc('sqf_staff_check_portrait',{
                    p_provider:item.id,p_accepted:accepted,p_note:comments.value.trim()
                  });
                  message.textContent='Análise de retrato registrada. A publicação ainda requer aprovação cadastral.';
                }catch{
                  message.textContent='Não foi possível registrar. Confira sessão MFA e dados.';
                }finally{[...buttons.querySelectorAll('button')].forEach(b=>b.disabled=false);}
              });buttons.append(button);
            }
            form.append(label,comments,buttons,message);holder.append(form);
          }catch{holder.replaceChildren(make('p','muted','Não foi possível verificar a fotografia.'));}
          finally{checkButton.disabled=false;}
        });
        const detailsButton=make('button','button button-outline button-small','Conferir dados de atendimento');
        detailsButton.type='button';
        const detailsHolder=make('div','admin-professional-details');
        detailsButton.addEventListener('click',async()=>{
          detailsButton.disabled=true;
          detailsHolder.replaceChildren(make('p','muted','Carregando dados profissionais...'));
          try{
            const extra=await rpc('sqf_staff_provider_professional_details',{p_provider:item.id});
            detailsHolder.replaceChildren();
            if(!extra){detailsHolder.append(make('p','muted','O prestador ainda não cadastrou informações profissionais adicionais.'));return;}
            const labels={professional_title:'Título profissional',specialties:'Especialidades',experience_years:'Experiência declarada (anos)',service_mode:'Modalidade',coverage_area:'Regiões informadas',workdays:'Dias da semana (1=seg, 7=dom)',work_period:'Turno',quote_policy:'Condição do orçamento',professional_website:'Site externo informado'};
            const dl=make('dl','admin-details-list');
            for(const [key,label] of Object.entries(labels)){
              const value=Array.isArray(extra[key])?extra[key].join(', '):String(extra[key]??'').trim();
              if(!value)continue;
              dl.append(make('dt','',label),make('dd','',value));
            }
            detailsHolder.append(dl);
            detailsHolder.append(make('p','muted','Dados autodeclarados: a aprovação não comprova experiência ou credenciais. Confira alegações suspeitas antes de decidir.'));
          }catch{detailsHolder.replaceChildren(make('p','muted','Consulta não autorizada ou migração v3.7.1 indisponível.'));}
          finally{detailsButton.disabled=false;}
        });
        article.append(checkButton,holder,detailsButton,detailsHolder);

      }
      if(q==='audit'){
        area.append(article);continue;
      }
      const available=actions[q]?.[item.status]||[];
      if(available.length){
        const form=make('form','admin-decision');
        const label=make('label','',`Justificativa da decisão para ${item.title||'o item'}`);
        const textarea=make('textarea','');textarea.minLength=20;textarea.maxLength=1000;textarea.required=true;
        textarea.rows=3;textarea.placeholder='Informe os elementos verificados, sem dados sensíveis (20–1000 caracteres).';
        const id=`admin-note-${q}-${item.id}`;textarea.id=id;label.htmlFor=id;
        const buttons=make('div','admin-actions');
        for(const [action,display] of available){
          const btn=make('button','button button-outline button-small',display);btn.type='button';
          btn.addEventListener('click',async()=>{
            const justification=textarea.value.trim();
            if(justification.length<20||justification.length>1000){textarea.focus();message.textContent='Registre uma justificativa de 20 a 1000 caracteres.';return;}
            if(!window.confirm(`Confirmar a ação “${display}” sobre este registro?`))return;
            [...buttons.querySelectorAll('button')].forEach(b=>b.disabled=true);
            try{
              if(['disputes','responses'].includes(q)){
                await rpc('sqf_staff_review_case_decide',{p_queue:q,p_target:item.id,p_action:action,p_note:justification});
              } else {
                await rpc('sqf_staff_decide',{p_queue:q,p_target:item.id,p_action:action,p_note:justification});
              }
              status('Decisão registrada no servidor e na auditoria.');
              await refresh();
            }catch{
              message.textContent='A decisão não foi aceita. Confira sua permissão, MFA e o estado atual do item.';
              [...buttons.querySelectorAll('button')].forEach(b=>b.disabled=false);
            }
          });buttons.append(btn);
        }
        const message=make('p','form-feedback');message.setAttribute('role','status');
        form.append(label,textarea,buttons,message);article.append(form);
      }
      area.append(article);
    }
  }
  async function initialize(){
    $('staffLogout')?.addEventListener('click',async()=>{try{await client?.auth.signOut();}finally{location.replace('index.html');}});
    $('adminQueue').addEventListener('change',()=>{lastQueueItems=[];$('adminSearch').value='';$('adminStateFilter').value='';refresh();});
    $('adminSearch')?.addEventListener('input',renderQueue);
    $('adminStateFilter')?.addEventListener('change',renderQueue);
    $('refreshAdmin').addEventListener('click',()=>{refresh();});
    $('mfaEnroll').addEventListener('click',async()=>{
      $('mfaEnroll').disabled=true;
      try{
        const {data,error}=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'SERÁ QUEM FAZ? — Administração'});
        if(error||!data?.id||!data?.totp?.secret)throw error || new Error('Configuração incompleta');
        factorId=data.id;
        $('mfaSecret').textContent=data.totp.secret;
        $('mfaEnrollment').hidden=false;
        note('mfaStatus','Adicione a chave ao aplicativo autenticador e digite o código de seis dígitos. Não compartilhe a chave.');
      }catch{note('mfaStatus','Não foi possível configurar o autenticador. Consulte a administração do Supabase.');}
      finally{$('mfaEnroll').disabled=false;}
    });
    $('mfaForm').addEventListener('submit',async(event)=>{
      event.preventDefault();
      const code=$('mfaCode').value.trim();
      if(!/^[0-9]{6}$/.test(code)||!factorId){note('mfaStatus','Informe um código válido.');return;}
      const button=$('mfaForm').querySelector('button[type=submit]');button.disabled=true;
      try{
        const {error}=await client.auth.mfa.challengeAndVerify({factorId,code});
        if(error)throw error;
        $('mfaCode').value='';$('mfaSecret').textContent='';$('mfaEnrollment').hidden=true;
        await updateSession();
      }catch{note('mfaStatus','Código inválido, expirado ou sessão indisponível. Tente novamente.');}
      finally{button.disabled=false;}
    });
    try{
      client=window.getSQFClient();
      await updateSession();
    }catch{
      status('O painel não pode ser iniciado. Configure as migrações e confirme a autenticação.',true);
    }
  }
  initialize();
})();
