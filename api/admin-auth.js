const {isAdmin, signSession, constantEquals, sameOrigin, privateHeaders, parseJsonBody} = require('../lib/admin-session');
const {allowLogin, validTotp} = require('../lib/admin-security');
const COOKIE = 'portfolio_admin';
const clearCookie = COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
module.exports = async function handler(req, res) {
  privateHeaders(res);
  if (!['GET','POST','DELETE'].includes(req.method)) {res.setHeader('Allow','GET, POST, DELETE');return res.status(405).end();}
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) return res.status(503).json({error:'O painel ainda não foi configurado na Vercel.'});
  if (req.method === 'GET') {
    const authenticated=isAdmin(req);
    return res.status(authenticated?200:401).json({authenticated,secondFactorRequired:Boolean(process.env.ADMIN_TOTP_SECRET)});
  }
  if (!sameOrigin(req)) return res.status(403).json({error:'Origem não permitida.'});
  if (req.method === 'DELETE') {res.setHeader('Set-Cookie',clearCookie);return res.status(200).json({ok:true});}
  let body;
  try {body=parseJsonBody(req,4096);} catch (_) {return res.status(400).json({error:'Formato inválido.'});}
  let limit;
  try {limit=await allowLogin(req);} catch (_) {return res.status(503).json({error:'Proteção de acesso temporariamente indisponível. Tente novamente mais tarde.'});}
  if (!limit.allowed) {res.setHeader('Retry-After',String(limit.retryAfter));return res.status(429).json({error:'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.'});}
  const password=typeof body.password==='string'?body.password:'';
  if (!constantEquals(password,process.env.ADMIN_PASSWORD) || !validTotp(body.code,process.env.ADMIN_TOTP_SECRET)) {
    res.setHeader('Set-Cookie',clearCookie);
    return res.status(401).json({error:'Senha ou código de verificação incorreto.'});
  }
  const expires=String(Date.now()+12*60*60*1000);
  res.setHeader('Set-Cookie', COOKIE+'='+expires+'.'+signSession(expires)+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200');
  return res.status(200).json({ok:true});
};
