'use strict';
/* Proteção de senha: nunca armazenar ou registrar o conteúdo no log, URL,
 * cache de aplicação ou histórico de navegador. */
(()=>{
 const $=id=>document.getElementById(id);
 const form=$('sqfPasswordForm');if(!form)return;
 let ready=false,client=null;
 window.addEventListener('sqf:account-ready',e=>{
  if(!['cliente','prestador'].includes(e.detail?.role))return;
  client=window.getSQFClient?.()||null;ready=Boolean(client);
 },{once:true});
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const newPassword=$('sqfNewPassword').value,confirmation=$('sqfConfirmPassword').value;
  const message=$('sqfPasswordStatus'),button=$('sqfPasswordSave');
  if(!ready||!client){
   message.textContent='Sua conta não está carregada. Atualize a página e tente novamente.';
   message.dataset.error='true';return;
  }
  if(newPassword.length<12||newPassword.length>128||confirmation!==newPassword){
   message.textContent='Use pelo menos 12 caracteres e confirme a mesma senha.';
   message.dataset.error='true';return;
  }
  button.disabled=true;
  try{
   const {error}=await client.auth.updateUser({password:newPassword});
   if(error)throw error;
   message.dataset.error='false';
   message.textContent='Senha atualizada. Guarde sua nova senha em um gerenciador seguro.';
   form.reset();
  }catch(error){
   message.dataset.error='true';
   message.textContent=error?.message?.includes('session')?
    'Sessão expirada. Entre novamente e tente alterar a senha.':
    'Não foi possível alterar a senha. Confira os requisitos de segurança e tente novamente.';
  }finally{button.disabled=false;}
 });
})();
