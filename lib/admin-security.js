const crypto = require('crypto');
const {constantEquals} = require('./admin-session');
const {redisRest} = require('./redis-env');
const attempts = new Map();
const WINDOW = 15 * 60 * 1000;
const LIMIT = 10;

// Redis shares the limit across instances. Memory is only a supplemental limit.
async function allowLogin(req, now = Date.now()) {
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const key = 'portfolio:login:' + crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(ip).digest('hex');
  const redis = redisRest();
  if (redis) {
    const response = await fetch(redis.url, {
      method:'POST', signal:AbortSignal.timeout(4000),
      headers:{Authorization:'Bearer ' + redis.token, 'Content-Type':'application/json'},
      body:JSON.stringify(['EVAL',"local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return {n,redis.call('PTTL',KEYS[1])}",1,key,WINDOW])
    });
    const body = await response.json();
    if (!response.ok || !Array.isArray(body.result)) throw new Error('Login protection unavailable');
    return {allowed:Number(body.result[0]) <= LIMIT, retryAfter:Math.max(1,Math.ceil(Number(body.result[1])/1000))};
  }
  for (const [storedKey,value] of attempts) if (value.until <= now) attempts.delete(storedKey);
  if (!attempts.has(key) && attempts.size >= 2000) return {allowed:false,retryAfter:900};
  const record = attempts.get(key) || {count:0,until:now+WINDOW};
  record.count++;
  attempts.set(key,record);
  return {allowed:record.count <= LIMIT,retryAfter:Math.max(1,Math.ceil((record.until-now)/1000))};
}

function validTotp(code, secret, now = Date.now()) {
  if (!secret) return true;
  if (!/^\d{6}$/.test(String(code || ''))) return false;
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized=String(secret).replace(/[\s=]/g,'').toUpperCase();
  if (!/^[A-Z2-7]{16,128}$/.test(normalized)) return false;
  let bits='';
  for (const char of normalized) bits+=alphabet.indexOf(char).toString(2).padStart(5,'0');
  const bytes=[];
  for(let i=0;i+8<=bits.length;i+=8) bytes.push(parseInt(bits.slice(i,i+8),2));
  const key=Buffer.from(bytes);
  for(const drift of [-1,0,1]) {
    const counter=Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(now/30000)+drift));
    const digest=crypto.createHmac('sha1',key).update(counter).digest();
    const offset=digest[19]&15;
    const expected=String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
    if(constantEquals(code,expected))return true;
  }
  return false;
}
module.exports={allowLogin,validTotp};
