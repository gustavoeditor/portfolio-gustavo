'use strict';
const c=require('../../lib/customer-store');
module.exports=async function handler(req,res){
 c.responseHeaders(res);
 if(req.method!=='POST'){res.setHeader('Allow','POST');return c.fail(res,405,'Método não permitido');}
 const s=c.settings();if(!s.databaseReady||!s.stripeReady)return c.fail(res,503,'Resgate temporariamente indisponível');
 if(!c.requestOrigin(req))return c.fail(res,403,'Origem não permitida');
 const user=await c.userFromRequest(req,s);
 if(!user)return c.fail(res,401,'Faça login para resgatar sua compra');
 const id=typeof req.body?.session_id==='string'?req.body.session_id:'';
 if(!/^cs_test_[A-Za-z0-9_]{15,200}$/.test(id))return c.fail(res,400,'Sessão de pagamento inválida');
 try{
  const session=await c.stripeGetSession(id,s);
  if(!c.paidSession(session,user.id,s))return c.fail(res,403,'Pagamento não confirmado para esta conta');
  await c.saveEntitlement(s,user.id,session);
  return res.status(200).json({ok:true,productId:c.PRODUCT,message:'Compra confirmada. Produto na sua biblioteca.'});
 }catch(error){console.error('Customer claim failed',error?.name||'unknown');return c.fail(res,503,'Não foi possível verificar a compra. Tente novamente.');}
};
