'use strict';
// Dry-run inventory for a future Cloudflare R2 migration. No uploads, writes,
// token reads, network calls, or changes to the published portfolio.
// Usage: node scripts/plan-hybrid-media.cjs [--json]
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'projetos.json'),'utf8'));
if(!Array.isArray(catalog))throw Error('Catálogo inválido');
const rows=[];
for(const project of catalog){
 if(typeof project?.title!=='string')throw Error('Projeto sem título');
 for(const [kind,src] of [['video',project.src],['thumbnail',project.poster]]){
  if(typeof src!=='string'||!src)throw Error('Arquivo de mídia ausente');
  const asset=src.replace(/\\/g,'/');
  if(asset.startsWith('https://')){
   const u=new URL(asset);
   if(u.protocol!=='https:')throw Error('Mídia externa insegura');
   rows.push({project:project.title,kind,source:asset,status:'external',bytes:null,r2Target:null});continue;
  }
  const normal=path.posix.normalize(asset);
  if(normal!==asset||asset.startsWith('/')||asset.includes('..')||!(/^(?:videos(?:-360|-480|-1080)?|capas)\/[a-zA-Z0-9_.-]+$/.test(asset)))throw Error('Caminho inseguro: '+asset);
  const absolute=path.resolve(root,asset);
  if(!absolute.startsWith(root+path.sep)||!fs.existsSync(absolute))throw Error('Mídia ausente: '+asset);
  const size=fs.statSync(absolute).size;
  rows.push({project:project.title,kind,source:asset,status:'local',bytes:size,r2Target:'portfolio/'+asset});
 }
}
const stats={projects:catalog.length,assets:rows.length,localAssets:rows.filter(x=>x.status==='local').length,externalAssets:rows.filter(x=>x.status==='external').length,bytes:rows.reduce((n,x)=>n+(x.bytes||0),0),requiresManagedBlobInventory:true,noUploadsPerformed:true};
if(process.argv.includes('--json'))console.log(JSON.stringify({stats,assets:rows},null,2));
else {
 console.log('Plano R2 (simulação sem escrita)');
 console.log(JSON.stringify(stats,null,2));
 console.log('IMPORTANTE: Vídeos enviados pelo /admin no Vercel Blob requerem inventário separado, não coberto por projetos.json.');
}
