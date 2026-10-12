import { pngChunks } from './image-core.js';

/** Exact RGB/alpha decoding for non-interlaced 8-bit PNG, including palettes. */
export async function decodePngExact(bytes) {
  const chunks=pngChunks(bytes), header=chunks[0].data;
  if(header[8]!==8 || header[12]!==0) return null;
  const channels={0:1,2:3,3:1,4:2,6:4}[header[9]];
  if(!channels) return null;
  const view=new DataView(header.buffer,header.byteOffset), width=view.getUint32(0),height=view.getUint32(4);
  const palette=chunks.find(c=>c.type==='PLTE')?.data, transparency=chunks.find(c=>c.type==='tRNS')?.data;
  if(header[9]===3 && !palette) throw new Error('El PNG no contiene su paleta.');
  const compressed=new Blob(chunks.filter(c=>c.type==='IDAT').map(c=>c.data)).stream().pipeThrough(new DecompressionStream('deflate'));
  const reader=compressed.getReader(), stride=width*channels, row=new Uint8Array(stride+1), previous=new Uint8Array(stride), rgba=new Uint8ClampedArray(width*height*4);
  let filled=0,y=0;
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  while(true){const {done,value}=await reader.read();if(done)break;let offset=0;
    while(offset<value.length){
      if(y>=height) throw new Error('El PNG contiene filas adicionales.');
      const n=Math.min(row.length-filled,value.length-offset);row.set(value.subarray(offset,offset+n),filled);filled+=n;offset+=n;
      if(filled!==row.length)continue;
      const filter=row[0];if(filter>4)throw new Error('Filtro PNG no válido.');
      for(let x=0;x<stride;x++){
        const left=x>=channels?row[1+x-channels]:0,above=previous[x],upperLeft=x>=channels?previous[x-channels]:0;
        row[x+1]=(row[x+1]+(filter===0?0:filter===1?left:filter===2?above:filter===3?Math.floor((left+above)/2):paeth(left,above,upperLeft)))&255;
      }
      for(let x=0;x<width;x++){
        const s=1+x*channels,t=(y*width+x)*4;
        if(header[9]===6){rgba[t]=row[s];rgba[t+1]=row[s+1];rgba[t+2]=row[s+2];rgba[t+3]=row[s+3];}
        else if(header[9]===2){rgba[t]=row[s];rgba[t+1]=row[s+1];rgba[t+2]=row[s+2];rgba[t+3]=transparency&&row[s]===transparency[1]&&row[s+1]===transparency[3]&&row[s+2]===transparency[5]?0:255;}
        else if(header[9]===3){const index=row[s];if(index*3+2>=palette.length)throw new Error('Índice de paleta PNG no válido.');rgba[t]=palette[index*3];rgba[t+1]=palette[index*3+1];rgba[t+2]=palette[index*3+2];rgba[t+3]=transparency?.[index]??255;}
        else {rgba[t]=rgba[t+1]=rgba[t+2]=row[s];rgba[t+3]=header[9]===4?row[s+1]:transparency&&row[s]===transparency[1]?0:255;}
      }
      previous.set(row.subarray(1));y++;filled=0;
    }
  }
  if(y!==height||filled) throw new Error('El PNG está incompleto.');
  return { data:rgba,width,height };
}
