'use strict';
/* Utilitários visuais de perfis. Todos os dados externos usam textContent. */
(() => {
  const make = (tag, className = '', label) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (label !== undefined) node.textContent = String(label ?? '');
    return node;
  };
  function publicUrl(client, bucket, path) {
    if (typeof path !== 'string' || !/^[a-z0-9_-]+\/[a-z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(path)) return null;
    try {
      const url = client.storage.from(bucket).getPublicUrl(path)?.data?.publicUrl;
      const parsed = new URL(url);
      const expected = new URL(window.SQFSupabase.url);
      if (parsed.protocol !== 'https:' || parsed.host !== expected.host) return null;
      return url;
    } catch { return null; }
  }
  const safeImg = (url, alt = '', className = '') => {
    const img = make('img', className);
    img.alt = alt; img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
    img.src = url;
    return img;
  };
  const avatar = (client, path, name, className = '') => {
    const box = make('div', `avatar ${className}`);
    const url = publicUrl(client, 'sqf-avatars', path);
    if (url) {
      const photo = safeImg(url, `Foto de perfil de ${name}`);
      photo.addEventListener('error', () => { photo.remove(); box.appendChild(safeImg('assets/brand/simbolo.png', 'Símbolo SERÁ QUEM FAZ?')); }, { once: true });
      box.appendChild(photo);
    } else box.appendChild(safeImg('assets/brand/simbolo.png', 'Símbolo SERÁ QUEM FAZ?'));
    return box;
  };
  const stars = (score) => {
    const numeric = Number(score);
    const value = Number.isFinite(numeric) ? Math.min(5, Math.max(0, numeric)) : 0;
    const box = make('span', 'rating-stars');
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', value ? `Nota ${value.toFixed(1).replace('.', ',')} de 5` : 'Ainda sem avaliação');
    const base = make('span', 'rating-star-base', '★★★★★');
    const fill = make('span', 'rating-star-fill', '★★★★★');
    base.setAttribute('aria-hidden', 'true');
    fill.setAttribute('aria-hidden', 'true');
    fill.style.width = `${value * 20}%`;
    box.append(base, fill);
    return box;
  };
  function ratingLine(reviews) {
    const box = make('div', 'rating-line');
    const count = reviews?.length || 0;
    if (!count) { box.append(stars(0), make('span', 'muted', 'Ainda sem avaliações')); return box; }
    const avg = reviews.reduce((sum, entry) => sum + Number(entry.rating || 0), 0) / count;
    box.append(stars(avg), make('strong', '', `${avg.toFixed(1).replace('.', ',')} / 5`), make('span', 'muted', `(${count} ${count === 1 ? 'avaliação' : 'avaliações'})`));
    return box;
  }
  function state(root, headline, body = '') {
    root.replaceChildren();
    const item = make('div', 'status-panel');
    item.append(make('strong', '', headline));
    if (body) item.append(make('p', '', body));
    root.append(item);
  }
  const validId = (id) => typeof id === 'string' && /^[a-z0-9-]{1,80}$/i.test(id);
  const message = (error) => {
    console.warn('SERÁ QUEM FAZ?: falha de dados:', error?.message || error);
    return 'Não foi possível carregar os dados. Verifique a conexão e se a migração SQL e as políticas RLS foram aplicadas no Supabase.';
  };
  window.SQFProfiles = Object.freeze({ make, publicUrl, safeImg, avatar, stars, ratingLine, state, validId, message });
})();
