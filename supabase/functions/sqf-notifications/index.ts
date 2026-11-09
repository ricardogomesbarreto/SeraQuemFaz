// SERÁ QUEM FAZ? — avisos por e-mail, DESATIVADO até configuração e homologação.
// Endpoint exclusivamente interno. Nunca importar este arquivo no navegador.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SQF_NOTIFY_SECRET,
// RESEND_API_KEY, SQF_EMAIL_FROM, SQF_SITE_URL e SQF_NOTIFICATIONS_ENABLED=true.
const env=(key:string)=>Deno.env.get(key)?.trim()||'';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json=(obj:unknown,status=200)=>new Response(JSON.stringify(obj),{
 status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
});
const sameSecret=async(candidate:string,expected:string)=>{
 const encode=new TextEncoder();
 if(!candidate||!expected)return false;
 const [a,b]=await Promise.all([
  crypto.subtle.digest('SHA-256',encode.encode(candidate)),
  crypto.subtle.digest('SHA-256',encode.encode(expected))
 ]);
 const aa=new Uint8Array(a),bb=new Uint8Array(b);
 let difference=0;for(let i=0;i<aa.length;i++)difference|=aa[i]^bb[i];
 return difference===0;
};
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'Método não permitido'},405);
 if(!(await sameSecret(req.headers.get('x-sqf-notify-secret')||'',env('SQF_NOTIFY_SECRET'))))
  return json({error:'Não autorizado'},401);
 if(env('SQF_NOTIFICATIONS_ENABLED')!=='true')
  return json({error:'Envio desativado durante a homologação'},503);
 const base=env('SUPABASE_URL'),role=env('SUPABASE_SERVICE_ROLE_KEY'),apiKey=env('RESEND_API_KEY'),
  from=env('SQF_EMAIL_FROM'),site=env('SQF_SITE_URL');
 if(!base.startsWith('https://')||!role||!apiKey||!from||!site.startsWith('https://'))
  return json({error:'Configuração de avisos incompleta'},503);
 const baseUrl=new URL(base);
 if(!baseUrl.hostname.endsWith('.supabase.co'))return json({error:'Endpoint de banco inválido'},503);
 const headers={'apikey':role,'Authorization':'Bearer '+role,'Content-Type':'application/json'};
 const database=async(path:string,options:RequestInit={})=>{
  const response=await fetch(baseUrl.origin+'/rest/v1/'+path,{
   ...options,headers:{...headers,...options.headers}
  });
  if(!response.ok)throw new Error('Falha interna no banco');
  const text=await response.text();return text?JSON.parse(text):null;
 };
 let processed=0,failed=0,skipped=0;
 try{
  const pending=await database('sqf_notification_outbox?select=notification_id,recipient_id,attempts&status=eq.pending&next_attempt_at=lte.'+
   encodeURIComponent(new Date().toISOString())+'&order=created_at.asc&limit=15') as
   Array<{notification_id:string;recipient_id:string;attempts:number}>;
  for(const row of pending||[]){
   if(!uuid.test(row.notification_id)||!uuid.test(row.recipient_id))continue;
   const id=encodeURIComponent(row.notification_id);
   const update=async(fields:Record<string,unknown>)=>{
    await database('sqf_notification_outbox?notification_id=eq.'+id,{
     method:'PATCH',body:JSON.stringify(fields)
    });
   };
   try{
    const prefs=await database('sqf_notification_preferences?select=email_enabled&user_id=eq.'+
     encodeURIComponent(row.recipient_id)+'&limit=1') as Array<{email_enabled:boolean}>;
    if(!prefs?.[0]?.email_enabled){
     await update({status:'skipped',processed_at:new Date().toISOString()});skipped++;continue;
    }
    const notes=await database('sqf_notifications?select=title,body,request_id&id=eq.'+id+'&limit=1') as
     Array<{title:string;body:string;request_id:string|null}>;
    if(!notes?.length){
     await update({status:'skipped',processed_at:new Date().toISOString()});skipped++;continue;
    }
    const identity=await fetch(baseUrl.origin+'/auth/v1/admin/users/'+encodeURIComponent(row.recipient_id),{headers});
    if(!identity.ok)throw new Error('Destinatário indisponível');
    const account=await identity.json();
    if(typeof account.email!=='string'||!account.email.includes('@'))throw new Error('E-mail ausente');
    const text=notes[0].title+'\n\n'+(notes[0].body||'Você possui uma atualização na plataforma.')+
     '\n\nAcesse sua conta: '+new URL('/painel.html',site).toString()+
     '\n\nNão responda a este aviso nem compartilhe dados sensíveis por e-mail.';
    const outgoing=await fetch('https://api.resend.com/emails',{
     method:'POST',headers:{
      'Authorization':'Bearer '+apiKey,'Content-Type':'application/json',
      'Idempotency-Key':'sqf-notification-'+row.notification_id
     },
     body:JSON.stringify({from,to:[account.email],subject:'SERÁ QUEM FAZ? — '+notes[0].title,text})
    });
    if(!outgoing.ok)throw new Error('Provedor de e-mail indisponível');
    await update({status:'sent',processed_at:new Date().toISOString(),attempts:row.attempts+1});
    processed++;
   }catch{
    const attempts=row.attempts+1;
    const next=new Date(Date.now()+Math.min(3600,60*(2**Math.min(attempts,6)))*1000).toISOString();
    try{await update({status:attempts>=8?'failed':'pending',attempts,next_attempt_at:next});}
    catch{/* Falha registrada sem expor mensagens ou endereços em logs. */}
    failed++;
   }
  }
  return json({processed,failed,skipped});
 }catch{return json({error:'Fila indisponível'},503);}
});
