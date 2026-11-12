"use strict";
/* Navegação autenticada; autorização sempre no backend PHP. */
(() => {
  const nav = document.getElementById('site-menu');
  if (!nav) return;
  const root = nav.querySelector('.nav-actions');
  if (!root) return;
  root.setAttribute('data-auth-loading', 'true');
  let generation = 0;
  const text = (tag, cls, value) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (value !== undefined) n.textContent = String(value);
    return n;
  };
  function syncFooter(authenticated) {
    // Os links do rodapé refletem a sessão, sem alterar a identidade institucional.
    document.querySelectorAll('.site-footer a').forEach(link => {
      if (link.dataset.sqfOriginalHref === undefined) link.dataset.sqfOriginalHref = link.getAttribute('href') || '';
      if (link.dataset.sqfOriginalLabel === undefined) link.dataset.sqfOriginalLabel = link.textContent;
      const original = link.dataset.sqfOriginalHref;
      if (original === 'entrar.html') {
        link.href = authenticated ? 'painel-mysql.html' : original;
        link.textContent = authenticated ? 'Minha conta' : link.dataset.sqfOriginalLabel;
      } else if (original === 'painel.html') {
        link.href = authenticated ? 'painel-mysql.html' : 'entrar.html';
      } else if (original === 'cadastro.html') {
        link.hidden = authenticated;
      }
    });
  }
  function guest() {
    syncFooter(false);
    root.replaceChildren();
    const login = text('a', 'button button-ghost', 'Entrar');
    login.href = 'entrar.html'; login.dataset.nav = 'login';
    const signup = text('a', 'button button-primary', 'Criar conta ↗');
    signup.href = 'cadastro.html'; signup.dataset.nav = 'signup';
    root.append(login, signup);
    root.dataset.authLoading = 'false';
    document.documentElement.dataset.sqfAuth = 'guest';
  }
  function initials(name) {
    return String(name || 'U').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toLocaleUpperCase('pt-BR').slice(0, 2);
  }
  function makeLink(label, href) {
    const link = text('a', 'sqf-account-link', label);
    link.href = href;
    return link;
  }
  function userMenu(user, name, url, verified) {
    eventSignal.abort(); eventSignal = new AbortController();
    syncFooter(true);
    root.replaceChildren();
    const details = text('details', 'sqf-account-menu');
    const summary = text('summary', 'sqf-account-trigger');
    summary.setAttribute('aria-label', `Menu de ${name}`);
    const avatar = text('span', 'sqf-nav-avatar', url ? '' : initials(name));
    avatar.setAttribute('aria-hidden', 'true');
    if (url) {
      const image = text('img', '', '');
      image.src = url; image.alt = '';
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', () => {
        avatar.replaceChildren(document.createTextNode(initials(name)));
      }, { once: true });
      avatar.append(image);
    }
    summary.append(avatar, text('span', 'sqf-account-name', name), text('span', 'sqf-account-chevron', '⌄'));
    const content = text('div', 'sqf-account-dropdown');
    content.append(text('p', 'sqf-account-caption', verified ? 'Conta conectada' : 'Confirmando sessão'));
    const edit = makeLink('Minha conta e perfil', 'painel-mysql.html');
    const activity = makeLink('Solicitações e mensagens', 'painel-mysql.html#requests');
    const logout = text('button', 'sqf-account-signout', 'Sair da conta');
    logout.type = 'button';
    const notice = text('p', 'sqf-account-error');
    notice.setAttribute('role', 'status'); notice.hidden = true;
    logout.addEventListener('click', async () => {
      logout.disabled = true;
      try {
        await window.SQFMySQL.logout();
        guest();
        location.replace('index.html');
      } catch {
        notice.textContent = 'Não foi possível sair. Verifique sua conexão e tente novamente.';
        notice.hidden = false;
        logout.disabled = false;
      }
    });
    content.append(edit, activity, logout, notice);
    details.append(summary, content);
    root.append(details);
    root.dataset.authLoading = 'false';
    document.documentElement.dataset.sqfAuth = 'user';
    document.addEventListener('click', event => {
      if (!details.contains(event.target)) details.open = false;
    }, { signal: eventSignal.signal });
    details.addEventListener('keydown', event => {
      if (event.key === 'Escape') { details.open = false; summary.focus(); }
    });
  }
  let eventSignal = new AbortController();
  async function refresh() {
    const token = ++generation;
    eventSignal.abort(); eventSignal = new AbortController();
    try{const s=await window.SQFMySQL.session();if(token!==generation)return;if(!s.user_id){guest();return;}const p=await window.SQFMySQL.profile();if(token!==generation)return;userMenu({id:s.user_id},p.data?.full_name||'Minha conta',Number(p.data?.has_avatar)===1?window.SQFMySQL.mediaUrl('avatar',s.user_id):null,true);if(['entrar.html','cadastro.html'].includes(location.pathname.split('/').pop()))location.replace('painel-mysql.html');}catch{if(token===generation)guest();}
  }
  window.SQFAccountNavigation = Object.freeze({ refresh });
  void refresh();
})();
