const {getVercelOidcToken} = require('@vercel/oidc');
function visualAIConfig() {
  if(process.env.OPENAI_API_KEY)return {provider:'openai',url:'https://api.openai.com/v1/chat/completions',model:process.env.OPENAI_VISION_MODEL||'gpt-4.1-mini'};
  if(process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN)return {provider:'gateway',url:'https://ai-gateway.vercel.sh/v1/chat/completions',model:process.env.AI_GATEWAY_MODEL||'openai/gpt-4.1-mini'};
  return null;
}
async function visualAIToken(config) {
  if(config.provider==='openai')return process.env.OPENAI_API_KEY;
  return process.env.AI_GATEWAY_API_KEY||await getVercelOidcToken();
}
module.exports={visualAIConfig,visualAIToken};
