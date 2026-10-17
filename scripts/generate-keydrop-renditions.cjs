#!/usr/bin/env node
// Converts the original managed-project upload into two verified, static mobile MP4s.
// Run in GitHub Actions; never saves secrets or private uploads in the repository.
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {Readable}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const {Transform}=require('node:stream');
const SITE='https://portfolio-gustavo-chi.vercel.app';
const MAX_SOURCE_BYTES=650*1024*1024;
const canonical=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function safePublicBlob(raw){
 try{
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash)return false;
  return /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i.test(u.hostname)&&/\.mp4$/i.test(u.pathname);
 }catch{return false;}
}
async function getJSON(url){
 const r=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{accept:'application/json','user-agent':'GustavoPortfolioRenditionBuilder/1.0'}});
 if(!r.ok)throw Error('Catálogo HTTP '+r.status);
 return r.json();
}
function run(bin,args){
 const r=spawnSync(bin,args,{stdio:'inherit',timeout:1000*60*17});
 if(r.error||r.status!==0)throw Error('Falha em '+bin+': '+(r.error?.message||'exit '+r.status));
}
function probe(file){
 const p=spawnSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','json',file],{encoding:'utf8',timeout:40000});
 if(p.status!==0)throw Error('ffprobe falhou para '+file);
 const x=JSON.parse(p.stdout||'{}').streams?.[0];
 if(!x||!x.width||!x.height)throw Error('Vídeo sem dimensões verificáveis');
 return x;
}
function digest(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
async function main(){
 const catalog=await getJSON(SITE+'/api/managed-projects');
 if(!Array.isArray(catalog.projects))throw Error('API não retornou projetos publicados');
 const video=catalog.projects.find(p=>canonical(p.title)==='abertura keydrop treino');
 if(!video)throw Error('Abertura Keydrop Treino não está publicado no catálogo de uploads do site.');
 if(!safePublicBlob(video.src))throw Error('O original deve ser URL válida de vídeo MP4 do Vercel Blob público.');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'keydrop-renditions-'));
 try{
  const input=path.join(dir,'original.mp4'),url=new URL(video.src);
  const response=await fetch(url,{signal:AbortSignal.timeout(750000),headers:{'user-agent':'GustavoPortfolioRenditionBuilder/1.0'}});
  if(!response.ok||!response.body)throw Error('Falha ao baixar o MP4 original ('+response.status+')');
  let bytes=0;
  await pipeline(Readable.fromWeb(response.body),new Transform({
   transform(chunk,_,next){bytes+=chunk.length;if(bytes>MAX_SOURCE_BYTES)next(new Error('Original acima do limite técnico de 650 MB'));else next(null,chunk);}
  }),fs.createWriteStream(input));
  if(bytes<2048)throw Error('Arquivo original vazio/inválido');
  const shape=probe(input);
  if(shape.height<480)throw Error('Arquivo já tem menos de 480px de altura; reavaliar upscaling.');
  const tasks=[
   {height:360,relative:'videos-360/abertura-keydrop-treino.mp4',crf:'27',max:'650k',buf:'1300k',audio:'64k'},
   {height:480,relative:'videos-480/abertura-keydrop-treino.mp4',crf:'25',max:'1150k',buf:'2300k',audio:'96k'}
  ];
  const output={version:1,title:'Abertura Keydrop Treino',source:video.src,sourceBytes:bytes,sourceSHA256:digest(input),generatedAt:new Date().toISOString(),variants:{}};
  for(const task of tasks){
   const dest=path.join(process.cwd(),task.relative);
   fs.mkdirSync(path.dirname(dest),{recursive:true});
   run('ffmpeg',['-hide_banner','-loglevel','error','-y','-nostdin','-i',input,
     '-map','0:v:0','-map','0:a:0?','-vf','fps=30,scale=-2:'+task.height+':flags=bicubic',
     '-c:v','libx264','-preset','veryfast','-crf',task.crf,'-maxrate',task.max,'-bufsize',task.buf,
     '-g','60','-keyint_min','30','-pix_fmt','yuv420p','-profile:v','main',
     '-c:a','aac','-b:a',task.audio,'-ac','2','-movflags','+faststart',dest]);
   const size=fs.statSync(dest).size;
   if(size<1024||size>95*1024*1024)throw Error('Arquivo '+task.height+'p fora do limite do GitHub ('+size+' bytes)');
   const actual=probe(dest);
   if(actual.height!==task.height)throw Error('Altura inesperada: '+actual.height+' (esperado '+task.height+')');
   output.variants[String(task.height)]={url:'/'+task.relative,bytes:size,width:actual.width,height:actual.height,sha256:digest(dest)};
   console.log('Gerado '+task.height+'p, '+(size/1048576).toFixed(2)+' MiB');
  }
  const manifest='video-renditions/abertura-keydrop-treino.json';
  fs.mkdirSync(path.dirname(manifest),{recursive:true});
  fs.writeFileSync(manifest,JSON.stringify(output,null,2)+'\n');
  console.log('Transcodificação validada. Original: '+(bytes/1048576).toFixed(2)+' MiB. Renditions: 360p e 480p.');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
if(require.main===module){main().catch(e=>{console.error('Não foi possível gerar as versões móveis:',e.message);process.exitCode=1;});}
module.exports={canonical,safePublicBlob};
