'use strict';
// /api/store/checkout — botão "Comprar" da loja. Redireciona para o checkout oficial da Cakto.
// Bloqueado por padrão: só abre com URL válida, preço configurado e as duas confirmações do
// proprietário (entrega testada + vendas liberadas). O Stripe deixou de ser usado na loja.
const HOST='pay.cakto.com.br';

function paymentLink(raw){
  if(typeof raw!=='string'||!raw||raw.length>512)return null;
  try{
    const url=new URL(raw.trim());
    if(url.protocol!=='https:'||url.hostname.toLowerCase()!==HOST||url.username||url.password||url.port||url.hash||url.search)return null;
    if(!/^\/[A-Za-z0-9_-]{4,80}$/.test(url.pathname))return null;
    return url.href;
  }catch(_){return null;}
}
function sale(env=process.env){
  const link=paymentLink(env.STORE_CAKTO_CHECKOUT_URL);
  const cents=Number(env.STORE_CAKTO_PRICE_CENTS);
  const validPrice=Number.isSafeInteger(cents)&&cents>=100&&cents<=1000000;
  const available=!!link&&validPrice&&env.STORE_CAKTO_DELIVERY_VERIFIED==='true'&&env.STORE_CAKTO_SALES_ENABLED==='true';
  const price=validPrice?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100):null;
  return {available,link,price};
}
module.exports=function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  res.setHeader('Vary','Origin');
  const config=sale();
  if(req.method==='GET')return res.status(200).json({product:'creative-tools',provider:'cakto',available:config.available,priceLabel:config.available?config.price:null});
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
module.exports._test={paymentLink,sale};
