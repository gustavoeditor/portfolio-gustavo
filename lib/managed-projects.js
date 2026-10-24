const {get, put, head, BlobNotFoundError} = require('@vercel/blob');
const crypto = require('crypto');
const {hasStore} = require('./storage-config');
const Quality = require('../quality-control');
const PATH = 'gustavo-admin/projects-v1.json';
const VALID_CATEGORIES = new Set(['cs2','cinematics','motion','youtube','outros']);
const normalizedEtag = value => String(value || '').replace(/^W\//,'').replace(/^"|"$/g,'');
async function readSnapshot() {
  if (!hasStore()) return {projects:[],etag:null};
  let metadata;
  try {metadata=await head(PATH);} catch (error) {
    if (error instanceof BlobNotFoundError) return {projects:[],etag:null};
    throw error;
  }
  // Cache by catalog revision. Never save a stale CDN response over newer data.
  const stored = await get(metadata.url+'?revision='+encodeURIComponent(metadata.etag), {access:'public'});
  if (!stored?.stream || normalizedEtag(stored.blob.etag)!==normalizedEtag(metadata.etag)) throw new Error('O catálogo mudou. Tente novamente.');
  const json=await new Response(stored.stream).json();
  if (!Array.isArray(json.projects)) throw new Error('Catálogo inválido; publicação cancelada para preservar seus vídeos.');
  return {projects:json.projects.filter(p=>p&&typeof p==='object').slice(0,150),etag:metadata.etag};
}
async function readManaged() {return (await readSnapshot()).projects;}
async function writeManaged(projects, snapshot) {
  if (!hasStore()) throw new Error('Conecte o armazenamento Vercel Blob.');
  if (!snapshot || !Array.isArray(snapshot.projects)) throw new Error('Leia o catálogo antes de atualizar.');
  if (snapshot.etag) {
    await put('gustavo-admin/history/'+Date.now()+'-'+crypto.randomUUID()+'.json', JSON.stringify({version:1,projects:snapshot.projects}), {
      access:'public',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json'
    });
  }
  const payload=JSON.stringify({version:1,projects,updatedAt:new Date().toISOString()});
  return put(PATH,payload,{
    access:'public',addRandomSuffix:false,allowOverwrite:Boolean(snapshot.etag),
    ...(snapshot.etag?{ifMatch:snapshot.etag}:{}),
    contentType:'application/json',cacheControlMaxAge:60
  });
}
function hasMagic(bytes, type) {
  if(type==='video/mp4')return bytes.length>=12 && bytes.subarray(4,8).toString()==='ftyp';
  if(type==='video/webm')return bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  if(type==='image/jpeg')return bytes.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]));
  if(type==='image/png')return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(type==='image/webp')return bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP';
  return false;
}
async function validUploadedUrl(url, kind) {
  if(typeof url!=='string'||url.length>800||!['videos','capas'].includes(kind))return false;
  let u;
  try {u=new URL(url);} catch(_){return false;}
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||!u.hostname.endsWith('.public.blob.vercel-storage.com'))return false;
  const pattern=kind==='videos'?/^\/gustavo\/videos\/[a-z0-9-]+\.(mp4|webm)$/i:/^\/gustavo\/capas\/[a-z0-9-]+\.(webp|jpg|jpeg|png)$/i;
  if(!pattern.test(u.pathname))return false;
  try {
    // Lookup by pathname in OUR configured store, never trust an external store URL.
    const metadata=await head(u.pathname.slice(1));
    const allowed=kind==='videos'?['video/mp4','video/webm']:['image/webp','image/jpeg','image/png'];
    if(metadata.url!==url||metadata.size<=0||metadata.size>(kind==='videos'?250:8)*1024*1024||!allowed.includes(metadata.contentType))return false;
    const response=await fetch(url,{redirect:'error',headers:{Range:'bytes=0-511'},signal:AbortSignal.timeout(10000)});
    if(!response.ok||!response.body)return false;
    const reader=response.body.getReader();
    let bytes=Buffer.alloc(0);
    try {
      while(bytes.length<12){const chunk=await reader.read();if(chunk.done)break;bytes=Buffer.concat([bytes,Buffer.from(chunk.value).subarray(0,512)]);}
    } finally {await reader.cancel();}
    return hasMagic(bytes,metadata.contentType);
  } catch(_){return false;}
}
function cleanProject(input) {
  const title=String(input.title||'').trim().slice(0,90);
  const description=String(input.description||'').trim().slice(0,220);
  const category=String(input.category||'').toLowerCase();
  const src=String(input.src||'');
  const poster=String(input.poster||'');
  const place=Number(input.position);
  if(!title||!VALID_CATEGORIES.has(category)||!Number.isInteger(place)||place<0||place>150)throw new Error('Revise título, categoria e posição.');
  // The QC breakdown is recomputed here; the overall score is never trusted from the browser.
  const quality=Quality.clean(input.quality);
  const legacy=Number.isInteger(input.qualityScore)&&input.qualityScore>=0&&input.qualityScore<=100?input.qualityScore:null;
  const qualityScore=quality?quality.overall:legacy;
  const rankingMode=input.rankingMode==='manual'?'manual':qualityScore===null?'unrated':'auto';
  return {title,category,src,poster,description,position:place,qualityScore,quality,rankingMode};
}
module.exports={hasStore,readManaged,readSnapshot,writeManaged,validUploadedUrl,cleanProject,hasMagic};
