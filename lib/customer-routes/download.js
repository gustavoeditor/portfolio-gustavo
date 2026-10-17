'use strict';
const {Readable}=require('node:stream');
const c=require('../customer-store');
module.exports=async function handler(req,res){
 c.responseHeaders(res);
 if(req.method!=='GET'){res.setHeader('Allow','GET');return c.fail(res,405,'Método não permitido');}
 const s=c.settings();if(!s.databaseReady||!s.stripeReady||!s.releaseReady)return c.fail(res,503,'Entrega ainda não configurada');
 const user=await c.userFromRequest(req,s);
 if(!user)return c.fail(res,401,'Faça login para baixar seus arquivos');
 const id=typeof req.query?.session_id==='string'?req.query.session_id:'';
 if(!/^cs_test_[A-Za-z0-9_]{15,200}$/.test(id))return c.fail(res,400,'Compra inválida');
 try{
  const purchases=await c.entitlements(s,user.id);
  const owned=Array.isArray(purchases)&&purchases.find(p=>p.stripe_session_id===id&&p.product_id===c.PRODUCT&&p.status==='active');
  if(!owned)return c.fail(res,403,'Este produto não está na sua biblioteca');
  const session=await c.stripeGetSession(id,s);
  // Refunded or disputed purchases never get a fresh download.
  if(!c.paidSession(session,user.id,s,owned.price_cents))return c.fail(res,403,'Pagamento não está ativo');
  const archive=await c.privateArchive(s);
  res.setHeader('Content-Type','application/zip');
  res.setHeader('Content-Disposition','attachment; filename="Creative_Tools_v1.4.16.zip"');
  res.setHeader('Content-Length',String(archive.length));
  res.setHeader('X-Download-Options','noopen');
  res.status(200);
  return Readable.from((function*(){for(let i=0;i<archive.length;i+=65536)yield archive.subarray(i,i+65536);})()).pipe(res);
 }catch(error){console.error('Customer download failed',error?.name||'unknown');if(!res.headersSent)return c.fail(res,503,'Arquivo temporariamente indisponível');}
};
