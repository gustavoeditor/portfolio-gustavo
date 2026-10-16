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
async function makeContactSheet(browser,base,label){
 const context=await browser.newContext({viewport:{width:1360,height:800},deviceScaleFactor:1});
 const page=await context.newPage();
 try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
  const result=await page.evaluate(async items=>{
   const columns=4,cellW=320,cellH=225;
   const rows=Math.ceil(items.length/columns);
   const canvas=document.createElement('canvas');
   canvas.width=columns*cellW;canvas.height=rows*cellH;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   ctx.fillStyle='#101016';ctx.fillRect(0,0,canvas.width,canvas.height);
   const metrics=[];
   for(let i=0;i<items.length;i++){
     const project=items[i],x=(i%columns)*cellW,y=Math.floor(i/columns)*cellH;
     ctx.fillStyle='#22212c';ctx.fillRect(x+3,y+3,cellW-6,cellH-6);
     const image=new Image();
     image.src='/'+project.src.replace(/^\//,'');
     let ok=true;try{await image.decode();}catch(e){ok=false;}
     if(ok){
       const scale=Math.max((cellW-16)/image.naturalWidth,160/image.naturalHeight);
       const drawWidth=image.naturalWidth*scale,drawHeight=image.naturalHeight*scale;
       ctx.save();ctx.beginPath();ctx.rect(x+8,y+8,cellW-16,160);ctx.clip();
       ctx.drawImage(image,x+8+(cellW-16-drawWidth)/2,y+8+(160-drawHeight)/2,drawWidth,drawHeight);ctx.restore();
     }
     ctx.fillStyle='#eae6f1';ctx.font='bold 13px Arial';ctx.fillText(String(i+1).padStart(2,'0')+' '+project.title.slice(0,37),x+9,y+189);
     ctx.fillStyle=ok?'#7ad8ac':'#f87171';ctx.font='11px Arial';
     ctx.fillText(ok?'WebP carregado':'ERRO DE IMAGEM',x+9,y+207);
     const raw=ctx.getImageData(x+8,y+8,cellW-16,160).data;
     let luma=0, dark=0;
     for(let j=0;j<raw.length;j+=4){
       const value=.2126*raw[j]+.7152*raw[j+1]+.0722*raw[j+2];
       luma+=value;if(value<18)dark++;
     }
     metrics.push({title:project.title,ok,averageBrightness:Math.round(luma/(raw.length/4)),fractionVeryDark:+(dark/(raw.length/4)).toFixed(3)});
   }
   return {url:canvas.toDataURL('image/png'),metrics};
  },expected);
  const dir=path.join(root,'out');
  fs.mkdirSync(dir,{recursive:true});
  const target=path.join(dir,'thumbs-contact-sheet-'+label+'.png');
  fs.writeFileSync(target,Buffer.from(result.url.split(',')[1],'base64'));
  console.log('CONTACT_SHEET '+label+': '+JSON.stringify(result.metrics));
  console.log('CONTACT_SHEET_FILE '+target);
 }finally{await context.close();}
}
async function testBrokenCoverRecovery(browser,base){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const page=await context.newPage();
 const transient=new Map();
 const retryFiles=new Set(['butterfly-gamma-dark.webp','purple-gloves-studio.webp']);
 const permanent='neon-gloves-reveal.webp';
 await page.route('**/capas/*.webp*',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').pop();
  const attempt=(transient.get(name)||0)+1;
  transient.set(name,attempt);
  if(name===permanent || (retryFiles.has(name)&&attempt===1)){
   await route.fulfill({status:503,contentType:'text/plain',body:'Simulated transient image failure'});
  }else await route.continue();
 });
 try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll('#project-grid .project-card').length>=17,null,{timeout:18000});
  await page.waitForFunction(()=>{
    const cards=[...document.querySelectorAll('#project-grid .project-card')];
    const affected=cards.filter(x=>x.dataset.source.includes('butterfly-gamma-dark')||x.dataset.source.includes('purple-gloves-studio'));
    const permanently=cards.find(x=>x.dataset.source.includes('neon-gloves-reveal'));
    return affected.length===2 && affected.every(x=>{
      const img=x.querySelector('img.project-poster');
      return img?.complete&&img.naturalWidth>0&&img.src.includes('_cover_retry=');
    }) && permanently?.querySelector('.poster-error-label');
  },null,{timeout:20000});
  const result=await page.evaluate(()=>{
    const cards=[...document.querySelectorAll('#project-grid .project-card')];
    return {loaded:cards.filter(x=>x.querySelector('img.project-poster')?.naturalWidth>0).length,
      eager:cards.filter(x=>x.querySelector('img.project-poster')?.loading==='eager').length,
      recoveries:cards.filter(x=>x.querySelector('img.project-poster')?.src.includes('_cover_retry=')).length,
      fallback:cards.find(x=>x.dataset.source.includes('neon-gloves-reveal'))?.querySelector('.poster-error-label')?.textContent,
      playable:cards.find(x=>x.dataset.source.includes('neon-gloves-reveal'))?.querySelector('.project-play')?.disabled===false
    };
  });
  if(result.eager!==16||result.recoveries!==2||!result.fallback||result.playable!==true){
    throw Error('Failed thumbnail resilience test: '+JSON.stringify(result));
  }
  if([...retryFiles].some(name=>transient.get(name)!==2) || transient.get(permanent)!==2)
    throw Error('Retry count incorrect: '+JSON.stringify(Object.fromEntries(transient)));
  console.log('THUMBNAIL_RECOVERY_TWO_TRANSIENT_ONE_PERMANENT',JSON.stringify(result));
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
  await testBrokenCoverRecovery(browser,base);
  await makeContactSheet(browser,base,'local');
  if(process.env.CHECK_PRODUCTION_THUMBS==='1'){
   try{
    const remote=await checkSite(browser,'https://portfolio-gustavo-chi.vercel.app/','PRODUCTION',390,true);
    console.log('LIVE_PRODUCTION_SUMMARY',JSON.stringify(remote.bad));
    await makeContactSheet(browser,'https://portfolio-gustavo-chi.vercel.app/','production');
   }catch(error){console.log('PRODUCTION_CHECK_UNAVAILABLE',String(error));}
  }
 }finally{await browser.close();await close();}
}
run().catch(e=>{console.error(e);server.close();process.exitCode=1;});
