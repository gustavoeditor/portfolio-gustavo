'use strict';
// Upstash connected through the Vercel Marketplace exposes KV_REST_API_*; a manual
// setup uses UPSTASH_REDIS_REST_*. Either pair enables the shared Redis features.
function redisRest(){
 const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL;
 const token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
 return url&&token?{url,token}:null;
}
module.exports={redisRest};
