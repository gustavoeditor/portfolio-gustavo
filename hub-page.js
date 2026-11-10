// Creative Hub · interações da página (checkout, carregamento, galeria 3D, detalhe e textos que embaralham).
(()=>{'use strict';
 const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const H=window.HUB=window.HUB||{phase:0,burst:0,tint:[.6,.4,1],tintAmt:0};
 // Checkout: compra liberada por padrão; a API só ajusta preço/link ou pausa as vendas.
 const ALLOWED='pay.cakto.com.br',button=$('#checkout'),status=$('#status'),price=$('#price'),badge=$('#sale-badge');
 const pause=(msg='As vendas estão pausadas no momento. Nenhuma cobrança será realizada.')=>{
  button.removeAttribute('href');button.setAttribute('aria-disabled','true');button.textContent='VENDAS INDISPONÍVEIS';
  badge.textContent='PAUSADO';badge.classList.remove('is-live');status.textContent=msg;
 };
 // A URL está ausente até a API confirmar disponibilidade, preço e destino seguro.
 fetch('/api/store/checkout',{credentials:'same-origin',cache:'no-store'})
  .then(r=>r.ok?r.json():Promise.reject(new Error('checkout indisponível')))
  .then(d=>{
   if(!d||d.available!==true)return pause();
   let u;try{u=new URL(d.checkoutUrl);}catch(_){return pause();}
   if(u.protocol!=='https:'||u.hostname!==ALLOWED||u.username||u.password||u.port||u.hash||u.pathname.length<3||u.searchParams.has('email')||u.searchParams.has('prefilled_email'))return pause();
   if(typeof d.priceLabel!=='string'||d.priceLabel.slice(0,2)!=='R$'||d.priceLabel.length>40)return pause();
   price.textContent=d.priceLabel;button.href=u.href;button.removeAttribute('aria-disabled');
   button.innerHTML='COMPRAR AGORA <span aria-hidden="true">↗</span>';
   badge.textContent='DISPONÍVEL';badge.classList.add('is-live');
   status.textContent='Pagamento processado pela Cakto em página externa. Confira as informações da compra antes de concluir.';
  })
  .catch(()=>pause('Não foi possível confirmar a disponibilidade da compra agora. Tente novamente mais tarde.'));
 // Versões das ferramentas a partir dos feeds do Hub.
 $$('.tool-card[data-app]').forEach(c=>{const slot=c.querySelector('[data-version]');if(!slot)return;fetch('/updates/'+c.dataset.app+'/hub-manifest.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(f=>{if(f&&f.product===c.dataset.app&&/^\d+\.\d+\.\d+$/.test(f.latest||''))slot.textContent='v'+f.latest;}).catch(()=>{});});
 // Texto que embaralha.
 const CH='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*/<>[]=+-_';
 function scramble(el,dur=700){if(reduce||!el)return;const target=el.dataset.text0||(el.dataset.text0=el.textContent);const start=performance.now();cancelAnimationFrame(el._r);
  const step=now=>{const p=Math.min(1,(now-start)/dur);let o='';for(let i=0;i<target.length;i++){const c=target[i];o+=(c===' '||i<p*target.length)?c:CH[(Math.random()*CH.length)|0];}el.textContent=o;if(p<1)el._r=requestAnimationFrame(step);};el._r=requestAnimationFrame(step);}
 $$('[data-scramble]').forEach(a=>{const n=[...a.childNodes].find(x=>x.nodeType===3&&x.textContent.trim());if(!n)return;const s=document.createElement('span');s.textContent=n.textContent;n.replaceWith(s);a.addEventListener('pointerenter',()=>scramble(s,420));});
 const loops=$$('[data-loop]');
 if(!reduce)setInterval(()=>scramble(loops[(Math.random()*loops.length)|0],900),4500);
 // Carregamento: anel com contagem; no fim, explosão de luz.
 const ld=$('#loader'),ldp=$('#ldp'),t0=performance.now();let seen=false;try{seen=!!sessionStorage.getItem('hubSeen');}catch(_){}
 const dur=seen||reduce?700:2300;
 const tl=now=>{const p=Math.min(100,Math.round(Math.pow((now-t0)/dur,.8)*100));ldp.textContent=p+'%';if(p<100)return requestAnimationFrame(tl);
  ld.classList.add('done');document.body.classList.remove('locked');try{sessionStorage.setItem('hubSeen','1');}catch(_){}H.burst=.001;loops.forEach((el,i)=>setTimeout(()=>scramble(el,1400),250+i*250));};
 requestAnimationFrame(tl);
 // Entrada das seções.
 const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');e.target.querySelectorAll('[data-scramble-in]').forEach(x=>scramble(x,1100));io.unobserve(e.target);}}),{threshold:.12});
 $$('[data-in]').forEach(el=>io.observe(el));
 // Galeria: placas de vidro passam em 3D conforme a rolagem.
 const gal=$('.gal'),track=$('#track'),slabs=[...track.children],dots=$$('#gal-dots i'),det=$('#detail'),buy=$('#produto');
 let shot=false,act=-1;
 function layout(p){
  const n=slabs.length,pos=p*(n-1),mob=innerWidth<900;
  slabs.forEach((c,i)=>{const o=i-pos,a=Math.abs(o);
   c.style.transform=`translate3d(${o*(mob?70:44)}vw,${Math.sin(o*1.2)*4}vh,${-a*(mob?280:360)}px) rotateY(${-o*(mob?16:28)}deg) rotateX(${o*2.5}deg) rotateZ(${o*-1.5}deg)`;
   c.style.opacity=String(Math.max(0,1-a*.42));c.style.zIndex=String(100-Math.round(a*10));c.classList.toggle('is-active',a<.5);});
  const k=Math.round(pos);dots.forEach((d,i)=>d.classList.toggle('on',i===k));
  if(k!==act){act=k;const t=slabs[k]&&slabs[k].querySelector('h3');if(t&&H.phase)scramble(t,600);}
  if(!det.classList.contains('open')){if(H.phase&&slabs[k]){try{H.tint=JSON.parse(slabs[k].dataset.tint);}catch(_){}H.tintAmt=.14;}else H.tintAmt=0;}
 }
 function onScroll(){
  const y=scrollY,vh=innerHeight;document.body.classList.toggle('after-hero',y>vh*.4);
  if(!shot&&y>vh*.5){shot=true;H.burst=.001;}if(y<vh*.25)shot=false;
  const g=gal.getBoundingClientRect(),total=g.height-vh,p=Math.max(0,Math.min(1,-g.top/total));
  H.phase=(g.top<vh*.55&&g.bottom>vh*.45)?1:0;
  const b=buy.getBoundingClientRect();document.body.classList.toggle('in-buy',b.top<vh*.7);
  layout(p);
 }
 const goTo=i=>{const top=gal.offsetTop+(gal.offsetHeight-innerHeight)*(i/(slabs.length-1))+2;scrollTo({top,behavior:reduce?'auto':'smooth'});};
 $$('[data-go]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();goTo(+a.dataset.go);}));
 // Abrir uma placa: o "mundo" muda para a cor da ferramenta.
 let lastF=null,openAt=0;
 function openD(c){
  lastF=c;const name=c.querySelector('h3').dataset.text0||c.querySelector('h3').textContent;
  $('#d-card').style.setProperty('--m',c.style.getPropertyValue('--m'));
  const h=$('#d-title');h.textContent=name;h.dataset.text=name;delete h.dataset.text0;
  $('#d-k').textContent=c.dataset.k;$('#d-desc').textContent=c.dataset.desc;
  $('#d-feat').replaceChildren(...c.dataset.feat.split('|').map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
  const more=c.querySelector('.tool-link');$('#d-more').href=more.getAttribute('href');$('#d-more').textContent=more.textContent;
  try{H.tint=JSON.parse(c.dataset.tint);}catch(_){}H.tintAmt=.7;H.burst=.001;
  det.removeAttribute('inert');det.removeAttribute('aria-hidden');
  det.classList.add('open');document.body.classList.add('locked','detail-open');openAt=performance.now();scramble(h,900);
  setTimeout(()=>{if(det.classList.contains('open'))$('#d-close').focus();},250);
 }
 function closeD(){if(!det.classList.contains('open'))return;det.classList.remove('open');document.body.classList.remove('locked','detail-open');H.tintAmt=H.phase?.14:0;if(lastF)lastF.focus({preventScroll:true});det.setAttribute('inert','');det.setAttribute('aria-hidden','true');}
 slabs.forEach((c,i)=>{
  c.addEventListener('pointermove',e=>{if(!c.classList.contains('is-active'))return;const r=c.getBoundingClientRect();c.querySelector('.media').style.transform=`translate(${((e.clientX-r.left)/r.width-.5)*-18}px,${((e.clientY-r.top)/r.height-.5)*-14}px)`;});
  c.addEventListener('pointerleave',()=>{c.querySelector('.media').style.transform='';});
  const go=e=>{if(e&&e.target&&e.target.closest&&e.target.closest('a'))return;if(c.classList.contains('is-active'))openD(c);else goTo(i);};
  c.addEventListener('click',go);c.addEventListener('keydown',e=>{if(e.target!==c)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}});
 });
 $('#d-close').addEventListener('click',closeD);$('#d-buy').addEventListener('click',closeD);
 addEventListener('keydown',e=>{
  if(!det.classList.contains('open'))return;
  if(e.key==='Escape'){e.preventDefault();closeD();return;}
  if(e.key!=='Tab')return;
  const focusable=[...det.querySelectorAll('a[href],button:not([disabled])')];
  if(!focusable.length){e.preventDefault();return;}
  const first=focusable[0],last=focusable[focusable.length-1];
  if(e.shiftKey&&(document.activeElement===first||!det.contains(document.activeElement))){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&(document.activeElement===last||!det.contains(document.activeElement))){e.preventDefault();first.focus();}
 });
 addEventListener('wheel',e=>{if(det.classList.contains('open')&&performance.now()-openAt>700&&Math.abs(e.deltaY)>20)closeD();},{passive:true});
 let ty=0;addEventListener('touchstart',e=>{ty=e.touches[0].clientY;},{passive:true});addEventListener('touchmove',e=>{if(det.classList.contains('open')&&Math.abs(e.touches[0].clientY-ty)>60)closeD();},{passive:true});
 // Novidades.
 const news=['CREATIVE TEXT 1.0 · NOVO','CREATIVE TOOLS 1.8.6','CREATIVE CUT · EM BREVE'];let k=0;const tick=$('#tick');
 $$('.ticker button').forEach((b,i)=>b.addEventListener('click',()=>{k=(k+(i?1:news.length-1))%news.length;tick.textContent=news[k];delete tick.dataset.text0;scramble(tick,500);}));
 addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll);onScroll();
})();
