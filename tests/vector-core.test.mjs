import test from 'node:test';
import assert from 'node:assert/strict';
import { traceMask } from '../src/vector-core.js';
function raster(rows){return new Uint8ClampedArray(rows.flatMap(row=>[...row].flatMap(c=>c==='1'?[0,0,0,255]:[255,255,255,255])));}
test('Solid silhouette is a single editable path, without embedded raster',()=>{
  const r=traceMask(raster(['11','11']),2,2);
  assert.equal(r.contours,1);assert.equal(r.selected,4);assert.match(r.svg,/M0 0L2 0L2 2L0 2Z/);assert.doesNotMatch(r.svg,/<image|base64/);
});
test('Holes are retained with evenodd and diagonal components remain distinct',()=>{
  assert.equal(traceMask(raster(['111','101','111']),3,3).contours,2);
  assert.equal(traceMask(raster(['10','01']),2,2).contours,2);
});
test('Transparent regions never become selected and output physical size is preserved',()=>{
  const data=raster(['11']);data[3]=0;
  const r=traceMask(data,2,1,{outputWidth:300,outputHeight:150});
  assert.equal(r.selected,1);assert.match(r.svg,/width="25.4000mm" height="12.7000mm"/);
  assert.throws(()=>traceMask(data,2,1,{color:'bad'}));
});
