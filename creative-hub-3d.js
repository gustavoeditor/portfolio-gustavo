// Creative Hub: ícones 3D renderizados em WebGL (raymarching de um bloco com o símbolo em relevo).
// Sem bibliotecas. Se o WebGL não estiver disponível, o ícone em CSS (.i3d-fallback) continua visível.
(()=>{'use strict';
 const icons=[...document.querySelectorAll('.icon3d[data-glyph]')];
 if(!icons.length)return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const GLYPH={hub:0,tools:1,text:2,cut:3};
 // a: corpo, b: luz de borda, c: símbolo (emissivo), d: luz de rebatimento
 const PAL={
  hub:{a:'#7b5cff',b:'#ff7ad9',c:'#f4eeff',d:'#8ef0d6'},
  tools:{a:'#7b5cff',b:'#ff7ad9',c:'#efe7ff',d:'#8ef0d6'},
  text:{a:'#1fb8a3',b:'#a58cff',c:'#eafff9',d:'#ff9be8'},
  cut:{a:'#b45ce0',b:'#8f73ff',c:'#fff0fd',d:'#8ef0d6'}
 };
 const lin=h=>[1,3,5].map(i=>Math.pow(parseInt(h.substr(i,2),16)/255,2.2));
 const VS='attribute vec2 a;varying vec2 v;void main(){v=a;gl_Position=vec4(a,0.,1.);}';
 const FS=`precision highp float;
varying vec2 v;
uniform vec2 uRes;uniform float uT;uniform vec2 uRot;uniform float uG;
uniform vec3 uA;uniform vec3 uB;uniform vec3 uC;uniform vec3 uD;
float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}
float arcC(vec2 p,float R,float w,float g){float a=atan(p.y,p.x);if(abs(a)<g){vec2 e=R*vec2(cos(g),sin(g));return min(length(p-e),length(p-vec2(e.x,-e.y)))-w;}return abs(length(p)-R)-w;}
float ring(vec2 p,float R,float w){return abs(length(p)-R)-w;}
float glyph(vec2 p){
 float d;
 if(uG<.5){d=arcC(p-vec2(-.08,.05),.28,.072,.78);float r=.03;
  d=min(d,seg(p,vec2(.19,-.34),vec2(.19,-.1))-r);d=min(d,seg(p,vec2(.35,-.34),vec2(.35,-.1))-r);d=min(d,seg(p,vec2(.19,-.22),vec2(.35,-.22))-r);}
 else if(uG<1.5){d=1e3;vec2 q0=vec2(-.44,-.3);
  for(int i=1;i<=18;i++){float x=-.44+.88*float(i)/18.;vec2 q=vec2(x,-.3+.58*exp(-x*x/.026));d=min(d,seg(p,q0,q));q0=q;}
  d=min(d-.048,length(p-vec2(0.,.28))-.07);}
 else if(uG<2.5){d=seg(p,vec2(-.38,.3),vec2(.1,.3))-.068;d=min(d,seg(p,vec2(-.14,.3),vec2(-.14,-.33))-.068);d=min(d,seg(p,vec2(.32,.36),vec2(.32,-.36))-.034);}
 else{d=ring(p-vec2(-.25,.19),.105,.042);d=min(d,ring(p-vec2(-.25,-.19),.105,.042));d=min(d,seg(p,vec2(-.165,.125),vec2(.4,-.3))-.042);d=min(d,seg(p,vec2(-.165,-.125),vec2(.4,.3))-.042);}
 return d;}
float body(vec3 p){vec2 q=abs(p.xy)-vec2(.36);float d2=length(max(q,0.))+min(max(q.x,q.y),0.)-.24;vec2 w=vec2(d2+.08,abs(p.z)-.18+.08);return min(max(w.x,w.y),0.)+length(max(w,0.))-.08;}
float gly(vec3 p){float g=glyph(p.xy);vec2 w=vec2(g+.012,abs(p.z-.19)-.05+.012);return min(max(w.x,w.y),0.)+length(max(w,0.))-.012;}
vec2 rot(vec2 p,float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c)*p;}
vec3 tr(vec3 p){p.y-=sin(uT*1.1)*.035;p.xz=rot(p.xz,uRot.x);p.yz=rot(p.yz,uRot.y);return p;}
vec2 map(vec3 p){p=tr(p);float b=body(p),g=gly(p);return g<b?vec2(g,1.):vec2(b,0.);}
vec3 nrm(vec3 p){const vec2 k=vec2(1.,-1.);float e=.0015;return normalize(k.xyy*map(p+k.xyy*e).x+k.yyx*map(p+k.yyx*e).x+k.yxy*map(p+k.yxy*e).x+k.xxx*map(p+k.xxx*e).x);}
vec3 env(vec3 r){
 vec3 c=mix(vec3(.012,.01,.022),uA*.24,smoothstep(-.4,.8,r.y));
 c+=vec3(.85,.82,1.)*.22*smoothstep(.2,.95,r.y);
 c+=vec3(1.)*1.35*smoothstep(.8,.965,dot(r,normalize(vec3(-.55,.62,.55))));
 c+=vec3(.92,.9,1.)*.32*smoothstep(.72,1.,dot(r,normalize(vec3(-.25,.45,1.))));
 c+=vec3(.9,.92,1.)*.45*smoothstep(.93,.99,dot(r,normalize(vec3(.7,.5,.5))));
 c+=uB*.9*smoothstep(.72,.95,dot(r,normalize(vec3(.95,-.15,-.25))));
 c+=uD*.3*smoothstep(.55,.95,dot(r,normalize(vec3(-.6,-.7,.1))));
 return c;}
void main(){
 vec2 uv=v*vec2(uRes.x/uRes.y,1.);
 vec3 ro=vec3(0.,0.,3.3),rd=normalize(vec3(uv,-3.25));
 float t=0.,mg=1e3,mb=1e3;vec2 h=vec2(0.);bool hit=false;
 for(int i=0;i<96;i++){vec3 p=ro+rd*t;h=map(p);
  if(h.y>.5)mg=min(mg,h.x);else mb=min(mb,h.x);
  if(h.x<.0008){hit=true;break;}
  t+=h.x*.9;if(t>6.)break;}
 vec3 col=vec3(0.);float al=0.;
 if(hit){vec3 p=ro+rd*t;vec3 n=nrm(p);vec3 V=-rd;
  float fr=pow(1.-clamp(dot(n,V),0.,1.),3.);
  vec3 r=reflect(rd,n);vec3 L=normalize(vec3(-.5,.75,.6));float dif=clamp(dot(n,L),0.,1.);
  if(h.y<.5){
   vec3 q=tr(p);float gd=glyph(q.xy);
   col=uA*.16*(.3+.9*dif)+env(r)*mix(.12,1.,fr);
   col+=pow(clamp(dot(r,L),0.,1.),90.)*1.;
   col+=mix(uC,uA,.35)*.16*exp(-max(gd,0.)*28.)*step(.12,q.z);
  }else{
   vec3 q=tr(p);
   col=mix(mix(uC,uB,.28)*.6,uC*.98,smoothstep(-.45,.45,q.y));
   col+=env(r)*.18*fr+pow(clamp(dot(r,L),0.,1.),40.)*.35;
  }
  col=col/(1.+col*.22);col=pow(col,vec3(1./2.2));al=1.;
 }else{
  col=uA*.22*exp(-mb*12.)+uB*.06*exp(-mb*18.);
  col=pow(col,vec3(1./2.2))*.55*smoothstep(1.,.55,length(v));al=clamp(max(col.r,max(col.g,col.b)),0.,1.);
 }
 gl_FragColor=vec4(col,al);
}`;
 function setup(el){
  const kind=el.dataset.glyph,cv=document.createElement('canvas');
  cv.setAttribute('aria-hidden','true');
  let gl=null;try{gl=cv.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,powerPreference:'high-performance'});}catch(_){}
  if(!gl)return null;
  const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.warn('Creative Hub 3D:',gl.getShaderInfoLog(s));return null;}return s;};
  const vs=sh(gl.VERTEX_SHADER,VS),fs=sh(gl.FRAGMENT_SHADER,FS);if(!vs||!fs)return null;
  const pr=gl.createProgram();gl.attachShader(pr,vs);gl.attachShader(pr,fs);gl.linkProgram(pr);
  if(!gl.getProgramParameter(pr,gl.LINK_STATUS))return null;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(pr,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  const U=n=>gl.getUniformLocation(pr,n);
  const u={res:U('uRes'),t:U('uT'),rot:U('uRot')};
  const p=PAL[kind]||PAL.hub;
  gl.uniform1f(U('uG'),GLYPH[kind]||0);
  gl.uniform3fv(U('uA'),lin(p.a));gl.uniform3fv(U('uB'),lin(p.b));gl.uniform3fv(U('uC'),lin(p.c));gl.uniform3fv(U('uD'),lin(p.d));
  el.prepend(cv);el.classList.add('gl-ready');
  const s={el,cv,gl,u,on:true,tx:0,ty:0,x:0,y:0,phase:Math.random()*6,scale:1,hero:el.classList.contains('icon-hero'),slow:0,last:0};
  cv.addEventListener('webglcontextlost',e=>{e.preventDefault();s.dead=true;el.classList.remove('gl-ready');cv.remove();});
  return s;
 }
 const items=icons.map(setup).filter(Boolean);
 if(!items.length)return;
 function fit(s){
  const dpr=Math.min(window.devicePixelRatio||1,s.hero?1.75:1.5)*s.scale;
  const w=Math.max(1,Math.round(s.cv.clientWidth*dpr)),h=Math.max(1,Math.round(s.cv.clientHeight*dpr));
  if(s.cv.width!==w||s.cv.height!==h){s.cv.width=w;s.cv.height=h;s.gl.viewport(0,0,w,h);s.gl.uniform2f(s.u.res,w,h);}
 }
 function draw(s,now){
  if(s.dead)return;
  fit(s);
  s.x+=(s.tx-s.x)*.07;s.y+=(s.ty-s.y)*.07;
  const time=reduce?1.3:now/1000+s.phase;
  const yaw=(s.hero?-.38:-.3)+(reduce?0:Math.sin(time*.45)*.2)+s.x*.6;
  const pitch=-.16+(reduce?0:Math.sin(time*.6)*.05)-s.y*.4;
  s.gl.uniform1f(s.u.t,time);s.gl.uniform2f(s.u.rot,yaw,pitch);
  s.gl.drawArrays(s.gl.TRIANGLES,0,3);
 }
 // Interação: o ícone do topo acompanha o ponteiro na página; os das ferramentas, dentro do cartão.
 const clamp=x=>Math.max(-1,Math.min(1,x));
 for(const s of items){
  const host=s.hero?window:(s.el.closest('.tool-card')||s.el);
  host.addEventListener('pointermove',e=>{
   if(e.pointerType&&e.pointerType!=='mouse')return;
   const r=s.el.getBoundingClientRect(),span=s.hero?Math.max(innerWidth,600)/2:280;
   s.tx=clamp((e.clientX-(r.left+r.width/2))/span);s.ty=clamp((e.clientY-(r.top+r.height/2))/span);
  },{passive:true});
  if(!s.hero)host.addEventListener('pointerleave',()=>{s.tx=0;s.ty=0;});
 }
 if(reduce){
  const once=()=>items.forEach(s=>draw(s,0));
  once();addEventListener('resize',once);return;
 }
 const io=new IntersectionObserver(es=>es.forEach(e=>{const s=items.find(x=>x.el===e.target);if(s)s.on=e.isIntersecting;}),{rootMargin:'120px'});
 items.forEach(s=>io.observe(s.el));
 function loop(now){
  for(const s of items){
   if(!s.on||document.hidden)continue;
   if(s.last){const dt=now-s.last;s.slow=s.slow*.95+(dt>26?1:0)*.05;if(s.slow>.7&&s.scale>.75){s.scale-=.125;s.slow=0;}}
   s.last=now;draw(s,now);
  }
  requestAnimationFrame(loop);
 }
 requestAnimationFrame(loop);
})();
