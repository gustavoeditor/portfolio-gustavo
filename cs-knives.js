/* GUSTAVO CS knives: original vector silhouettes with a procedural Doppler finish.
   No game assets are used. Each blade is a gradient of finish colours bent by fractal
   noise (the "marble" of a Doppler); the noise seed makes every render a unique pattern. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  else root.GustavoKnives=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const FINISHES={
    phase1:{label:'Doppler Phase 1',glow:'#b03a9e',stops:['#040206','#14061a','#4e1349','#b13a96','#1a0720','#050307','#6e1f64','#0a040c']},
    phase2:{label:'Doppler Phase 2',glow:'#ff6fc4',stops:['#1d0618','#a8307e','#ff86cf','#c84aa6','#40103c','#ffa6dc','#7a1f62']},
    phase4:{label:'Doppler Phase 4',glow:'#4f8dff',stops:['#050d26','#1b3f9a','#5aa8ff','#2a5ccc','#0a1640','#a6d4ff','#1e3f8a']},
    blackpearl:{label:'Doppler Black Pearl',glow:'#7d5bff',stops:['#05040d','#17124a','#4430b0','#8b6bff','#1b1550','#c2a8ff','#d0559c','#0a0820']},
    emerald:{label:'Gamma Doppler Emerald',glow:'#2df07a',stops:['#011a0a','#05652a','#1fd162','#8affb8','#0a4a22','#36f585','#03301a']},
    gamma2:{label:'Gamma Doppler Phase 2',glow:'#3ce6b0',stops:['#02160f','#0b6c4c','#3be2a2','#0f8a78','#04382b','#a2ffda','#0c5c4a']}
  };
  const STEEL=['#8a8a99','#3a3a46','#a9a9b8','#2a2a33'];
  const BLACK=['#34333d','#121218','#2a2931','#0b0b10'];
  const IVORY=['#efe6d2','#bfb196','#e2d6bd','#9c8e72'];
  const WOOD=['#5a3824','#24140b','#4a2c1a','#1a0f08'];
  const teeth=(x0,x1,y,step,h)=>{let d='';for(let x=x0;x<x1;x+=step)d+=` L${x+step/2} ${y-h} L${x+step} ${y}`;return d;};
  const KNIVES={
    butterfly:{label:'Butterfly Knife',handle:STEEL,
      blade:'M198 66 L392 64 Q444 66 470 84 Q434 98 384 101 L212 101 Q201 99 198 94 Z',
      edge:'M212 101 L384 101 Q434 98 470 84',spine:'M300 68 L392 67 Q430 69 452 80',
      parts:h=>`<rect x="34" y="59" width="170" height="19" rx="8" fill="url(#h)" stroke="${h[0]}" stroke-opacity=".6"/>
<rect x="34" y="82" width="170" height="19" rx="8" fill="url(#h)" stroke="${h[0]}" stroke-opacity=".6"/>
${[78,118,158].map(x=>`<ellipse cx="${x}" cy="68.5" rx="15" ry="4" fill="#07070b"/><ellipse cx="${x}" cy="91.5" rx="15" ry="4" fill="#07070b"/>`).join('')}
<rect x="22" y="71" width="16" height="18" rx="4" fill="${h[1]}" stroke="${h[2]}" stroke-opacity=".7"/>
<circle cx="206" cy="68" r="4" fill="${h[2]}"/><circle cx="206" cy="92" r="4" fill="${h[2]}"/>`},
    karambit:{label:'Karambit',handle:BLACK,
      blade:'M228 62 C300 46 392 54 446 104 Q454 118 448 130 Q420 100 382 92 Q320 84 236 98 Z',
      edge:'M236 98 Q320 84 382 92 Q420 100 448 130',spine:'M250 64 C310 54 380 62 430 100',
      parts:h=>`<path fill-rule="evenodd" fill="url(#h)" stroke="${h[2]}" stroke-opacity=".5" d="M40 82 a30 30 0 1 0 60 0 a30 30 0 1 0 -60 0 Z M53 82 a17 17 0 1 1 34 0 a17 17 0 1 1 -34 0 Z"/>
<path d="M96 66 Q160 56 232 62 L238 98 Q170 102 98 96 Z" fill="url(#h)" stroke="${h[2]}" stroke-opacity=".5"/>
${[120,145,170,195].map(x=>`<path d="M${x} 96 q6 8 12 0" fill="none" stroke="${h[2]}" stroke-opacity=".5" stroke-width="2"/>`).join('')}`},
    m9:{label:'M9 Bayonet',handle:BLACK,
      blade:'M212 62'+teeth(268,360,62,8,7)+' L392 62 L470 86 Q440 104 380 106 L212 106 Z',
      edge:'M212 106 L380 106 Q440 104 470 86',spine:'M392 66 L462 86',
      parts:h=>`<path d="M48 62 L198 64 L198 104 L48 106 Q40 84 48 62 Z" fill="url(#h)" stroke="${h[2]}" stroke-opacity=".5"/>
${[70,86,102,118,134,150,166,182].map(x=>`<path d="M${x} 66 V102" stroke="${h[2]}" stroke-opacity=".55" stroke-width="2"/>`).join('')}
<path d="M28 60 L48 62 L48 106 L28 108 Q20 84 28 60 Z" fill="${STEEL[1]}" stroke="${STEEL[2]}" stroke-opacity=".6"/>
<path d="M196 42 Q205 38 213 45 L213 115 Q205 122 196 118 Z" fill="${STEEL[1]}" stroke="${STEEL[0]}" stroke-opacity=".8"/>`,
      holes:'<ellipse cx="252" cy="78" rx="13" ry="6" fill="#06060a"/>'},
    talon:{label:'Talon Knife',handle:IVORY,
      blade:'M214 70 C292 40 396 34 474 56 C412 62 340 78 290 96 Q250 108 220 104 Z',
      edge:'M220 104 Q250 108 290 96 C340 78 412 62 474 56',spine:'M240 80 C300 62 370 52 430 52',
      parts:h=>`<path d="M66 100 Q124 64 216 68 L222 104 Q144 100 96 120 Z" fill="url(#h)" stroke="${h[3]}" stroke-opacity=".7"/>
<path fill-rule="evenodd" fill="url(#h)" stroke="${h[3]}" stroke-opacity=".7" d="M36 110 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0 Z M47 110 a11 11 0 1 1 22 0 a11 11 0 1 1 -22 0 Z"/>
<path d="M110 90 Q160 76 210 78" fill="none" stroke="${h[3]}" stroke-opacity=".5" stroke-width="2"/>`},
    flip:{label:'Flip Knife',handle:WOOD,
      blade:'M204 66 L350 62 Q428 62 470 86 Q420 104 356 104 L210 102 Z',
      edge:'M210 102 L356 104 Q420 104 470 86',spine:'M260 68 L350 66 Q410 66 446 80',
      parts:h=>`<path d="M40 70 Q44 62 60 62 L206 64 L206 100 L60 102 Q44 102 40 94 Z" fill="url(#h)" stroke="${h[2]}" stroke-opacity=".6"/>
<path d="M50 82 Q120 78 200 80" fill="none" stroke="${h[2]}" stroke-opacity=".35" stroke-width="3"/>
<circle cx="62" cy="82" r="4" fill="${STEEL[2]}"/><circle cx="190" cy="82" r="5" fill="${STEEL[2]}"/>
<path d="M206 100 L224 101 L214 118 Q205 116 206 100 Z" fill="${STEEL[1]}" stroke="${STEEL[0]}" stroke-opacity=".7"/>`}
  };
  // Deterministic PRNG so a seed always draws the same pattern.
  function rng(seed){let s=seed>>>0||1;return ()=>((s=Math.imul(s^s>>>15,1|s)+0x6d2b79f5|0,((s^s>>>7)>>>0)%100000)/100000);}
  function svg(type,finish,seed){
    const k=KNIVES[type],f=FINISHES[finish];
    if(!k||!f)throw new Error('Faca ou acabamento desconhecido');
    const r=rng(seed),h=k.handle;
    const angle=Math.round(r()*180),freqX=(.006+r()*.006).toFixed(4),freqY=(.018+r()*.016).toFixed(4),scale=Math.round(60+r()*70);
    const n=f.stops.length;
    const stops=f.stops.map((c,i)=>`<stop offset="${(i/(n-1)).toFixed(3)}" stop-color="${c}"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 160" width="480" height="160">
<defs>
<linearGradient id="d" x1="0" y1="0" x2=".32" y2="0" spreadMethod="reflect" gradientTransform="rotate(${angle} .5 .5)">${stops}</linearGradient>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".72" stop-color="#fff" stop-opacity=".05"/><stop offset=".86" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${h[0]}"/><stop offset=".45" stop-color="${h[1]}"/><stop offset=".7" stop-color="${h[2]}"/><stop offset="1" stop-color="${h[3]}"/></linearGradient>
<filter id="w" x="-30%" y="-60%" width="160%" height="220%"><feTurbulence type="fractalNoise" baseFrequency="${freqX} ${freqY}" numOctaves="3" seed="${seed%997}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/></filter>
<clipPath id="c"><path d="${k.blade}"/></clipPath>
</defs>
${k.parts(h)}
<g clip-path="url(#c)"><rect x="170" y="20" width="320" height="120" fill="url(#d)" filter="url(#w)"/><rect x="170" y="20" width="320" height="120" fill="url(#s)"/></g>
${k.holes||''}
<path d="${k.spine}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.4"/>
<path d="${k.edge}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.6"/>
<path d="${k.blade}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1"/>
</svg>`;
  }
  const uri=(type,finish,seed)=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(type,finish,seed));
  // A random loadout: every knife type appears before any repeats.
  function loadout(count,random=Math.random){
    const types=Object.keys(KNIVES),finishes=Object.keys(FINISHES),out=[];
    let bag=[];
    for(let i=0;i<count;i++){
      if(!bag.length)bag=types.slice().sort(()=>random()-.5);
      out.push({type:bag.pop(),finish:finishes[Math.floor(random()*finishes.length)],seed:1+Math.floor(random()*1e6)});
    }
    return out;
  }
  return {KNIVES,FINISHES,svg,uri,loadout};
});
