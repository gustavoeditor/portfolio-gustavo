#!/usr/bin/env node
/* Converts knife .obj files into a compact binary (.gkm) for the homepage vortex.
   Each model is centred, its long axis aligned to +X (blade towards +X), scaled to
   length 1 and split into "blade" and "handle" parts at a per-model cut along X.
   Usage: node scripts/build-knife-models.cjs <config.json> <outDir>   (or --analyze <file.obj> <png>) */
'use strict';
const fs=require('fs'),path=require('path');

function parseOBJ(text){
  const v=[],vn=[],tris=[];
  for(const line of text.split(/\r?\n/)){
    const p=line.trim().split(/\s+/);
    if(p[0]==='v')v.push([+p[1],+p[2],+p[3]]);
    else if(p[0]==='vn')vn.push([+p[1],+p[2],+p[3]]);
    else if(p[0]==='f'){
      const idx=p.slice(1).map(s=>{const [a,,c]=s.split('/');return [(+a>0?+a-1:v.length+ +a),c?(+c>0?+c-1:vn.length+ +c):-1];});
      for(let i=1;i+1<idx.length;i++)tris.push([idx[0],idx[i],idx[i+1]]);
    }
  }
  return {v,vn,tris};
}
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(...a)||1;return [a[0]/l,a[1]/l,a[2]/l];};
// Principal axes by power iteration on the covariance matrix.
function frame(points){
  const c=[0,0,0];for(const p of points){c[0]+=p[0];c[1]+=p[1];c[2]+=p[2];}c.forEach((_,i)=>c[i]/=points.length);
  const C=[[0,0,0],[0,0,0],[0,0,0]];
  for(const p of points){const d=sub(p,c);for(let i=0;i<3;i++)for(let j=0;j<3;j++)C[i][j]+=d[i]*d[j];}
  const mul=(M,x)=>[dot(M[0],x),dot(M[1],x),dot(M[2],x)];
  let a=[1,.3,.2];for(let i=0;i<80;i++)a=norm(mul(C,a));
  const lam=dot(a,mul(C,a));const C2=C.map((r,i)=>r.map((x,j)=>x-lam*a[i]*a[j]));
  let b=norm(cross(a,[0,0,1]));if(!isFinite(b[0])||Math.hypot(...cross(a,[0,0,1]))<.1)b=norm(cross(a,[0,1,0]));
  for(let i=0;i<80;i++){b=mul(C2,b);b=norm(sub(b,a.map(x=>x*dot(a,b))));}
  return {c,a,b,n:norm(cross(a,b))};
}
function transform(model,flip){
  const f=frame(model.v);
  const s=flip?-1:1;
  const map=p=>{const d=sub(p,f.c);return [s*dot(d,f.a),dot(d,f.b),s*dot(d,f.n)];};
  const mapN=p=>[s*dot(p,f.a),dot(p,f.b),s*dot(p,f.n)];
  let v=model.v.map(map);
  const xs=v.map(p=>p[0]),min=Math.min(...xs),max=Math.max(...xs),len=max-min,mid=(min+max)/2;
  v=v.map(p=>[(p[0]-mid)/len,p[1]/len,p[2]/len]);
  return {v,vn:model.vn.map(n=>norm(mapN(n))),tris:model.tris};
}
function analyze(file,png){
  const m=transform(parseOBJ(fs.readFileSync(file,'utf8')),false);
  const bins=40,prof=Array.from({length:bins},()=>[1e9,-1e9]);
  for(const p of m.v){const i=Math.min(bins-1,Math.floor((p[0]+.5)*bins));prof[i][0]=Math.min(prof[i][0],p[1]);prof[i][1]=Math.max(prof[i][1],p[1]);}
  console.log(path.basename(file),'verts',m.v.length,'tris',m.tris.length,'normals',m.vn.length);
  console.log(prof.map((r,i)=>((i/bins-.5).toFixed(3)).padStart(6)+' '+'#'.repeat(Math.max(0,Math.round((r[1]-r[0])*200)))).join('\n'));
  if(png){
    const sharp=require('sharp');const W=1000,H=360,buf=Buffer.alloc(W*H*3,12);
    for(const p of m.v){const x=Math.round((p[0]+.5)*(W-1)),y=Math.round(H/2-p[1]*(W-1));if(x>=0&&x<W&&y>=0&&y<H){const o=(y*W+x)*3;buf[o]=230;buf[o+1]=210;buf[o+2]=255;}}
    for(let x=0;x<W;x+=100)for(let y=0;y<H;y++){const o=(y*W+x)*3;buf[o]=90;}
    return sharp(buf,{raw:{width:W,height:H,channels:3}}).png().toFile(png);
  }
}
function quant(x){return Math.max(-32767,Math.min(32767,Math.round(x*2*32767)));}
function build(cfg,outDir){
  for(const item of cfg){
    const m=transform(parseOBJ(fs.readFileSync(item.obj,'utf8')),item.flip);
    const parts={blade:[],handle:[]};
    for(const t of m.tris){
      const cx=(m.v[t[0][0]][0]+m.v[t[1][0]][0]+m.v[t[2][0]][0])/3;
      parts[cx>=item.cut?'blade':'handle'].push(t);
    }
    const header={version:1,name:item.name,parts:[]},chunks=[];
    let offset=0;
    for(const [name,tris] of Object.entries(parts)){
      const keyMap=new Map(),pos=[],nor=[],idx=[];
      for(const t of tris)for(const [vi,ni] of t){
        const key=vi+'/'+ni;let k=keyMap.get(key);
        if(k===undefined){k=keyMap.size;keyMap.set(key,k);pos.push(...m.v[vi].map(quant));const n=ni>=0?m.vn[ni]:[0,0,1];nor.push(...n.map(x=>Math.round(x*127)));}
        idx.push(k);
      }
      const P=Int16Array.from(pos),N=Int8Array.from(nor),I=keyMap.size>65535?Uint32Array.from(idx):Uint16Array.from(idx);
      const pad=b=>{const r=(4-b.length%4)%4;return r?Buffer.concat([b,Buffer.alloc(r)]):b;};
      const bp=pad(Buffer.from(P.buffer)),bn=pad(Buffer.from(N.buffer)),bi=pad(Buffer.from(I.buffer));
      header.parts.push({name,vertices:keyMap.size,indices:idx.length,index32:I instanceof Uint32Array,position:offset,normal:offset+bp.length,index:offset+bp.length+bn.length});
      offset+=bp.length+bn.length+bi.length;chunks.push(bp,bn,bi);
    }
    const head=Buffer.from(JSON.stringify(header));const headPad=Buffer.concat([head,Buffer.alloc((4-(head.length+8)%4)%4,32)]);
    const pre=Buffer.alloc(8);pre.write('GKM1',0);pre.writeUInt32LE(headPad.length,4);
    const out=Buffer.concat([pre,headPad,...chunks]);
    fs.writeFileSync(path.join(outDir,item.name+'.gkm'),out);
    console.log(item.name,(out.length/1024).toFixed(1)+' KB',header.parts.map(p=>p.name+':'+p.indices/3+' tris').join(' '));
  }
}
const args=process.argv.slice(2);
if(args[0]==='--analyze')analyze(args[1],args[2]);
else build(JSON.parse(fs.readFileSync(args[0],'utf8')),args[1]);
