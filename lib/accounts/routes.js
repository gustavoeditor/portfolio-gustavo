'use strict';
// Rotas da área do cliente (/conta). Login: link mágico do Supabase Auth com o e-mail da compra.
//   GET  /api/conta/config      → configuração pública (URL + chave anon) e estado das integrações
//   GET  /api/conta/biblioteca  → compras do e-mail confirmado (Bearer JWT)
//   POST /api/conta/licenca     → gera/troca a chave de licença do Creative Hub (mostrada uma única vez)
const {randomBytes}=require('node:crypto');
const supabase=require('./supabase');

const PRODUCTS=Object.freeze({'creative-tools':{name:'Creative Tools',host:'After Effects'}});

function headers(res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
}
function sameOrigin(req){
  const origin=String(req.headers?.origin||''),host=String(req.headers?.host||'');
  if(!origin||!host)return false;
  try{const u=new URL(origin);return u.host===host&&(u.protocol==='https:'||u.hostname==='localhost');}catch(_){return false;}
}
function deliveryReady(env){
  try{return require('../creative-hub-delivery')._test.settings(env).deliveryReady===true;}catch(_){return false;}
}
function newLicenseKey(){
  // "ct_" + 32 caracteres base64url (192 bits). Compatível com o Creative Hub (A-Z a-z 0-9 _ -).
  return 'ct_'+randomBytes(24).toString('base64url');
}

async function config(req,res,deps){
  const env=deps.env,cfg=supabase.settings(env);
  const enabled=cfg.enabled&&cfg.authReady;
  return res.status(200).json({
    enabled,
    auth:enabled?{url:cfg.url,anonKey:cfg.anon}:null,
    libraryReady:enabled&&cfg.databaseReady,
    downloadReady:enabled&&cfg.databaseReady&&deliveryReady(env),
    message:enabled?null:'A área do cliente está em preparação.'
  });
}

async function library(req,res,deps){
  const env=deps.env,cfg=supabase.settings(env);
  if(!cfg.enabled||!cfg.authReady||!cfg.databaseReady)return res.status(503).json({error:'Área do cliente em preparação'});
  const user=await (deps.userFromRequest||supabase.userFromRequest)(req,cfg,deps.fetch);
  if(!user)return res.status(401).json({error:'Entre com o e-mail da compra para ver seus produtos'});
  try{
    const rows=await (deps.rpc||supabase.rpc)(cfg,'account_library',{p_email:user.email},deps.fetch);
    const canDownload=deliveryReady(env);
    const purchases=(Array.isArray(rows)?rows:[]).filter(r=>PRODUCTS[r.product]).map(r=>({
      orderId:String(r.order_id),
      product:r.product,
      name:PRODUCTS[r.product].name,
      status:r.status,
      active:r.status==='paid',
      amountCents:Number.isSafeInteger(r.amount_cents)?r.amount_cents:null,
      purchasedAt:r.purchased_at,
      license:r.license_hint?{hint:r.license_hint,createdAt:r.license_created_at}:null,
      canDownload:r.status==='paid'&&canDownload
    }));
    return res.status(200).json({email:user.email,purchases});
  }catch(error){
    console.error('Account library failed:',error?.name||'unknown');
    return res.status(503).json({error:'Não foi possível carregar sua biblioteca. Tente novamente.'});
  }
}

async function license(req,res,deps){
  const env=deps.env,cfg=supabase.settings(env);
  if(!cfg.enabled||!cfg.authReady||!cfg.databaseReady)return res.status(503).json({error:'Área do cliente em preparação'});
  if(!sameOrigin(req))return res.status(403).json({error:'Origem não permitida'});
  const user=await (deps.userFromRequest||supabase.userFromRequest)(req,cfg,deps.fetch);
  if(!user)return res.status(401).json({error:'Sua sessão expirou. Entre novamente.'});
  const key=(deps.newLicenseKey||newLicenseKey)();
  try{
    const order=await (deps.rpc||supabase.rpc)(cfg,'issue_license',{
      p_email:user.email,p_product:'creative-tools',p_key_hash:supabase.sha256(key),p_key_hint:key.slice(-4)
    },deps.fetch);
    if(!order)return res.status(403).json({error:'Não encontramos uma compra ativa do Creative Tools para este e-mail.'});
    return res.status(200).json({key,hint:key.slice(-4),product:'creative-tools'});
  }catch(error){
    console.error('License issue failed:',error?.name||'unknown');
    return res.status(503).json({error:'Não foi possível gerar a chave agora. Tente novamente.'});
  }
}

const ROUTES={config:{GET:config},biblioteca:{GET:library},licenca:{POST:license}};

async function handler(req,res,deps={}){
  headers(res);
  const route=ROUTES[String(req.query?.conta||'')];
  if(!route)return res.status(404).json({error:'Rota não encontrada'});
  const fn=route[req.method];
  if(!fn){res.setHeader('Allow',Object.keys(route).join(', '));return res.status(405).json({error:'Método não permitido'});}
  return fn(req,res,{env:process.env,...deps});
}
module.exports=handler;
module.exports._test={sameOrigin,newLicenseKey,PRODUCTS};
