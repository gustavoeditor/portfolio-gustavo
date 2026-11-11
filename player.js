(() => {
'use strict';
const SVG = {
 play:'<path d="m8 5 12 7-12 7z"/>',
 pause:'<rect x="6" y="4.5" width="4.5" height="15" rx="1.2"/><rect x="13.5" y="4.5" width="4.5" height="15" rx="1.2"/>',
 volume:'<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
 mute:'<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="m17 9 5 6m0-6-5 6"/>',
 full:'<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/>',
 shrink:'<path d="M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5"/>',
 restart:'<path d="M20 11a8 8 0 1 1-3-6.3M20 4v5h-5"/>',
 loop:'<path d="m17 2 3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="m7 22-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>'
};
const icon=(name)=>'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+SVG[name]+'</svg>';
const SAFE_URL=/^(?:\/videos(?:-\d{3,4})?\/[a-z0-9-]+\.mp4|https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\/\S+)$/i;
// YouTube-style names: "1080p60" only when that file really is high frame rate,
// and only from 720p up; badge HD from 720p, 4K from 2160p.
const qualityName=(level)=>{
 if(!level||!level.size)return 'Original';
 return level.size+'p'+(level.size>=720&&level.fps>40?Math.round(level.fps):'');
};
const qualityBadge=(level)=>!level||!level.size||level.size<720?'':level.size>=2160?'4K':'HD';
const time=(seconds)=>{
 if(!Number.isFinite(seconds)||seconds<0)return '0:00';
 const s=Math.floor(seconds);return Math.floor(s/3600)>0
   ?[Math.floor(s/3600),Math.floor(s/60)%60,s%60].map((v,i)=>i?String(v).padStart(2,'0'):v).join(':')
   :Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
};
function mount(video,options={}){
 const title=String(options.title||'Vídeo');
 const primarySource=String(options.source||video.currentSrc||video.src||'');
 // Each video brings its own list of real resolutions (video-qualities.js or the
 // upload's renditions). Only those are offered, named by their real size.
 const levels=[];
 for(const q of Array.isArray(options.qualities)?options.qualities:[]){
   if(!q||!SAFE_URL.test(String(q.url||'')))continue;
   const width=Number(q.width)||0,height=Number(q.height)||0;
   const size=width&&height?Math.min(width,height):height;
   const same=size?levels.find(l=>l.size===size):levels.find(l=>l.url===q.url);
   const level={url:q.url,width,height,size,fps:Number(q.fps)||0,kbps:Number(q.kbps)||0,broken:false};
   if(!same)levels.push(level);
   else if(level.fps>same.fps+1||(Math.abs(level.fps-same.fps)<=1&&level.kbps>same.kbps))Object.assign(same,level);
 }
 if(!levels.length&&primarySource)levels.push({url:primarySource,width:0,height:0,size:0,fps:0,kbps:0,broken:false});
 // Unknown size (an upload's original) is treated as the heaviest until metadata says otherwise.
 const order=()=>levels.sort((a,b)=>(a.size||Infinity)-(b.size||Infinity));
 order();
 const qualityPreferenceKey='gustavo-video-quality-v2';
 const audioPreferenceKey='gustavo-video-audio-v1';
 const loopPreferenceKey='gustavo-video-loop-v1';
 // Preference is a resolution ("720"), not a file: on a video without 720p the
 // closest lower quality of that video is used instead.
 let qualityChoice='auto';
 try{
   const saved=localStorage.getItem(qualityPreferenceKey);
   if(saved==='auto'||saved==='orig'||/^\d{3,4}$/.test(saved||''))qualityChoice=saved;
 }catch(_){}
 let current=null;
 let switching=false;
 let stallCap=Infinity,stalls=[],lastSeekAt=0;
 const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
 // Restore volume and mute from this browser without changing first-visit defaults.
 try {
   const stored=JSON.parse(localStorage.getItem(audioPreferenceKey)||'null');
   if(stored&&typeof stored==='object'){
     if(Number.isFinite(stored.volume))video.volume=Math.max(0,Math.min(1,stored.volume));
     if(typeof stored.muted==='boolean')video.muted=stored.muted;
   }
 }catch(_){}
 // Loop is a viewer preference: it stays on for the next videos until turned off.
 try{video.loop=localStorage.getItem(loopPreferenceKey)==='1';}catch(_){video.loop=false;}
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
 const loopButton=document.createElement('button');loopButton.type='button';loopButton.className='vip-control vip-loop';loopButton.innerHTML=icon('loop')+'<i class="vip-loop-dot" aria-hidden="true"></i>';
 const loopBadge=document.createElement('span');loopBadge.className='vip-loop-badge';loopBadge.setAttribute('role','status');loopBadge.setAttribute('aria-live','polite');
 const brand=document.createElement('span');brand.className='vip-player-brand';brand.textContent='G / PLAYER';
 const qualityBox=document.createElement('div');qualityBox.className='vip-quality-box';
 const qualityLabel=document.createElement('label');qualityLabel.className='vip-quality-label';qualityLabel.textContent='QUALIDADE';
 const qualitySelect=document.createElement('button');qualitySelect.type='button';qualitySelect.className='vip-quality';qualitySelect.setAttribute('aria-label','Escolher qualidade do vídeo');qualitySelect.setAttribute('aria-haspopup','true');qualitySelect.setAttribute('aria-expanded','false');
 const qualityMenu=document.createElement('div');qualityMenu.className='vip-quality-menu';qualityMenu.setAttribute('role','group');qualityMenu.setAttribute('aria-label','Resoluções disponíveis');qualityMenu.hidden=true;
 qualityLabel.append(qualitySelect);qualityBox.append(qualityLabel,qualityMenu);qualityBox.hidden=true;
 left.append(playButton,clock,volumeBox);
 bottom.append(left,brand,qualityBox,loopButton,fullscreen);
 controls.append(timeline,bottom);
 const caption=document.createElement('span');caption.className='vip-player-caption';caption.textContent=title;
 // Motion layer: play/pause flash, buffering ring.
 const flash=document.createElement('span');flash.className='vip-flash';flash.setAttribute('aria-hidden','true');
 const spinner=document.createElement('span');spinner.className='vip-spinner';spinner.setAttribute('aria-hidden','true');
 root.append(video,caption,loopBadge,flash,spinner,center,controls);
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
 const usable=()=>levels.filter(l=>!l.broken);
 const levelId=(l)=>l.size?String(l.size):'orig';
 // Pixels of video actually shown on screen (short side), times a capped pixel ratio.
 function neededSize(){
   const ref=levels.find(l=>l.width&&l.height);
   const aspect=ref?ref.width/ref.height:16/9;
   let w,h;
   if(document.fullscreenElement===root){w=screen.width;h=screen.height;}
   else{
     const rect=root.isConnected?root.getBoundingClientRect():null;
     w=rect&&rect.width>0?rect.width:Math.min(innerWidth*.92,1280);
     h=rect&&rect.height>0?rect.height:innerHeight*.7;
   }
   const shownW=Math.min(w,h*aspect),shownH=shownW/aspect;
   const dpr=Math.min(window.devicePixelRatio||1,matchMedia('(pointer:coarse)').matches?1.5:2);
   return Math.min(shownW,shownH)*dpr;
 }
 // Auto: the smallest quality of THIS video that fills the player, limited by the
 // connection (data saver, 2g/3g, measured downlink) and by recent buffering stalls.
 function autoLevel(){
   const list=usable();
   if(list.length<2)return list[0]||null;
   let cap=stallCap;
   if(connection){
     if(connection.saveData||/^(slow-2g|2g)$/.test(connection.effectiveType||''))cap=Math.min(cap,360);
     else if(connection.effectiveType==='3g')cap=Math.min(cap,480);
   }
   const downlink=connection&&Number(connection.downlink)>0?connection.downlink*1000*.75:Infinity;
   const need=neededSize()*.9;
   let pick=list[0];
   for(const l of list){
     const size=l.size||Infinity;
     if(l!==list[0]&&(size>cap||(l.kbps&&l.kbps>downlink)))break;
     pick=l;
     if(size>=need)break;
   }
   return pick;
 }
 function manualLevel(){
   const list=usable();
   if(qualityChoice==='orig')return list.find(l=>!l.size)||list[list.length-1]||null;
   const wanted=Number(qualityChoice);
   let pick=null;
   for(const l of list)if(l.size&&l.size<=wanted)pick=l;
   return pick||list[0]||null;
 }
 const effectiveLevel=()=>qualityChoice==='auto'?autoLevel():manualLevel();
 function renderQualityOptions(){
   const list=usable();
   const shown=current&&!current.broken?current:effectiveLevel();
   const name=shown?qualityName(shown):'';
   qualityMenu.replaceChildren();
   if(list.length<2){
     // One quality only: show what it is, nothing to choose.
     qualitySelect.textContent=name;qualitySelect.disabled=true;
     qualityBox.hidden=!shown||!shown.size;
     return;
   }
   qualitySelect.disabled=false;qualityBox.hidden=false;
   qualitySelect.textContent=(qualityChoice==='auto'?'Auto · '+name:name)+' ▾';
   const entries=[['auto','Auto',null]].concat(list.slice().reverse().map(l=>[levelId(l),qualityName(l),l]));
   entries.forEach(([value,label,level],index)=>{
     const option=document.createElement('button');option.type='button';option.className='vip-quality-option';
     option.dataset.quality=value;option.style.setProperty('--i',String(index));
     const text=document.createElement('span');text.className='vip-quality-name';text.textContent=label;
     const badge=qualityBadge(level);
     if(badge){const sup=document.createElement('sup');sup.className='vip-quality-badge';sup.textContent=badge;text.append(sup);}
     option.append(text);
     const active=value==='auto'?qualityChoice==='auto':qualityChoice!=='auto'&&shown&&levelId(shown)===value;
     option.setAttribute('aria-pressed',String(Boolean(active)));
     if(value!=='auto'&&qualityChoice==='auto'&&shown&&levelId(shown)===value)option.dataset.auto='true';
     option.addEventListener('click',(event)=>{
       event.stopPropagation();
       qualityChoice=value;stallCap=Infinity;stalls=[];
       try{localStorage.setItem(qualityPreferenceKey,qualityChoice);}catch(_){}
       closeQualityMenu();applyQuality();renderQualityOptions();
       qualitySelect.focus({preventScroll:true});
     });
     qualityMenu.append(option);
   });
 }
 // Pick the starting quality before the first byte of playback.
 current=effectiveLevel();
 if(current&&video.src!==new URL(current.url,document.baseURI).href)video.src=current.url;
 function changeSource(target){
   const selected=target&&!target.broken?target:null;
   if(!selected||selected===current||switching||disposed)return;
   const previousTime=Number.isFinite(video.currentTime)?video.currentTime:0;
   const shouldResume=!video.paused&&!video.ended;
   const previousVolume=video.volume;
   const previousMute=video.muted;
   const oldSource=current?current.url:primarySource;
   switching=true;root.dataset.switching='true';
   video.pause();
   let settled=false;
   let restore,failed;
   const cleanup=()=>{
     video.removeEventListener('loadedmetadata',restore);
     video.removeEventListener('error',failed);
   };
   restore=()=>{
     if(settled||disposed)return;
     settled=true;cleanup();switching=false;root.dataset.switching='false';
     try{video.currentTime=Math.min(previousTime,Number.isFinite(video.duration)&&video.duration>0?Math.max(0,video.duration-.05):previousTime);}catch(_){}
     video.volume=previousVolume;video.muted=previousMute;
     current=selected;stalls=[];
     // Announce the new quality like a broadcast tag: "AUTO · 1080P60 HD".
     const badge=qualityBadge(selected);
     showBadge((qualityChoice==='auto'?'AUTO · ':'')+qualityName(selected).toUpperCase()+(badge?'  '+badge:''));
     if(shouldResume){const result=video.play();if(result?.catch)result.catch(()=>{});}
     draw();renderQualityOptions();
     if(effectiveLevel()!==current)applyQuality();
   };
   failed=()=>{
     if(settled||disposed)return;
     settled=true;cleanup();switching=false;root.dataset.switching='false';
     selected.broken=true;
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
   video.src=selected.url;
   video.load();
 }
 // Recover if the selected file is temporarily missing on the CDN.
 // Never leave the customer with a broken player when another quality still exists.
 on(video,'error',()=>{
   if(disposed||switching||!current)return;
   current.broken=true;
   const backup=effectiveLevel();
   const url=backup?backup.url:primarySource;
   current=backup;
   if(!url||video.src===new URL(url,document.baseURI).href)return;
   video.src=url;video.load();renderQualityOptions();
   const playback=video.play();if(playback?.catch)playback.catch(()=>{});
 });
 // An upload's original has no size in the manifest: name it once the browser knows.
 on(video,'loadedmetadata',()=>{
   if(!current||current.size||!video.videoWidth||!video.videoHeight)return;
   current.width=video.videoWidth;current.height=video.videoHeight;
   current.size=Math.min(video.videoWidth,video.videoHeight);
   order();renderQualityOptions();
 });
 // Buffering twice in 15 s while Auto is on: step down one quality of this video.
 on(video,'seeking',()=>{lastSeekAt=performance.now();});
 on(video,'waiting',()=>{
   if(disposed||switching||qualityChoice!=='auto'||!current||video.currentTime<.5)return;
   const now=performance.now();
   if(now-lastSeekAt<1500)return;
   stalls=stalls.filter(t=>now-t<15000);stalls.push(now);
   if(stalls.length<2)return;
   const list=usable(),index=list.indexOf(current);
   if(index<=0)return;
   stallCap=list[index-1].size||Infinity;stalls=[];
   applyQuality();
 });
 function applyQuality(){changeSource(effectiveLevel());}
 // Bigger player (fullscreen, rotated phone, resized window) may need more pixels in Auto.
 let resizeTimer=0;
 const reconsider=()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(qualityChoice==='auto')applyQuality();},600);};
 function closeQualityMenu(){
   qualityMenu.hidden=true;qualitySelect.setAttribute('aria-expanded','false');
   scheduleHide();
 }
 on(qualitySelect,'click',(event)=>{
   showUI();
   event.stopPropagation();
   if(qualityMenu.hidden){
     // Up to 9 rows (Auto + 144p…2160p): fit inside the player, scroll the rest.
     const room=qualityBox.getBoundingClientRect().top-root.getBoundingClientRect().top-22;
     qualityMenu.style.maxHeight=Math.max(110,Math.floor(room))+'px';
     qualityMenu.hidden=false;qualitySelect.setAttribute('aria-expanded','true');
     const active=qualityMenu.querySelector('[data-auto="true"]')||qualityMenu.querySelector('[aria-pressed="true"]');
     if(active)qualityMenu.scrollTop=Math.max(0,active.offsetTop-qualityMenu.clientHeight/2);
   }
   else closeQualityMenu();
 });
 on(qualitySelect,'keydown',(event)=>{if(event.key==='ArrowDown'){event.preventDefault();if(qualityMenu.hidden)qualitySelect.click();qualityMenu.querySelector('button')?.focus();}});
 on(qualityBox,'keydown',(event)=>{if(event.key==='Escape'){event.stopPropagation();closeQualityMenu();qualitySelect.focus();}});
 on(document,'pointerdown',(event)=>{if(!qualityBox.contains(event.target))closeQualityMenu();});
 renderQualityOptions();
 on(window,'storage',(event)=>{
   if(event.key!==qualityPreferenceKey)return;
   const value=String(event.newValue||'');
   if(value!=='auto'&&value!=='orig'&&!/^\d{3,4}$/.test(value))return;
   qualityChoice=value;applyQuality();renderQualityOptions();
 });
 if(connection&&typeof connection.addEventListener==='function')on(connection,'change',()=>{if(qualityChoice==='auto')applyQuality();});
 on(window,'resize',reconsider);
 on(document,'fullscreenchange',reconsider);
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
   const willPlay=video.paused||video.ended;
   if(willPlay){
     if(video.ended)video.currentTime=0;
     const started=video.play();if(started&&typeof started.catch==='function')started.catch(()=>{draw();});
   }else video.pause();
   flashIcon(willPlay?'play':'pause');
 }
 // YouTube-like feedback: the icon pops in the middle and fades out.
 function flashIcon(name){
   flash.innerHTML=icon(name);
   flash.classList.remove('go');void flash.offsetWidth;flash.classList.add('go');
 }
 // Buffering ring: only while waiting for data (shown after a short delay in CSS).
 const setBuffering=(active)=>{root.dataset.buffering=active?'true':'false';};
 on(video,'waiting',()=>setBuffering(true));
 on(video,'seeking',()=>setBuffering(true));
 for(const e of ['playing','canplay','seeked','pause','ended','error'])on(video,e,()=>setBuffering(switching));
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
 function syncLoop(){
   loopButton.setAttribute('aria-pressed',String(video.loop));
   const label=video.loop?'Desativar repetição (L)':'Ativar repetição (L)';
   loopButton.setAttribute('aria-label',label);loopButton.title=label;
   root.dataset.loop=String(video.loop);
 }
 let badgeTimer=0;
 function showBadge(text){
   loopBadge.textContent=text;
   loopBadge.classList.remove('show');void loopBadge.offsetWidth;loopBadge.classList.add('show');
   clearTimeout(badgeTimer);badgeTimer=setTimeout(()=>loopBadge.classList.remove('show'),1400);
 }
 function toggleLoop(){
   video.loop=!video.loop;
   try{localStorage.setItem(loopPreferenceKey,video.loop?'1':'0');}catch(_){}
   syncLoop();
   showBadge(video.loop?'↻  LOOP ATIVADO':'LOOP DESATIVADO');
   // Turning loop on after the end restarts the take right away.
   if(video.loop&&video.ended){video.currentTime=0;const p=video.play();if(p?.catch)p.catch(()=>{});}
 }
 on(loopButton,'click',toggleLoop);
 syncLoop();
 on(fullscreen,'click',toggleFullscreen);
 on(document,'fullscreenchange',draw);
 for(const e of ['loadedmetadata','durationchange','timeupdate','progress','play','pause','ended','volumechange','seeking','seeked','waiting','playing'])on(video,e,raf);
 on(root,'keydown',event=>{
   if(event.target===seek||event.target===volume||event.altKey||event.ctrlKey||event.metaKey)return;
   if(event.key===' '||event.key==='k'){event.preventDefault();toggle();}
   if(event.key==='f'){event.preventDefault();toggleFullscreen();}
   if(event.key==='m'){event.preventDefault();volumeToggle.click();}
   if(event.key==='l'||event.key==='L'){event.preventDefault();toggleLoop();}
 });
 // Paused/ended controls remain visible. During playback the idle timer owns the UI.
 draw();onPlaybackState();
 return {element:root,destroy(){
   disposed=true;clearHideTimer();clearTimeout(badgeTimer);clearTimeout(resizeTimer);
   if(frame)cancelAnimationFrame(frame);
   for(const unsubscribe of subscriptions)unsubscribe();
   if(document.fullscreenElement===root&&document.exitFullscreen)document.exitFullscreen().catch(()=>{});
 }};
}
window.GustavoPlayer={mount};
})();
