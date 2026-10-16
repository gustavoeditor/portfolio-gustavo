'use strict';
const {isAdmin,privateHeaders}=require('../lib/admin-session');
const {HTML}=require('../lib/sentinel-dashboard');
module.exports=function handler(req,res){
 privateHeaders(res);
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
 if(!isAdmin(req)){res.setHeader('Location','/admin');return res.status(302).end();}
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Content-Security-Policy',"default-src 'none'; base-uri 'self'; frame-ancestors 'none'; connect-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'");
 return res.status(200).send(HTML);
};
