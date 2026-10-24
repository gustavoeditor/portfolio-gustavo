/* GUSTAVO 3D knives for the homepage vortex (ES module, loaded on demand).
   Real knife meshes (/knives/models/*.gkm, built by scripts/build-knife-models.cjs) with a
   metallic physical material; the Doppler pattern is generated on the blade by a
   domain-warped noise shader, seeded per knife, so every page load gives new patterns. */
import * as THREE from './vendor/three/three.module.min.js';
import {RoomEnvironment} from './vendor/three/RoomEnvironment.js';

const MODELS={
  butterfly:{file:'butterfly',label:'Butterfly Knife'},
  m9:{file:'m9-bayonet',label:'M9 Bayonet'},
  bayonet:{file:'bayonet',label:'Bayonet'}
};
// Palettes sampled from the reference renders: dark base → mid → bright → highlight.
const FINISHES=[
  {label:'Doppler Phase 1',colors:['#050308','#2a0c2c','#7a1d66','#c8489c'],glow:'#b0359a'},
  {label:'Doppler Phase 2',colors:['#24081f','#8c286f','#e2569f','#ff9fd2'],glow:'#e0479f'},
  {label:'Doppler Phase 3',colors:['#08131f','#245276','#4f9a72','#c25c8e'],glow:'#4f9a9a'},
  {label:'Doppler Phase 4',colors:['#050a24','#1a3591','#4673ff','#9d6dff'],glow:'#4673ff'},
  {label:'Doppler Ruby',colors:['#200204','#6e0911','#cf1a2b','#ff6b78'],glow:'#ff2a3d'},
  {label:'Doppler Sapphire',colors:['#020624','#0a1c86','#2a4cff','#78a8ff'],glow:'#3554ff'},
  {label:'Doppler Black Pearl',colors:['#040309','#141038','#38287f','#8a3a72'],glow:'#6a4cff'},
  {label:'Gamma Doppler Emerald',colors:['#011806','#04612a','#13cc5e','#86ffb8'],glow:'#2fe08a'},
  {label:'Gamma Doppler Phase 2',colors:['#021812','#09644b','#26cc9c','#a4ffe0'],glow:'#38e0c0'},
  {label:'Gamma Doppler Phase 4',colors:['#03121f','#0c5574','#2fbad6','#62e3a2'],glow:'#3fd6e0'}
];

const NOISE=`
vec3 gk_hash(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return fract(sin(p)*43758.5453)*2.-1.;}
float gk_noise(vec3 p){vec3 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
 return mix(mix(mix(dot(gk_hash(i),f),dot(gk_hash(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),mix(dot(gk_hash(i+vec3(0,1,0)),f-vec3(0,1,0)),dot(gk_hash(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
            mix(mix(dot(gk_hash(i+vec3(0,0,1)),f-vec3(0,0,1)),dot(gk_hash(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),mix(dot(gk_hash(i+vec3(0,1,1)),f-vec3(0,1,1)),dot(gk_hash(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z);}
float gk_fbm(vec3 p){float s=0.,a=.55;for(int i=0;i<5;i++){s+=a*gk_noise(p);p*=2.03;a*=.5;}return s;}
`;

function dopplerMaterial(finish,seed){
  const m=new THREE.MeshPhysicalMaterial({metalness:.72,roughness:.24,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:1.35,transparent:true});
  const c=finish.colors.map(x=>new THREE.Color(x));
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{gkC0:{value:c[0]},gkC1:{value:c[1]},gkC2:{value:c[2]},gkC3:{value:c[3]},gkSeed:{value:seed}});
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 gkPos;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\ngkPos=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 gkPos;\nuniform vec3 gkC0,gkC1,gkC2,gkC3,gkSeed;'+NOISE)
      .replace('#include <color_fragment>',`#include <color_fragment>
 // Doppler marble: domain-warped fbm stretched along the blade.
 vec3 q=gkPos*vec3(3.4,7.5,7.5)+gkSeed;
 vec3 w=vec3(gk_fbm(q),gk_fbm(q+vec3(5.2,1.3,2.8)),gk_fbm(q+vec3(1.7,9.2,3.1)));
 // Stretch the fbm range so dark clouds and bright patches both appear, like the in-game finish.
 float n=clamp(gk_fbm(q+2.6*w)*1.35+.5,0.,1.);
 float cloud=clamp(gk_fbm(q*2.3+w*1.5+7.)*1.6+.5,0.,1.);
 vec3 col=mix(gkC0,gkC1,smoothstep(.12,.38,n));
 col=mix(col,gkC2,smoothstep(.42,.62,n));
 col=mix(col,gkC3,smoothstep(.7,.88,n)*.85);
 // Dark marbled veins and smoky shadows.
 float vein=1.-smoothstep(.0,.035,abs(n-.5+.18*(cloud-.5)));
 col=mix(col,gkC0,vein*.75);
 col*=mix(.55,1.25,cloud);
 diffuseColor.rgb=col;`);
  };
  return m;
}
function handleMaterial(model){
  return new THREE.MeshPhysicalMaterial({color:model==='bayonet'?0x6f7254:0x1d1d24,metalness:.65,roughness:.42,clearcoat:.4,envMapIntensity:1.1,transparent:true});
}
async function loadModel(file){
  const buf=await (await fetch('/knives/models/'+file+'.gkm',{cache:'force-cache'})).arrayBuffer();
  const view=new DataView(buf);
  if(String.fromCharCode(...new Uint8Array(buf,0,4))!=='GKM1')throw new Error('Modelo inválido');
  const headLen=view.getUint32(4,true),base=8+headLen;
  const head=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,8,headLen)));
  const parts={};
  for(const p of head.parts){
    const q=new Int16Array(buf,base+p.position,p.vertices*3),pos=new Float32Array(q.length);
    for(let i=0;i<q.length;i++)pos[i]=q[i]/65534;
    const nq=new Int8Array(buf,base+p.normal,p.vertices*3),nor=new Float32Array(nq.length);
    for(let i=0;i<nq.length;i++)nor[i]=nq[i]/127;
    const idx=p.index32?new Uint32Array(buf,base+p.index,p.indices):new Uint16Array(buf,base+p.index,p.indices);
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    g.setAttribute('normal',new THREE.BufferAttribute(nor,3));
    g.setIndex(new THREE.BufferAttribute(idx.slice(),1));
    g.computeBoundingSphere();
    parts[p.name]=g;
  }
  return parts;
}
const shuffle=a=>a.map(x=>[Math.random(),x]).sort((p,q)=>p[0]-q[0]).map(x=>x[1]);
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

export async function mount(host,{small=false}={}){
  const probe=document.createElement('canvas');
  if(!(probe.getContext('webgl2')||probe.getContext('webgl')))return null;
  const geos={};
  await Promise.all(Object.entries(MODELS).map(async([k,m])=>{geos[k]=await loadModel(m.file);}));

  const wrap=document.createElement('div');wrap.className='vortex-3d';wrap.setAttribute('aria-hidden','true');
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,small?1.5:1.75));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  wrap.append(renderer.domElement);host.append(wrap);

  const scene=new THREE.Scene();
  const pmrem=new THREE.PMREMGenerator(renderer);
  scene.environment=pmrem.fromScene(new RoomEnvironment(),.04).texture;
  scene.fog=new THREE.Fog(0x0a0814,900,2600);
  const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(300,500,900);scene.add(key);
  const rimA=new THREE.PointLight(0xa070ff,1.6e6,0,2);rimA.position.set(-700,300,200);scene.add(rimA);
  const rimB=new THREE.PointLight(0x40e0ff,1.0e6,0,2);rimB.position.set(700,-300,300);scene.add(rimB);
  const camera=new THREE.PerspectiveCamera(50,1,1,6000);

  const count=small?5:9;
  let modelBag=[],finishBag=[];
  const knives=Array.from({length:count},(_,i)=>{
    if(!modelBag.length)modelBag=shuffle(Object.keys(MODELS));
    if(!finishBag.length)finishBag=shuffle(FINISHES.slice());
    const model=modelBag.pop(),finish=finishBag.pop();
    const seed=new THREE.Vector3(Math.random()*90,Math.random()*90,Math.random()*90);
    const blade=dopplerMaterial(finish,seed),handle=handleMaterial(model);
    const group=new THREE.Group();
    group.add(new THREE.Mesh(geos[model].blade,blade),new THREE.Mesh(geos[model].handle,handle));
    group.scale.setScalar(small?240:430);
    scene.add(group);
    const tag=document.createElement('span');tag.className='vortex-3d-tag';tag.textContent='★ '+MODELS[model].label+' | '+finish.label;tag.style.setProperty('--glow',finish.glow);
    wrap.append(tag);
    return {group,materials:[blade,handle],tag,
      x:(i%2?1:-1)*(.17+Math.random()*.25),y:(Math.random()-.5)*.72,z0:i/count*2500+Math.random()*180,
      rot:(Math.random()-.5)*1.2,spin:(Math.random()-.5)*4.4,yaw:Math.random()*Math.PI*2,yawSpeed:(.35+Math.random()*.5)*(Math.random()<.5?-1:1),
      tilt:(Math.random()-.5)*.8,bob:Math.random()*Math.PI*2};
  });

  let state={p:0,e:0,mx:0,my:0},visible=true,raf=0,width=0,height=0,disposed=false;
  const v=new THREE.Vector3();
  function resize(){
    const r=host.getBoundingClientRect();width=r.width;height=r.height;
    renderer.setSize(width,height,false);
    camera.aspect=width/height;
    // Same projection as the CSS stage (perspective: 1100px) so both layers line up.
    camera.fov=2*Math.atan(height/2/1100)*180/Math.PI;camera.position.set(0,0,1100);camera.updateProjectionMatrix();
  }
  function frame(t){
    raf=0;if(disposed)return;
    const time=t/1000,{p,e,mx,my}=state;
    for(const k of knives){
      const z=((k.z0+p*3600)%2500+2500)%2500-1500;
      const fade=Math.min(smooth(-1500,-1050,z),1-smooth(620,940,z))*(1-e*.7);
      k.group.visible=fade>.01;
      k.group.position.set(k.x*width+mx*z*.06,-(k.y*height+my*z*.04)+Math.sin(time*.9+k.bob)*12,z);
      k.group.rotation.set(k.tilt+Math.sin(time*.6+k.bob)*.15,k.yaw+time*k.yawSpeed+p*5,k.rot+p*k.spin);
      for(const m of k.materials)m.opacity=fade;
      if(k.group.visible){
        v.copy(k.group.position);v.y-=(small?60:95);v.project(camera);
        k.tag.style.transform=`translate(${(v.x*.5+.5)*width}px,${(-v.y*.5+.5)*height}px) translate(-50%,0)`;
        k.tag.style.opacity=String(fade*Math.max(0,Math.min(1,(z+600)/900)));
      }else k.tag.style.opacity='0';
    }
    renderer.render(scene,camera);
    if(visible&&!document.hidden)raf=requestAnimationFrame(frame);
  }
  const kick=()=>{if(!raf&&visible&&!disposed)raf=requestAnimationFrame(frame);};
  const io=new IntersectionObserver(([en])=>{visible=en.isIntersecting;kick();});io.observe(host);
  const onResize=()=>{resize();kick();};
  addEventListener('resize',onResize);document.addEventListener('visibilitychange',kick);
  resize();kick();
  return {
    update(p,e,mx,my){state={p,e,mx,my};kick();},
    dispose(){disposed=true;io.disconnect();removeEventListener('resize',onResize);renderer.dispose();wrap.remove();}
  };
}
