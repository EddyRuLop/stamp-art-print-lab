import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { decodePngExact } from '../src/png-decode.js';
import { packDtf, encodeDtfPng } from '../src/dtf-core.js';
import { readPngDpi } from '../src/image-core.js';

// Read-only validation of input artwork. No customer files are committed or modified.
const inputs=process.argv.slice(2);if(!inputs.length)throw new Error('Provide PNG paths as arguments.');
const sources=new Map(),items=[];
for(const [i,file] of inputs.entries()){
  const source=await decodePngExact(new Uint8Array(await fs.readFile(file)));
  assert.ok(source,'This check requires non-interlaced 8-bit PNG.');
  const id=String(i);sources.set(id,source.data);items.push({id,name:path.basename(file),width:source.width,height:source.height});
}
const layout=packDtf(items,{widthCm:88,gapMm:1,marginMm:1});
const output=await encodeDtfPng(layout,sources),bytes=new Uint8Array(await output.arrayBuffer());
assert.ok(Math.abs(readPngDpi(bytes).x-300)<.01);
const decoded=await decodePngExact(bytes);
for(const p of layout.placements){
  const original=sources.get(p.id);
  for(let y=0;y<p.height;y++){
    const start=((p.y+y)*layout.width+p.x)*4;
    assert.deepEqual(decoded.data.subarray(start,start+p.width*4),original.subarray(y*p.width*4,(y+1)*p.width*4));
  }
}
console.log(JSON.stringify({files:inputs.length,pieces:layout.pieces,width:layout.width,height:layout.height,widthCm:layout.widthCm,heightCm:layout.heightCm,gapPixels:layout.gap,pngMB:output.size/1048576,rgbaExact:true,dpi:readPngDpi(bytes).x}));
