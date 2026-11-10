'use strict';
/* Agenda vinculada à solicitação aceita. Regras decisivas estão na RPC
   sqf_manage_appointment; navegador nunca faz UPDATE direto. */
(function(scope){
 const labelTime=value=>value&&Number.isFinite(Date.parse(value))
  ?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'—';
 const inputTime=value=>{
  const d=new Date(value),p=n=>String(n).padStart(2,'0');
  if(!Number.isFinite(d.getTime()))return '';
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());
 };
 const el=(tag,klass,txt)=>{const n=document.createElement(tag);if(klass)n.className=klass;if(txt!==undefined)n.textContent=txt;return n;};
 const actButton=(txt,fn,primary=false)=>{
  const btn=el('button','button '+(primary?'button-primary':'button-outline')+' button-small',txt);
  btn.type='button';btn.addEventListener('click',async()=>{
   btn.disabled=true;try{await fn();}finally{btn.disabled=false;}
  });return btn;
 };
 async function render({client,user,request,root,onSaved,stillCurrent=()=>true}){
  if(!['accepted','in_progress','awaiting_confirmation'].includes(request.status))return;
  const section=el('section','sqf-agenda-editor');
  section.append(el('h4','','Agendar atendimento'),el('p','muted',
   'O horário fica confirmado somente quando a outra parte aceitar. Propostas não reservam horários. A confirmação será bloqueada se houver outro atendimento confirmado no mesmo intervalo; não há cobrança automática.'));
  let appointment;
  try{
   const {data,error}=await client.from('sqf_appointments')
    .select('id,request_id,starts_at,duration_minutes,status,proposed_by')
    .eq('request_id',request.id).maybeSingle();
   if(error)throw error;appointment=data;
  }catch{
   section.append(el('p','muted','Agenda em preparação. A migração privada ainda precisa ser ativada.'));
   if(stillCurrent())root.append(section);return;
  }
  if(!stillCurrent())return;
  const feedback=el('p','form-feedback');feedback.setAttribute('role','status');
  const names={proposed:'Proposta aguardando resposta',confirmed:'Agendamento confirmado',declined:'Proposta recusada',canceled:'Agendamento cancelado'};
  if(appointment){
   section.append(el('span','sqf-agenda-badge',names[appointment.status]||'Horário informado'));
   section.append(el('p','muted',labelTime(appointment.starts_at)+' · '+appointment.duration_minutes+' minutos'));
  }
  const command=async(action,date=null,duration=null)=>{
   feedback.textContent='Registrando horário...';feedback.dataset.error='false';
   const {error}=await client.rpc('sqf_manage_appointment',{
    p_request:request.id,p_action:action,p_starts_at:date,p_duration_minutes:duration
   });
   if(error){
    if(error.code==='23P01')throw new Error('Horário indisponível: existe outro atendimento confirmado neste intervalo. Escolha outro horário.');
    throw error;
   }
   scope.dispatchEvent(new Event('sqf:appointment-updated'));
   await onSaved();
  };
  const buttons=el('div','sqf-request-actions');
  const add=(txt,action,primary=false)=>buttons.append(actButton(txt,async()=>{
   try{
    if(action==='cancel'&&!scope.confirm('Deseja cancelar este horário? A solicitação permanece registrada.'))return;
    await command(action);
   }catch(error){feedback.textContent=error.message||'Falha ao atualizar a agenda.';feedback.dataset.error='true';}
  },primary));
  if(appointment?.status==='proposed'&&appointment.proposed_by!==user.id){
   add('Confirmar horário','confirm',true);
   add('Recusar proposta','decline');
  }
  if(appointment&&['proposed','confirmed'].includes(appointment.status))add('Cancelar horário','cancel');
  if(buttons.childElementCount)section.append(buttons);
  const form=el('form','sqf-agenda-form');
  const fields=el('div','sqf-agenda-fields');
  const dateLabel=el('label','','Novo horário proposto'),date=el('input');
  date.type='datetime-local';date.required=true;
  date.min=inputTime(Date.now()+30*60*1000);
  if(appointment?.status==='proposed'||appointment?.status==='confirmed')date.value=inputTime(appointment.starts_at);
  dateLabel.append(date);
  const timeLabel=el('label','','Duração estimada'),duration=el('select');
  for(const minutes of [30,60,90,120,180,240,360,480]){
   const option=el('option','',minutes+' minutos');option.value=String(minutes);duration.append(option);
  }
  duration.value=String(appointment?.duration_minutes||60);timeLabel.append(duration);
  fields.append(dateLabel,timeLabel);
  const submit=el('button','button button-primary button-small',appointment?'Propor outro horário':'Propor horário');
  submit.type='submit';
  form.append(fields,submit,feedback);
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   const time=Date.parse(date.value),minutes=Number(duration.value);
   if(!Number.isFinite(time)||time<=Date.now()+30*60*1000||time>Date.now()+180*86400000||
     ![30,60,90,120,180,240,360,480].includes(minutes)){
    feedback.textContent='Selecione uma data futura válida e uma duração.';
    feedback.dataset.error='true';return;
   }
   submit.disabled=true;
   try{await command('propose',new Date(time).toISOString(),minutes);}
   catch(error){feedback.textContent=error.message||'Não foi possível propor esse horário.';feedback.dataset.error='true';}
   finally{submit.disabled=false;}
  });
  section.append(form);root.append(section);
 }
 scope.SQFAgenda=Object.freeze({render,inputTime});
})(window);
