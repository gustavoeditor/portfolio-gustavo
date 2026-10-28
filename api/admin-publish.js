const {BlobPreconditionFailedError} = require('@vercel/blob');
const { validMutation, privateHeaders, parseJsonBody } = require('../lib/admin-session');
const { hasStore, readSnapshot, writeManaged, cleanProject, validUploadedUrl, validHiddenKey } = require('../lib/managed-projects');
module.exports = async function handler(req, res) {
  privateHeaders(res);
  if (!['POST','DELETE','PATCH'].includes(req.method)) { res.setHeader('Allow','POST, DELETE, PATCH'); return res.status(405).end(); }
  if (!validMutation(req)) return res.status(403).json({error:'Acesso negado ou sessão expirada.'});
  if (!hasStore()) return res.status(503).json({error:'Conecte o Vercel Blob ao projeto antes de publicar.'});
  let body;
  try { body = parseJsonBody(req); } catch (_) { return res.status(400).json({error:'Dados inválidos.'}); }
  try {
    const snapshot = await readSnapshot();
    const projects = snapshot.projects;
    // PATCH: take a video off the site (hidden:true) or put it back (hidden:false). Files are kept.
    if (req.method === 'PATCH') {
      const key = String(body.key || '');
      if (!validHiddenKey(key) || typeof body.hidden !== 'boolean') return res.status(400).json({error:'Vídeo inválido.'});
      const hidden = new Set(snapshot.hidden || []);
      if (body.hidden) hidden.add(key); else hidden.delete(key);
      await writeManaged(projects, snapshot, [...hidden]);
      return res.status(200).json({ok:true,hidden:[...hidden]});
    }
    if (req.method === 'DELETE') {
      const id = String(body.id || '');
      if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({error:'Identificador inválido.'});
      const next = projects.filter(p=>p.id!==id);
      if (next.length===projects.length) return res.status(404).json({error:'Projeto não encontrado.'});
      await writeManaged(next,snapshot);
      return res.status(200).json({ok:true,projects:next});
    }
    const uploadId = String(body.uploadId || '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uploadId)) return res.status(400).json({error:'Identificador de envio inválido.'});
    const existing=projects.find(p=>p.id===uploadId);
    if (existing) return res.status(200).json({ok:true,project:existing});
    if (projects.length >= 100) return res.status(409).json({error:'Limite de projetos atingido.'});
    let project;
    try {project=cleanProject(body);} catch (_) {return res.status(422).json({error:'Revise título, categoria e posição.'});}
    if (!await validUploadedUrl(project.src,'videos') || !await validUploadedUrl(project.poster,'capas')) {
      return res.status(422).json({error:'Vídeo ou capa não pertence ao armazenamento deste portfólio.'});
    }
    project.id = uploadId;
    project.publishedAt = new Date().toISOString();
    const next = [...projects,project];
    await writeManaged(next,snapshot);
    return res.status(201).json({ok:true,project,projects:next});
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError || /already exists/i.test(error.message)) return res.status(409).json({error:'O catálogo foi atualizado em outra aba. Tente publicar novamente; os arquivos já enviados serão reaproveitados.'});
    console.error('admin publish error',error.message);
    return res.status(500).json({error:'Não foi possível atualizar a galeria. Tente novamente.'});
  }
};
