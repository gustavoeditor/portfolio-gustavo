'use strict';
/* Visual regression: no auth session, no actual upload, no external API calls. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright-core');
const root = path.resolve(__dirname,'..');
const fixture = path.join(root,'videos-360','abertura-keydrop-treino.mp4');
const source = fs.readFileSync(path.join(root,'api/admin-panel.js'),'utf8');
const match = /^const PANEL_HTML = (".*");$/m.exec(source);
if (!match) throw Error('Admin HTML not found');
const html = JSON.parse(match[1]);
let analyses = 0;
const routeData = {
  '/api/admin-config':{storageReady:true,uploadMode:'token',visualAIReady:true,visualAIConfigured:true},
  '/api/admin-analyze':{title:'Cinematic da AWP',category:'cs2',description:'Revelação cinematográfica da AWP.',position:4,source:'ai',explanation:'Cenário CS2 visível nos quadros.'},
  '/api/managed-projects':{projects:[]}
};
const server = http.createServer((req,res)=>{
  let pathname;
  try {pathname=new URL(req.url,'http://localhost').pathname;}catch(_){res.writeHead(400).end();return;}
  if (pathname==='/test-admin') {
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);return;
  }
  if (Object.hasOwn(routeData,pathname)) {
    let answer = routeData[pathname];
    if (pathname === '/api/admin-analyze') {
      analyses++;
      if (analyses === 2) answer = {
        title:'abertura-keydrop-treino',source:'filename',reasonCode:'credits',
        explanation:'A IA não conseguiu concluir por limite de créditos ou orçamento.'
      };
    }
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(answer));return;
  }
  if (pathname.startsWith('/api/')) {
    res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Not enabled during UI test'}));return;
  }
  const full=path.resolve(root,'.'+pathname);
  if (!full.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
  fs.stat(full,(err,stat)=>{
    if (err||!stat.isFile()) {res.writeHead(404).end();return;}
    const ext=path.extname(full);
    res.writeHead(200,{'Content-Type':{'.js':'application/javascript','.css':'text/css','.json':'application/json','.mp4':'video/mp4'}[ext]||'application/octet-stream'});
    fs.createReadStream(full).pipe(res);
  });
});
(async()=>{
  if (!fs.existsSync(fixture)) throw Error('Video fixture missing');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
    const page=await browser.newPage({viewport:{width:1160,height:860}});
    const errors=[];
    page.on('pageerror',err=>errors.push(String(err)));
    await page.goto('http://127.0.0.1:'+server.address().port+'/test-admin',{waitUntil:'load'});
    assert.equal(await page.locator('#auto-editor').isVisible(),false);
    // Real file bytes exercise the browser video decoder and the thumbnail creator.
    await page.locator('#auto-file').setInputFiles(fixture);
    await page.locator('#auto-editor').waitFor({state:'visible',timeout:10000});
    await page.waitForFunction(()=>document.getElementById('auto-title-input')?.value==='Cinematic da AWP',{timeout:45000});
    assert.match(await page.locator('#auto-reason').textContent(),/Análise por IA de até 8 quadros/);
    await page.locator('#auto-poster').waitFor({state:'visible',timeout:10000});
    const original=await page.locator('#auto-poster').getAttribute('src');
    assert.ok(original?.startsWith('blob:'),'Generated poster should be a local image blob');
    await page.locator('#auto-pick-frame').click();
    await page.locator('#auto-cover-dialog').waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.getElementById('auto-cover-range').disabled,{timeout:10000});
    await page.locator('#auto-cover-range').evaluate(el=>{
      el.value=String(Number(el.max)*0.75);
      el.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await page.waitForFunction(()=>!document.getElementById('auto-cover-confirm').disabled,{timeout:15000});
    const t=await page.locator('#auto-cover-time').textContent();
    assert.match(t,/\d+:\d{2}\.\d{2} \/ \d+:\d{2}\.\d{2}/);
    await page.locator('#auto-cover-confirm').click();
    await page.waitForFunction(old=>!document.getElementById('auto-cover-dialog').open &&
      document.getElementById('auto-poster').src!==old,original,{timeout:12000});
    assert.match(await page.locator('#auto-feedback').textContent(),/Thumbnail escolhida/);
    assert.equal(await page.locator('#auto-publish').isEnabled(),true);
    // Retry must show operational errors and recover on a subsequent attempt.
    await page.locator('#auto-regenerate-title').click();
    await page.waitForFunction(()=>document.getElementById('auto-title-ai-status').dataset.mode==='error',{timeout:10000});
    assert.match(await page.locator('#auto-reason').textContent(),/créditos/);
    await page.locator('#auto-regenerate-title').click();
    await page.waitForFunction(()=>document.getElementById('auto-title-ai-status').dataset.mode==='success',{timeout:10000});
    assert.equal(await page.locator('#auto-title-input').inputValue(),'Cinematic da AWP');
    await page.locator('#auto-pick-frame').click();
    await page.locator('#auto-cover-cancel').click();
    assert.equal(await page.locator('#auto-cover-dialog').isVisible(),false);
    assert.deepEqual(errors,[],'No client script should crash: '+errors.join('; '));
    await page.close();
    console.log('Admin upload: AI title, native video frame timeline, thumbnail save and cancel PASSED.');
  }finally {
    if(browser) await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
