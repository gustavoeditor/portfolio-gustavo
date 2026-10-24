/* GUSTAVO portfolio ranking: every work, original or uploaded, is ordered by its overall
   quality score (see quality-control.js). A manual position chosen in the admin is a pin
   and always wins. Works without a valid score follow the rated ones in their original order. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.GustavoPortfolioOrder=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const validScore=n=>Number.isInteger(n)&&n>=0&&n<=100;
  // items: [{entry, quality:0-100|null, pin:index|null, publishedAt?}]
  function rank(items){
    if(!Array.isArray(items))return [];
    const staged=items.filter(x=>x&&x.entry!==undefined).map((x,order)=>({...x,order,quality:validScore(x.quality)?x.quality:null}));
    const pinned=staged.filter(x=>Number.isInteger(x.pin)&&x.pin>=0&&x.pin<=150);
    const free=staged.filter(x=>!pinned.includes(x));
    free.sort((a,b)=>{
      if((a.quality===null)!==(b.quality===null))return a.quality===null?1:-1;
      if(a.quality!==b.quality)return b.quality-a.quality;
      // Same score: the newer upload first, then the original order.
      const ad=typeof a.publishedAt==='string'?a.publishedAt:'',bd=typeof b.publishedAt==='string'?b.publishedAt:'';
      if(ad!==bd)return ad>bd?-1:1;
      return a.order-b.order;
    });
    pinned.sort((a,b)=>a.pin-b.pin||a.order-b.order);
    const out=free.map(x=>x.entry);
    for(const item of pinned)out.splice(Math.min(out.length,item.pin),0,item.entry);
    return out;
  }
  return {rank};
});
