'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{createHash,createHmac}=require('node:crypto'),{Readable}=require('node:stream');
const store=require('../lib/customer-store');
const uid='123e4567-e89b-42d3-a456-426614174000',other='223e4567-e89b-42d3-a456-426614174000';
const env={
 VERCEL_ENV:'preview',VERCEL_URL:'portfolio-test-pr-123.vercel.app',
 STORE_CUSTOMER_TEST_ENABLED:'true',STORE_CUSTOMER_PRICE_CENTS:'7900',
 SUPABASE_URL:'https://gstuff-demo.supabase.co',SUPABASE_ANON_KEY:'public-test-anon-key-123456789101112',
 SUPABASE_SERVICE_ROLE_KEY:'secret-service-role-key-12345678910',
 STRIPE_TEST_SECRET_KEY:'sk_test_1234567891011121314151617181920',
 STORE_TRIO_PRIVATE_BLOB_TOKEN:'fake-private-blob-token-123456789101112',
 STORE_TRIO_PRIVATE_BLOB_PATH:'products/gustavo-trio/creative-tools-v1.4.16.zip',
 STORE_TRIO_RELEASE_SHA256:createHash('sha256').update('PK zip fixture').digest('hex')
};
function purchase(id='cs_test_12345678901234567890123'){
 const intent={object:'payment_intent',id:'pi_12345678901234567890123',livemode:false,status:'succeeded',currency:'brl',amount_received:7900,latest_charge:{object:'charge',id:'ch_12345678901234567890123',payment_intent:'pi_12345678901234567890123',paid:true,disputed:false,refunded:false,amount_refunded:0}};
 return {id,object:'checkout.session',livemode:false,mode:'payment',status:'complete',payment_status:'paid',
 client_reference_id:uid,metadata:{product_id:'creative-tools',user_id:uid},currency:'brl',amount_total:7900,amount_subtotal:7900,payment_intent:intent};
}
test('account configuration fails closed without credentials or release',()=>{
 const c=store.settings({});a.equal(c.authReady,false);a.equal(c.databaseReady,false);a.equal(c.stripeReady,false);a.equal(c.releaseReady,false);
 const prod=store.settings({...env,VERCEL_ENV:'production',STRIPE_TEST_SECRET_KEY:'sk_test_1234567891011121314151617181920'});
 a.equal(prod.testMode,false);a.equal(prod.stripeReady,false);
 const onlyPreview=store.settings({...env,STORE_CUSTOMER_TEST_ENABLED:'false'});a.equal(onlyPreview.stripeReady,false);
 const wrongHost=store.settings({...env,SUPABASE_URL:'https://steal.example.com'});a.equal(wrongHost.authReady,false);
 const valid=store.settings(env);a.equal(valid.databaseReady,true);a.equal(valid.stripeReady,true);a.equal(valid.releaseReady,true);a.equal(valid.cents,7900);
 a.equal(store.checkoutOrigin(env),'https://portfolio-test-pr-123.vercel.app');
 a.equal(store.checkoutOrigin({...env,VERCEL_ENV:'production'}),null);
});
test('strict same-origin and validated Stripe CHECKOUT test session',()=>{
 a.equal(store.requestOrigin({headers:{origin:'https://store.evil.tld',host:'portfolio-test-pr-123.vercel.app'}}),false);
 a.equal(store.requestOrigin({headers:{origin:'https://portfolio-test-pr-123.vercel.app',host:'portfolio-test-pr-123.vercel.app'}}),true);
 const cfg=store.settings(env),s=purchase();a.equal(store.paidSession(s,uid,cfg),true);
 for(const [bad,reason] of [
  [{...s,client_reference_id:other},'wrong customer'],
  [{...s,livemode:true},'live transaction'],
  [{...s,payment_status:'unpaid'},'unpaid'],
  [{...s,metadata:{product_id:'other',user_id:uid}},'wrong product'],
  [{...s,amount_total:7800},'wrong price'],
  [{...s,payment_intent:{...s.payment_intent,status:'processing'}},'pending'],
  [{...s,payment_intent:{...s.payment_intent,latest_charge:{...s.payment_intent.latest_charge,refunded:true}}},'refunded'],
  [{...s,payment_intent:{...s.payment_intent,latest_charge:{...s.payment_intent.latest_charge,disputed:true}}},'disputed'],
  [{...s,payment_intent:{...s.payment_intent,latest_charge:{...s.payment_intent.latest_charge,paid:false}}},'not charged'],
  [{...s,payment_intent:{...s.payment_intent,amount_received:5000}},'short'],
 ])a.equal(store.paidSession(bad,uid,cfg),false,reason);
});
test('existing purchases remain downloadable when catalog price later changes',()=>{
 const current=store.settings({...env,STORE_CUSTOMER_PRICE_CENTS:'12900'});
 const oldPurchase=purchase();
 a.equal(store.paidSession(oldPurchase,uid,current),false,'new sales must follow current price');
 a.equal(store.paidSession(oldPurchase,uid,current,7900),true,'past buyers retain old-price ownership');
 a.equal(store.paidSession(oldPurchase,uid,current,100),false,'cannot substitute a lower purchased price');
 a.equal(store.paidSession(oldPurchase,other,current,7900),false,'original buyer only');
});
test('Stripe webhook signatures prevent tampering and replay',()=>{
 const secret='whsec_1234567891011121314151617181920',now=1792271000;
 const raw=Buffer.from('{"test":true}'),ts=String(now),sig=createHmac('sha256',secret).update(ts+'.').update(raw).digest('hex');
 const h='t='+ts+',v1='+sig;
 a.equal(store.verifyStripeSignature(raw,h,secret,now),true);
 a.equal(store.verifyStripeSignature(Buffer.from('{"test":false}'),h,secret,now),false);
 a.equal(store.verifyStripeSignature(raw,h,secret,now+301),false);
 a.equal(store.verifyStripeSignature(raw,'t='+ts+',v1='+'a'.repeat(64),secret,now),false);
 a.equal(store.verifyStripeSignature(raw,h,'whsec_bad',now),false);
});
test('user is verified through Supabase auth server, not claimed by the browser',async()=>{
 const cfg=store.settings(env);let asked=false;
 const deps={fetch:async(url,options)=>{
  asked=true;a.match(url,/auth\/v1\/user/);a.equal(options.headers.apikey,env.SUPABASE_ANON_KEY);
  return {ok:true,json:async()=>({id:uid,aud:'authenticated',email:'owner@example.test',email_confirmed_at:'2026-10-17T00:00:00Z'})};
 }};
 a.equal(await store.userFromRequest({headers:{}},cfg,deps),null);
 const user=await store.userFromRequest({headers:{authorization:'Bearer '+'a'.repeat(70)}},cfg,deps);
 a.equal(user.id,uid);a.equal(asked,true);
 a.equal(await store.userFromRequest({headers:{authorization:'Bearer '+'a'.repeat(70)}},cfg,{fetch:async()=>({ok:true,json:async()=>({id:uid,aud:'authenticated',email:'x',email_confirmed_at:null})})}),null);
});
test('Supabase entitlement writes are service-role only and user-bound',async()=>{
 const cfg=store.settings(env),s=purchase();let urlString='',headers,parsed;
 await store.saveEntitlement(cfg,uid,s,{fetch:async(url,opts)=>{
  urlString=url;headers=opts.headers;parsed=JSON.parse(opts.body);return{ok:true,json:async()=>parsed};
 }});
 a.match(urlString,/customer_entitlements\?on_conflict=stripe_session_id/);
 a.equal(headers.apikey,env.SUPABASE_SERVICE_ROLE_KEY);
 a.equal(headers.Prefer,'resolution=ignore-duplicates,return=representation','duplicate webhooks must not revive revoked purchases');
 a.equal(parsed[0].user_id,uid);a.equal(parsed[0].stripe_session_id,s.id);
 a.rejects(()=>store.saveEntitlement(cfg,'123-not-a-uuid',s),/Entitlement input invalid/);
});
test('private release integrity validated before streaming',async()=>{
 const cfg=store.settings(env),blobGet=async(path,opts)=>{a.equal(opts.access,'private');a.equal(path,env.STORE_TRIO_PRIVATE_BLOB_PATH);return{statusCode:200,stream:Readable.from([Buffer.from('PK zip fixture')])};};
 const bytes=await store.privateArchive(cfg,{blobGet});a.equal(bytes.toString(),'PK zip fixture');
 await a.rejects(()=>store.privateArchive(cfg,{blobGet:async()=>({statusCode:200,stream:Readable.from([Buffer.from('PK tampered')])})}),/integrity invalid/);
});
test('sales page does not enable live checkout and account page links exist',()=>{
 const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'loja.html'),'utf8'),client=fs.readFileSync(path.join(root,'conta.html'),'utf8');
 a.match(html,/id="checkout" type="submit" disabled/);
 a.match(html,/href="\/conta.html"/);
 a.match(client,/PREÇO PLANEJADO PARA TESTES/);
 a.doesNotMatch(client,/sk_live_|service_role|BLOB_READ_WRITE_TOKEN/);
 for(const file of ['customer-portal.js','lib/customer-store.js','lib/customer-routes/checkout.js','lib/customer-routes/claim.js','lib/customer-routes/library.js','lib/customer-routes/download.js','lib/customer-routes/webhook.js'])new Function(fs.readFileSync(path.join(root,file),'utf8'));
});

test('checkout settings and route stay closed without a valid webhook secret',async()=>{
 const before={...process.env};
 const settingsRoute=require('../lib/customer-routes/settings');
 const checkoutRoute=require('../lib/customer-routes/checkout');
 function response(){return {code:200,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};}
 try{
  Object.assign(process.env,env);delete process.env.STRIPE_TEST_WEBHOOK_SECRET;
  let res=response();settingsRoute({method:'GET'},res);a.equal(res.body.testCheckoutEnabled,false);
  res=response();await checkoutRoute({method:'POST'},res);a.equal(res.code,503);
  process.env.STRIPE_TEST_WEBHOOK_SECRET='whsec_1234567890123456';
  res=response();settingsRoute({method:'GET'},res);a.equal(res.body.testCheckoutEnabled,true);
  process.env.VERCEL_ENV='production';
  res=response();await checkoutRoute({method:'POST'},res);a.equal(res.code,503);
 }finally{for(const key of Object.keys(process.env))if(!(key in before))delete process.env[key];Object.assign(process.env,before);}
});

test('email PKCE callback works in a new tab and rejects expired or implicit callbacks',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');
 const shared=new Map(),storage=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
 const source=fs.readFileSync(require('node:path').join(__dirname,'../customer-portal.js'),'utf8').replace('boot();','globalThis.portal={verifierChallenge,acceptCallback,setConfig:c=>config=c,getSession:()=>session};');
 const calls=[];
 function tab(search='',hash=''){
  const nodes=new Map();
  const context={URL,URLSearchParams,TextEncoder,Uint8Array,crypto:require('node:crypto').webcrypto,btoa:s=>Buffer.from(s,'binary').toString('base64'),localStorage:storage(shared),sessionStorage:storage(new Map()),location:{search,hash,pathname:'/conta.html'},history:{replaceState(...args){calls.push({history:args});}},document:{getElementById(id){if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);}},fetch:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({access_token:'access',refresh_token:'refresh',expires_in:3600})};}};
  vm.runInNewContext(source,context);context.portal.setConfig({auth:{url:'https://example.supabase.co',anonKey:'public'}});return context;
 }
 const first=tab();await first.portal.verifierChallenge();
 const key='creative-tools-pkce-verifier',pending=JSON.parse(shared.get(key));
 const second=tab('?code=valid_auth_code_123456789');await second.portal.acceptCallback();
 a.equal(calls.find(x=>x.url)?.body.code_verifier,pending.verifier);
 a.equal(second.portal.getSession().access_token,'access');a.equal(shared.has(key),false);
 shared.set(key,JSON.stringify({...pending,expiresAt:Date.now()-1}));
 const expired=tab('?code=valid_auth_code_123456789');await expired.portal.acceptCallback();a.equal(expired.portal.getSession(),null);a.equal(shared.has(key),false);
 const implicit=tab('','#access_token=untrusted&refresh_token=untrusted');await implicit.portal.acceptCallback();a.equal(implicit.portal.getSession(),null);
 a.equal(calls.filter(x=>x.url).length,1,'only the valid PKCE callback exchanges credentials');
});
