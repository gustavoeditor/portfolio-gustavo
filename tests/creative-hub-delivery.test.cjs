'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {Readable}=require('node:stream');
const handler=require('../lib/creative-hub-delivery');
const {settings,releaseFor,parseRange,CHUNK}=handler._test;
const realFeed=require('../updates/creative-tools/hub-manifest.json');
const realHubFeed=require('../updates/creative-hub/manifest.json');

const body=Buffer.alloc(CHUNK*2+1234,7);
const testKey='hubTESTkey_0123456789abcdefghijklmnopqrstuvwxyz';
const caktoKey='CH-ABCDE-FGHJK-LMNPQ-RSTUV';
const hash=s=>createHash('sha256').update(s).digest('hex');
const env={CREATIVE_HUB_DELIVERY_ENABLED:'true',CREATIVE_HUB_BLOB_TOKEN:'BLOB_'.repeat(12),CREATIVE_HUB_TEST_LICENSE_SHA256:hash(testKey)};
const path='creative-hub/packages/creative-tools/Creative_Tools_Setup_1.5.1.exe';
const feed={schemaVersion:1,product:'creative-tools',latest:'1.5.1',releases:[{version:'1.5.1',status:'published',sha256:hash(body),size:body.length,privatePath:path}]};
const blob=b=>async(p)=>{assert.equal(p,path);return {statusCode:200,stream:Readable.from([b])};};
const query={product:'creative-tools',version:'1.5.1'};
const memoryLicenses=active=>({async read(p){return p===`creative-hub/licenses/${hash(caktoKey)}.json`?{status:active?'active':'revoked'}:null;},async write(){}});
function response(){
  const headers={};
  return {headers,setHeader(k,v){headers[k]=v},status(code){this.code=code;return this},json(v){this.value=v;return this},send(v){this.value=v;return this}};
}
async function call(headers,deps={}){
  const res=response();
  await handler({method:'GET',query:deps.query||query,headers},res,{env,feed,blobGet:blob(body),licenseStore:memoryLicenses(true),...deps});
  return res;
}

test('configuração mínima: só liga/desliga e token na Vercel',()=>{
  assert.equal(settings(env).valid,true);
  assert.deepEqual(settings({}).invalid,['CREATIVE_HUB_DELIVERY_ENABLED','CREATIVE_HUB_BLOB_TOKEN']);
  // nomes antigos continuam aceitos
  assert.equal(settings({CT_HUB_ENABLED:'true',CT_HUB_PRIVATE_BLOB_TOKEN:'X'.repeat(40)}).valid,true);
});

test('release vem do feed público e precisa estar completa e publicada',()=>{
  assert.equal(releaseFor('creative-tools','1.5.1',feed).path,path);
  assert.equal(releaseFor('creative-tools','1.5.0',feed),null,'só a versão vigente');
  for(const bad of [
    {...feed,latest:null},
    {...feed,releases:[{...feed.releases[0],status:'preview'}]},
    {...feed,releases:[{...feed.releases[0],privatePath:'creative-hub/packages/creative-cut/x.exe'}]},
    {...feed,releases:[{...feed.releases[0],privatePath:'creative-hub/packages/creative-tools/../x.exe'}]},
    {...feed,releases:[{...feed.releases[0],sha256:'abc'}]},
    {...feed,product:'creative-cut'}
  ])assert.equal(releaseFor('creative-tools','1.5.1',bad),null);
});

test('intervalos HTTP Range',()=>{
  assert.deepEqual(parseRange(undefined,10),{start:0,end:9});
  assert.deepEqual(parseRange('bytes=0-',CHUNK*3),{start:0,end:CHUNK-1});
  assert.equal(parseRange('bytes=5-2',10),null);
  assert.equal(parseRange('bytes=10-',10),null);
  assert.equal(parseRange('bytes=0-1,4-5',10),null);
});

test('sem licença, licença revogada ou desconhecida: 403 sem tocar no pacote',async()=>{
  let touched=false;const spy=()=>{touched=true};
  assert.equal((await call({},{blobGet:spy})).code,403);
  assert.equal((await call({authorization:'Bearer '+'x'.repeat(40)},{blobGet:spy})).code,403);
  assert.equal((await call({authorization:'Bearer '+caktoKey},{blobGet:spy,licenseStore:memoryLicenses(false)})).code,403);
  assert.equal(touched,false);
});

test('licença Cakto ativa ou chave de teste: partes que reconstroem o pacote exato',async()=>{
  for(const key of [testKey,caktoKey]){
    const parts=[];let start=0;
    while(start<body.length){
      const res=await call({authorization:'Bearer '+key,range:`bytes=${start}-`});
      assert.equal(res.code,206);
      assert.equal(res.headers['Content-Range'],`bytes ${start}-${start+res.value.length-1}/${body.length}`);
      parts.push(res.value);start+=res.value.length;
    }
    assert.equal(parts.length,3);
    assert.equal(hash(Buffer.concat(parts)),hash(body));
  }
});

test('blob adulterado, produto/versão desconhecidos e Range inválido',async()=>{
  const tampered=Buffer.from(body);tampered[0]^=1;
  assert.equal((await call({authorization:'Bearer '+testKey},{blobGet:blob(tampered)})).code,503);
  assert.equal((await call({authorization:'Bearer '+testKey},{query:{product:'creative-cut',version:'1.5.1'}})).code,404);
  assert.equal((await call({authorization:'Bearer '+testKey},{query:{product:'creative-tools',version:'9.9.9'}})).code,404);
  assert.equal((await call({authorization:'Bearer '+testKey,range:'bytes=999999999-'})).code,416);
});

test('diagnóstico de configuração só fora de produção, sem valores',async()=>{
  const pre=response();
  await handler({method:'GET',query,headers:{}},pre,{env:{VERCEL_ENV:'preview'},feed});
  assert.deepEqual(pre.value.invalid,['CREATIVE_HUB_DELIVERY_ENABLED','CREATIVE_HUB_BLOB_TOKEN']);
  const prod=response();
  await handler({method:'GET',query,headers:{}},prod,{env:{VERCEL_ENV:'production'},feed});
  assert.equal(prod.value.invalid,undefined);
});

test('feeds reais: release licenciada, relativa ao site e com caminho privado',()=>{
  const r=realFeed.releases.find(x=>x.version===realFeed.latest);
  assert.ok(r&&r.auth==='license');
  assert.match(r.downloadUrl,/^\/api\/creative-hub\/download\?product=creative-tools&version=/);
  assert.ok(releaseFor('creative-tools',realFeed.latest,realFeed),'release vigente válida para entrega');
  assert.equal(r.rangeChunkSize,CHUNK);
  assert.equal(realHubFeed.product,'creative-hub');
  assert.equal(realHubFeed.latest,null,'Hub ainda sem atualização publicada');
});
