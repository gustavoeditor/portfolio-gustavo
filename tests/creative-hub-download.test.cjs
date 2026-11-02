'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {Readable}=require('node:stream');
const handler=require('../lib/creative-hub-download');
const {settings,approvedRelease,parseRange,reset}=handler._test;
const body=Buffer.alloc(5*1024*1024+123,7);body.write('MZ',0);
const key='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const hash=s=>createHash('sha256').update(s).digest('hex');
const env={
 CT_HUB_ENABLED:'true',CT_HUB_VERSION:'1.8.0',
 CT_HUB_PRIVATE_BLOB_PATH:'creative-tools/releases/Creative_Tools_Setup_1.8.0.exe',
 CT_UPDATE_PRIVATE_BLOB_TOKEN:'BLOB_'.repeat(12),
 CT_UPDATE_LICENSE_SHA256:hash(key),CT_HUB_SHA256:hash(body)
};
const feed={schemaVersion:1,product:'creative-tools',latest:'1.8.0',releases:[{version:'1.8.0',status:'published',auth:'license',sha256:hash(body),size:body.length,fileName:'Creative_Tools_Setup_1.8.0.exe'}]};
const blob=()=>async()=>({statusCode:200,stream:Readable.from([body])});
function response(){
 const headers={};
 return {headers,setHeader(k,v){headers[k]=v},status(code){this.code=code;return this},json(v){this.value=v;return this},send(v){this.value=v;return this}};
}
const req=(headers,query={product:'creative-tools',version:'1.8.0'})=>({method:'GET',query,headers});
test.beforeEach(()=>reset());

test('configuracao estrita e reaproveita token/licencas do atualizador',()=>{
 assert.equal(settings(env).valid,true);
 assert.equal(settings({...env,CT_HUB_ENABLED:'false'}).valid,false);
 assert.equal(settings({...env,CT_HUB_PRIVATE_BLOB_PATH:'creative-tools/releases/../x.exe'}).valid,false);
 assert.equal(settings({...env,CT_HUB_PRIVATE_BLOB_PATH:'creative-tools/releases/x.zxp'}).valid,false);
 assert.equal(settings({...env,CT_UPDATE_LICENSE_SHA256:''}).valid,false);
});
test('sem licenca: 403 antes de tocar no storage',async()=>{
 let called=false;const res=response();
 await handler(req({range:'bytes=0-99'}),res,{env,feed,blobGet:()=>{called=true}});
 assert.equal(res.code,403);assert.equal(called,false);
});
test('licenca errada: 403',async()=>{
 const res=response();
 await handler(req({authorization:'Bearer '+key.slice(2)}),res,{env,feed,blobGet:blob()});
 assert.equal(res.code,403);
});
test('entrega em partes (206) e o arquivo remontado confere',async()=>{
 const parts=[];let start=0;
 while(start<body.length){
  const end=Math.min(start+3145728,body.length)-1;const res=response();
  await handler(req({authorization:'Bearer '+key,range:'bytes='+start+'-'+end}),res,{env,feed,blobGet:blob()});
  assert.equal(res.code,206);
  assert.equal(res.headers['Content-Range'],'bytes '+start+'-'+end+'/'+body.length);
  parts.push(res.value);start=end+1;
 }
 assert.equal(hash(Buffer.concat(parts)),hash(body));
});
test('sem Range e arquivo acima de 4 MB: pede Range',async()=>{
 const res=response();
 await handler(req({authorization:'Bearer '+key}),res,{env,feed,blobGet:blob()});
 assert.equal(res.code,416);
});
test('Range invalido: 416',async()=>{
 const res=response();
 await handler(req({authorization:'Bearer '+key,range:'bytes=99999999-'}),res,{env,feed,blobGet:blob()});
 assert.equal(res.code,416);
 assert.equal(parseRange('bytes=10-5',100),false);
 assert.deepEqual(parseRange('bytes=10-',100),{start:10,end:99});
});
test('arquivo adulterado nunca e entregue',async()=>{
 const res=response();
 await handler(req({authorization:'Bearer '+key,range:'bytes=0-9'}),res,{env,feed,blobGet:async()=>({statusCode:200,stream:Readable.from([Buffer.from('MZ modificado')])})});
 assert.equal(res.code,503);
});
test('feed nao aprovado ou divergente: 503 sem tocar no storage',async()=>{
 let called=false;
 const r=feed.releases[0];
 for(const bad of [{...feed,latest:null},{...feed,releases:[{...r,status:'preview'}]},{...feed,releases:[{...r,auth:undefined}]},{...feed,releases:[{...r,sha256:'0'.repeat(64)}]}]){
  const res=response();
  await handler(req({authorization:'Bearer '+key,range:'bytes=0-9'}),res,{env,feed:bad,blobGet:()=>{called=true}});
  assert.equal(res.code,503);
 }
 assert.equal(called,false);
 assert.ok(approvedRelease(settings(env),feed));
});
test('produto ou versao desconhecidos: 404',async()=>{
 for(const q of [{product:'outro',version:'1.8.0'},{product:'creative-tools',version:'1.7.0'}]){
  const res=response();
  await handler(req({authorization:'Bearer '+key},q),res,{env,feed,blobGet:blob()});
  assert.equal(res.code,404);
 }
});
test('feed publicado bate com o contrato do Hub',()=>{
 const f=require('../updates/creative-tools/hub-manifest.json');
 const rel=f.releases.find(x=>x.version===f.latest);
 assert.equal(f.product,'creative-tools');
 assert.equal(rel.status,'published');assert.equal(rel.auth,'license');
 assert.match(rel.sha256,/^[a-f0-9]{64}$/);assert.ok(rel.size>0);
 assert.ok(rel.rangeChunkSize<=4*1024*1024);
 assert.equal(rel.downloadUrl,'/api/creative-hub/download?product=creative-tools&version='+rel.version);
});
