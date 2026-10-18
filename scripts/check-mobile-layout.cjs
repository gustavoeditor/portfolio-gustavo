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
    const firstTitle=await page.locator('#modal-title').textContent();
    await page.locator('#modal-next').click();
    await page.waitForTimeout(120);
    const secondTitle=await page.locator('#modal-title').textContent();
    assert.notEqual(secondTitle,firstTitle,'Next button did not advance to another video');
    assert.equal(await modal.locator('.vip-player').count(),1,'Next button damaged custom video player');
    await page.locator('#modal-prev').click();
    await page.waitForTimeout(120);
    assert.equal(await page.locator('#modal-title').textContent(),firstTitle,'Previous button did not return to original video');
    assert.equal(await modal.locator('.vip-player').count(),1,'Previous button damaged custom video player');
    await page.locator('#modal-close').click();
    await page.waitForFunction(()=>document.querySelector('#video-modal')?.getAttribute('aria-hidden')==='true',{timeout:3000});
   }
   await context.close();
   console.log('GUSTAVO V4 browser smoke '+width+'px OK');
  }

  // SENTINEL graphs: test live metric aggregation and disabled-data states
  // in a real Chrome renderer without opening the private production panel.
  const dashboardHTML=require('../lib/sentinel-dashboard').HTML;
  assert.match(dashboardHTML,/class="panel-back" href="\/gerenciar-projetos\.html"/,'Sentinel is missing the return-to-video-dashboard button');
  assert.match(dashboardHTML,/Voltar ao painel de vídeos/);
  const fixtures=[
   {date:'2026-10-10',total:12,stats:{'visit:page':3,'click:pack':2,'click:quote':1,'interaction:player':1,'video_error:player':1}},
   {date:'2026-10-11',total:16,stats:{'visit:page':5,'click:video':4,'interaction:player':2,'video_stall:player':1}}
  ];
  const daily=[...fixtures,...Array.from({length:5},(_,i)=>({date:'2026-10-'+String(i+12).padStart(2,'0'),total:0,stats:{}}))];
  for(const mode of ['enabled','disabled','failed']){
   const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await page.route('**/api/sentinel-status',route=>{
    if(mode==='failed')return route.fulfill({status:503,contentType:'application/json',body:'{"error":"service unavailable"}'});
    return route.fulfill({status:200,contentType:'application/json',
     body:JSON.stringify(mode==='enabled'?{telemetryEnabled:true,daily}:{telemetryEnabled:false,daily:[]})});
   });
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.setContent(dashboardHTML,{waitUntil:'domcontentloaded'});
   if(mode==='enabled'){
    await page.waitForFunction(()=>document.querySelector('#metric-visits')?.textContent==='8',{timeout:3500});
    assert.equal(await page.locator('#metric-clicks').textContent(),'7');
    assert.equal(await page.locator('#metric-interactions').textContent(),'3');
    assert.equal(await page.locator('#count').textContent(),'28');
    assert.equal(await page.locator('#visits-chart .trend-day').count(),7);
    assert.equal(await page.locator('#clicks-chart .click-line').count(),6);
    const errorLabels=await page.locator('#events').textContent();
    assert.match(errorLabels,/video_error:player/);
    assert.doesNotMatch(errorLabels,/visit:page|click:pack|interaction:player/);
   }else if(mode==='disabled'){
    await page.waitForFunction(()=>document.querySelector('#count')?.textContent==='OFF',{timeout:3500});
    assert.equal(await page.locator('#metric-visits').textContent(),'—');
    assert.match(await page.locator('#visits-chart').textContent(),/Sem histórico de visitas/);
    assert.match(await page.locator('#clicks-chart').textContent(),/Sem histórico de cliques/);
   }else{
    await page.waitForFunction(()=>document.querySelector('#telemetry')?.textContent.includes('Não foi possível obter o diagnóstico'),{timeout:3500});
   }
   assert.equal(errors.length,0,'SENTINEL '+mode+' JS errors: '+errors.join('; '));
   const view=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
   assert.ok(view.scroll<=view.width+3,'SENTINEL mobile horizontal overflow '+JSON.stringify(view));
   await context.close();
   console.log('SENTINEL dashboard '+mode+' mobile render OK');
  }

  // Private admin header: verify the exact HTML served by the protected endpoint.
  // Strip scripts so the static UI test never attempts login, upload or network writes.
  const adminSource=fs.readFileSync(path.join(root,'api/admin-panel.js'),'utf8');
  const encodedAdmin=/^const PANEL_HTML = (".*");$/m.exec(adminSource);
  assert.ok(encodedAdmin,'Admin panel template not found');
  const adminHTML=JSON.parse(encodedAdmin[1]).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
  assert.match(adminHTML,/href="\/sentinel"/);
  assert.match(adminHTML,/id="logout-button"/);
  for(const width of [320,360,390,430,600,768,1024,1440]){
   const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1,isMobile:width<=768,hasTouch:width<=768});
   const page=await context.newPage();
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.setContent(adminHTML,{waitUntil:'load'});
   const positions=await page.evaluate(()=>{
    function rect(selector){
     const el=document.querySelector(selector),r=el?.getBoundingClientRect();
     return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null;
    }
    return {
     viewport:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
     header:rect('.admin-header'),brand:rect('.admin-brand'),sentinel:rect('.admin-nav-sentinel'),
     logout:rect('#logout-button'),back:rect('.admin-nav-return'),
     labels:[...document.querySelectorAll('.admin-header a,.admin-header button')].map(e=>({
      text:e.textContent.trim(),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height
     }))
    };
   });
   assert.ok(positions.scroll<=width+3,'Admin horizontal overflow '+width+'px '+JSON.stringify(positions));
   for(const key of ['brand','sentinel','logout','back']){
    const r=positions[key];
    assert.ok(r&&r.width>55&&r.height>30,'Missing or tiny admin control '+key+' at '+width+'px');
    assert.ok(r.left>=-3&&r.right<=width+3,'Admin control out of viewport '+key+' '+width+'px '+JSON.stringify(r));
   }
   const overlap=(a,b)=>a.left<b.right-2&&a.right>b.left+2&&a.top<b.bottom-2&&a.bottom>b.top+2;
   const {brand,sentinel,logout,back}=positions;
   for(const [key,a,b] of [['brand/sentinel',brand,sentinel],['brand/logout',brand,logout],['brand/back',brand,back],['sentinel/logout',sentinel,logout],['sentinel/back',sentinel,back],['logout/back',logout,back]])
    assert.ok(!overlap(a,b),'Overlapping admin controls '+key+' at '+width+'px');
   if(width<=768){
    assert.ok(sentinel.top>=brand.bottom+8,'Sentinel needs separate mobile row '+width+'px');
    assert.ok(logout.top>=sentinel.bottom+6,'Mobile action buttons need separate row '+width+'px');
    assert.ok(Math.abs(logout.top-back.top)<5,'Mobile actions should share a row '+width+'px');
   }
   assert.ok(positions.labels.every(x=>x.width>=75&&x.height>=30),'Illegible admin action '+width+'px');
   await context.close();
   console.log('Protected admin header: clean layout at '+width+'px');
  }

  // Launch: fresh homepage visits and reloads must start at the presentation.
  // Explicit #contato deep links remain usable for conversion campaigns.
  for(const width of [390,1440]){
   const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width===390,hasTouch:width===390});
   const page=await ctx.newPage();
   await page.goto(base+'?utm_source=launch',{waitUntil:'domcontentloaded'});
   await page.locator('#contato').waitFor({timeout:6000});
   // Let the homepage pageshow/DOMContentLoaded scroll-restoration callbacks finish
   // before intentionally testing scroll/reload, avoiding a race on desktop Chrome.
   await page.waitForLoadState('load');
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.evaluate(()=>{
    document.documentElement.style.scrollBehavior='auto';
    scrollTo(0,document.querySelector('#contato').offsetTop);
   });
   await page.waitForFunction(()=>scrollY>500,null,{timeout:3000});
   await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForTimeout(300);
   assert.ok(await page.evaluate(()=>scrollY)<8,'Fresh homepage reload must be at top '+width+'px');
   assert.equal(await page.evaluate(()=>history.scrollRestoration),'manual');
   await page.goto(base+'#contato',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>scrollY>500,null,{timeout:5000});
   assert.equal(await page.evaluate(()=>location.hash),'#contato');
   await ctx.close();
   console.log('Launch homepage entry and #contato deep links OK at '+width+'px');
  }
  // Real Chrome test: the uploaded Keydrop project starts at 360p on mobile,
  // and the user can explicitly choose 480p or Original.
  {
   const manifest=JSON.parse(fs.readFileSync(path.join(root,'video-renditions/abertura-keydrop-treino.json'),'utf8'));
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   const page=await context.newPage();
   await page.route('**/api/managed-projects',route=>route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({projects:[{title:'Abertura Keydrop Treino',src:manifest.source,
      poster:new URL('/gustavo/capas/preview.webp',manifest.source).href,category:'cs2',position:0}]})}));
   await page.goto(base,{waitUntil:'domcontentloaded'});
   await page.locator('#featured-keydrop-treino:not([hidden])').waitFor({timeout:10000});
   await page.locator('#featured-keydrop-treino').click();
   await page.locator('.vip-quality').waitFor({timeout:5000});
   const src=await page.locator('#modal-player').getAttribute('src');
   assert.equal(src,'/videos-360/abertura-keydrop-treino.mp4','Mobile Auto should initially load 360p');
   await page.locator('.vip-quality').click();
   for(const quality of ['mobile','low','high'])assert.equal(
    await page.locator('.vip-quality-option[data-quality="'+quality+'"]').count(),1,
    'Missing player quality '+quality);
   await page.locator('.vip-quality-option[data-quality="low"]').click();
   await page.waitForFunction(()=>document.getElementById('modal-player').getAttribute('src')==='/videos-480/abertura-keydrop-treino.mp4',null,{timeout:6000});
   await context.close();
   console.log('Abertura Keydrop Treino: Auto 360p, 480p and Original available in mobile Chrome.');
  }

  // Sales-page browser demo must reproduce the four v1.4.16 panel tabs safely.
  // This is a web simulation only; checkout remains disabled without release flags.
  for(const width of [320,390,768,1440]){
   const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<=390,hasTouch:width<=390});
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(String(e).slice(0,240)));
   await page.goto(base+'/loja.html',{waitUntil:'domcontentloaded'});
   await page.locator('#ct-demo .ct-app').waitFor({timeout:9000});
   assert.equal(await page.locator('.ct-footer').innerText().then(s=>s.includes('v1.4.16')),true);
   await page.locator('#ct-demo [data-curve="100,100"]').click();
   assert.match(await page.locator('#ct-values').innerText(),/ENTRADA 100%.*SAÍDA 100%/);
   assert.ok(await page.locator('#ct-graph').evaluate(x=>x.getBoundingClientRect().width)>80);
   await page.locator('#ct-demo [data-tab="bounce"]').click();
   await page.locator('#ct-demo [data-mode="elastic"]').click();
   assert.ok(await page.locator('#ct-bouncepath').getAttribute('d'));
   await page.locator('#ct-bounceapply').click();
   await page.locator('#ct-demo [data-tab="text"]').click();
   await page.locator('#ct-demo [data-split="chars"]').click();
   await page.locator('#ct-splitapply').click();
   assert.equal(await page.locator('#ct-text-words > span').count(),6);
   await page.locator('#ct-demo [data-tab="presets"]').click();
   assert.equal(await page.locator('#ct-presetlist .ct-preset-item').count(),3);
   await page.locator('#ct-search').fill('Impact');
   assert.equal(await page.locator('#ct-presetlist .ct-preset-item').count(),1);
   await page.locator('#ct-search').fill('');
   await page.locator('#ct-next').click();
   assert.match(await page.locator('#ct-presetname').innerText(),/Impact Motion/);
   assert.equal(await page.locator('#checkout').isDisabled(),true);
   assert.deepEqual(errors,[],'Creative Tools demo page errors '+width+'px');
   await ctx.close();
   console.log('Creative Tools v1.4.16 interactive store demo '+width+'px OK');
  }

  // Pack interest should navigate to a prefilled quote without sending data.
  {
   const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   const page=await ctx.newPage();
   await page.goto(base+'/loja.html',{waitUntil:'domcontentloaded'});
   await page.locator('#pack-interesse .pack-launch-link').click();
   await page.locator('#quick-quote-dialog[open]').waitFor({timeout:10000});
   assert.equal(await page.locator('#quote-service').inputValue(),'pack');
   assert.match(await page.locator('#quote-details').inputValue(),/Pack de edição/);
   await page.keyboard.press('Escape');
   await page.locator('#quick-quote-dialog').waitFor({state:'hidden',timeout:5000});
   await ctx.close();
   console.log('Pack interest: store link to prefilled WhatsApp briefing OK.');
  }

  // Customer portal: prelaunch must fail closed when Supabase/Stripe secrets
  // are absent. On mobile, all account UI remains within the viewport.
  for(const width of [320,390,768,1440]){
   const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width<=390,hasTouch:width<=390});
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(String(e).slice(0,220)));
   await page.route('**/api/customer/settings',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    enabled:false,auth:null,testCheckoutEnabled:false,testMode:false,
    product:{priceLabel:'R$ 79,00'}
   })}));
   await page.goto(base+'/conta.html',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('#availability').textContent.includes('está sendo preparado'),null,{timeout:7000});
   assert.equal(await page.locator('#guest').isHidden(),true);
   assert.equal(await page.locator('#member').isHidden(),true);
   assert.equal(await page.locator('#test-buy').isDisabled(),true);
   assert.equal(await page.locator('#account-price').innerText(),'R$ 79,00');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3),true,'Account page horizontal overflow '+width);
   assert.deepEqual(errors,[],'Account portal errors '+width+'px');
   await ctx.close();
   console.log('Customer account prelaunch safety '+width+'px OK');
  }
  // The account library is driven only by a Supabase-authenticated identity.
  // Mock services here; never create a real user or use live Stripe.
  {
   const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   const page=await ctx.newPage();
   await page.addInitScript(()=>sessionStorage.setItem('creative-tools-customer-session',JSON.stringify({
    access_token:'a'.repeat(70),refresh_token:'b'.repeat(70),expires_at:Math.floor(Date.now()/1000)+3600
   })));
   await page.route('**/api/customer/settings',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    enabled:true,auth:{url:'https://demo-auth.supabase.co',anonKey:'public-key-for-browser-tests'},
    testCheckoutEnabled:false,product:{priceLabel:'R$ 79,00'}
   })}));
   await page.route('https://demo-auth.supabase.co/auth/v1/user',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    id:'123e4567-e89b-42d3-a456-426614174000',email:'comprador@exemplo.test',
    email_confirmed_at:'2026-10-17T19:00:00Z',user_metadata:{full_name:'Cliente Teste'}
   })}));
   await page.route('**/api/customer/library',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({products:[]})}));
   await page.goto(base+'/conta.html',{waitUntil:'domcontentloaded'});
   await page.locator('#member:not([hidden])').waitFor({timeout:8000});
   assert.equal(await page.locator('#member-email').innerText(),'comprador@exemplo.test');
   assert.equal(await page.locator('#test-buy').isDisabled(),true,'Payment still disabled until complete release is configured');
   assert.ok((await page.locator('#library').innerText()).includes('Nenhuma compra'));
   await ctx.close();
   console.log('Customer account mock sign-in and library display OK');
  }
 }finally{await browser.close();await close();}
}
run().catch(error=>{console.error(error?.stack||error);server.close();process.exitCode=1;});
