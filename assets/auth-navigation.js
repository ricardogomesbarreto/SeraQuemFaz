"use strict";
/* Navegação autenticada global, independente da tabela public.profiles.
   Não toma decisões de autorização: papéis são apenas para rótulos visuais.
   O Supabase/RLS continua responsável por qualquer acesso a dados. */
(() => {
  const nav = document.getElementById('site-menu');
  if (!nav) return;
  const root = nav.querySelector('.nav-actions');
  if (!root) return;
  root.setAttribute('data-auth-loading', 'true');
  let generation = 0;
  let client = null;
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
        link.href = authenticated ? 'painel.html' : original;
        link.textContent = authenticated ? 'Minha conta' : link.dataset.sqfOriginalLabel;
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
  function formatName(user, profile) {
    const label = String(profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Minha conta').trim();
    return label.slice(0, 70);
  }
  async function avatarUrl(api, user, profile) {
    const path = profile?.avatar_path;
    if (typeof path !== 'string' || !new RegExp(`^${user.id}/[0-9a-f-]{36}\\.webp$`, 'i').test(path)) return null;
    try {
      if (profile?.account_type === 'cliente') {
        const {data, error} = await api.storage.from('sqf-client-avatars').createSignedUrl(path, 120);
        if (error) return null;
        const parsed = new URL(data.signedUrl, location.href);
        return parsed.protocol === 'https:' && parsed.host === new URL(window.SQFSupabase.url).host ? parsed.href : null;
      }
      const {data} = api.storage.from('sqf-avatars').getPublicUrl(path);
      const parsed = new URL(data?.publicUrl);
      return parsed.protocol === 'https:' && parsed.host === new URL(window.SQFSupabase.url).host ? parsed.href : null;
    } catch { return null; }
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
    const edit = makeLink('Minha conta e perfil', window.SQFDataMode==='mysql'?'painel-mysql.html':'painel.html#accountProfile');
    const activity = makeLink('Solicitações e mensagens', window.SQFDataMode==='mysql'?'painel-mysql.html#requests':'painel.html#sqfRequestPortal');
    const logout = text('button', 'sqf-account-signout', 'Sair da conta');
    logout.type = 'button';
    const notice = text('p', 'sqf-account-error');
    notice.setAttribute('role', 'status'); notice.hidden = true;
    logout.addEventListener('click', async () => {
      logout.disabled = true;
      try {
        if(window.SQFDataMode==='mysql'){await window.SQFMySQL.logout();}else{const {error}=await (client || window.getSQFClient()).auth.signOut();if(error)throw error;}
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
    if(window.SQFDataMode==='mysql'){
      try{const s=await window.SQFMySQL.session();if(token!==generation)return;if(!s.user_id){guest();return;}const p=await window.SQFMySQL.profile();if(token!==generation)return;userMenu({id:s.user_id},p.data?.full_name||'Minha conta',null,true);if(['entrar.html','cadastro.html'].includes(location.pathname.split('/').pop()))location.replace('painel-mysql.html');}catch{if(token===generation)guest();}return;
    }
    try { client = window.getSQFClient(); }
    catch { guest(); return; }
    let user;
    try {
      const { data:sessionData } = await client.auth.getSession();
      if (token !== generation) return;
      if (!sessionData?.session?.user) { guest(); return; }
      user = sessionData.session.user;
      // A sessão local já permite mostrar o botão Sair, mesmo sem resposta da API.
      userMenu(user, formatName(user, null), null, false);
      const { data, error } = await client.auth.getUser();
      if (token !== generation) return;
      if (!error && data?.user) user = data.user;
      // Uma indisponibilidade temporária do Auth não deve esconder o botão Sair.
      let profile = null;
      if (!error) {
        try {
          const response = await client.from('profiles')
            .select('full_name,account_type,avatar_path').eq('id', user.id).maybeSingle();
          if (!response.error && response.data) profile = response.data;
        } catch { /* perfil SQL pode não estar instalado */ }
      }
      let compat = null;
      if (!profile && window.SQFAccountCompat) {
        compat = await window.SQFAccountCompat.read(client, user);
      }
      if (token !== generation) return;
      const name = compat?.display_name || formatName(user, profile);
      const url = compat ? await window.SQFAccountCompat.signedPhoto(client,user,compat.avatar_path)
        : profile ? await avatarUrl(client, user, profile) : null;
      if (token !== generation) return;
      userMenu(user, name, url, !error);
      const page = location.pathname.split('/').pop()?.toLowerCase();
      const recovery = new URLSearchParams(location.search).has('recuperar') || /type=recovery/i.test(location.hash);
      if (!error && !recovery && ['entrar.html','cadastro.html'].includes(page)) location.replace('painel.html');
    } catch {
      // Sem backend: tentar manter o acesso ao encerramento da sessão local.
      if (token === generation && user) userMenu(user, formatName(user, null), null, false);
      else if (token === generation) guest();
    }
  }
  window.SQFAccountNavigation = Object.freeze({ refresh });
  void refresh();
  if(window.SQFDataMode!=='mysql')try {
    client = window.getSQFClient();
    client.auth.onAuthStateChange(() => { queueMicrotask(() => void refresh()); });
  } catch { /* O restante do site continua navegável como visitante. */ }
})();
