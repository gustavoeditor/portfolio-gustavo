const {storageMode} = require('../lib/storage-config');
const {visualAIConfig} = require('../lib/visual-ai');
const { isAdmin, privateHeaders } = require('../lib/admin-session');
module.exports = function handler(req, res) {
  privateHeaders(res);
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).end(); }
  if (!isAdmin(req)) return res.status(401).json({error:'Acesso privado.'});
  return res.status(200).json({
    storageReady:Boolean(storageMode()),
    uploadMode:storageMode(),
    // Indicates that credentials exist, not that credits or model calls work.
    visualAIReady:Boolean(visualAIConfig()),
    visualAIConfigured:Boolean(visualAIConfig()),
    visualAIProvider:visualAIConfig()?.provider || null,
    secondFactorEnabled:Boolean(process.env.ADMIN_TOTP_SECRET),
    sharedLoginLimit:Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  });
};
