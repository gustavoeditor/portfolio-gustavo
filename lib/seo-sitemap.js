/* Live sitemap: original videos (seo-originals.json, built by scripts/build-seo.cjs) plus
   panel uploads from the Blob catalogue, minus everything the editor took off the site.
   Served at /sitemap.xml through api/managed-projects.js (the plan's function limit). */
const originals = require('../seo-originals.json');
const { hasStore, readSnapshot } = require('./managed-projects');
const { reviews } = require('../portfolio-quality.js');

const SITE = 'https://portfolio-gustavo-chi.vercel.app';
const CATEGORY = {cs2:'Edição de CS2',cinematics:'Cinematic 3D',youtube:'Edição para YouTube',motion:'Motion design',outros:'Projeto especial'};
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const BLOB = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/gustavo\/(videos|capas)\//i;
const hiddenTitle = t => String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim() === 'keydrop awp product cinematic';

function liveVideos(snapshot) {
  const hidden = new Set(snapshot.hidden || []);
  const fromOriginals = originals.videos.filter(v => !hidden.has(v.key));
  const fromUploads = (snapshot.projects || [])
    .filter(p => p && p.title && BLOB.test(p.src||'') && BLOB.test(p.poster||'') && !hidden.has(p.src) && !hiddenTitle(p.title))
    .map(p => ({
      key: p.src, name: String(p.title).slice(0,100),
      description: `${String(p.description||p.title).replace(/\.$/,'')}. ${CATEGORY[p.category]||''} por Gustavo, editor de vídeo.`.trim(),
      thumbnail: p.poster, content: p.src, date: p.publishedAt || originals.generatedAt,
      duration: reviews[p.src] ? reviews[p.src].meta.duration : null
    }));
  return [...fromOriginals, ...fromUploads];
}
function buildSitemap(videos, pages = originals.pages) {
  const newest = videos.map(v => v.date).filter(Boolean).sort().pop();
  const home = [originals.generatedAt.slice(0,10), newest ? newest.slice(0,10) : ''].sort().pop();
  const videoXml = videos.map(v => `    <video:video>
      <video:thumbnail_loc>${esc(v.thumbnail)}</video:thumbnail_loc>
      <video:title>${esc(v.name)}</video:title>
      <video:description>${esc(v.description)}</video:description>
      <video:content_loc>${esc(v.content)}</video:content_loc>${v.duration ? `\n      <video:duration>${Math.round(v.duration)}</video:duration>` : ''}
      <video:publication_date>${esc(v.date)}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
    </video:video>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${pages.map(([p, d]) => `  <url>
    <loc>${SITE}${p}</loc>
    <lastmod>${p === '/' ? home : d}</lastmod>${p === '/' && videoXml ? '\n' + videoXml : ''}
  </url>`).join('\n')}
</urlset>
`;
}
async function sitemap(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow','GET, HEAD'); return res.status(405).end(); }
  let snapshot = {projects:[], hidden:[]};
  if (hasStore()) {
    try { snapshot = await readSnapshot(); }
    catch (error) { console.warn('sitemap catalogue unavailable', error.message); }
  }
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // Short CDN cache: a video taken off the site leaves the sitemap within minutes.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(200).send(buildSitemap(liveVideos(snapshot)));
}
module.exports = sitemap;
module.exports.buildSitemap = buildSitemap;
module.exports.liveVideos = liveVideos;
