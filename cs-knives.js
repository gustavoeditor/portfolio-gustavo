/* GUSTAVO CS knives: renders from the editor's own reference set, cut out onto a
   transparent background (/knives/*.webp). Every page load draws a new random loadout. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.GustavoKnives=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const RENDERS=[
    {file:'butterfly-doppler-pink',model:'Butterfly Knife',finish:'Doppler',glow:'#e0479f'},
    {file:'butterfly-doppler-blue',model:'Butterfly Knife',finish:'Doppler',glow:'#3f6dff'},
    {file:'butterfly-gamma-cyan',model:'Butterfly Knife',finish:'Gamma Doppler',glow:'#3fd6e0'},
    {file:'butterfly-gamma-green',model:'Butterfly Knife',finish:'Gamma Doppler',glow:'#2fe08a'},
    {file:'butterfly-black-pearl',model:'Butterfly Knife',finish:'Doppler Black Pearl',glow:'#6a4cff'},
    {file:'m9-doppler-pink',model:'M9 Bayonet',finish:'Doppler',glow:'#e04fb8'},
    {file:'m9-doppler-mix',model:'M9 Bayonet',finish:'Doppler',glow:'#a46cff'},
    {file:'m9-doppler-dark',model:'M9 Bayonet',finish:'Doppler',glow:'#c0305e'},
    {file:'m9-sapphire',model:'M9 Bayonet',finish:'Doppler Sapphire',glow:'#3554ff'},
    {file:'m9-ruby',model:'M9 Bayonet',finish:'Doppler Ruby',glow:'#ff2a3d'},
    {file:'m9-gamma',model:'M9 Bayonet',finish:'Gamma Doppler',glow:'#38e0c0'},
    {file:'bayonet-doppler',model:'Bayonet',finish:'Doppler',glow:'#b06cff'}
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
