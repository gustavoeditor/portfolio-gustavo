'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const lic=require('../lib/creative-hub-licenses');
const {generateKey,authentic,sha256,paths,KEY}=lic._test;

const SECRET='segredo-webhook-de-teste-123456';
const env={CAKTO_WEBHOOK_SECRET:SECRET,CAKTO_PRODUCT_IDS:'prod_hub, hubshort',CREATIVE_HUB_BLOB_TOKEN:'BLOB_'.repeat(12)};
function memory(){const m=new Map();return {m,async read(p){return m.has(p)?JSON.parse(m.get(p)):null;},async write(p,v){m.set(p,JSON.stringify(v));}};}
function response(){const headers={};return {headers,setHeader(k,v){headers[k]=v},status(c){this.code=c;return this},json(v){this.value=v;return this}};}
const purchase=(event='purchase_approved',over={})=>({secret:SECRET,event,data:{id:'ord_123',refId:'AB12CD',status:'paid',customer:{name:'Cliente',email:'Cliente@Email.com'},product:{id:'prod_hub',short_id:'hubshort',name:'Creative Hub'},...over}});
async function hook(body,{store,headers={},raw}={}){
  const res=response();
  const text=raw??JSON.stringify(body);
  await lic.webhook({method:'POST',headers,rawBody:text},res,{env,store,generateKey:()=>'CH-TESTE-AAAAA-BBBBB-CCCCC'});
  return res;
}

test('chave: formato legível, entropia e compatível com o Hub',()=>{
  const k=generateKey();
  assert.match(k,/^CH-[A-HJ-NP-Z2-9]{5}(-[A-HJ-NP-Z2-9]{5}){3}$/);
  assert.match(k,KEY);
  assert.notEqual(generateKey(),k);
});

test('origem: assinatura HMAC no header ou secret no corpo',()=>{
  const raw='{"event":"x"}';const ts=String(Math.floor(Date.now()/1000));
  const sig='v1='+createHmac('sha256',SECRET).update(ts+'.'+raw).digest('hex');
  assert.equal(authentic({'x-cakto-signature':sig,'x-cakto-timestamp':ts},raw,{},SECRET),true);
  assert.equal(authentic({'x-cakto-signature':sig,'x-cakto-timestamp':ts},raw+' ',{},SECRET),false,'corpo alterado');
  const old=String(Math.floor(Date.now()/1000)-3600);
  const oldSig='v1='+createHmac('sha256',SECRET).update(old+'.'+raw).digest('hex');
  assert.equal(authentic({'x-cakto-signature':oldSig,'x-cakto-timestamp':old},raw,{},SECRET),false,'reenvio antigo');
  assert.equal(authentic({},raw,{secret:SECRET},SECRET),true);
  assert.equal(authentic({},raw,{secret:'outro'},SECRET),false);
  assert.equal(authentic({},raw,{},SECRET),false);
});

test('compra aprovada gera uma licença, de forma idempotente',async()=>{
  const store=memory();
  const r=await hook(purchase(),{store});
  assert.equal(r.code,200);assert.equal(r.value.created,true);
  const key='CH-TESTE-AAAAA-BBBBB-CCCCC';
  assert.equal((await store.read(paths.license(sha256(key)))).status,'active');
  assert.equal(await lic.licenseActive(key,store),true);
  const again=await hook(purchase(),{store});
  assert.equal(again.value.duplicate,true,'reenvio da Cakto não cria outra chave');
  assert.equal(store.m.size,3);
});

test('reembolso e chargeback revogam; outros produtos e eventos são ignorados',async()=>{
  const store=memory();
  await hook(purchase(),{store});
  assert.equal((await hook(purchase('refund'),{store})).value.revoked,true);
  assert.equal(await lic.licenseActive('CH-TESTE-AAAAA-BBBBB-CCCCC',store),false);
  const other=memory();
  assert.equal((await hook(purchase('purchase_approved',{product:{id:'outro'}}),{store:other})).value.ignored,'produto');
  assert.equal((await hook(purchase('pix_gerado'),{store:other})).value.ignored,'evento');
  assert.equal(other.m.size,0);
});

test('webhook recusa origem falsa, método errado e configuração ausente',async()=>{
  const store=memory();
  assert.equal((await hook({...purchase(),secret:'errado'},{store})).code,401);
  assert.equal((await hook(null,{store,raw:'{quebrado'})).code,400);
  const get=response();await lic.webhook({method:'GET',headers:{}},get,{env,store});assert.equal(get.code,405);
  const off=response();await lic.webhook({method:'POST',headers:{},rawBody:'{}'},off,{env:{},store});assert.equal(off.code,503);
  assert.equal(store.m.size,0);
});

test('comprador recupera a chave com e-mail + código; nada vaza com dados errados',async()=>{
  const store=memory();
  await hook(purchase(),{store});
  const ask=async(email,order)=>{const res=response();await lic.retrieve({method:'POST',body:{email,order}},res,{env,store});return res;};
  assert.equal((await ask('cliente@email.com','ord_123')).value.key,'CH-TESTE-AAAAA-BBBBB-CCCCC');
  assert.equal((await ask(' CLIENTE@email.com ','#AB12CD')).value.key,'CH-TESTE-AAAAA-BBBBB-CCCCC','código curto da Cakto');
  const wrong=await ask('outra@pessoa.com','ord_123');
  assert.equal(wrong.code,404);assert.equal(wrong.value.key,undefined);
  assert.equal((await ask('cliente@email.com','../../x')).code,404);
  await hook(purchase('chargeback'),{store});
  assert.equal((await ask('cliente@email.com','ord_123')).code,410);
});
