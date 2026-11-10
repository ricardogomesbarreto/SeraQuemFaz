'use strict';
(() => {
  const minPassword=12;
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
  const signup = $('signupForm');
  {
    if(signup){$('password').minLength=12;$('password').placeholder='Mínimo 12 caracteres';}
    const code=$('emailCode');if(code){code.pattern='[0-9a-f]{64}';code.maxLength=64;code.minLength=64;code.inputMode='text';code.placeholder='Código de 64 caracteres';const label=document.querySelector('label[for="emailCode"]');if(label)label.textContent='Código de 64 caracteres';const hint=$('emailCodeForm')?.querySelector('p.muted');if(hint)hint.textContent='Informe o código recebido por e-mail. Ele expira após 30 minutos.';}
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
      signupInFlight = true;
      const button = $('submitBtn'); busy(button,true);
      try {
        await window.SQFMySQL.register(email,password,`${first} ${last}`,type,selectedCity.id);
        status('message','Cadastro recebido. Confira o código de confirmação no e-mail e use a tela de acesso.');
      } catch (error) {
        console.warn('Cadastro não concluído:', error?.message);
        status('message',window.SQFAuthFeedback.message(error, 'signup'),true);
      } finally { signupInFlight = false; busy(button,false); }
    });
  }
  const login = $('loginForm');
  if (login) {
    const resetForm = $('resetForm');
    const destination='painel-mysql.html';
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
      if(!utils.isValidEmail(email)||!/^[0-9a-f]{64}$/.test(token)){
        status('codeMessage','Informe o e-mail e o código de 64 caracteres.',true);return;
      }
      const button=$('verifyEmailCode');busy(button,true);
      try{
        await window.SQFMySQL.verify(token);showLoginForm();$('email').value=email;status('message','E-mail confirmado. Entre com sua senha.');
      }catch(error){
        status('codeMessage',window.SQFAuthFeedback.message(error,'confirm'),true);
      }finally{busy(button,false);}
    });
    const showRecoveryForm = () => {
      login.hidden = true; resetForm.hidden = false;
      status('message','');
    };
    login.addEventListener('submit',async(event) => {
      event.preventDefault();
      ['emailError','passwordError'].forEach(id => fieldError(id,'')); status('message','');
      const email = $('email').value.trim(); const password = $('password').value;
      if (!utils.isValidEmail(email)) fieldError('emailError','Informe um e-mail válido.');
      if (!password) fieldError('passwordError','Informe sua senha.');
      if (!utils.isValidEmail(email) || !password) return;
      signupInFlight = true;
      const button = $('submitBtn'); busy(button,true);
      try {
        await window.SQFMySQL.login(email,password);location.assign(destination);
      } catch (error) {
        console.warn('Autenticação não concluída:',error?.message);
        status('message',window.SQFAuthFeedback.message(error,'login'),true);
      } finally { busy(button,false); }
    });
    $('forgotBtn').addEventListener('click',async() => {
      const email = $('email').value.trim();
      if (!utils.isValidEmail(email)) { fieldError('emailError','Digite seu e-mail para solicitar a recuperação.'); $('email').focus(); return; }
      fieldError('emailError','');
      const button = $('forgotBtn'); busy(button,true);
      try {
        await window.SQFMySQL.requestReset(email);showRecoveryForm();status('resetMessage','Se a conta existir, confira o código recebido por e-mail.');
      } catch (error) {
        console.warn('Recuperação não iniciada:', error?.message);
        status('message',window.SQFAuthFeedback.message(error,'reset'),true);
      } finally { busy(button,false); }
    });
    resetForm.addEventListener('submit',async(event) => {
      event.preventDefault();
      const password = $('resetPassword').value;
      if (password.length < minPassword) { status('resetMessage',`Use pelo menos ${minPassword} caracteres.`,true); return; }
      const button=resetForm.querySelector('button[type="submit"]');busy(button,true);
      try{await window.SQFMySQL.reset($('mysqlResetToken').value.trim(),password);showLoginForm();status('message','Senha atualizada. Entre novamente.');}catch(error){status('resetMessage',error.message,true);}finally{busy(button,false);}
    });
  }
})();
