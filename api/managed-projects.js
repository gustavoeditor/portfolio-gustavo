const storeCheckout = require('../lib/store-checkout');
const creativeToolsUpdate = require('../lib/creative-tools-update');
const storeDelivery = require('../lib/store-delivery');
const { hasStore, readSnapshot } = require('../lib/managed-projects');
const seoSitemap = require('../lib/seo-sitemap');
module.exports = async function handler(req, res) {
  const originalPath = String(req.url || '').split('?')[0];
  if ((req.query && req.query.ct_update === 'download') || originalPath === '/api/creative-tools-update') return creativeToolsUpdate(req, res);
  if ((req.query && req.query.store === 'checkout') || originalPath === '/api/store/checkout') return storeCheckout(req, res);
  if ((req.query && req.query.store === 'download') || originalPath === '/api/store/download') return storeDelivery(req, res);
  if ((req.query && req.query.seo === 'sitemap') || originalPath === '/sitemap.xml') return seoSitemap(req, res);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).end(); }
  if (!hasStore()) return res.status(200).json({projects:[],hidden:[],enabled:false});
  try {
    const snapshot = await readSnapshot();
    return res.status(200).json({projects:snapshot.projects,hidden:snapshot.hidden||[],enabled:true});
  } catch (error) {
    console.error('managed projects read failed',error.message);
    return res.status(503).json({projects:[],hidden:[],error:'Catálogo temporariamente indisponível.'});
  }
};
