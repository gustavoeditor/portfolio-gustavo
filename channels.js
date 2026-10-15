(() => {
  'use strict';
  const section = document.getElementById('canais');
  const activeList = document.getElementById('channels-current');
  const pastList = document.getElementById('channels-past');
  const activeGroup = document.getElementById('channels-current-group');
  const pastGroup = document.getElementById('channels-past-group');
  if (!section || !activeList || !pastList || !activeGroup || !pastGroup) return;

  const safeURL = value => {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      if (!url.hostname || url.hostname === 'localhost') return null;
      return url.href;
    } catch (_) { return null; }
  };
  const safeImage = value => {
    if (typeof value !== 'string' || !/^\/?canais\/[a-z0-9_-]+\.(png|jpe?g|webp|svg)$/i.test(value)) return '';
    return '/' + value.replace(/^\//,'');
  };
  const text = (tag, name, content) => {
    const el = document.createElement(tag);
    if (name) el.className = name;
    el.textContent = String(content);
    return el;
  };
  const normalize = (entries) => Array.isArray(entries) ? entries.filter(entry =>
    entry && typeof entry === 'object' &&
    typeof entry.nome === 'string' && entry.nome.trim().length >= 2 &&
    safeURL(entry.url)
  ).slice(0,24) : [];

  function renderGroup(entries, list, group, status) {
    if (!entries.length) return;
    const fragment = document.createDocumentFragment();
    entries.forEach(entry => {
      const name = entry.nome.trim().slice(0,90);
      const card = document.createElement('a');
      card.className = 'channel-card';
      card.href = safeURL(entry.url);
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.setAttribute('aria-label','Visitar o canal ' + name + ' (abre em outra aba)');

      const avatar = document.createElement('span');
      avatar.className = 'channel-avatar';
      const image = safeImage(entry.imagem);
      if (image) {
        const img = document.createElement('img');
        img.src = image;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.addEventListener('error', () => {
          avatar.replaceChildren(text('span','channel-initial',name.slice(0,1).toUpperCase()));
        }, {once:true});
        avatar.append(img);
      } else avatar.append(text('span','channel-initial',name.slice(0,1).toUpperCase()));

      const body = document.createElement('span');
      body.className = 'channel-copy';
      body.append(text('strong','channel-name',name));
      if (typeof entry.descricao === 'string' && entry.descricao.trim()) {
        body.append(text('span','channel-description',entry.descricao.trim().slice(0,135)));
      }
      const badge = text('span','channel-status',status);
      const arrow = text('span','channel-arrow','↗');
      arrow.setAttribute('aria-hidden','true');
      card.append(avatar,body,badge,arrow);
      fragment.append(card);
    });
    list.replaceChildren(fragment);
    group.hidden = false;
  }

  fetch('/canais.json',{cache:'no-cache'})
    .then(response => {if(!response.ok) throw new Error('No channels registry'); return response.json();})
    .then(data => {
      if (!data || typeof data !== 'object') return;
      const seen = new Set();
      const unique = entries => normalize(entries).filter(entry => {
        const key = safeURL(entry.url);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const current = unique(data.atuais);
      const former = unique(data.anteriores);
      if (!current.length && !former.length) return;
      renderGroup(current,activeList,activeGroup,'ATUAL');
      renderGroup(former,pastList,pastGroup,'ANTERIOR');
      if ((current.length===0)!==(former.length===0)) section.classList.add('channels-single');
      section.hidden = false;
    }).catch(() => {
      // No manufactured associations: don't expose an empty section.
    });
})();
