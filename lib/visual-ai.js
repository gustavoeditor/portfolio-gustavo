const {getVercelOidcToken} = require('@vercel/oidc');
function visualAIConfig() {
  if(process.env.OPENAI_API_KEY)return {provider:'openai',url:'https://api.openai.com/v1/chat/completions',model:process.env.OPENAI_VISION_MODEL||'gpt-4.1-mini'};
  // VERCEL=1 means OIDC may be available through request-scoped credentials.
  // This enables a real auth attempt, not an assertion that AI is operational.
  if(process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN||process.env.VERCEL==='1')return {provider:'gateway',url:'https://ai-gateway.vercel.sh/v1/chat/completions',model:process.env.AI_GATEWAY_MODEL||'openai/gpt-4.1-mini'};
  return null;
}
// Order: explicit API key, the OIDC token Vercel injects into this request's headers,
// then the library lookup (global request context / env / refresh).
async function visualAIToken(config, req) {
  if(config.provider==='openai')return process.env.OPENAI_API_KEY;
  if (process.env.AI_GATEWAY_API_KEY) return process.env.AI_GATEWAY_API_KEY;
  const header = req && req.headers && req.headers['x-vercel-oidc-token'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  try {
    const token = await getVercelOidcToken();
    if (typeof token === 'string' && token.trim()) return token;
  } catch (_) { /* Never expose token or authentication exception. */ }
  const error = new Error('AI Gateway OIDC token unavailable');
  error.name = 'MissingAICredentialsError';
  throw error;
}
module.exports={visualAIConfig,visualAIToken};
