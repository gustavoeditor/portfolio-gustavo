'use strict';
// Signed Stripe webhook backup for customers who close the checkout tab.
// Stripe retry-friendly, accepts only TEST events in a Vercel preview.
const c=require('../../lib/customer-store');
const MAX=256*1024;
async function readRaw(req){
 if(Buffer.isBuffer(req.rawBody))return req.rawBody;
 if(typeof req.rawBody==='string')return Buffer.from(req.rawBody);
 if(Buffer.isBuffer(req.body))return req.body;
 if(typeof req.body==='string')return Buffer.from(req.body);
 // Reject parsed JSON. Re-serializing it would invalidate Stripe's signature.
 if(req.body&&typeof req.body==='object')throw Error('Body parser must be disabled');
 const parts=[];let size=0;
 for await(const part of req){const buffer=Buffer.from(part);size+=buffer.length;if(size>MAX)throw Error('Event too large');parts.push(buffer);}
 return Buffer.concat(parts);
}
module.exports=async function handler(req,res){
 c.responseHeaders(res);
 if(req.method!=='POST'){res.setHeader('Allow','POST');return c.fail(res,405,'Método não permitido');}
 const s=c.settings(),secret=String(process.env.STRIPE_TEST_WEBHOOK_SECRET||'');
 if(!s.testMode||!s.databaseReady||!s.stripeReady)return c.fail(res,503,'Webhook de testes desativado');
 let event;
 try{
  const raw=await readRaw(req);
  if(!c.verifyStripeSignature(raw,req.headers?.['stripe-signature'],secret))return c.fail(res,400,'Assinatura inválida');
  event=JSON.parse(raw.toString('utf8'));
 }catch(error){return c.fail(res,400,'Evento inválido');}
 if(event.livemode!==false||event.data?.object?.livemode!==false)return c.fail(res,400,'Evento de modo real não aceito');
 if(!['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type))return res.status(200).json({received:true});
 const id=event.data?.object?.id;
 if(typeof id!=='string'||!/^cs_test_[A-Za-z0-9_]{15,200}$/.test(id))return c.fail(res,400,'Checkout inválido');
 try{
  const session=await c.stripeGetSession(id,s);
  const userId=session.client_reference_id;
  if(!c.paidSession(session,userId,s))return res.status(200).json({received:true,paid:false});
  await c.saveEntitlement(s,userId,session);
  return res.status(200).json({received:true,paid:true});
 }catch(error){console.error('Customer test webhook failed',error?.name||'unknown');return c.fail(res,503,'Evento pendente de reprocessamento');}
};
// Needed on runtimes which automatically parse request bodies before the handler.
module.exports.config={api:{bodyParser:false}};
module.exports._test={readRaw};
