'use strict';
const c=require('../customer-store');
module.exports=function handler(req,res){
 c.responseHeaders(res);
 if(req.method!=='GET'){res.setHeader('Allow','GET');return c.fail(res,405,'Método não permitido');}
 const s=c.settings();
 const configured=s.authReady&&s.testMode,libraryEnabled=configured&&s.databaseReady;
 const checkoutReady=libraryEnabled&&s.stripeReady&&s.webhookReady&&s.validPrice&&s.releaseReady;
 return res.status(200).json({
  enabled:configured,
  auth:configured?{url:s.url,anonKey:s.anon}:null,
  libraryEnabled,
  providers:[...(process.env.STORE_CUSTOMER_GOOGLE_ENABLED==='true'?['google']:[]),...(process.env.STORE_CUSTOMER_DISCORD_ENABLED==='true'?['discord']:[]),'email'],
  product:{id:c.PRODUCT,name:'Creative Tools',version:'1.4.16',priceCents:s.cents,priceLabel:new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(s.cents/100),priceIsEstimate:true},
  testCheckoutEnabled:checkoutReady,
  testMode:s.testMode,
  message:checkoutReady?'Checkout de teste configurado. Sem cobranças reais.':configured&&!libraryEnabled?'Login de teste disponível; biblioteca e checkout aguardam credencial privada do Supabase.':'Em preparação: conecte Supabase, Stripe TEST e o arquivo privado validado.'
 });
};
