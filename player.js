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
 video.controls=false;
 video.classList.add('vip-native-video');
 const root=document.createElement('div');root.className='vip-player';root.dataset.playing='false';
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
 left.append(playButton,clock,volumeBox);
 bottom.append(left,brand,fullscreen);
 controls.append(timeline,bottom);
 const caption=document.createElement('span');caption.className='vip-player-caption';caption.textContent=title;
 root.append(video,caption,center,controls);
 let disposed=false,dragging=false,frame=0;
 const subscriptions=[];
 const on=(el,event,handler,opts)=>{el.addEventListener(event,handler,opts);subscriptions.push(()=>el.removeEventListener(event,handler,opts));};
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
 on(playButton,'click',toggle);
 on(center,'click',toggle);
 on(video,'click',toggle);
 on(video,'dblclick',(event)=>{event.preventDefault();event.stopPropagation();toggleFullscreen();});
 on(seek,'pointerdown',()=>{dragging=true;});
 on(seek,'input',()=>{
   const duration=video.duration;
   if(Number.isFinite(duration)&&duration>0){
     const value=Number(seek.value)/1000;
     root.style.setProperty('--vip-played',(value*100)+'%');
     clock.textContent=time(value*duration)+' / '+time(duration);
   }
 });
 const seekTo=()=>{dragging=false;if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Number(seek.value)/1000*video.duration;draw();};
 on(seek,'change',seekTo);
 on(seek,'pointerup',seekTo);
 on(volume,'input',()=>{
   const val=Number(volume.value);
   video.volume=val;
   video.muted=val===0;
   draw();
 });
 let previousVolume=video.volume>0?video.volume:0.5;
 on(volumeToggle,'click',()=>{
   if(video.muted||video.volume===0){
     video.muted=false;
     if(video.volume===0)video.volume=previousVolume;
   }else{previousVolume=video.volume;video.muted=true;}
   draw();
 });
 function toggleFullscreen(){
   if(document.fullscreenElement===root){
     if(document.exitFullscreen)document.exitFullscreen().catch(()=>{});
   }else if(root.requestFullscreen){
     root.requestFullscreen().catch(()=>{if(video.webkitEnterFullscreen)video.webkitEnterFullscreen();});
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
 // Small branding and controls are always visible on touch devices.
 draw();
 return {element:root,destroy(){
   disposed=true;
   if(frame)cancelAnimationFrame(frame);
   for(const unsubscribe of subscriptions)unsubscribe();
   if(document.fullscreenElement===root&&document.exitFullscreen)document.exitFullscreen().catch(()=>{});
 }};
}
window.GustavoPlayer={mount};
})();
