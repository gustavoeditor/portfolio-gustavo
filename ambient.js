/* GUSTAVO / ATMOSPHERE: subtle full-page depth.
   No transforms are ever applied to text, videos, interactive controls or the document itself. */
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const limited = Boolean(navigator.connection?.saveData || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2));
  const atmosphere = document.querySelector('.ambient-atmosphere');
  const targets = [...document.querySelectorAll([
    '.hero','.portfolio','.case-studies','.channels','.why','.services',
    '.workflow','.faq','.quote','.contact','.site-footer','.about','.comparison','.reviews'
  ].join(','))];
  if (!atmosphere || !targets.length) return;

  let frame = 0;
  let attached = false;
  let pointerX = 0;
  let pointerY = 0;
  let previousPointerX = NaN;
  let previousPointerY = NaN;
  function clamp(x,min,max){return Math.max(min,Math.min(max,x));}

  function render() {
    frame = 0;
    if (document.hidden || reduced.matches || limited) return;
    const height = window.innerHeight || document.documentElement.clientHeight;
    if (!height) return;
    const center = height * .5;
    const mobile = window.innerWidth <= 820;
    const ratio = mobile ? .012 : .048;
    const maximum = mobile ? 6 : 26;
    for (const element of targets) {
      if (element.hidden) continue;
      const rect = element.getBoundingClientRect();
      if (rect.bottom < -80 || rect.top > height+80) continue;
      const midpoint = rect.top + rect.height*.5;
      const depth = clamp((center-midpoint)*ratio,-maximum,maximum);
      element.style.setProperty('--ambient-y',depth.toFixed(1)+'px');
      element.style.setProperty('--ambient-x',mobile?'0px':(pointerX*.2).toFixed(1)+'px');
    }
    if (!mobile && finePointer.matches) {
      const px = (pointerX*12).toFixed(1);
      const py = (pointerY*10).toFixed(1);
      if (px !== previousPointerX || py !== previousPointerY) {
        atmosphere.style.setProperty('--ambient-pointer-x',px+'px');
        atmosphere.style.setProperty('--ambient-pointer-y',py+'px');
        previousPointerX=px;previousPointerY=py;
      }
    }
  }
  function schedule() {
    if (!frame && !document.hidden && !reduced.matches && !limited)
      frame = window.requestAnimationFrame(render);
  }
  function pointerMove(event) {
    if (!finePointer.matches || window.innerWidth <= 820) return;
    pointerX = clamp(event.clientX / Math.max(window.innerWidth,1)*2-1,-1,1);
    pointerY = clamp(event.clientY / Math.max(window.innerHeight,1)*2-1,-1,1);
    schedule();
  }
  function start() {
    if (limited || reduced.matches) {
      document.body.classList.add('ambient-static');
      if (attached) {
        attached=false;
        window.removeEventListener('scroll',schedule);
        window.removeEventListener('resize',schedule);
        window.removeEventListener('pointermove',pointerMove);
      }
      if (frame) window.cancelAnimationFrame(frame);
      frame=0;
      targets.forEach(el => {
        el.style.removeProperty('--ambient-y');
        el.style.removeProperty('--ambient-x');
      });
      atmosphere.style.removeProperty('--ambient-pointer-x');
      atmosphere.style.removeProperty('--ambient-pointer-y');
      return;
    }
    document.body.classList.remove('ambient-static');
    if (!attached) {
      attached=true;
      window.addEventListener('scroll',schedule,{passive:true});
      window.addEventListener('resize',schedule,{passive:true});
      window.addEventListener('pointermove',pointerMove,{passive:true});
    }
    schedule();
  }
  if (typeof reduced.addEventListener === 'function') reduced.addEventListener('change',start);
  document.addEventListener('visibilitychange',schedule);
  start();
})();
