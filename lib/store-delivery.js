'use strict';
const {Readable}=require('node:stream');
const {createHash,timingSafeEqual}=require('node:crypto');
const CS=/^cs_(?:live|test)_[A-Za-z0-9_]{15,200}$/,PI=/^pi_[A-Za-z0-9]{12,}$/,CH=/^ch_[A-Za-z0-9]{12,}$/,PL=/^plink_[A-Za-z0-9]{10,}$/;
function settings(env=process.env){
 const cents=Number(env.STORE_TRIO_PRICE_CENTS),linkId=String(env.STORE_TRIO_STRIPE_PAYMENT_LINK_ID||''),pathname=String(env.STORE_TRIO_PRIVATE_BLOB_PATH||''),stripeKey=String(env.STRIPE_SECRET_KEY||''),blobToken=String(env.STORE_TRIO_PRIVATE_BLOB_TOKEN||''),sha256=String(env.STORE_TRIO_RELEASE_SHA256||'').toLowerCase();
 const testMode=env.STORE_TRIO_TEST_MODE==='true'&&env.VERCEL_ENV==='preview';
 const valid=Number.isSafeInteger(cents)&&cents>=100&&cents<=1000000&&PL.test(linkId)&&stripeKey.startsWith(testMode?'sk_test_':'sk_live_')&&stripeKey.length>20&&blobToken.length>30&&/^[a-f0-9]{64}$/.test(sha256)&&/^products\/gustavo-trio\/[a-zA-Z0-9_./-]+\.zip$/.test(pathname)&&!pathname.includes('..');
 return {valid,cents,linkId,pathname,stripeKey,blobToken,sha256,testMode};
}
function sessionAccepted(s,c,now=Math.floor(Date.now()/1000)){
 return !!(s&&c.valid&&CS.test(String(s.id||''))&&String(s.id).startsWith(c.testMode?'cs_test_':'cs_live_')&&s.object==='checkout.session'&&s.livemode===!c.testMode&&s.mode==='payment'&&s.status==='complete'&&s.payment_status==='paid'&&s.payment_link===c.linkId&&s.currency==='brl'&&s.amount_total===c.cents&&s.amount_subtotal===c.cents&&PI.test(String(s.payment_intent||''))&&Number.isInteger(s.created)&&s.created<=now&&now-s.created<=48*3600);
}
function chargeAccepted(p,s,c){
 return !!(p&&p.object==='payment_intent'&&p.id===s.payment_intent&&p.livemode===s.livemode&&p.status==='succeeded'&&p.currency==='brl'&&p.amount_received===s.amount_total&&CH.test(String(p.latest_charge||''))&&c&&c.object==='charge'&&c.id===p.latest_charge&&c.payment_intent===p.id&&c.paid===true&&c.disputed===false&&c.refunded===false&&c.amount_refunded===0);
}
async function stripeGet(path,key,http=fetch){
 const response=await http('https://api.stripe.com/v1/'+path,{method:'GET',headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(8500)});
 if(!response||!response.ok)throw Error('Stripe unavailable');
 return response.json();
}
async function handler(req,res,deps={}){
 const env=deps.env||process.env,c=settings(env);
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Método não permitido'});}
 if(!c.valid||(!c.testMode&&env.STORE_TRIO_COMMERCIAL_HOSTING_APPROVED!=='true')||env.STORE_TRIO_DELIVERY_READY!=='true'||env.STORE_TRIO_SALES_ENABLED!=='true')return res.status(503).json({error:'Entrega não disponível'});
 const id=typeof req.query?.session_id==='string'?req.query.session_id:'';
 if(!CS.test(id)||!id.startsWith(c.testMode?'cs_test_':'cs_live_'))return res.status(400).json({error:'Sessão inválida'});
 const getStripe=deps.stripeGet||stripeGet;
 try{
  const s=await getStripe('checkout/sessions/'+encodeURIComponent(id),c.stripeKey);
  if(!sessionAccepted(s,c,deps.nowSec??Math.floor(Date.now()/1000)))return res.status(403).json({error:'Compra não habilitada para download'});
  const p=await getStripe('payment_intents/'+encodeURIComponent(s.payment_intent),c.stripeKey);
  if(!CH.test(String(p?.latest_charge||'')))return res.status(403).json({error:'Pagamento não confirmado'});
  const charge=await getStripe('charges/'+encodeURIComponent(p.latest_charge),c.stripeKey);
  if(!chargeAccepted(p,s,charge))return res.status(403).json({error:'Pagamento não confirmado'});
  const getBlob=deps.blobGet||require('@vercel/blob').get;
  const result=await getBlob(c.pathname,{access:'private',token:c.blobToken});
  if(!result||result.statusCode!==200||!result.stream)return res.status(503).json({error:'Arquivo indisponível'});
  res.setHeader('Content-Type','application/zip');
  res.setHeader('Content-Disposition','attachment; filename="Gustavo_Trio.zip"');
  res.setHeader('X-Download-Options','noopen');
  const stream=typeof result.stream.pipe==='function'?result.stream:Readable.fromWeb(result.stream);
  const chunks=[];let size=0;
  for await(const item of stream){
   const chunk=Buffer.from(item);size+=chunk.length;
   if(size>50*1024*1024)throw new Error('Oversized release file');
   chunks.push(chunk);
  }
  const archive=Buffer.concat(chunks),digest=createHash('sha256').update(archive).digest();
  if(!archive.length||!timingSafeEqual(digest,Buffer.from(c.sha256,'hex')))
   return res.status(503).json({error:'Integridade do arquivo não validada'});
  res.setHeader('Content-Length',String(archive.length));
  res.status(200);
  // Stream after integrity validation: avoids the standard Vercel 4.5 MB response limit.
  const chunks=(function*(){for(let offset=0;offset<archive.length;offset+=65536)yield archive.subarray(offset,offset+65536);})();
  return Readable.from(chunks).pipe(res);
 }catch(error){console.error('Store delivery failed',error?.name||'unknown');if(!res.headersSent)return res.status(503).json({error:'Não foi possível validar a compra. Tente novamente.'});}
}
module.exports=handler;
module.exports._test={settings,sessionAccepted,chargeAccepted,stripeGet};
