const { isAdmin, privateHeaders } = require('../lib/admin-session');
module.exports = function handler(req, res) {
  privateHeaders(res);
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).end(); }
  if (!isAdmin(req)) return res.status(401).json({error:'Acesso privado.'});
  return res.status(200).json({
    storageReady:Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    visualAIReady:Boolean(process.env.OPENAI_API_KEY)
  });
};
