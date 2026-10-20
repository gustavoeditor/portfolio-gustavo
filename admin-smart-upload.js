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
  const titleInput = $('auto-title-input');
  const aiRetry = $('auto-regenerate-title');
  const aiTitleStatus = $('auto-title-ai-status');
  const coverDialog = $('auto-cover-dialog');
  const coverVideo = $('auto-cover-video');
  const coverRange = $('auto-cover-range');
  const coverTime = $('auto-cover-time');
  const coverStatus = $('auto-cover-status');
  const coverConfirm = $('auto-cover-confirm');
  const publish = $('auto-publish');
  const cancel = $('auto-cancel');
  const progress = $('auto-progress');
  const feedback = $('auto-feedback');
  const setup = $('auto-setup');
  const managedList = $('auto-managed');

  let file = null;
  let posterFile = null;
  let customCover = false;
  let titleEdited = false;
  let positionEdited = false;
  let qualityScore = null;
  let suggestedPosition = null;
  const rankingSelect=$('auto-ranking-mode');
  const rankingStatus=$('auto-ranking-status');
  const positionField=$('auto-position');
  const setRankingStatus=(message)=>{rankingStatus.textContent=message;};
  positionField.addEventListener('input',()=>{
    positionEdited=true;rankingSelect.value='manual';
    setRankingStatus('Posição definida manualmente. A IA não irá substituir sua escolha.');
  });
  rankingSelect.addEventListener('change',()=>{
    if(rankingSelect.value==='auto' && qualityScore===null){
      rankingSelect.value='manual';
      setRankingStatus('Sem avaliação visual válida. Escolha a posição manualmente ou tente analisar novamente.');
    }else if(rankingSelect.value==='auto' && suggestedPosition!==null){
      positionEdited=false;positionField.value=String(suggestedPosition+1);
      setRankingStatus('Ordem automática por análise visual: '+qualityScore+'/100 (estimativa; sem áudio ou movimento).');
    }else{
      positionEdited=true;setRankingStatus('Posição manual ativa.');
    }
  });
  let coverReady = false;
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
    aiRetry.disabled = !file || analyzing || uploading;
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
    if (coverDialog.open) coverDialog.close();
    releasePreview();
    if (poster.src.startsWith('blob:')) URL.revokeObjectURL(poster.src);
    file = null;
    pending = null;
    analyzing = false;
    posterFile = null;
    customCover = false;
    titleEdited = false;
    positionEdited = false;
    qualityScore = null;
    suggestedPosition = null;
    rankingSelect.value='manual';
    setRankingStatus('Aguardando avaliação visual. Sem IA, o novo trabalho fica ao final.');
    frames = [];
    aiTitleStatus.textContent = 'Aguardando vídeo.';
    aiTitleStatus.dataset.mode = '';
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
      // One undecodable timestamp should not throw away all successfully read
      // frames and silently force a filename-based title.
      for (const percentage of [.05,.16,.29,.43,.57,.71,.84,.95]) {
        const target = Math.min(element.duration*percentage,Math.max(0,element.duration-.001));
        try {
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
        } catch (_) {
          // Keep other frames available to the visual model.
          if (!out.length && percentage >= .57) break;
        }
      }
      if (!out.length) throw new Error('Nenhum quadro do vídeo pôde ser lido.');
    } finally {
      element.removeAttribute('src');
      element.load();
      URL.revokeObjectURL(source);
    }
    return {frames:out,thumbnail};
  }

  // A capa selecionada permanece local até o usuário clicar em Publicar.
  function setCover(blob, manual) {
    if (!blob) return false;
    if (poster.src.startsWith('blob:')) URL.revokeObjectURL(poster.src);
    posterFile = blob;
    customCover = manual;
    if (pending) pending.cover = null;
    poster.src = URL.createObjectURL(blob);
    poster.hidden = false;
    syncPublish();
    return true;
  }

  function formatFrameTime(seconds) {
    const value = Number.isFinite(seconds) ? Math.max(0,seconds) : 0;
    const minutes = Math.floor(value / 60);
    const whole = Math.floor(value % 60);
    const fraction = Math.floor((value % 1) * 100);
    return String(minutes).padStart(2,'0') + ':' +
      String(whole).padStart(2,'0') + '.' + String(fraction).padStart(2,'0');
  }
  const displayFrameTime = () => {
    coverTime.textContent = formatFrameTime(Number(coverRange.value)) + ' / ' +
      formatFrameTime(coverVideo.duration);
  };
  function closeCoverPicker() {
    if (coverDialog.open) coverDialog.close();
  }
  function resetCoverPicker() {
    coverReady = false;
    coverConfirm.disabled = true;
    coverRange.disabled = true;
    coverVideo.pause();
    coverVideo.removeAttribute('src');
    coverVideo.load();
  }
  $('auto-pick-frame').addEventListener('click', () => {
    if (!file || !previewUrl || uploading) return;
    coverReady = false;
    coverConfirm.disabled = true;
    coverRange.disabled = true;
    coverRange.value = '0';
    coverTime.textContent = '00:00.00 / 00:00.00';
    coverStatus.textContent = 'Preparando frames do vídeo...';
    coverDialog.showModal();
    coverVideo.src = previewUrl;
    coverVideo.load();
  });
  coverVideo.addEventListener('loadedmetadata', () => {
    if (!coverDialog.open) return;
    const duration = coverVideo.duration;
    if (!Number.isFinite(duration) || duration <= 0 || !coverVideo.videoWidth) {
      coverStatus.textContent = 'Não foi possível ler a timeline deste vídeo. Envie uma imagem pronta.';
      return;
    }
    coverRange.max = String(duration);
    coverRange.value = String(Math.min(duration * .05, Math.max(0,duration - .001)));
    coverRange.disabled = false;
    displayFrameTime();
    coverStatus.textContent = 'Deslize para encontrar o melhor momento.';
    coverConfirm.disabled = true;
    try { coverVideo.currentTime = Number(coverRange.value); }
    catch (_) { coverStatus.textContent = 'Este momento não pôde ser exibido.'; }
  });
  const readyFrame = () => {
    if (!coverDialog.open) return;
    coverReady = coverVideo.readyState >= 2 && !coverVideo.seeking &&
      coverVideo.videoWidth > 0 && coverVideo.videoHeight > 0;
    coverConfirm.disabled = !coverReady;
    if (coverReady) {
      coverRange.value = String(coverVideo.currentTime);
      displayFrameTime();
      coverStatus.textContent = 'Frame carregado. Clique em “Usar este frame como capa”.';
    }
  };
  coverVideo.addEventListener('seeked',readyFrame);
  coverVideo.addEventListener('loadeddata',readyFrame);
  coverVideo.addEventListener('error', () => {
    if (!coverDialog.open) return;
    coverReady = false;
    coverConfirm.disabled = true;
    coverStatus.textContent = 'Não foi possível visualizar o vídeo. Use “Enviar imagem”.';
  });
  coverRange.addEventListener('input', () => {
    if (coverRange.disabled || !coverDialog.open) return;
    coverReady = false;
    coverConfirm.disabled = true;
    coverStatus.textContent = 'Carregando frame...';
    displayFrameTime();
    try { coverVideo.currentTime = Number(coverRange.value); }
    catch (_) { coverStatus.textContent = 'Não foi possível acessar esse frame.'; }
  });
  coverConfirm.addEventListener('click', async () => {
    if (!coverReady || !file || uploading || !coverDialog.open ||
        coverVideo.readyState < 2 || coverVideo.seeking) return;
    const selectedVideo = file;
    coverConfirm.disabled = true;
    coverStatus.textContent = 'Criando thumbnail a partir do frame selecionado...';
    try {
      const w = coverVideo.videoWidth, h = coverVideo.videoHeight;
      if (!w || !h) throw new Error('Frame não disponível.');
      const scale = Math.min(1280 / w, 720 / h, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(w * scale));
      canvas.height = Math.max(1,Math.round(h * scale));
      const ctx = canvas.getContext('2d',{alpha:false});
      if (!ctx) throw new Error('Canvas indisponível.');
      ctx.drawImage(coverVideo,0,0,canvas.width,canvas.height);
      let blob = await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.88));
      if (!blob || blob.type !== 'image/webp') {
        blob = await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));
      }
      if (!blob || blob.size > 8*1024*1024) throw new Error('A thumbnail excede 8 MB.');
      // Closing or replacing a video during encoding must not modify its thumbnail.
      if (file !== selectedVideo || !coverDialog.open) return;
      const selectedTime = coverVideo.currentTime;
      setCover(blob,true);
      closeCoverPicker();
      tell('Thumbnail escolhida no tempo ' + formatFrameTime(selectedTime) +
        '. Revise o título e publique quando quiser.');
    } catch (error) {
      coverStatus.textContent = error.message || 'Não foi possível criar a capa deste frame.';
      coverConfirm.disabled = !coverReady;
    }
  });
  $('auto-cover-close').addEventListener('click',closeCoverPicker);
  $('auto-cover-cancel').addEventListener('click',closeCoverPicker);
  coverDialog.addEventListener('close',resetCoverPicker);
  // An editor can correct the automatic title while analysis continues.
  titleInput.addEventListener('input', () => { titleEdited = true; });

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
    titleInput.value = chosen.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').slice(0,90);
    $('auto-category').value = 'cinematics';
    positionField.value = String(totalProjects+1);
    $('auto-description').value = '';
    $('auto-reason').textContent = 'Extraindo quadros para analisar visualmente o vídeo...';
    aiTitleStatus.textContent = 'Preparando imagens do vídeo...';
    aiTitleStatus.dataset.mode = '';
    tell('Extraindo quadros para a capa e o título automático...');
    analyzing = true;
    syncPublish();
    try {
      const samples = await takeFrames(chosen);
      if (file !== chosen) return;
      frames = samples.frames;
      if (!customCover) setCover(samples.thumbnail, false);
    } catch (_) {
      if (file !== chosen) return;
      tell('Não foi possível extrair quadros automaticamente. Você pode enviar uma capa e verificar a compatibilidade do vídeo.',true);
    }
    if (file !== chosen) return;
    await requestAnalysis(chosen);
  }

  async function requestAnalysis(chosen) {
    if (uploading || !chosen || file !== chosen) return;
    analyzing = true;
    syncPublish();
    aiTitleStatus.textContent = 'Analisando o conteúdo visual...';
    aiTitleStatus.dataset.mode = '';
    try {
      const result = await safeJson(await fetch('/api/admin-analyze',{
        method:'POST',credentials:'same-origin',headers,
        body:JSON.stringify({name:chosen.name,frames,total:totalProjects})
      }));
      if (file !== chosen) return;
      if (result.source === 'ai') {
        if (!titleEdited && result.title) titleInput.value = result.title;
        if (['cs2','cinematics','motion','youtube','outros'].includes(result.category))
          $('auto-category').value = result.category;
        qualityScore=Number.isInteger(result.qualityScore)&&result.qualityScore>=0&&result.qualityScore<=100?result.qualityScore:null;
        suggestedPosition=qualityScore===null?null:Math.max(0,Math.min(totalProjects,Number.isInteger(result.position)?result.position:totalProjects));
        if(!positionEdited){
          if(suggestedPosition!==null){positionField.value=String(suggestedPosition+1);rankingSelect.value='auto';}
          else {positionField.value=String(totalProjects+1);rankingSelect.value='manual';}
        }
        setRankingStatus(qualityScore===null?'Título criado pela IA, mas não houve nota visual válida. Posição manual/ao final.':'IA visual: '+qualityScore+'/100, confiança '+(result.qualityConfidence||'baixa')+'. Ordem '+(rankingSelect.value==='auto'?'automática':'manual')+'.');
        $('auto-description').value = result.description || '';
        aiTitleStatus.textContent = titleEdited ? 'Título gerado. Sua edição foi preservada.' : 'Título criado pela IA visual ✓';
        aiTitleStatus.dataset.mode = 'success';
        $('auto-reason').textContent = 'Análise por IA de até 8 quadros: ' +
          (result.explanation || 'Revise o título antes de publicar.');
        tell(storageReady ? 'Título criado pela IA. Revise e publique.' : 'Título criado pela IA. Falta habilitar o armazenamento para publicar.');
      } else {
        qualityScore=null;suggestedPosition=null;
        rankingSelect.value='manual';
        if(!positionEdited)positionField.value=String(totalProjects+1);
        setRankingStatus('Sem nota de qualidade: o novo trabalho ficará ao final, salvo posição manual.');
        const reason = result.explanation || 'A IA não conseguiu analisar este vídeo.';
        aiTitleStatus.textContent = 'IA não gerou título.';
        aiTitleStatus.dataset.mode = 'error';
        $('auto-reason').textContent = reason;
        tell(reason,true);
      }
    } catch (error) {
      if (file !== chosen) return;
      qualityScore=null;suggestedPosition=null;rankingSelect.value='manual';
      if(!positionEdited)positionField.value=String(totalProjects+1);
      setRankingStatus('Sem nota de qualidade por falha de conexão. Posição manual/ao final.');
      const message = 'Erro de conexão ao analisar o vídeo. Verifique a sessão ou tente novamente.';
      aiTitleStatus.textContent = 'Falha ao gerar título por IA.';
      aiTitleStatus.dataset.mode = 'error';
      $('auto-reason').textContent = message;
      tell(error?.message || message,true);
    } finally {
      if (file === chosen) { analyzing = false; syncPublish(); }
    }
  }
  aiRetry.addEventListener('click', () => {
    if (!file || uploading || analyzing) return;
    // A retry is an explicit request to replace the current fallback title, but
    // typing while AI works still takes precedence over the eventual response.
    titleEdited = false;
    requestAnalysis(file);
  });

  async function uploadAndPublish() {
    if (publish.disabled || !file || !posterFile) return;
    const title = titleInput.value.trim();
    const category = $('auto-category').value;
    const position = Number(positionField.value)-1;
    const rankingMode=rankingSelect.value==='auto'&&qualityScore!==null?'auto':positionEdited?'manual':'unrated';
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
          uploadId:pending.id,title,category,position,qualityScore,rankingMode,src:uploadedVideo.url,poster:uploadedCover.url,
          description:$('auto-description').value.trim()
        })
      }));
      progress.value = 100;
      totalProjects++;
      uploading = false;
      clearSelection();
      try {await reloadManaged();} catch (_) { /* Publication succeeded; list refresh can be retried independently. */ }
      tell(rankingMode==='auto'?'Publicado! O vídeo entrará na posição sugerida pela IA, sem alterar a ordem relativa dos trabalhos originais.':'Publicado! A galeria respeitará a posição escolhida ou adicionará ao final.');
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
      meta.textContent = (item.category || 'outros') + ' · posição sugerida ' + (Number(item.position)+1) +
        (item.rankingMode==='auto'&&Number.isInteger(item.qualityScore)?' · IA visual '+item.qualityScore+'/100':' · posição manual/sem nota');
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
        let validLink = false;
        try {
          const parsed = new URL(url);
          validLink = parsed.protocol === 'https:' &&
            parsed.hostname.endsWith('.public.blob.vercel-storage.com') &&
            parsed.hostname.length > '.public.blob.vercel-storage.com'.length &&
            !parsed.username && !parsed.password && !parsed.port;
        } catch (_) { /* Malformed or unsupported URL. */ }
        if (!validLink) {
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
      const visualStatus = config.visualAIConfigured
        ? 'Credencial de IA encontrada. A conexão e os créditos serão verificados na tentativa de gerar o título.'
        : (config.visualAIOidcPotential
          ? 'Autenticação temporária da Vercel (OIDC) será testada ao analisar o vídeo; ela ainda não está confirmada.'
          : 'IA visual não configurada: falta credencial de AI Gateway ou OpenAI na Vercel. O título inicial usa o nome do arquivo.');
      setup.textContent = (storageReady
        ? 'Armazenamento conectado. '
        : 'Publicação desativada: conecte o armazenamento do portfólio. Ainda é possível preparar a capa e o título. ') + visualStatus;
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
    setCover(picked,true);
    tell('Imagem de capa personalizada. Revise e publique.');
  });
  cancel.addEventListener('click',clearSelection);
  publish.addEventListener('click',uploadAndPublish);
  initialize();
})();
