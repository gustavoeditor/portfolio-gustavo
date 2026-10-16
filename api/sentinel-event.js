'use strict';
const {sameOrigin,parseJsonBody}=require('../lib/admin-session');
const sentinel=require('../lib/sentinel');
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Robots-Tag','noindex');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).end();}
 // Require same-site browser submissions. Do not permit cross-origin CORS.
 if(!sameOrigin(req)||!['same-origin','none'].includes(req.headers['sec-fetch-site']||'same-origin'))
  return res.status(403).end();
 if(!sentinel.enabled())return res.status(503).json({enabled:false});
 let body;
 try{body=parseJsonBody(req,512)}catch(_){return res.status(400).end();}
 const event=sentinel.sanitize(body);
 if(!event)return res.status(400).end();
 try{
  if(!await sentinel.allowRate(req))return res.status(429).end();
  await sentinel.record(event);
  return res.status(204).end();
 }catch(error){
  console.error('Sentinel event write failed:',error?.name||'unknown');
  return res.status(503).end();
 }
};
