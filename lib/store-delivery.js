'use strict';
const {Readable}=require('node:stream');
const CS=/^cs_live_[A-Za-z0-9_]{15,200}$/,PI=/^pi_[A-Za-z0-9]{12,}$/,CH=/^ch_[A-Za-z0-9]{12,}$/,PL=/^plink_[A-Za-z0-9]{10,}$/;
function settings(env=process.env){
 const cents=Number(env.STORE_TRIO_PRICE_CENTS),linkId=String(env.STORE_TRIO_STRIPE_PAYMENT_LINK_ID||''),pathname=String(env.STORE_TRIO_PRIVATE_BLOB_PATH||''),stripeKey=String(env.STRIPE_SECRET_KEY||''),blobToken=String(env.STORE_TRIO_PRIVATE_BLOB_TOKEN||'');
 const valid=Number.isSafeInteger(cents)&&cents>=100&&cents<=1000000&&PL.test(linkId)&&stripeKey.startsWith('sk_live_')&&stripeKey.length>20&&blobToken.length>30&&/^products\/gustavo-trio\/[a-zA-Z0-9_./-]+\.zip$/.test(pathname)&&!pathname.includes('..');
 return {valid,cents,linkId,pathname,stripeKey,blobToken};
}
function sessionAccepted(s,c,now=Math.floor(Date.now()/1000)){
 return !!(s&&c.valid&&CS.test(String(s.id||''))&&s.object==='checkout.session'&&s.livemode===true&&s.mode==='payment'&&s.status==='complete'&&s.payment_status==='paid'&&s.payment_link===c.linkId&&s.currency==='brl'&&s.amount_total===c.cents&&s.amount_subtotal===c.cents&&PI.test(String(s.payment_intent||''))&&Number.isInteger(s.created)&&s.created<=now&&now-s.created<=48*3600);
}
function chargeAccepted(p,s,c){
 return !!(p&&p.object==='payment_intent'&&p.id===s.payment_intent&&p.livemode===true&&p.status==='succeeded'&&p.currency==='brl'&&p.amount_received===s.amount_total&&CH.test(String(p.latest_charge||''))&&c&&c.object==='charge'&&c.id===p.latest_charge&&c.payment_intent===p.id&&c.paid===true&&c.disputed===false&&c.refunded===false&&c.amount_refunded===0);
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
 if(!c.valid||env.STORE_TRIO_COMMERCIAL_HOSTING_APPROVED!=='true'||env.STORE_TRIO_DELIVERY_READY!=='true'||env.STORE_TRIO_SALES_ENABLED!=='true')return res.status(503).json({error:'Entrega não disponível'});
 const id=typeof req.query?.session_id==='string'?req.query.session_id:'';
 if(!CS.test(id))return res.status(400).json({error:'Sessão inválida'});
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
  stream.on('error',error=>{console.error('Store stream failure',error?.name||'unknown');if(!res.headersSent)res.status(503).end();else res.destroy();});
  return stream.pipe(res);
 }catch(error){console.error('Store delivery failed',error?.name||'unknown');if(!res.headersSent)return res.status(503).json({error:'Não foi possível validar a compra. Tente novamente.'});}
}
module.exports=handler;
module.exports._test={settings,sessionAccepted,chargeAccepted,stripeGet};
