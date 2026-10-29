#!/usr/bin/env node
/* Builds search metadata for the portfolio videos:
   - VideoObject JSON-LD (ItemList) embedded in index.html between the seo-videos markers
   - seo-originals.json: original videos + pages for the live sitemap (lib/seo-sitemap.js,
     served at /sitemap.xml), which adds panel uploads and drops videos taken off the site
   Sources: the static project list in index.html, durations from portfolio-quality.js,
   first-commit dates of each video, and the public managed-projects catalogue.
   Run after publishing new videos: npm run seo */
'use strict';
const fs=require('fs'),path=require('path'),{execSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const SITE='https://portfolio-gustavo-chi.vercel.app';
const read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n');
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const iso=seconds=>{const s=Math.max(1,Math.round(seconds));return 'PT'+(s>=60?Math.floor(s/60)+'M':'')+(s%60?s%60+'S':'');};
const reviews=require(path.join(root,'portfolio-quality.js')).reviews;

function firstCommitDate(file){
  try{const out=execSync(`git log --diff-filter=A --format=%aI -- "${file}"`,{cwd:root}).toString().trim().split('\n').pop();return out||null;}catch(_){return null;}
}
function staticProjects(){
  const html=read('index.html');
  const block=html.match(/const projects=\[\n([\s\S]*?)\n\];/);
  if(!block)throw new Error('Lista de projetos não encontrada em index.html');
  return [...block[1].matchAll(/\['((?:[^'\\]|\\.)*)','([a-z0-9]+)','([a-z0-9-]+)','((?:[^'\\]|\\.)*)'\]/g)].map(m=>({title:m[1],category:m[2],slug:m[3],description:m[4]}));
}
async function managedProjects(){
  try{
    const res=await fetch(SITE+'/api/managed-projects',{signal:AbortSignal.timeout(15000)});
    if(!res.ok)return [];
    const {projects=[],hidden:off=[]}=await res.json();
    takenDown=new Set(off);
    const hidden=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()==='keydrop awp product cinematic';
    return projects.filter(p=>p&&p.title&&/^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//.test(p.src)&&!hidden(p.title)&&!takenDown.has(p.src));
  }catch(_){console.warn('Catálogo gerenciado indisponível; usando apenas os vídeos do repositório.');return [];}
}
let takenDown=new Set();
const CATEGORY={cs2:'Edição de CS2',cinematics:'Cinematic 3D',youtube:'Edição para YouTube',motion:'Motion design',outros:'Projeto especial'};

(async()=>{
  const videos=[],originalVideos=[];
  const uploads=await managedProjects(); // also loads the taken-down list
  for(const p of staticProjects()){
    const r=reviews[p.slug];if(!r)continue;
    const date=firstCommitDate(`videos/${p.slug}.mp4`);if(!date)continue;
    const video={key:`videos/${p.slug}.mp4`,name:p.title,description:`${p.description} ${CATEGORY[p.category]||''} por Gustavo, editor de vídeo.`.trim(),
      thumbnail:`${SITE}/capas/${p.slug}.webp`,content:`${SITE}/videos/${p.slug}.mp4`,date,duration:r.meta.duration};
    originalVideos.push(video);
    if(!takenDown.has(video.key))videos.push(video);
  }
  for(const p of uploads){
    const r=reviews[p.src];
    videos.push({name:p.title,description:`${p.description||p.title}. ${CATEGORY[p.category]||''} por Gustavo, editor de vídeo.`.replace(/\.\./g,'.').trim(),
      thumbnail:p.poster,content:p.src,date:p.publishedAt||new Date().toISOString(),duration:r?r.meta.duration:null});
  }
  const ld={'@context':'https://schema.org','@type':'ItemList','name':'Portfólio de vídeos de Gustavo, editor de vídeo','itemListElement':videos.map((v,i)=>({
    '@type':'ListItem',position:i+1,item:{'@type':'VideoObject',name:v.name,description:v.description,thumbnailUrl:[v.thumbnail],uploadDate:v.date,contentUrl:v.content,
      ...(v.duration?{duration:iso(v.duration)}:{}),inLanguage:'pt-BR',creator:{'@id':SITE+'/#editor'},isPartOf:{'@id':SITE+'/#homepage'}}}))};

  const crlf=fs.readFileSync(path.join(root,'index.html'),'utf8').includes('\r\n');let html=read('index.html');
  const block=`<!-- seo-videos:start (gerado por scripts/build-seo.cjs) -->\n<script type="application/ld+json" id="seo-videos">\n${JSON.stringify(ld)}\n</script>\n<!-- seo-videos:end -->`;
  if(/<!-- seo-videos:start[\s\S]*?seo-videos:end -->/.test(html))html=html.replace(/<!-- seo-videos:start[\s\S]*?seo-videos:end -->/,()=>block);
  else html=html.replace('\n</head>',()=>'\n'+block+'\n</head>');
  if(crlf)html=html.replace(/\n/g,'\r\n');
  fs.writeFileSync(path.join(root,'index.html'),html);

  const pages=[['/',null],['/loja.html','2026-10-19'],['/atualizacoes.html','2026-10-19'],['/creative-cut.html','2026-10-21']];
  fs.writeFileSync(path.join(root,'seo-originals.json'),JSON.stringify({generatedAt:new Date().toISOString(),pages,videos:originalVideos},null,1)+'\n');
  console.log(`SEO: ${videos.length} vídeos no JSON-LD; ${originalVideos.length} originais em seo-originals.json (sitemap ao vivo em /sitemap.xml).`);
})().catch(e=>{console.error(e.message);process.exit(1);});
