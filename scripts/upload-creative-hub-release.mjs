// Sobe o instalador do Creative Tools para o Blob PRIVADO usado pelo Creative Hub.
// Uso (PowerShell):  $env:CT_HUB_PRIVATE_BLOB_TOKEN="<token do Blob privado>"; node scripts/upload-creative-hub-release.mjs <instalador.exe> 1.8.0
// O token vem só da variável de ambiente; nunca é gravado em arquivo nem impresso.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {put} from '@vercel/blob';

const [file,version]=process.argv.slice(2);
const token=process.env.CT_HUB_PRIVATE_BLOB_TOKEN||process.env.CT_UPDATE_PRIVATE_BLOB_TOKEN||'';
if(!file||!/^\d+\.\d+\.\d+$/.test(version||''))throw Error('Uso: node scripts/upload-creative-hub-release.mjs <instalador.exe> <versao>');
if(token.length<=30)throw Error('Defina CT_HUB_PRIVATE_BLOB_TOKEN com o token do Blob privado.');
const body=await readFile(file);
if(body.subarray(0,2).toString()!=='MZ')throw Error('O arquivo não é um executável Windows.');
const sha256=createHash('sha256').update(body).digest('hex');
const path='creative-tools/releases/Creative_Tools_Setup_'+version+'.exe';
const feed=JSON.parse(await readFile(new URL('../updates/creative-tools/hub-manifest.json',import.meta.url),'utf8'));
const release=(feed.releases||[]).find(r=>r.version===version);
if(!release||release.sha256!==sha256||release.size!==body.length)throw Error('O instalador não bate com o hub-manifest.json (SHA-256/tamanho).');
await put(path,body,{access:'private',token,addRandomSuffix:false,allowOverwrite:false,contentType:'application/octet-stream'});
console.log('Enviado para o Blob privado: '+path);
console.log('Configure na Vercel (Production):');
console.log('  CT_HUB_ENABLED=true');
console.log('  CT_HUB_VERSION='+version);
console.log('  CT_HUB_PRIVATE_BLOB_PATH='+path);
console.log('  CT_HUB_SHA256='+sha256);
console.log('  CT_HUB_PRIVATE_BLOB_TOKEN=<o mesmo token>   (ou reutilize CT_UPDATE_PRIVATE_BLOB_TOKEN)');
console.log('  CT_HUB_LICENSE_SHA256=<SHA-256 de cada chave, separados por vírgula> (ou reutilize CT_UPDATE_LICENSE_SHA256)');
