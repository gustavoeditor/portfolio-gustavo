const crypto = require('crypto');

const cookieName = 'portfolio_admin';
function constantEquals(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function isAdmin(req) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || !process.env.ADMIN_PASSWORD) return false;
  const cookie = String(req.headers.cookie || '').split(';')
    .map(v => v.trim()).find(v => v.startsWith(cookieName + '='));
  if (!cookie) return false;
  const token = cookie.slice(cookieName.length + 1);
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const expires = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!/^\d{13}$/.test(expires) || Number(expires) <= Date.now()) return false;
  const expected = crypto.createHmac('sha256', secret).update(expires).digest('hex');
  return constantEquals(signature, expected);
}
function validMutation(req) {
  if (!isAdmin(req) || req.headers['x-gustavo-admin'] !== '1') return false;
  const origin = String(req.headers.origin || '');
  const host = String(req.headers.host || req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  return Boolean(host) && origin === 'https://' + host;
}
function privateHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}
function parseJsonBody(req) {
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) throw new Error('Envie JSON.');
  const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('JSON inválido.');
  return raw;
}
module.exports = { isAdmin, validMutation, privateHeaders, parseJsonBody };
