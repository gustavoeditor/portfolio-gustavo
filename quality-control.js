/* GUSTAVO quality control: one scoring model shared by the admin upload, the API and the
   public gallery. Overall = produção 30% + complexidade 25% + profissionalismo 25% + técnica 20%.
   Technical checks are measured from the file; the other three come from visual review (AI or curator). */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.GustavoQuality=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const WEIGHTS={production:.30,complexity:.25,professionalism:.25,technical:.20};
  const TIERS=[
    {id:'flagship',min:85,label:'Flagship'},
    {id:'premium',min:75,label:'Premium'},
    {id:'solid',min:63,label:'Sólido'},
    {id:'archive',min:0,label:'Arquivo'}
  ];
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const validScore=n=>Number.isInteger(n)&&n>=0&&n<=100;
  const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
  const lerp=(value,lo,hi,from,to)=>from+(to-from)*clamp((value-lo)/(hi-lo),0,1);

  // meta: {width,height,duration,bytes,fps?}. Missing values give neutral marks, never a failure.
  function technical(meta){
    const m=meta&&typeof meta==='object'?meta:{};
    const checks=[];
    const add=(id,label,status,detail,score,weight)=>checks.push({id,label,status,detail,score:Math.round(score),weight});
    const w=finite(m.width)?Math.round(m.width):0,h=finite(m.height)?Math.round(m.height):0;
    const shortSide=Math.min(w,h)||0;
    if(!shortSide)add('resolution','Resolução','warn','Não identificada',60,.40);
    else {
      const s=shortSide>=2160?100:shortSide>=1440?96:shortSide>=1080?90:shortSide>=720?lerp(shortSide,720,1080,66,90):lerp(shortSide,360,720,30,66);
      add('resolution','Resolução',shortSide>=1080?'pass':shortSide>=720?'warn':'fail',w+'×'+h,s,.40);
    }
    const fps=finite(m.fps)?m.fps:null;
    if(fps===null)add('framerate','Taxa de quadros','info','Não medida no navegador',80,.15);
    else add('framerate','Taxa de quadros',fps>=23.9?'pass':'warn',(Math.round(fps*100)/100)+' fps',fps>=50?100:fps>=29?86:fps>=23.9?80:55,.15);
    const duration=finite(m.duration)?m.duration:null;
    if(duration===null)add('duration','Duração','warn','Não identificada',70,.15);
    else {
      const s=duration<1.5?45:duration<3?lerp(duration,1.5,3,60,82):duration<=120?100:duration<=600?88:75;
      add('duration','Duração',duration<1.5?'fail':duration<3?'warn':'pass',duration.toFixed(1)+' s',s,.15);
    }
    if(duration&&finite(m.bytes)&&w&&h){
      const kbps=m.bytes*8/duration/1000;
      // Bits per pixel per frame: comparable across resolutions.
      const bpp=kbps*1000/(w*h*(fps||30));
      const s=bpp>=.07?100:bpp>=.02?lerp(bpp,.02,.07,62,100):lerp(bpp,.005,.02,30,62);
      add('bitrate','Bitrate',bpp>=.02?'pass':bpp>=.01?'warn':'fail',Math.round(kbps/100)/10+' Mbps',s,.20);
    } else add('bitrate','Bitrate','info','Não calculado',75,.20);
    if(w&&h){
      const ratio=w/h,known=[16/9,9/16,1,4/5,21/9,4/3].some(r=>Math.abs(ratio-r)<.02);
      add('aspect','Proporção',known?'pass':'warn',known?(Math.abs(ratio-16/9)<.02?'16:9':Math.abs(ratio-9/16)<.02?'9:16':ratio.toFixed(2)+':1'):ratio.toFixed(2)+':1 (não padrão)',known?100:70,.10);
    } else add('aspect','Proporção','info','Não identificada',80,.10);
    const total=checks.reduce((sum,c)=>sum+c.weight,0);
    const score=Math.round(checks.reduce((sum,c)=>sum+c.score*c.weight,0)/total);
    return {score:clamp(score,0,100),checks};
  }

  function overall(parts){
    if(!parts)return null;
    let sum=0,weight=0;
    for(const key of Object.keys(WEIGHTS)){
      if(validScore(parts[key])){sum+=parts[key]*WEIGHTS[key];weight+=WEIGHTS[key];}
    }
    // Technical alone is not a quality judgement: require at least one visual criterion.
    if(!weight||weight<=WEIGHTS.technical+1e-9)return null;
    return Math.round(sum/weight);
  }

  function tier(score){
    if(!validScore(score))return null;
    return TIERS.find(t=>score>=t.min);
  }

  // Normalize a stored/received quality object. Unknown fields are dropped.
  function clean(input){
    if(!input||typeof input!=='object')return null;
    const out={};
    for(const key of ['production','complexity','professionalism','technical'])if(validScore(input[key]))out[key]=input[key];
    const score=overall(out);
    if(score===null)return null;
    out.overall=score;
    out.tier=tier(score).id;
    if(['baixa','media','alta'].includes(input.confidence))out.confidence=input.confidence;
    if(['ai','curator','manual'].includes(input.source))out.source=input.source;
    return out;
  }

  return {WEIGHTS,TIERS,technical,overall,tier,clean,validScore};
});
