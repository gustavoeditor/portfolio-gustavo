'use strict';
/* Executed by GitHub Actions. No credentials or visitor information are required. */
const fs=require('node:fs');
const BASE='https://portfolio-gustavo-chi.vercel.app';
const targets=[
 {name:'Página inicial',path:'/',marker:'GUSTAVO'},
 {name:'Sitemap',path:'/sitemap.xml',marker:'<urlset'},
 {name:'Robots',path:'/robots.txt',marker:'Sitemap:'},
 {name:'G / PLAYER',path:'/player.js?v=4',marker:'GustavoPlayer'},
 {name:'G / AMBIENCE',path:'/ambience.js?v=2',marker:'GustavoAmbience'},
 {name:'Orçamento',path:'/quote-modal.js?v=1',marker:'quote'}
];
const wait=t=>new Promise(resolve=>setTimeout(resolve,t));
async function inspect({name,path,marker}){
 let reason='';
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(BASE+path,{signal:AbortSignal.timeout(12000),redirect:'error',cache:'no-store',headers:{'User-Agent':'GustavoSentinelHealth/1.0','Cache-Control':'no-cache'}});
   if(response.status!==200){reason='HTTP '+response.status;}
   else {
    const type=String(response.headers.get('content-type')||'');
    if(!/text|javascript|xml|application\/json/.test(type))reason='Unexpected content-type '+type.slice(0,40);
    else{
     const txt=(await response.text()).slice(0,250000);
     if(txt.includes(marker))return {name,path,ok:true};
     reason='Expected marker not found';
    }
   }
  }catch(error){reason=error?.name==='TimeoutError'?'Timeout':'Network error';}
  if(attempt<2)await wait(1200);
 }
 return {name,path,ok:false,reason};
}
async function main(){
 const results=await Promise.all(targets.map(inspect));
 const failures=results.filter(x=>!x.ok),date=new Date().toISOString();
 const report={date,base:BASE,ok:failures.length===0,results};
 fs.writeFileSync('sentinel-results.json',JSON.stringify(report,null,2));
 const lines=['### Gustavo Sentinel / Verificação de produção','','Executado em '+date,'',...results.map(x=>'- '+(x.ok?'✅':'❌')+' '+x.name+' ('+x.path+')'+(x.ok?'':' · '+x.reason)),''];
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join('\n'));
 console.log(lines.join('\n'));
 if(failures.length)process.exitCode=1;
}
main().catch(error=>{console.error('Sentinel health check failed:',error?.message||'Unknown');process.exitCode=1;});
