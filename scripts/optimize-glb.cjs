#!/usr/bin/env node
/* Shrinks a knife GLB for the web without external tools:
   - KHR_mesh_quantization: positions int16, normals int8, UVs uint16 (all normalized);
     positions are dequantized by the mesh node's translation/scale, so the model looks the same.
   - EXT_texture_webp: textures re-encoded as WebP; non-colour maps capped at 512 px.
   Usage: node scripts/optimize-glb.cjs <in.glb> <out.glb> */
'use strict';
const fs=require('fs'),sharp=require('sharp');
const [inFile,outFile]=process.argv.slice(2);
if(!inFile||!outFile){console.error('Uso: node scripts/optimize-glb.cjs <entrada.glb> <saida.glb>');process.exit(1);}

const glb=fs.readFileSync(inFile);
if(glb.toString('latin1',0,4)!=='glTF')throw new Error('Não é um GLB');
const jsonLen=glb.readUInt32LE(12),json=JSON.parse(glb.toString('utf8',20,20+jsonLen));
const binStart=20+jsonLen+8,bin=glb.subarray(binStart,binStart+glb.readUInt32LE(20+jsonLen));
const COMP={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
const SIZE={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
function read(index){
  const a=json.accessors[index],v=json.bufferViews[a.bufferView],T=COMP[a.componentType],n=a.count*SIZE[a.type];
  if(v.byteStride&&v.byteStride!==T.BYTES_PER_ELEMENT*SIZE[a.type])throw new Error('Buffer intercalado não suportado');
  const off=bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0);
  return T.from(new T(bin.buffer.slice(off,off+n*T.BYTES_PER_ELEMENT)));
}

(async()=>{
  const chunks=[],views=[],accessors=[];let offset=0;
  const addView=(buf,target)=>{const pad=(4-buf.length%4)%4;views.push({buffer:0,byteOffset:offset,byteLength:buf.length,...(target?{target}:{})});chunks.push(buf,Buffer.alloc(pad));offset+=buf.length+pad;return views.length-1;};
  const addAccessor=(arr,componentType,type,extra={})=>{
    const view=addView(Buffer.from(arr.buffer,arr.byteOffset,arr.byteLength),componentType===5123&&type==='SCALAR'?34963:34962);
    accessors.push({bufferView:view,componentType,count:arr.length/SIZE[type],type,...extra});return accessors.length-1;
  };
  const meshNode=json.nodes.find(n=>n.mesh!==undefined);
  for(const mesh of json.meshes)for(const prim of mesh.primitives){
    const attrs={};
    const pos=read(prim.attributes.POSITION);
    let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<pos.length;i+=3)for(let k=0;k<3;k++){min[k]=Math.min(min[k],pos[i+k]);max[k]=Math.max(max[k],pos[i+k]);}
    const center=min.map((m,k)=>(m+max[k])/2),half=Math.max(...max.map((m,k)=>(m-min[k])/2))||1;
    const qp=new Int16Array(pos.length);
    for(let i=0;i<pos.length;i+=3)for(let k=0;k<3;k++)qp[i+k]=Math.round((pos[i+k]-center[k])/half*32767);
    attrs.POSITION=addAccessor(qp,5122,'VEC3',{normalized:true,min:[-32767,-32767,-32767],max:[32767,32767,32767]});
    if(prim.attributes.NORMAL!==undefined){
      const nr=read(prim.attributes.NORMAL),qn=new Int8Array(nr.length);
      for(let i=0;i<nr.length;i++)qn[i]=Math.round(Math.max(-1,Math.min(1,nr[i]))*127);
      attrs.NORMAL=addAccessor(qn,5120,'VEC3',{normalized:true});
    }
    if(prim.attributes.TEXCOORD_0!==undefined){
      const uv=read(prim.attributes.TEXCOORD_0);
      if(uv.some(x=>x<0||x>1))throw new Error('UV fora de 0..1: normalize antes de quantizar');
      const qu=new Uint16Array(uv.length);for(let i=0;i<uv.length;i++)qu[i]=Math.round(uv[i]*65535);
      attrs.TEXCOORD_0=addAccessor(qu,5123,'VEC2',{normalized:true});
    }
    const idx=read(prim.indices),qi=pos.length/3<65536?Uint16Array.from(idx):Uint32Array.from(idx);
    prim.indices=addAccessor(qi,qi instanceof Uint16Array?5123:5125,'SCALAR');
    prim.attributes=attrs;
    // Dequantize through the node transform (single-mesh knife files).
    if(meshNode){meshNode.translation=center;meshNode.scale=[half,half,half];delete meshNode.matrix;}
  }
  // Re-encode images as WebP; maps not used as base colour are capped at 512 px.
  const colorImages=new Set(json.materials.map(m=>m.pbrMetallicRoughness?.baseColorTexture?.index).filter(i=>i!==undefined).map(t=>json.textures[t].source));
  json.images=await Promise.all(json.images.map(async(img,i)=>{
    const v=json.bufferViews[img.bufferView];const src=bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);
    let pipe=sharp(src);if(!colorImages.has(i))pipe=pipe.resize({width:512,height:512,fit:'fill'});
    const webp=await pipe.webp({quality:colorImages.has(i)?84:80,effort:6}).toBuffer();
    return {bufferView:addView(webp),mimeType:'image/webp',name:img.name};
  }));
  json.textures=json.textures.map(t=>({sampler:t.sampler,extensions:{EXT_texture_webp:{source:t.source}}}));
  json.accessors=accessors;json.bufferViews=views;json.buffers=[{byteLength:offset}];
  json.extensionsUsed=[...new Set([...(json.extensionsUsed||[]),'KHR_mesh_quantization','EXT_texture_webp'])];
  json.extensionsRequired=[...new Set([...(json.extensionsRequired||[]),'KHR_mesh_quantization','EXT_texture_webp'])];
  const jsonBuf=Buffer.from(JSON.stringify(json));const jpad=Buffer.alloc((4-jsonBuf.length%4)%4,32);
  const binBuf=Buffer.concat(chunks);
  const header=Buffer.alloc(12);header.write('glTF',0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+jsonBuf.length+jpad.length+8+binBuf.length,8);
  const jh=Buffer.alloc(8);jh.writeUInt32LE(jsonBuf.length+jpad.length,0);jh.write('JSON',4);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(binBuf.length,0);bh.write('BIN\0',4,'latin1');
  const out=Buffer.concat([header,jh,jsonBuf,jpad,bh,binBuf]);
  fs.writeFileSync(outFile,out);
  console.log(`${inFile} ${(glb.length/1024).toFixed(0)} KB -> ${outFile} ${(out.length/1024).toFixed(0)} KB`);
})().catch(e=>{console.error(e.message);process.exit(1);});
