'use strict';
// Checkout do Creative Tools: pagamento e entrega acontecem na Cakto.
// O site apenas informa disponibilidade/preço e aponta para o link oficial.
const HOSTS=new Set(['pay.cakto.com.br']);
const DEFAULT_LINK='https://pay.cakto.com.br/g6gcpgr_1217766';
const DEFAULT_CENTS=3990;
function paymentLink(raw){
  if(typeof raw!=='string'||!raw||raw.length>512)return null;
  try{
    const url=new URL(raw);
    if(url.protocol!=='https:'||!HOSTS.has(url.hostname.toLowerCase())||url.username||url.password||url.port||url.hash||url.pathname.length<3)return null;
    if(url.searchParams.has('email')||url.searchParams.has('prefilled_email'))return null;
    return url.href;
  }catch(_){return null;}
}
function cents(raw){
  if(raw===undefined||raw==='')return DEFAULT_CENTS;
  if(!/^\d{3,7}$/.test(String(raw)))return null;
  return Number(raw);
}
function sale(){
  const env=process.env;
  // Variáveis opcionais: sem nenhuma configurada, vale o link/preço oficiais acima.
  const link=env.STORE_CT_CHECKOUT_URL?paymentLink(env.STORE_CT_CHECKOUT_URL):DEFAULT_LINK;
  const value=cents(env.STORE_CT_PRICE_CENTS);
  const price=value?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100):null;
  // STORE_CT_SALES_DISABLED=true desliga o botão da loja sem novo deploy de código.
  return {available:env.STORE_CT_SALES_DISABLED!=='true'&&!!link&&!!price,link,price};
}
module.exports=function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  res.setHeader('Vary','Origin');
  const config=sale();
  if(req.method==='GET')return res.status(200).json({product:'creative-tools',provider:'cakto',available:config.available,priceLabel:config.available?config.price:null,checkoutUrl:config.available?config.link:null});
  if(req.method==='POST'){
    const origin=String(req.headers.origin||'');
    const host=String(req.headers.host||'');
    if(origin){try{if(new URL(origin).host!==host)return res.status(403).json({error:'Origem não permitida'});}catch(_){return res.status(403).json({error:'Origem inválida'});}}
    if(!config.available)return res.status(503).json({error:'Vendas pausadas'});
    res.setHeader('Location',config.link);
    return res.status(303).end();
  }
  res.setHeader('Allow','GET, POST');
  return res.status(405).json({error:'Método não permitido'});
};
module.exports._test={paymentLink,sale,DEFAULT_LINK};
