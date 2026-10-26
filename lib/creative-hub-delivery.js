'use strict';
// Entrega protegida dos instaladores (.exe) para o Creative Hub.
// Separada de creative-tools-update.js: aquele canal entrega o ZXP ao Updater v1.x e não muda.
// - Versão, SHA-256, tamanho e caminho privado vêm do feed PÚBLICO do produto (uma fonte só:
//   publicar uma versão = editar o feed). Na Vercel ficam apenas o token do Blob e o liga/desliga.
// - O arquivo vive em Vercel Blob PRIVADO e só sai com licença válida (compra Cakto ativa ou chave
//   de teste) e SHA-256 conferido. Entrega em partes (HTTP Range) por causa do limite de ~4,5 MB
//   das Vercel Functions.
const {createHash,timingSafeEqual}=require('node:crypto');
const {Readable}=require('node:stream');
const licenses=require('./creative-hub-licenses');

const VERSION=/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const SHA=/^[a-f0-9]{64}$/;
const LIMIT=64*1024*1024;
const CHUNK=3*1024*1024;
const FEEDS={
  'creative-tools':()=>require('../updates/creative-tools/hub-manifest.json'),
  'creative-hub':()=>require('../updates/creative-hub/manifest.json')
};

function settings(env=process.env){
  const enabled=(env.CREATIVE_HUB_DELIVERY_ENABLED||env.CT_HUB_ENABLED)==='true';
  const token=String(env.CREATIVE_HUB_BLOB_TOKEN||env.CT_HUB_PRIVATE_BLOB_TOKEN||'');
  const testHashes=String(env.CREATIVE_HUB_TEST_LICENSE_SHA256||env.CT_HUB_LICENSE_SHA256||'').toLowerCase().split(',').map(x=>x.trim()).filter(x=>SHA.test(x));
  const invalid=[enabled||'CREATIVE_HUB_DELIVERY_ENABLED',token.length>30||'CREATIVE_HUB_BLOB_TOKEN'].filter(x=>x!==true);
  return {token,testHashes,valid:invalid.length===0,invalid};
}

// Release publicada e vigente no feed, com todos os dados de integridade.
function releaseFor(product,version,feed){
  if(!feed||feed.schemaVersion!==1||feed.product!==product||!Array.isArray(feed.releases))return null;
  if(feed.latest!==version||!VERSION.test(version))return null;
  const r=feed.releases.find(x=>x&&x.version===version&&x.status==='published');
  if(!r||!SHA.test(String(r.sha256))||!Number.isSafeInteger(r.size)||r.size<=0||r.size>LIMIT)return null;
  const path=String(r.privatePath||'');
  const allowed=new RegExp('^creative-hub/packages/'+product+'/[A-Za-z0-9._-]+\\.exe$');
  if(!allowed.test(path)||path.includes('..'))return null;
  return {version,sha256:r.sha256,size:r.size,path};
}

function bearer(header){
  if(typeof header!=='string')return null;
  const m=/^Bearer ([A-Za-z0-9_-]{20,128})$/.exec(header);
  return m?m[1]:null;
}

function testLicensed(key,cfg){
  if(!key)return false;
  const input=createHash('sha256').update(key,'utf8').digest();
  let ok=false;
  for(const h of cfg.testHashes){ok=timingSafeEqual(input,Buffer.from(h,'hex'))||ok;}
  return ok;
}

// Aceita somente "bytes=início-fim" (um intervalo). Sem Range → primeira parte.
function parseRange(header,size){
  if(header===undefined||header===null||header==='')return {start:0,end:Math.min(size,CHUNK)-1};
  const m=/^bytes=(\d+)-(\d*)$/.exec(String(header));
  if(!m)return null;
  const start=Number(m[1]);
  const end=Math.min(m[2]===''?start+CHUNK-1:Number(m[2]),start+CHUNK-1,size-1);
  if(!Number.isSafeInteger(start)||start>=size||end<start)return null;
  return {start,end};
}

async function handler(req,res,deps={}){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Vary','Authorization, Range');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Método não permitido'});}
  const env=deps.env||process.env;
  const cfg=settings(env);
  if(!cfg.valid){
    const body={error:'Distribuição privada do Creative Hub indisponível'};
    if(env.VERCEL_ENV&&env.VERCEL_ENV!=='production')body.invalid=cfg.invalid;
    return res.status(503).json(body);
  }
  const product=String(req.query?.product||'');
  if(!FEEDS[product])return res.status(404).json({error:'Produto desconhecido'});
  const feed=deps.feed||FEEDS[product]();
  const rel=releaseFor(product,String(req.query?.version||''),feed);
  if(!rel)return res.status(404).json({error:'Versão não publicada'});
  const key=bearer(req.headers?.authorization);
  let allowed=testLicensed(key,cfg);
  if(!allowed&&key){
    try{allowed=await licenses.licenseActive(key,deps.licenseStore||licenses.blobStore(cfg.token));}
    catch(e){console.error('License check failed:',e.message);return res.status(503).json({error:'Falha temporária ao validar a licença'});}
  }
  if(!allowed)return res.status(403).json({error:'Licença não autorizada'});
  const range=parseRange(req.headers?.range,rel.size);
  if(!range){res.setHeader('Content-Range','bytes */'+rel.size);return res.status(416).json({error:'Intervalo inválido'});}
  try{
    const getBlob=deps.blobGet||require('@vercel/blob').get;
    const data=await getBlob(rel.path,{access:'private',token:cfg.token});
    if(!data||data.statusCode!==200||!data.stream)return res.status(503).json({error:'Pacote indisponível'});
    const iterable=typeof data.stream[Symbol.asyncIterator]==='function'?data.stream:Readable.fromWeb(data.stream);
    const chunks=[];let size=0;const hash=createHash('sha256');
    for await(const value of iterable){
      const part=Buffer.from(value);
      size+=part.length;
      if(size>LIMIT)throw Error('Tamanho acima do limite permitido');
      hash.update(part);
      chunks.push(part);
    }
    // O pacote inteiro é conferido a cada parte: nenhum byte sai de um blob adulterado.
    if(size!==rel.size||hash.digest('hex')!==rel.sha256)throw Error('Integridade inválida');
    const body=Buffer.concat(chunks,size).subarray(range.start,range.end+1);
    res.setHeader('Content-Type','application/octet-stream');
    res.setHeader('Content-Disposition','attachment; filename="'+rel.path.split('/').pop()+'"');
    res.setHeader('Accept-Ranges','bytes');
    res.setHeader('Content-Range','bytes '+range.start+'-'+range.end+'/'+size);
    res.setHeader('Content-Length',String(body.length));
    return res.status(206).send(body);
  }catch(error){
    console.error('Creative Hub delivery failed:',error.message);
    return res.status(503).json({error:'Falha temporária na entrega'});
  }
}
module.exports=handler;
module.exports._test={settings,releaseFor,testLicensed,bearer,parseRange,CHUNK};
