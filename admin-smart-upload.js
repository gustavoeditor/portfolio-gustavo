(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const drop = $('auto-drop');
  if (!drop) return;
  const input = $('auto-file');
  const coverInput = $('auto-cover');
  const editor = $('auto-editor');
  const preview = $('auto-preview');
  const poster = $('auto-poster');
  const publish = $('auto-publish');
  const cancel = $('auto-cancel');
  const progress = $('auto-progress');
  const feedback = $('auto-feedback');
  const setup = $('auto-setup');
  const managedList = $('auto-managed');

  let file = null;
  let posterFile = null;
  let frames = [];
  let previewUrl = null;
  let storageReady = false;
  let analyzing = false;
  let uploading = false;
  let uploadMode = 'token';
  let pending = null;
  let totalProjects = 17;
  const validVideo = (f) => f && /\.(mp4|webm)$/i.test(f.name) && (!f.type || ['video/mp4','video/webm'].includes(f.type));
  const slug = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\.[^.]+$/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,56) || 'video';
  const headers = {'Content-Type':'application/json','X-Gustavo-Admin':'1'};
  const tell = (message, error = false) => {
    feedback.textContent = message;
    feedback.dataset.error = String(error);
  };
  const syncPublish = () => {
    publish.disabled = !file || !posterFile || !storageReady || analyzing || uploading;
    publish.textContent = uploading ? 'Enviando…' : 'Publicar no site ↗';
  };
  const safeJson = async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'A operação falhou (' + response.status + ').');
    return data;
  };
  const releasePreview = () => {
    preview.pause();
    preview.removeAttribute('src');
    preview.load();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  };
  function clearSelection() {
    if (uploading) return;
    releasePreview();
    if (poster.src.startsWith('blob:')) URL.revokeObjectURL(poster.src);
    file = null;
    pending = null;
    analyzing = false;
    posterFile = null;
    frames = [];
    editor.hidden = true;
    cancel.hidden = true;
    input.value = '';
    coverInput.value = '';
    poster.hidden = true;
    poster.removeAttribute('src');
    progress.hidden = true;
    progress.value = 0;
    syncPublish();
  }

  async function takeFrames(videoFile) {
    const source = URL.createObjectURL(videoFile);
    const element = document.createElement('video');
    element.muted = true;
    element.preload = 'auto';
    element.playsInline = true;
    const waitFor = (eventName, ms) => new Promise((resolve,reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error('Tempo de leitura excedido.')); }, ms);
      const fail = () => { cleanup(); reject(new Error('O vídeo não pôde ser lido.')); };
      const success = () => { cleanup(); resolve(); };
      const cleanup = () => {
        clearTimeout(timer);
        element.removeEventListener(eventName, success);
        element.removeEventListener('error', fail);
      };
      element.addEventListener(eventName, success, {once:true});
      element.addEventListener('error', fail, {once:true});
    });
    const out = [];
    let thumbnail = null;
    try {
      const meta = waitFor('loadedmetadata',10000);
      element.src = source;
      await meta;
      if (!element.videoWidth || !element.videoHeight || !Number.isFinite(element.duration) || element.duration<=0) {
        throw new Error('Não foi possível identificar o vídeo.');
      }
      const canvas = document.createElement('canvas');
      const scale=Math.min(560/element.videoWidth,560/element.videoHeight,1);
      canvas.width = Math.max(1,Math.round(element.videoWidth*scale));
      canvas.height = Math.max(1,Math.round(element.videoHeight*scale));
      const ctx = canvas.getContext('2d',{alpha:false});
      if (!ctx) throw new Error('Canvas indisponível.');
      for (const percentage of [.05,.16,.29,.43,.57,.71,.84,.95]) {
        const target = Math.min(element.duration*percentage,Math.max(0,element.duration-.001));
        if (Math.abs(element.currentTime-target)>.015) {
          const seeked = waitFor('seeked',6500);
          element.currentTime = target;
          await seeked;
        }
        ctx.drawImage(element,0,0,canvas.width,canvas.height);
        out.push(canvas.toDataURL('image/jpeg',.54));
        if (!thumbnail) {
          thumbnail = await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.78));
          if (!thumbnail || thumbnail.type !== 'image/webp') {
            thumbnail = await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.8));
          }
        }
      }
    } finally {
      element.removeAttribute('src');
      element.load();
      URL.revokeObjectURL(source);
    }
    return {frames:out,thumbnail};
  }

  async function chooseFile(chosen) {
    if (uploading) return;
    if (!validVideo(chosen)) { tell('Selecione um arquivo MP4 ou WebM.',true); return; }
    if (chosen.size > 250*1024*1024) { tell('O tamanho máximo por vídeo é 250 MB.',true); return; }
    clearSelection();
    file = chosen;
    pending = {id:crypto.randomUUID(),base:slug(chosen.name)+'-'+Date.now().toString(36),video:null,cover:null};
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
    preview.muted = true;
    editor.hidden = false;
    cancel.hidden = false;
    $('auto-title-input').value = chosen.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').slice(0,90);
    $('auto-category').value = 'cinematics';
    $('auto-position').value = String(totalProjects+1);
    $('auto-description').value = '';
    $('auto-reason').textContent = 'Analisando o vídeo para sugerir categoria e posição...';
    tell('Preparando a capa e a sugestão de classificação...');
    analyzing = true;
    syncPublish();
    let selectedFrames=[];
    try {
      const samples = await takeFrames(chosen);
      if (file !== chosen) return;
      frames = samples.frames;
      selectedFrames=samples.frames;
      posterFile = samples.thumbnail;
      if (posterFile) {
        poster.src = URL.createObjectURL(posterFile);
        poster.hidden = false;
      }
    } catch (_) {
      if (file !== chosen) return;
      tell('Não foi possível gerar a capa automaticamente. Escolha uma capa usando “Trocar capa”.',true);
    }
    if (file !== chosen) return;
    try {
      const result = await safeJson(await fetch('/api/admin-analyze',{
        method:'POST',credentials:'same-origin',headers,
        body:JSON.stringify({name:chosen.name,frames:selectedFrames,total:totalProjects})
      }));
      if (file !== chosen) return;
      $('auto-title-input').value = result.title || $('auto-title-input').value;
      if (['cs2','cinematics','motion','youtube','outros'].includes(result.category))
        $('auto-category').value = result.category;
      $('auto-position').value = String(Math.max(1,Math.min(totalProjects+1,(result.position||0)+1)));
      $('auto-description').value = result.description || '';
      $('auto-reason').textContent = (result.source === 'ai' ? 'IA visual: ' : 'Sugestão pelo nome: ') + (result.explanation || 'Revise antes de publicar.');
      if (posterFile) tell(storageReady ? 'Pronto. Revise os dados e clique em Publicar.' : 'Capa criada. Configure o armazenamento para ativar a publicação.');
    } catch (error) {
      if (file !== chosen) return;
      $('auto-reason').textContent = 'Não foi possível analisar agora. Preencha os campos manualmente.';
      tell(error.message,true);
    } finally {
      if (file === chosen) {analyzing = false;syncPublish();}
    }
  }

  async function uploadAndPublish() {
    if (publish.disabled || !file || !posterFile) return;
    const title = $('auto-title-input').value.trim();
    const category = $('auto-category').value;
    const position = Number($('auto-position').value)-1;
    if (!title || title.length>90 || !Number.isInteger(position) || position<0 || position>150) {
      tell('Revise título e posição da galeria.',true); return;
    }
    uploading = true;
    progress.hidden = false;
    progress.value = 0;
    syncPublish();
    const selected = file;
    try {
      tell('Conectando ao armazenamento protegido...');
      const client = await import('/vendor/blob-client.js?v=2.8.2');
      const upload = uploadMode === 'oidc' ? client.uploadPresigned : client.upload;
      const base = pending.base;
      const ext = /\.webm$/i.test(selected.name) ? 'webm' : 'mp4';
      const uploadedVideo = pending.video || await upload('gustavo/videos/'+base+'.'+ext,selected,{
        access:'public',handleUploadUrl:'/api/admin-upload',
        contentType:ext==='webm'?'video/webm':'video/mp4',
        multipart:selected.size > 90*1024*1024,
        onUploadProgress:({percentage}) => {progress.value = Math.round(percentage*.90);}
      });
      pending.video=uploadedVideo;
      tell('Vídeo enviado. Publicando a capa...');
      const coverExt = posterFile.type === 'image/webp' ? 'webp' : posterFile.type === 'image/png' ? 'png' : 'jpg';
      const uploadedCover = pending.cover || await upload('gustavo/capas/'+base+'.'+coverExt,posterFile,{
        access:'public',handleUploadUrl:'/api/admin-upload',
        contentType:posterFile.type,
        onUploadProgress:({percentage}) => {progress.value = 90+Math.round(percentage*.1);}
      });
      pending.cover=uploadedCover;
      tell('Salvando o projeto na galeria...');
      await safeJson(await fetch('/api/admin-publish',{
        method:'POST',credentials:'same-origin',headers,
        body:JSON.stringify({
          uploadId:pending.id,title,category,position,src:uploadedVideo.url,poster:uploadedCover.url,
          description:$('auto-description').value.trim()
        })
      }));
      progress.value = 100;
      totalProjects++;
      uploading = false;
      clearSelection();
      try {await reloadManaged();} catch (_) { /* Publication succeeded; list refresh can be retried independently. */ }
      tell('Publicado! O vídeo foi adicionado à galeria. Atualize o portfólio para conferir.');
    } catch(error) {
      tell(error.message || 'Não foi possível publicar. Confira sua sessão e tente novamente.',true);
    } finally {
      uploading = false;
      syncPublish();
    }
  }

  function renderManaged(items) {
    managedList.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Nenhum vídeo enviado por aqui ainda.';
      managedList.append(empty);
      return;
    }
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'managed-line';
      const text = document.createElement('div');
      const title = document.createElement('b');
      title.textContent = item.title || 'Projeto';
      const meta = document.createElement('span');
      meta.textContent = (item.category || 'outros') + ' · posição ' + (Number(item.position)+1);
      text.append(title,meta);
      const remove = document.createElement('button');
      remove.className = 'btn danger';
      remove.type = 'button';
      remove.textContent = 'Retirar do site';
      remove.addEventListener('click', async () => {
        if (!confirm('Retirar “' + (item.title || 'este projeto') + '” da galeria?')) return;
        remove.disabled = true;
        try {
          await safeJson(await fetch('/api/admin-publish',{
            method:'DELETE',credentials:'same-origin',headers,
            body:JSON.stringify({id:item.id})
          }));
          await reloadManaged();
          tell('Projeto retirado da galeria. O arquivo continua no armazenamento.');
        } catch (e) { tell(e.message,true); remove.disabled = false; }
      });
      const copy = document.createElement('button');
      copy.className = 'btn';
      copy.type = 'button';
      copy.textContent = 'Copiar link do vídeo';
      copy.addEventListener('click', async () => {
        const url = String(item.src||'');
        if (!/^https:\\/\\/[^/]+\\.public\\.blob\\.vercel-storage\\.com\\//.test(url)) {
          tell('Este vídeo ainda não possui um link público válido.', true); return;
        }
        try {
          await navigator.clipboard.writeText(url);
          tell('Link de “'+(item.title||'vídeo')+'” copiado.');
        } catch (_) {
          window.prompt('Copie o link do vídeo:',url);
        }
      });
      row.append(text,copy,remove);
      managedList.append(row);
    }
  }

  async function reloadManaged() {
    const response = await fetch('/api/managed-projects',{cache:'no-store'});
    const data = await safeJson(response);
    const items = Array.isArray(data.projects) ? data.projects : [];
    renderManaged(items);
    return items.length;
  }

  async function initialize() {
    try {
      const [config, original] = await Promise.all([
        safeJson(await fetch('/api/admin-config',{cache:'no-store'})),
        fetch('/projetos.json',{cache:'no-store'}).then(r=>r.ok?r.json():[]).catch(()=>[])
      ]);
      const staticCount = Array.isArray(original) ? original.length : 0;
      let extraCount = 0;
      try { extraCount = await reloadManaged(); } catch (_) {}
      totalProjects = staticCount + extraCount;
      storageReady = Boolean(config.storageReady);
      uploadMode = config.uploadMode || 'token';
      if (storageReady) {
        setup.textContent = config.visualAIReady
          ? 'Armazenamento conectado. A análise visual tentará classificar quadros ao longo do vídeo; revise a sugestão antes de publicar.'
          : 'Armazenamento conectado. A sugestão usa o nome do arquivo; você pode escolher a categoria manualmente.';
      } else {
        setup.textContent = 'A publicação ainda está desativada: falta conectar o armazenamento do portfólio. Você pode testar a seleção, capa e categoria, mas o vídeo só será enviado quando esta conexão estiver pronta.';
      }
    } catch(e) {
      storageReady=false;
      setup.textContent='Não foi possível verificar a configuração do painel. Faça login novamente se sua sessão expirou.';
      tell(e.message,true);
    }
    syncPublish();
  }

  // Current admin HTML has a native file-input label and captures file drops inline.
  // Legacy cached HTML still uses the original handlers as a compatibility fallback.
  if (window.__gustavoAdminDrop && typeof window.__gustavoAdminDrop.register === 'function') {
    window.__gustavoAdminDrop.register(chooseFile);
  } else {
    drop.addEventListener('click',()=>input.click());
    drop.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();input.click();}
    });
    drop.addEventListener('dragenter',event=>{event.preventDefault();drop.classList.add('dragover');});
    drop.addEventListener('dragover',event=>{event.preventDefault();event.dataTransfer.dropEffect='copy';drop.classList.add('dragover');});
    drop.addEventListener('dragleave',event=>{if(!drop.contains(event.relatedTarget))drop.classList.remove('dragover');});
    drop.addEventListener('drop',event=>{
      event.preventDefault();
      drop.classList.remove('dragover');
      const chosen = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (chosen) chooseFile(chosen);
    });
    input.addEventListener('change',()=>{if(input.files && input.files[0])chooseFile(input.files[0]);});
    const hasFiles=event=>Array.from(event.dataTransfer?.types || []).includes('Files');
    document.addEventListener('dragover',event=>{if(hasFiles(event))event.preventDefault();});
    document.addEventListener('drop',event=>{
      if (!hasFiles(event) || event.defaultPrevented) return;
      event.preventDefault();
      const chosen=event.dataTransfer?.files?.[0];
      if(chosen){chooseFile(chosen);drop.scrollIntoView({behavior:'smooth',block:'center'});}
    });
  }
  window.addEventListener('beforeunload',event=>{if(uploading){event.preventDefault();event.returnValue='';}});
  $('auto-change-cover').addEventListener('click',()=>coverInput.click());
  coverInput.addEventListener('change',()=>{
    if(uploading)return;
    const picked=coverInput.files && coverInput.files[0];
    if(!picked)return;
    if(!['image/webp','image/jpeg','image/png'].includes(picked.type)||picked.size>8*1024*1024){
      tell('Escolha uma capa WebP, JPG ou PNG de até 8 MB.',true);return;
    }
    if (poster.src.startsWith('blob:')) URL.revokeObjectURL(poster.src);
    posterFile=picked;
    if(pending)pending.cover=null;
    poster.src=URL.createObjectURL(picked);
    poster.hidden=false;
    syncPublish();
    tell('Capa atualizada. Revise e publique.');
  });
  cancel.addEventListener('click',clearSelection);
  publish.addEventListener('click',uploadAndPublish);
  initialize();
})();
