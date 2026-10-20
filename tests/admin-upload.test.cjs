const {test, afterEach} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname,'..');
const keys=['ADMIN_PASSWORD','ADMIN_SESSION_SECRET','ADMIN_TOTP_SECRET','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','BLOB_READ_WRITE_TOKEN','BLOB_STORE_ID','BLOB_WEBHOOK_PUBLIC_KEY','VERCEL_OIDC_TOKEN','VERCEL','OPENAI_API_KEY','AI_GATEWAY_API_KEY'];
const originalEnv=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
const originalFetch=global.fetch;
function env(){for(const key of keys)delete process.env[key];process.env.ADMIN_PASSWORD='test-fixture-password';process.env.ADMIN_SESSION_SECRET='test-fixture-session-secret';}
afterEach(()=>{for(const k of keys){if(originalEnv[k]===undefined)delete process.env[k];else process.env[k]=originalEnv[k];}global.fetch=originalFetch;});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;return this;},status(code){this.code=code;return this;},json(body){this.body=body;return this;},end(){return this;},send(body){this.body=body;return this;}};}
function load(file, overrides={}){
 const filename=path.join(root,file), mod={exports:{}};const real=createRequire(filename);
 const execute=vm.runInThisContext('(function(require,module,exports){'+fs.readFileSync(filename,'utf8')+'\n})',{filename});
 execute(name=>Object.hasOwn(overrides,name)?overrides[name]:real(name),mod,mod.exports);return mod.exports;
}
const session=require('../lib/admin-session');
function request(body={},method='POST'){
 const expires=String(Date.now()+3600000);
 return {method,headers:{host:'portfolio.test',origin:'https://portfolio.test','content-type':'application/json','x-gustavo-admin':'1',cookie:'portfolio_admin='+expires+'.'+session.signSession(expires),'x-vercel-forwarded-for':'192.0.2.1'},body};
}

test('login requires same origin, issues a protected cookie and credential changes revoke it',async()=>{
 env();const handler=require('../api/admin-auth');
 const cross=request({password:process.env.ADMIN_PASSWORD});cross.headers.origin='https://evil.test';const denied=response();await handler(cross,denied);assert.equal(denied.code,403);
 const ok=response();await handler(request({password:process.env.ADMIN_PASSWORD}),ok);assert.equal(ok.code,200);assert.match(ok.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);
 const req={headers:{cookie:ok.headers['Set-Cookie'].split(';')[0]}};assert.ok(session.isAdmin(req));
 process.env.ADMIN_PASSWORD='new-fixture-password';assert.equal(session.isAdmin(req),false);
 const malformed=response();await handler(request('bad-json'),malformed);assert.equal(malformed.code,400);
});

test('login throttles bursts and releases the bucket after the window',async()=>{
 env();const {allowLogin}=load('lib/admin-security.js');const req=request();const now=Date.now();
 for(let i=0;i<10;i++)assert.equal((await allowLogin(req,now)).allowed,true);
 assert.equal((await allowLogin(req,now)).allowed,false);
 assert.equal((await allowLogin(req,now+900001)).allowed,true);
});

test('shared Redis throttle fails closed on service failure',async()=>{
 env();process.env.UPSTASH_REDIS_REST_URL='https://redis.test';process.env.UPSTASH_REDIS_REST_TOKEN='fixture';
 global.fetch=async()=>new Response(JSON.stringify({result:[11,100000]}),{headers:{'content-type':'application/json'}});
 const {allowLogin}=require('../lib/admin-security');assert.equal((await allowLogin(request())).allowed,false);
 global.fetch=async()=>{throw new Error('offline');};const handler=require('../api/admin-auth'),res=response();await handler(request({password:process.env.ADMIN_PASSWORD}),res);assert.equal(res.code,503);assert.equal(res.headers['Set-Cookie'],undefined);
});

test('TOTP validates RFC 6238 SHA-1 vector and rejects wrong or missing codes',()=>{
 env();const {validTotp}=require('../lib/admin-security');const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
 assert.equal(validTotp('287082',secret,59000),true);assert.equal(validTotp('123456',secret,59000),false);assert.equal(validTotp('',secret,59000),false);assert.equal(validTotp('123456','invalid!',59000),false);
});

test('upload refuses unauthenticated requests before contacting storage',async()=>{
 env();let called=false;
 const handler=load('api/admin-upload.js',{'@vercel/blob/client':{handleUpload:async()=>{called=true;}}});
 const req=request({type:'blob.generate-client-token'});delete req.headers.cookie;const res=response();await handler(req,res);assert.equal(res.code,403);assert.equal(called,false);
});

test('upload limits paths, media types and size in legacy and OIDC modes',async()=>{
 env();process.env.BLOB_READ_WRITE_TOKEN='fixture';
 const legacy=load('api/admin-upload.js',{'@vercel/blob/client':{handleUpload:async opts=>{const limits=await opts.onBeforeGenerateToken('gustavo/videos/fixture.mp4');assert.equal(limits.maximumSizeInBytes,250*1024*1024);assert.equal(limits.allowOverwrite,false);return {clientToken:'temporary'};}}});
 const res=response();await legacy(request({type:'blob.generate-client-token'}),res);assert.equal(res.code,200);
 assert.throws(()=>legacy.constraints('gustavo-admin/projects-v1.json'));
 assert.throws(()=>legacy.constraints('gustavo/capas/fixture.svg'));
 delete process.env.BLOB_READ_WRITE_TOKEN;process.env.BLOB_STORE_ID='fixture';process.env.VERCEL_OIDC_TOKEN='fixture';process.env.BLOB_WEBHOOK_PUBLIC_KEY='fixture';
 const oidc=load('api/admin-upload.js',{'@vercel/blob':{issueSignedToken:async opts=>{assert.deepEqual(opts.operations,['put']);assert.equal(opts.pathname,'gustavo/capas/fixture.webp');return {delegationToken:'limited'};}},'@vercel/blob/client':{handleUploadPresigned:async opts=>{const limited=await opts.getSignedToken('gustavo/capas/fixture.webp');assert.equal(limited.urlOptions.maximumSizeInBytes,8*1024*1024);return {type:'blob.generate-presigned-url'};}}});
 const signed=response();await oidc(request({type:'blob.generate-presigned-url'}),signed);assert.equal(signed.code,200);
});

test('publication rejects files from another store and bytes disguised as media',async()=>{
 env();process.env.BLOB_READ_WRITE_TOKEN='fixture';
 const url='https://ours.public.blob.vercel-storage.com/gustavo/videos/fixture.mp4';
 const lib=load('lib/managed-projects.js',{'@vercel/blob':{head:async pathname=>{assert.equal(pathname,'gustavo/videos/fixture.mp4');return {url,size:20,contentType:'video/mp4'};}}});
 global.fetch=async()=>new Response(Buffer.from('0000ftypisom0000'));
 assert.equal(await lib.validUploadedUrl(url,'videos'),true);
 assert.equal(await lib.validUploadedUrl(url.replace('ours.','other.'),'videos'),false);
 global.fetch=async()=>new Response('<script>alert(1)</script>');assert.equal(await lib.validUploadedUrl(url,'videos'),false);
 assert.equal(await lib.validUploadedUrl('https://localhost/file.mp4','videos'),false);
 assert.equal(lib.hasMagic(Buffer.from([137,80,78,71,13,10,26,10]),'image/png'),true);
});

test('catalog rejects stale reads and uses conditional writes with a recovery snapshot',async()=>{
 env();process.env.BLOB_READ_WRITE_TOKEN='fixture';let stale=false;const writes=[];
 const lib=load('lib/managed-projects.js',{'@vercel/blob':{
  head:async()=>({url:'https://ours.public.blob.vercel-storage.com/catalog.json',etag:'latest'}),
  get:async()=>({blob:{etag:stale?'old':'"latest"'},stream:new Response(JSON.stringify({projects:[{id:'existing'}]})).body}),
  put:async(p,body,options)=>{writes.push({p,body,options});return {url:p};}
 }});
 const snapshot=await lib.readSnapshot();await lib.writeManaged([{id:'new'}],snapshot);
 assert.equal(writes.length,2);assert.match(writes[0].p,/history\//);assert.deepEqual(JSON.parse(writes[0].body).projects,[{id:'existing'}]);assert.equal(writes[1].options.ifMatch,'latest');
 stale=true;await assert.rejects(lib.readSnapshot(),/catálogo mudou/);
});

test('retrying publication is idempotent and preserves the existing catalog',async()=>{
 env();const id='00000000-0000-4000-8000-000000000001';let rows=[];let writes=0;
 const handler=load('api/admin-publish.js',{'../lib/managed-projects':{
  hasStore:()=>true,readSnapshot:async()=>({projects:rows,etag:'fixture'}),
  cleanProject:b=>({title:b.title,category:b.category,position:b.position,src:b.src,poster:b.poster}),validUploadedUrl:async()=>true,
  writeManaged:async projects=>{rows=projects;writes++;}
 }});
 const body={uploadId:id,title:'Fixture',category:'motion',position:0,src:'video',poster:'cover'};
 const first=response();await handler(request(body),first);assert.equal(first.code,201);
 const retry=response();await handler(request(body),retry);assert.equal(retry.code,200);assert.equal(writes,1);assert.equal(rows.length,1);
});

test('visual analysis sanitizes model output, limits frames, and honestly falls back on outage',async()=>{
 env();const handler=load('api/admin-analyze.js',{'../lib/visual-ai':{visualAIConfig:()=>({url:'https://ai.test',model:'fixture'}),visualAIToken:async()=> 'fixture'}});
 global.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);assert.equal(body.messages[1].content.length,9);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({title:'Fixture',category:'invented',position:9999,description:'x'.repeat(500)})}}]}));};
 const req=request({name:'motion-test.mp4',total:17,frames:Array(12).fill('data:image/jpeg;base64,YWJj')});
 const res=response();await handler(req,res);assert.equal(res.body.source,'ai');assert.equal(res.body.title,'Fixture');assert.equal(res.body.category,'motion');assert.equal(res.body.position,17);assert.equal(res.body.description.length,220);
 global.fetch=async()=>{throw new Error('unavailable');};const fallback=response();await handler(req,fallback);assert.equal(fallback.body.source,'filename');assert.equal(fallback.body.reasonCode,'provider_error');
});

test('Vercel hosting alone is not proof of AI credentials',()=>{
 env();
 process.env.VERCEL='1';
 const {visualAIConfig}=require('../lib/visual-ai');
 assert.equal(visualAIConfig().provider,'gateway');
 const handler=load('api/admin-config.js',{
   '../lib/storage-config':{storageMode:()=>null}
 });
 const res=response();handler(request({},'GET'),res);
 assert.equal(res.code,200);
 assert.equal(res.body.visualAIReady,false);
 assert.equal(res.body.visualAIConfigured,false);
 assert.equal(res.body.visualAIOidcPotential,true);
 process.env.AI_GATEWAY_API_KEY='test-gateway-key';
 assert.equal(visualAIConfig().provider,'gateway');
 const configured=response();handler(request({},'GET'),configured);
 assert.equal(configured.body.visualAIConfigured,true);
});

test('visual title failure gives concrete diagnosis, not a fake AI result',async()=>{
 env();
 const frames=['data:image/jpeg;base64,YWJj'];
 const handler=load('api/admin-analyze.js',{'../lib/visual-ai':{
   visualAIConfig:()=>({provider:'gateway',url:'https://ai.test',model:'fixture'}),
   visualAIToken:async()=> 'test-token'
 }});
 const req=request({name:'take-001.mp4',total:17,frames});
 for(const [status,code] of [[401,'unauthorized'],[402,'credits'],[404,'model_unavailable'],[429,'rate_limited'],[503,'provider_error']]){
   global.fetch=async()=>new Response('unavailable',{status});
   const res=response();await handler(req,res);
   assert.equal(res.code,200);
   assert.equal(res.body.source,'filename');
   assert.equal(res.body.reasonCode,code);
   assert.match(res.body.explanation,/IA|modelo|serviço/i);
 }
 global.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:'{}'}}]}));
 const invalid=response();await handler(req,invalid);
 assert.equal(invalid.body.reasonCode,'invalid_response');
 assert.equal(invalid.body.source,'filename');
 const noFrames=response();await handler(request({name:'take-001.mp4',frames:[]}),noFrames);
 assert.equal(noFrames.body.reasonCode,'no_frames');
 const unconfigured=load('api/admin-analyze.js',{'../lib/visual-ai':{visualAIConfig:()=>null,visualAIToken:async()=>null}});
 const noKey=response();await unconfigured(req,noKey);
 assert.equal(noKey.body.reasonCode,'not_configured');
});

test('admin title generator offers a retry with transparent status',()=>{
 const source=fs.readFileSync(path.join(root,'api/admin-panel.js'),'utf8');
 const encoded=/^const PANEL_HTML = (".*");$/m.exec(source);
 assert.ok(encoded);
 const html=JSON.parse(encoded[1]);
 assert.ok(html.includes('id="auto-regenerate-title"'));
 assert.ok(html.includes('id="auto-title-ai-status"'));
 assert.ok(html.includes('/admin-smart-upload.js?v=6'));
 assert.ok(html.includes('/upload-ui.css?v=4'));
 const uploader=fs.readFileSync(path.join(root,'admin-smart-upload.js'),'utf8');
 assert.doesNotThrow(()=>new vm.Script(uploader));
 assert.match(uploader,/aiRetry\.addEventListener\('click'/);
 assert.match(uploader,/await requestAnalysis\(chosen\)/);
 assert.match(uploader,/aiTitleStatus\.dataset\.mode = 'error'/);
});

test('public drop prevents file navigation and opens an accessible admin notice',()=>{
 const listeners={},nodes=[];
 const element=tag=>({tag,children:[],append(...items){this.children.push(...items);},setAttribute(k,v){this[k]=v;},addEventListener(){},remove(){}});
 const context={document:{getElementById:()=>null,addEventListener:(event,fn)=>{listeners[event]=fn;},createElement:element,body:{append:node=>nodes.push(node)}}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'drop-guard.js'),'utf8'),context);
 let prevented=false;listeners.drop({dataTransfer:{types:['Files']},preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(nodes[0].role,'status');assert.equal(nodes[0].children[1].href,'/admin');
});

test('uploader script parses fully and cannot disable file selection',()=>{
 const source=fs.readFileSync(path.join(root,'admin-smart-upload.js'),'utf8');
 assert.doesNotThrow(()=>new vm.Script(source,{filename:'admin-smart-upload.js'}));
 assert.match(source,/__gustavoAdminDrop\.register\(chooseFile\)/);
});

test('video thumbnail picker has an accessible timeline and never publishes without confirmation',()=>{
 const source=fs.readFileSync(path.join(root,'api/admin-panel.js'),'utf8');
 const encoded=/^const PANEL_HTML = (".*");$/m.exec(source);
 assert.ok(encoded);
 const html=JSON.parse(encoded[1]);
 assert.match(html,/<dialog id="auto-cover-dialog"/);
 assert.match(html,/id="auto-pick-frame"/);
 assert.match(html,/id="auto-cover-video"/);
 assert.match(html,/id="auto-cover-range"[^>]*type="range"/);
 assert.match(html,/id="auto-cover-confirm" disabled/);
 assert.match(html,/id="auto-change-cover">Enviar imagem/);
 assert.ok(html.includes('/admin-smart-upload.js?v=6'));
 assert.ok(html.includes('/upload-ui.css?v=4'));
 const uploader=fs.readFileSync(path.join(root,'admin-smart-upload.js'),'utf8');
 assert.doesNotThrow(()=>new vm.Script(uploader));
 assert.match(uploader,/coverVideo\.addEventListener\('seeked',readyFrame\)/);
 assert.match(uploader,/canvas\.toBlob\(resolve,'image\/webp'/);
 assert.match(uploader,/if \(!customCover\) setCover\(samples\.thumbnail, false\)/);
 assert.match(uploader,/if \(!titleEdited && result\.title\)/);
});

test('native admin picker and inline drop guard keep working before uploader script',async()=>{
 const source=fs.readFileSync(path.join(root,'api/admin-panel.js'),'utf8');
 const encoded=/^const PANEL_HTML = (".*");$/m.exec(source);
 assert.ok(encoded,'Admin template source missing');
 const html=JSON.parse(encoded[1]);
 assert.match(html,/<label id="auto-drop" for="auto-file"/);
 assert.match(html,/<input type="file" id="auto-file" class="file-input-accessible"/);
 const token='/* A seleção de arquivos continua funcionando';
 const start=html.lastIndexOf('<script>',html.indexOf(token))+'<script>'.length;
 const end=html.indexOf('</script>',html.indexOf(token));
 assert.ok(start>8 && end>start,'Inline drop guard must appear in the HTML');
 const script=html.slice(start,end);
 const listeners={window:{},document:{},area:{},input:{}};
 const add=(target)=>(type,fn)=>{listeners[target][type]=fn;};
 const status={textContent:'',dataset:{}};
 const picked={name:'MEU_TAKE.mp4',size:123,type:'video/mp4'};
 let calls=0,scrolled=false;
 const area={addEventListener:add('area'),classList:{add(){},remove(){}},contains(t){return t===area;},scrollIntoView(){scrolled=true;}};
 const input={files:[picked],value:'test',addEventListener:add('input'),click(){calls++;}};
 const win={addEventListener:add('window')};
 const doc={getElementById:id=>({'auto-drop':area,'auto-file':input,'auto-feedback':status})[id],addEventListener:add('document')};
 vm.runInNewContext(script,{window:win,document:doc,Promise});
 assert.ok(win.__gustavoAdminDrop?.register,'Module must be able to register its handler');
 assert.equal(listeners.area.click,undefined,'Native label must not invoke a second file chooser');
 listeners.area.keydown({key:'Enter',preventDefault(){}});assert.equal(calls,1,'Keyboard selection should open file chooser');
 let prevented=false;
 const event={dataTransfer:{types:['Files'],files:[picked]},target:area,preventDefault(){prevented=true;}};
 listeners.window.dragover(event);assert.equal(prevented,true,'Browser navigation must be blocked');
 prevented=false;listeners.document.drop(event);assert.equal(prevented,true,'Dropped file must not navigate');
 assert.match(status.textContent,/Preparando o painel/);
 const selected=[];win.__gustavoAdminDrop.register(file=>selected.push(file.name));
 await new Promise(setImmediate);
 assert.deepEqual(selected,[picked.name],'File dropped before module startup should be delivered exactly once');
 listeners.input.change();await new Promise(setImmediate);
 assert.deepEqual(selected,[picked.name,picked.name],'Windows file input selection should use same handler');
 assert.equal(input.value,'','File selection should reset so same video can be picked again');
 assert.equal(scrolled,false,'Area already under pointer should not scroll unexpectedly');
});

test('authenticated panel permits the upload SDK control API and serves its own client bundle',()=>{
 env();const handler=require('../api/admin-panel'),res=response();handler(request({},'GET'),res);
 assert.equal(res.code,200);assert.match(res.headers['Content-Security-Policy'],/https:\/\/vercel\.com\/api\/blob\//);
 assert.ok(!res.headers['Content-Security-Policy'].includes('https://esm.sh'));
 assert.ok(res.body.includes('/admin-smart-upload.js?v=6'));
 assert.ok(fs.existsSync(path.join(root,'vendor/blob-client.js')));
});


test('presigned upload helper and browser client agree on scoped token payload',async()=>{
 env();delete process.env.BLOB_READ_WRITE_TOKEN;process.env.BLOB_STORE_ID='fixture';process.env.VERCEL_OIDC_TOKEN='fixture';process.env.BLOB_WEBHOOK_PUBLIC_KEY='fixture';
 const handler=load('api/admin-upload.js',{'@vercel/blob':{issueSignedToken:async opts=>({delegationToken:Buffer.from(JSON.stringify({storeId:'fixture',...opts})).toString('base64url')+'.fixture',clientSigningToken:'fixture-signing-material',validUntil:opts.validUntil})}});
 const req=request({type:'blob.generate-presigned-url',payload:{pathname:'gustavo/videos/fixture.webm',multipart:false,clientPayload:null}}),res=response();
 await handler(req,res);assert.equal(res.code,200);assert.equal(res.body.type,'blob.generate-presigned-url');
 const payload=res.body.presignedUrlPayload;assert.ok(payload.signature);
 assert.equal(require('@vercel/blob').parseStoreIdFromPresignedUrl(payload),'fixture');
 const decoded=JSON.parse(Buffer.from(payload.delegationToken.split('.')[0],'base64url').toString());assert.equal(decoded.pathname,'gustavo/videos/fixture.webm');assert.deepEqual(decoded.operations,['put']);
});


test('configured OIDC bindings work without an env token because runtime credentials are request-scoped',()=>{
 env();process.env.BLOB_STORE_ID='fixture';process.env.BLOB_WEBHOOK_PUBLIC_KEY='fixture';
 assert.equal(require('../lib/storage-config').storageMode(),'oidc');
 assert.equal(process.env.VERCEL_OIDC_TOKEN,undefined);
 process.env.VERCEL='1';assert.equal(require('../lib/visual-ai').visualAIConfig().provider,'gateway');
});

test('quality ranking inserts new projects while keeping the existing curated catalog in sequence',()=>{
 const {merge}=require('../portfolio-order');
 const originals=Array.from({length:16},(_,i)=>['original-'+i]);
 const incoming=[
  {entry:['weak'],position:3,qualityScore:35,rankingMode:'auto',publishedAt:'2026-10-19T00:00:00Z'},
  {entry:['strong'],position:3,qualityScore:93,rankingMode:'auto',publishedAt:'2026-10-20T00:00:00Z'},
  {entry:['manual'],position:3,qualityScore:null,rankingMode:'manual'},
  {entry:['unrated'],position:16,qualityScore:null,rankingMode:'unrated'}
 ];
 const mixed=merge(originals,incoming).map(x=>x[0]);
 assert.equal(mixed.length,20);
 assert.deepEqual(mixed.slice(3,6),['manual','strong','weak']);
 assert.equal(mixed.at(-1),'unrated');
 assert.deepEqual(mixed.filter(x=>x.startsWith('original-')),originals.map(x=>x[0]));
 assert.deepEqual(merge(originals,[]),originals);
});

test('only valid visual AI scores are considered automatic ranking, with manual override preserved',async()=>{
 env();
 const {cleanProject}=load('lib/managed-projects.js',{'@vercel/blob':{}});
 const base={title:'Take',category:'cs2',src:'video',poster:'cover',position:2};
 assert.deepEqual({s:cleanProject({...base,rankingMode:'auto',qualityScore:86}).qualityScore,m:cleanProject({...base,rankingMode:'auto',qualityScore:86}).rankingMode},{s:86,m:'auto'});
 assert.equal(cleanProject({...base,rankingMode:'auto',qualityScore:120}).rankingMode,'unrated');
 assert.equal(cleanProject({...base,rankingMode:'manual',qualityScore:90}).rankingMode,'manual');
 const handler=load('api/admin-analyze.js',{'../lib/visual-ai':{visualAIConfig:()=>({url:'https://ai.test',model:'fixture'}),visualAIToken:async()=> 'fixture'}});
 global.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({title:'Take cinematográfico',category:'cinematics',position:1,qualityScore:92,qualityConfidence:'alta'})}}]}));
 const result=response();await handler(request({name:'take.mp4',total:17,frames:['data:image/jpeg;base64,YWJj']}),result);
 assert.equal(result.body.qualityScore,92);assert.equal(result.body.rankingMode,'auto');assert.equal(result.body.position,1);
 global.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({title:'Outro vídeo',category:'cs2',position:0,qualityScore:999})}}]}));
 const bad=response();await handler(request({name:'take.mp4',total:17,frames:['data:image/jpeg;base64,YWJj']}),bad);
 assert.equal(bad.body.qualityScore,null);assert.equal(bad.body.rankingMode,'unrated');assert.equal(bad.body.position,17);
});

test('home portfolio uses ranked insertion and recalculates featured video indexes',()=>{
 const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const admin=fs.readFileSync(path.join(root,'api/admin-panel.js'),'utf8');
 const encoded=/^const PANEL_HTML = (".*");$/m.exec(admin);
 const html=JSON.parse(encoded[1]);
 assert.match(page,/GustavoPortfolioOrder\.merge\(projects,ranked\)/);
 assert.match(page,/features\[0\]\.dataset\.open=String\(first\)/);
 assert.match(page,/featuredTreino\.dataset\.open=String\(projects\.indexOf\(treino\)\)/);
 assert.match(page,/portfolio-order\.js\?v=1/);
 assert.match(html,/id="auto-ranking-mode"/);
 assert.match(html,/id="auto-ranking-status"/);
 assert.match(html,/admin-smart-upload\.js\?v=6/);
 const uploader=fs.readFileSync(path.join(root,'admin-smart-upload.js'),'utf8');
 assert.match(uploader,/rankingMode,src:uploadedVideo\.url/);
 assert.match(uploader,/positionField\.addEventListener\('input'/);
});
