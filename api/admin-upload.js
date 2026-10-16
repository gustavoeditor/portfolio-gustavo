const {handleUpload, handleUploadPresigned} = require('@vercel/blob/client');
const {issueSignedToken} = require('@vercel/blob');
const {storageMode} = require('../lib/storage-config');
const {validSameOriginAdmin, privateHeaders, parseJsonBody} = require('../lib/admin-session');
function constraints(pathname) {
  const videos=/^gustavo\/videos\/[a-z0-9-]{3,110}\.(mp4|webm)$/i.test(pathname);
  const covers=/^gustavo\/capas\/[a-z0-9-]{3,110}\.(webp|jpg|jpeg|png)$/i.test(pathname);
  if(!videos&&!covers)throw new Error('Caminho não permitido.');
  return {
    allowedContentTypes:videos?['video/mp4','video/webm']:['image/webp','image/jpeg','image/png'],
    maximumSizeInBytes:(videos?250:8)*1024*1024,
    validUntil:Date.now()+60*60*1000
  };
}
module.exports=async function handler(req,res) {
  privateHeaders(res);
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).end();}
  let body;
  try{body=parseJsonBody(req,16000);}catch(_){return res.status(400).json({error:'Formato inválido.'});}
  if(body.type!=='blob.upload-completed'&&!validSameOriginAdmin(req))return res.status(403).json({error:'Sua sessão expirou. Entre novamente no painel.'});
  const mode=storageMode();
  if(!mode)return res.status(503).json({error:'O armazenamento ainda não está conectado. Conecte o Vercel Blob ao projeto para publicar.'});
  try {
    let result;
    if(mode==='oidc') {
      result=await handleUploadPresigned({body,request:req,
        getSignedToken:async(pathname)=>{
          const limits=constraints(pathname);
          return {token:await issueSignedToken({pathname,operations:['put'],...limits}),urlOptions:{...limits,addRandomSuffix:true,allowOverwrite:false}};
        }
      });
    } else {
      result=await handleUpload({body,request:req,
        onBeforeGenerateToken:async(pathname)=>({...constraints(pathname),addRandomSuffix:true,allowOverwrite:false})
      });
    }
    return res.status(200).json(result);
  } catch (_) {
    return res.status(400).json({error:'Não foi possível autorizar o envio. Confira sua sessão, formato e conexão do armazenamento.'});
  }
};
module.exports.constraints=constraints;
