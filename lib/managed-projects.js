const { get, put, head } = require('@vercel/blob');
const PATH = 'gustavo-admin/projects-v1.json';
const VALID_CATEGORIES = new Set(['cs2','cinematics','motion','youtube','outros']);
const hasStore = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
async function readManaged() {
  if (!hasStore()) return [];
  const stored = await get(PATH, { access: 'public' });
  if (!stored) return [];
  if (!stored.stream) throw new Error('Não foi possível ler o catálogo.');
  const json = await new Response(stored.stream).json();
  return Array.isArray(json.projects) ? json.projects.filter(p => p && typeof p === 'object').slice(0, 150) : [];
}
async function writeManaged(projects) {
  if (!hasStore()) throw new Error('Conecte o armazenamento Vercel Blob.');
  const payload = JSON.stringify({version:1,projects,updatedAt:new Date().toISOString()});
  const result = await put(PATH, payload, {
    access:'public', addRandomSuffix:false, allowOverwrite:true,
    contentType:'application/json', cacheControlMaxAge:60
  });
  return result;
}
async function validUploadedUrl(url, kind) {
  if (typeof url !== 'string' || url.length > 800) return false;
  let u;
  try { u = new URL(url); } catch (_) { return false; }
  if (u.protocol !== 'https:' || !u.hostname.endsWith('.public.blob.vercel-storage.com')) return false;
  if (!u.pathname.includes('/gustavo/' + kind + '/')) return false;
  try {
    const metadata = await head(url);
    return Boolean(metadata && metadata.url === url && metadata.size > 0);
  } catch (_) { return false; }
}
function cleanProject(input) {
  const title = String(input.title || '').trim().slice(0,90);
  const description = String(input.description || '').trim().slice(0,220);
  const category = String(input.category || '').toLowerCase();
  const src = String(input.src || '');
  const poster = String(input.poster || '');
  const place = Number(input.position);
  if (!title || !VALID_CATEGORIES.has(category) || !Number.isInteger(place) || place < 0 || place > 150) {
    throw new Error('Revise título, categoria e posição.');
  }
  return { title, category, src, poster, description, position:place };
}
module.exports={ hasStore, readManaged, writeManaged, validUploadedUrl, cleanProject };
