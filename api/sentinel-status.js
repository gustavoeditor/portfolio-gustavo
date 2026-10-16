'use strict';
const {isAdmin,privateHeaders}=require('../lib/admin-session');
const sentinel=require('../lib/sentinel');
module.exports=async function handler(req,res){
 privateHeaders(res);
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
 if(!isAdmin(req))return res.status(401).json({error:'Acesso privado.'});
 if(!sentinel.enabled())return res.status(200).json({telemetryEnabled:false,reason:'redis_or_storage_not_configured',daily:[]});
 try{
  const daily=await sentinel.summary(7);
  return res.status(200).json({telemetryEnabled:true,daily});
 }catch(error){
  console.error('Sentinel dashboard failed:',error?.name||'unknown');
  return res.status(503).json({error:'Não foi possível ler os diagnósticos.'});
 }
};
