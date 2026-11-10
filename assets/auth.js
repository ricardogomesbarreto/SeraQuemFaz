'use strict';
(() => {
  const mysql=window.SQFDataMode==='mysql';
  const minPassword=mysql?12:8;
  const utils = window.SQFUtils;
  const $ = (id) => document.getElementById(id);
  const status = (id, value, error = false) => {
    const el = $(id); if (!el) return;
    el.textContent = value;
    el.dataset.error = String(error);
  };
  const fieldError = (id, message) => {
    const el = $(id); if (!el) return;
    const input = $(id.replace('Error', ''));
    el.textContent = message;
    if (input) input.setAttribute('aria-invalid', String(Boolean(message)));
  };
  const busy = (button, running) => {
    button.disabled = running;
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.textContent = running ? 'Aguarde...' : button.dataset.label;
  };
  function clientOrError() {
    try { return window.getSQFClient(); }
    catch { status('message', 'O serviço de autenticação está indisponível. Atualize a página ou tente novamente mais tarde.', true); return null; }
  }
  document.querySelectorAll('[data-toggle-password]').forEach(button => {
    button.addEventListener('click', () => {
      const field = $(button.dataset.togglePassword);
      const show = field.type === 'password';
      field.type = show ? 'text' : 'password';
      button.textContent = show ? 'Ocultar' : 'Mostrar';
      button.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
      button.setAttribute('aria-pressed', String(show));
    });
  });
  const localProtocolNotice = $('authLocalProtocolNotice');
  const localOrUnpublished = !mysql && !window.SQFAuthRedirect?.publicRedirect();
  if (localProtocolNotice && !mysql && (location.protocol === 'file:' || localOrUnpublished)) localProtocolNotice.hidden = false;
  const verificationRedirect = (page) => window.SQFAuthRedirect?.publicRedirect(page) || null;
  const signup = $('signupForm');
  if(mysql){
    if(signup){$('password').minLength=12;$('password').placeholder='Mínimo 12 caracteres';}
    const code=$('emailCode');if(code){code.pattern='[0-9a-f]{64}';code.minLength=64;code.maxLength=64;code.inputMode='text';code.placeholder='Código de 64 caracteres';const label=document.querySelector('label[for="emailCode"]');if(label)label.textContent='Código de 64 caracteres';const hint=$('emailCodeForm')?.querySelector('p.muted');if(hint)hint.textContent='Informe o código recebido por e-mail. Ele expira após 30 minutos.';}
    const reset=$('resetPassword');if(reset){reset.minLength=12;reset.placeholder='Mínimo 12 caracteres';const label=document.createElement('label');label.textContent='Código de recuperação recebido por e-mail';const token=document.createElement('input');token.id='mysqlResetToken';token.required=true;token.minLength=64;token.maxLength=64;token.autocomplete='one-time-code';label.append(token);reset.parentNode.insertBefore(label,reset);}
  }
  let signupInFlight = false;
  if (signup) {
    if (new URLSearchParams(location.search).get('tipo') === 'prestador') $('accountType').value = 'prestador';
    const updateSignupProgress = () => {
      const picker=$('signupCity')?.closest('[data-city-picker]')?.__cityPicker;
      const good = [
        $('firstName').value.trim().length >= 2,
        $('lastName').value.trim().length >= 2,
        utils.isValidEmail($('email').value.trim()),
        Boolean(picker?.getSelected()),
        $('password').value.length >= minPassword,
        Boolean($('confirmPassword').value) && $('confirmPassword').value === $('password').value
      ].filter(Boolean).length;
      $('signupProgress').value=good;
      $('signupProgressText').textContent=`${good} de 6 campos essenciais validados nesta etapa. A confirmação de e-mail vem depois do envio.`;
    };
    signup.addEventListener('input',updateSignupProgress);
    signup.addEventListener('change',updateSignupProgress);
    $('signupCity')?.closest('[data-city-picker]')?.addEventListener('sqf:city-change',updateSignupProgress);
    updateSignupProgress();
    signup.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (signupInFlight) return;
      ['firstNameError','lastNameError','emailError','passwordError','confirmPasswordError'].forEach(id => fieldError(id,''));
      status('message','');
      const first = $('firstName').value.trim();
      const last = $('lastName').value.trim();
      const email = $('email').value.trim();
      const password = $('password').value;
      const type = $('accountType').value;
      const cityPicker = $('signupCity')?.closest('[data-city-picker]')?.__cityPicker;
      const selectedCity = cityPicker?.getSelected();
      let valid = true;
      const requireField = (id, bad, message) => { if (bad) { fieldError(id, message); valid = false; } };
      requireField('firstNameError',first.length < 2 || first.length > 60,'Informe um nome válido (2 a 60 caracteres).');
      requireField('lastNameError',last.length < 2 || last.length > 80,'Informe um sobrenome válido (2 a 80 caracteres).');
      requireField('emailError',!utils.isValidEmail(email),'Informe um e-mail válido.');
      requireField('passwordError',password.length < minPassword,`Use uma senha com pelo menos ${minPassword} caracteres.`);
      requireField('confirmPasswordError',password !== $('confirmPassword').value,'As senhas devem ser iguais.');
      if (!selectedCity) { cityPicker?.validate(); valid = false; }
      if (!valid) return;
      const client = mysql?null:clientOrError(); if (!mysql&&!client) return;
      signupInFlight = true;
      const button = $('submitBtn'); busy(button,true);
      try {
        if(mysql){await window.SQFMySQL.register(email,password,`${first} ${last}`,type,selectedCity.id);status('message','Cadastro recebido. Confira o código de confirmação no e-mail e use a tela de acesso.');return;}
        const redirect = verificationRedirect('entrar.html');
        const { data, error } = await client.auth.signUp({
          email, password,
          options:{ ...(redirect ? {emailRedirectTo:redirect} : {}), data: { full_name: `${first} ${last}`, account_type: type === 'prestador' ? 'prestador' : 'cliente', city: window.SQFCities.format(selectedCity), city_ibge: selectedCity.id } }
        });
        if (error) throw error;
        if (!data?.user) throw new Error('Resposta de cadastro incompleta.');
        if (data.session) location.assign('painel.html');
        else status('message', redirect
          ? 'Cadastro recebido. Confirme seu e-mail pelo link enviado ou utilize o código de seis dígitos, se estiver disponível na mensagem.'
          : 'Cadastro recebido. Se o e-mail trouxer um código de seis dígitos, confirme pela tela de acesso. Links para localhost podem validar o e-mail, mas não conseguem abrir o site no celular. Após confirmar, volte aqui e entre normalmente.');
      } catch (error) {
        console.warn('Cadastro não concluído:', error?.message);
        status('message',window.SQFAuthFeedback.message(error, 'signup'),true);
      } finally { signupInFlight = false; busy(button,false); }
    });
  }
  const login = $('loginForm');
  if (login) {
    const client = mysql?null:clientOrError();
    const resetForm = $('resetForm');
    const requestId=utils.requestIdFromSearch(location.search);
    const destination=mysql?'painel-mysql.html':requestId ? `painel.html?solicitacao=${requestId}#sqfRequestPortal` : 'painel.html';
    const otpForm=$('emailCodeForm');
    const showCodeForm=()=>{
      if(!otpForm)return;
      otpForm.hidden=false;
      login.hidden=true;
      resetForm.hidden=true;
      if(!$('codeEmail').value && $('email').value)$('codeEmail').value=$('email').value.trim();
      $('codeEmail').focus();
    };
    const showLoginForm=()=>{otpForm.hidden=true;resetForm.hidden=true;login.hidden=false;};
    $('openEmailCode')?.addEventListener('click',showCodeForm);
    $('closeEmailCode')?.addEventListener('click',showLoginForm);
    if(location.hash==='#confirmar-email')showCodeForm();
    otpForm?.addEventListener('submit',async(event)=>{
      event.preventDefault();
      const email=$('codeEmail').value.trim();
      const token=$('emailCode').value.trim();
      if(!utils.isValidEmail(email)||!(mysql?/^[0-9a-f]{64}$/:/^[0-9]{6}$/).test(token)){
        status('codeMessage',mysql?'Informe o e-mail e o código de 64 caracteres.':'Informe seu e-mail e o código de seis dígitos.',true);return;
      }
      const current=mysql?null:(client||clientOrError());if(!mysql&&!current)return;
      const button=$('verifyEmailCode');busy(button,true);
      try{
        if(mysql){await window.SQFMySQL.verify(token);showLoginForm();$('email').value=email;status('message','E-mail confirmado. Entre com sua senha.');return;}
        const {data,error}=await current.auth.verifyOtp({email,token,type:'email'});
        if(error)throw error;
        status('codeMessage','E-mail confirmado com sucesso. Você pode entrar na sua conta.');
        if(data?.session){location.assign(destination);return;}
        showLoginForm();$('email').value=email;
        status('message','E-mail confirmado. Entre com sua senha.');
      }catch(error){
        status('codeMessage',window.SQFAuthFeedback.message(error,'confirm'),true);
      }finally{busy(button,false);}
    });
    const showRecoveryForm = () => {
      login.hidden = true; resetForm.hidden = false;
      status('message','');
    };
    if (client) {
      client.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') showRecoveryForm(); });
      // A confirmação de recuperação é acionada apenas pelo evento PASSWORD_RECOVERY do SDK.
      // Estar autenticado não é prova de que o usuário abriu um link de recuperação.
    }
    login.addEventListener('submit',async(event) => {
      event.preventDefault();
      ['emailError','passwordError'].forEach(id => fieldError(id,'')); status('message','');
      const email = $('email').value.trim(); const password = $('password').value;
      if (!utils.isValidEmail(email)) fieldError('emailError','Informe um e-mail válido.');
      if (!password) fieldError('passwordError','Informe sua senha.');
      if (!utils.isValidEmail(email) || !password) return;
      const current = mysql?null:(client || clientOrError()); if (!mysql&&!current) return;
      signupInFlight = true;
      const button = $('submitBtn'); busy(button,true);
      try {
        if(mysql){await window.SQFMySQL.login(email,password);location.assign(destination);return;}
        const { data, error } = await current.auth.signInWithPassword({ email, password });
        if (error || !data?.session) throw error || new Error('Nenhuma sessão retornada.');
        location.assign(destination);
      } catch (error) {
        console.warn('Autenticação não concluída:',error?.message);
        status('message',window.SQFAuthFeedback.message(error,'login'),true);
      } finally { busy(button,false); }
    });
    $('forgotBtn').addEventListener('click',async() => {
      const email = $('email').value.trim();
      if (!utils.isValidEmail(email)) { fieldError('emailError','Digite seu e-mail para solicitar a recuperação.'); $('email').focus(); return; }
      fieldError('emailError','');
      const current = mysql?null:(client || clientOrError()); if (!mysql&&!current) return;
      const button = $('forgotBtn'); busy(button,true);
      try {
        if(mysql){await window.SQFMySQL.requestReset(email);showRecoveryForm();status('resetMessage','Se a conta existir, confira o código recebido por e-mail.');return;}
        const redirect = verificationRedirect('entrar.html?recuperar=1');
        const { error } = await current.auth.resetPasswordForEmail(email,redirect?{redirectTo:redirect}:{});
        if (error) throw error;
        status('message','Se houver uma conta associada, você receberá um e-mail com instruções para redefinir sua senha.');
      } catch (error) {
        console.warn('Recuperação não iniciada:', error?.message);
        status('message',window.SQFAuthFeedback.message(error,'reset'),true);
      } finally { busy(button,false); }
    });
    resetForm.addEventListener('submit',async(event) => {
      event.preventDefault();
      const password = $('resetPassword').value;
      if (password.length < minPassword) { status('resetMessage',`Use pelo menos ${minPassword} caracteres.`,true); return; }
      if(mysql){const button=resetForm.querySelector('button[type="submit"]');busy(button,true);try{await window.SQFMySQL.reset($('mysqlResetToken').value.trim(),password);showLoginForm();status('message','Senha atualizada. Entre novamente.');}catch(error){status('resetMessage',error.message,true);}finally{busy(button,false);}return;}
      const current = mysql?null:(client || clientOrError()); if (!mysql&&!current) return;
      const { data } = await current.auth.getSession();
      if (!data?.session) { status('resetMessage','O link expirou ou não é válido. Solicite outro e-mail de recuperação.',true); return; }
      const button = resetForm.querySelector('button[type="submit"]'); busy(button,true);
      try {
        const { error } = await current.auth.updateUser({ password });
        if (error) throw error;
        status('resetMessage','Senha atualizada. Você pode acessar sua conta.');
        resetForm.hidden = true; login.hidden = false;
      } catch (error) { console.warn('Senha não atualizada:',error?.message);status('resetMessage','Não foi possível atualizar a senha.',true); }
      finally { busy(button,false); }
    });
  }
})();
