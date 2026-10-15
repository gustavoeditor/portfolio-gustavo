const crypto = require('crypto');
const COOKIE_NAME = 'portfolio_admin';
function ready() { return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET); }
function safeEqual(a, b) { const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b)); return aa.length === bb.length && crypto.timingSafeEqual(aa, bb); }
function sign(expires) { return crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(String(expires)).digest('hex'); }
function validSession(req) {
  const prefix = COOKIE_NAME + '='; const cookie = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(prefix));
  if (!cookie) return false; const token = cookie.slice(prefix.length); const dot = token.indexOf('.'); if (dot < 1) return false;
  const expires = token.slice(0, dot); const signature = token.slice(dot + 1); if (!/^\d{13}$/.test(expires) || Number(expires) <= Date.now()) return false;
  const expected = sign(expires); return safeEqual(signature, expected);
}
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private, max-age=0'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) { res.setHeader('Allow', 'GET, POST, DELETE'); return res.status(405).end('Method not allowed'); }
  if (!ready()) return res.status(503).json({ error: 'O painel ainda não foi configurado na Vercel.' });
  if (req.method === 'GET') return validSession(req) ? res.status(200).json({ authenticated: true }) : res.status(401).json({ authenticated: false });
  if (req.method === 'DELETE') { res.setHeader('Set-Cookie', COOKIE_NAME + '=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'); return res.status(200).json({ ok: true }); }
  const contentType = String(req.headers['content-type'] || ''); if (!contentType.toLowerCase().includes('application/json')) return res.status(415).json({ error: 'Formato inválido.' });
  let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  const submitted = body && typeof body.password === 'string' ? body.password : '';
  if (!safeEqual(submitted, process.env.ADMIN_PASSWORD)) { res.setHeader('Set-Cookie', COOKIE_NAME + '=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'); return res.status(401).json({ error: 'Senha incorreta.' }); }
  const expires = String(Date.now() + 12 * 60 * 60 * 1000); const token = expires + '.' + sign(expires);
  res.setHeader('Set-Cookie', COOKIE_NAME + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200');
  return res.status(200).json({ ok: true });
}