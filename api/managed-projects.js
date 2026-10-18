const storeCheckout = require('../lib/store-checkout');
const storeDelivery = require('../lib/store-delivery');
const { hasStore, readManaged } = require('../lib/managed-projects');
const customerRoutes = Object.freeze({settings: require('../lib/customer-routes/settings'),library: require('../lib/customer-routes/library'),checkout: require('../lib/customer-routes/checkout'),claim: require('../lib/customer-routes/claim'),download: require('../lib/customer-routes/download'),webhook: require('../lib/customer-routes/webhook')});
module.exports = async function handler(req, res) {
  const originalPath = String(req.url || '').split('?')[0];
  const route = String(req.query?.customer || '');
  if (Object.prototype.hasOwnProperty.call(customerRoutes, route)) return customerRoutes[route](req, res);
  if ((req.query && req.query.store === 'checkout') || originalPath === '/api/store/checkout') return storeCheckout(req, res);
  if ((req.query && req.query.store === 'download') || originalPath === '/api/store/download') return storeDelivery(req, res);
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

// Allow raw Stripe-Signature validation on webhook requests. Other managed routes
// use GET or parse their limited JSON request bodies explicitly.
module.exports.config={api:{bodyParser:false}};
