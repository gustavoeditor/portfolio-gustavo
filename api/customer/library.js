'use strict';
const c=require('../../lib/customer-store');
module.exports=async function handler(req,res){
 c.responseHeaders(res);
 if(req.method!=='GET'){res.setHeader('Allow','GET');return c.fail(res,405,'Método não permitido');}
 const s=c.settings();if(!s.databaseReady)return c.fail(res,503,'Biblioteca ainda não configurada');
 const user=await c.userFromRequest(req,s);
 if(!user)return c.fail(res,401,'Faça login para acessar sua biblioteca');
 try{
  const list=await c.entitlements(s,user.id);
  return res.status(200).json({products:(Array.isArray(list)?list:[]).map(p=>({
   productId:p.product_id,status:p.status,purchasedAt:p.purchased_at,
   priceCents:p.price_cents,currency:p.currency,
   canDownload:p.status==='active'&&s.testMode&&s.stripeReady&&s.releaseReady,
   id:p.stripe_session_id
  }))});
 }catch(error){console.error('Customer library failed',error?.name||'unknown');return c.fail(res,503,'Biblioteca indisponível. Tente novamente.');}
};
