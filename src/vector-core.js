/** Raster mask to vector contours; holes are retained through even-odd filling. */
export function traceMask(data, width, height, { threshold = 128, invert = false, alphaThreshold = 128, color = '#000000', outputWidth = width, outputHeight = height } = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 600000 || data.length !== width * height * 4) throw new Error('Dimensiones de vectorización no válidas.');
  if (!/^#[0-9a-f]{6}$/i.test(color) || !Number.isFinite(threshold) || threshold < 0 || threshold > 255) throw new Error('Ajustes de vectorización no válidos.');
  const mask = new Uint8Array(width * height);
  let selected = 0;
  for (let p = 0; p < mask.length; p++) {
    const i = p * 4;
    const dark = .2126 * data[i] + .7152 * data[i+1] + .0722 * data[i+2] < threshold;
    if (data[i+3] >= alphaThreshold && (invert ? !dark : dark)) { mask[p] = 1; selected++; }
  }
  if (!selected) throw new Error('No hay zonas seleccionadas. Cambia el umbral o activa invertir.');
  const edges = new Map();
  const key = (x,y) => y * (width+1) + x;
  const add = (x,y,ex,ey,dir) => { const k=key(x,y); const list=edges.get(k)||[]; list.push({ x,y,ex,ey,dir }); edges.set(k,list); };
  const on = (x,y) => x>=0 && y>=0 && x<width && y<height && mask[y*width+x];
  for (let y=0;y<height;y++) for(let x=0;x<width;x++) if(on(x,y)) {
    if(!on(x,y-1)) add(x,y,x+1,y,0);
    if(!on(x+1,y)) add(x+1,y,x+1,y+1,1);
    if(!on(x,y+1)) add(x+1,y+1,x,y+1,2);
    if(!on(x-1,y)) add(x,y+1,x,y,3);
  }
  const paths=[];
  while(edges.size) {
    const startKey=edges.keys().next().value;
    let current=edges.get(startKey)[0], points=[], lastDir=-1, steps=0;
    do {
      if(current.dir!==lastDir) points.push([current.x,current.y]);
      lastDir=current.dir;
      const k=key(current.x,current.y), list=edges.get(k);
      list.splice(list.indexOf(current),1); if(!list.length) edges.delete(k);
      const nextKey=key(current.ex,current.ey);
      if(nextKey===startKey) break;
      const candidates=edges.get(nextKey);
      if(!candidates?.length) throw new Error('No se pudo cerrar el contorno.');
      // At diagonal contacts, prefer the right turn to keep distinct components.
      const priority=[1,0,3,2];
      current=candidates.slice().sort((a,b)=>priority.indexOf((a.dir-lastDir+4)%4)-priority.indexOf((b.dir-lastDir+4)%4))[0];
      if(++steps>width*height*4) throw new Error('El contorno es demasiado complejo.');
    } while(true);
    paths.push('M'+points.map(p=>p.join(' ')).join('L')+'Z');
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${(outputWidth/300*25.4).toFixed(4)}mm" height="${(outputHeight/300*25.4).toFixed(4)}mm" viewBox="0 0 ${width} ${height}"><path fill="${color}" fill-rule="evenodd" d="${paths.join('')}"/></svg>`;
  return { svg, contours:paths.length, selected, width:outputWidth, height:outputHeight };
}
