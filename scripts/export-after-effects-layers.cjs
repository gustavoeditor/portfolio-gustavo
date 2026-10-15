'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'out','AE_GUSTAVO_CAMADAS');
const W=1440,H=900;
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4'};
const sections=[
 ['01_ABERTURA',[
  ['Marca','.site-header .brand'],['Menu','.site-header nav'],['Contato_menu','.site-header .header-whatsapp'],
  ['Selo','.hero-copy > .eyebrow'],['Titulo_principal','.hero-copy > h1'],
  ['Descricao','.hero-copy > .intro'],['Botoes','.hero-copy > .hero-actions'],
  ['Disponibilidade','.hero-copy > .hero-meta'],['Arte_da_marca','.hero-stage']]],
 ['02_ESPECIALIDADES',[['Barra_de_especialidades','.capability-strip']]],
 ['03_PORTFOLIO',[
  ['Titulo','.portfolio > .section-head > div'],['Subtitulo','.portfolio > .section-head > p'],
  ['Filtros','.project-toolbar'],['Video_', '#project-grid > .project-card'],
  ['Convite_de_orcamento','.portfolio-next-step']]],
 ['04_ESTUDOS_DE_CASO',[
  ['Titulo','.case-studies > .section-head > div'],['Descricao','.case-studies > .section-head > p'],
  ['Estudo_', '.case-grid > .case-card'],['Nota_final','.case-footnote']]],
 ['05_CANAIS',[
  ['Titulo','.channels > .section-head > div'],['Descricao','.channels > .section-head > p'],
  ['Categoria_','.channels-group-title'],['Canal_','.channel-card']]],
 ['06_DIFERENCIAIS',[
  ['Titulo','.why > .section-head > div'],['Descricao','.why > .section-head > p'],
  ['Diferencial_','.why-grid > .why-item']]],
 ['07_SERVICOS',[
  ['Selo','.services > .wrap > .eyebrow'],['Titulo','.services .section-head > h2'],
  ['Descricao','.services .section-head > p'],['Servico_','.service-grid > .service']]],
 ['08_PROCESSO',[
  ['Titulo','.workflow > .section-head > div'],['Descricao','.workflow > .section-head > p'],
  ['Etapa_','.workflow-grid > li']]],
 ['09_COMPARACOES',[
  ['Titulo','.comparison > .section-head > div'],['Comparacao_','.compare-card']]],
 ['10_DEPOIMENTOS',[
  ['Titulo','.reviews > .section-head > div'],['Depoimento_','.review-card']]],
 ['11_FAQ',[
  ['Titulo','.faq > .section-head > div'],['Descricao','.faq > .section-head > p'],
  ['Pergunta_','.faq-list > details']]],
 ['12_ORCAMENTO',[
  ['Selo','.quote-intro > .eyebrow'],['Titulo','.quote-intro > h2'],
  ['Descricao','.quote-intro > p'],['Beneficios','.quote-highlights'],
  ['Formulario','#quote-form']]],
 ['13_CONTATO_E_RODAPE',[
  ['Titulo','.contact > div:first-child'],['Botoes','.contact-actions'],
  ['Rodape','.site-footer'],['Botao_flutuante','.quote-float']]]
];
const server=http.createServer((req,res)=>{
 let name;try{name=decodeURIComponent(new URL(req.url,'http://local').pathname);}catch(_){res.writeHead(400).end();return;}
 if(name==='/api/managed-projects'){res.writeHead(200,{'Content-Type':'application/json'}).end('{"projects":[],"enabled":false}');return;}
 const f=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.stat(f,(error,s)=>{
  if(error||!s.isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);
 });
});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_]/gi,'_').slice(0,70);
function writeAEFiles(meta){
 const jsx=[
 '// GUSTAVO / IMPORTADOR PARA AFTER EFFECTS',
 '// Arquivo > Scripts > Executar arquivo de script. Escolha este arquivo.',
 '(function(){',
 ' app.beginUndoGroup("GUSTAVO - Site em camadas");',
 ' try {',
 '  var folder=File($.fileName).parent;',
 '  var f=File(folder.fsName+"/manifest.json");',
 '  if(!f.exists){alert("Mantenha manifest.json e a pasta camadas ao lado do importador.");return;}',
 '  f.open("r");var data=JSON.parse(f.read());f.close();',
 '  if(!app.project)app.newProject();',
 '  var root=app.project.items.addFolder("GUSTAVO - SITE EM CAMADAS");',
 '  var comp=app.project.items.addComp("00_PORTFOLIO_COMPLETO",data.width,data.height,1,20,30);',
 '  comp.parentFolder=root;comp.bgColor=[11/255,11/255,13/255];',
 '  var groups={};',
 '  for(var i=0;i<data.layers.length;i++){',
 '   var item=data.layers[i];',
 '   if(!groups[item.group]){groups[item.group]=app.project.items.addFolder(item.group);groups[item.group].parentFolder=root;}',
 '   var image=File(folder.fsName+"/"+item.file);if(!image.exists)continue;',
 '   var footage=app.project.importFile(new ImportOptions(image));',
 '   footage.parentFolder=groups[item.group];',
 '   var layer=comp.layers.add(footage);layer.name=item.group+" | "+item.name;',
 '   layer.property("Position").setValue([item.x+item.width/2,item.y+item.height/2]);',
 '   if(item.group==="00_FUNDO")layer.locked=true;',
 '  }',
 '  comp.openInViewer();',
 '  alert("Pronto! "+data.layers.length+" camadas na composicao 00_PORTFOLIO_COMPLETO.");',
 ' }catch(e){alert("Erro na importacao: "+e.toString());}',
 ' finally{app.endUndoGroup();}',
 '})();'
 ].join('\r\n');
 fs.writeFileSync(path.join(out,'IMPORTAR_NO_AFTER_EFFECTS.jsx'),jsx);
 const instructions=[
 'GUSTAVO EDITOR - SITE INTEIRO SEPARADO EM CAMADAS',
 '',
 '1. Descompacte AE_GUSTAVO_CAMADAS.zip.',
 '2. No After Effects: Arquivo > Scripts > Executar arquivo de script.',
 '3. Selecione IMPORTAR_NO_AFTER_EFFECTS.jsx dentro da pasta extraida.',
 '4. Abra a composicao 00_PORTFOLIO_COMPLETO e anime os elementos.',
 '',
 'O pacote contem PNGs transparentes separados por secao, com posicoes originais.',
 'Textos e imagens sao rasterizados, mas independentes para animacao.',
 'Os videos aparecem com as capas originais, nao como conteudo reproduzivel.',
 'O print completo esta em 00_REFERENCIA_PAGINA_INTEIRA.png.',
 '',
 'Tamanho da composicao: '+meta.width+'x'+meta.height+' pixels.',
 'Nao mova a pasta camadas antes de executar o importador.',
 'Se desejar criar texto nativo, recrie apenas a camada de texto.',
 '',
 'Gerado pelo Chromium a partir do codigo do portfolio no GitHub.'
 ].join('\r\n');
 fs.writeFileSync(path.join(out,'LEIA_PRIMEIRO.txt'),instructions);
}
async function main(){
 fs.mkdirSync(path.join(out,'camadas'),{recursive:true});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>document.querySelectorAll('#project-grid .project-card').length>=17,null,{timeout:30000});
  await page.waitForFunction(()=>document.querySelectorAll('.channel-card').length>=2,null,{timeout:30000});
  await page.evaluate(async()=>{
   [...document.images].forEach(img=>{img.loading='eager';img.decoding='sync';});
   await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));
   document.body.classList.add('ambient-static');
   window.scrollTo(0,0);
  });
  await page.addStyleTag({content:[
   '*{animation:none!important;transition:none!important;scroll-behavior:auto!important;}',
   '.reveal-entry,.reveal{opacity:1!important;translate:none!important;transform:none!important;}',
   '.project-card{opacity:1!important;filter:none!important;transform:none!important;}',
   '.project-card .project-poster{transform:none!important;}'
  ].join('')});
  await pause(400);
  const size=await page.evaluate(()=>({height:Math.ceil(document.documentElement.scrollHeight),width:document.documentElement.clientWidth}));
  if(size.height>30000)throw Error('A pagina e maior que 30000px.');
  console.log('Tamanho do site '+size.width+'x'+size.height);
  await page.screenshot({path:path.join(out,'00_REFERENCIA_PAGINA_INTEIRA.png'),fullPage:true,animations:'disabled',timeout:90000});
  const hide=await page.addStyleTag({content:[
   'body *{visibility:hidden!important;}',
   'body .ambient-atmosphere,body .ambient-atmosphere *{visibility:visible!important;}',
   'body main,body main>section,body main>.capability-strip,body .site-footer{visibility:visible!important;}',
   'body main>section::before,body main>section::after,body .site-footer::before{visibility:visible!important;}'
  ].join('')});
  const bg='camadas/00_FUNDO_DA_PAGINA.png';
  await page.screenshot({path:path.join(out,bg),fullPage:true,animations:'disabled',timeout:90000});
  await hide.evaluate(node=>node.remove());
  const meta={width:size.width,height:size.height,layers:[
   {group:'00_FUNDO',name:'Fundo e brilho ambiente',file:bg,x:0,y:0,width:size.width,height:size.height}
  ]};
  const isolate=await page.addStyleTag({content:[
   'html,body{background:transparent!important;}',
   'body *{visibility:hidden!important;}',
   'body [data-ae-capture],body [data-ae-capture] *{visibility:visible!important;}',
   'body [data-ae-capture]::before,body [data-ae-capture]::after{visibility:visible!important;}'
  ].join('')});
  let counter=0,skipped=0;
  for(const [group,list] of sections){
   fs.mkdirSync(path.join(out,'camadas',group),{recursive:true});
   for(const [label,selector] of list){
    const nodes=page.locator(selector);
    const total=await nodes.count();
    for(let i=0;i<total;i++){
     const node=nodes.nth(i);
     const b=await node.evaluate(el=>{
      if(el.closest('[hidden]')||getComputedStyle(el).display==='none')return null;
      const r=el.getBoundingClientRect();
      return {x:r.x+scrollX,y:r.y+scrollY,w:r.width,h:r.height};
     });
     if(!b||b.w<2||b.h<2){skipped++;continue;}
     const pad=label.startsWith('Video_')?10:5;
     const x=Math.max(0,Math.floor(b.x-pad)),y=Math.max(0,Math.floor(b.y-pad));
     const right=Math.min(size.width,Math.ceil(b.x+b.w+pad));
     const bottom=Math.min(size.height,Math.ceil(b.y+b.h+pad));
     const w=right-x,h=bottom-y;
     if(w<2||h<2){skipped++;continue;}
     const name=label+(total>1?String(i+1).padStart(2,'0'):'');
     const rel='camadas/'+group+'/'+String(++counter).padStart(3,'0')+'_'+slug(name)+'.png';
     await node.evaluate(el=>el.setAttribute('data-ae-capture','1'));
     await page.screenshot({path:path.join(out,rel),fullPage:true,clip:{x,y,width:w,height:h},omitBackground:true,animations:'disabled',timeout:90000});
     await node.evaluate(el=>el.removeAttribute('data-ae-capture'));
     meta.layers.push({group,name,file:rel,x,y,width:w,height:h});
     console.log('LAYER '+counter+' '+group+' '+name+' '+x+','+y+' '+w+'x'+h);
    }
   }
  }
  await isolate.evaluate(node=>node.remove());
  if(counter<50)throw Error('Captura incompleta: apenas '+counter+' camadas.');
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(meta,null,2));
  writeAEFiles(meta);
  const zip=path.join(root,'out','AE_GUSTAVO_CAMADAS.zip');
  cp.execFileSync('zip',['-q','-r','AE_GUSTAVO_CAMADAS.zip','AE_GUSTAVO_CAMADAS'],{cwd:path.join(root,'out'),timeout:180000});
  console.log('Final ZIP '+zip+' bytes='+fs.statSync(zip).size+' layers='+meta.layers.length+' skipped='+skipped);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
