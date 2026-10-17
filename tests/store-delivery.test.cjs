const {test}=require('node:test'),assert=require('node:assert/strict'),handler=require('../lib/store-delivery');
const {settings,sessionAccepted,chargeAccepted}=handler._test,now=1800000000;
const env={STORE_TRIO_PRICE_CENTS:'7900',STORE_TRIO_STRIPE_PAYMENT_LINK_ID:'plink_1234567890123456',STRIPE_SECRET_KEY:['sk','live','123456789012345678901234567890'].join('_'),STORE_TRIO_PRIVATE_BLOB_TOKEN:['blob','fake','123456789012345678901234567890123456'].join('_'),STORE_TRIO_PRIVATE_BLOB_PATH:'products/gustavo-trio/release-1.3.zip',STORE_TRIO_DELIVERY_READY:'true',STORE_TRIO_SALES_ENABLED:'true',STORE_TRIO_COMMERCIAL_HOSTING_APPROVED:'true'};
const session={object:'checkout.session',id:['cs','live','abcdefghijklmnopqrstuv'].join('_'),livemode:true,mode:'payment',status:'complete',payment_status:'paid',payment_link:env.STORE_TRIO_STRIPE_PAYMENT_LINK_ID,currency:'brl',amount_total:7900,amount_subtotal:7900,payment_intent:'pi_abcdefghijklmnopqrst',created:now-200};
const intent={object:'payment_intent',id:session.payment_intent,livemode:true,status:'succeeded',currency:'brl',amount_received:7900,latest_charge:'ch_abcdefghijklmnopqrst'};
const charge={object:'charge',id:intent.latest_charge,payment_intent:intent.id,paid:true,disputed:false,refunded:false,amount_refunded:0};
async function mock(input,overrides={}){
 const res={code:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(b){this.body=b;return this},end(){return this}};
 await handler(input,res,{env:overrides.env||env,nowSec:now,stripeGet:overrides.stripeGet|| (async path=>path.startsWith('checkout')?session:path.startsWith('payment_intents')?intent:charge),blobGet:overrides.blobGet|| (async()=>({statusCode:404}))});
 return res;
}
test('requires private store, live Stripe, price and identity',()=>{assert.equal(settings({}).valid,false);assert.equal(settings(env).valid,true);
 for(const field of ['STORE_TRIO_PRIVATE_BLOB_TOKEN','STORE_TRIO_PRIVATE_BLOB_PATH','STRIPE_SECRET_KEY','STORE_TRIO_STRIPE_PAYMENT_LINK_ID','STORE_TRIO_PRICE_CENTS'])assert.equal(settings({...env,[field]:''}).valid,false,field);
 assert.equal(settings({...env,STORE_TRIO_PRIVATE_BLOB_PATH:'products/gustavo-trio/../evil.zip'}).valid,false);
});
test('only genuine paid live session for product, price and 48h',()=>{const cfg=settings(env);assert.equal(sessionAccepted(session,cfg,now),true);
 for(const field of ['payment_status','payment_link','amount_total','amount_subtotal','livemode','mode','status','payment_intent','id'])assert.equal(sessionAccepted({...session,[field]:null},cfg,now),false,field);
 assert.equal(sessionAccepted({...session,created:now-49*3600},cfg,now),false);});
test('refunded, disputed or incomplete charge never fulfills',()=>{assert.equal(chargeAccepted(intent,session,charge),true);
 for(const changed of [{refunded:true},{disputed:true},{amount_refunded:100},{paid:false},{id:'wrong'}])assert.equal(chargeAccepted(intent,session,{...charge,...changed}),false);});
test('delivery disabled until explicit release flags',async()=>{assert.equal((await mock({method:'GET',query:{session_id:session.id}},{env:{...env,STORE_TRIO_SALES_ENABLED:'false'}})).code,503);});
test('bad session blocked without Stripe network',async()=>{assert.equal((await mock({method:'GET',query:{session_id:'cs_fake'}},{stripeGet:()=>{throw Error('never')}})).code,400);});
test('paid wrong product rejected',async()=>{const r=await mock({method:'GET',query:{session_id:session.id}},{stripeGet:async p=>p.startsWith('checkout')?{...session,payment_link:'plink_other'}:p.startsWith('payment_intents')?intent:charge});assert.equal(r.code,403);});
test('refund rejected',async()=>{const r=await mock({method:'GET',query:{session_id:session.id}},{stripeGet:async p=>p.startsWith('checkout')?session:p.startsWith('payment_intents')?intent:{...charge,refunded:true}});assert.equal(r.code,403);});
test('private blob pathname not accepted from client',async()=>{let asked;const r=await mock({method:'GET',query:{session_id:session.id,pathname:'evil.zip'}},{blobGet:async path=>{asked=path;return {statusCode:404}}});assert.equal(asked,'products/gustavo-trio/release-1.3.zip');assert.equal(r.code,503);});
test('no non-GET',async()=>{assert.equal((await mock({method:'POST',query:{session_id:session.id}})).code,405);});

test('requires allowed commercial hosting before any download',async()=>{const result=await mock({method:'GET',query:{session_id:session.id}},{env:{...env,STORE_TRIO_COMMERCIAL_HOSTING_APPROVED:'false'}});assert.equal(result.code,503);});

test('Stripe test checkout allowed only on preview and never in production',()=>{
 const testEnv={...env,VERCEL_ENV:'preview',STORE_TRIO_TEST_MODE:'true',STRIPE_SECRET_KEY:['sk','test','123456789012345678901234567890'].join('_')};
 const cfg=settings(testEnv);assert.equal(cfg.valid,true);assert.equal(cfg.testMode,true);
 const sandboxSession={...session,id:['cs','test','abcdefghijklmnopqrstuv'].join('_'),livemode:false};
 assert.equal(sessionAccepted(sandboxSession,cfg,now),true);
 assert.equal(sessionAccepted(session,cfg,now),false);
 assert.equal(settings({...testEnv,VERCEL_ENV:'production'}).valid,false);
 assert.equal(settings({...testEnv,STORE_TRIO_TEST_MODE:'false'}).valid,false);
});

test('valid paid session streams only the private product ZIP',async()=>{
 const {Readable,Writable}=require('node:stream');
 const bytes=[],headers={};
 const res=new Writable({write(chunk,encoding,done){bytes.push(Buffer.from(chunk));done();}});
 res.setHeader=(k,v)=>{headers[k]=v;};res.status=function(c){this.statusCode=c;return this;};
 res.json=function(obj){throw Error('Unexpected error '+JSON.stringify(obj));};
 const completed=new Promise((resolve,reject)=>{res.once('finish',resolve);res.once('error',reject);});
 let pathUsed='',accessUsed='';
 await handler({method:'GET',query:{session_id:session.id}},res,{
   env,nowSec:now,
   stripeGet:async p=>p.startsWith('checkout')?session:p.startsWith('payment_intents')?intent:charge,
   blobGet:async (path,opts)=>{pathUsed=path;accessUsed=opts.access;return {statusCode:200,stream:Readable.from([Buffer.from('PK ZIP INTERNAL')])};}
 });
 await completed;
 assert.equal(pathUsed,env.STORE_TRIO_PRIVATE_BLOB_PATH);assert.equal(accessUsed,'private');
 assert.equal(headers['Content-Type'],'application/zip');
 assert.match(headers['Content-Disposition'],/attachment/);
 assert.equal(Buffer.concat(bytes).toString(),'PK ZIP INTERNAL');
});
