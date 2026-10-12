import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { packDtf, encodeDtfPng, cmToPixels } from '../src/dtf-core.js';
import { pngChunks, readPngDpi, crc32 } from '../src/image-core.js';
import { decodePngExact } from '../src/png-decode.js';
import { zipFiles } from '../src/downloads.js';

test('88 cm roll preserves all source dimensions and enforces at least 1 mm gaps',()=>{
  const items=[{id:'a',width:3000,height:4000,copies:3},{id:'b',width:2500,height:1200,copies:2},{id:'c',width:1000,height:2000}];
  const sheet=packDtf(items,{widthCm:88,gapMm:1,marginMm:1});
  assert.equal(sheet.width,10394);assert.equal(sheet.pieces,6);assert.equal(sheet.gap,12);
  for(const p of sheet.placements){const original=items.find(i=>i.id===p.id);assert.equal(p.width,original.width);assert.equal(p.height,original.height);assert.ok(p.x>=sheet.margin&&p.y>=sheet.margin);assert.ok(p.x+p.width<=sheet.width-sheet.margin);assert.ok(p.y+p.height<=sheet.height-sheet.margin);}
  for(let i=0;i<sheet.placements.length;i++)for(let j=i+1;j<sheet.placements.length;j++){
    const a=sheet.placements[i],b=sheet.placements[j];
    assert.ok(a.x+a.width+sheet.gap<=b.x||b.x+b.width+sheet.gap<=a.x||a.y+a.height+sheet.gap<=b.y||b.y+b.height+sheet.gap<=a.y);
  }
});
test('Packing is deterministic and rejects designs that do not fit without scaling',()=>{
  const items=[{id:'x',width:cmToPixels(30),height:cmToPixels(20),copies:2}];
  assert.deepEqual(packDtf(items),packDtf(items));
  assert.throws(()=>packDtf([{width:11000,height:10,name:'Too wide'}]),/no cabe/);
  assert.throws(()=>packDtf(items,{maxHeightCm:1}),/supera el largo/);
  assert.throws(()=>packDtf(items,{gapMm:0}));assert.throws(()=>packDtf([]));
});
test('Streamed PNG preserves every RGBA byte, transparency, source sizes and 300 DPI',async()=>{
  const pixels=new Uint8ClampedArray([20,30,40,255,90,100,110,128,7,8,9,0,200,210,220,255]);
  const layout=packDtf([{id:'a',width:2,height:2,copies:2}],{widthCm:1,gapMm:1,marginMm:0});
  const blob=await encodeDtfPng(layout,new Map([['a',pixels]]));
  const bytes=new Uint8Array(await blob.arrayBuffer()),chunks=pngChunks(bytes);
  assert.ok(Math.abs(readPngDpi(bytes).x-300)<.01);
  for(const c of chunks)assert.equal(crc32(c.bytes.subarray(4,c.bytes.length-4)),new DataView(c.bytes.buffer,c.bytes.byteOffset+c.bytes.length-4,4).getUint32(0));
  const raw=inflateSync(Buffer.concat(chunks.filter(c=>c.type==='IDAT').map(c=>c.data)));
  for(const p of layout.placements)for(let y=0;y<2;y++)assert.deepEqual([...raw.subarray((p.y+y)*(1+layout.width*4)+1+p.x*4,(p.y+y)*(1+layout.width*4)+1+(p.x+2)*4)],[...pixels.subarray(y*8,y*8+8)]);
  const decoded=await decodePngExact(bytes);assert.equal(decoded.width,layout.width);assert.equal(decoded.height,layout.height);
  assert.equal(decoded.data[(layout.width-1)*4+3],0);
});
test('ZIP includes exact file bytes with unique filenames and valid CRC',async()=>{
  const files=[{name:'01-logo.png',blob:new Blob(['original PNG bytes'])},{name:'02-logo.svg',blob:new Blob(['<svg/>'])}];
  const bytes=new Uint8Array(await (await zipFiles(files)).arrayBuffer()),view=new DataView(bytes.buffer);let offset=0;
  for(const file of files){assert.equal(view.getUint32(offset,true),0x04034b50);const length=view.getUint32(offset+18,true),nameLength=view.getUint16(offset+26,true),content=bytes.subarray(offset+30+nameLength,offset+30+nameLength+length);assert.equal(new TextDecoder().decode(bytes.subarray(offset+30,offset+30+nameLength)),file.name);assert.deepEqual(content,new Uint8Array(await file.blob.arrayBuffer()));assert.equal(view.getUint32(offset+14,true),crc32(content));offset+=30+nameLength+length;}
});
