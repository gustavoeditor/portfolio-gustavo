const { validMutation, privateHeaders, parseJsonBody } = require('../lib/admin-session');
const { VALID_CATEGORIES } = {VALID_CATEGORIES:new Set(['cs2','cinematics','motion','youtube','outros'])};
function guess(name, total) {
  const s = String(name || '').replace(/\.[^.]+$/, '').replace(/[_.-]+/g, ' ').trim();
  const title = s.slice(0,90) || 'Novo projeto';
  let category = 'cinematics';
  if (/(motion|kinetic|typograph|carton|texto|animac[aã]o)/i.test(s)) category = 'motion';
  else if (/(youtube|tutorial|gameplay|react|vlog)/i.test(s)) category = 'youtube';
  else if (/(cs2|counter.?strike|frag|kill|inspect|doppler|emerald|karambit|awp|butterfly)/i.test(s)) category = 'cs2';
  const position = category === 'cinematics' || category === 'cs2' ? Math.min(5,total) : Math.min(total,12);
  return {title,category,position,description:'',source:'filename',explanation:'Sugestão inicial pelo nome. Conecte a IA visual para analisar os quadros do vídeo.'};
}
function cleanAIResult(raw, total, fallback) {
  const category = String(raw.category || '').toLowerCase();
  return {
    title:String(raw.title || fallback.title).trim().slice(0,90)||fallback.title,
    category:VALID_CATEGORIES.has(category)?category:fallback.category,
    position:Math.max(0,Math.min(total,Number.isInteger(Number(raw.position))?Number(raw.position):fallback.position)),
    description:String(raw.description || '').trim().slice(0,220),
    source:'ai',
    explanation:String(raw.reason || 'Sugestão baseada em quadros do vídeo, sujeita à revisão.').slice(0,220)
  };
}
module.exports=async function handler(req,res) {
  privateHeaders(res);
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).end(); }
  if (!validMutation(req)) return res.status(403).json({error:'Acesso negado.'});
  let body;
  try{body=parseJsonBody(req);}catch(_){return res.status(400).json({error:'JSON inválido.'});}
  const name=String(body.name||'').slice(0,170);
  const total=Math.max(0,Math.min(150,Number(body.total)||17));
  const fallback=guess(name,total);
  if (!process.env.OPENAI_API_KEY) return res.status(200).json(fallback);
  const frames=Array.isArray(body.frames)?body.frames.slice(0,3):[];
  if (!frames.length||frames.some(f=>typeof f!=='string'||f.length>220000||!/^data:image\/(jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(f))) {
    return res.status(200).json(fallback);
  }
  try{
    const response=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{'Authorization':'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:process.env.OPENAI_VISION_MODEL||'gpt-4.1-mini',
        temperature:0.2,
        response_format:{type:'json_object'},
        messages:[
          {role:'system',content:'Você é diretor de criação para um portfólio de editor de vídeo. Analise até 3 quadros fornecidos (não o movimento nem o áudio). Classifique em UMA categoria: cs2, cinematics, motion, youtube, outros. Sugira título profissional curto, descrição objetiva, razão resumida, e posição no portfólio começando em zero. Existem '+total+' trabalhos no site já ordenados por qualidade, portanto preserve o topo para material excepcional, colocando projetos comuns perto do fim. Evite alegações de assistir ao vídeo completo. Responda somente JSON: {"title":"...","category":"...","description":"...","position":0,"reason":"..."}.'},
          {role:'user',content:[{type:'text',text:'Nome do arquivo: '+name+'. Categoria e posição devem ser recomendadas com prudência a partir destes quadros.'},...frames.map(frame=>({type:'image_url',image_url:{url:frame,detail:'low'}}))]}
        ]
      }),
      signal:AbortSignal.timeout(18000)
    });
    if(!response.ok) throw new Error('AI HTTP '+response.status);
    const data=await response.json();
    const suggestion=JSON.parse(data.choices?.[0]?.message?.content||'{}');
    return res.status(200).json(cleanAIResult(suggestion,total,fallback));
  }catch(e){
    console.error('visual classification skipped',e.message);
    return res.status(200).json({...fallback,explanation:'A análise visual não ficou disponível. Sugestão feita pelo nome do arquivo; revise antes de publicar.'});
  }
};
