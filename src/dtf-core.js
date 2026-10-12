import { DPI, packChunk } from './image-core.js';

export const DTF_MAX_SOURCE_PIXELS = 100_000_000;
export const DTF_MAX_OUTPUT_PIXELS = 500_000_000;
export const cmToPixels = cm => Math.round(cm / 2.54 * DPI);
export const pixelsToCm = pixels => pixels / DPI * 2.54;

/** Lowest skyline placement. No resizing or rotation; two orders compete for shortest sheet. */
export function packDtf(items, { widthCm = 88, gapMm = 1, marginMm = 1, maxHeightCm = 0 } = {}) {
  if (!Number.isFinite(widthCm) || widthCm < 1 || widthCm > 200) throw new Error('El ancho debe estar entre 1 y 200 cm.');
  if (!Number.isFinite(gapMm) || gapMm < 1 || gapMm > 20 || !Number.isFinite(marginMm) || marginMm < 0 || marginMm > 50) throw new Error('Usa separación de 1 a 20 mm y margen de 0 a 50 mm.');
  if (!Number.isFinite(maxHeightCm) || maxHeightCm < 0 || maxHeightCm > 5000) throw new Error('El largo máximo no es válido.');
  const width = cmToPixels(widthCm), gap = Math.ceil(gapMm / 25.4 * DPI), margin = Math.ceil(marginMm / 25.4 * DPI);
  const innerWidth = width - 2 * margin;
  const expanded = [];
  if (!items.length) throw new Error('Carga al menos un diseño.');
  for (const item of items) {
    const copies = item.copies ?? 1;
    if (!Number.isInteger(item.width) || !Number.isInteger(item.height) || item.width < 1 || item.height < 1 || !Number.isInteger(copies) || copies < 1 || copies > 100) throw new Error('Las dimensiones o cantidades de un diseño no son válidas.');
    if (item.width > innerWidth) throw new Error(`${item.name || 'Un diseño'} mide ${pixelsToCm(item.width).toFixed(2)} cm de ancho y no cabe. Su tamaño se conserva: reduce el diseño por separado o aumenta el ancho.`);
    for(let copy=0;copy<copies;copy++) expanded.push({ ...item, copy });
  }
  if (expanded.length > 300) throw new Error('Usa hasta 300 piezas por plantilla.');
  function place(sorted) {
    // Extra gap at the right is virtual, so the last design need not fit an outside gap.
    const skyline = new Int32Array(innerWidth + gap);
    const placements = [];
    let height = 0;
    for (const item of sorted) {
      const footprint = item.width + gap;
      let bestX=0, bestY=Infinity;
      const deque = new Int32Array(skyline.length); let head=0,tail=0;
      for(let x=0;x<skyline.length;x++) {
        while(tail>head && skyline[deque[tail-1]]<=skyline[x]) tail--;
        deque[tail++]=x;
        while(tail>head && deque[head]<=x-footprint) head++;
        if(x>=footprint-1) {
          const start=x-footprint+1;
          const y=skyline[deque[head]];
          if(start<=innerWidth-item.width && y<bestY) {bestX=start;bestY=y;}
        }
      }
      for(let x=bestX;x<bestX+footprint;x++) skyline[x]=bestY+item.height+gap;
      placements.push({ ...item, x:bestX+margin, y:bestY+margin });
      height=Math.max(height,bestY+item.height);
    }
    return { placements, height:height+2*margin };
  }
  const a=place(expanded.slice().sort((a,b)=>b.height-a.height || b.width-a.width));
  const b=place(expanded.slice().sort((a,b)=>b.width*b.height-a.width*a.height || b.height-a.height));
  const result=a.height<=b.height?a:b;
  if(maxHeightCm>0 && result.height>cmToPixels(maxHeightCm)) throw new Error(`El acomodo ocupa ${pixelsToCm(result.height).toFixed(2)} cm y supera el largo máximo. Reduce piezas o aumenta el largo.`);
  if(width*result.height>DTF_MAX_OUTPUT_PIXELS) throw new Error('La plantilla supera 500 megapíxeles. Divide el pedido en dos plantillas.');
  return { ...result, width, widthCm:pixelsToCm(width), heightCm:pixelsToCm(result.height), gap, margin, pieces:expanded.length, utilization:expanded.reduce((sum,item)=>sum+item.width*item.height,0)/(width*result.height) };
}

/** Lossless PNG streamed a row at a time, avoiding a full-sheet RGBA canvas. */
export async function encodeDtfPng(layout, sources, progress = () => {}, colorChunks = []) {
  if(typeof CompressionStream==='undefined') throw new Error('Tu navegador no admite esta exportación. Usa Chrome o Edge actualizado.');
  const header=new Uint8Array(13), h=new DataView(header.buffer);
  h.setUint32(0,layout.width);h.setUint32(4,layout.height);header[8]=8;header[9]=6;
  const density=new Uint8Array(9), d=new DataView(density.buffer);
  d.setUint32(0,Math.round(DPI/.0254));d.setUint32(4,Math.round(DPI/.0254));density[8]=1;
  const stream=new CompressionStream('deflate'), writer=stream.writable.getWriter();
  const chunks=[new Uint8Array([137,80,78,71,13,10,26,10]),packChunk('IHDR',header),...colorChunks,packChunk('pHYs',density)];
  const reader=stream.readable.getReader();
  const read=(async()=>{while(true){const {done,value}=await reader.read();if(done)break;chunks.push(packChunk('IDAT',value));}})();
  try {
    for(let y=0;y<layout.height;y++) {
      const row=new Uint8Array(1+layout.width*4); // PNG filter 0. Empty regions remain transparent.
      for(const item of layout.placements) {
        if(y<item.y || y>=item.y+item.height) continue;
        const source=sources.get(item.id);
        if(!source || source.length!==item.width*item.height*4) throw new Error('Faltan píxeles de un diseño.');
        const offset=(y-item.y)*item.width*4;
        row.set(source.subarray(offset,offset+item.width*4),1+item.x*4);
      }
      await writer.write(row);
      if(y%64===0) progress(y/layout.height);
    }
    await writer.close();await read;progress(1);
    return new Blob([...chunks,packChunk('IEND',new Uint8Array())],{type:'image/png'});
  } catch(error) { await writer.abort(error).catch(()=>{}); await read.catch(()=>{}); throw error; }
}
