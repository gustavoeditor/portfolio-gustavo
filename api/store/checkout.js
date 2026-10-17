'use strict';
const HOSTS=new Set(['buy.stripe.com']);
function paymentLink(raw){
  if(typeof raw!=='string'||!raw||raw.length>512)return null;
  try{
    const url=new URL(raw);
    if(url.protocol!=='https:'||!HOSTS.has(url.hostname.toLowerCase())||url.username||url.password||url.port||url.hash||url.pathname.length<3)return null;
    if(url.searchParams.has('prefilled_email'))return null;
    return url.href;
  }catch(_){return null;}
}
function sale(){
  const link=paymentLink(process.env.STORE_TRIO_CHECKOUT_URL);
  const price=String(process.env.STORE_TRIO_PRICE_LABEL||'').trim();
  const validPrice=/^R\\$\\s*[1-9]\\d{0,3}(?:\\.\\d{3})*,\\d{2}$/.test(price);
  return {available:process.env.STORE_TRIO_SALES_ENABLED==='true'&&process.env.STORE_TRIO_DELIVERY_READY==='true'&&!!link&&validPrice,link,price};
}
module.exports=function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  res.setHeader('Vary','Origin');
  const config=sale();
  if(req.method==='GET')return res.status(200).json({product:'gustavo-trio',available:config.available,priceLabel:config.available?config.price:null});
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
