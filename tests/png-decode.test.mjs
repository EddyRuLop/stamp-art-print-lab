import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { randomFillSync } from 'node:crypto';
import { MAX_BYTES, packChunk, inspectHeader } from '../src/image-core.js';
import { decodePngExact } from '../src/png-decode.js';
function png(type,width,height,raw,extra=[]){const h=new Uint8Array(13),v=new DataView(h.buffer);v.setUint32(0,width);v.setUint32(4,height);h[8]=8;h[9]=type;return new Uint8Array(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),packChunk('IHDR',h),...extra,packChunk('IDAT',deflateSync(raw)),packChunk('IEND',new Uint8Array())]));}
test('Exact PNG decoder reverses all five filters including alpha and hidden RGB',async()=>{
  const width=3,height=5,bpp=4,stride=width*bpp;const source=Uint8Array.from({length:stride*height},(_,i)=>(i*53+11)%256);const raw=new Uint8Array(height*(stride+1));
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){raw[y*(stride+1)]=y;for(let x=0;x<stride;x++){const a=x>=bpp?source[y*stride+x-bpp]:0,b=y?source[(y-1)*stride+x]:0,c=y&&x>=bpp?source[(y-1)*stride+x-bpp]:0;const predict=y===0?0:y===1?a:y===2?b:y===3?Math.floor((a+b)/2):paeth(a,b,c);raw[y*(stride+1)+1+x]=(source[y*stride+x]-predict)&255;}}
  assert.deepEqual([...((await decodePngExact(png(6,width,height,raw))).data)],[...source]);
});
test('Exact decoder supports palettes, grayscale and RGB transparent keys',async()=>{
  const palette=packChunk('PLTE',new Uint8Array([11,22,33,44,55,66])),alpha=packChunk('tRNS',new Uint8Array([0,128]));
  assert.deepEqual([...(await decodePngExact(png(3,2,1,new Uint8Array([0,0,1]),[palette,alpha]))).data],[11,22,33,0,44,55,66,128]);
  assert.deepEqual([...(await decodePngExact(png(4,1,1,new Uint8Array([0,75,150])))).data],[75,75,75,150]);
  const key=packChunk('tRNS',new Uint8Array([0,1,0,2,0,3]));
  assert.deepEqual([...(await decodePngExact(png(2,1,1,new Uint8Array([0,1,2,3]),[key]))).data],[1,2,3,0]);
});

test('A real PNG larger than 25 MB is accepted by the new limit and decoded without loss',async()=>{
  const width=3000,height=3000,stride=width*4,raw=randomFillSync(new Uint8Array(height*(stride+1)));
  for(let y=0;y<height;y++)raw[y*(stride+1)]=0;
  const bytes=png(6,width,height,raw);
  assert.ok(bytes.length>25*1024*1024);assert.ok(bytes.length<MAX_BYTES);
  assert.equal(inspectHeader(bytes).width,width);
  const decoded=await decodePngExact(bytes);
  for(let y=0;y<height;y++)assert.equal(Buffer.compare(Buffer.from(decoded.data.buffer,y*stride,stride),Buffer.from(raw.buffer,y*(stride+1)+1,stride)),0);
});
