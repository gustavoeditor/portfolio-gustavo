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
assert.ok(!html.includes('href="/gerenciar-projetos.html"'),'Painel admin não deve aparecer publicamente');
for(const file of ['player.js','player.css','api/admin-upload.js','api/managed-projects.js','lib/managed-projects.js','api/social-image.js','admin-login.html','vercel.json'])assert.ok(fs.existsSync(path.join(root,file)),'Arquivo de produção ausente: '+file);
for(const m of html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g))if(!m[0].includes('src='))new Function(m[1]);
const original=projects.map(x=>x.src.split('/').pop().replace(/\.mp4$/, ''));
for(const slug of original)assert.ok(html.includes("'"+slug+"'"),'Projeto ausente do frontend: '+slug);
const config=JSON.parse(read('vercel.json'));
assert.ok(config.headers.find(x=>x.source==='/(.*)')?.headers?.some(x=>x.key==='X-Content-Type-Options'&&x.value==='nosniff'));
console.log('Portfolio V4 validado: '+projects.length+' vídeos, admin, SEO e interface.');
