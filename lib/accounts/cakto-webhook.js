'use strict';
// POST /api/cakto/webhook — registra compras, reembolsos e chargebacks da Cakto.
// Ref.: https://docs.cakto.com.br/conceitos/webhooks
// - Assinatura X-Cakto-Signature: v1=HMAC-SHA256(secret, "{timestamp}.{corpo cru}"), tolerância de 5 min.
// - Também confere o campo "secret" do corpo (defesa em profundidade).
// - Respostas não-2xx NÃO são retentadas pela Cakto: falha de banco responde 503 para ficar
//   visível no histórico de webhooks e permitir "Reenviar evento" manualmente.
const crypto=require('node:crypto');
const supabase=require('./supabase');

const MAX_BODY_BYTES=128*1024;
const TOLERANCE_SECONDS=5*60;
const EVENTS={purchase_approved:'paid',refund:'refunded',chargeback:'chargedback'};
const PRODUCT='creative-tools';

function equal(a,b){
  if(typeof a!=='string'||typeof b!=='string')return false;
  const left=Buffer.from(a),right=Buffer.from(b);
  return left.length===right.length&&crypto.timingSafeEqual(left,right);
}
function isValidSignature(raw,headers,secret,now=Date.now()){
  const timestamp=String(headers['x-cakto-timestamp']||'');
  const signature=String(headers['x-cakto-signature']||'').toLowerCase();
  if(!/^\d{10,11}$/.test(timestamp)||Math.abs(Math.floor(now/1000)-Number(timestamp))>TOLERANCE_SECONDS)return false;
  if(!/^v1=[a-f0-9]{64}$/.test(signature))return false;
  const expected='v1='+crypto.createHmac('sha256',secret).update(timestamp+'.').update(raw).digest('hex');
  return equal(signature,expected);
}
async function rawRequestBody(req){
  // Corpo já lido como bytes por algum runtime: usar como está. JSON já parseado não serve para HMAC.
  if(Buffer.isBuffer(req.rawBody))return req.rawBody;
  const chunks=[];let size=0;
  for await(const chunk of req){
    const part=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
    size+=part.length;
    if(size>MAX_BODY_BYTES)throw new RangeError('Webhook body too large');
    chunks.push(part);
  }
  if(!size)throw new SyntaxError('Empty webhook body');
  return Buffer.concat(chunks);
}
function settings(env=process.env){
  const secret=String(env.CAKTO_WEBHOOK_SECRET||'');
  const productId=String(env.CAKTO_PRODUCT_ID||'').toLowerCase();
  const offerIds=String(env.CAKTO_OFFER_ID||'').split(',').map(x=>x.trim()).filter(Boolean);
  const priceRaw=String(env.CAKTO_EXPECTED_PRICE_CENTS||'').trim();
  const price=priceRaw?Number(priceRaw):null;
  const db=supabase.settings(env);
  const missing=[
    secret.length>=16||'CAKTO_WEBHOOK_SECRET',
    supabase.UUID.test(productId)||'CAKTO_PRODUCT_ID',
    (offerIds.length>0&&offerIds.length<=10&&offerIds.every(x=>/^[A-Za-z0-9_-]{3,100}$/.test(x)))||'CAKTO_OFFER_ID',
    (price===null||(Number.isSafeInteger(price)&&price>=100&&price<=1000000))||'CAKTO_EXPECTED_PRICE_CENTS',
    db.databaseReady||'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY'
  ].filter(x=>x!==true);
  return {valid:missing.length===0,missing,secret,productId,offerIds,price,db};
}
function acceptedOrder(event,order,cfg){
  if(!order||typeof order!=='object'||Array.isArray(order))return null;
  if(String(order.product?.id||'').toLowerCase()!==cfg.productId)return null;
  if(!cfg.offerIds.includes(String(order.offer?.id||''))||order.offer_type!=='main')return null;
  if(!supabase.UUID.test(String(order.id||''))||String(order.currency||'BRL').toUpperCase()!=='BRL')return null;
  if(order.status!==EVENTS[event])return null;
  const email=String(order.customer?.email||'').trim().toLowerCase();
  if(email.length>254||!supabase.EMAIL.test(email))return null;
  const amount=Number(order.amount);
  if(event==='purchase_approved'){
    if(!Number.isFinite(amount)||amount<=0)return null;
    if(cfg.price!==null&&Math.round(Number(order.offer?.price)*100)!==cfg.price)return null;
  }
  return {
    p_order_id:String(order.id).toLowerCase(),p_product:PRODUCT,p_cakto_product_id:cfg.productId,
    p_offer_id:String(order.offer.id),p_customer_email:email,p_event:event,
    p_amount_cents:Number.isFinite(amount)&&amount>0?Math.round(amount*100):null
  };
}
async function recordOrder(order,cfg,fetchFn){
  await supabase.rpc(cfg.db,'record_cakto_order',order,fetchFn||fetch);
}
function handlerFactory(deps={}){
  return async function handler(req,res){
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('X-Robots-Tag','noindex, nofollow');
    if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido'});}
    const env=deps.env||process.env;
    const cfg=settings(env);
    if(!cfg.valid){
      const body={error:'Integração indisponível'};
      if(env.VERCEL_ENV&&env.VERCEL_ENV!=='production')body.missing=cfg.missing;
      return res.status(503).json(body);
    }
    if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return res.status(415).json({error:'Formato não suportado'});
    try{
      const raw=await (deps.readBody||rawRequestBody)(req);
      if(!Buffer.isBuffer(raw)||raw.length>MAX_BODY_BYTES)return res.status(413).json({error:'Payload excessivo'});
      if(!isValidSignature(raw,req.headers,cfg.secret,deps.now||Date.now()))return res.status(401).json({error:'Assinatura inválida'});
      const payload=JSON.parse(raw.toString('utf8'));
      if(!equal(payload?.secret,cfg.secret)||typeof payload?.event!=='string')return res.status(401).json({error:'Evento inválido'});
      if(!Object.prototype.hasOwnProperty.call(EVENTS,payload.event))return res.status(200).json({ok:true,ignored:true});
      const orders=Array.isArray(payload.data)?payload.data:[payload.data];
      if(!orders.length||orders.length>25)return res.status(400).json({error:'Formato de evento inválido'});
      const selected=orders.map(o=>acceptedOrder(payload.event,o,cfg)).filter(Boolean);
      for(const order of selected)await (deps.recordOrder||recordOrder)(order,cfg,deps.fetch);
      return res.status(200).json({ok:true,processed:selected.length});
    }catch(error){
      if(error instanceof RangeError)return res.status(413).json({error:'Payload excessivo'});
      if(error instanceof SyntaxError)return res.status(400).json({error:'JSON inválido'});
      // Nunca registrar corpo, e-mail, assinatura ou credenciais.
      console.error('Cakto webhook processing failed:',error?.name||'unknown');
      return res.status(503).json({error:'Não foi possível registrar o evento'});
    }
  };
}
module.exports=handlerFactory();
module.exports._test={equal,isValidSignature,rawRequestBody,settings,acceptedOrder,recordOrder,handlerFactory};
