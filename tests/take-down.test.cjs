const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname,'..');
function load(file, overrides={}){
 const filename=path.join(root,file), mod={exports:{}};const real=createRequire(filename);
 vm.runInThisContext('(function(require,module,exports){'+fs.readFileSync(filename,'utf8')+'\n})',{filename})(name=>Object.hasOwn(overrides,name)?overrides[name]:real(name),mod,mod.exports);
 return mod.exports;
}
const res=()=>({headers:{},setHeader(){return this;},status(c){this.code=c;return this;},json(b){this.body=b;return this;},end(){return this;}});
const session={validMutation:()=>true,privateHeaders:()=>{},parseJsonBody:req=>req.body};

test('admin can take any video off the site and put it back, without deleting projects',async()=>{
 const real=require('../lib/managed-projects');
 let store={projects:[{id:'x',title:'Upload',src:'https://abc.public.blob.vercel-storage.com/gustavo/videos/up-1.mp4'}],hidden:[],etag:'e1'};
 const writes=[];
 const handler=load('api/admin-publish.js',{'../lib/admin-session':session,'@vercel/blob':{BlobPreconditionFailedError:class extends Error{}},
  '../lib/managed-projects':{...real,hasStore:()=>true,readSnapshot:async()=>store,writeManaged:async(projects,snapshot,hidden)=>{writes.push({projects,hidden});store={...store,projects,hidden};}}});
 const r1=res();await handler({method:'PATCH',headers:{},body:{key:'videos/awp-the-prince.mp4',hidden:true}},r1);
 assert.equal(r1.code,200);assert.deepEqual(r1.body.hidden,['videos/awp-the-prince.mp4']);
 const r2=res();await handler({method:'PATCH',headers:{},body:{key:store.projects[0].src,hidden:true}},r2);
 assert.equal(r2.body.hidden.length,2);
 assert.equal(writes.at(-1).projects.length,1,'retirar do site não apaga o projeto');
 const r3=res();await handler({method:'PATCH',headers:{},body:{key:'videos/awp-the-prince.mp4',hidden:false}},r3);
 assert.deepEqual(r3.body.hidden,[store.projects[0].src]);
 const bad=res();await handler({method:'PATCH',headers:{},body:{key:'../../etc/passwd',hidden:true}},bad);
 assert.equal(bad.code,400);
});

test('public catalogue exposes the taken-down list and the homepage filters it everywhere',async()=>{
 const real=require('../lib/managed-projects');
 const api=load('api/managed-projects.js',{'../lib/managed-projects':{...real,hasStore:()=>true,readSnapshot:async()=>({projects:[],hidden:['videos/awp-the-prince.mp4'],etag:'e'})}});
 const r=res();await api({method:'GET',url:'/api/managed-projects',query:{},headers:{}},r);
 assert.deepEqual(r.body.hidden,['videos/awp-the-prince.mp4']);
 const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.ok(page.includes(`projects.splice(0,projects.length,...allOriginals.filter(e=>!hidden.has(videoKey(e))));`),'galeria não filtra vídeos retirados');
 assert.ok(page.includes('||hidden.has(p.src))continue;'),'uploads retirados continuam aparecendo');
 assert.ok(page.includes('if(!projects.includes(current)&&pool.length){buildDots();pos=-1;go(0);return;}'),'carrossel não pula vídeo retirado');
});
