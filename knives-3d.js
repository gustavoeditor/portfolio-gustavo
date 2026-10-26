/* GUSTAVO 3D knives for the homepage vortex (ES module, loaded on demand).
   Textured knife models (/knives/models/*.glb, exported from the editor's FBX in Blender)
   rendered with their own authored material, lit by environment reflections and rim lights. */
import * as THREE from './vendor/three/three.module.min.js';
import {RoomEnvironment} from './vendor/three/RoomEnvironment.js';
import {GLTFLoader} from './vendor/three/GLTFLoader.js';

const KNIVES=[
  {file:'butterfly-emerald',label:'★ Butterfly Knife | Gamma Doppler Emerald',glow:'#2fe08a'}
];

// Centre the mesh, lay its long axis on X and scale it to length 1.
async function loadKnife(def,maxAnisotropy){
  const gltf=await new GLTFLoader().loadAsync('/knives/models/'+def.file+'.glb');
  let mesh=null;gltf.scene.traverse(o=>{if(o.isMesh&&!mesh)mesh=o;});
  if(!mesh)throw new Error('Modelo sem malha: '+def.file);
  // Models ship quantized (KHR_mesh_quantization); expand to float before re-centring and scaling.
  const geometry=new THREE.BufferGeometry();
  for(const [name,attr] of Object.entries(mesh.geometry.attributes)){
    const out=new Float32Array(attr.count*attr.itemSize);
    for(let i=0;i<attr.count;i++)for(let k=0;k<attr.itemSize;k++)out[i*attr.itemSize+k]=attr.getComponent(i,k);
    geometry.setAttribute(name,new THREE.BufferAttribute(out,attr.itemSize));
  }
  geometry.setIndex(mesh.geometry.index);
  geometry.computeBoundingBox();
  const box=geometry.boundingBox,size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  geometry.translate(-center.x,-center.y,-center.z);
  const long=Math.max(size.x,size.y,size.z);
  if(long===size.z)geometry.rotateY(Math.PI/2);else if(long===size.y)geometry.rotateZ(-Math.PI/2);
  geometry.scale(1/long,1/long,1/long);
  geometry.computeBoundingSphere();
  // Use the model's own material exactly as authored; only enable fading.
  const material=mesh.material;
  if(material.map)material.map.anisotropy=maxAnisotropy;
  material.transparent=true;
  return {def,geometry,material};
}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

export async function mount(host,{small=false}={}){
  const probe=document.createElement('canvas');
  if(!(probe.getContext('webgl2')||probe.getContext('webgl')))return null;

  // Pixel ratio capped: the canvas covers the whole screen, so resolution is the main GPU cost.
  const dpr=Math.min(devicePixelRatio||1,small?1:1.25);
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:dpr<1.5,powerPreference:'high-performance'});
  const models=await Promise.all(KNIVES.map(def=>loadKnife(def,renderer.capabilities.getMaxAnisotropy())));
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const wrap=document.createElement('div');wrap.className='vortex-3d';wrap.setAttribute('aria-hidden','true');
  wrap.append(renderer.domElement);host.append(wrap);

  const scene=new THREE.Scene();
  scene.environment=new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(),.04).texture;
  scene.fog=new THREE.Fog(0x0a0814,900,2600);
  const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(300,500,900);scene.add(key);
  const rimA=new THREE.PointLight(0xa070ff,1.6e6,0,2);rimA.position.set(-700,300,200);scene.add(rimA);
  const rimB=new THREE.PointLight(0x40e0ff,1.0e6,0,2);rimB.position.set(700,-300,300);scene.add(rimB);
  const camera=new THREE.PerspectiveCamera(50,1,1,6000);

  const count=small?3:5;
  const knives=Array.from({length:count},(_,i)=>{
    const model=models[i%models.length],material=model.material.clone();
    const mesh=new THREE.Mesh(model.geometry,material);
    mesh.scale.setScalar(small?190:340);
    scene.add(mesh);
    return {mesh,material,
      x:(i%2?1:-1)*(.17+Math.random()*.25),y:(Math.random()-.5)*.72,z0:i/count*2500+Math.random()*180,
      rot:(Math.random()-.5)*1.2,spin:(Math.random()-.5)*4.4,yaw:Math.random()*Math.PI*2,yawSpeed:(.35+Math.random()*.5)*(Math.random()<.5?-1:1),
      tilt:(Math.random()-.5)*.8,bob:Math.random()*Math.PI*2};
  });

  let state={p:0,e:0,mx:0,my:0},visible=true,raf=0,width=0,height=0,disposed=false,dirty=true,lastDraw=0;
  // Idle floating renders at ~30 fps; scrolling or resizing draws on the next frame.
  const IDLE_MS=1000/30;
  function resize(){
    const r=host.getBoundingClientRect();width=r.width;height=r.height;
    renderer.setSize(width,height,false);
    camera.aspect=width/height;
    // Same projection as the CSS stage (perspective: 1100px) so both layers line up.
    camera.fov=2*Math.atan(height/2/1100)*180/Math.PI;camera.position.set(0,0,1100);camera.updateProjectionMatrix();
  }
  function frame(t){
    raf=0;if(disposed)return;
    if(!dirty&&t-lastDraw<IDLE_MS){if(visible&&!document.hidden)raf=requestAnimationFrame(frame);return;}
    dirty=false;lastDraw=t;
    const time=t/1000,{p,e,mx,my}=state;
    for(const k of knives){
      const z=((k.z0+p*3600)%2500+2500)%2500-1500;
      const fade=Math.min(smooth(-1500,-1050,z),1-smooth(620,940,z))*(1-e*.7);
      k.mesh.visible=fade>.01;
      k.mesh.position.set(k.x*width+mx*z*.06,-(k.y*height+my*z*.04)+Math.sin(time*.9+k.bob)*12,z);
      k.mesh.rotation.set(k.tilt+Math.sin(time*.6+k.bob)*.15,k.yaw+time*k.yawSpeed+p*5,k.rot+p*k.spin);
      k.material.opacity=fade;
    }
    renderer.render(scene,camera);
    if(visible&&!document.hidden)raf=requestAnimationFrame(frame);
  }
  const kick=()=>{if(!raf&&visible&&!disposed)raf=requestAnimationFrame(frame);};
  const io=new IntersectionObserver(([en])=>{visible=en.isIntersecting;kick();});io.observe(host);
  const onResize=()=>{resize();dirty=true;kick();};
  addEventListener('resize',onResize);document.addEventListener('visibilitychange',kick);
  resize();
  // Compile shaders off the critical path (parallel compile where supported) before the first draw.
  try{await renderer.compileAsync(scene,camera);}catch(_){/* Falls back to compiling on first render. */}
  // Upload textures to the GPU now, not during the first frame the visitor scrolls into.
  for(const m of models)for(const key of ['map','normalMap','roughnessMap','metalnessMap'])if(m.material[key])renderer.initTexture(m.material[key]);
  kick();
  return {
    update(p,e,mx,my){state={p,e,mx,my};dirty=true;kick();},
    dispose(){disposed=true;io.disconnect();removeEventListener('resize',onResize);renderer.dispose();wrap.remove();}
  };
}
