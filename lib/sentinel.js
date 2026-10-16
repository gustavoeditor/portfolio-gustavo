'use strict';
const crypto=require('node:crypto');

// SENTINEL V1.2: one atomic Redis script per event. The dashboard queries
// anonymous daily counters; no IPs, session IDs, form fields or URLs are stored.
const ALLOWED=new Set(['cover_failure','cover_recovered','video_error','video_stall','runtime_error','asset_error','catalog_error','visit','interaction','click']);
const COMPONENTS=new Set(['hero','feature','gallery','player','page','catalog','navigation','contact','pack','quote','video','work','sound']);
const MAX_PER_CLIENT_HOUR=18;
const MAX_TOTAL_PER_DAY=1500;
const RETENTION_SECONDS=9*86400;
const daily=(ms=Date.now())=>new Date(ms).toISOString().slice(0,10);
const configured=()=>Boolean(process.env.UPSTASH_REDIS_REST_URL&&process.env.UPSTASH_REDIS_REST_TOKEN);
const enabled=()=>configured();
function sanitize(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const type=String(input.type||''),component=String(input.component||'');
 if(!ALLOWED.has(type)||!COMPONENTS.has(component))return null;
 return {type,component};
}
async function command(args){
 if(!configured())throw Error('SENTINEL_REDIS_NOT_CONFIGURED');
 const url=new URL(process.env.UPSTASH_REDIS_REST_URL);
 if(url.protocol!=='https:')throw Error('SENTINEL_REDIS_INVALID_URL');
 const response=await fetch(url.toString(),{
  method:'POST',
  headers:{Authorization:'Bearer '+process.env.UPSTASH_REDIS_REST_TOKEN,'Content-Type':'application/json'},
  signal:AbortSignal.timeout(5000),
  body:JSON.stringify(args)
 });
 if(!response.ok)throw Error('SENTINEL_REDIS_UNAVAILABLE');
 const data=await response.json();
 if(data?.error || !Object.hasOwn(data||{},'result'))throw Error('SENTINEL_REDIS_COMMAND_FAILED');
 return data.result;
}
// Lua executes within a Redis atomic transaction: quota checks and metric increments
// cannot race with simultaneous visitors. Counters expire automatically after 9 days.
const INCREMENT_SCRIPT=[
 "local hourly=tonumber(redis.call('GET',KEYS[1]) or '0')",
 "local total=tonumber(redis.call('GET',KEYS[2]) or '0')",
 "if hourly>=tonumber(ARGV[2]) or total>=tonumber(ARGV[3]) then return 0 end",
 "local h=redis.call('INCR',KEYS[1])",
 "if h==1 then redis.call('EXPIRE',KEYS[1],3600) end",
 "local d=redis.call('INCR',KEYS[2])",
 "if d==1 then redis.call('EXPIRE',KEYS[2],tonumber(ARGV[4])) end",
 "redis.call('HINCRBY',KEYS[3],ARGV[1],1)",
 "if d==1 then redis.call('EXPIRE',KEYS[3],tonumber(ARGV[4])) end",
 "return 1"
].join('\n');
function getClientHash(req){
 const header=req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown';
 const ip=String(header).split(',')[0].trim().slice(0,128);
 const secret=process.env.ADMIN_SESSION_SECRET||process.env.UPSTASH_REDIS_REST_TOKEN;
 return crypto.createHmac('sha256',secret).update(ip).digest('hex').slice(0,32);
}
async function record(req,event){
 const sanitized=sanitize(event);
 if(!sanitized)throw Error('SENTINEL_BAD_EVENT');
 const now=Date.now(),date=daily(now),hour=Math.floor(now/3600000);
 const shortHash=getClientHash(req);
 const hourKey='gustavo:sentinel:visitor:'+shortHash+':'+hour;
 const dayTotal='gustavo:sentinel:total:'+date;
 const dayStats='gustavo:sentinel:stats:'+date;
 const result=await command([
  'EVAL',INCREMENT_SCRIPT,3,hourKey,dayTotal,dayStats,
  sanitized.type+':'+sanitized.component,MAX_PER_CLIENT_HOUR,MAX_TOTAL_PER_DAY,RETENTION_SECONDS
 ]);
 if(Number(result)!==0&&Number(result)!==1)throw Error('SENTINEL_REDIS_INVALID_RESULT');
 return Number(result)===1;
}
function normalizeStats(input){
 if(input==null)return {};
 const obj=Array.isArray(input)
   ?Object.fromEntries(input.length&&Array.isArray(input[0])?input:input.reduce((arr,x,i,a)=>i%2===0?[...arr,[x,a[i+1]]]:arr,[]))
   :typeof input==='object'?input:{};
 const stats=Object.create(null);
 for(const [key,value] of Object.entries(obj)){
  const [type,component,extra]=String(key).split(':');
  if(extra||!ALLOWED.has(type)||!COMPONENTS.has(component))continue;
  const n=Number(value);
  if(Number.isSafeInteger(n)&&n>=0&&n<=MAX_TOTAL_PER_DAY)stats[key]=n;
 }
 return stats;
}
async function summary(days=7){
 const length=Math.max(1,Math.min(7,Math.trunc(Number(days)||7)));
 const now=Date.now();
 return Promise.all(Array.from({length},async(_,i)=>{
  const date=daily(now-i*86400000);
  const result=await command(['HGETALL','gustavo:sentinel:stats:'+date]);
  const stats=normalizeStats(result);
  return {version:2,date,total:Object.values(stats).reduce((sum,n)=>sum+n,0),stats};
 }));
}
module.exports={enabled,hasRateLimit:configured,sanitize,record,summary,normalizeStats};
