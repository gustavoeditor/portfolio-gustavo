(() => {
'use strict';
const byId=(id)=>document.getElementById(id);
const track=(name,source)=>{try{window.va?.('event',{name,data:{source:String(source||'site').slice(0,60)}});}catch(_){}};
const quote=byId('quote-form');
const type=byId('quote-service');

document.querySelectorAll('[data-quote-type]').forEach(link=>{
 link.addEventListener('click',()=>{
   const category=link.dataset.quoteType;
   if(type && [...type.options].some(option=>option.value===category))type.value=category;
   track('interest_service',category);
 });
});
document.querySelectorAll('.offer-examples').forEach(button=>{
 button.addEventListener('click',()=>{
   const category=button.dataset.filterTo;
   const filter=document.querySelector('#project-filters [data-filter="'+category+'"]');
   if(filter)filter.click();
   byId('trabalhos')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});
   track('portfolio_filter',category);
 });
});
document.querySelectorAll('.case-watch').forEach(button=>{
 button.addEventListener('click',()=>{
   const src=button.dataset.projectSrc;
   const card=[...document.querySelectorAll('#project-grid .project-card')].find(el=>el.dataset.source===src);
   if(card){
     if(card.hidden)document.querySelector('#project-filters [data-filter="all"]')?.click();
     card.scrollIntoView({behavior:'smooth',block:'center'});
     const play=card.querySelector('.project-play');
     if(play && !play.disabled)play.click();
   }else{
     byId('trabalhos')?.scrollIntoView({behavior:'smooth',block:'start'});
   }
   track('case_study_watch',src.split('/').pop().replace(/[^a-z0-9_-]/gi,'').slice(0,40));
 });
});
// Measure anonymous interest in real creator collaborations (no user identifiers).
document.addEventListener('click',event=>{
 const link=event.target.closest?.('.hero-proof, .channel-card');
 if(!link)return;
 track('client_channel_visit',link.matches('.hero-proof')?'hero':'collaborations');
});
document.querySelectorAll('a[href^="https://wa.me/"]').forEach(link=>{
 link.addEventListener('click',()=>{
   const source=link.classList.contains('contact-float')?'floating':link.closest('.hero')?'hero':'direct';
   track('contact_whatsapp',source);
 });
});
if(quote){
 quote.addEventListener('submit',(event)=>{
   event.preventDefault();
   if(!quote.reportValidity())return;
   const values=new FormData(quote);
   const serviceNames={youtube:'Edição para YouTube',cinematics:'Cinematics / Gaming',motion:'Motion design / VFX',outros:'Outro tipo de projeto',pack:'Pack de edição (lista de interesse)'};
   const service=String(values.get('service')||'');
   const description=String(values.get('details')||'').trim().slice(0,1100);
   if(!serviceNames[service] || description.length<10){
     byId('quote-status').textContent='Escolha o serviço e descreva sua ideia em pelo menos 10 caracteres.';
     return;
   }
   const isPack=service==='pack';
   const lines=[isPack
     ?'Olá, Gustavo! Vi seu portfólio e tenho interesse no futuro Pack de edição.'
     :'Olá, Gustavo! Vi seu portfólio e gostaria de solicitar um orçamento.'];
   const name=String(values.get('clientName')||'').trim().slice(0,60);
   const duration=String(values.get('duration')||'').trim();
   const deadline=String(values.get('deadline')||'').trim();
   const reference=String(values.get('reference')||'').trim().slice(0,350);
   if(name)lines.push('Nome: '+name);
   lines.push((isPack?'Interesse: ':'Tipo de vídeo: ')+serviceNames[service]);
   if(duration)lines.push('Duração prevista: '+duration);
   if(deadline)lines.push('Prazo desejado: '+deadline);
   lines.push((isPack?'Mensagem: ':'Ideia: ')+description);
   if(reference && /^https?:\/\//i.test(reference))lines.push('Referência: '+reference);
   lines.push(isPack?'Gostaria de saber quando o produto estiver disponível.':'Podemos conversar sobre o projeto?');
   const url='https://wa.me/5537988445372?text='+encodeURIComponent(lines.join('\n'));
   track('lead_briefing',service);
   const status=byId('quote-status');
   status.textContent='Mensagem pronta. Abrindo o WhatsApp para você conferir e enviar.';
   const popup=window.open(url,'_blank');
   if(popup){try{popup.opener=null;}catch(_){}}
   else window.location.assign(url);
 });
}
})();