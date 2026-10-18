'use strict';
const HOSTS=new Set(['buy.stripe.com']);
const CAKTO_HOSTS=new Set(['pay.cakto.com.br']);
const { _test:delivery }=require('./store-delivery');
function verifiedLink(raw,hosts){
  if(typeof raw!=='string'||!raw||raw.length>512)return null;
  try{
    const url=new URL(raw);
    if(url.protocol!=='https:'||!hosts.has(url.hostname.toLowerCase())||url.username||url.password||url.port||url.hash||url.pathname.length<3)return null;
    if(url.searchParams.has('prefilled_email'))return null;
    return url.href;
  }catch(_){return null;}
}
function paymentLink(raw){return verifiedLink(raw,HOSTS);}
function caktoLink(raw){return verifiedLink(raw,CAKTO_HOSTS);}
function caktoSale(){
 const url=caktoLink(process.env.STORE_CAKTO_CHECKOUT_URL);
 const cents=Number(process.env.STORE_CAKTO_PRICE_CENTS);
 const priceValid=Number.isSafeInteger(cents)&&cents>=500&&cents<=1000000;
 const price=priceValid?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100):null;
 // Cakto hosts payment and delivers the digital product. No Stripe, Supabase,
 // credit-card data, or buyer identities pass through this site.
 const ready=process.env.STORE_TRIO_COMMERCIAL_HOSTING_APPROVED==='true'
  &&process.env.STORE_CAKTO_SALES_ENABLED==='true'
  &&process.env.STORE_CAKTO_DELIVERY_READY==='true'
  &&!!url&&priceValid;
 return {available:ready,link:ready?url:null,price,provider:'cakto'};
}
function sale(){
 // Do not silently fall back to Stripe if the intended Cakto checkout is incomplete.
 if(process.env.STORE_CAKTO_SALES_ENABLED==='true')return caktoSale();
  const link=paymentLink(process.env.STORE_TRIO_CHECKOUT_URL);
  const setup=delivery.settings();
  const price=setup.valid?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(setup.cents/100):null;
  return {available:(setup.testMode||process.env.STORE_TRIO_COMMERCIAL_HOSTING_APPROVED==='true')&&process.env.STORE_TRIO_SALES_ENABLED==='true'&&process.env.STORE_TRIO_DELIVERY_READY==='true'&&!!link&&setup.valid,link,price,provider:'stripe'};
}
module.exports=function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  res.setHeader('Vary','Origin');
  const config=sale();
  if(req.method==='GET')return res.status(200).json({product:'gustavo-trio',available:config.available,priceLabel:config.available?config.price:null,provider:config.available?config.provider:null});
  if(req.method==='POST'){
    const origin=String(req.headers.origin||'');
    const host=String(req.headers.host||'');
    if(origin){try{if(new URL(origin).host!==host)return res.status(403).json({error:'Origem não permitida'});}catch(_){return res.status(403).json({error:'Origem inválida'});}}
    if(!config.available)return res.status(503).json({error:'Vendas ainda não habilitadas'});
    res.setHeader('Location',config.link);
    return res.status(303).end();
  }
  res.setHeader('Allow','GET, POST');
  return res.status(405).json({error:'Método não permitido'});
};
module.exports._test={paymentLink,caktoLink,caktoSale,sale};
