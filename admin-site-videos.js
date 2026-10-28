/* Admin: every video on the public site (originals + panel uploads) with a reversible
   "Retirar do site" / "Voltar ao site" switch. Files are never deleted here. */
(() => {
  'use strict';
  const list = document.getElementById('site-videos-list');
  const count = document.getElementById('site-videos-count');
  const reload = document.getElementById('site-videos-reload');
  if (!list) return;
  const headers = {'Content-Type':'application/json','X-Gustavo-Admin':'1'};
  const labels = {cs2:'CS2',motion:'Motion design',cinematics:'Cinematics',youtube:'YouTube',outros:'Outros'};
  let busy = false;

  const message = (text, error) => {
    const note = document.createElement('div');
    note.className = 'empty';
    note.textContent = text;
    if (error) note.dataset.mode = 'error';
    list.replaceChildren(note);
  };
  async function load() {
    try {
      const [originals, catalog] = await Promise.all([
        fetch('/projetos.json',{cache:'no-store'}).then(r => r.ok ? r.json() : []),
        fetch('/api/managed-projects',{cache:'no-store'}).then(r => r.json())
      ]);
      const hidden = new Set(Array.isArray(catalog.hidden) ? catalog.hidden : []);
      const items = [
        ...(Array.isArray(originals) ? originals : []).map(p => ({key:p.src, title:p.title, category:p.category, origin:'Original'})),
        ...(Array.isArray(catalog.projects) ? catalog.projects : []).map(p => ({key:p.src, title:p.title, category:p.category, origin:'Enviado pelo painel'}))
      ].filter(v => v.key && v.title);
      render(items, hidden, catalog.enabled !== false);
    } catch (_) {
      message('Não foi possível carregar a lista de vídeos. Tente atualizar.', true);
    }
  }
  function render(items, hidden, storeReady) {
    const off = items.filter(v => hidden.has(v.key)).length;
    count.textContent = items.length + ' vídeos · ' + (items.length - off) + ' no ar' + (off ? ' · ' + off + ' fora do ar' : '');
    if (!items.length) return message('Nenhum vídeo encontrado.');
    list.replaceChildren(...items.map(video => {
      const isHidden = hidden.has(video.key);
      const item = document.createElement('article');
      item.className = 'item site-video' + (isHidden ? ' is-hidden' : '');
      const details = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'item-title';
      title.textContent = video.title;
      const meta = document.createElement('div');
      meta.className = 'item-meta';
      meta.textContent = (labels[video.category] || 'Outros') + ' · ' + video.origin;
      const status = document.createElement('span');
      status.className = 'site-video-status';
      status.textContent = isHidden ? 'Fora do ar' : 'No ar';
      details.append(title, meta, status);
      const actions = document.createElement('div');
      actions.className = 'item-actions';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn' + (isHidden ? ' primary' : ' danger');
      button.textContent = isHidden ? 'Voltar ao site' : 'Retirar do site';
      button.setAttribute('aria-label', button.textContent + ': ' + video.title);
      button.disabled = !storeReady;
      button.addEventListener('click', () => toggle(video, !isHidden, button));
      actions.append(button);
      item.append(details, actions);
      return item;
    }));
  }
  async function toggle(video, hide, button) {
    if (busy) return;
    if (hide && !confirm('Retirar "' + video.title + '" do site?\n\nO vídeo some da galeria, dos destaques e do carrossel para todos. O arquivo não é apagado e você pode voltar com ele quando quiser.')) return;
    busy = true;
    button.disabled = true;
    button.textContent = hide ? 'Retirando…' : 'Voltando…';
    try {
      const response = await fetch('/api/admin-publish',{method:'PATCH',credentials:'same-origin',headers,body:JSON.stringify({key:video.key,hidden:hide})});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar o site.');
    } catch (error) {
      alert(error.message || 'Não foi possível atualizar o site. Confira sua sessão e tente novamente.');
    } finally {
      busy = false;
      load();
    }
  }
  reload?.addEventListener('click', load);
  // Keep in sync when a video is published or deleted in the upload panel.
  document.addEventListener('gustavo:catalog-changed', load);
  load();
})();
