'use strict';
const c=require('../customer-store');
module.exports=async function handler(req,res){
 c.responseHeaders(res);
 if(req.method!=='POST'){res.setHeader('Allow','POST');return c.fail(res,405,'Método não permitido');}
 const s=c.settings(),origin=c.checkoutOrigin(process.env,req);
 if(!s.databaseReady||!s.stripeReady||!s.webhookReady||!s.releaseReady||!s.validPrice||!origin)return c.fail(res,503,'Checkout de teste ainda não configurado');
 if(!c.requestOrigin(req))return c.fail(res,403,'Origem não permitida');
 const user=await c.userFromRequest(req,s);if(!user||!user.email)return c.fail(res,401,'Confirme seu e-mail antes de comprar');
 try{
  // New Checkout Session bound to the authenticated Supabase user.
  const body=new URLSearchParams({
   mode:'payment',client_reference_id:user.id,customer_email:user.email,
   'line_items[0][quantity]':'1',
   'line_items[0][price_data][currency]':'brl',
   'line_items[0][price_data][unit_amount]':String(s.cents),
   'line_items[0][price_data][product_data][name]':'Creative Tools v1.4.16',
   'metadata[product_id]':c.PRODUCT,'metadata[user_id]':user.id,
   'payment_intent_data[metadata][product_id]':c.PRODUCT,
   'payment_intent_data[metadata][user_id]':user.id,
   success_url:origin+'/conta.html?session_id={CHECKOUT_SESSION_ID}',
   cancel_url:origin+'/conta.html?pagamento=cancelado'
  });
  const data=await c.api('https://api.stripe.com/v1/checkout/sessions',{
   method:'POST',headers:{Authorization:'Bearer '+s.testKey,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':'ct-test-'+user.id+'-'+Math.floor(Date.now()/60000)},
   body:body.toString()
  });
  const redirect=new URL(String(data.url||''));
  if(data.object!=='checkout.session'||data.livemode!==false||redirect.protocol!=='https:'||redirect.hostname!=='checkout.stripe.com'||!String(data.id||'').startsWith('cs_test_'))throw Error('Invalid checkout session');
  return res.status(200).json({url:redirect.href,mode:'test'});
 }catch(error){console.error('Test checkout start failed',error?.name||'unknown');return c.fail(res,503,'Não foi possível abrir o pagamento de teste.');}
};
