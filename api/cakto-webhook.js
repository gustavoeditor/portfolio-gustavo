'use strict';
const crypto = require('node:crypto');

const MAX_BODY_BYTES = 128 * 1024;
const TOLERANCE_SECONDS = 5 * 60;
const EVENTS = new Set(['purchase_approved', 'refund', 'chargeback']);

function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function isValidSignature(raw, headers, secret, now = Date.now()) {
  const timestamp = String(headers['x-cakto-timestamp'] || '');
  const signature = String(headers['x-cakto-signature'] || '');
  if (!/^\d{10,11}$/.test(timestamp) || Math.abs(Math.floor(now / 1000) - Number(timestamp)) > TOLERANCE_SECONDS) return false;
  if (!/^v1=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = 'v1=' + crypto.createHmac('sha256', secret).update(timestamp + '.').update(raw).digest('hex');
  return equal(signature.toLowerCase(), expected);
}
async function rawRequestBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += part.length;
    if (size > MAX_BODY_BYTES) throw new RangeError('Webhook body too large');
    chunks.push(part);
  }
  if (!size) throw new SyntaxError('Empty webhook body');
  return Buffer.concat(chunks);
}
function settings(env) {
  const secret = env.CAKTO_WEBHOOK_SECRET;
  const projectId = String(env.CAKTO_PRODUCT_ID || '');
  const offerId = String(env.CAKTO_OFFER_ID || '');
  const supabaseUrl = String(env.SUPABASE_URL || '');
  const supabaseKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  let host = '';
  try { const parsed = new URL(supabaseUrl); host = parsed.protocol === 'https:' ? parsed.hostname : ''; }
  catch (_) { return null; }
  if (!secret || secret.length < 24 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId) ||
      !/^[a-zA-Z0-9_-]{4,100}$/.test(offerId) ||
      !/^[a-z0-9]{20}\.supabase\.co$/.test(host) || !supabaseKey || supabaseKey.length < 24) return null;
  return {secret, projectId: projectId.toLowerCase(), offerId, supabaseUrl: 'https://' + host, supabaseKey};
}
function acceptedOrder(event, order, cfg) {
  if (!order || typeof order !== 'object' || Array.isArray(order) ||
      String(order.product?.id || '').toLowerCase() !== cfg.projectId ||
      String(order.offer?.id || '') !== cfg.offerId || order.offer_type !== 'main') return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(order.id || '')) || order.currency !== 'BRL') return null;
  const expectedStatus = {purchase_approved:'paid', refund:'refunded', chargeback:'chargedback'}[event];
  if (order.status !== expectedStatus) return null;
  const email = String(order.customer?.email || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (event === 'purchase_approved') {
    if (!Number.isFinite(order.offer?.price) || Math.round(order.offer.price * 100) !== 3990 ||
        typeof order.amount !== 'number' || !Number.isFinite(order.amount) || order.amount <= 0) return null;
  }
  return {p_order_id: String(order.id).toLowerCase(), p_product_id: cfg.projectId,
    p_offer_id: cfg.offerId, p_customer_email: email, p_event: event};
}
async function recordOrder(order, cfg, fetchFn = fetch) {
  const response = await fetchFn(cfg.supabaseUrl + '/rest/v1/rpc/record_creative_tools_cakto_order', {
    method:'POST',
    headers:{'Content-Type':'application/json',apikey:cfg.supabaseKey,Authorization:'Bearer ' + cfg.supabaseKey},
    body:JSON.stringify(order),
    signal:AbortSignal.timeout(4000)
  });
  if (!response.ok) throw new Error('Order persistence unavailable');
}
function handlerFactory(deps = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('X-Robots-Tag','noindex, nofollow');
    if (req.method !== 'POST') {
      res.setHeader('Allow','POST');
      return res.status(405).json({error:'Método não permitido'});
    }
    const cfg = settings(deps.env || process.env);
    if (!cfg) return res.status(503).json({error:'Integração indisponível'});
    if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
      return res.status(415).json({error:'Formato não suportado'});
    }
    try {
      const raw = await (deps.readBody || rawRequestBody)(req);
      if (!Buffer.isBuffer(raw) || raw.length > MAX_BODY_BYTES) return res.status(413).json({error:'Payload excessivo'});
      if (!isValidSignature(raw, req.headers, cfg.secret, deps.now || Date.now())) return res.status(401).json({error:'Assinatura inválida'});
      const payload = JSON.parse(raw.toString('utf8'));
      if (!equal(payload?.secret, cfg.secret) || typeof payload?.event !== 'string') return res.status(401).json({error:'Evento inválido'});
      if (!EVENTS.has(payload.event)) return res.status(200).json({ok:true,ignored:true});
      const orders = Array.isArray(payload.data) ? payload.data : [payload.data];
      if (!orders.length || orders.length > 25) return res.status(400).json({error:'Formato de evento inválido'});
      const selected = orders.map(order => acceptedOrder(payload.event, order, cfg)).filter(Boolean);
      for (const order of selected) await (deps.recordOrder || recordOrder)(order, cfg, deps.fetch);
      return res.status(200).json({ok:true,processed:selected.length});
    } catch (error) {
      if (error instanceof RangeError) return res.status(413).json({error:'Payload excessivo'});
      if (error instanceof SyntaxError) return res.status(400).json({error:'JSON inválido'});
      // Never log the event body, customer details, signature or credentials.
      console.error('Cakto webhook processing failed:', error?.name || 'unknown');
      return res.status(503).json({error:'Não foi possível registrar o evento'});
    }
  };
}
module.exports = handlerFactory();
module.exports._test = {equal, isValidSignature, rawRequestBody, settings, acceptedOrder, recordOrder, handlerFactory};
