'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {Readable}=require('node:stream');
const handler=require('../lib/creative-tools-update');
const {settings,licensed,published}=handler._test;
const body=Buffer.from('test creative tools release');
const key='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const hash=s=>createHash('sha256').update(s).digest('hex');
const env={
 CT_UPDATE_ENABLED:'true',CT_UPDATE_VERSION:'1.4.20',
 CT_UPDATE_PRIVATE_BLOB_PATH:'creative-tools/releases/Creative_Tools_1.4.20.zxp',
 CT_UPDATE_PRIVATE_BLOB_TOKEN:'BLOB_'.repeat(12),
 CT_UPDATE_LICENSE_SHA256:hash(key),CT_UPDATE_SHA256:hash(body)
};
const catalog={schemaVersion:1,product:'creative-tools',latest:'1.4.20',releases:[{version:'1.4.20',status:'published',sha256:hash(body)}]};
function response(){
 const headers={};
 return {headers,setHeader(k,v){headers[k]=v},status(code){this.code=code;return this},json(v){this.value=v;return this},send(v){this.value=v;return this}};
}
test('configuration is strict',()=>{
 assert.equal(settings(env).valid,true);
 assert.equal(settings({...env,CT_UPDATE_LICENSE_SHA256:''}).valid,false);
 assert.equal(settings({...env,CT_UPDATE_PRIVATE_BLOB_PATH:'../unsafe.zxp'}).valid,false);
 assert.equal(settings({...env,CT_UPDATE_ENABLED:'false'}).valid,false);
});
test('licences use SHA-256 comparison',()=>{
 const cfg=settings(env);
 assert.equal(licensed('Bearer '+key,cfg),true);
 assert.equal(licensed('Bearer '+key.slice(1),cfg),false);
 assert.equal(licensed('bearer '+key,cfg),false);
 assert.equal(licensed('Bearer injected\\r\\nHeader: X',cfg),false);
});
test('rejects anonymous requests before accessing storage',async()=>{
 let called=false;
 const res=response();
 await handler({method:'GET',query:{version:'1.4.20'},headers:{}},res,{env,catalog,blobGet:()=>{called=true}});
 assert.equal(res.code,403);assert.equal(called,false);
});
test('returns only verified private blob',async()=>{
 const res=response();
 await handler({method:'GET',query:{version:'1.4.20'},headers:{authorization:'Bearer '+key}},res,{
 env,catalog,blobGet:async()=>({statusCode:200,stream:Readable.from([body])})
 });
 assert.equal(res.code,200);
 assert.deepEqual(res.value,body);
 assert.match(res.headers['Content-Disposition'],/Creative_Tools_1.4.20/);
});
test('blocks tampered download',async()=>{
 const res=response();
 await handler({method:'GET',query:{version:'1.4.20'},headers:{authorization:'Bearer '+key}},res,{
 env,catalog,blobGet:async()=>({statusCode:200,stream:Readable.from([Buffer.from('modified')])})
 });
 assert.equal(res.code,503);
});

test('never serves unapproved or mismatched manifest even with valid license',async()=>{
 let called=false;
 const cases=[
  {...catalog,latest:null},
  {...catalog,releases:[{...catalog.releases[0],status:'preview'}]},
  {...catalog,releases:[{...catalog.releases[0],sha256:'0'.repeat(64)}]},
  {...catalog,product:'wrong'}
 ];
 for(const bad of cases){
  const res=response();
  await handler({method:'GET',query:{version:'1.4.20'},headers:{authorization:'Bearer '+key}},res,{
   env,catalog:bad,blobGet:()=>{called=true}
  });
  assert.equal(res.code,503);assert.equal(called,false);
 }
 assert.equal(published(settings(env),catalog),true);
});
