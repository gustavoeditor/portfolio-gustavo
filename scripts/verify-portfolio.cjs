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
for(const snippet of ['GUSTAVO | Editor de Vídeo','rel="canonical"','/api/social-image','property="og:image"','meta name="robots"','/_vercel/insights/script.js','/api/managed-projects','GustavoPlayer.mount','/player.js?v=4','/player.css?v=2','data-filter="youtube"','coverArtwork(slug)','data-cover-id','id="pack-toast"','wa.me/5537988445372']){
 assert.ok(html.includes(snippet),'Integração obrigatória ausente: '+snippet);
}

/* O botão flutuante e o briefing do WhatsApp são conversões essenciais, não decoração. */
for(const feature of ['id="quote-floating-trigger"','data-open-quote','id="quick-quote-dialog"','id="quote-form"','id="quote-service"','id="quote-details"','id="quote-duration"','id="quote-deadline"','id="quote-reference"','/sales.js?v=3','/quote-modal.js?v=1','/quote-modal.css?v=1']){
 assert.ok(html.includes(feature),'Orçamento rápido ausente: '+feature);
}
for(const file of ['quote-modal.css','quote-modal.js','sales.js'])assert.ok(fs.existsSync(path.join(root,file)),'Recurso do formulário ausente: '+file);
new Function(read('quote-modal.js'));
new Function(read('sales.js'));
assert.equal((html.match(/id="quote-form"/g)||[]).length,1,'Formulário duplicado');
assert.equal((html.match(/id="quote-floating-trigger"/g)||[]).length,1,'Botão duplicado');

assert.ok(!html.includes('href="/gerenciar-projetos.html"'),'Painel admin não deve aparecer publicamente');
for(const file of ['player.js','player.css','api/admin-upload.js','api/managed-projects.js','lib/managed-projects.js','api/social-image.js','admin-login.html','vercel.json'])assert.ok(fs.existsSync(path.join(root,file)),'Arquivo de produção ausente: '+file);
for(const m of html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g))if(!m[0].includes('src=')&&!m[0].includes('application/ld+json'))new Function(m[1]);
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


/* Sound is opt-in; the audio panel may never remove the booking CTA or video player. */
for(const selector of ['id="ambience-dock"','id="ambience-trigger"','id="ambience-popover"','id="ambience-music"','id="ambience-fx"','id="ambience-volume"','id="ambience-fx-volume"','id="ambience-fx-volume-display"','/ambience.css?v=2','/ambience.js?v=2']){
 assert.ok(html.includes(selector),'Ambience preview missing: '+selector);
}
assert.equal((html.match(/id="ambience-dock"/g)||[]).length,1,'Ambience dock must not duplicate');
assert.ok(fs.existsSync(path.join(root,'ambience.js'))&&fs.existsSync(path.join(root,'ambience.css')),'Ambience assets missing');
const ambienceScript=read('ambience.js');
new Function(ambienceScript);
assert.ok(ambienceScript.includes("preferences.music = stored.music === true"),'Saved music preference not restored');
assert.ok(ambienceScript.includes("music:false, fx:false, volume:12, fxVolume:32"),'Initial music and effects must be off');
assert.ok(ambienceScript.includes("const KEY = 'gustavo-ambience-v1'"),'Existing audio settings must migrate');
assert.ok(ambienceScript.includes('MAX_MUSIC_VOLUME = 65')&&html.includes('id="ambience-volume" min="0" max="65"'),'Music ceiling must be increased');
assert.ok(ambienceScript.includes('MAX_FX_VOLUME = 100')&&html.includes('id="ambience-fx-volume" min="0" max="100"'),'Independent effects volume missing');
assert.ok(ambienceScript.includes("fxRange.addEventListener('input'")&&ambienceScript.includes("preferences.fxVolume"),'Effect volume must persist');
assert.ok(ambienceScript.includes("localStorage.setItem(KEY, JSON.stringify(preferences))"),'Audio settings must survive a reload');
assert.ok(ambienceScript.includes('window.addEventListener(\'storage\''),'Other tabs should reload changed preferences');
const playerScript=read('player.js');
assert.ok(playerScript.includes("gustavo-video-quality-v1"),'Video quality preference missing');
assert.ok(playerScript.includes("gustavo-video-audio-v1")&&playerScript.includes("savePlaybackVolume();"),'Video audio volume and mute should persist');
assert.ok(ambienceScript.includes("document.addEventListener('play',synchronize,true)"),'Pause/duck when video plays');
assert.ok(ambienceScript.includes('document.hidden'),'Pause on background tabs');
assert.ok(ambienceScript.includes('prefers-reduced-motion')===false,'Sound must be optional, not tied to animation preferences');
assert.ok(read('ambience.css').includes('body.modal-open .ambience-dock'),'Audio widget must not overlay video player');
assert.ok(read('ambience.css').includes('max-height:calc(100dvh - 95px)'),'Audio panel must fit on short screens');


/* Playback controls must not remain visible just because the pointer is hovering. */
assert.ok(html.includes('/player.css?v=2'),'Player auto-hide stylesheet reference missing');
const playerCSS=read('player.css');
const playerJS=read('player.js');
for(const token of ['CONTROL_IDLE_MS=3200',"on(root,'pointermove'", "on(root,'pointerleave'",'hideUI();',"on(root,'focusin'", "on(video,'play',onPlaybackState)",'touchRevealOnly','clearHideTimer();']){
 assert.ok(playerJS.includes(token),'Player auto-hide behavior absent: '+token);
}
assert.ok(playerCSS.includes('[data-playing="true"][data-ui-visible="false"] .vip-controls'),'Player controls are not visually hidden when idle');
assert.ok(playerCSS.includes('opacity:0!important;pointer-events:none'),'Idle controls must not capture clicks');
assert.ok(playerCSS.includes('[data-ui-visible="false"][data-pointer-inside="true"]'),'Mouse cursor should be hidden over idle playback');


/* SENTINEL: avoid accidental removal of monitoring or its access controls. */
for(const item of ['/sentinel-client.js?v=2','/api/managed-projects','id="quote-floating-trigger"'])
 assert.ok(html.includes(item),'Site regression: '+item);
const sentinelClient=read('sentinel-client.js');
new Function(sentinelClient);
assert.ok(sentinelClient.includes('No URLs')===false,'Never send diagnostic URLs or payloads');
const sentinelConfig=JSON.parse(read('vercel.json'));
assert.ok(sentinelConfig.rewrites.find(x=>x.source==='/sentinel'&&x.destination==='/api/sentinel-panel'));
for(const f of ['lib/sentinel.js','lib/sentinel-dashboard.js','api/sentinel-event.js','api/sentinel-status.js','api/sentinel-panel.js'])
 assert.ok(fs.existsSync(path.join(root,f)),'Sentinel missing: '+f);


/* Launch gate: Google-visible public metadata and a consistent sitemap. */
const metadata=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
assert.ok(metadata,'Homepage needs JSON-LD structured data');
const graph=JSON.parse(metadata[1]);
assert.equal(graph['@context'],'https://schema.org');
assert.deepEqual(graph['@graph'].map(x=>x['@type']),['WebSite','Person','WebPage']);
assert.ok(graph['@graph'].every(x=>x.url==='https://portfolio-gustavo-chi.vercel.app/'));
assert.ok(!html.includes('<meta name="robots" content="noindex"'),'Homepage must not have noindex');
assert.ok(html.includes('history.scrollRestoration'),'Top-entry mobile fix must survive updates');
const sitemap=read('sitemap.xml');
assert.match(sitemap,/<loc>https:\/\/portfolio-gustavo-chi\.vercel\.app\/<\/loc>/);
assert.match(sitemap,/<lastmod>2026-10-16<\/lastmod>/);
assert.match(read('robots.txt'),/Sitemap: https:\/\/portfolio-gustavo-chi\.vercel\.app\/sitemap\.xml/);

// Product interest: honest pre-launch CTA without fictional checkout. 
assert.ok(html.includes('id="pack-interest"')&&html.includes('id="pack-dismiss"'), 'Pack interest actions missing');
assert.ok(html.includes('value="pack"'), 'Future Pack interest option missing');
assert.ok(read('sales.js').includes("isPack=service==='pack'"), 'WhatsApp interest message missing');
assert.ok(html.includes('O produto ainda não está à venda.'), 'Pack must not imply immediate delivery');
console.log('Portfolio V4 validado: '+projects.length+' vídeos, admin, SEO e interface.');
