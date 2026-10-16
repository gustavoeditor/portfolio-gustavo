const crypto = require('crypto');

const cookieName = 'portfolio_admin';
function signSession(expires) {
  const credentialVersion = crypto.createHash('sha256')
    .update(process.env.ADMIN_PASSWORD || '').update('|').update(process.env.ADMIN_TOTP_SECRET || '').digest('hex');
  return crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET)
    .update('v2|' + expires + '|' + credentialVersion).digest('hex');
}
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
  const expected = signSession(expires);
  return constantEquals(signature, expected);
}
function validSameOriginAdmin(req) {
  if (!isAdmin(req)) return false;
  return sameOrigin(req);
}
function sameOrigin(req) {
  const origin = String(req.headers.origin || '');
  const host = String(req.headers.host || req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  return Boolean(host) && origin === 'https://' + host;
}
function validMutation(req) {
  return validSameOriginAdmin(req) && req.headers['x-gustavo-admin'] === '1';
}
function privateHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
}
function parseJsonBody(req, maxBytes = 2 * 1024 * 1024) {
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) throw new Error('Envie JSON.');
  const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('JSON inválido.');
  if (Buffer.byteLength(JSON.stringify(raw)) > maxBytes) throw new Error('Dados muito grandes.');
  return raw;
}
module.exports = { isAdmin, signSession, constantEquals, sameOrigin, validSameOriginAdmin, validMutation, privateHeaders, parseJsonBody };
