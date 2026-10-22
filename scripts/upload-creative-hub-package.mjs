// Envia o instalador APROVADO do Creative Tools para o Vercel Blob PRIVADO usado pelo Creative Hub.
// Uso (PowerShell):
//   $env:CT_HUB_PRIVATE_BLOB_TOKEN = "<token do Blob privado>"   # nunca commitar
//   node scripts/upload-creative-hub-package.mjs <caminho\Creative_Tools_BETA_PREMIUM_MENU_WINDOWS.exe>
// O script confere SHA-256 e tamanho contra updates/creative-tools/hub-manifest.json antes de enviar
// e imprime as variáveis CT_HUB_* que devem ser configuradas na Vercel (Preview primeiro).
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { put } from '@vercel/blob';

const file = process.argv[2];
const token = process.env.CT_HUB_PRIVATE_BLOB_TOKEN || '';
if (!file) throw new Error('Informe o caminho do instalador .exe aprovado.');
if (token.length < 30) throw new Error('Defina CT_HUB_PRIVATE_BLOB_TOKEN com o token do Blob privado.');

const feed = JSON.parse(readFileSync(new URL('../updates/creative-tools/hub-manifest.json', import.meta.url), 'utf8'));
const release = feed.releases.find((r) => r.version === feed.latest);
if (!release) throw new Error('hub-manifest.json sem release em "latest".');

const bytes = readFileSync(file);
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (sha256 !== release.sha256 || bytes.length !== release.size) {
  throw new Error(`Arquivo diferente do aprovado: sha256=${sha256} size=${bytes.length}; esperado ${release.sha256} / ${release.size}`);
}
const pathname = `creative-hub/packages/creative-tools/Creative_Tools_Setup_${release.version}.exe`;
const result = await put(pathname, bytes, {
  access: 'private',
  token,
  addRandomSuffix: false,
  allowOverwrite: false,
  contentType: 'application/octet-stream',
});
console.log('Enviado para o Blob privado:', result.pathname);
console.log('\nConfigure na Vercel (ambiente Preview; Production só após aprovação):');
console.log('CT_HUB_ENABLED=true');
console.log(`CT_HUB_VERSION=${release.version}`);
console.log(`CT_HUB_PRIVATE_BLOB_PATH=${pathname}`);
console.log(`CT_HUB_SHA256=${sha256}`);
console.log(`CT_HUB_SIZE=${bytes.length}`);
console.log('CT_HUB_PRIVATE_BLOB_TOKEN=<o mesmo token, como variável Sensitive>');
console.log('CT_HUB_LICENSE_SHA256=<SHA-256 das chaves de teste, separadas por vírgula>');
