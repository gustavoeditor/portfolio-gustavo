const {storageMode} = require('../lib/storage-config');
const {visualAIConfig} = require('../lib/visual-ai');
const { isAdmin, privateHeaders } = require('../lib/admin-session');
const {redisRest} = require('../lib/redis-env');
module.exports = function handler(req, res) {
  privateHeaders(res);
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).end(); }
  if (!isAdmin(req)) return res.status(401).json({error:'Acesso privado.'});
  return res.status(200).json({
    storageReady:Boolean(storageMode()),
    uploadMode:storageMode(),
    // Static keys or a token can be detected; request-scoped OIDC is only potential.
    visualAIReady:Boolean(process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN),
    visualAIConfigured:Boolean(process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN),
    visualAIOidcPotential:Boolean(process.env.VERCEL === '1' && !process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN && !process.env.OPENAI_API_KEY),
    visualAIProvider:visualAIConfig()?.provider || null,
    secondFactorEnabled:Boolean(process.env.ADMIN_TOTP_SECRET),
    sharedLoginLimit:Boolean(redisRest())
  });
};
