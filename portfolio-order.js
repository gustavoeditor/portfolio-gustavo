/* GUSTAVO portfolio ranking: preserve original editorial order, then insert managed projects
   at visually recommended or manually chosen positions. Quality applies only to ties. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.GustavoPortfolioOrder=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  function merge(originals,managed){
    const items=Array.isArray(originals)?originals.slice():[];
    if(!Array.isArray(managed))return items;
    const staged=managed.map((row,index)=>{
      const position=Number.isInteger(row.position)&&row.position>=0&&row.position<=150?row.position:items.length;
      const quality=Number.isInteger(row.qualityScore)&&row.qualityScore>=0&&row.qualityScore<=100?row.qualityScore:null;
      return {row,index,position,quality,mode:row.rankingMode};
    }).filter(x=>Array.isArray(x.row.entry));
    staged.sort((a,b)=>{
      if(a.position!==b.position)return a.position-b.position;
      // An explicit human override wins a tie.
      if((a.mode==='manual')!==(b.mode==='manual'))return a.mode==='manual'?-1:1;
      if(a.mode==='auto'&&b.mode==='auto'&&a.quality!==null&&b.quality!==null&&a.quality!==b.quality)return b.quality-a.quality;
      const ad=typeof a.row.publishedAt==='string'?a.row.publishedAt:'';
      const bd=typeof b.row.publishedAt==='string'?b.row.publishedAt:'';
      if(ad&&bd&&ad!==bd)return ad<bd?-1:1;
      return a.index-b.index;
    });
    let inserted=0;
    for(const item of staged){
      items.splice(Math.min(items.length,item.position+inserted),0,item.row.entry);
      inserted++;
    }
    return items;
  }
  return {merge};
});
