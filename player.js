(() => {
'use strict';
const SVG = {
 play:'<path d="m8 5 12 7-12 7z"/>',
 pause:'<rect x="6" y="4.5" width="4.5" height="15" rx="1.2"/><rect x="13.5" y="4.5" width="4.5" height="15" rx="1.2"/>',
 volume:'<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
 mute:'<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="m17 9 5 6m0-6-5 6"/>',
 full:'<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/>',
 shrink:'<path d="M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5"/>',
 restart:'<path d="M20 11a8 8 0 1 1-3-6.3M20 4v5h-5"/>'
};
const icon=(name)=>'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+SVG[name]+'</svg>';
const time=(seconds)=>{
 if(!Number.isFinite(seconds)||seconds<0)return '0:00';
 const s=Math.floor(seconds);return Math.floor(s/3600)>0
   ?[Math.floor(s/3600),Math.floor(s/60)%60,s%60].map((v,i)=>i?String(v).padStart(2,'0'):v).join(':')
   :Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
};
function mount(video,options={}){
 const title=String(options.title||'Vídeo');
 const primarySource=String(options.source||video.currentSrc||video.src||'');
 const mobileSource=typeof options.mobileSource==='string'&&options.mobileSource.startsWith('/videos-360/')?options.mobileSource:'';
 const lowSource=typeof options.lowSource==='string'&&options.lowSource.startsWith('/videos-480/')?options.lowSource:'';
 const fullSource=typeof options.fullSource==='string'&&options.fullSource.startsWith('/videos-1080/')?options.fullSource:'';
 // All original locally hosted projects have both encodes, verified in CI.
 // Avoid two HEAD requests and a second video download on each new player.
 const verifiedVariants=(options.verifiedLocalVariants===true && /^\/?videos\/[a-z0-9-]+\.mp4$/i.test(primarySource)) || (options.verifiedExternalVariants===true && /^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//i.test(primarySource));
 const highLabel=options.highLabel==='Original'?'Original':'720p';
 const qualityPreferenceKey='gustavo-video-quality-v1';
 const audioPreferenceKey='gustavo-video-audio-v1';
 const validQualities=['auto','mobile','low','high','full'];
 let qualityChoice='auto';
 try{
   const saved=localStorage.getItem(qualityPreferenceKey);
   if(validQualities.includes(saved))qualityChoice=saved;
 }catch(_){}
 let mobileReady=verifiedVariants&&Boolean(mobileSource);
 let lowReady=verifiedVariants&&Boolean(lowSource);
 let fullReady=verifiedVariants&&Boolean(fullSource);
 let currentQuality='high';
 let switching=false;
 const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
 const slowNetwork=()=>Boolean(connection&&(connection.saveData||/^(slow-2g|2g|3g)$/.test(connection.effectiveType||'')));
 // Restore volume and mute from this browser without changing first-visit defaults.
 try {
   const stored=JSON.parse(localStorage.getItem(audioPreferenceKey)||'null');
   if(stored&&typeof stored==='object'){
     if(Number.isFinite(stored.volume))video.volume=Math.max(0,Math.min(1,stored.volume));
     if(typeof stored.muted==='boolean')video.muted=stored.muted;
   }
 }catch(_){}
 video.controls=false;
 video.classList.add('vip-native-video');
 const root=document.createElement('div');root.className='vip-player';root.dataset.playing='false';
 root.dataset.uiVisible='true';root.dataset.pointerInside='false';
 const controls=document.createElement('div');controls.className='vip-controls';
 const playButton=document.createElement('button');playButton.type='button';playButton.className='vip-control vip-toggle';
 const center=document.createElement('button');center.type='button';center.className='vip-center';center.setAttribute('aria-label','Reproduzir '+title);center.innerHTML=icon('play');
 const timeline=document.createElement('div');timeline.className='vip-timeline-wrap';
 const buffered=document.createElement('div');buffered.className='vip-buffer';buffered.setAttribute('aria-hidden','true');
 const progress=document.createElement('div');progress.className='vip-progress';progress.setAttribute('aria-hidden','true');
 const seek=document.createElement('input');seek.type='range';seek.min='0';seek.max='1000';seek.value='0';seek.step='1';seek.className='vip-seek';seek.setAttribute('aria-label','Posição do vídeo');
 timeline.append(buffered,progress,seek);
 const bottom=document.createElement('div');bottom.className='vip-controlbar';
 const left=document.createElement('div');left.className='vip-left';
 const clock=document.createElement('span');clock.className='vip-clock';clock.textContent='0:00 / 0:00';
 const volumeToggle=document.createElement('button');volumeToggle.type='button';volumeToggle.className='vip-control vip-mute';
 const volume=document.createElement('input');volume.type='range';volume.className='vip-volume';volume.min='0';volume.max='1';volume.step='0.01';volume.value=String(video.volume);volume.setAttribute('aria-label','Volume do vídeo');
 const volumeBox=document.createElement('div');volumeBox.className='vip-volume-box';
 volumeBox.append(volumeToggle,volume);
 const fullscreen=document.createElement('button');fullscreen.type='button';fullscreen.className='vip-control vip-fullscreen';fullscreen.setAttribute('aria-label','Entrar em tela cheia');fullscreen.innerHTML=icon('full');
 const brand=document.createElement('span');brand.className='vip-player-brand';brand.textContent='G / PLAYER';
 const qualityBox=document.createElement('div');qualityBox.className='vip-quality-box';
 const qualityLabel=document.createElement('label');qualityLabel.className='vip-quality-label';qualityLabel.textContent='QUALIDADE';
 const qualitySelect=document.createElement('button');qualitySelect.type='button';qualitySelect.className='vip-quality';qualitySelect.setAttribute('aria-label','Escolher qualidade do vídeo');qualitySelect.setAttribute('aria-haspopup','true');qualitySelect.setAttribute('aria-expanded','false');
 const qualityMenu=document.createElement('div');qualityMenu.className='vip-quality-menu';qualityMenu.setAttribute('role','group');qualityMenu.setAttribute('aria-label','Resoluções disponíveis');qualityMenu.hidden=true;
 qualityLabel.append(qualitySelect);qualityBox.append(qualityLabel,qualityMenu);qualityBox.hidden=true;
 left.append(playButton,clock,volumeBox);
 bottom.append(left,brand,qualityBox,fullscreen);
 controls.append(timeline,bottom);
 const caption=document.createElement('span');caption.className='vip-player-caption';caption.textContent=title;
 root.append(video,caption,center,controls);
 let disposed=false,dragging=false,frame=0,hideTimer=0,touchRevealOnly=false;
 const CONTROL_IDLE_MS=3200;
 // The player must not stay visible just because the mouse is motionless over it.
 // Keyboard focus, quality selection and active scrubbing take priority over hiding.
 const focusedFromKeyboard=()=>Boolean(root.querySelector(':focus-visible'));
 function clearHideTimer(){if(hideTimer){clearTimeout(hideTimer);hideTimer=0;}}
 function scheduleHide(){
   clearHideTimer();
   if(disposed||video.paused||video.ended||document.hidden)return;
   hideTimer=setTimeout(hideUI,CONTROL_IDLE_MS);
 }
 function showUI(){
   if(disposed)return;
   root.dataset.uiVisible='true';
   scheduleHide();
 }
 function hideUI(){
   clearHideTimer();
   if(disposed||video.paused||video.ended||document.hidden)return;
   if(dragging||!qualityMenu.hidden||focusedFromKeyboard()){scheduleHide();return;}
   root.dataset.uiVisible='false';
 }
 function onPlaybackState(){
   if(video.paused||video.ended){
     clearHideTimer();root.dataset.uiVisible='true';
   }else showUI();
 }

 const subscriptions=[];
 const on=(el,event,handler,opts)=>{el.addEventListener(event,handler,opts);subscriptions.push(()=>el.removeEventListener(event,handler,opts));};
 function effectiveQuality(){
   if(qualityChoice==='auto'){
     if(mobileReady && (slowNetwork() || matchMedia('(max-width:700px)').matches))return 'mobile';
     if(lowReady && (slowNetwork() || (mobileSource&&matchMedia('(max-width:1024px)').matches)))return 'low';
     return 'high';
   }
   if(qualityChoice==='full')return fullReady?'full':'high';
   if(qualityChoice==='mobile')return mobileReady?'mobile':lowReady?'low':'high';
   if(qualityChoice==='low')return lowReady?'low':'high';
   return 'high';
 }
 function renderQualityOptions(){
   const shown=(qualityChoice==='full'&&!fullReady)||(qualityChoice==='low'&&!lowReady)||(qualityChoice==='mobile'&&!mobileReady)?'high':qualityChoice;
   const names={auto:'Auto',full:'1080p',high:highLabel,low:'480p',mobile:'360p'};
   qualitySelect.textContent=names[shown]+' ▾';
   qualityMenu.replaceChildren();
   for(const [value,label] of [['auto','Auto'],['full','1080p'],['high',highLabel],['low','480p'],['mobile','360p']]){
     if(value==='mobile'&&!mobileReady)continue;
     if(value==='low'&&!lowReady)continue;
     if(value==='full'&&!fullReady)continue;
     const option=document.createElement('button');option.type='button';option.className='vip-quality-option';
     option.textContent=label;option.dataset.quality=value;
     option.setAttribute('aria-pressed',String(shown===value));
     option.addEventListener('click',(event)=>{
       event.stopPropagation();
       qualityChoice=value;
       try{localStorage.setItem(qualityPreferenceKey,qualityChoice);}catch(_){}
       closeQualityMenu();renderQualityOptions();applyQuality();
       qualitySelect.focus({preventScroll:true});
     });
     qualityMenu.append(option);
   }
   qualityBox.hidden=!mobileReady&&!lowReady&&!fullReady;
 }
 function selectedSource(key){
   return key==='mobile'&&mobileReady?mobileSource:key==='low'&&lowReady?lowSource:key==='full'&&fullReady?fullSource:primarySource;
 }
 // Apply a validated saved or automatic quality before the first byte of playback.
 // The source switch doesn't need an asynchronous metadata probe for bundled files.
 if(verifiedVariants) {
   currentQuality=effectiveQuality();
   const initial=selectedSource(currentQuality);
   if(initial && video.src!==new URL(initial,document.baseURI).href) video.src=initial;
 }
  function changeSource(key){
   const selected=key==='mobile'&&mobileReady?'mobile':key==='low'&&lowReady?'low':key==='full'&&fullReady?'full':'high';
   if(selected===currentQuality||!primarySource||switching||disposed)return;
   const previousTime=Number.isFinite(video.currentTime)?video.currentTime:0;
   const shouldResume=!video.paused&&!video.ended;
   const previousVolume=video.volume;
   const previousMute=video.muted;
   const oldSource=selectedSource(currentQuality);
   switching=true;
   video.pause();
   let settled=false;
   let restore,failed;
   const cleanup=()=>{
     video.removeEventListener('loadedmetadata',restore);
     video.removeEventListener('error',failed);
   };
   restore=()=>{
     if(settled||disposed)return;
     settled=true;cleanup();switching=false;
     try{video.currentTime=Math.min(previousTime,Number.isFinite(video.duration)&&video.duration>0?Math.max(0,video.duration-.05):previousTime);}catch(_){}
     video.volume=previousVolume;video.muted=previousMute;
     currentQuality=selected;
     if(shouldResume){const result=video.play();if(result?.catch)result.catch(()=>{});}
     draw();
     if(effectiveQuality()!==currentQuality)applyQuality();
   };
   failed=()=>{
     if(settled||disposed)return;
     settled=true;cleanup();switching=false;
     if(selected==='mobile')mobileReady=false;
     if(selected==='low')lowReady=false;
     if(selected==='full')fullReady=false;
     renderQualityOptions();
     video.src=oldSource||primarySource;
     video.load();
     video.addEventListener('loadedmetadata',()=>{
       if(disposed)return;
       try{video.currentTime=previousTime;}catch(_){}
       video.volume=previousVolume;video.muted=previousMute;
       if(shouldResume){const result=video.play();if(result?.catch)result.catch(()=>{});}
     },{once:true});
   };
   video.addEventListener('loadedmetadata',restore);
   video.addEventListener('error',failed);
   video.src=selectedSource(selected);
   video.load();
 }
 function applyQuality(){changeSource(effectiveQuality());}
 function probeVariant(src,key){
   if(!src||typeof fetch!=='function')return;
   // Metadata only; no additional media is downloaded until selected.
   fetch(src,{method:'HEAD',cache:'force-cache'}).then(response=>{
     if(disposed||!response.ok||!String(response.headers.get('content-type')||'').toLowerCase().includes('video/'))return;
     if(key==='mobile')mobileReady=true;
     if(key==='low')lowReady=true;
     if(key==='full')fullReady=true;
     renderQualityOptions();
     applyQuality();
   }).catch(()=>{});
 }
 function closeQualityMenu(){
   qualityMenu.hidden=true;qualitySelect.setAttribute('aria-expanded','false');
   scheduleHide();
 }
 on(qualitySelect,'click',(event)=>{
   showUI();
   event.stopPropagation();
   if(qualityMenu.hidden){qualityMenu.hidden=false;qualitySelect.setAttribute('aria-expanded','true');}
   else closeQualityMenu();
 });
 on(qualitySelect,'keydown',(event)=>{if(event.key==='ArrowDown'){event.preventDefault();if(qualityMenu.hidden)qualitySelect.click();qualityMenu.querySelector('button')?.focus();}});
 on(qualityBox,'keydown',(event)=>{if(event.key==='Escape'){event.stopPropagation();closeQualityMenu();qualitySelect.focus();}});
 on(document,'pointerdown',(event)=>{if(!qualityBox.contains(event.target))closeQualityMenu();});
 renderQualityOptions();
 on(window,'storage',(event)=>{
   if(event.key!==qualityPreferenceKey)return;
   if(!validQualities.includes(event.newValue))return;
   qualityChoice=event.newValue;renderQualityOptions();applyQuality();
 });
 if(connection&&typeof connection.addEventListener==='function')on(connection,'change',()=>{if(qualityChoice==='auto')applyQuality();});
 if(!verifiedVariants) {
   probeVariant(mobileSource,'mobile');
   probeVariant(lowSource,'low');
   probeVariant(fullSource,'full');
 }
 const raf=()=>{
   if(frame||disposed)return;
   frame=requestAnimationFrame(()=>{frame=0;draw();});
 };
 function draw(){
   if(disposed)return;
   const duration=Number.isFinite(video.duration)?video.duration:0;
   const pct=duration>0?Math.min(100,Math.max(0,video.currentTime/duration*100)):0;
   if(!dragging)seek.value=String(Math.round(pct*10));
   root.style.setProperty('--vip-played',pct+'%');
   const loaded=video.buffered;
   let loadedEnd=0;
   try{for(let i=0;i<loaded.length;i++)if(loaded.start(i)<=video.currentTime+0.2)loadedEnd=Math.max(loadedEnd,loaded.end(i));}catch(_){}
   root.style.setProperty('--vip-buffered',duration?Math.min(100,loadedEnd/duration*100)+'%':'0%');
   clock.textContent=time(video.currentTime)+' / '+time(duration);
   seek.setAttribute('aria-valuetext',time(video.currentTime)+' de '+time(duration));
   const paused=video.paused||video.ended;
   root.dataset.playing=paused?'false':'true';
   const action=video.ended?'Reproduzir novamente':paused?'Reproduzir':'Pausar';
   playButton.setAttribute('aria-label',action+' '+title);
   playButton.innerHTML=icon(video.ended?'restart':paused?'play':'pause');
   center.setAttribute('aria-label',action+' '+title);
   center.innerHTML=icon(video.ended?'restart':paused?'play':'pause');
   volumeToggle.innerHTML=icon(video.muted||video.volume===0?'mute':'volume');
   volumeToggle.setAttribute('aria-label',video.muted||video.volume===0?'Ativar som':'Silenciar');
   volume.value=video.muted?'0':String(video.volume);
   volume.style.setProperty('--vip-volume-fill',(video.muted?0:video.volume*100)+'%');
   const isFull=document.fullscreenElement===root;
   fullscreen.innerHTML=icon(isFull?'shrink':'full');
   fullscreen.setAttribute('aria-label',isFull?'Sair da tela cheia':'Entrar em tela cheia');
 }
 function toggle(event){
   if(event)event.stopPropagation();
   if(video.paused||video.ended){
     if(video.ended)video.currentTime=0;
     const started=video.play();if(started&&typeof started.catch==='function')started.catch(()=>{draw();});
   }else video.pause();
 }
 // Mouse movement reveals the full controls; leaving the video hides them instantly.
 // Stationary hovering never prevents the idle timeout.
 on(root,'pointerenter',event=>{
   if(event.pointerType==='mouse'||event.pointerType==='pen'){
     root.dataset.pointerInside='true';showUI();
   }
 });
 on(root,'pointermove',event=>{
   if(event.pointerType==='mouse'||event.pointerType==='pen'){
     root.dataset.pointerInside='true';showUI();
   }
 });
 on(root,'pointerleave',event=>{
   if(event.pointerType==='mouse'||event.pointerType==='pen'){
     root.dataset.pointerInside='false';hideUI();
   }
 });
 on(root,'pointerdown',event=>{
   if(event.pointerType==='touch'){
     // First tap on a playing, hidden video displays controls, not an accidental pause.
     touchRevealOnly=event.target===video&&!video.paused&&root.dataset.uiVisible==='false';
     showUI();
   }
 });
 on(root,'focusin',showUI);
 on(root,'focusout',scheduleHide);
 on(root,'keydown',showUI);
 on(video,'play',onPlaybackState);
 on(video,'pause',onPlaybackState);
 on(video,'ended',onPlaybackState);
 on(document,'visibilitychange',()=>{
   if(document.hidden){clearHideTimer();root.dataset.uiVisible='false';}
   else onPlaybackState();
 });
 on(playButton,'click',toggle);
 on(center,'click',toggle);
 on(video,'click',event=>{
   if(touchRevealOnly){touchRevealOnly=false;event.stopPropagation();return;}
   toggle(event);
 });
 on(video,'dblclick',(event)=>{event.preventDefault();event.stopPropagation();toggleFullscreen();});
 on(video,'contextmenu',(event)=>event.stopPropagation());
 on(seek,'pointerdown',()=>{dragging=true;showUI();});
 on(seek,'input',()=>{
   const duration=video.duration;
   if(Number.isFinite(duration)&&duration>0){
     const value=Number(seek.value)/1000;
     root.style.setProperty('--vip-played',(value*100)+'%');
     clock.textContent=time(value*duration)+' / '+time(duration);
   }
 });
 const seekTo=()=>{dragging=false;if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Number(seek.value)/1000*video.duration;draw();showUI();};
 on(seek,'change',seekTo);
 on(seek,'pointerup',seekTo);
 function savePlaybackVolume(){
   try{localStorage.setItem(audioPreferenceKey,JSON.stringify({volume:video.volume,muted:video.muted}));}catch(_){}
 }
 on(volume,'input',()=>{
   const val=Number(volume.value);
   video.volume=val;
   video.muted=val===0;
   savePlaybackVolume();
   draw();
 });
 let previousVolume=video.volume>0?video.volume:0.5;
 on(volumeToggle,'click',()=>{
   if(video.muted||video.volume===0){
     video.muted=false;
     if(video.volume===0)video.volume=previousVolume;
   }else{previousVolume=video.volume;video.muted=true;}
   savePlaybackVolume();
   draw();
 });
 function toggleFullscreen(){
   if(document.fullscreenElement===root){
     if(document.exitFullscreen){const exit=document.exitFullscreen();if(exit?.catch)exit.catch(()=>{});}
   }else if(root.requestFullscreen){
     const open=root.requestFullscreen();
     if(open?.catch)open.catch(()=>{if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();});
   }else if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();
 }
 on(fullscreen,'click',toggleFullscreen);
 on(document,'fullscreenchange',draw);
 for(const e of ['loadedmetadata','durationchange','timeupdate','progress','play','pause','ended','volumechange','seeking','seeked','waiting','playing'])on(video,e,raf);
 on(root,'keydown',event=>{
   if(event.target===seek||event.target===volume||event.altKey||event.ctrlKey||event.metaKey)return;
   if(event.key===' '||event.key==='k'){event.preventDefault();toggle();}
   if(event.key==='f'){event.preventDefault();toggleFullscreen();}
   if(event.key==='m'){event.preventDefault();volumeToggle.click();}
 });
 // Paused/ended controls remain visible. During playback the idle timer owns the UI.
 draw();onPlaybackState();
 return {element:root,destroy(){
   disposed=true;clearHideTimer();
   if(frame)cancelAnimationFrame(frame);
   for(const unsubscribe of subscriptions)unsubscribe();
   if(document.fullscreenElement===root&&document.exitFullscreen)document.exitFullscreen().catch(()=>{});
 }};
}
window.GustavoPlayer={mount};
})();
