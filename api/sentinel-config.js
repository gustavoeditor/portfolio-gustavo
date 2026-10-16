'use strict';
const sentinel=require('../lib/sentinel');
module.exports=function handler(req,res){
 res.setHeader('Cache-Control','public, max-age=60, s-maxage=60');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('X-Robots-Tag','noindex');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
 // Expose only a boolean. Never serialize credentials, hostnames or infrastructure details.
 return res.status(200).json({enabled:sentinel.enabled()});
};
