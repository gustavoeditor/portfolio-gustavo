#!/usr/bin/env node
// Generates the quality ladder (144p → 2160p) for every portfolio video, never above
// the video's own resolution (no fake upscaling). Writes videos-<altura>/<nome>.mp4.
//
//   node scripts/generate-video-ladder.cjs            local videos + panel uploads
//   node scripts/generate-video-ladder.cjs --local    only videos/ (repo)
//   node scripts/generate-video-ladder.cjs --managed  only uploads from the admin panel
//
// Local videos: the best file in the repo is the source; rungs that already exist are kept.
// Panel uploads: the original on Vercel Blob is downloaded once; results are recorded in
// video-renditions/managed.json so each upload is encoded only once.
// Afterwards run scripts/build-video-qualities.cjs (the workflow does both).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FFPROBE = process.env.FFPROBE || 'ffprobe';
const SITE = process.env.SITE_URL || 'https://portfolio-gustavo-chi.vercel.app';
const MANAGED_FILE = path.join(root, 'video-renditions', 'managed.json');
const BLOB_VIDEO = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/gustavo\/videos\/[A-Za-z0-9-]+\.(mp4|webm)$/;
// Short side → encoder settings. CRF keeps quality steady; maxrate keeps each rung light.
const LADDER = [
  { size: 144, crf: 30, maxrate: '250k', audio: '48k' },
  { size: 240, crf: 29, maxrate: '500k', audio: '64k' },
  { size: 360, crf: 27, maxrate: '900k', audio: '64k' },
  { size: 480, crf: 26, maxrate: '1500k', audio: '96k' },
  { size: 720, crf: 24, maxrate: '3200k', audio: '128k' },
  { size: 1080, crf: 23, maxrate: '6500k', audio: '128k' },
  { size: 1440, crf: 22, maxrate: '12000k', audio: '160k' },
  { size: 2160, crf: 21, maxrate: '24000k', audio: '160k' },
];
// A source a few pixels short of a rung (e.g. 1072p) still gets that rung.
const fits = (rung, sourceSize) => rung.size <= sourceSize * 1.02;
const LOCAL_FOLDERS = ['videos', 'videos-1080', 'videos-1440', 'videos-2160',
  ...LADDER.map(r => 'videos-' + r.size)];

function probe(file) {
  const out = execFileSync(FFPROBE, ['-v', 'error', '-show_entries',
    'stream=codec_type,width,height:format=bit_rate', '-of', 'json', file], { encoding: 'utf8' });
  const data = JSON.parse(out);
  const video = (data.streams || []).find(s => s.codec_type === 'video') || {};
  const width = Number(video.width), height = Number(video.height);
  if (!width || !height) throw new Error('Resolução ilegível: ' + file);
  return { width, height, size: Math.min(width, height), kbps: Math.round(Number(data.format?.bit_rate || 0) / 1000),
    hasAudio: (data.streams || []).some(s => s.codec_type === 'audio') };
}

function encode(source, info, rung, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const portrait = info.height > info.width;
  const scale = portrait ? `scale=${rung.size}:-2` : `scale=-2:${rung.size}`;
  const tmp = dest + '.part.mp4';
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', source,
    '-map', '0:v:0', '-map', '0:a:0?', '-vf', scale + ':flags=lanczos', '-sn', '-dn',
    '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-crf', String(rung.crf),
    '-maxrate', rung.maxrate, '-bufsize', String(parseInt(rung.maxrate, 10) * 2) + 'k', '-pix_fmt', 'yuv420p'];
  if (info.hasAudio) args.push('-c:a', 'aac', '-b:a', rung.audio, '-ac', '2');
  args.push('-movflags', '+faststart', '-max_muxing_queue_size', '1024', tmp);
  execFileSync(FFMPEG, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  const out = probe(tmp);
  if (Math.abs(out.size - rung.size) > 2) throw new Error('Resolução errada em ' + dest);
  fs.renameSync(tmp, dest);
  console.log('  ' + rung.size + 'p → ' + path.relative(root, dest).replace(/\\/g, '/') +
    ' (' + (fs.statSync(dest).size / 1048576).toFixed(1) + ' MB)');
}

function generateLocal() {
  const slugs = fs.readdirSync(path.join(root, 'videos'))
    .filter(n => /^[a-z0-9-]+\.mp4$/.test(n)).map(n => n.slice(0, -4)).sort();
  for (const slug of slugs) {
    const files = LOCAL_FOLDERS.map(folder => path.join(root, folder, slug + '.mp4')).filter(f => fs.existsSync(f));
    const probed = files.map(file => ({ file, ...probe(file) }));
    // Best source = biggest resolution, then highest bitrate.
    const source = probed.sort((a, b) => b.size - a.size || b.kbps - a.kbps)[0];
    const have = new Set(probed.map(p => p.size));
    const missing = LADDER.filter(r => fits(r, source.size) && !have.has(r.size) &&
      !(r.size === source.size));
    console.log(slug + ': fonte ' + source.size + 'p' + (missing.length ? '' : ' — completo'));
    for (const rung of missing) encode(source.file, source, rung, path.join(root, 'videos-' + rung.size, slug + '.mp4'));
  }
}

async function generateManaged() {
  const response = await fetch(SITE + '/api/managed-projects', { headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error('Catálogo indisponível: HTTP ' + response.status);
  const catalog = await response.json();
  const hidden = new Set(Array.isArray(catalog.hidden) ? catalog.hidden : []);
  const state = fs.existsSync(MANAGED_FILE) ? JSON.parse(fs.readFileSync(MANAGED_FILE, 'utf8')) : { version: 1, sources: {} };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ladder-'));
  try {
    for (const project of Array.isArray(catalog.projects) ? catalog.projects : []) {
      const src = String(project?.src || '');
      if (!BLOB_VIDEO.test(src) || hidden.has(src)) continue;
      const id = 'up-' + crypto.createHash('sha256').update(src).digest('hex').slice(0, 12);
      const done = state.sources[src];
      if (done && done.levels.every(l => fs.existsSync(path.join(root, l.url)))) continue;
      console.log(String(project.title || id) + ': baixando original');
      const download = await fetch(src, { redirect: 'error' });
      if (!download.ok) { console.warn('  falhou HTTP ' + download.status + ', fica para a próxima'); continue; }
      const sourceFile = path.join(tmpDir, id + path.extname(src));
      fs.writeFileSync(sourceFile, Buffer.from(await download.arrayBuffer()));
      const info = probe(sourceFile);
      console.log('  fonte ' + info.width + 'x' + info.height);
      const levels = [];
      for (const rung of LADDER.filter(r => fits(r, info.size))) {
        const rel = 'videos-' + rung.size + '/' + id + '.mp4';
        const dest = path.join(root, rel);
        if (!fs.existsSync(dest)) encode(sourceFile, info, rung, dest);
        levels.push({ url: '/' + rel, size: rung.size });
      }
      state.sources[src] = { id, title: String(project.title || '').slice(0, 90), width: info.width, height: info.height,
        bytes: fs.statSync(sourceFile).size, levels, generatedAt: new Date().toISOString() };
      fs.rmSync(sourceFile, { force: true });
      fs.mkdirSync(path.dirname(MANAGED_FILE), { recursive: true });
      fs.writeFileSync(MANAGED_FILE, JSON.stringify(state, null, 1) + '\n');
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

(async () => {
  const only = process.argv[2];
  if (only !== '--managed') generateLocal();
  if (only !== '--local') await generateManaged();
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
