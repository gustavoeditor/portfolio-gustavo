const {test, afterEach} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname,'..');
const keys=['AI_GATEWAY_API_KEY','OPENAI_API_KEY','VERCEL_OIDC_TOKEN','VERCEL','ADMIN_PASSWORD','ADMIN_SESSION_SECRET'];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
const originalFetch=global.fetch;
afterEach(()=>{for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}global.fetch=originalFetch;});
function load(file, overrides={}){
 const filename=path.join(root,file), mod={exports:{}};const real=createRequire(filename);
 vm.runInThisContext('(function(require,module,exports){'+fs.readFileSync(filename,'utf8')+'\n})',{filename})(name=>Object.hasOwn(overrides,name)?overrides[name]:real(name),mod,mod.exports);
 return mod.exports;
}

test('AI Gateway token comes from the request OIDC header before the library lookup',async()=>{
 for(const k of keys)delete process.env[k];process.env.VERCEL='1';
 let libraryCalled=false;
 const {visualAIConfig,visualAIToken}=load('lib/visual-ai.js',{'@vercel/oidc':{getVercelOidcToken:async()=>{libraryCalled=true;return 'from-library';}}});
 const config=visualAIConfig();
 assert.equal(config.provider,'gateway');
 assert.equal(await visualAIToken(config,{headers:{'x-vercel-oidc-token':'from-header'}}),'from-header');
 assert.equal(libraryCalled,false);
 assert.equal(await visualAIToken(config,{headers:{}}),'from-library');
});

test('missing OIDC token is reported separately from a gateway rejection',async()=>{
 for(const k of keys)delete process.env[k];process.env.VERCEL='1';
 const {visualAIToken}=load('lib/visual-ai.js',{'@vercel/oidc':{getVercelOidcToken:async()=>{throw new Error('no context');}}});
 await assert.rejects(()=>visualAIToken({provider:'gateway'},{headers:{}}),e=>e.name==='MissingAICredentialsError');
});

test('admin analysis explains the real auth failure and never echoes credentials',async()=>{
 for(const k of keys)delete process.env[k];process.env.ADMIN_PASSWORD='fixture';process.env.ADMIN_SESSION_SECRET='fixture-secret';
 const session={validMutation:()=>true,privateHeaders:()=>{},parseJsonBody:req=>req.body};
 const res=()=>({headers:{},setHeader(){return this;},status(c){this.code=c;return this;},json(b){this.body=b;return this;},end(){return this;}});
 const req={method:'POST',headers:{},body:{name:'take.mp4',total:5,frames:['data:image/jpeg;base64,YWJj']}};
 const missing=load('api/admin-analyze.js',{'../lib/admin-session':session,'../lib/visual-ai':{visualAIConfig:()=>({provider:'gateway',url:'https://ai.test',model:'m'}),visualAIToken:async()=>{const e=new Error('x');e.name='MissingAICredentialsError';throw e;}}});
 const r1=res();await missing(req,r1);
 assert.equal(r1.body.reasonCode,'token_missing');
 assert.match(r1.body.explanation,/OIDC/);
 const rejected=load('api/admin-analyze.js',{'../lib/admin-session':session,'../lib/visual-ai':{visualAIConfig:()=>({provider:'gateway',url:'https://ai.test',model:'m'}),visualAIToken:async()=>'tok'}});
 global.fetch=async()=>new Response(JSON.stringify({error:{message:'Bearer abc.def is not allowed: AI Gateway requires a valid credit card'}}),{status:403});
 const r2=res();await rejected(req,r2);
 assert.equal(r2.body.reasonCode,'unauthorized');
 assert.match(r2.body.explanation,/credit card/);
 assert.doesNotMatch(r2.body.explanation,/abc\.def/);
});
