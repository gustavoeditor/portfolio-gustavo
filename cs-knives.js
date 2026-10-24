/* GUSTAVO CS knives (image fallback): cut-out renders in /knives/*.webp, shown when the
   3D knives (knives-3d.js) cannot load. Every page load draws a new random loadout. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.GustavoKnives=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const RENDERS=[
    {file:'butterfly-gamma-green',model:'Butterfly Knife',finish:'Gamma Doppler Emerald',glow:'#2fe08a'}
  ];
  const src=render=>'/knives/'+render.file+'.webp';
  // Random loadout without repeats until every render has appeared.
  function loadout(count,random=Math.random){
    const out=[];let bag=[];
    for(let i=0;i<count;i++){
      if(!bag.length)bag=RENDERS.slice().sort(()=>random()-.5);
      out.push(bag.pop());
    }
    return out;
  }
  return {RENDERS,src,loadout};
});
