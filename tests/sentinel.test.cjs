'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sentinel=require('../lib/sentinel');
const ingest=require('../api/sentinel-event');
const status=require('../api/sentinel-status');
const panel=require('../api/sentinel-panel');
const config=JSON.parse(readFileSync(path.join(root,'vercel.json'),'utf8'));
function res(){
 return {headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;return this;},status(n){this.statusCode=n;return this;},end(){this.done=true;return this;},json(x){this.data=x;return this;},send(x){this.body=x;return this;}};
}
function req(method='GET',extra={}){
 return {method,headers:{host:'portfolio-gustavo-chi.vercel.app',origin:'https://portfolio-gustavo-chi.vercel.app','content-type':'application/json',...extra},body:{type:'video_error',component:'player'}};
}
test('Allow only known technical events; discard all visitor data',()=>{
 assert.deepEqual(sentinel.sanitize({type:'video_error',component:'player',url:'https://private',email:'x@y.com',stack:'private'}),{type:'video_error',component:'player'});
 for(const payload of [null,[],{type:'x',component:'player'},{type:'runtime_error',component:'x'},
  {type:'runtime_error',component:'page?name=secret'},{type:'video_error',component:'player/subroute'}])
  assert.equal(sentinel.sanitize(payload),null);
});
test('Same-origin only and no anonymous access to administrative reports',async()=>{
 const outside=req('POST',{origin:'https://evil.example'});
 const forbidden=res();await ingest(outside,forbidden);assert.equal(forbidden.statusCode,403);
 const read=res();await status(req('GET'),read);assert.equal(read.statusCode,401);
 assert.equal(read.headers['Cache-Control'],'no-store, private');
 const page=res();panel(req('GET'),page);
 assert.equal(page.statusCode,302);
 assert.equal(page.headers.Location,'/admin');
});
test('No remote writes without Redis-backed shared rate limiting',async()=>{
 const prior={url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN};
 try{
  delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_TOKEN;
  assert.equal(sentinel.enabled(),false);
  const reply=res();await ingest(req('POST'),reply);assert.equal(reply.statusCode,503);
 }finally{
  if(prior.url!==undefined)process.env.UPSTASH_REDIS_REST_URL=prior.url;
  if(prior.token!==undefined)process.env.UPSTASH_REDIS_REST_TOKEN=prior.token;
 }
});
test('Private route, important UI and automatic monitor stay present',()=>{
 const html=readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(html,/src="\/sentinel-client\.js\?v=1"/);
 assert.match(html,/id="quote-floating-trigger"/);
 assert.match(html,/GustavoPlayer\.mount/);
 assert.match(html,/data:image\/webp;base64/);
 assert.match(html,/\/ambience\.js\?v=2/);
 const js=readFileSync(path.join(root,'sentinel-client.js'),'utf8');
 assert.match(js,/cover_failure/);assert.match(js,/video_stall/);
 assert.doesNotMatch(js,/document\.querySelectorAll\('input'/);
 const paths=config.rewrites.map(x=>x.source);
 assert.ok(paths.includes('/sentinel')&&paths.includes('/admin/sentinel'));
 const scheduled=readFileSync(path.join(root,'.github/workflows/sentinel.yml'),'utf8');
 assert.match(scheduled,/cron: '17,47 \* \* \* \*'/);
 assert.match(scheduled,/issues: write/);
 assert.match(readFileSync(path.join(root,'scripts/sentinel-check.cjs'),'utf8'),/GustavoSentinelHealth/);
});
