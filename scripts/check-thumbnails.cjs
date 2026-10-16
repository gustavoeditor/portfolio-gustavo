'use strict';
// Verify V4 cover files, gallery rendering and offline artwork in a real browser.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
const projects=JSON.parse(fs.readFileSync(path.join(root,'projetos.json'),'utf8'));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
 '.js':'application/javascript; charset=utf-8','.json':'application/json',
 '.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png',
 '.jpg':'image/jpeg','.mp4':'video/mp4'};
const server=http.createServer((req,res)=>{
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);}
 catch(_){res.writeHead(400).end();return;}
 if(pathname==='/api/managed-projects'){res.writeHead(200,{'Content-Type':'application/json'}).end('{"projects":[]}');return;}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.stat(file,(error,stat)=>{
  if(error||!stat.isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
 });
});
const listen=()=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const close=()=>new Promise(resolve=>server.close(resolve));
async function expandGallery(page){
 await page.waitForFunction(()=>document.querySelectorAll('#portfolio-grid .project-card').length>=6,null,{timeout:8000});
 for(let attempt=0;attempt<5;attempt++){
  const count=await page.locator('#portfolio-grid .project-card').count();
  if(count>=projects.length)return;
  const button=page.locator('#load-more');
  assert.ok(await button.isVisible(),'More projects button missing with '+count+' items');
  await button.click();
  await page.waitForFunction(n=>document.querySelectorAll('#portfolio-grid .project-card').length>n,count,{timeout:3000});
 }
 assert.fail('Gallery did not show all '+projects.length+' originals');
}
async function run(){
 for(const p of projects){
  const file=path.join(root,p.poster);
  assert.ok(p.poster.startsWith('capas/')&&fs.existsSync(file),'Missing local cover '+p.poster);
  const meta=await sharp(file,{failOn:'error'}).metadata();
  assert.equal(meta.format,'webp','Invalid WebP '+p.poster);
  assert.ok(meta.width>=480&&meta.height>=270,'Low resolution '+p.poster);
  await sharp(file).resize(32,18,{fit:'cover'}).raw().toBuffer();
 }
 console.log('Decoded '+projects.length+' original WebP covers.');
 await listen();
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 try{
  const base='http://127.0.0.1:'+server.address().port+'/';
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:820}});
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await expandGallery(page);
   const cards=page.locator('#portfolio-grid .project-card');
   assert.equal(await cards.count(),projects.length);
   for(let i=0;i<projects.length;i++){
    await cards.nth(i).scrollIntoViewIfNeeded();
    await page.waitForFunction(i=>{
     const img=document.querySelectorAll('#portfolio-grid .project-card img[data-cover-id]')[i];
     return img&&(img.classList.contains('cover-ready')||img.classList.contains('cover-failed'));
    },i,{timeout:8000});
   }
   const images=await page.evaluate(()=>[...document.querySelectorAll('#portfolio-grid .project-card')].map(card=>{
    const image=card.querySelector('img[data-cover-id]');
    const fallback=card.querySelector('.offline-art');
    return {slug:image?.dataset.coverId,valid:image?.naturalWidth>0,
     recovered:image?.classList.contains('cover-ready'),
     fallback:Boolean(fallback&&getComputedStyle(fallback).display!=='none'),
     fail:image?.classList.contains('cover-failed')};
   }));
   assert.ok(images.every(x=>x.valid||x.fail&&x.fallback),'A project has neither a decoded cover nor fallback: '+JSON.stringify(images.filter(x=>!x.valid&&!(x.fail&&x.fallback))));
   assert.ok(images.some(x=>x.valid),'No original cover successfully loaded');
   if(width===1280){
    const dir=path.join(root,'out');fs.mkdirSync(dir,{recursive:true});
    await page.screenshot({path:path.join(dir,'thumbs-contact-sheet-local.png'),fullPage:true});
   }
   await page.close();
   console.log('Validated '+images.length+' covers and fallbacks at '+width+'px');
  }
  // All cover origins down: placeholders should keep cards visually complete.
  const page=await browser.newPage({viewport:{width:390,height:820}});
  await page.route(/\/capas\/.*\.webp/,route=>route.fulfill({status:503,contentType:'text/plain',body:'Simulated source outage'}));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const first=page.locator('#portfolio-grid .project-card').first();
  await first.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{
   const card=document.querySelector('#portfolio-grid .project-card');
   return card?.querySelector('img.cover-failed')&&card.querySelector('.offline-art');
  },null,{timeout:12000});
  const fallback=await first.evaluate(card=>{
   const img=card.querySelector('img[data-cover-id]');
   return {imageHidden:getComputedStyle(img).display==='none',placeholder:Boolean(card.querySelector('.offline-art'))};
  });
  assert.ok(fallback.imageHidden&&fallback.placeholder,'Offline placeholder must replace failed cover');
  await page.close();
  console.log('Cover-source outage fallback passed.');
 }finally{await browser.close();await close();}
}
run().catch(error=>{console.error(error?.stack||error);server.close();process.exitCode=1;});
