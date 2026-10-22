'use strict';
// Entrega protegida do instalador Windows (.exe) para o Creative Hub.
// Separada de creative-tools-update.js: aquele canal entrega o ZXP ao Updater v1.x e não muda.
// O pacote vive em Vercel Blob PRIVADO; só sai daqui com licença válida, versão publicada no
// feed do Hub e SHA-256 conferido. Como Vercel Functions limitam a resposta a ~4,5 MB, o
// arquivo é entregue em partes (HTTP Range, até CHUNK bytes por requisição).
const {createHash,timingSafeEqual}=require('node:crypto');
const {Readable}=require('node:stream');

const VERSION=/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const SHA=/^[a-f0-9]{64}$/;
const PATH=/^creative-hub\/packages\/creative-tools\/[a-zA-Z0-9._-]+\.exe$/;
const LIMIT=64*1024*1024;
const CHUNK=3*1024*1024;

function settings(env=process.env){
  const version=String(env.CT_HUB_VERSION||'');
  const path=String(env.CT_HUB_PRIVATE_BLOB_PATH||'');
  const sha256=String(env.CT_HUB_SHA256||'').toLowerCase();
  const size=Number(env.CT_HUB_SIZE||0);
  const token=String(env.CT_HUB_PRIVATE_BLOB_TOKEN||'');
  const licenseHashes=String(env.CT_HUB_LICENSE_SHA256||'').toLowerCase().split(',').map(x=>x.trim()).filter(x=>SHA.test(x));
  const valid=env.CT_HUB_ENABLED==='true'&&VERSION.test(version)&&PATH.test(path)&&!path.includes('..')&&SHA.test(sha256)
    &&Number.isSafeInteger(size)&&size>0&&size<=LIMIT&&token.length>30&&licenseHashes.length>0;
  return {version,path,sha256,size,token,licenseHashes,valid};
}

// A versão precisa estar publicada no feed do Hub com o mesmo hash e tamanho configurados.
function published(c,feed){
  if(!feed||feed.schemaVersion!==1||feed.product!=='creative-tools'||feed.latest!==c.version||!Array.isArray(feed.releases))return false;
  return feed.releases.some(r=>r&&r.version===c.version&&r.status==='published'&&r.sha256===c.sha256&&r.size===c.size);
}

function licensed(header,config){
  if(typeof header!=='string'||!/^Bearer [A-Za-z0-9_-]{20,128}$/.test(header))return false;
  const input=createHash('sha256').update(header.slice(7),'utf8').digest();
  let accepted=false;
  for(const h of config.licenseHashes){accepted=timingSafeEqual(input,Buffer.from(h,'hex'))||accepted;}
  return accepted;
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
  const config=settings(deps.env||process.env);
  if(!config.valid)return res.status(503).json({error:'Distribuição privada do Creative Hub indisponível'});
  const feed=deps.feed||require('../updates/creative-tools/hub-manifest.json');
  if(!published(config,feed))return res.status(503).json({error:'Versão não aprovada no feed do Creative Hub'});
  if(req.query?.product!=='creative-tools'||req.query?.version!==config.version)return res.status(404).json({error:'Versão não publicada'});
  if(!licensed(req.headers?.authorization,config))return res.status(403).json({error:'Licença não autorizada'});
  const range=parseRange(req.headers?.range,config.size);
  if(!range){res.setHeader('Content-Range','bytes */'+config.size);return res.status(416).json({error:'Intervalo inválido'});}
  try{
    const getBlob=deps.blobGet||require('@vercel/blob').get;
    const data=await getBlob(config.path,{access:'private',token:config.token});
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
    if(size!==config.size||hash.digest('hex')!==config.sha256)throw Error('Integridade inválida');
    const body=Buffer.concat(chunks,size).subarray(range.start,range.end+1);
    res.setHeader('Content-Type','application/octet-stream');
    res.setHeader('Content-Disposition','attachment; filename="Creative_Tools_Setup_'+config.version+'.exe"');
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
module.exports._test={settings,licensed,published,parseRange,CHUNK};
