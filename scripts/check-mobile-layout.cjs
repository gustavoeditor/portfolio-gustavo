'use strict';
// Real browser smoke test for the current Experience Lab / GUSTAVO portfolio.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
 '.js':'application/javascript; charset=utf-8','.json':'application/json',
 '.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg',
 '.jpeg':'image/jpeg','.png':'image/png','.mp4':'video/mp4','.webm':'video/webm'};
const server=http.createServer((req,res)=>{
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);}
 catch(_){res.writeHead(400).end();return;}
 const f=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.stat(f,(error,stat)=>{
  if(error||!stat.isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
 });
});
const listen=()=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const close=()=>new Promise(resolve=>server.close(resolve));
async function run(){
 await listen();
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,360,390,430,600,768,1024,1440]){
   const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1,
    isMobile:width<=768,hasTouch:width<=768});
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',e=>errors.push(String(e).slice(0,250)));
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.locator('#hero-title').waitFor({timeout:6000});
   await page.locator('#portfolio-grid .project-card').first().waitFor({timeout:6000});
   await page.waitForTimeout(180);
   const bounds=await page.evaluate(()=>{
    const measure=selector=>{
     const element=document.querySelector(selector);
     if(!element)return null;
     const b=element.getBoundingClientRect();
     return {left:b.left,right:b.right,width:b.width,top:b.top,bottom:b.bottom};
    };
    return {
     scroll:document.documentElement.scrollWidth,
     width:document.documentElement.clientWidth,
     hero:measure('#hero-title'),nav:measure('.nav-shell'),
     portfolio:measure('#trabalhos .container'),quote:measure('#quote-floating-trigger'),
     player:!!document.querySelector('#video-modal'),
     ambience:!!document.querySelector('#ambience-dock'),
     projects:document.querySelectorAll('#portfolio-grid .project-card').length,
     privacy:!!document.querySelector('a[href="/privacidade.html"]')
    };
   });
   assert.ok(bounds.scroll<=width+3,width+'px horizontal overflow '+JSON.stringify(bounds));
   assert.ok(bounds.projects>=3,width+'px missing project cards');
   assert.ok(bounds.player&&bounds.ambience&&bounds.privacy,width+'px essential widget missing');
   for(const name of ['nav','hero','portfolio','quote']){
    const b=bounds[name];
    assert.ok(b&&b.width>0,width+'px missing '+name);
    assert.ok(b.left>=-4&&b.right<=width+4,width+'px '+name+' outside viewport '+JSON.stringify(b));
   }
   assert.equal(errors.length,0,width+'px page errors: '+errors.join('; '));
   if(width===390||width===1440){
    await page.locator('#quote-floating-trigger').click();
    await page.waitForFunction(()=>document.querySelector('#quick-quote-dialog')?.open===true,{timeout:3000});
    const ready=await page.evaluate(()=>({
     open:document.querySelector('#quick-quote-dialog').open,
     form:!!document.querySelector('#quote-form'),
     viewport:document.documentElement.scrollWidth
    }));
    assert.ok(ready.open&&ready.form,width+'px quote form not accessible');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.querySelector('#quick-quote-dialog')?.open===false,{timeout:3000});
    const open=page.locator('button.thumb[data-open]').first();
    await open.click();
    const modal=page.locator('#video-modal');
    await page.waitForFunction(()=>document.querySelector('#video-modal')?.getAttribute('aria-hidden')==='false',{timeout:3500});
    assert.ok(await modal.locator('.vip-player').count(),width+'px G / PLAYER missing');
    await page.locator('#modal-close').click();
    await page.waitForFunction(()=>document.querySelector('#video-modal')?.getAttribute('aria-hidden')==='true',{timeout:3000});
   }
   await context.close();
   console.log('GUSTAVO V4 browser smoke '+width+'px OK');
  }
 }finally{await browser.close();await close();}
}
run().catch(error=>{console.error(error?.stack||error);server.close();process.exitCode=1;});
