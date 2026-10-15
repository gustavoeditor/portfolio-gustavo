'use strict';
// Responsive smoke test against the site's actual HTML/CSS in headless Chrome.
// A narrow viewport is the browser-equivalent of zooming in, without disabling pinch zoom.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const mime = {
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'application/javascript; charset=utf-8','.json':'application/json',
  '.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg',
  '.png':'image/png','.mp4':'video/mp4'
};
const server = http.createServer((req,res)=>{
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url,'http://local').pathname); }
  catch (_) {res.writeHead(400).end(); return;}
  const file = path.resolve(root, '.'+ (pathname==='/'?'/index.html':pathname));
  if (!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
  fs.stat(file,(err,stat)=>{
    if(err || !stat.isFile()) {res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
});
const listen = ()=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const close = ()=>new Promise(resolve=>server.close(resolve));
async function run(){
  await listen();
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
  try{
    for(const width of [320,360,390,430,600,768]){
      const context=await browser.newContext({
        viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true
      });
      const page=await context.newPage();
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.waitForTimeout(180);
      const layout=await page.evaluate(()=>{
        const vw=document.documentElement.clientWidth;
        const box=(sel)=>{
          const el=document.querySelector(sel);if(!el)return null;
          const r=el.getBoundingClientRect();
          return {left:r.left,right:r.right,width:r.width};
        };
        return {
          viewport:vw,scrollWidth:document.documentElement.scrollWidth,
          body:box('body'),header:box('.site-header'),hero:box('.hero'),
          portfolio:box('#trabalhos'),card:box('.project-card'),
          main:box('main'),floating:box('.quote-float')
        };
      });
      assert.ok(layout.scrollWidth<=width+2,
        width+'px: horizontal page overflow '+JSON.stringify(layout));
      for(const section of ['header','hero','portfolio']){
        const b=layout[section];
        if(!b)continue;
        assert.ok(b.left>=-2 && b.right<=width+2,
          width+'px: '+section+' outside screen: '+JSON.stringify(b));
        assert.ok(Math.abs(b.left-(width-b.right))<=3,
          width+'px: '+section+' not centered: '+JSON.stringify(b));
      }
      assert.ok(layout.floating.right<=width+2 && layout.floating.left>=-2,
        width+'px: floating quote button outside viewport');
      const ambient=await page.evaluate(()=>{
        const layer=document.querySelector('.ambient-atmosphere');
        const orb=layer?.querySelector('.ambient-orb-one');
        const r=layer?.getBoundingClientRect();
        const hero=document.querySelector('.hero')?.getBoundingClientRect();
        return {
          available:!!layer&&!!orb,
          hiddenFromA11y:layer?.getAttribute('aria-hidden')==='true',
          bounds:r?{left:r.left,right:r.right}:null,
          heroAfter:hero?{left:hero.left,right:hero.right}:null,
          pointerEvents:layer?getComputedStyle(layer).pointerEvents:'',
          animation:orb?getComputedStyle(orb).animationName:''
        };
      });
      assert.ok(ambient.available && ambient.hiddenFromA11y,
        width+'px: decorative atmosphere missing or exposed to accessibility tree');
      assert.equal(ambient.pointerEvents,'none',width+'px: glow blocking clicks');
      assert.ok(ambient.bounds.left>=-2 && ambient.bounds.right<=width+2,
        width+'px: glow viewport overflows: '+JSON.stringify(ambient));
      if(width<=600){
        await page.locator('.quote-float').click();
        await page.waitForTimeout(80);
        const form=await page.evaluate(()=>{
          const dialog=document.getElementById('quick-quote-dialog');
          const heading=dialog.querySelector('.quick-quote-heading').getBoundingClientRect();
          const copy=dialog.querySelector('.quick-quote-heading p').getBoundingClientRect();
          const slot=dialog.querySelector('.quick-quote-form-slot').getBoundingClientRect();
          return {open:dialog.open,headingEnd:heading.bottom,copyEnd:copy.bottom,
            slotTop:slot.top,formWidth:slot.width};
        });
        assert.ok(form.open,width+'px: quote modal did not open');
        assert.ok(form.headingEnd<=form.slotTop+2 && form.copyEnd<=form.slotTop+2,
          width+'px: quote texts overlap fields: '+JSON.stringify(form));
      }
      console.log('Viewport '+width+'px OK, scrollWidth='+layout.scrollWidth);
      await context.close();
    }
    // Verify full-page parallax is present yet respects user motion preferences.
    {
      const context=await browser.newContext({viewport:{width:1280,height:800}});
      const page=await context.newPage();
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.locator('#trabalhos').scrollIntoViewIfNeeded();
      await page.waitForTimeout(120);
      const depth=await page.evaluate(()=>({
        section:document.querySelector('#trabalhos')?.style.getPropertyValue('--ambient-y'),
        layer:!!document.querySelector('.ambient-atmosphere'),
        pointerEvents:getComputedStyle(document.querySelector('.ambient-atmosphere')).pointerEvents
      }));
      assert.ok(depth.section?.endsWith('px'),'Desktop scroll parallax did not update');
      assert.equal(depth.pointerEvents,'none');
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForTimeout(80);
      const accessible=await page.evaluate(()=>({
        static:document.body.classList.contains('ambient-static'),
        section:document.querySelector('#trabalhos')?.style.getPropertyValue('--ambient-y'),
        animation:getComputedStyle(document.querySelector('.ambient-orb-one')).animationName
      }));
      assert.ok(accessible.static && accessible.section==='' && accessible.animation==='none',
        'Reduced motion must disable parallax and idle glow animations: '+JSON.stringify(accessible));
      await context.close();
      console.log('Desktop scroll parallax and reduced motion OK');
    }
        // Real partnership cards are injected only for the test: the committed registry remains empty.
    for(const width of [390,1024]){
      const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,isMobile:width<600,hasTouch:width<600});
      const page=await context.newPage();
      await page.route('**/canais.json',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
        atuais:[{nome:'Canal teste atual',url:'https://www.youtube.com/@teste-atual',descricao:'Trabalho de edição para YouTube'}],
        anteriores:[{nome:'Canal teste anterior',url:'https://www.youtube.com/@teste-anterior'},
          {nome:'Link inseguro',url:'javascript:alert(1)'}]
      })}));
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>!document.getElementById('canais').hidden);
      const result=await page.evaluate(()=>{
        const section=document.getElementById('canais');
        const area=section.getBoundingClientRect();
        return {
          visible:!section.hidden,
          cards:section.querySelectorAll('.channel-card').length,
          current:section.querySelectorAll('#channels-current .channel-card').length,
          past:section.querySelectorAll('#channels-past .channel-card').length,
          left:area.left,right:area.right,
          scrollWidth:document.documentElement.scrollWidth,
          links:[...section.querySelectorAll('.channel-card')].map(a=>({url:a.href,rel:a.rel,target:a.target}))
        };
      });
      assert.equal(result.cards,2,'Should only display real-valid tested links');
      assert.equal(result.current,1);
      assert.equal(result.past,1);
      assert.ok(result.links.every(link=>link.url.startsWith('https://')&&link.rel.includes('noopener')&&link.target==='_blank'));
      assert.ok(result.scrollWidth<=width+2,'Channel cards caused horizontal overflow: '+JSON.stringify(result));
      assert.ok(Math.abs(result.left-(width-result.right))<=3,'Channel section off-center');
      console.log('Channels layout '+width+'px OK');
      await context.close();
    }
  }finally{await browser.close();await close();}
}
run().catch(err=>{console.error(err);server.close();process.exitCode=1;});
