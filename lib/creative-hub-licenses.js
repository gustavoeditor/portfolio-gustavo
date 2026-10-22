'use strict';
// Licenças do Creative Hub a partir das compras da Cakto.
// - POST /api/cakto/webhook: compra aprovada → gera chave; reembolso/chargeback → revoga.
// - POST /api/creative-hub/license: o comprador recupera a chave com e-mail + código do pedido.
// As chaves ficam no Vercel Blob PRIVADO; o registro da licença é indexado pelo SHA-256 da chave,
// então quem valida um download nunca precisa da chave em texto.
const {createHash,createHmac,randomBytes,timingSafeEqual}=require('node:crypto');
const {Readable}=require('node:stream');

const ID=/^[A-Za-z0-9_-]{1,80}$/;
const KEY=/^[A-Za-z0-9_-]{20,128}$/;
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I para facilitar a digitação
const MAX_BODY=256*1024;

const sha256=s=>createHash('sha256').update(String(s),'utf8').digest('hex');
const sameText=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y);};

function settings(env=process.env){
  const secret=String(env.CAKTO_WEBHOOK_SECRET||'');
  const products=String(env.CAKTO_PRODUCT_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);
  const token=String(env.CREATIVE_HUB_BLOB_TOKEN||env.CT_HUB_PRIVATE_BLOB_TOKEN||'');
  return {secret,products,token,valid:secret.length>=16&&products.length>0&&token.length>30};
}

// CH-XXXXX-XXXXX-XXXXX-XXXXX (100 bits de entropia)
function generateKey(rand=randomBytes){
  const bytes=rand(20);let out='';
  for(let i=0;i<20;i++){out+=ALPHABET[bytes[i]%32];if(i%5===4&&i<19)out+='-';}
  return 'CH-'+out;
}

// ---------------------------------------------------------------------------
// Armazenamento (Blob privado). `deps.store` permite testes em memória.
function blobStore(token){
  const blob=require('@vercel/blob');
  return {
    async read(path){
      try{
        const r=await blob.get(path,{access:'private',token});
        if(!r||r.statusCode!==200||!r.stream)return null;
        const it=typeof r.stream[Symbol.asyncIterator]==='function'?r.stream:Readable.fromWeb(r.stream);
        const parts=[];for await(const c of it)parts.push(Buffer.from(c));
        return JSON.parse(Buffer.concat(parts).toString('utf8'));
      }catch(e){if(/not.?found|404/i.test(String(e&&(e.message||e.name))))return null;throw e;}
    },
    async write(path,value){
      await blob.put(path,JSON.stringify(value),{access:'private',token,addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'});
    }
  };
}
const paths={
  license:hash=>'creative-hub/licenses/'+hash+'.json',
  order:id=>'creative-hub/orders/'+id+'.json',
  ref:ref=>'creative-hub/order-refs/'+ref+'.json'
};

async function licenseActive(key,store){
  if(typeof key!=='string'||!KEY.test(key))return false;
  const rec=await store.read(paths.license(sha256(key)));
  return !!rec&&rec.status==='active';
}

// ---------------------------------------------------------------------------
// Webhook

async function readRaw(req){
  if(typeof req.rawBody==='string'||Buffer.isBuffer(req.rawBody))return String(req.rawBody);
  if(req.body!==undefined&&req.body!==null){
    return typeof req.body==='string'?req.body:Buffer.isBuffer(req.body)?req.body.toString('utf8'):null;
  }
  if(typeof req[Symbol.asyncIterator]!=='function')return null;
  const parts=[];let size=0;
  for await(const c of req){size+=c.length;if(size>MAX_BODY)throw Error('corpo grande demais');parts.push(Buffer.from(c));}
  return Buffer.concat(parts).toString('utf8');
}

// Assinatura v1=<hmac-sha256("{timestamp}.{corpo cru}")> ou campo `secret` do corpo.
function authentic(headers,raw,body,secret,now=Date.now()){
  const sig=headers&&(headers['x-cakto-signature']||headers['X-Cakto-Signature']);
  const ts=headers&&(headers['x-cakto-timestamp']||headers['X-Cakto-Timestamp']);
  if(sig&&ts&&typeof raw==='string'){
    const t=Number(ts);
    if(!Number.isFinite(t))return false;
    const ms=t>1e12?t:t*1000;
    if(Math.abs(now-ms)>5*60*1000)return false;
    const m=/^v1=([a-f0-9]{64})$/i.exec(String(sig).trim());
    if(!m)return false;
    const expected=createHmac('sha256',secret).update(String(ts)+'.'+raw,'utf8').digest('hex');
    return sameText(m[1].toLowerCase(),expected);
  }
  return !!body&&typeof body.secret==='string'&&sameText(body.secret,secret);
}

async function webhook(req,res,deps={}){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido'});}
  const cfg=settings(deps.env||process.env);
  if(!cfg.valid)return res.status(503).json({error:'Licenciamento não configurado'});
  let raw,body;
  try{
    raw=await readRaw(req);
    body=raw!==null?JSON.parse(raw):req.body;
  }catch{return res.status(400).json({error:'Corpo inválido'});}
  if(!body||typeof body!=='object')return res.status(400).json({error:'Corpo inválido'});
  if(!authentic(req.headers||{},raw,body,cfg.secret,deps.now))return res.status(401).json({error:'Origem não autenticada'});
  const event=String(body.event||'');const data=body.data||{};
  const orderId=String(data.id||'');const ref=String(data.refId||'');
  const product=data.product||{};
  const ours=cfg.products.includes(String(product.id||''))||cfg.products.includes(String(product.short_id||''));
  if(!ours)return res.status(200).json({ok:true,ignored:'produto'});
  if(!ID.test(orderId))return res.status(200).json({ok:true,ignored:'pedido sem id'});
  const store=deps.store||blobStore(cfg.token);
  try{
    if(event==='purchase_approved'){
      const existing=await store.read(paths.order(orderId));
      if(existing)return res.status(200).json({ok:true,duplicate:true}); // reenvio: idempotente
      const key=(deps.generateKey||generateKey)();
      const hash=sha256(key);
      const email=String(data.customer&&data.customer.email||'').trim().toLowerCase();
      const now=new Date().toISOString();
      await store.write(paths.license(hash),{status:'active',orderId,refId:ref||null,productId:String(product.id||''),email,createdAt:now});
      await store.write(paths.order(orderId),{key,licenseHash:hash,email,refId:ref||null,status:'active',createdAt:now});
      if(ref&&ID.test(ref))await store.write(paths.ref(ref),{orderId});
      return res.status(200).json({ok:true,created:true});
    }
    if(event==='refund'||event==='chargeback'){
      const order=await store.read(paths.order(orderId));
      if(!order)return res.status(200).json({ok:true,ignored:'pedido desconhecido'});
      const lic=await store.read(paths.license(order.licenseHash))||{};
      const now=new Date().toISOString();
      await store.write(paths.license(order.licenseHash),{...lic,status:'revoked',revokedAt:now,revokedBy:event});
      await store.write(paths.order(orderId),{...order,status:'revoked',revokedAt:now});
      return res.status(200).json({ok:true,revoked:true});
    }
    return res.status(200).json({ok:true,ignored:'evento'});
  }catch(e){
    console.error('Cakto webhook failed:',e.message);
    return res.status(500).json({error:'Falha temporária'});
  }
}

// ---------------------------------------------------------------------------
// Recuperação da chave pelo comprador

async function retrieve(req,res,deps={}){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Robots-Tag','noindex');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido'});}
  const cfg=settings(deps.env||process.env);
  if(!cfg.valid)return res.status(503).json({error:'Licenciamento indisponível no momento'});
  let body=req.body;
  try{if(typeof body==='string')body=JSON.parse(body);}catch{body=null;}
  const email=String(body&&body.email||'').trim().toLowerCase();
  const code=String(body&&body.order||'').trim().replace(/^#/,'');
  const notFound=()=>res.status(404).json({error:'Não encontramos uma compra com esse e-mail e código. Confira os dados do comprovante da Cakto.'});
  if(!email||email.length>254||!ID.test(code))return notFound();
  const store=deps.store||blobStore(cfg.token);
  try{
    let order=await store.read(paths.order(code));
    if(!order){const r=await store.read(paths.ref(code));if(r&&ID.test(String(r.orderId)))order=await store.read(paths.order(r.orderId));}
    if(!order||!sameText(sha256(order.email||''),sha256(email)))return notFound();
    if(order.status!=='active')return res.status(410).json({error:'Esta licença foi cancelada (reembolso ou contestação).'});
    return res.status(200).json({key:order.key,status:'active'});
  }catch(e){
    console.error('License retrieval failed:',e.message);
    return res.status(503).json({error:'Falha temporária. Tente novamente.'});
  }
}

module.exports={webhook,retrieve,licenseActive,blobStore,settings};
module.exports._test={generateKey,authentic,readRaw,sha256,paths,KEY};
