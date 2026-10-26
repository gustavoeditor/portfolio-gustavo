/* SENTINEL: telemetry only after an explicit, per-tab permission. */
(()=>{'use strict';
 if(navigator.globalPrivacyControl===true||navigator.doNotTrack==='1'||window.doNotTrack==='1')return;
 const key='gustavo-sentinel-consent-v1',endpoint='/api/sentinel-event';
 let permission=null;
 try{permission=sessionStorage.getItem(key);}catch(_){}
 if(permission==='no')return;
 const start=()=>{
  if(document.getElementById('sentinel-script'))return;
  const script=document.createElement('script');script.id='sentinel-script';script.src='/sentinel-client.js?v=3';script.defer=true;
  document.head.appendChild(script);
 };
 const prompt=()=>{
  const show=()=>{
   if(document.getElementById('sentinel-consent-panel'))return;
   const style=document.createElement('style');style.id='sentinel-consent-styles';
   style.textContent='#sentinel-consent-panel{position:fixed;bottom:16px;left:16px;z-index:900;width:min(400px,calc(100vw - 32px));padding:16px;border:1px solid #8d70b3;border-radius:12px;background:#171222;color:#eee9f9;box-shadow:0 15px 50px #000a;font:12px/1.6 system-ui,sans-serif}#sentinel-consent-panel p{margin:0 0 10px;color:#ded2ed}#sentinel-consent-panel .sentinel-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap}#sentinel-consent-panel button{cursor:pointer;border-radius:7px;padding:8px 11px;background:#282039;border:1px solid #80699b;color:#f5f0fb;font:700 12px system-ui,sans-serif}#sentinel-consent-panel button:first-child{background:#c8b3ff;color:#20142c}#sentinel-consent-panel a{color:#d5bfff}';
   document.head.appendChild(style);
   const panel=document.createElement('aside');panel.id='sentinel-consent-panel';panel.setAttribute('aria-label','Permissão para diagnósticos anônimos');
   const note=document.createElement('p');note.textContent='Permite registrar contagens anônimas de visitas, cliques e erros técnicos? Nenhum texto digitado ou dado pessoal é enviado ao painel.';
   const actions=document.createElement('div');actions.className='sentinel-actions';
   const allow=document.createElement('button');allow.type='button';allow.textContent='Permitir';
   const refuse=document.createElement('button');refuse.type='button';refuse.textContent='Agora não';
   const policy=document.createElement('a');policy.href='/privacidade.html';policy.textContent='Privacidade';
   allow.addEventListener('click',()=>{
    try{sessionStorage.setItem(key,'yes');}catch(_){note.textContent='Seu navegador bloqueou a preferência. A coleta continuará desligada.';return;}
    panel.remove();style.remove();start();
   });
   refuse.addEventListener('click',()=>{try{sessionStorage.setItem(key,'no');}catch(_){}panel.remove();style.remove();});
   actions.append(allow,refuse,policy);panel.append(note,actions);document.body.appendChild(panel);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();
 };
 // A capability GET is not a telemetry event; no metrics are sent before consent.
 fetch(endpoint,{method:'GET',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(5000)})
  .then(r=>r.ok?r.json():{enabled:false})
  .then(data=>{if(data?.enabled!==true)return;if(permission==='yes')start();else prompt();})
  .catch(()=>{});
})();
