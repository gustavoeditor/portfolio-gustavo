const { validMutation, privateHeaders, parseJsonBody } = require('../lib/admin-session');
const { hasStore, readManaged, writeManaged, cleanProject, validUploadedUrl } = require('../lib/managed-projects');
const crypto = require('crypto');
module.exports = async function handler(req, res) {
  privateHeaders(res);
  if (!['POST','DELETE'].includes(req.method)) { res.setHeader('Allow','POST, DELETE'); return res.status(405).end(); }
  if (!validMutation(req)) return res.status(403).json({error:'Acesso negado ou sessão expirada.'});
  if (!hasStore()) return res.status(503).json({error:'Conecte o Vercel Blob ao projeto antes de publicar.'});
  let body;
  try { body = parseJsonBody(req); } catch (_) { return res.status(400).json({error:'Dados inválidos.'}); }
  try {
    const projects = await readManaged();
    if (req.method === 'DELETE') {
      const id = String(body.id || '');
      if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({error:'Identificador inválido.'});
      const next = projects.filter(p=>p.id!==id);
      if (next.length===projects.length) return res.status(404).json({error:'Projeto não encontrado.'});
      await writeManaged(next);
      return res.status(200).json({ok:true,projects:next});
    }
    if (projects.length >= 100) return res.status(409).json({error:'Limite de projetos atingido.'});
    const project = cleanProject(body);
    if (!await validUploadedUrl(project.src,'videos') || !await validUploadedUrl(project.poster,'capas')) {
      return res.status(422).json({error:'Vídeo ou capa não pertence ao armazenamento deste portfólio.'});
    }
    project.id = crypto.randomUUID();
    project.publishedAt = new Date().toISOString();
    const next = [...projects,project];
    await writeManaged(next);
    return res.status(201).json({ok:true,project,projects:next});
  } catch (error) {
    console.error('admin publish error',error.message);
    return res.status(500).json({error:'Não foi possível atualizar a galeria. Tente novamente.'});
  }
};
