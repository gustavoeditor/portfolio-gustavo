/* GUSTAVO SENTINEL / Browser failure signals.
   Never collect typed text, URLs, cookies, IP, stack traces or personal details. */
(()=>{
 'use strict';
 const endpoint='/api/sentinel-event';
 let disabled=false,remaining=5;
 const reported=new Map();
 const validComponents=new Set(['hero','feature','gallery','player','page','catalog','navigation','contact']);
 const category=element=>{
  if(element?.closest?.('#video-modal,.vip-player'))return 'player';
  if(element?.closest?.('.hero-side'))return 'hero';
  if(element?.closest?.('.feature'))return 'feature';
  if(element?.closest?.('.thumb,.portfolio-grid,.project-card'))return 'gallery';
  if(element?.closest?.('#quick-quote-dialog,.quote,.contact'))return 'contact';
  return 'page';
 };
 function send(type,component){
  if(disabled||remaining<=0||document.hidden)return;
  if(!validComponents.has(component))return;
  const key=type+':'+component,now=Date.now();
  if(now-(reported.get(key)||0)<15*60*1000)return;
  reported.set(key,now);remaining--;
  try{
   fetch(endpoint,{method:'POST',credentials:'same-origin',cache:'no-store',keepalive:true,
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({type,component})
   }).then(response=>{if(response.status===503||response.status===403)disabled=true;}).catch(()=>{disabled=true;});
  }catch(_){disabled=true;}
 }
 // An image's first failed origin is not a broken experience: record only exhausted fallbacks.
 const covers=new WeakSet();
 function checkCover(img){
  if(covers.has(img)||!img.classList?.contains('cover-failed'))return;
  covers.add(img);send('cover_failure',category(img));
 }
 document.querySelectorAll('img.cover-failed').forEach(checkCover);
 const observer=new MutationObserver(records=>{
  for(const record of records)if(record.target?.tagName==='IMG')checkCover(record.target);
 });
 observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
 window.addEventListener('error',event=>{
  if(event.target===window){send('runtime_error','page');return;}
  const node=event.target;
  if(node?.tagName==='SCRIPT'||node?.tagName==='LINK')send('asset_error','page');
  if(node?.tagName==='VIDEO')send('video_error','player');
  if(node?.tagName==='IMG'&&!node.hasAttribute('data-cover-source'))send('asset_error',category(node));
 },true);
 window.addEventListener('unhandledrejection',()=>send('runtime_error','page'));
 const timers=new WeakMap();
 function cancel(video){
  const id=timers.get(video);
  if(id){clearTimeout(id);timers.delete(video);}
 }
 document.addEventListener('waiting',event=>{
  const v=event.target;
  if(v?.tagName!=='VIDEO'||v.paused||v.muted||timers.has(v))return;
  timers.set(v,setTimeout(()=>{
   timers.delete(v);
   if(!v.paused&&!v.ended)send('video_stall','player');
  },10000));
 },true);
 for(const type of ['playing','pause','ended','seeking','error']){
  document.addEventListener(type,event=>{if(event.target?.tagName==='VIDEO')cancel(event.target);},true);
 }
 // Failure recovery stays local: established fallback posters and media quality remain unchanged.
 window.GustavoSentinel={version:'1.0',localChecks:true,hasPersistentEvents:()=>!disabled};
})();
