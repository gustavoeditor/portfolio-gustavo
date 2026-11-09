'use strict';
// Contrato do Creative Hub: tudo que o catálogo anuncia precisa existir no site e bater com os feeds.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto');
const root=path.join(__dirname,'..');
const BASE='https://portfolio-gustavo-chi.vercel.app';
const VERSION=/^\d+\.\d+\.\d+$/;
const catalog=require('../creative-hub/catalog.json');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const cmp=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;};
const feedPath=app=>{assert.ok(app.feed.startsWith(BASE+'/updates/'),app.id+': feed fora do domínio oficial');return app.feed.slice(BASE.length+1);};

test('todo feed anunciado no catálogo existe e pertence ao app',()=>{
 assert.equal(catalog.schema,'creative-hub.catalog/1');
 const ids=catalog.apps.map(a=>a.id);assert.equal(new Set(ids).size,ids.length,'ids repetidos');
 for(const app of catalog.apps){
  if(!app.feed){assert.equal(app.status,'in-development',app.id+': app disponível sem feed');continue;}
  const p=feedPath(app);
  assert.ok(fs.existsSync(path.join(root,p)),app.id+': feed ausente ('+p+') -> 404 no Hub');
  const feed=read(p);
  assert.equal(feed.schemaVersion,1);assert.equal(feed.product,app.id);assert.ok(Array.isArray(feed.releases));
  if(feed.latest!==null){
   assert.match(feed.latest,VERSION);
   const published=feed.releases.filter(r=>r.status==='published').map(r=>r.version).sort(cmp);
   assert.equal(feed.latest,published[published.length-1],app.id+': latest não é a maior versão publicada');
  }
 }
});

test('cada versão publicada aponta para um instalador íntegro',()=>{
 for(const app of catalog.apps.filter(a=>a.feed)){
  const feed=read(feedPath(app));
  const versions=feed.releases.map(r=>r.version);assert.equal(new Set(versions).size,versions.length,app.id+': versão repetida');
  const used=new Set();
  for(const r of feed.releases.filter(x=>x.status==='published')){
   const tag=app.id+' '+r.version;
   assert.match(r.version,VERSION,tag);assert.ok(Array.isArray(r.changes)&&r.changes.length,tag+': sem notas');
   assert.match(r.downloadUrl,new RegExp('^/downloads/'+app.id+'/[A-Za-z0-9._-]+\\.exe$'),tag);
   const file=fs.readFileSync(path.join(root,r.downloadUrl));
   assert.equal(file.subarray(0,2).toString(),'MZ',tag+': não é executável');
   assert.equal(file.length,r.size,tag+': size diverge');
   assert.equal(createHash('sha256').update(file).digest('hex'),r.sha256,tag+': SHA-256 diverge');
   assert.equal(path.basename(r.downloadUrl),r.fileName,tag);assert.equal(r.detectVersion,r.version,tag);
   assert.ok(r.rangeChunkSize<=4*1024*1024,tag+': parte acima do limite da Vercel');
   used.add(path.basename(r.downloadUrl));
  }
  const dir=path.join(root,'downloads',app.id);
  if(fs.existsSync(dir))for(const f of fs.readdirSync(dir))assert.ok(used.has(f),app.id+': instalador órfão '+f);
 }
});

test('página de vendas mostra as ferramentas que o Hub oferece, na versão atual',()=>{
 const html=fs.readFileSync(path.join(root,'loja.html'),'utf8');
 assert.match(html,/<title>Creative Hub \|/);assert.match(html,/icon3d icon-hub icon-hero/);assert.doesNotMatch(html,/ct-demo|id="experiencia"|class="bento"/);assert.match(html,/id="ferramentas"/);
 for(const app of catalog.apps.filter(a=>!a.hidden)){
  const card=html.split('<article class="tool-card').find(x=>x.includes('data-app="'+app.id+'"'));
  assert.ok(card,'loja sem cartão de '+app.id);
  assert.ok(card.includes('<h3>'+app.name+'</h3>'),app.id+': nome');
  assert.ok(card.includes(app.tagline),app.id+': tagline diverge do catálogo');
  if(app.feed){
   const feed=read(feedPath(app));
   assert.ok(card.includes('<b data-version>v'+feed.latest+'</b>'),app.id+': versão da loja diferente do feed ('+feed.latest+')');
   assert.ok(card.includes('class="icon3d '),app.id+': sem ícone 3D');
  }else assert.match(card,/EM DESENVOLVIMENTO/);
 }
});

test('central de atualizações lê o catálogo e os feeds do Hub',()=>{
 const html=fs.readFileSync(path.join(root,'atualizacoes.html'),'utf8');
 assert.match(html,/\/creative-hub\/catalog\.json/);
 assert.doesNotMatch(html,/updates\/creative-tools\/manifest\.json/,'feed Alpha antigo não deve mais alimentar a página');
});
