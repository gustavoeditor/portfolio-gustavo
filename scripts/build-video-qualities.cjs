#!/usr/bin/env node
// Builds video-qualities.js: the real resolutions available for each portfolio video.
// The player uses it so each video only lists the qualities it actually has, with the
// right names (a 1080p base file is never called "720p", vertical videos use the short side).
// Usage: node scripts/build-video-qualities.cjs   (needs ffprobe on PATH or in FFPROBE)
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const ffprobe = process.env.FFPROBE || 'ffprobe';
// Lightest to heaviest; when two files have the same resolution the one with the higher bitrate wins.
const FOLDERS = ['videos-144', 'videos-240', 'videos-360', 'videos-480', 'videos-720', 'videos',
  'videos-1080', 'videos-1440', 'videos-2160'];
const MANAGED_FILE = path.join(root, 'video-renditions', 'managed.json');

function probe(file) {
  const out = execFileSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height:format=bit_rate,duration', '-of', 'json', file], { encoding: 'utf8' });
  const data = JSON.parse(out);
  const stream = (data.streams || [])[0] || {};
  const width = Number(stream.width), height = Number(stream.height);
  if (!width || !height) throw new Error('Resolução ilegível: ' + file);
  const kbps = Math.round(Number(data.format?.bit_rate || 0) / 1000);
  return { width, height, kbps };
}

const slugs = fs.readdirSync(path.join(root, 'videos'))
  .filter(name => /^[a-z0-9-]+\.mp4$/i.test(name))
  .map(name => name.slice(0, -4))
  .sort();

const manifest = {};
for (const slug of slugs) {
  const bySize = new Map();
  for (const folder of FOLDERS) {
    const file = path.join(root, folder, slug + '.mp4');
    if (!fs.existsSync(file)) continue;
    const info = probe(file);
    const size = Math.min(info.width, info.height);
    const level = { url: '/' + folder + '/' + slug + '.mp4', width: info.width, height: info.height,
      bytes: fs.statSync(file).size, kbps: info.kbps };
    const previous = bySize.get(size);
    if (!previous || level.kbps > previous.kbps) bySize.set(size, level);
  }
  manifest[slug] = [...bySize.entries()].sort((a, b) => a[0] - b[0]).map(([, level]) => level);
}

// Panel uploads (Vercel Blob originals): keyed by the original's URL.
if (fs.existsSync(MANAGED_FILE)) {
  const state = JSON.parse(fs.readFileSync(MANAGED_FILE, 'utf8'));
  for (const [src, entry] of Object.entries(state.sources || {})) {
    const levels = [];
    for (const level of entry.levels || []) {
      const file = path.join(root, level.url);
      if (!fs.existsSync(file)) continue;
      const info = probe(file);
      levels.push({ url: level.url, width: info.width, height: info.height, bytes: fs.statSync(file).size, kbps: info.kbps });
    }
    if (levels.length) manifest[src] = levels.sort((a, b) => Math.min(a.width, a.height) - Math.min(b.width, b.height));
  }
}

const body = '// Gerado por scripts/build-video-qualities.cjs. Não edite à mão.\n' +
  'window.GUSTAVO_VIDEO_QUALITIES=' + JSON.stringify(manifest) + ';\n';
fs.writeFileSync(path.join(root, 'video-qualities.js'), body);
for (const [slug, levels] of Object.entries(manifest)) {
  console.log(slug.padEnd(34) + levels.map(l => Math.min(l.width, l.height) + 'p').join(' / '));
}
