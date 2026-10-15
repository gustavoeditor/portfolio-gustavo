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
assert.ok(read('player.js').includes('qualitySelect'),'Quality selection missing');
assert.ok(read('player.js').includes("method:'HEAD'"),'Missing alternate video availability validation');
assert.ok(html.includes('videos-480/'),'Reduced video path not connected');
assert.ok(html.includes('videos-1080/'),'Full HD video paths not connected');
assert.ok(read('player.js').includes('gustavo-video-quality-v1'),'Quality preference must persist across videos');
assert.ok(read('player.js').includes('localStorage.setItem(qualityPreferenceKey'),'Quality setting is not saved');
assert.ok(read('player.js').includes("probeVariant(fullSource,'full')"),'1080p variants are not checked');
const channels=JSON.parse(read('canais.json'));
assert.ok(Array.isArray(channels.atuais) && Array.isArray(channels.anteriores),'Channel registry categories must be arrays');
assert.ok(html.includes('id="channels-title"') && html.includes('id="canais"'),'Channel showcase section missing');
assert.ok(html.includes('/channels.js?v=1') && html.includes('/channels.css?v=1'),'Channel assets not included');
new Function(read('channels.js'));
assert.ok(read('channels.css').includes('.channel-card'),'Channel UI stylesheet missing');
// Atmospheric motion is progressive decoration, not an interactive dependency.
assert.ok(html.includes('/ambient.css?v=1')&&html.includes('/ambient.js?v=1'),'Missing site-wide ambience assets');
assert.ok(html.includes('class="ambient-atmosphere" aria-hidden="true"'),'Ambience must be decorative and screen-reader hidden');
assert.ok(!html.includes('vip-depth-y'),'Old partial parallax must be removed');
new Function(read('ambient.js'));
const ambienceCSS=read('ambient.css');
assert.ok(ambienceCSS.includes('prefers-reduced-motion:reduce'),'Reduced motion fallback required');
assert.ok(ambienceCSS.includes('body.ambient-static'),'Save-data and low-power fallback required');
assert.ok(ambienceCSS.includes('.channels::before')&&ambienceCSS.includes('.case-studies::before')&&ambienceCSS.includes('.portfolio::before'),'Parallax layers missing across site');
// All page sections, including asynchronously rendered project/channel cards, reveal safely.
assert.ok(html.includes('/reveal.js?v=1')&&html.includes('/reveal.css?v=1'),'Missing universal reveal assets');
assert.ok(!html.includes('/* Scroll reveal: entrada gradual'),'Legacy limited reveal script still present');
const revealJS=read('reveal.js');
const revealCSS=read('reveal.css');
new Function(revealJS);
assert.ok(revealJS.includes("'.project-card'") || revealJS.includes('#project-grid > .project-card'),'Video card reveals are missing');
assert.ok(revealJS.includes('.channel-card'),'Creator channel reveal missing');
assert.ok(revealJS.includes('MutationObserver'),'Asynchronous card reveals need observation');
assert.ok(revealCSS.includes('translate:0 22px'),'Entrance needs upward motion');
assert.ok(revealCSS.includes('opacity:0'),'Entrance must fade in');
assert.ok(revealCSS.includes('transform 440ms'),'Hover zoom transition must remain smooth');
assert.ok(revealCSS.includes('prefers-reduced-motion:reduce'),'Accessibility motion fallback missing');
assert.ok(revealCSS.includes('.quick-quote-dialog .reveal-entry'),'Modal must never hide the active quote form');
// Hero should identify the professional and explain the result for prospective clients.
const hero=html.match(/<div class="hero-copy">([\s\S]*?)<div class="actions hero-actions">/);
assert.ok(hero,'Hero value proposition not found');
assert.ok(hero[1].includes('GUSTAVO') && hero[1].includes('EDITOR DE VÍDEO'),'Hero must identify Gustavo clearly');
assert.ok(hero[1].includes('Edição que <em>prende.</em>') && hero[1].includes('Visual que <em>marca.</em>'),'Hero value headline was lost');
assert.ok(hero[1].includes('Cinematics de CS2') && hero[1].includes('edição para YouTube'),'Hero must specify editing specialties');
assert.ok(html.includes('<title>GUSTAVO | EDITOR DE VÍDEO</title>'),'Preserve page SEO title');
console.log('Portfolio validation OK: '+projects.length+' projects; anchors, scripts and assets verified.');
