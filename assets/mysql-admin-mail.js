'use strict';
/* Administrative SMTP UI: only rendered after server-side admin+MFA authorization.
 * Never reflect, log, persist or prefill the SMTP password in the browser. */
(function(scope){
 const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);return e;};
 const label=(text,input)=>{const e=node('label');e.className='sqf-mail-field';e.append(node('span',text),input);return e;};
 const field=(name,value='',type='text')=>{const e=node('input');e.name=name;e.type=type;e.value=String(value||'');e.autocomplete='off';e.maxLength=name==='password'?1024:254;return e;};
 const setMessage=(container,message,error=false)=>{container.textContent=message;container.className=error?'sqf-mail-feedback is-error':'sqf-mail-feedback';};
 const button=(text,kind='button')=>{const el=node('button',text);el.type=kind;el.className=kind==='submit'?'button button-primary':'button button-outline';return el;};
 const datestr=value=>value?new Date(value).toLocaleString('pt-BR'):'Ainda não registrado';
 async function panel(api){
   const card=node('article');card.className='card sqf-mail-panel';
   card.append(node('h2','E-mails e notificações'),
     node('p','Configuração do e-mail de saída da plataforma. Disponível exclusivamente para administradores com MFA. A senha é armazenada no servidor e nunca é exibida neste painel.'));
   const feedback=node('p','Carregando status do envio de e-mails...');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');card.append(feedback);
   const summary=node('div');summary.className='sqf-mail-summary';card.append(summary);
   const form=node('form');form.className='sqf-mail-form';
   const enabled=node('input');enabled.type='checkbox';enabled.name='enabled';
   const enabledLabel=label('Habilitar envio de e-mails de autenticação',enabled);enabledLabel.className='sqf-mail-toggle';
   const host=node('select');host.name='host';
   [['smtp.hostinger.com','Hostinger Email'],['smtp.titan.email','Titan Email']].forEach(([v,t])=>{const o=node('option',t+' — '+v);o.value=v;host.append(o);});
   const port=node('select');port.name='port';
   [['465','465 — TLS/SSL'],['587','587 — STARTTLS']].forEach(([v,t])=>{const o=node('option',t);o.value=v;port.append(o);});
   const from=field('from','', 'email');from.required=true;
   const username=field('username','', 'email');username.required=true;
   const password=field('password','', 'password');password.placeholder='Deixe em branco para manter a senha atual';password.autocomplete='new-password';
   const grid=node('div');grid.className='sqf-mail-grid';
   grid.append(label('Servidor SMTP',host),label('Porta e criptografia',port),label('E-mail remetente',from),label('Usuário de autenticação',username),label('Senha da caixa de e-mail',password));
   const help=node('p','Selecione o servidor mostrado nas configurações da sua caixa postal Hostinger ou Titan. O remetente e o usuário precisam ser a mesma caixa. Nunca informe a senha de login de cliente.');
   help.className='muted';
   const save=button('Salvar configuração','submit');
   form.append(enabledLabel,grid,help,save);
   card.append(form);
   const controls=node('div');controls.className='sqf-mail-controls';
   const test=button('Enviar e-mail de teste para minha conta');
   test.title='Envia apenas para o endereço de e-mail da conta administrativa autenticada.';
   const reload=button('Atualizar diagnóstico');
   controls.append(test,reload);card.append(controls);
   const diag=node('div');diag.className='sqf-mail-diagnostics';card.append(diag);
   const events=node('div');events.className='sqf-mail-audit';card.append(events);
   function display(data){
      enabled.checked=Boolean(data.enabled);host.value=data.host||'smtp.hostinger.com';
      port.value=String(data.port||465);
      from.value=data.from||'';username.value=data.username||'';
      password.value='';password.placeholder=data.password_configured?'Senha protegida — deixe vazio para manter':'Informe a senha da caixa de e-mail';
      summary.replaceChildren();
      const state=node('strong',data.enabled&&data.configured?'Envio configurado':'Envio indisponível');
      state.className=data.enabled&&data.configured?'sqf-mail-state is-ready':'sqf-mail-state';
      summary.append(state,node('p','Origem: '+(data.source==='private'?'Configuração privada do painel':'Configuração inicial da hospedagem')+' · Última alteração: '+datestr(data.updated_at)));
      diag.replaceChildren(node('h3','Diagnóstico de notificações'));
      const q=data.queue||{};
      diag.append(node('p','Trabalhador de notificações: '+(data.notifications_worker_enabled?'Habilitado':'Desativado até homologação')));
      diag.append(node('p','Fila: '+Number(q.pending||0)+' pendentes · '+Number(q.sent||0)+' enviadas · '+Number(q.failed||0)+' falhas · '+Number(q.skipped||0)+' ignoradas'));
      events.replaceChildren(node('h3','Histórico recente (sem informações confidenciais)'));
      if(!Array.isArray(data.events)||!data.events.length)events.append(node('p','Nenhum teste ou ajuste administrativo registrado.'));
      else{
        const list=node('ul');
        for(const event of data.events.slice(-10).reverse()){
          const kind=event.event==='settings_updated'?'Configuração atualizada':'Teste de envio';
          list.append(node('li',datestr(event.at)+' · '+kind+' · '+(event.result==='ok'?'Sucesso':'Falha')));
        }
        events.append(list);
      }
   }
   async function refresh(){const res=await api.staffMailSettings();display(res.data);return res.data;}
   form.addEventListener('submit',async e=>{
     e.preventDefault();save.disabled=true;test.disabled=true;
     try{
       const changes={enabled:enabled.checked,host:host.value,port:Number(port.value),security:port.value==='465'?'tls':'starttls',
                      from:from.value.trim(),username:username.value.trim(),password:password.value};
       const res=await api.staffMailSave(changes);
       display(res.data);setMessage(feedback,'Configuração salva fora da pasta pública. Senha não será exibida.');
     }catch(error){password.value='';setMessage(feedback,error.message||'Falha ao salvar configuração.',true);}
     finally{save.disabled=false;test.disabled=false;}
   });
   test.addEventListener('click',async()=>{
     test.disabled=true;save.disabled=true;setMessage(feedback,'Verificando o envio para o e-mail administrativo...');
     try{
       const res=await api.staffMailTest();
       await refresh();setMessage(feedback,res.message||'Envio realizado. Confira sua caixa postal.');
     }catch(error){try{await refresh();}catch(_e){}setMessage(feedback,error.message||'Falha no teste de envio.',true);}
     finally{test.disabled=false;save.disabled=false;}
   });
   reload.addEventListener('click',async()=>{
     reload.disabled=true;
     try{await refresh();setMessage(feedback,'Diagnóstico atualizado.');}
     catch(error){setMessage(feedback,error.message||'Falha ao consultar diagnóstico.',true);}
     finally{reload.disabled=false;}
   });
   try{await refresh();setMessage(feedback,'Configuração administrativa carregada.');}
   catch(error){setMessage(feedback,error.message||'Não foi possível carregar as configurações.',true);form.hidden=true;controls.hidden=true;}
   return card;
 }
 scope.SQFAdminMail=Object.freeze({panel});
})(window);
