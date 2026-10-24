'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const routes=require('../lib/accounts/routes');
const supabase=require('../lib/accounts/supabase');

const ENV={ACCOUNTS_ENABLED:'true',SUPABASE_URL:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',
  SUPABASE_ANON_KEY:'anon-key-for-tests-0123456789',SUPABASE_SERVICE_ROLE_KEY:'service-key-for-tests-0123456789'};
const USER={id:'11111111-1111-4111-8111-111111111111',email:'cliente@example.com'};
const ORIGIN={origin:'https://portfolio-gustavo-chi.vercel.app',host:'portfolio-gustavo-chi.vercel.app'};
function res(){const headers={};return {headers,setHeader(k,v){headers[k]=v},status(c){this.code=c;return this},json(v){this.value=v;return this}};}
async function call(route,method,deps={},headers={}){
  const r=res();
  await routes({method,query:{conta:route},headers},r,{env:ENV,userFromRequest:async()=>USER,...deps});
  return r;
}

test('config expõe só URL e chave anon, nunca a service_role',async()=>{
  const r=await call('config','GET');
  assert.equal(r.code,200);assert.equal(r.value.enabled,true);
  assert.deepEqual(r.value.auth,{url:ENV.SUPABASE_URL,anonKey:ENV.SUPABASE_ANON_KEY});
  assert.ok(!JSON.stringify(r.value).includes(ENV.SUPABASE_SERVICE_ROLE_KEY));
  assert.equal(r.headers['Cache-Control'],'private, no-store, max-age=0');
  const off=await call('config','GET',{env:{...ENV,ACCOUNTS_ENABLED:'false'}});
  assert.equal(off.value.enabled,false);assert.equal(off.value.auth,null);
});

test('settings rejeita URLs que não são do Supabase',()=>{
  for(const url of ['http://aaaaaaaaaaaaaaaaaaaa.supabase.co','https://evil.example','https://aaaaaaaaaaaaaaaaaaaa.supabase.co.evil.example','https://aaaaaaaaaaaaaaaaaaaa.supabase.co/rest'])
    assert.equal(supabase.settings({...ENV,SUPABASE_URL:url}).url,'',url);
  assert.equal(supabase.settings({...ENV,SUPABASE_SERVICE_ROLE_KEY:ENV.SUPABASE_ANON_KEY}).databaseReady,false);
});

test('biblioteca exige login e consulta pelo e-mail confirmado no servidor',async()=>{
  assert.equal((await call('biblioteca','GET',{userFromRequest:async()=>null})).code,401);
  let args;
  const r=await call('biblioteca','GET',{rpc:async(c,name,a)=>{args={name,...a};return [
    {order_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',product:'creative-tools',status:'paid',amount_cents:3990,purchased_at:'2026-10-22T12:00:00Z',license_hint:'AbCd',license_created_at:'2026-10-22T12:01:00Z'},
    {order_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',product:'creative-tools',status:'refunded',amount_cents:3990,purchased_at:'2026-10-01T12:00:00Z',license_hint:null},
    {order_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',product:'produto-desconhecido',status:'paid'}
  ];}});
  assert.equal(r.code,200);
  assert.deepEqual(args,{name:'account_library',p_email:'cliente@example.com'});
  assert.equal(r.value.purchases.length,2,'produto desconhecido é ignorado');
  assert.equal(r.value.purchases[0].active,true);
  assert.deepEqual(r.value.purchases[0].license,{hint:'AbCd',createdAt:'2026-10-22T12:01:00Z'});
  assert.equal(r.value.purchases[1].active,false);
  assert.equal(r.value.purchases[1].canDownload,false);
});

test('chave de licença: só mesma origem, só hash vai ao banco, sem compra = 403',async()=>{
  const key='ct_'+'Z'.repeat(32);
  assert.equal((await call('licenca','POST',{},{origin:'https://evil.example',host:ORIGIN.host})).code,403);
  assert.equal((await call('licenca','POST',{},{})).code,403);
  let args;
  const ok=await call('licenca','POST',{newLicenseKey:()=>key,rpc:async(c,name,a)=>{args={name,...a};return 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';}},ORIGIN);
  assert.equal(ok.code,200);assert.equal(ok.value.key,key);assert.equal(ok.value.hint,'ZZZZ');
  assert.equal(args.name,'issue_license');
  assert.equal(args.p_key_hash,createHash('sha256').update(key).digest('hex'));
  assert.ok(!JSON.stringify(args).includes(key),'a chave em texto nunca vai ao banco');
  const none=await call('licenca','POST',{rpc:async()=>null},ORIGIN);
  assert.equal(none.code,403);
  assert.equal((await call('licenca','GET',{},ORIGIN)).code,405);
});

test('chaves geradas são únicas e compatíveis com o Creative Hub',()=>{
  const a=routes._test.newLicenseKey(),b=routes._test.newLicenseKey();
  assert.notEqual(a,b);
  assert.match(a,/^ct_[A-Za-z0-9_-]{32}$/);
});

test('JWT do cliente é validado no Supabase Auth e exige e-mail confirmado',async()=>{
  const cfg=supabase.settings(ENV);
  const fake=user=>async(url,opts)=>{assert.equal(url,ENV.SUPABASE_URL+'/auth/v1/user');assert.equal(opts.headers.apikey,ENV.SUPABASE_ANON_KEY);return {ok:true,status:200,text:async()=>JSON.stringify(user)};};
  const req={headers:{authorization:'Bearer aaa.bbb.ccc'}};
  assert.deepEqual(await supabase.userFromRequest(req,cfg,fake({id:USER.id,aud:'authenticated',email:'Cliente@Example.com',email_confirmed_at:'2026-10-22'})),USER);
  assert.equal(await supabase.userFromRequest(req,cfg,fake({id:USER.id,aud:'authenticated',email:'x@y.com',email_confirmed_at:null})),null);
  assert.equal(await supabase.userFromRequest({headers:{authorization:'Bearer semjwt'}},cfg,fake({})),null);
});

test('rotas desconhecidas e área desligada',async()=>{
  assert.equal((await call('admin','GET')).code,404);
  assert.equal((await call('biblioteca','GET',{env:{}})).code,503);
});

test('página /conta: sem segredos, com login por link e área desligada por padrão',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../conta.html'),'utf8');
  const js=fs.readFileSync(path.join(__dirname,'../conta.js'),'utf8');
  assert.match(html,/id="view-off"/);assert.match(html,/id="login-form"/);
  assert.match(html,/name="robots" content="noindex, nofollow"/);
  assert.match(js,/auth\('otp\?redirect_to=/);assert.match(js,/\/auth\/v1\//);
  assert.match(js,/\/api\/conta\/biblioteca/);
  assert.doesNotMatch(html+js,/service_role|SERVICE_ROLE|sk_live_|whsec_/);
});

test('migração: tabelas privadas e funções apenas para service_role',()=>{
  const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261022_contas_cakto.sql'),'utf8');
  for(const t of ['creative_orders','creative_licenses'])assert.match(sql,new RegExp('alter table public\\.'+t+'\\s+enable row level security'));
  for(const fn of ['record_cakto_order','account_library','issue_license','license_is_valid','email_has_paid_order']){
    assert.match(sql,new RegExp('revoke all on function public\\.'+fn+'\\([^)]*\\)\\s+from public, anon, authenticated'));
    assert.match(sql,new RegExp('grant execute on function public\\.'+fn+'\\([^)]*\\)\\s+to service_role'));
  }
  assert.doesNotMatch(sql,/create policy/i,'nenhuma policy: o navegador não lê nada direto');
});

test('rotas publicadas no vercel.json pela função única',()=>{
  const v=JSON.parse(fs.readFileSync(path.join(__dirname,'../vercel.json'),'utf8'));
  const has=(s,d)=>v.rewrites.some(r=>r.source===s&&r.destination===d);
  assert.ok(has('/api/cakto/webhook','/api/managed-projects?cakto=webhook'));
  assert.ok(has('/api/conta/:rota(config|biblioteca|licenca)','/api/managed-projects?conta=:rota'));
  assert.ok(has('/api/creative-hub/download','/api/managed-projects?hub=download'));
  assert.ok(has('/conta','/conta.html'));
  const apiFiles=fs.readdirSync(path.join(__dirname,'../api')).filter(f=>f.endsWith('.js'));
  assert.ok(apiFiles.length<=12,'limite de 12 funções do plano Hobby: '+apiFiles.length);
});
