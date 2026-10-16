const registry = require('../canais.json');

// Only registered YouTube channels can trigger an upstream request.
function channelURL(value) {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port ||
        !['youtube.com', 'www.youtube.com'].includes(u.hostname) ||
        !/^\/(?:@[a-zA-Z0-9_.-]+|channel\/UC[a-zA-Z0-9_-]+|c\/[a-zA-Z0-9_.-]+|user\/[a-zA-Z0-9_.-]+)\/?$/.test(u.pathname)) return null;
    return 'https://www.youtube.com' + u.pathname.replace(/\/$/, '');
  } catch (_) { return null; }
}

function avatarURL(html) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const tag = tags.find(t => /\bproperty=["']og:image["']/i.test(t));
  const raw = tag && /\bcontent=["']([^"']+)["']/i.exec(tag);
  if (!raw) return null;
  try {
    const u = new URL(raw[1].replace(/&amp;/g, '&'));
    if (u.protocol !== 'https:' || u.username || u.password || u.port ||
        !['yt3.googleusercontent.com', 'yt3.ggpht.com'].includes(u.hostname)) return null;
    return u.href;
  } catch (_) { return null; }
}

async function boundedHTML(response) {
  if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') || '')) throw new Error('Channel unavailable');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 3 * 1024 * 1024) throw new Error('Channel response too large');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString('utf8');
}

async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).end(); }
  const url = channelURL(req.query && req.query.channel);
  const registered = [...(registry.atuais || []), ...(registry.anteriores || [])]
    .some(entry => url && channelURL(entry.url) === url);
  if (!registered) { res.setHeader('Cache-Control', 'no-store'); return res.status(404).end(); }
  try {
    const response = await fetch(url, {
      redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: {'Accept-Language': 'pt-BR,pt;q=0.9', 'User-Agent': 'Mozilla/5.0'}
    });
    const image = avatarURL(await boundedHTML(response));
    if (!image) throw new Error('Avatar unavailable');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=604800');
    res.setHeader('Location', image);
    return res.status(302).end();
  } catch (_) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).end();
  }
}

module.exports = handler;
module.exports.channelURL = channelURL;
module.exports.avatarURL = avatarURL;
