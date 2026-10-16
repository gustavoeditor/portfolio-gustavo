/* G / AMBIENCE 01 — original generative lo-fi, optional and low-volume.
   No tracking, CDN, cookies, prerecorded copyrighted tracks or autoplay.
   AudioContext is created only in response to visitor interaction. */
(() => {
  'use strict';
  const root = document.getElementById('ambience-dock');
  if (!root) return;
  const trigger = document.getElementById('ambience-trigger');
  const panel = document.getElementById('ambience-popover');
  const close = document.getElementById('ambience-close');
  const musicButton = document.getElementById('ambience-music');
  const fxButton = document.getElementById('ambience-fx');
  const range = document.getElementById('ambience-volume');
  const volumeText = document.getElementById('ambience-volume-display');
  const fxRange = document.getElementById('ambience-fx-volume');
  const fxVolumeText = document.getElementById('ambience-fx-volume-display');
  const status = document.getElementById('ambience-status');
  const audioClass = window.AudioContext || window.webkitAudioContext;
  const KEY = 'gustavo-ambience-v1';
  const defaults = {music:false, fx:false, volume:12, fxVolume:32};
  const MAX_MUSIC_VOLUME = 65;
  const MAX_FX_VOLUME = 100;
  const clamp = (number,maximum,fallback) => Number.isFinite(number) ? Math.max(0,Math.min(maximum,Math.round(number))) : fallback;
  let preferences = {...defaults};
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (stored && typeof stored === 'object') {
      preferences.music = stored.music === true;
      preferences.fx = stored.fx === true;
      preferences.volume = clamp(stored.volume,MAX_MUSIC_VOLUME,defaults.volume);
      preferences.fxVolume = clamp(stored.fxVolume,MAX_FX_VOLUME,defaults.fxVolume);
    }
  } catch (_) { /* Private browsing / disabled storage: safe defaults. */ }
  const save = () => {try {localStorage.setItem(KEY, JSON.stringify(preferences));} catch (_) {}};
  let context, musicBus, fxBus, master, ambienceNoise;
  let sequenceTimer = 0, nextStep = 0, beatStep = 0;
  let armed = false, engaged = false;
  const bpm = 74;
  const beat = 60 / bpm;
  const halfBeat = beat / 2;
  const melodies = [
    [64,67,71,74], [64,67,71,74], // Cmaj9
    [60,64,67,71], [60,64,67,71], // Am9
    [62,65,69,72], [62,65,69,72], // Dm9
    [59,62,65,69], [59,62,65,69]  // G13 colour
  ];
  const basses = [48,48,45,45,50,50,43,43];
  const tones = [74,79,76,72,71,76,69,72,76,79,74,72,69,72,74,71];
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const shortStatus = value => {status.textContent=value || '';};
  const modalActive = () => document.getElementById('video-modal')?.getAttribute('aria-hidden') === 'false';
  const videoActive = () => modalActive() || [...document.querySelectorAll('video')].some(v => !v.paused && !v.ended && !v.muted);
  const shouldSound = () => Boolean(preferences.music && engaged && !document.hidden && !videoActive());
  const takeFocus = () => !panel.hidden;
  function render() {
    musicButton.setAttribute('aria-pressed',String(preferences.music));
    fxButton.setAttribute('aria-pressed',String(preferences.fx));
    musicButton.textContent = preferences.music ? 'Ligado' : 'Desligado';
    fxButton.textContent = preferences.fx ? 'Ligados' : 'Desligados';
    range.value=String(preferences.volume);
    volumeText.textContent=preferences.volume+'%';
    fxRange.value=String(preferences.fxVolume);
    fxVolumeText.textContent=preferences.fxVolume+'%';
    root.dataset.playing=String(shouldSound());
    trigger.setAttribute('aria-label','Abrir controles de som. '+(preferences.music?'Música ativada':'Música desligada'));
  }
  function noiseBuffer() {
    const size=context.sampleRate*2, data=context.createBuffer(1,size,context.sampleRate);
    const out=data.getChannelData(0);
    let last=0;
    // Quiet, warm tape texture, no random external data or downloads.
    for(let i=0;i<size;i++) { last = (last + (Math.random()*2-1)*.019) * .994; out[i]=last*.25; }
    return data;
  }
  function createAudio() {
    if (context || !audioClass) return Boolean(context);
    try {
      context = new audioClass({latencyHint:'playback'});
      master=context.createDynamicsCompressor();master.threshold.value=-18;master.knee.value=21;master.ratio.value=3;
      master.attack.value=.02;master.release.value=.4;master.connect(context.destination);
      musicBus=context.createGain();musicBus.gain.value=0;musicBus.connect(master);
      fxBus=context.createGain();fxBus.gain.value=0;fxBus.connect(master);
      updateFxGain();
      ambienceNoise=context.createBufferSource();ambienceNoise.buffer=noiseBuffer();ambienceNoise.loop=true;
      const tapeFilter=context.createBiquadFilter();tapeFilter.type='lowpass';tapeFilter.frequency.value=1550;
      const tapeGain=context.createGain();tapeGain.gain.value=.02;
      ambienceNoise.connect(tapeFilter);tapeFilter.connect(tapeGain);tapeGain.connect(musicBus);
      ambienceNoise.start();
      return true;
    } catch (_) {shortStatus('Seu navegador não conseguiu iniciar o áudio.');return false;}
  }
  function makeVoice(note,time,length=1.7,amount=.10) {
    const hz=midi(note);
    const tone=context.createOscillator(), warm=context.createOscillator(), lowpass=context.createBiquadFilter(),
      gain=context.createGain();
    tone.type='sine';tone.frequency.setValueAtTime(hz,time);
    warm.type='triangle';warm.frequency.setValueAtTime(hz*.998,time);
    lowpass.type='lowpass';lowpass.frequency.setValueAtTime(Math.min(2500,hz*4.5),time);
    lowpass.Q.value=.35;
    gain.gain.setValueAtTime(0,time);
    gain.gain.linearRampToValueAtTime(amount,time+.025);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001,amount*.22),time+.5);
    gain.gain.exponentialRampToValueAtTime(.0001,time+length);
    const partial=context.createGain();partial.gain.value=.15;
    tone.connect(lowpass);warm.connect(partial);partial.connect(lowpass);lowpass.connect(gain);gain.connect(musicBus);
    tone.start(time);warm.start(time);
    tone.stop(time+length+.03);warm.stop(time+length+.03);
    warm.onended=()=>{tone.disconnect();warm.disconnect();lowpass.disconnect();gain.disconnect();partial.disconnect();};
  }
  function drum(time, snare=false) {
    if (snare) {
      const noise=context.createBufferSource(),buffer=context.createBuffer(1,Math.ceil(context.sampleRate*.10),context.sampleRate),out=buffer.getChannelData(0);
      for(let i=0;i<out.length;i++)out[i]=(Math.random()*2-1)*.25;
      noise.buffer=buffer;
      const highpass=context.createBiquadFilter();highpass.type='highpass';highpass.frequency.value=800;
      const gain=context.createGain();gain.gain.setValueAtTime(.025,time);gain.gain.exponentialRampToValueAtTime(.0001,time+.09);
      noise.connect(highpass);highpass.connect(gain);gain.connect(musicBus);noise.start(time);noise.stop(time+.1);
      noise.onended=()=>{highpass.disconnect();gain.disconnect()};return;
    }
    const osc=context.createOscillator(),gain=context.createGain();osc.type='sine';
    osc.frequency.setValueAtTime(102,time);osc.frequency.exponentialRampToValueAtTime(48,time+.18);
    gain.gain.setValueAtTime(.14,time);gain.gain.exponentialRampToValueAtTime(.0001,time+.25);
    osc.connect(gain);gain.connect(musicBus);osc.start(time);osc.stop(time+.26);
    osc.onended=()=>gain.disconnect();
  }
  function step(time,stepNumber) {
    const eighth=stepNumber%8,bar=Math.floor(stepNumber/8)%8;
    if(eighth===0){
      for (const n of melodies[bar]) makeVoice(n,time,2.6,.046);
      makeVoice(basses[bar],time,2.1,.077);
      drum(time);
    }
    if(eighth===4)drum(time);
    if(eighth===2||eighth===6)drum(time,true);
    if(eighth===1||eighth===5)makeVoice(tones[(bar*2+(eighth===5?1:0))%tones.length],time,.65,.032);
    if(eighth===7&&bar%2===1)makeVoice(tones[(bar*2+3)%tones.length]-12,time,.85,.026);
  }
  function flushSequence() {
    if(!context || !shouldSound())return;
    while(nextStep < context.currentTime + .18) {
      step(nextStep,beatStep);
      nextStep+=halfBeat;
      beatStep=(beatStep+1)%64;
    }
  }
  // Independent, conservatively capped effects loudness; 100% is still subtle.
  function updateFxGain() {
    if(!context || !fxBus)return;
    const normalized=preferences.fxVolume/MAX_FX_VOLUME;
    const ceiling=.09;
    fxBus.gain.setTargetAtTime(ceiling*normalized*normalized,context.currentTime,.035);
  }
  const adjustGain=() => {
    if(!context||!musicBus)return;
    const target=shouldSound() ? preferences.volume/100*.55 : 0;
    const now=context.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setTargetAtTime(target,now,.15);
  };
  function synchronize() {
    if(!context){render();return;}
    if(shouldSound()){
      if(!sequenceTimer){nextStep=context.currentTime+.07;beatStep=0;sequenceTimer=window.setInterval(flushSequence,80);flushSequence();}
    }else if(sequenceTimer){window.clearInterval(sequenceTimer);sequenceTimer=0;}
    adjustGain();render();
  }
  async function engage() {
    if(!audioClass){shortStatus('Áudio não disponível neste navegador.');return false;}
    if(!createAudio())return false;
    try {await context.resume();engaged=true;synchronize();return true;}
    catch (_) {shortStatus('O navegador bloqueou o áudio. Toque novamente em ativar.');return false;}
  }
  function beep() {
    if(!preferences.fx || !context || context.state!=='running' || videoActive() || document.hidden)return;
    const start=context.currentTime+.01;
    const osc=context.createOscillator(),gain=context.createGain(),filter=context.createBiquadFilter();
    osc.type='sine';osc.frequency.setValueAtTime(490,start);osc.frequency.exponentialRampToValueAtTime(620,start+.082);
    filter.type='lowpass';filter.frequency.value=1150;
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.24,start+.014);
    gain.gain.exponentialRampToValueAtTime(.0001,start+.095);
    osc.connect(filter);filter.connect(gain);gain.connect(fxBus);osc.start(start);osc.stop(start+.105);
    osc.onended=()=>{filter.disconnect();gain.disconnect();};
  }
  trigger.addEventListener('click',() => {
    panel.hidden=!panel.hidden;trigger.setAttribute('aria-expanded',String(!panel.hidden));
    if(takeFocus())close.focus({preventScroll:true});else trigger.focus({preventScroll:true});
  });
  function closePanel(){panel.hidden=true;trigger.setAttribute('aria-expanded','false');}
  close.addEventListener('click',()=>{closePanel();trigger.focus({preventScroll:true});});
  document.addEventListener('pointerdown',event=>{if(!root.contains(event.target))closePanel();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&takeFocus()){event.stopPropagation();closePanel();trigger.focus({preventScroll:true});}});
  musicButton.addEventListener('click',async()=>{
    const previous=preferences.music;
    preferences.music=!previous;save();render();
    if(preferences.music){const ready=await engage();if(!ready){preferences.music=false;save();render();}}
    else synchronize();
  });
  fxButton.addEventListener('click',async()=>{
    preferences.fx=!preferences.fx;save();render();
    if(preferences.fx){if(await engage())beep();else{preferences.fx=false;save();render();}}
  });
  range.addEventListener('input',()=>{
    preferences.volume=clamp(Number(range.value),MAX_MUSIC_VOLUME,defaults.volume);
    save();adjustGain();render();
  });
  fxRange.addEventListener('input',()=>{
    preferences.fxVolume=clamp(Number(fxRange.value),MAX_FX_VOLUME,defaults.fxVolume);
    save();updateFxGain();render();
  });
  // Keep preferences synchronized if another tab of the same site edits them.
  window.addEventListener('storage',(event)=>{
    if(event.key!==KEY || !event.newValue)return;
    try {
      const stored=JSON.parse(event.newValue);
      if(!stored || typeof stored!=='object')return;
      preferences.music=stored.music===true;
      preferences.fx=stored.fx===true;
      preferences.volume=clamp(stored.volume,MAX_MUSIC_VOLUME,defaults.volume);
      preferences.fxVolume=clamp(stored.fxVolume,MAX_FX_VOLUME,defaults.fxVolume);
      updateFxGain();synchronize();render();
    } catch (_) {}
  });
  // Only high-intent clicks, never form typing or video-player controls.
  document.addEventListener('click',event=>{
    if(!preferences.fx||root.contains(event.target)||videoActive()||event.target.closest('form,#quick-quote-dialog'))return;
    const target=event.target.closest('.nav-pack,.nav-btn,.btn-primary,.filter,[data-filter],[data-open-quote]');
    if(target && !target.closest('.vip-player'))beep();
  });
  // Suspend ambience before the custom player becomes visible; resume softly afterwards.
  document.addEventListener('play',synchronize,true);
  document.addEventListener('pause',synchronize,true);
  document.addEventListener('ended',synchronize,true);
  const modal=document.getElementById('video-modal');
  if(modal && window.MutationObserver)new MutationObserver(synchronize).observe(modal,{attributes:true,attributeFilter:['aria-hidden']});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){synchronize();if(context?.state==='running')context.suspend().catch(()=>{});}
    else if(context && engaged && (preferences.music||preferences.fx)) context.resume().then(synchronize).catch(()=>{});
  });
  // The saved preference is respected, but audio is never started at page load.
  // A returning visitor who opted in can resume it on their next interaction.
  function restoreWithGesture(){
    document.removeEventListener('pointerdown',restoreWithGesture,true);
    document.removeEventListener('keydown',restoreWithGesture,true);
    if((preferences.music||preferences.fx) && !engaged) void engage();
  }
  document.addEventListener('pointerdown',restoreWithGesture,true);
  document.addEventListener('keydown',restoreWithGesture,true);
  if(!audioClass){musicButton.disabled=true;fxButton.disabled=true;shortStatus('Seu navegador não suporta áudio interativo.');}
  render();
  window.GustavoAmbience={pause:synchronize,getState:()=>({music:preferences.music,fx:preferences.fx,volume:preferences.volume,fxVolume:preferences.fxVolume,active:shouldSound()})};
})();
