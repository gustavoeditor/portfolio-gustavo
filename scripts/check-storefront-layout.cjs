'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
const types={'.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/store/checkout'){
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
  return res.end(JSON.stringify({available:false,product:'gustavo-trio',priceLabel:null}));
 }
 const pathname=url.pathname==='/'?'/loja.html':url.pathname;
 const filename=path.resolve(root,'.'+pathname);
 if(!filename.startsWith(root+path.sep))return res.writeHead(403).end();
 fs.stat(filename,(error,stat)=>{
  if(error||!stat.isFile())return res.writeHead(404).end();
  res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream'});
  fs.createReadStream(filename).pipe(res);
 });
});
async function check(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,375,390,430,768,1024,1440]){
   const context=await browser.newContext({viewport:{width,height:900},isMobile:width<=480,hasTouch:width<=480});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await page.goto(base+'/loja.html',{waitUntil:'networkidle',timeout:13000});
   await page.locator('.feature').first().waitFor();
   const x=await page.evaluate(()=>{
    const b=(s)=>{const el=document.querySelector(s);if(!el)return null;const a=el.getBoundingClientRect();return {left:a.left,right:a.right,width:a.width,height:a.height};};
    return {
     scrollWidth:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,
     css:getComputedStyle(document.querySelector('.hero')).display,
     h1:b('#hero-title'),art:b('.art'),purchase:b('.purchase'),order:b('.order'),faq:b('.faq-list'),
     cards:document.querySelectorAll('.feature').length,styles:document.styleSheets.length,
     checkoutDisabled:document.getElementById('checkout').disabled,
     badge:document.getElementById('sale-badge').textContent
    };
   });
   assert.ok(x.styles>=1,'loja.css not loaded '+width+'px');
   assert.equal(x.css,'grid','hero CSS not applied '+width+'px');
   assert.ok(x.scrollWidth<=width+2,'horizontal overflow '+width+'px '+JSON.stringify(x));
   for(const k of ['h1','art','purchase','order','faq']){
    const a=x[k];assert.ok(a&&a.width>0&&a.height>0,'missing '+k+' '+width+'px');
    assert.ok(a.left>=-7&&a.right<=width+7,k+' outside viewport '+width+'px '+JSON.stringify(a));
   }
   assert.equal(x.cards,6);
   assert.ok(x.checkoutDisabled,'purchase must remain disabled');
   assert.match(x.badge,/PRÉ-LANÇAMENTO/);
   assert.deepEqual(errors,[],'JS error '+width+'px');
   await page.locator('.faq summary').first().click();
   assert.equal(await page.locator('.faq details').first().getAttribute('open'),'');
   if(width===390||width===1440){
    const out=path.join(root,'out');fs.mkdirSync(out,{recursive:true});
    await page.locator('.faq summary').first().click();
    await page.screenshot({path:path.join(out,'loja-'+width+'.png'),fullPage:true});
   }
   console.log('Storefront: '+width+'px responsive, 6 features, checkout locked, FAQ OK');
   await context.close();
  }
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
check().catch(error=>{console.error(error?.stack||error);server.close();process.exitCode=1;});
