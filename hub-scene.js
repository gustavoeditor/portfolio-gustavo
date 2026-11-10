// Creative Hub · cena WebGL em tela cheia (sem bibliotecas).
// Raymarching do anel cromado com o logo CH, fios, coluna de vidro da galeria; partículas, feixes de cristal,
// bloom em duas escalas (HDR quando a GPU permite), FXAA, aberração cromática, grão e correção de cor.
(()=>{'use strict';
const cv=document.getElementById('gl');if(!cv)return;
let gl=null;try{gl=cv.getContext('webgl',{antialias:false,alpha:false,powerPreference:'high-performance'});}catch(_){}
if(!gl){document.documentElement.classList.add('no-gl');return;}
const VS='attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
const COMMON=`precision highp float;varying vec2 v;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
vec2 h22(vec2 p){float n=h21(p);return vec2(n,h21(p+n));}
mat2 r2(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h);}
`;
const SCENE=COMMON+`
uniform vec2 uRes;uniform float uT;uniform vec2 uM;uniform float uS;uniform float uP;uniform float uB;
float arcF(vec2 p,float R,float w,float g){float a=atan(p.y,p.x);
 if(abs(a)<g){vec2 d=vec2(cos(g),sign(p.y)*sin(g));return seg(p,d*(R-w),d*(R+w));}return abs(length(p)-R)-w;}
float glyph(vec2 p){p=p*1.08+vec2(.06,0.);
 float c=arcF(p,.34,.082,.82)-.008,st=.058;
 float h=seg(p,vec2(.17,-.2),vec2(.17,.2))-st;
 h=min(h,seg(p,vec2(.47,-.27),vec2(.47,.27))-st);
 h=min(h,seg(p,vec2(.17,0.),vec2(.47,0.))-st*.9);
 return min(c,h)/1.08;}
float torus(vec3 p,float R,float r){vec2 q=vec2(length(p.xy)-R,p.z);return length(q)-r;}
float gly3(vec3 p){float g=glyph(p.xy);vec2 w=vec2(g+.03,abs(p.z)-.11+.03);return min(max(w.x,w.y),0.)+length(max(w,0.))-.03;}
float GP(){return clamp(uP,0.,1.);}float PP(){return clamp(uP-1.,0.,1.);}
vec3 obj(vec3 p){p.y-=GP()*6.;p.y-=sin(uT*.6)*.035;p/=.74;p.xz*=r2(uM.x*.4+sin(uT*.25)*.22+uS*.5);p.yz*=r2(-uM.y*.25+sin(uT*.19)*.06);return p;}
float spine(vec3 p){
 vec3 s=p-vec3((1.-GP())*8.-PP()*8.,0.,-.4);
 s.y+=uT*.1+uS*4.;
 float id=floor(s.y/.5);s.y=mod(s.y,.5)-.25;
 s.xz*=r2(id*.7+uT*.12+s.y*1.4);
 float lump=sin(s.x*9.+id*2.)*sin(s.z*8.+id)*sin(s.y*12.)*.045;
 vec2 q=vec2(length(s.xz*vec2(1.,1.35))-.3,s.y*1.5);float tv=length(q)-.13+lump;
 vec3 k=s;k.x=abs(k.x)-.48;float wing=length(k*vec3(1.,2.4,1.6))-.14+lump*.6;
 float core=length(s.xz)-.11;
 float d=min(min(tv,wing),core);
 return d*.75;}
vec2 map(vec3 p){
 vec3 q=obj(p);
 float ring=torus(q,1.,.05)*.74,g=gly3(q)*.74;
 vec3 pp=p-vec3(0.,GP()*6.,0.);
 vec3 a=pp-vec3(.5,-1.95,0.);a.xz*=r2(.3+uS*.25);float s1=torus(vec3(a.x*1.65,a.y,a.z),1.5,.014)/1.65;
 vec3 b=pp-vec3(-.5,-1.95,0.);b.xz*=r2(-.3-uS*.25);float s2=torus(vec3(b.x*1.65,b.y,b.z),1.5,.014)/1.65;
 float s=max(min(s1,s2),pp.y+.6);
 float sv=(uP>.01&&uP<1.99)?spine(p):1e3;
 float d=min(min(ring,min(g,s)),sv);
 return vec2(d,d==ring?0.:(d==g?1.:(d==s?2.:3.)));}
vec3 nrm(vec3 p){const vec2 k=vec2(1.,-1.);float e=.0015;return normalize(k.xyy*map(p+k.xyy*e).x+k.yyx*map(p+k.yyx*e).x+k.yxy*map(p+k.yxy*e).x+k.xxx*map(p+k.xxx*e).x);}
vec3 env(vec3 r){
 vec3 c=vec3(.004,.005,.008);
 c+=vec3(.9,.95,1.)*smoothstep(.5,.95,r.y)*.28;
 c+=vec3(1.)*2.6*smoothstep(.93,.99,dot(r,normalize(vec3(-.35,.75,.55))));
 c+=vec3(1.)*1.8*smoothstep(.965,.995,dot(r,normalize(vec3(.62,.5,.6))));
 c+=vec3(.95,.97,1.)*1.1*smoothstep(.86,.995,dot(r,normalize(vec3(-.25,.35,1.))));
 c+=vec3(0.,.72,1.)*1.2*pow(max(dot(r,normalize(vec3(-.92,-.2,.25))),0.),10.);
 c+=vec3(.85,.3,1.)*.9*pow(max(dot(r,normalize(vec3(.92,-.32,.15))),0.),10.);
 c+=vec3(.25,1.,.75)*.6*pow(max(dot(r,normalize(vec3(0.,-1.,.3))),0.),8.);
 return c;}
vec3 iri(float x){return .5+.5*cos(6.2831*(x+vec3(0.,.33,.67)));}
vec3 bg(vec2 uv){
 vec3 c=vec3(.006,.008,.012);
 c+=vec3(.0,.16,.15)*exp(-length(uv-vec2(-1.75,1.15))*1.6)*.7;
 c+=vec3(.14,.04,.26)*exp(-length(uv-vec2(-1.45,-1.2))*1.7)*.6;
 c+=vec3(.0,.10,.12)*exp(-length(uv-vec2(1.9,1.1))*2.2)*.35;
 c=mix(c,c+vec3(.05,.02,.09)*exp(-length(uv)*.9),clamp(uP,0.,1.)*(1.-clamp(uP-1.,0.,1.)));
 return c;}
vec3 dust(vec2 uv,float lmin,float lmax){
 vec3 acc=vec3(0.);
 for(int L=0;L<5;L++){
  float fl=float(L);if(fl<lmin||fl>lmax)continue;
  float sc=13.+fl*11.,depth=1.+fl*.8;
  vec2 off=vec2(uM.x,uM.y)*.07/depth+vec2(sin(uT*.04+fl)*.25,-uT*.018*(1.+fl*.35));
  vec2 st=vec2(1.);
  if(uP>.5&&uP<1.5&&L>1)st=vec2(.22,1.);
  vec2 p=(uv+off)*sc*st;
  vec2 id=floor(p),f=fract(p)-.5;
  vec2 o=h22(id+fl*13.1)-.5;float rnd=h21(id+fl*7.1);
  vec2 w=(id+.5)/(sc*st)-off;
  float plume=exp(-pow((w.x-.52-max(0.,-w.y-.4)*.25)/.2,2.)-pow((w.y+.82)/.42,2.))+exp(-pow((w.x+.55+max(0.,-w.y-.4)*.25)/.2,2.)-pow((w.y+.88)/.4,2.));
  float bub=exp(-pow((w.x+.62)/.16,2.)-pow((w.y+.22)/.22,2.))*.45;
  float hero=plume*1.05+bub+.006;
  float col=exp(-pow(w.x/.42,2.))*(.55+.45*sin(w.y*3.+uT*.3));
  float streams=exp(-pow((w.y-.05+sin(w.x*1.3)*.1)/.07,2.))+exp(-pow((w.y+.55)/.05,2.))*.7;
  float gal=max(col*1.1,streams*.8)+.02;
  float dens=mix(mix(hero,gal,GP()),.01,PP());
  if(rnd>dens)continue;
  float big=L==0?1.:0.;
  float sz=min((.06+.16*pow(h21(id+3.),7.))*(1.+big*2.2),.42);
  float d=length(f-o*(.5-sz)*1.6);
  float a=smoothstep(sz,sz*(big>0.?.1:.25),d);
  vec3 ch=mix(vec3(.5,.5,.2),vec3(.8,.76,.4),h21(id+9.));
  ch=mix(ch,vec3(.45,.9,1.),step(.7,bub/(hero+.001))*step(.4,h21(id+5.)));
  ch=mix(ch,vec3(1.),step(.96,h21(id+15.)));
  vec3 cg=mix(vec3(1.,.32,.72),vec3(.32,.5,1.),step(.5,h21(id+21.)));
  cg=mix(cg,vec3(.7,.45,1.),step(.72,h21(id+23.)));cg=mix(cg,vec3(.45,1.,.95),step(.9,h21(id+29.)));
  vec3 c=mix(ch,cg,GP());
  float tw=.6+.4*sin(uT*1.6+rnd*40.);
  acc+=c*a*tw*(big>0.?.1:mix(1.,1.5,GP()))/(1.+fl*.12);
 }
 return acc;}
vec3 swarm(vec2 uv){
 vec3 acc=vec3(0.);
 float vis=(1.-GP())*(.65+.35*smoothstep(0.,.3,uS))+uB*.5*(1.-GP());
 if(vis<.02)return acc;
 for(int i=0;i<70;i++){
  float fi=float(i),r1=h21(vec2(fi,1.)),r2v=h21(vec2(fi,2.)),r3=h21(vec2(fi,3.));
  float u=-.15+fi/70.*3.45+sin(uT*.12+fi*.05)*.05;
  float sp=uT*.035;u+=sp;
  vec2 c=vec2(-1.55+fract(u/3.45)*3.3,.78+.24*sin(fract(u/3.45)*6.2831+.6)+.1*sin(fract(u/3.45)*14.))+vec2(0.,(r1-.5)*.13);
  float x=c.x;float dy=.24*cos(fract(u/3.45)*6.2831+.6)*6.2831/3.3+.1*cos(fract(u/3.45)*14.)*14./3.3;
  vec2 tg=normalize(vec2(1.,dy));tg=r2((r3-.5)*.22)*tg;
  float len=.09+.24*r2v;
  float d=seg(uv,c-tg*len,c+tg*len);
  float along=clamp(dot(uv-(c-tg*len),tg)/(2.*len),0.,1.);
  float tipGlow=smoothstep(.72,1.,along)*1.8+.35;
  float edge=smoothstep(1.7,1.3,abs(x));
  float core=exp(-d*d/.0000055);
  float halo=exp(-d*70.)*.1;
  vec3 col=mix(vec3(.75,1.,.95),vec3(.92,.95,1.),r1);
  acc+=col*(core*tipGlow*1.6+halo)*edge;
 }
 for(int i=0;i<7;i++){
  float fi=float(i);float x=mix(-1.6,1.7,h21(vec2(fi,31.)));float top=h21(vec2(fi,32.))>.5?1.:-1.;
  float y=top*(.98+h21(vec2(fi,33.))*.2);
  float len=.05+h21(vec2(fi,35.))*.12;float sl=(h21(vec2(fi,36.))-.5)*.3;
  float d=abs(uv.x-x-(uv.y-y)*sl);float inY=smoothstep(len,len*.3,abs(uv.y-y));
  acc+=vec3(.7,1.,.95)*(exp(-d*d/.000005)*1.4+exp(-d*70.)*.08)*inY*step(.3,fract(uv.y*10.+fi));
 }
 return acc*vis;}
vec3 burst(vec2 uv){
 if(uB<.005)return vec3(0.);
 float a=atan(uv.y,uv.x),r=length(uv);float x=(a+3.14159)/6.28318*140.;float id=floor(x),fa=fract(x);float rnd=h21(vec2(id,7.));
 if(rnd<.5)return vec3(0.);
 float head=uB*(1.3+rnd*2.8),tail=head-(.2+rnd*.9)*uB;
 float line=exp(-pow((fa-.5)*9.,2.))*smoothstep(tail,head,r)*step(r,head);
 vec3 c=mix(vec3(.9,.97,1.),vec3(.55,1.,.9),step(.82,rnd));
 return c*line*(1.-smoothstep(.5,1.,uB))*3.;}
void main(){
 vec2 uv=(v*2.-1.)*vec2(uRes.x/uRes.y,1.);
 vec3 col=bg(uv)+dust(uv,1.,4.);
 float asp=uRes.x/uRes.y;float zoom=asp<1.?mix(2.1,1.,clamp(asp,0.,1.)):1.;
 vec3 ro=vec3(uM.x*.25,.15+uM.y*.15-uS*.9-(zoom-1.)*.75,4.7*zoom-uS*1.1);
 vec3 rd=normalize(vec3(uv-vec2(0.,.06),-1.8));
 float t=0.,mr=1e3;vec2 h=vec2(0.);bool hit=false;
 vec3 oc=ro-vec3(0.,-.6,0.);float bb=dot(oc,rd),cc=dot(oc,oc)-(uP>.01?36.:11.);float disc=bb*bb-cc;
 if(disc>0.){
  t=max(0.,-bb-sqrt(disc));
  for(int i=0;i<100;i++){vec3 p=ro+rd*t;h=map(p);
   if(h.y<1.5)mr=min(mr,h.x);
   if(h.x<.0005*t){hit=true;break;}
   t+=h.x*.85;if(t>12.)break;}
 }
 if(hit){
  vec3 p=ro+rd*t,n=nrm(p),r=reflect(rd,n);
  float fr=pow(1.-max(dot(n,-rd),0.),2.5);
  vec3 film=iri(fr*1.2+dot(n,vec3(.35,.6,.2))*.8+uT*.03);
  vec3 sc;
  if(h.y<.5){sc=env(r)*mix(vec3(.94,.95,1.),film*1.3,.06+.5*fr*fr)+film*fr*fr*.18;}
  else if(h.y<1.5){sc=(env(r)*1.35+vec3(.16,.16,.19))*mix(vec3(.97,.97,1.),film*1.2,.04+.25*fr*fr);}
  else if(h.y<2.5){sc=env(r)*vec3(.55,.58,.66);}
  else{vec3 q=p;sc=env(r)*.75*mix(vec3(.85,.85,.95),film*1.5,.45+.4*fr)+mix(vec3(.9,.2,.6),vec3(.2,.45,1.),.5+.5*sin(q.y*2.4+uT*.6))*.1*(1.-fr)+film*fr*.22;}
  col=sc;
 }
 col+=vec3(.3,.6,1.)*exp(-mr*40.)*.05*(1.-GP());
 col+=swarm(uv)+burst(uv-vec2(0.,.06));
 col+=dust(uv,0.,0.);
 gl_FragColor=vec4(col,1.);
}`;
const BRIGHT=COMMON+`uniform sampler2D uTex;uniform vec2 uPx;uniform float uThr;
void main(){vec3 c=vec3(0.);for(int i=0;i<4;i++){vec2 o=vec2(mod(float(i),2.),floor(float(i)/2.))-.5;c+=texture2D(uTex,v+o*uPx*2.).rgb;}c*=.25;
 float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(uThr,uThr*1.6,l),1.);}`;
const BLUR=COMMON+`uniform sampler2D uTex;uniform vec2 uDir;
void main(){vec3 c=texture2D(uTex,v).rgb*.227;
 c+=(texture2D(uTex,v+uDir*1.385).rgb+texture2D(uTex,v-uDir*1.385).rgb)*.316;
 c+=(texture2D(uTex,v+uDir*3.231).rgb+texture2D(uTex,v-uDir*3.231).rgb)*.07;
 gl_FragColor=vec4(c,1.);}`;
const COMP=COMMON+`uniform sampler2D uScene;uniform sampler2D uB1;uniform sampler2D uB2;uniform vec2 uRes;uniform float uT;uniform vec4 uTint;uniform vec2 uPx;uniform float uHdr;
vec3 fxaa(vec2 uv){
 vec3 NW=texture2D(uScene,uv+vec2(-1.,-1.)*uPx).rgb,NE=texture2D(uScene,uv+vec2(1.,-1.)*uPx).rgb,SW=texture2D(uScene,uv+vec2(-1.,1.)*uPx).rgb,SE=texture2D(uScene,uv+vec2(1.,1.)*uPx).rgb,M=texture2D(uScene,uv).rgb;
 vec3 L=vec3(.299,.587,.114);float a=dot(NW,L),b=dot(NE,L),c=dot(SW,L),d=dot(SE,L),m=dot(M,L);
 float lo=min(m,min(min(a,b),min(c,d))),hi=max(m,max(max(a,b),max(c,d)));
 vec2 dir=vec2(-((a+b)-(c+d)),(a+c)-(b+d));
 float red=max((a+b+c+d)*.03125,1./128.);float rcp=1./(min(abs(dir.x),abs(dir.y))+red);
 dir=clamp(dir*rcp,-8.,8.)*uPx;
 vec3 A=.5*(texture2D(uScene,uv+dir*(1./3.-.5)).rgb+texture2D(uScene,uv+dir*(2./3.-.5)).rgb);
 vec3 B=A*.5+.25*(texture2D(uScene,uv-dir*.5).rgb+texture2D(uScene,uv+dir*.5).rgb);
 float lb=dot(B,L);return (lb<lo||lb>hi)?A:B;}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){
 vec2 d=v-.5;float len=length(d);vec2 ca=d*len*.01;
 vec3 c;c.r=fxaa(v+ca).r;c.g=fxaa(v).g;c.b=fxaa(v-ca).b;
 vec3 b1=texture2D(uB1,v).rgb,b2=texture2D(uB2,v).rgb;
 c+=b1*.5+b2*.55;
 float lt=dot(c,vec3(.3,.59,.11));c=mix(c,uTint.rgb*lt*2.+uTint.rgb*.03,uTint.a*.85);
 c*=vec3(.98,1.01,1.05);
 c=max(c-.004,0.);
 c=aces(c*(uHdr>.5?1.25:1.45));c=pow(c,vec3(.92));
 c*=mix(.2,1.,smoothstep(1.,.18,len*1.32));
 c+=(h21(v*uRes+fract(uT*7.)*97.)-.5)*.045;
 gl_FragColor=vec4(c,1.);}`;
function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.warn(gl.getShaderInfoLog(s));throw Error('shader');}return s;}
let vsh;
function prog(fs){const p=gl.createProgram();gl.attachShader(p,vsh);gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.bindAttribLocation(p,0,'a');gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('link');const u={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const k=gl.getActiveUniform(p,i).name;u[k]=gl.getUniformLocation(p,k);}return {p,u};}
let P;try{vsh=sh(gl.VERTEX_SHADER,VS);P={scene:prog(SCENE),bright:prog(BRIGHT),blur:prog(BLUR),comp:prog(COMP)};}catch(e){document.documentElement.classList.add('no-gl');return;}
gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
// HDR quando houver half float com filtro linear; senão 8 bits.
const hf=gl.getExtension('OES_texture_half_float'),hfl=gl.getExtension('OES_texture_half_float_linear');
let TYPE=gl.UNSIGNED_BYTE;
function fbo(w,h){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,TYPE,null);
 for(const [k,val] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,val);
 const f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
 const ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;return {t,f,w,h,ok};}
if(hf&&hfl){TYPE=hf.HALF_FLOAT_OES;const test=fbo(4,4);if(!test.ok)TYPE=gl.UNSIGNED_BYTE;}
const HDR=TYPE!==gl.UNSIGNED_BYTE;
let quality=1,S,B1,B1b,B2,B2b,W=0,HH=0;
function resize(){const dpr=Math.min(window.devicePixelRatio||1,1.5);W=Math.round(innerWidth*dpr);HH=Math.round(innerHeight*dpr);cv.width=W;cv.height=HH;
 const k=dpr*quality;const sw=Math.max(4,Math.round(innerWidth*k)),shh=Math.max(4,Math.round(innerHeight*k));
 S=fbo(sw,shh);B1=fbo(Math.max(2,sw>>2),Math.max(2,shh>>2));B1b=fbo(B1.w,B1.h);B2=fbo(Math.max(2,sw>>3),Math.max(2,shh>>3));B2b=fbo(B2.w,B2.h);}
resize();addEventListener('resize',resize);
const H=window.HUB=window.HUB||{phase:0,burst:0,tint:[.6,.4,1],tintAmt:0};
const m={x:0,y:0,tx:0,ty:0};let sc=0,stx=0,ph=0,ta=0;const tn=[.6,.4,1];
addEventListener('pointermove',e=>{m.tx=(e.clientX/innerWidth)*2-1;m.ty=-((e.clientY/innerHeight)*2-1);},{passive:true});
const scrollMax=()=>Math.max(1,document.documentElement.scrollHeight-innerHeight);
addEventListener('scroll',()=>{stx=Math.min(1,scrollY/Math.max(1,innerHeight*1.6));},{passive:true});
function pass(pr,target,w,h){gl.bindFramebuffer(gl.FRAMEBUFFER,target?target.f:null);gl.viewport(0,0,w,h);gl.useProgram(pr.p);}
function blur(src,tmp){pass(P.blur,tmp,tmp.w,tmp.h);gl.bindTexture(gl.TEXTURE_2D,src.t);gl.uniform1i(P.blur.u.uTex,0);gl.uniform2f(P.blur.u.uDir,1/src.w,0);gl.drawArrays(gl.TRIANGLES,0,3);
 pass(P.blur,src,src.w,src.h);gl.bindTexture(gl.TEXTURE_2D,tmp.t);gl.uniform2f(P.blur.u.uDir,0,1/src.h);gl.drawArrays(gl.TRIANGLES,0,3);}
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
let last=0,last0=0,slow=0,visible=true;
document.addEventListener('visibilitychange',()=>{visible=!document.hidden;if(visible){last0=0;requestAnimationFrame(frame);}});
function frame(now){
 if(!visible)return;
 if(last){const dt=now-last;slow=slow*.96+(dt>30?.04:0);if(slow>.55&&quality>.55){quality*=.88;slow=0;resize();}}last=now;
 const dt=Math.min(.25,last0?(now-last0)/1000:.016);last0=now;const k=x=>1-Math.exp(-dt*x);
 m.x+=(m.tx-m.x)*k(2.8);m.y+=(m.ty-m.y)*k(2.8);sc+=(stx-sc)*k(5);
 ph+=(H.phase-ph)*k(2.6);ta+=(H.tintAmt-ta)*k(3.5);for(let i=0;i<3;i++)tn[i]+=(H.tint[i]-tn[i])*k(3.5);
 if(H.burst>0){H.burst+=dt*.85;if(H.burst>=1.15)H.burst=0;}
 const t=reduce?8:now/1000;
 gl.activeTexture(gl.TEXTURE0);
 pass(P.scene,S,S.w,S.h);const u=P.scene.u;gl.uniform2f(u.uRes,S.w,S.h);gl.uniform1f(u.uT,t);gl.uniform2f(u.uM,m.x,m.y);gl.uniform1f(u.uS,sc);gl.uniform1f(u.uP,ph);gl.uniform1f(u.uB,Math.min(H.burst,1));gl.drawArrays(gl.TRIANGLES,0,3);
 pass(P.bright,B1,B1.w,B1.h);gl.bindTexture(gl.TEXTURE_2D,S.t);gl.uniform1i(P.bright.u.uTex,0);gl.uniform2f(P.bright.u.uPx,1/S.w,1/S.h);gl.uniform1f(P.bright.u.uThr,HDR?1.25:.72);gl.drawArrays(gl.TRIANGLES,0,3);
 blur(B1,B1b);blur(B1,B1b);
 pass(P.blur,B2,B2.w,B2.h);gl.bindTexture(gl.TEXTURE_2D,B1.t);gl.uniform1i(P.blur.u.uTex,0);gl.uniform2f(P.blur.u.uDir,1/B1.w,1/B1.h);gl.drawArrays(gl.TRIANGLES,0,3);
 blur(B2,B2b);blur(B2,B2b);
 pass(P.comp,null,W,HH);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,S.t);gl.uniform1i(P.comp.u.uScene,0);
 gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,B1.t);gl.uniform1i(P.comp.u.uB1,1);
 gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,B2.t);gl.uniform1i(P.comp.u.uB2,2);
 gl.uniform2f(P.comp.u.uRes,W,HH);gl.uniform4f(P.comp.u.uTint,tn[0],tn[1],tn[2],ta);gl.uniform2f(P.comp.u.uPx,1/S.w,1/S.h);gl.uniform1f(P.comp.u.uT,t);gl.uniform1f(P.comp.u.uHdr,HDR?1:0);
 gl.drawArrays(gl.TRIANGLES,0,3);gl.activeTexture(gl.TEXTURE0);
 if(!reduce)requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if(reduce)addEventListener('scroll',()=>requestAnimationFrame(frame),{passive:true});
window.__hubScene={setQuality:q=>{quality=q;resize();},hdr:HDR};
})();
