import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync, inflateSync } from 'node:zlib';
import { crc32, packChunk, pngChunks, setPngDpi, readPngDpi, dimensionsForPrint, alphaStats, cleanAlpha, sharpenRgba, inspectHeader } from '../src/image-core.js';

function fixture({ width = 2, height = 2, alpha = [0, 127, 128, 255], extra = [] } = {}) {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width); view.setUint32(4, height); header[8] = 8; header[9] = 6;
  const raw = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = y * (width * 4 + 1) + 1 + x * 4;
      raw.set([75, 160, 240, alpha[y * width + x] ?? 255], offset);
    }
  }
  const blocks = [new Uint8Array([137,80,78,71,13,10,26,10]), packChunk('IHDR', header), ...extra, packChunk('IDAT', deflateSync(raw)), packChunk('IEND', new Uint8Array())];
  return new Uint8Array(Buffer.concat(blocks));
}

test('PNG density is 300 DPI with a valid CRC and unchanged pixel data', () => {
  const input = fixture();
  const output = setPngDpi(input);
  const chunks = pngChunks(output);
  assert.equal(chunks[1].type, 'pHYs');
  assert.ok(Math.abs(readPngDpi(output).x - 300) < .001);
  assert.ok(Math.abs(readPngDpi(output).y - 300) < .001);
  for (const chunk of chunks) {
    const expected = new DataView(chunk.bytes.buffer, chunk.bytes.byteOffset + chunk.bytes.length - 4, 4).getUint32(0);
    assert.equal(crc32(chunk.bytes.subarray(4, chunk.bytes.length - 4)), expected);
  }
  assert.deepEqual(chunks.find(c => c.type === 'IDAT').bytes, pngChunks(input).find(c => c.type === 'IDAT').bytes);
  const pixels = inflateSync(chunks.find(c => c.type === 'IDAT').data);
  assert.deepEqual([...pixels], [0,75,160,240,0,75,160,240,127,0,75,160,240,128,75,160,240,255]);
});

test('Replacing density removes duplicates while keeping color and text chunks', () => {
  const density = new Uint8Array(9); const d = new DataView(density.buffer); d.setUint32(0, 3780); d.setUint32(4,3780); density[8] = 1;
  const text = packChunk('tEXt', new TextEncoder().encode('Author\0Example'));
  const profile = packChunk('iCCP', new Uint8Array([80,114,111,102,105,108,101,0,0,...deflateSync(Buffer.from('test-profile'))]));
  const original = fixture({ extra: [packChunk('pHYs',density), text, profile, packChunk('pHYs',density)] });
  const out = pngChunks(setPngDpi(original));
  assert.equal(out.filter(c => c.type === 'pHYs').length, 1);
  assert.deepEqual(out.find(c => c.type === 'iCCP').bytes, profile);
  assert.deepEqual(out.find(c => c.type === 'tEXt').bytes, text);
});

test('Threshold retains opaque pixels and makes alpha strictly binary without changing RGB', () => {
  const data = new Uint8ClampedArray([11,22,33,0, 44,55,66,127, 77,88,99,128, 111,122,133,255]);
  const original = data.slice(); cleanAlpha(data, 'threshold', 128);
  assert.deepEqual([data[3],data[7],data[11],data[15]], [0,0,255,255]);
  for(let i=0;i<data.length;i++) if(i%4!==3) assert.equal(data[i], original[i]);
  assert.equal(alphaStats(data).semi, 0);
});

test('Visible mode preserves transparent background and keeps faint visible pixels', () => {
  const data = new Uint8ClampedArray([0,0,0,0, 80,90,100,1, 80,90,100,127, 80,90,100,255]);
  cleanAlpha(data, 'visible');
  assert.deepEqual([data[3],data[7],data[11],data[15]], [0,255,255,255]);
  assert.equal(alphaStats(data).semi,0);
});

test('Keep mode is byte-identical and invalid thresholds are rejected', () => {
  const data = new Uint8ClampedArray([40,60,90,91]); const original=data.slice();
  cleanAlpha(data,'keep');assert.deepEqual(data,original);
  assert.throws(()=>cleanAlpha(data,'threshold',0));
  assert.throws(()=>cleanAlpha(data,'unsupported'));
});

test('Sharpening cannot pull RGB from a transparent neighbour or modify alpha', () => {
  const data = new Uint8ClampedArray([0,0,0,0, 255,0,0,130, 255,0,0,255]);
  const original=data.slice(); sharpenRgba(data,3,1,1);
  assert.deepEqual(data,original);
});

test('Unsharp mask increases an existing local contrast without inventing alpha', () => {
  const data = new Uint8ClampedArray([50,50,50,255, 150,150,150,255, 50,50,50,255]);
  sharpenRgba(data,3,1,.5);
  assert.ok(data[4]>150); assert.ok(data[0]<50);
  assert.deepEqual([data[3],data[7],data[11]],[255,255,255]);
});

test('Thirty centimetres maps to 3543 pixels and preserves aspect ratio by rounding', () => {
  const result=dimensionsForPrint(3000,2800,'print',30);
  assert.equal(result.width,3543);assert.equal(result.height,3307);
  assert.ok(Math.abs(result.height/result.width-2800/3000)<1/3543);
  assert.deepEqual(dimensionsForPrint(3000,2800,'pixels',10).width,3000);
});

test('Pixel and memory limits apply to enlarged outputs and invalid sizes', () => {
  assert.throws(()=>dimensionsForPrint(900,1050,'print',200),/20 megapíxeles/);
  for (const width of [0,-1,NaN,Infinity]) assert.throws(()=>dimensionsForPrint(900,1050,'print',width));
  assert.throws(()=>dimensionsForPrint(100,100,'stretch',30));
});

test('Header analysis reads dimensions and rejects malformed PNG and animations', () => {
  const img=fixture(); const info=inspectHeader(img);assert.equal(info.type,'PNG');assert.equal(info.width,2);assert.equal(info.height,2);
  assert.throws(()=>inspectHeader(img.subarray(0,20)));
  assert.throws(()=>inspectHeader(fixture({extra:[packChunk('acTL',new Uint8Array(8))]})),/animaciones/);
  const sixteen=img.slice();sixteen[24]=16;assert.throws(()=>inspectHeader(sixteen),/16 bits/);
});

test('CRC matches the standard test vector',()=>assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926));
