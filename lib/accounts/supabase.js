'use strict';
// Acesso server-side ao Supabase (Auth + PostgREST) sem SDK.
// A chave service_role nunca sai do servidor; o navegador só recebe URL + chave anon.
const {createHash}=require('node:crypto');

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function settings(env=process.env){
  const raw=String(env.SUPABASE_URL||'').trim().replace(/\/$/,'');
  let url='';
  try{
    const u=new URL(raw);
    if(u.protocol==='https:'&&/^[a-z0-9]{20}\.supabase\.co$/.test(u.hostname)&&!u.username&&!u.password&&!u.port&&(u.pathname==='/'||u.pathname==='')&&!u.search&&!u.hash)url='https://'+u.hostname;
  }catch(_){}
  const anon=String(env.SUPABASE_ANON_KEY||'').trim();
  const service=String(env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
  const authReady=!!url&&anon.length>24;
  const databaseReady=!!url&&service.length>24&&service!==anon;
  return {url,anon,service,authReady,databaseReady,enabled:env.ACCOUNTS_ENABLED==='true'};
}

async function call(url,options,fetchFn=fetch,timeout=6000){
  const response=await fetchFn(url,{...options,signal:AbortSignal.timeout(timeout)});
  if(!response||!response.ok){const e=new Error('Supabase '+(response?.status||'indisponível'));e.status=response?.status;throw e;}
  const text=await response.text();
  return text?JSON.parse(text):null;
}

// Chama uma função RPC privada (grant somente para service_role).
async function rpc(cfg,name,args,fetchFn=fetch){
  if(!cfg.databaseReady)throw new Error('Banco não configurado');
  if(!/^[a-z_]{3,64}$/.test(name))throw new Error('RPC inválida');
  return call(cfg.url+'/rest/v1/rpc/'+name,{
    method:'POST',
    headers:{'Content-Type':'application/json',Accept:'application/json',apikey:cfg.service,Authorization:'Bearer '+cfg.service},
    body:JSON.stringify(args)
  },fetchFn);
}

// Valida o JWT do cliente no próprio Supabase Auth e devolve {id,email} confirmado.
function bearerJwt(header){
  const m=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(String(header||''));
  return m&&m[1].length<=6000?m[1]:null;
}
async function userFromRequest(req,cfg,fetchFn=fetch){
  const token=bearerJwt(req.headers?.authorization);
  if(!token||!cfg.authReady)return null;
  try{
    const user=await call(cfg.url+'/auth/v1/user',{headers:{apikey:cfg.anon,Authorization:'Bearer '+token}},fetchFn);
    const email=String(user?.email||'').trim().toLowerCase();
    if(!user||!UUID.test(String(user.id||''))||user.aud!=='authenticated'||!user.email_confirmed_at||!EMAIL.test(email)||email.length>254)return null;
    return {id:user.id,email};
  }catch(_){return null;}
}

const sha256=value=>createHash('sha256').update(String(value),'utf8').digest('hex');

module.exports={settings,rpc,call,userFromRequest,bearerJwt,sha256,UUID,EMAIL};
