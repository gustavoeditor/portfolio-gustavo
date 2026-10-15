const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=(name)=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('index.html');
const projects=JSON.parse(read('projetos.json'));
const testimonials=JSON.parse(read('depoimentos.json'));
const comparisons=JSON.parse(read('comparacoes.json'));
assert.ok(Array.isArray(projects)&&projects.length>=17,'A biblioteca de vídeos deve estar preservada');
assert.ok(Array.isArray(testimonials)&&Array.isArray(comparisons),'Proof registries must be arrays');
const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(ids.length,new Set(ids).size,'IDs duplicados');
for(const [,id] of html.matchAll(/href="#([^"]+)"/g)){
 assert.ok(ids.includes(id),'Âncora inexistente: '+id);
}
for(const src of ['sales.css','sales.js','proof.js']){
 assert.ok(fs.existsSync(path.join(root,src)),'Arquivo de interface ausente: '+src);
 assert.ok(html.includes('/'+src),'Arquivo não referenciado: '+src);
}
for(const src of ['depoimentos.json','comparacoes.json','api/social-image.js']){
 assert.ok(fs.existsSync(path.join(root,src)),'Arquivo obrigatório ausente: '+src);
}
assert.ok(html.includes('https://portfolio-gustavo-chi.vercel.app/api/social-image'),'OG image ausente');
assert.ok(html.includes('id="quote-form"')&&html.includes('id="quote-service"'),'Formulário de briefing ausente');
assert.ok(!html.includes('href="/gerenciar-projetos.html"'),'Painel privado exposto por link');
for(const p of projects){
 assert.ok(p.title&&p.category&&p.src&&p.poster,'Projeto incompleto');
 for(const asset of [p.src,p.poster]){
  if(asset.startsWith('https://'))continue;
  assert.ok(fs.existsSync(path.join(root,asset)),'Mídia ausente: '+asset);
 }
}
for(const [,src] of html.matchAll(/data-project-src="([^"]+)"/g)){
 assert.ok(projects.some(p=>p.src===src),'Estudo de caso aponta para vídeo inexistente: '+src);
}
for(const file of ['sales.js','proof.js','admin-smart-upload.js',...fs.readdirSync(path.join(root,'api')).filter(f=>f.endsWith('.js')).map(f=>'api/'+f),...fs.readdirSync(path.join(root,'lib')).filter(f=>f.endsWith('.js')).map(f=>'lib/'+f)]){
 new Function(read(file));
}
for(const match of html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)){
 if(match[0].includes('application/ld+json')){JSON.parse(match[1]);continue;}
 if(match[0].includes('src='))continue;
 new Function(match[1]);
}
assert.ok(html.includes('/player.js?v=1')&&html.includes('/player.css?v=1'),'Player assets missing');
assert.ok(html.includes('GustavoPlayer.mount(player'),'Custom player integration missing');
assert.ok(html.includes('playerUI.destroy()'),'Custom player cleanup missing');
new Function(read('player.js'));
assert.ok(read('player.css').includes('.vip-timeline-wrap'),'Branded seek bar missing');
console.log('Portfolio validation OK: '+projects.length+' projects; anchors, scripts and assets verified.');
