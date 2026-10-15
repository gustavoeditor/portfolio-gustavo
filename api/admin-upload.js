const { handleUpload } = require('@vercel/blob/client');
const { validSameOriginAdmin, privateHeaders, parseJsonBody } = require('../lib/admin-session');
module.exports = async function handler(req, res) {
  privateHeaders(res);
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).end(); }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({error:'Conecte o Vercel Blob antes de enviar arquivos.'});
  let body;
  try { body = parseJsonBody(req); } catch (_) { return res.status(400).json({error:'Formato inválido.'}); }
  // O callback do serviço de Blob precisa ser validado pela própria biblioteca.
  if (body.type !== 'blob.upload-completed' && !validSameOriginAdmin(req)) {
    return res.status(403).json({error:'Acesso privado necessário.'});
  }
  try {
    const result = await handleUpload({
      body, request:req,
      onBeforeGenerateToken: async (pathname) => {
        const videos = /^gustavo\/videos\/[a-z0-9-]{3,110}\.(mp4|webm)$/i.test(pathname);
        const covers = /^gustavo\/capas\/[a-z0-9-]{3,110}\.(webp|jpg|jpeg|png)$/i.test(pathname);
        if (!videos && !covers) throw new Error('Tipo ou caminho de arquivo não permitido.');
        return {
          allowedContentTypes:videos?['video/mp4','video/webm']:['image/webp','image/jpeg','image/png'],
          maximumSizeInBytes:videos?250*1024*1024:8*1024*1024,
          addRandomSuffix:true,
          tokenPayload:JSON.stringify({type:videos?'video':'cover'})
        };
      },
      onUploadCompleted:async ({blob})=>{ console.log('admin blob stored',blob.pathname); }
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error('admin blob transfer error',error.message);
    return res.status(400).json({error:'Falha ao enviar arquivo. Confirme o formato e tente novamente.'});
  }
};
