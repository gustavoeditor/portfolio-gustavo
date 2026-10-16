'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html');
const projects=JSON.parse(read('projetos.json'));
const channels=JSON.parse(read('canais.json'));
assert.ok(Array.isArray(projects)&&projects.length>=17,'Catálogo original preservado');
assert.ok(Array.isArray(channels.atuais)&&Array.isArray(channels.anteriores),'Cadastro de canais preservado');
for(const p of projects){
 assert.ok(p.title&&p.category&&p.src&&p.poster,'Projeto original incompleto');
 for(const asset of [p.src,p.poster])if(!asset.startsWith('https://')){
  assert.ok(fs.existsSync(path.join(root,asset)),'Mídia ausente: '+asset);
 }
}
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'IDs duplicados');
for(const [,id] of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(id),'Link interno quebrado: '+id);
for(const name of ['inicio','trabalhos','portfolio-grid','galeria','especialidades','metodo','sobre','contato','brief-form','pack-button','video-modal'])assert.ok(ids.includes(name),'Seção da V4 ausente: '+name);
for(const snippet of ['GUSTAVO | Editor de Vídeo','rel="canonical"','/api/social-image','property="og:image"','meta name="robots"','/_vercel/insights/script.js','/api/managed-projects','GustavoPlayer.mount','/player.js?v=2','/player.css?v=1','data-filter="youtube"','coverArtwork(slug)','data-cover-id','id="pack-toast"','wa.me/5537988445372']){
 assert.ok(html.includes(snippet),'Integração obrigatória ausente: '+snippet);
}

/* O botão flutuante e o briefing do WhatsApp são conversões essenciais, não decoração. */
for(const feature of ['id="quote-floating-trigger"','data-open-quote','id="quick-quote-dialog"','id="quote-form"','id="quote-service"','id="quote-details"','id="quote-duration"','id="quote-deadline"','id="quote-reference"','/sales.js?v=2','/quote-modal.js?v=1','/quote-modal.css?v=1']){
 assert.ok(html.includes(feature),'Orçamento rápido ausente: '+feature);
}
for(const file of ['quote-modal.css','quote-modal.js','sales.js'])assert.ok(fs.existsSync(path.join(root,file)),'Recurso do formulário ausente: '+file);
new Function(read('quote-modal.js'));
new Function(read('sales.js'));
assert.equal((html.match(/id="quote-form"/g)||[]).length,1,'Formulário duplicado');
assert.equal((html.match(/id="quote-floating-trigger"/g)||[]).length,1,'Botão duplicado');

assert.ok(!html.includes('href="/gerenciar-projetos.html"'),'Painel admin não deve aparecer publicamente');
for(const file of ['player.js','player.css','api/admin-upload.js','api/managed-projects.js','lib/managed-projects.js','api/social-image.js','admin-login.html','vercel.json'])assert.ok(fs.existsSync(path.join(root,file)),'Arquivo de produção ausente: '+file);
for(const m of html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g))if(!m[0].includes('src='))new Function(m[1]);
const original=projects.map(x=>x.src.split('/').pop().replace(/\.mp4$/, ''));
for(const slug of original)assert.ok(html.includes("'"+slug+"'"),'Projeto ausente do frontend: '+slug);
const config=JSON.parse(read('vercel.json'));
assert.ok(config.headers.find(x=>x.source==='/(.*)')?.headers?.some(x=>x.key==='X-Content-Type-Options'&&x.value==='nosniff'));

// Prevent regression of the homepage's featured mini-cover.
const tileCover=html.match(/<div class="tile" aria-hidden="true"><img src="data:image\/webp;base64,([^"]+)" data-cover-id="butterfly-gamma-dark"/);
assert.ok(tileCover,'A capa real do destaque Butterfly deve estar incorporada ao HTML');
assert.deepEqual(Buffer.from(tileCover[1],'base64'),fs.readFileSync(path.join(root,'capas/butterfly-gamma-dark.webp')),'Capa incorporada não corresponde ao arquivo oficial');
assert.ok(html.includes('.hero-side .tile img[data-cover-source]{position:relative;z-index:1;'),'A capa real precisa aparecer acima da arte de reserva');
assert.ok(html.includes('.hero-side .tile .offline-art{z-index:0}'),'Arte de reserva deve ficar atrás da capa');
// Read and decode every bundled WebP, not just verify that the filenames exist.
async function validateCoverDecoding(){
 const sharp=require('sharp');
 for(const p of projects){
  if(!p.poster.endsWith('.webp'))continue;
  const pathname=path.join(root,p.poster);
  const meta=await sharp(pathname,{failOn:'error'}).metadata();
  assert.equal(meta.format,'webp','Formato inesperado: '+p.poster);
  assert.ok(meta.width>=480&&meta.height>=270,'Resolução inválida: '+p.poster);
  await sharp(pathname,{failOn:'error'}).resize(16,9,{fit:'cover'}).raw().toBuffer();
 }
 console.log('Validação de todas as '+projects.length+' capas WebP concluída.');
}
void validateCoverDecoding().catch(e=>{console.error(e);process.exitCode=1;});

console.log('Portfolio V4 validado: '+projects.length+' vídeos, admin, SEO e interface.');
