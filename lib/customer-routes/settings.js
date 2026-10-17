'use strict';
const c=require('../customer-store');
module.exports=function handler(req,res){
 c.responseHeaders(res);
 if(req.method!=='GET'){res.setHeader('Allow','GET');return c.fail(res,405,'Método não permitido');}
 const s=c.settings();
 const configured=s.authReady&&s.databaseReady,checkoutReady=configured&&s.stripeReady&&s.validPrice&&s.releaseReady;
 return res.status(200).json({
  enabled:configured,
  auth:s.authReady?{url:s.url,anonKey:s.anon}:null,
  providers:['google','discord','email'],
  product:{id:c.PRODUCT,name:'Creative Tools',version:'1.4.16',priceCents:s.cents,priceLabel:new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(s.cents/100),priceIsEstimate:true},
  testCheckoutEnabled:checkoutReady,
  testMode:s.testMode,
  message:checkoutReady?'Checkout de teste configurado. Sem cobranças reais.':'Em preparação: conecte Supabase, Stripe TEST e o arquivo privado validado.'
 });
};
