(() => {
'use strict';
const add=(tag,className,text)=>{
 const node=document.createElement(tag);
 if(className)node.className=className;
 if(text!==undefined)node.textContent=String(text);
 return node;
};
const safeLocalImage=(raw)=>{
 if(typeof raw!=='string'||!/^(\/)?comparacoes\/[a-z0-9_./-]+\.(jpg|jpeg|png|webp)$/i.test(raw)||raw.includes('..'))return '';
 return '/'+raw.replace(/^\//,'');
};
const load=async url=>{
 try{
  const response=await fetch(url,{cache:'no-cache'});
  if(!response.ok)return [];
  const data=await response.json();
  return Array.isArray(data)?data.slice(0,12):[];
 }catch(_){return [];}
};
async function showTestimonials(){
 const section=document.getElementById('depoimentos');
 const grid=document.getElementById('reviews-grid');
 if(!section||!grid)return;
 const entries=(await load('/depoimentos.json')).filter(item=>item&&typeof item==='object'&&
  typeof item.quote==='string'&&item.quote.trim().length>=15&&
  typeof item.name==='string'&&item.name.trim().length>=2);
 if(!entries.length)return;
 const fragment=document.createDocumentFragment();
 entries.forEach(item=>{
  const card=add('article','review-card');
  const quote=add('blockquote','',item.quote.trim().slice(0,540));
  const cite=add('cite','',item.name.trim().slice(0,90));
  card.append(quote,cite);
  if(item.role)card.append(add('div','review-role',String(item.role).trim().slice(0,100)));
  if(item.link){
   try{
    const url=new URL(item.link);
    if(url.protocol==='https:'){
     const a=add('a','','Ver referência ↗');
     a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';
     card.append(a);
    }
   }catch(_){}
  }
  fragment.append(card);
 });
 grid.replaceChildren(fragment);
 section.hidden=false;
}
async function showComparisons(){
 const section=document.getElementById('comparacoes');
 const grid=document.getElementById('compare-list');
 if(!section||!grid)return;
 const entries=(await load('/comparacoes.json')).filter(item=>item&&typeof item==='object'&&safeLocalImage(item.original)&&safeLocalImage(item.final));
 if(!entries.length)return;
 const fragment=document.createDocumentFragment();
 entries.forEach(item=>{
  const card=add('article','compare-card');
  const media=add('div','compare-media');
  const before=add('img');
  before.src=safeLocalImage(item.original);
  before.alt='Material original de '+String(item.title||'um projeto');
  before.loading='lazy';before.decoding='async';
  const after=add('img','compare-after');
  after.src=safeLocalImage(item.final);
  after.alt='Resultado final editado de '+String(item.title||'um projeto');
  after.loading='lazy';after.decoding='async';
  const divider=add('div','compare-divider');
  divider.setAttribute('aria-hidden','true');
  const labels=add('div','compare-badges');
  labels.append(add('span','','DEPOIS'),add('span','','ANTES'));
  media.append(before,after,divider,labels);
  const id='compare-'+Math.random().toString(36).slice(2,9);
  const label=add('label','','Arraste para comparar o original e a edição');
  label.htmlFor=id;
  const input=add('input');
  input.id=id;input.type='range';input.min='0';input.max='100';input.value='50';
  input.setAttribute('aria-label','Comparar antes e depois de '+String(item.title||'projeto'));
  input.addEventListener('input',()=>media.style.setProperty('--compare-progress',input.value+'%'));
  card.append(media,label,input,add('h3','',String(item.title||'Projeto').slice(0,100)));
  if(item.description)card.append(add('p','',String(item.description).slice(0,260)));
  fragment.append(card);
 });
 grid.replaceChildren(fragment);
 section.hidden=false;
}
showTestimonials();
showComparisons();
})();