'use strict';
const EXPECTED_CHECKOUT = 'https://pay.cakto.com.br/g6gcpgr_1217766';
const EXPECTED_PRICE_CENTS = 3990;

function paymentLink(raw) {
  if (typeof raw !== 'string' || raw.length > 512) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.host !== 'pay.cakto.com.br' ||
        url.username || url.password || url.port || url.hash || url.search ||
        url.pathname !== '/g6gcpgr_1217766') return null;
    return url.href;
  } catch (_) { return null; }
}
function sale() {
  const link = paymentLink(process.env.STORE_CAKTO_CHECKOUT_URL);
  const price = Number(process.env.STORE_CAKTO_PRICE_CENTS);
  const productId = String(process.env.CAKTO_PRODUCT_ID || '');
  const valid = link === EXPECTED_CHECKOUT &&
    price === EXPECTED_PRICE_CENTS &&
    /^[0-9a-fA-F-]{36}$/.test(productId) &&
    process.env.STORE_CAKTO_DELIVERY_VERIFIED === 'true' &&
    process.env.STORE_CAKTO_LICENSE_VERIFIED === 'true' &&
    process.env.STORE_CAKTO_SALES_ENABLED === 'true';
  return {
    available: valid,
    link,
    price: valid ? new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'}).format(price / 100) : null
  };
}
module.exports = function handler(req,res) {
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  res.setHeader('Vary','Origin');
  const cfg = sale();
  if (req.method === 'GET') return res.status(200).json({
    product:'creative-tools', available:cfg.available, priceLabel:cfg.available ? cfg.price : null
  });
  if (req.method === 'POST') {
    const origin=String(req.headers.origin || ''), host=String(req.headers.host || '');
    if (origin) {
      try { if (new URL(origin).host !== host) return res.status(403).json({error:'Origem não permitida'}); }
      catch (_) { return res.status(403).json({error:'Origem inválida'}); }
    }
    if (!cfg.available) return res.status(503).json({error:'Vendas ainda não habilitadas'});
    res.setHeader('Location',cfg.link);
    return res.status(303).end();
  }
  res.setHeader('Allow','GET, POST');
  return res.status(405).json({error:'Método não permitido'});
};
module.exports._test = {paymentLink,sale};
