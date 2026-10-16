'use strict';
const crypto=require('node:crypto');
const {get,put,head,BlobNotFoundError}=require('@vercel/blob');
const {storageMode}=require('./storage-config');
const ALLOWED=new Set(['cover_failure','cover_recovered','video_error','video_stall','runtime_error','asset_error','catalog_error']);
const COMPONENTS=new Set(['hero','feature','gallery','player','page','catalog','navigation','contact']);
const daily=()=>new Date().toISOString().slice(0,10);
const keyFor=date=>'gustavo-sentinel/daily/'+date+'.json';
const hasRateLimit=()=>Boolean(process.env.UPSTASH_REDIS_REST_URL&&process.env.UPSTASH_REDIS_REST_TOKEN);
const enabled=()=>Boolean(storageMode()&&hasRateLimit());
function sanitize(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const type=String(input.type||''),component=String(input.component||'');
 if(!ALLOWED.has(type)||!COMPONENTS.has(component))return null;
 return {type,component}; // No URLs, descriptions, names, cookies or free text.
}
async function allowRate(req){
 if(!hasRateLimit())return false;
 const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
 const hash=crypto.createHmac('sha256',process.env.ADMIN_SESSION_SECRET||process.env.UPSTASH_REDIS_REST_TOKEN).update(ip).digest('hex').slice(0,32);
 const globalKey='gustavo:sentinel:global:'+daily(),visitorKey='gustavo:sentinel:client:'+hash+':'+Math.floor(Date.now()/3600000);
 const lua="local g=redis.call('INCR',KEYS[1]);if g==1 then redis.call('EXPIRE',KEYS[1],86400) end;local c=redis.call('INCR',KEYS[2]);if c==1 then redis.call('EXPIRE',KEYS[2],3600) end;return {g,c}";
 const result=await fetch(process.env.UPSTASH_REDIS_REST_URL,{
  method:'POST',headers:{Authorization:'Bearer '+process.env.UPSTASH_REDIS_REST_TOKEN,'Content-Type':'application/json'},
  signal:AbortSignal.timeout(3500),body:JSON.stringify(['EVAL',lua,2,globalKey,visitorKey])
 });
 if(!result.ok)throw Error('Telemetry limiter unavailable');
 const body=await result.json();
 if(!Array.isArray(body.result))throw Error('Telemetry limiter invalid');
 return Number(body.result[0])<=400&&Number(body.result[1])<=6;
}
async function readDay(date){
 try{
  const meta=await head(keyFor(date));
  const response=await get(meta.url+'?rev='+encodeURIComponent(meta.etag),{access:'public'});
  if(!response?.stream)throw Error('Telemetry read unavailable');
  const data=await new Response(response.stream).json();
  if(data?.version!==1||data.date!==date||typeof data.stats!=='object')throw Error('Invalid telemetry snapshot');
  return {data,etag:meta.etag};
 }catch(error){
  if(error instanceof BlobNotFoundError||error?.name==='BlobNotFoundError')return {data:{version:1,date,total:0,updatedAt:null,stats:{}},etag:null};
  throw error;
 }
}
async function record(event){
 const date=daily(),item=event.type+':'+event.component;
 for(let attempt=0;attempt<3;attempt++){
  const {data,etag}=await readDay(date);
  const count=Number(data.stats[item]||0);
  if(data.total>=400)return false;
  data.total++;data.stats[item]=Math.min(400,count+1);data.updatedAt=new Date().toISOString();
  try{
   await put(keyFor(date),JSON.stringify(data),{
    access:'public',addRandomSuffix:false,allowOverwrite:Boolean(etag),
    ...(etag?{ifMatch:etag}:{}),contentType:'application/json',cacheControlMaxAge:60
   });
   return true;
  }catch(error){
   if(attempt===2)throw error;
  }
 }
 return false;
}
async function summary(days=7){
 const all=[];
 for(let i=0;i<Math.min(7,Math.max(1,days));i++){
  const date=new Date(Date.now()-i*86400000).toISOString().slice(0,10);
  try{all.push((await readDay(date)).data)}catch(error){all.push({version:1,date,total:0,stats:{},error:'Temporarily unavailable'});}
 }
 return all;
}
module.exports={enabled,hasRateLimit,sanitize,allowRate,record,summary};
