'use strict';
// Download protegido por licença para o Creative Hub (Windows).
// GET /api/creative-hub/download?product=creative-tools&version=X.Y.Z  com  Authorization: Bearer <licença>
// O instalador fica em Vercel Blob PRIVADO; nunca em pasta pública nem em release público.
// Entrega em partes (HTTP Range, máx. 4 MB por resposta, abaixo do limite da Vercel) e só depois de
// conferir o SHA-256 do arquivo inteiro com o valor aprovado no feed e nas variáveis de ambiente.
const {createHash}=require('node:crypto');
const {Readable}=require('node:stream');
const update=require('./creative-tools-update');

const VERSION=/^\d+\.\d+\.\d+$/;
const SHA=/^[a-f0-9]{64}$/;
const PATH=/^creative-tools\/releases\/[a-zA-Z0-9._-]+\.exe$/;
const LIMIT=25*1024*1024;
const MAX_PART=4*1024*1024;

function settings(env=process.env){
  const version=String(env.CT_HUB_VERSION||'');
  const path=String(env.CT_HUB_PRIVATE_BLOB_PATH||'');
  const sha256=String(env.CT_HUB_SHA256||'').toLowerCase();
  // Mesmo Blob privado e mesmas licenças do atualizador, salvo se houver valores próprios do Hub.
  const token=String(env.CT_HUB_PRIVATE_BLOB_TOKEN||env.CT_UPDATE_PRIVATE_BLOB_TOKEN||'');
  const licenses=String(env.CT_HUB_LICENSE_SHA256||env.CT_UPDATE_LICENSE_SHA256||'').toLowerCase().split(',').map(x=>x.trim()).filter(x=>SHA.test(x));
  const valid=env.CT_HUB_ENABLED==='true'&&VERSION.test(version)&&PATH.test(path)&&!path.includes('..')&&SHA.test(sha256)&&token.length>30&&licenses.length>0;
  return {version,path,sha256,token,licenseHashes:licenses,valid};
}
function approvedRelease(c,feed){
  if(!feed||feed.schemaVersion!==1||feed.product!=='creative-tools'||feed.latest!==c.version||!Array.isArray(feed.releases))return null;
  return feed.releases.find(r=>r&&r.version===c.version&&r.status==='published'&&r.auth==='license'&&r.sha256===c.sha256&&Number.isSafeInteger(r.size)&&r.size>0)||null;
}
// "bytes=a-b" (ou "bytes=a-") dentro do arquivo; null = sem Range; false = Range inválido.
function parseRange(header,size){
  if(header===undefined||header===null||header==='')return null;
  const m=/^bytes=(\d+)-(\d*)$/.exec(String(header).trim());
  if(!m)return false;
  const start=Number(m[1]),end=m[2]===''?size-1:Math.min(Number(m[2]),size-1);
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size)return false;
  return {start,end};
}
let cache=null; // {sha256, body} entre invocações quentes da mesma função
async function loadVerified(config,deps){
  if(cache&&cache.sha256===config.sha256)return cache.body;
  const getBlob=deps.blobGet||require('@vercel/blob').get;
  const data=await getBlob(config.path,{access:'private',token:config.token});
  if(!data||data.statusCode!==200||!data.stream)throw Error('Pacote indisponível');
  const iterable=typeof data.stream[Symbol.asyncIterator]==='function'?data.stream:Readable.fromWeb(data.stream);
  const chunks=[];let size=0;const hash=createHash('sha256');
  for await(const value of iterable){
    const part=Buffer.from(value);
    size+=part.length;
    if(size>LIMIT)throw Error('Tamanho acima do limite permitido');
    hash.update(part);chunks.push(part);
  }
  if(!size||hash.digest('hex')!==config.sha256)throw Error('Integridade inválida');
  const body=Buffer.concat(chunks,size);
  cache={sha256:config.sha256,body};
  return body;
}
async function handler(req,res,deps={}){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Vary','Authorization, Range');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Método não permitido'});}
  if(req.query?.product!=='creative-tools')return res.status(404).json({error:'Produto desconhecido'});
  const config=settings(deps.env||process.env);
  if(!config.valid)return res.status(503).json({error:'Downloads do Creative Hub indisponíveis'});
  const feed=deps.feed||require('../updates/creative-tools/hub-manifest.json');
  const release=approvedRelease(config,feed);
  if(!release)return res.status(503).json({error:'Versão não aprovada no feed oficial'});
  if(req.query?.version!==config.version)return res.status(404).json({error:'Versão não publicada'});
  if(!update._test.licensed(req.headers?.authorization,config))return res.status(403).json({error:'Licença não autorizada'});
  let body;
  try{body=await loadVerified(config,deps);}
  catch(error){console.error('Creative Hub delivery failed:',error.message);return res.status(503).json({error:'Falha temporária na entrega'});}
  if(body.length!==release.size){console.error('Creative Hub delivery failed: tamanho diverge do feed');return res.status(503).json({error:'Falha temporária na entrega'});}
  const name=String(release.fileName||'Creative_Tools_Setup_'+config.version+'.exe').replace(/[^A-Za-z0-9._-]/g,'_');
  res.setHeader('Content-Type','application/octet-stream');
  res.setHeader('Content-Disposition','attachment; filename="'+name+'"');
  res.setHeader('Accept-Ranges','bytes');
  const range=parseRange(req.headers?.range,body.length);
  if(range===false){res.setHeader('Content-Range','bytes */'+body.length);return res.status(416).json({error:'Intervalo inválido'});}
  if(range===null){
    if(body.length>MAX_PART)return res.status(416).json({error:'Use download em partes (Range)'});
    res.setHeader('Content-Length',String(body.length));
    return res.status(200).send(body);
  }
  const end=Math.min(range.end,range.start+MAX_PART-1);
  const part=body.subarray(range.start,end+1);
  res.setHeader('Content-Range','bytes '+range.start+'-'+end+'/'+body.length);
  res.setHeader('Content-Length',String(part.length));
  return res.status(206).send(part);
}
module.exports=handler;
module.exports._test={settings,approvedRelease,parseRange,reset(){cache=null;}};
