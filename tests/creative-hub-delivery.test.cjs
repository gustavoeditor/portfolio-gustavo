'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {Readable}=require('node:stream');
const handler=require('../lib/creative-hub-delivery');
const {settings,licensed,published,parseRange,CHUNK}=handler._test;
const realFeed=require('../updates/creative-tools/hub-manifest.json');

const body=Buffer.alloc(CHUNK*2+1234,7);
const key='hubTESTkey_0123456789abcdefghijklmnopqrstuvwxyz';
const hash=s=>createHash('sha256').update(s).digest('hex');
const env={
  CT_HUB_ENABLED:'true',CT_HUB_VERSION:'1.5.1',
  CT_HUB_PRIVATE_BLOB_PATH:'creative-hub/packages/creative-tools/Creative_Tools_Setup_1.5.1.exe',
  CT_HUB_PRIVATE_BLOB_TOKEN:'BLOB_'.repeat(12),CT_HUB_LICENSE_SHA256:hash(key),
  CT_HUB_SHA256:hash(body),CT_HUB_SIZE:String(body.length)
};
const feed={schemaVersion:1,product:'creative-tools',latest:'1.5.1',releases:[{version:'1.5.1',status:'published',sha256:hash(body),size:body.length}]};
const blob=b=>async()=>({statusCode:200,stream:Readable.from([b])});
const query={product:'creative-tools',version:'1.5.1'};
function response(){
  const headers={};
  return {headers,setHeader(k,v){headers[k]=v},status(code){this.code=code;return this},json(v){this.value=v;return this},send(v){this.value=v;return this}};
}
async function call(headers,deps={}){
  const res=response();
  await handler({method:'GET',query:deps.query||query,headers},res,{env,feed,blobGet:blob(body),...deps});
  return res;
}

test('configuração estrita e separada do canal ZXP',()=>{
  assert.equal(settings(env).valid,true);
  assert.equal(settings({...env,CT_HUB_LICENSE_SHA256:''}).valid,false);
  assert.equal(settings({...env,CT_HUB_PRIVATE_BLOB_PATH:'creative-tools/releases/x.zxp'}).valid,false);
  assert.equal(settings({...env,CT_HUB_PRIVATE_BLOB_PATH:'creative-hub/packages/creative-tools/../x.exe'}).valid,false);
  assert.equal(settings({...env,CT_HUB_SIZE:'0'}).valid,false);
  assert.equal(settings({...env,CT_HUB_ENABLED:'false'}).valid,false);
  assert.equal(licensed('Bearer '+key,settings(env)),true);
  assert.equal(licensed('Bearer '+key+'x',settings(env)),false);
});

test('intervalos HTTP Range',()=>{
  assert.deepEqual(parseRange(undefined,10),{start:0,end:9});
  assert.deepEqual(parseRange('bytes=0-',CHUNK*3),{start:0,end:CHUNK-1});
  assert.deepEqual(parseRange('bytes=5-2',10),null);
  assert.deepEqual(parseRange('bytes=10-',10),null);
  assert.deepEqual(parseRange('bytes=0-99999999',10),{start:0,end:9});
  assert.equal(parseRange('bytes=0-1,4-5',10),null);
});

test('sem licença: 403 antes de tocar no storage',async()=>{
  let touched=false;
  const res=await call({},{blobGet:()=>{touched=true}});
  assert.equal(res.code,403);assert.equal(touched,false);
  const bad=await call({authorization:'Bearer '+'x'.repeat(40)},{blobGet:()=>{touched=true}});
  assert.equal(bad.code,403);assert.equal(touched,false);
});

test('entrega em partes que reconstroem exatamente o pacote',async()=>{
  const parts=[];let start=0;
  while(start<body.length){
    const res=await call({authorization:'Bearer '+key,range:`bytes=${start}-`});
    assert.equal(res.code,206);
    assert.ok(res.value.length<=CHUNK);
    assert.equal(res.headers['Content-Range'],`bytes ${start}-${start+res.value.length-1}/${body.length}`);
    parts.push(res.value);start+=res.value.length;
  }
  assert.equal(parts.length,3);
  assert.equal(hash(Buffer.concat(parts)),hash(body));
});

test('blob adulterado, versão não publicada ou produto errado nunca são servidos',async()=>{
  const tampered=Buffer.from(body);tampered[0]^=1;
  assert.equal((await call({authorization:'Bearer '+key},{blobGet:blob(tampered)})).code,503);
  let touched=false;
  for(const bad of [{...feed,latest:null},{...feed,releases:[{...feed.releases[0],status:'preview'}]},{...feed,releases:[{...feed.releases[0],size:1}]}]){
    const res=await call({authorization:'Bearer '+key},{feed:bad,blobGet:()=>{touched=true}});
    assert.equal(res.code,503);
  }
  assert.equal((await call({authorization:'Bearer '+key},{query:{product:'creative-cut',version:'1.5.1'},blobGet:()=>{touched=true}})).code,404);
  assert.equal(touched,false);
  assert.equal((await call({authorization:'Bearer '+key,range:'bytes=999999999-'})).code,416);
});

test('feed real do Hub: release licenciada, relativa ao site e sem binário no repositório',()=>{
  assert.equal(realFeed.schemaVersion,1);
  const r=realFeed.releases.find(x=>x.version===realFeed.latest);
  assert.ok(r,'latest aponta para release existente');
  assert.equal(r.auth,'license');
  assert.match(r.downloadUrl,/^\/api\/creative-hub\/download\?product=creative-tools&version=/);
  assert.match(r.sha256,/^[a-f0-9]{64}$/);
  assert.ok(Number.isSafeInteger(r.size)&&r.size>0);
  assert.equal(r.rangeChunkSize,CHUNK);
});

test('diagnóstico lista só nomes inválidos e nunca em produção',async()=>{
  const bad={...env,CT_HUB_SIZE:'abc',CT_HUB_PRIVATE_BLOB_PATH:'https://x.private.blob.vercel-storage.com/a.exe'};
  const pre=response();
  await handler({method:'GET',query,headers:{}},pre,{env:{...bad,VERCEL_ENV:'preview'},feed});
  assert.equal(pre.code,503);
  assert.deepEqual(pre.value.invalid,['CT_HUB_PRIVATE_BLOB_PATH','CT_HUB_SIZE']);
  assert.ok(!JSON.stringify(pre.value).includes('blob.vercel-storage'),'sem valores');
  const prod=response();
  await handler({method:'GET',query,headers:{}},prod,{env:{...bad,VERCEL_ENV:'production'},feed});
  assert.equal(prod.value.invalid,undefined);
});

// ---- Contas: licença emitida em /conta (Supabase) e sessão do site ----
const accountsEnv={...env,CT_HUB_LICENSE_SHA256:'',ACCOUNTS_ENABLED:'true',
  SUPABASE_URL:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',SUPABASE_ANON_KEY:'anon-key-for-tests-0123456789',
  SUPABASE_SERVICE_ROLE_KEY:'service-key-for-tests-0123456789'};
const customerKey='ct_'+'A'.repeat(32);
const jwt='aaaa.bbbb.cccc';

test('sem chaves de teste, a entrega exige contas configuradas',()=>{
  assert.equal(settings({...env,CT_HUB_LICENSE_SHA256:''}).valid,false);
  const s=settings(accountsEnv);
  assert.equal(s.valid,true);assert.equal(s.deliveryReady,true);
  assert.equal(settings({...accountsEnv,ACCOUNTS_ENABLED:'false'}).valid,false);
});

test('chave do cliente é conferida pelo hash no banco; revogada não baixa',async()=>{
  const seen=[];
  const rpcOk=async(cfg,name,args)=>{seen.push({name,args});return args.p_key_hash===hash(customerKey);};
  const ok=await call({authorization:'Bearer '+customerKey,range:'bytes=0-'},{env:accountsEnv,rpc:rpcOk});
  assert.equal(ok.code,206);
  assert.equal(seen[0].name,'license_is_valid');
  assert.equal(seen[0].args.p_key_hash,hash(customerKey),'só o hash sai do servidor');
  let touched=false;
  const revoked=await call({authorization:'Bearer '+customerKey},{env:accountsEnv,rpc:async()=>false,blobGet:()=>{touched=true}});
  assert.equal(revoked.code,403);assert.equal(touched,false);
});

test('sessão do site baixa só com compra paga no mesmo e-mail',async()=>{
  const user=async()=>({id:'11111111-1111-4111-8111-111111111111',email:'cliente@example.com'});
  const paid=await call({authorization:'Bearer '+jwt},{env:accountsEnv,userFromRequest:user,rpc:async(c,name,args)=>name==='email_has_paid_order'&&args.p_email==='cliente@example.com'});
  assert.equal(paid.code,206);
  const unpaid=await call({authorization:'Bearer '+jwt},{env:accountsEnv,userFromRequest:user,rpc:async()=>false});
  assert.equal(unpaid.code,403);
  const anon=await call({authorization:'Bearer '+jwt},{env:accountsEnv,userFromRequest:async()=>null,rpc:async()=>true});
  assert.equal(anon.code,403);
});

test('falha no banco nega o download (fail closed)',async()=>{
  const res=await call({authorization:'Bearer '+customerKey},{env:accountsEnv,rpc:async()=>{throw new Error('down')}});
  assert.equal(res.code,403);
});
