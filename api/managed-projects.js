// Função única que atende várias rotas (vercel.json → rewrites), para respeitar o limite de
// funções do plano. Cada rota vive em lib/ e é testada separadamente.
const storeCheckout = require('../lib/store-checkout');
const creativeToolsUpdate = require('../lib/creative-tools-update');
const storeDelivery = require('../lib/store-delivery');
const creativeHubDelivery = require('../lib/creative-hub-delivery');
const caktoWebhook = require('../lib/accounts/cakto-webhook');
const accountRoutes = require('../lib/accounts/routes');
const { hasStore, readManaged } = require('../lib/managed-projects');
module.exports = async function handler(req, res) {
  const originalPath = String(req.url || '').split('?')[0];
  const q = req.query || {};
  if (q.ct_update === 'download' || originalPath === '/api/creative-tools-update') return creativeToolsUpdate(req, res);
  if (q.hub === 'download' || originalPath === '/api/creative-hub/download') return creativeHubDelivery(req, res);
  if (q.cakto === 'webhook' || originalPath === '/api/cakto/webhook') return caktoWebhook(req, res);
  if (typeof q.conta === 'string') return accountRoutes(req, res);
  if (q.store === 'checkout' || originalPath === '/api/store/checkout') return storeCheckout(req, res);
  if (q.store === 'download' || originalPath === '/api/store/download') return storeDelivery(req, res);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).end(); }
  if (!hasStore()) return res.status(200).json({projects:[],enabled:false});
  try {
    return res.status(200).json({projects:await readManaged(),enabled:true});
  } catch (error) {
    console.error('managed projects read failed',error.message);
    return res.status(503).json({projects:[],error:'Catálogo temporariamente indisponível.'});
  }
};
// O webhook da Cakto precisa dos bytes originais do corpo para validar o HMAC.
// As demais rotas desta função não leem corpo de requisição.
module.exports.config = {api:{bodyParser:false}};
