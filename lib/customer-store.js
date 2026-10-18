'use strict';
// Customer storefront support. Service-role credentials never leave the server.
// Stripe is TEST-ONLY here. Existing production payment links stay untouched.
const {createHash,timingSafeEqual,createHmac}=require('node:crypto');
const {Readable}=require('node:stream');
const PRODUCT='creative-tools',PRICE=7900;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION=/^cs_test_[A-Za-z0-9_]{15,200}$/;
function settings(env=process.env){
 const url=String(env.SUPABASE_URL||'').replace(/\/$/,'');
 let validUrl=false;
 try{const u=new URL(url);validUrl=u.protocol==='https:'&&/^[a-z0-9-]+\.supabase\.co$/.test(u.hostname)&&!u.username&&!u.password&&!u.port&&!u.pathname.replace(/\//g,'')&&!u.search&&!u.hash;}catch(_){}
 const anon=String(env.SUPABASE_ANON_KEY||''),service=String(env.SUPABASE_SERVICE_ROLE_KEY||'');
 const authReady=validUrl&&anon.length>24;
 const databaseReady=authReady&&service.length>24&&service!==anon;
 const testMode=env.VERCEL_ENV==='preview'&&env.STORE_CUSTOMER_TEST_ENABLED==='true';
 const testKey=String(env.STRIPE_TEST_SECRET_KEY||'');
 const stripeReady=testMode&&/^sk_test_[A-Za-z0-9_]{16,}$/.test(testKey);
 const webhookReady=/^whsec_[A-Za-z0-9_]{12,}$/.test(String(env.STRIPE_TEST_WEBHOOK_SECRET||''));
 const cents=Number(env.STORE_CUSTOMER_PRICE_CENTS||PRICE);
 const validPrice=Number.isSafeInteger(cents)&&cents>=100&&cents<=1000000;
 const blobToken=String(env.STORE_TRIO_PRIVATE_BLOB_TOKEN||'');
 const releasePath=String(env.STORE_TRIO_PRIVATE_BLOB_PATH||'');
 const releaseSha=String(env.STORE_TRIO_RELEASE_SHA256||'').toLowerCase();
 const releaseReady=blobToken.length>30&&/^products\/gustavo-trio\/[A-Za-z0-9_./-]+\.zip$/.test(releasePath)&&!releasePath.includes('..')&&/^[a-f0-9]{64}$/.test(releaseSha);
 return {url,anon,service,authReady,databaseReady,testMode,stripeReady,webhookReady,cents,validPrice,testKey,releaseReady,blobToken,releasePath,releaseSha};
}
function responseHeaders(res){res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('X-Robots-Tag','noindex,nofollow,noarchive');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');}
function fail(res,code,why){return res.status(code).json({error:why});}
async function api(url,opts={},http=fetch){
 const resp=await http(url,{...opts,signal:AbortSignal.timeout(10000)});
 if(!resp||!resp.ok)throw new Error('External service '+(resp?.status||'failed'));
 return resp.json();
}
async function userFromRequest(req,c,dependencies={}){
 if(!c.authReady)return null;
 const auth=String(req.headers?.authorization||''),m=/^Bearer ([a-zA-Z0-9._-]{30,5000})$/.exec(auth);
 if(!m)return null;
 try{
  const user=await api(c.url+'/auth/v1/user',{headers:{apikey:c.anon,Authorization:'Bearer '+m[1]}},dependencies.fetch||fetch);
  if(!user||!UUID.test(String(user.id||''))||user.aud!=='authenticated'||!user.email_confirmed_at)return null;
  return {id:user.id,email:user.email||''};
 }catch(_){return null;}
}
async function database(c,method,route,body,dependencies={}){
 if(!c.databaseReady)throw Error('Database not configured');
 const headers={apikey:c.service,Authorization:'Bearer '+c.service,Accept:'application/json'};
 if(body!==undefined){headers['Content-Type']='application/json';headers.Prefer='resolution=ignore-duplicates,return=representation';}
 return api(c.url+'/rest/v1/'+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)},dependencies.fetch||fetch);
}
async function entitlements(c,userId,dependencies={}){
 return database(c,'GET','customer_entitlements?select=product_id,stripe_session_id,price_cents,currency,purchased_at,status&user_id=eq.'+encodeURIComponent(userId)+'&order=purchased_at.desc',undefined,dependencies);
}
async function saveEntitlement(c,userId,session,dependencies={}){
 if(!UUID.test(userId)||!SESSION.test(session.id))throw Error('Entitlement input invalid');
 return database(c,'POST','customer_entitlements?on_conflict=stripe_session_id',[{user_id:userId,product_id:PRODUCT,stripe_session_id:session.id,stripe_payment_intent:typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent.id,price_cents:session.amount_total,currency:'brl',status:'active'}],dependencies);
}
async function stripeGetSession(id,c,dependencies={}){
 if(!SESSION.test(id)||!c.stripeReady)throw Error('Session invalid');
 const p=new URLSearchParams();p.append('expand[]','payment_intent.latest_charge');
 return api('https://api.stripe.com/v1/checkout/sessions/'+encodeURIComponent(id)+'?'+p,{headers:{Authorization:'Bearer '+c.testKey}},dependencies.fetch||fetch);
}
function paidSession(s,userId,c,expectedCents=c.cents){
 if(!Number.isSafeInteger(expectedCents)||expectedCents<100||expectedCents>1000000)return false;
 if(!s||!SESSION.test(String(s.id||''))||s.object!=='checkout.session'||s.livemode!==false||s.mode!=='payment'||s.status!=='complete'||s.payment_status!=='paid'||s.client_reference_id!==userId||s.metadata?.product_id!==PRODUCT||s.metadata?.user_id!==userId||s.currency!=='brl'||s.amount_total!==expectedCents||s.amount_subtotal!==expectedCents)return false;
 const p=s.payment_intent,ch=p?.latest_charge;
 return !!(p&&typeof p==='object'&&p.object==='payment_intent'&&p.livemode===false&&p.status==='succeeded'&&p.currency==='brl'&&p.amount_received===expectedCents&&ch&&typeof ch==='object'&&ch.object==='charge'&&ch.paid===true&&ch.disputed===false&&ch.refunded===false&&ch.amount_refunded===0&&ch.payment_intent===p.id);
}
function requestOrigin(req){
 const host=String(req.headers?.host||'');
 const origin=String(req.headers?.origin||'');
 if(!origin||!host)return false;
 try{const o=new URL(origin);return o.protocol==='https:'&&o.host===host&&!o.username&&!o.password;}catch(_){return false;}
}
function checkoutOrigin(env=process.env,req){
 if(env.VERCEL_ENV!=='preview')return null;
 const host=String(env.VERCEL_URL||'');
 if(!/^[a-z0-9.-]+\.vercel\.app$/i.test(host))return null;
 // Stripe must return to the same origin where the customer's sessionStorage
 // login lives. Accept only deployment/branch aliases configured by Vercel.
 const permitted=[host,env.VERCEL_BRANCH_URL,env.STORE_CUSTOMER_PREVIEW_HOST]
  .filter(x=>typeof x==='string'&&/^[a-z0-9.-]+\.vercel\.app$/i.test(x));
 const origin=String(req?.headers?.origin||'');
 if(origin&&requestOrigin(req)){
  const candidate=new URL(origin);
  if(permitted.includes(candidate.host))return candidate.origin;
 }
 return 'https://'+host;
}
function verifyStripeSignature(raw,header,secret,now=Math.floor(Date.now()/1000)){
 if(typeof secret!=='string'||!/^whsec_[A-Za-z0-9_]{12,}$/.test(secret)||!Buffer.isBuffer(raw)||raw.length>1024*256)return false;
 const data=String(header||'').split(',').map(s=>s.trim().split('='));
 const ts=data.find(([k])=>k==='t')?.[1];if(!/^\d{10}$/.test(ts||''))return false;
 const t=Number(ts);if(Math.abs(now-t)>300)return false;
 const digest=createHmac('sha256',secret).update(ts+'.').update(raw).digest('hex');
 return data.some(([k,v])=>k==='v1'&&typeof v==='string'&&v.length===64&&/^[0-9a-f]{64}$/.test(v)&&timingSafeEqual(Buffer.from(v,'hex'),Buffer.from(digest,'hex')));
}
async function privateArchive(c,deps={}){
 if(!c.releaseReady)throw Error('Release not configured');
 const getBlob=deps.blobGet||require('@vercel/blob').get;
 const result=await getBlob(c.releasePath,{access:'private',token:c.blobToken});
 if(result?.statusCode!==200||!result.stream)throw Error('Release unavailable');
 const stream=typeof result.stream.pipe==='function'?result.stream:Readable.fromWeb(result.stream);
 const chunks=[];let length=0;for await(const part of stream){const chunk=Buffer.from(part);length+=chunk.length;if(length>50*1024*1024)throw Error('Release too large');chunks.push(chunk);}
 const buf=Buffer.concat(chunks);if(!buf.length||!timingSafeEqual(createHash('sha256').update(buf).digest(),Buffer.from(c.releaseSha,'hex')))throw Error('Release integrity invalid');
 return buf;
}
module.exports={PRODUCT,PRICE,settings,responseHeaders,fail,userFromRequest,database,entitlements,saveEntitlement,stripeGetSession,paidSession,requestOrigin,checkoutOrigin,verifyStripeSignature,privateArchive,api};
