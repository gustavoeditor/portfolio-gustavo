// Envia um instalador APROVADO para o Vercel Blob PRIVADO usado pelo Creative Hub.
// Uso (PowerShell aberto pelo menu Iniciar, fora de apps empacotados):
//   $t = Read-Host "Token do Blob privado" -AsSecureString
//   $env:CREATIVE_HUB_BLOB_TOKEN = [Net.NetworkCredential]::new('', $t).Password
//   node scripts/upload-creative-hub-package.mjs <instalador.exe> [creative-tools|creative-hub]
// Confere SHA-256 e tamanho contra a release em "latest" do feed do produto e envia para o
// `privatePath` declarado nela. Publicar uma versão = editar o feed + enviar o arquivo.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { put } from '@vercel/blob';

const FEEDS = {
  'creative-tools': '../updates/creative-tools/hub-manifest.json',
  'creative-hub': '../updates/creative-hub/manifest.json',
};
const file = process.argv[2];
const product = process.argv[3] || 'creative-tools';
const token = process.env.CREATIVE_HUB_BLOB_TOKEN || process.env.CT_HUB_PRIVATE_BLOB_TOKEN || '';
if (!file) throw new Error('Informe o caminho do instalador .exe aprovado.');
if (!FEEDS[product]) throw new Error('Produto desconhecido: ' + product);
if (token.length < 30) throw new Error('Defina CREATIVE_HUB_BLOB_TOKEN com o token do Blob privado.');
if (!token.startsWith('vercel_blob_rw_')) throw new Error('O token não parece ser de um Blob store (vercel_blob_rw_...).');

const feed = JSON.parse(readFileSync(new URL(FEEDS[product], import.meta.url), 'utf8'));
const release = feed.releases.find((r) => r.version === feed.latest);
if (!release) throw new Error('O feed não tem release em "latest".');
const pathname = release.privatePath || '';
if (!new RegExp('^creative-hub/packages/' + product + '/[A-Za-z0-9._-]+\\.exe$').test(pathname)) {
  throw new Error('Release sem privatePath válido no feed.');
}

const bytes = readFileSync(file);
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (sha256 !== release.sha256 || bytes.length !== release.size) {
  throw new Error(`Arquivo diferente do aprovado: sha256=${sha256} size=${bytes.length}; esperado ${release.sha256} / ${release.size}`);
}
const result = await put(pathname, bytes, {
  access: 'private',
  token,
  addRandomSuffix: false,
  allowOverwrite: false,
  contentType: 'application/octet-stream',
});
console.log(`Enviado para o Blob privado: ${result.pathname} (${bytes.length} bytes, SHA-256 conferido)`);
console.log('Na Vercel (uma vez só; Preview primeiro): CREATIVE_HUB_DELIVERY_ENABLED=true e CREATIVE_HUB_BLOB_TOKEN (Sensitive).');
