import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySemitone } from '../src/semitone.js';
import { tracePalette } from '../src/vector-core.js';

test('semitone keeps RGB and turns the garment colour into fully transparent pixels', () => {
  const pixels = Uint8ClampedArray.from({ length: 32 * 32 * 4 }, (_, i) => i % 4 === 3 ? 255 : 0);
  pixels.set([255, 255, 255, 255], 32);
  applySemitone(pixels, 32, 32, { frequency: 32, angle: 45, garment: '#000000' }, () => {});
  assert.deepEqual([...pixels.slice(32, 36)], [255, 255, 255, 255]);
  assert.equal(pixels[3], 0);
  assert.ok(pixels.every((value, i) => i % 4 !== 3 || value === 0 || value === 255));
});

test('colour vectorization produces editable colour layers and ignores transparent RGB', () => {
  const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 0, 0, 0, 255, 255]);
  const result = tracePalette(pixels, 3, 1, { colors: 4, outputWidth: 3, outputHeight: 1 });
  assert.equal(result.colors, 2);
  assert.match(result.svg, /fill="#ff0000"/);
  assert.match(result.svg, /fill="#0000ff"/);
  assert.doesNotMatch(result.svg, /#00ff00|<image/i);
});

test('manual DTF positions preserve the pixel size and reject collisions', async () => {
  const { packDtf, cmToPixels } = await import('../src/dtf-core.js');
  const items = [
    { id: 'a', width: 600, height: 520 },
    { id: 'b', width: 460, height: 600 },
  ];
  const position = { x: cmToPixels(10), y: cmToPixels(10) };
  const layout = packDtf(items, { positions: { 'a:0': position } });
  const a = layout.placements.find(piece => piece.id === 'a');
  assert.deepEqual([a.x, a.y, a.width, a.height], [position.x, position.y, 600, 520]);
  assert.throws(() => packDtf(items, { positions: { 'a:0': position, 'b:0': position } }), /enciman/);
  assert.throws(() => packDtf(items, { positions: { 'a:0': {x: -10, y: 10} } }), /fuera/);
});
