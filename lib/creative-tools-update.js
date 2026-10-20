'use strict';
const {createHash,timingSafeEqual}=require('node:crypto');
const {Readable}=require('node:stream');

const VERSION=/^\d+\.\d+\.\d+$/;
const SHA=/^[a-f0-9]{64}$/;
const PATH=/^creative-tools\/releases\/[a-zA-Z0-9._-]+\.zxp$/;
const LIMIT=25*1024*1024;

function settings(env=process.env){
  const version=String(env.CT_UPDATE_VERSION||'');
  const path=String(env.CT_UPDATE_PRIVATE_BLOB_PATH||'');
  const sha256=String(env.CT_UPDATE_SHA256||'').toLowerCase();
  const token=String(env.CT_UPDATE_PRIVATE_BLOB_TOKEN||'');
  const licenseHashes=String(env.CT_UPDATE_LICENSE_SHA256||'').toLowerCase().split(',').map(x=>x.trim()).filter(x=>SHA.test(x));
  const valid=env.CT_UPDATE_ENABLED==='true'&&VERSION.test(version)&&PATH.test(path)&&!path.includes('..')&&SHA.test(sha256)&&token.length>30&&licenseHashes.length>0;
  return {version,path,sha256,token,licenseHashes,valid};
}
function licensed(header,config){
  if(typeof header!=='string'||!/^Bearer [A-Za-z0-9_-]{20,128}$/.test(header))return false;
  const input=createHash('sha256').update(header.slice(7),'utf8').digest();
  let accepted=false;
  for(const h of config.licenseHashes){const expected=Buffer.from(h,'hex');accepted=timingSafeEqual(input,expected)||accepted;}
  return accepted;
}
async function handler(req,res,deps={}){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.setHeader('Referrer-Policy','no-referrer');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Método não permitido'});}
  const config=settings(deps.env||process.env);
  if(!config.valid)return res.status(503).json({error:'Atualizações privadas indisponíveis'});
  if(req.query?.version!==config.version)return res.status(404).json({error:'Versão não publicada'});
  if(!licensed(req.headers?.authorization,config))return res.status(403).json({error:'Licença não autorizada'});
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
    if(!size||hash.digest('hex')!==config.sha256)throw Error('Integridade inválida');
    res.setHeader('Content-Type','application/octet-stream');
    res.setHeader('Content-Disposition','attachment; filename="Creative_Tools_'+config.version+'.zxp"');
    res.setHeader('Content-Length',String(size));
    res.setHeader('X-Content-Type-Options','nosniff');
    return res.status(200).send(Buffer.concat(chunks,size));
  }catch(error){
    console.error('Creative Tools update delivery failed:',error.message);
    return res.status(503).json({error:'Falha temporária na entrega'});
  }
}
module.exports=handler;
module.exports._test={settings,licensed};
