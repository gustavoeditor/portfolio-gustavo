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
const FOLDERS = ['videos-360', 'videos-480', 'videos', 'videos-1080', 'videos-1440', 'videos-2160'];

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

const body = '// Gerado por scripts/build-video-qualities.cjs. Não edite à mão.\n' +
  'window.GUSTAVO_VIDEO_QUALITIES=' + JSON.stringify(manifest, null, 1) + ';\n';
fs.writeFileSync(path.join(root, 'video-qualities.js'), body);
for (const [slug, levels] of Object.entries(manifest)) {
  console.log(slug.padEnd(34) + levels.map(l => Math.min(l.width, l.height) + 'p').join(' / '));
}
