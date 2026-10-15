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
      const heroCopy=await page.evaluate(()=>{
        const title=document.getElementById('hero-title');
        const subtitle=document.querySelector('.hero .intro');
        const signature=document.querySelector('.hero-copy .eyebrow');
        const a=title.getBoundingClientRect(), b=subtitle.getBoundingClientRect(), c=signature.getBoundingClientRect();
        return {
          title: title.textContent.trim(),
          signature: signature.textContent.trim(),
          headline:{left:a.left,right:a.right,bottom:a.bottom,top:a.top},
          description:{left:b.left,right:b.right,top:b.top,bottom:b.bottom},
          eyebrow:{left:c.left,right:c.right,top:c.top,bottom:c.bottom}
        };
      });
      assert.ok(heroCopy.signature.includes('GUSTAVO')&&heroCopy.signature.includes('EDITOR DE VÍDEO'),
        width+'px: Gustavo brand identification must be visible');
      assert.ok(heroCopy.headline.top>=heroCopy.eyebrow.bottom-2 &&
        heroCopy.description.top>=heroCopy.headline.bottom-2,
        width+'px: hero headline or description overlap: '+JSON.stringify(heroCopy));
      assert.ok(heroCopy.headline.left>=-2 && heroCopy.headline.right<=width+2,
        width+'px: hero headline outside screen');
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
    // Dynamically generated video cards must enter on scroll, but hover transforms must stay smooth.
    {
      const context=await browser.newContext({viewport:{width:1280,height:800}});
      const page=await context.newPage();
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(() => document.querySelectorAll('#project-grid > .project-card.reveal-entry').length >= 17);
      const before=await page.evaluate(()=>{
        const cards=[...document.querySelectorAll('#project-grid > .project-card')];
        const distant=cards[12];
        return {
          cards:cards.length,
          animated:cards.every(el=>el.classList.contains('reveal-entry')),
          initiallyHidden:!distant.classList.contains('is-visible'),
          opacity:getComputedStyle(distant).opacity,
          translates:getComputedStyle(distant).translate,
          hero:document.querySelector('.hero h1')?.classList.contains('reveal-entry'),
          caseStudy:document.querySelector('.case-card')?.classList.contains('reveal-entry'),
          faq:document.querySelector('.faq-list details')?.classList.contains('reveal-entry'),
          footer:document.querySelector('.site-footer nav')?.classList.contains('reveal-entry')
        };
      });
      assert.ok(before.cards>=17 && before.animated,'All video cards should have reveal entrances');
      assert.ok(before.initiallyHidden,'Off-screen videos should wait for their entrance');
      assert.ok(before.hero&&before.caseStudy&&before.faq&&before.footer,'Entrance coverage missing in other sections');
      const card=page.locator('#project-grid > .project-card').nth(12);
      await card.scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>{
        const el=document.querySelectorAll('#project-grid > .project-card')[12];
        return el.classList.contains('is-visible') && Number(getComputedStyle(el).opacity)>.98;
      },null,{timeout:4000});
      await card.hover();
      await page.waitForTimeout(600);
      const after=await page.evaluate(()=>{
        const el=document.querySelectorAll('#project-grid > .project-card')[12];
        const css=getComputedStyle(el);
        return {
          opacity:Number(css.opacity),
          translate:css.translate,
          transform:css.transform,
          transition:css.transitionProperty,
          width:document.documentElement.scrollWidth
        };
      });
      assert.ok(after.transform && after.transform !== 'none','Hover scale was overridden by reveal animation');
      assert.ok(after.transition.includes('transform'),'Hover transition was removed');
      assert.ok(after.width<=1282,'Entrance introduced horizontal scrolling');

      await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForTimeout(90);
      const accessible=await page.evaluate(()=>{
        const el=[...document.querySelectorAll('#project-grid > .project-card')].find(card=>!card.classList.contains('is-visible'));
        if(!el)return null;
        const css=getComputedStyle(el);
        return {opacity:css.opacity,transition:css.transitionDuration};
      });
      if(accessible) assert.ok(accessible.opacity==='1'&&accessible.transition.split(',').every(v=>parseFloat(v)===0),
        'Reduced motion must reveal off-screen video cards without animation: '+JSON.stringify(accessible));
      await context.close();
      console.log('All videos, section reveals, hover zoom and reduced motion OK');
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
      await page.waitForFunction(() => [...document.querySelectorAll('.channel-card')].every(el => el.classList.contains('reveal-entry')));
      await page.locator('.channel-card').last().scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelectorAll('.channel-card')[1]?.classList.contains('is-visible'));
      assert.equal(result.current,1);
      assert.equal(result.past,1);
      assert.ok(result.links.every(link=>link.url.startsWith('https://')&&link.rel.includes('noopener')&&link.target==='_blank'));
      assert.ok(result.scrollWidth<=width+2,'Channel cards caused horizontal overflow: '+JSON.stringify(result));
      assert.ok(Math.abs(result.left-(width-result.right))<=3,'Channel section off-center');
      console.log('Channels layout '+width+'px OK');
      await context.close();
    }
    // Works without JavaScript, with honest static links to all video files.
    {
      const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,javaScriptEnabled:false});
      const page=await context.newPage();
      await page.goto(base,{waitUntil:'domcontentloaded'});
      const noJs=await page.evaluate(()=>{
        const links=[...document.querySelectorAll('.projects-nojs li a')];
        return {count:links.length,allLocal:links.every(a=>a.pathname.startsWith('/videos/')&&a.pathname.endsWith('.mp4')),
          horizontal:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth};
      });
      assert.equal(noJs.count,17,'Video catalog should still work with JS disabled');
      assert.ok(noJs.allLocal && noJs.horizontal<=noJs.viewport+2,'Non-script portfolio must remain usable and centered');
      await context.close();
      console.log('No-JavaScript gallery: 17 direct video links OK');
    }

    // The 17 originals must show before a slow optional admin API resolves;
    // adding admin projects may NOT tear down an already-open player.
    {
      const context=await browser.newContext({viewport:{width:1280,height:850}});
      const page=await context.newPage();
      let resumeManaged;
      const pending=new Promise(resolve=>{resumeManaged=resolve;});
      await page.route('**/api/managed-projects',async route=>{
        await pending;
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
          projects:[{title:'Projeto gerenciado de teste',category:'outros',position:0,
            src:'https://example.com/video-test.mp4',poster:'/capas/awp-the-prince.webp',
            description:'Projeto adicional carregado depois da biblioteca.'}]
        })});
      });
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.querySelectorAll('#project-grid .project-card').length===17);
      assert.equal(await page.locator('#project-grid .project-card').count(),17);
      await page.locator('#project-grid .project-play').first().click();
      await page.waitForFunction(()=>document.querySelectorAll('#project-grid video').length===1);
      await page.evaluate(()=>{document.querySelector('#project-grid video').dataset.testKeep='yes';});
      resumeManaged();
      await page.waitForFunction(()=>document.querySelectorAll('#project-grid .project-card').length===18);
      const managedResult=await page.evaluate(()=>({
        first:document.querySelector('#project-grid .project-card h3')?.textContent,
        featured:document.querySelectorAll('#project-grid .project-card.featured').length,
        playerKept:document.querySelectorAll('#project-grid video[data-test-keep="yes"]').length,
        extraFilter:!!document.querySelector('#project-filters [data-filter="outros"]')
      }));
      assert.equal(managedResult.first,'Projeto gerenciado de teste');
      assert.equal(managedResult.featured,1);
      assert.equal(managedResult.playerKept,1,'Admin additions must not interrupt a playing video');
      assert.ok(managedResult.extraFilter,'New managed categories should be filterable');
      await context.close();
      console.log('Static gallery loads immediately; late admin project preserves active player');
    }

    // Quality and volume persist across two different video cards without
    // temporary 720p loading or unnecessary availability requests.
    {
      const context=await browser.newContext({viewport:{width:1280,height:850}});
      await context.addInitScript(()=>{
        localStorage.setItem('gustavo-video-quality-v1','full');
        localStorage.setItem('gustavo-video-audio-v1',JSON.stringify({volume:.42,muted:false}));
      });
      const page=await context.newPage();
      const altRequests=[];
      page.on('request',request=>{
        if(request.method()==='HEAD'&&/\/videos-(480|1080)\//.test(request.url()))altRequests.push(request.url());
      });
      await page.route('**/*.mp4',route=>route.fulfill({status:200,contentType:'video/mp4',body:''}));
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.querySelectorAll('#project-grid .project-card').length>=17);
      for(const index of [0,1]){
        await page.locator('#project-grid .project-card').nth(index).locator('.project-play').click();
        const state=await page.locator('#project-grid .project-card').nth(index).evaluate(card=>{
          const v=card.querySelector('video');
          return {src:v?.getAttribute('src'),volume:v?.volume,quality:card.querySelector('.vip-quality')?.textContent};
        });
        assert.ok(state.src?.includes('/videos-1080/'),index+' should start at Full HD: '+JSON.stringify(state));
        assert.ok(Math.abs(state.volume-.42)<.011,'Remembered volume should not reset');
        assert.ok(state.quality?.includes('1080p'),'Quality picker must show selected Full HD immediately');
      }
      assert.equal(altRequests.length,0,'Local variants should not trigger HEAD checks');
      await context.close();
      console.log('Persistent Full HD + volume, zero variant probes across two videos OK');
    }

        // A project can be shared individually without losing the branded page.
    {
      const context=await browser.newContext({viewport:{width:1280,height:850}});
      await context.addInitScript(()=>{
        Object.defineProperty(navigator,'clipboard',{configurable:true,
          value:{writeText:async url=>{window.__copiedProjectUrl=url;}}});
      });
      const page=await context.newPage();
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.querySelectorAll('#project-grid .project-card').length>=17);
      const first=page.locator('#project-grid .project-card').first();
      assert.equal(await first.getAttribute('id'),'projeto-awp-the-prince');
      await first.locator('.project-share').click();
      await page.waitForFunction(()=>Boolean(window.__copiedProjectUrl));
      const shared=await page.evaluate(()=>({
        copied:window.__copiedProjectUrl,
        label:document.querySelector('#project-grid .project-card .project-share')?.textContent
      }));
      assert.ok(shared.copied.endsWith('/#projeto-awp-the-prince'),'Copied link should target specific video');
      assert.ok(shared.label.includes('Link copiado'),'Share action should have success feedback');
      await page.goto(base+'/#projeto-awp-the-prince',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>{
        const card=document.getElementById('projeto-awp-the-prince');
        return Boolean(card && card.getBoundingClientRect().top<window.innerHeight);
      });
      await context.close();
      console.log('Deep-linked, shareable videos and accessible copy feedback OK');
    }

        // Contact flow: required inputs, service selection and final WhatsApp URL.
    {
      const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
      const page=await context.newPage();
      await page.addInitScript(()=>{
        window.open=(url)=>{window.__testOutboundUrl=url;return {opener:null};};
      });
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.locator('.quote-float').click();
      await page.locator('#quote-name').fill('Cliente Teste');
      await page.locator('#quote-service').selectOption('cinematics');
      await page.locator('#quote-details').fill('Quero um cinematic de Counter-Strike com iluminação cinematográfica.');
      await page.locator('#quote-form button[type="submit"]').click();
      await page.waitForFunction(()=>Boolean(window.__testOutboundUrl));
      const lead=await page.evaluate(()=>window.__testOutboundUrl);
      const text=new URL(lead).searchParams.get('text');
      assert.ok(lead.startsWith('https://wa.me/5537988445372?text='),'WhatsApp lead URL missing');
      assert.ok(text.includes('Cliente Teste')&&text.includes('Cinematics / Gaming')&&text.includes('iluminação cinematográfica'),
        'User briefing lost fields: '+text);
      await context.close();
      console.log('Real quote-to-WhatsApp funnel OK on mobile');
    }

        // Accessibility smoke audit using axe-core on mobile and desktop, including modal.
    const axePath=require.resolve('axe-core/axe.min.js');
    for(const width of [390,1280]){
      const context=await browser.newContext({viewport:{width,height:850},deviceScaleFactor:2,isMobile:width<700,hasTouch:width<700});
      const page=await context.newPage();
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>document.querySelectorAll('#project-grid .project-card').length>=17);
      await page.addScriptTag({path:axePath});
      // Audit steady-state colors after entrance fades, not a 760ms transition frame.
      await page.waitForTimeout(1050);
      async function audit(which){
        const findings=await page.evaluate(async()=>{
          const response=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});
          return response.violations.map(v=>({id:v.id,impact:v.impact,description:v.help,nodes:v.nodes.slice(0,5).map(n=>n.target.join(' '))}));
        });
        console.log('Accessibility '+width+'px '+which+': '+JSON.stringify(findings));
        const severe=findings.filter(v=>['critical','serious'].includes(v.impact));
        assert.equal(severe.length,0,width+'px '+which+' has serious accessibility issues: '+JSON.stringify(severe));
      }
      await audit('site');
      await page.locator('.quote-float').click();
      await page.waitForTimeout(480);
      await audit('quote-modal');
      await context.close();
    }
  }finally{await browser.close();await close();}
}
run().catch(err=>{console.error(err);server.close();process.exitCode=1;});
