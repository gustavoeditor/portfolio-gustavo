'use strict';
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright-core');

const root=path.resolve(__dirname,'..');
const projects=JSON.parse(fs.readFileSync(path.join(root,'projetos.json'),'utf8'));
const expected=projects.map(p=>({title:p.title,src:String(p.poster||'')}));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.mp4':'video/mp4'};
const server=http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);}
 catch(_){res.writeHead(400).end();return;}
 if(pathname==='/api/managed-projects'){res.writeHead(200,{'Content-Type':'application/json'}).end('{"projects":[]}');return;}
 const name=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!name.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.stat(name,(err,stat)=>{
  if(err||!stat.isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(name)]||'application/octet-stream'});
  fs.createReadStream(name).pipe(res);
 });
});
function listen(){return new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));}
function close(){return new Promise(resolve=>server.close(resolve));}
async function checkSite(browser,base,label,width,mobile){
 const context=await browser.newContext({
  viewport:{width,height:850},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile
 });
 const page=await context.newPage();
 const responses=[];
 const failures=[];
 page.on('response',r=>{if(r.url().includes('/capas/'))responses.push({url:r.url(),status:r.status(),type:r.headers()['content-type']});});
 page.on('requestfailed',r=>{if(r.url().includes('/capas/'))failures.push({url:r.url(),error:r.failure()?.errorText});});
 try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(count=>document.querySelectorAll('#project-grid .project-card').length>=count,expected.length,{timeout:18000});
  const cards=page.locator('#project-grid .project-card');
  for(let i=0;i<expected.length;i++){
   await cards.nth(i).scrollIntoViewIfNeeded({timeout:12000});
   await page.waitForTimeout(mobile?60:35);
  }
  await page.evaluate(()=>Promise.all([...document.querySelectorAll('#project-grid img.project-poster')].map(img=>img.decode().catch(()=>{}))));
  const found=await page.evaluate(()=>{
    return [...document.querySelectorAll('#project-grid .project-card')].map(card=>{
      const img=card.querySelector('img.project-poster');
      const box=img?.getBoundingClientRect();
      return {
        title:card.querySelector('h3')?.textContent?.trim(),
        src:img?.getAttribute('src'),
        currentSrc:img?.currentSrc,
        complete:img?.complete,
        width:img?.naturalWidth,
        height:img?.naturalHeight,
        display:img?getComputedStyle(img).display:null,
        visibility:img?getComputedStyle(img).visibility:null,
        opacity:img?getComputedStyle(img).opacity:null,
        box:box?{width:box.width,height:box.height}:null
      };
    });
  });
  const bad=found.filter(x=>!x.src||!x.complete||!x.width||!x.height||x.display==='none'||x.visibility==='hidden'||Number(x.opacity)===0||!x.box?.width||!x.box?.height);
  console.log('THUMBNAILS '+label+' '+width+'px:',JSON.stringify({count:found.length,bad,responses,failures}));
  if(label==='local' && bad.length)throw Error('Thumbnails broken locally: '+JSON.stringify(bad));
  return {count:found.length,bad,responses,failures};
 }finally{await context.close();}
}
async function run(){
 // Require that every static video has exactly one valid, decodable poster.
 for(const p of expected){
  const file=path.join(root,p.src);
  if(!p.src.startsWith('capas/')||!fs.existsSync(file)||fs.statSync(file).size<500)
   throw Error('Missing or empty project image: '+p.title+' '+p.src);
 }
 await listen();
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 try{
  const base='http://127.0.0.1:'+server.address().port+'/';
  for(const [width,mobile] of [[390,true],[1280,false]]) await checkSite(browser,base,'local',width,mobile);
  if(process.env.CHECK_PRODUCTION_THUMBS==='1'){
   try{
    const remote=await checkSite(browser,'https://portfolio-gustavo-chi.vercel.app/','PRODUCTION',390,true);
    console.log('LIVE_PRODUCTION_SUMMARY',JSON.stringify(remote.bad));
   }catch(error){console.log('PRODUCTION_CHECK_UNAVAILABLE',String(error));}
  }
 }finally{await browser.close();await close();}
}
run().catch(e=>{console.error(e);server.close();process.exitCode=1;});
