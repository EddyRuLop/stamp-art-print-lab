import { crc32 } from './image-core.js';

export function downloadBlob(blob, name) {
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export const safeName = name => name.replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N}_-]/gu,'-').slice(0,80)||'diseno';

/** Store-mode ZIP: no re-encoding of images and no third-party dependency. */
export async function zipFiles(files) {
  const blocks=[], directory=[];let offset=0;
  for(const file of files) {
    const bytes=new Uint8Array(await file.blob.arrayBuffer()), name=new TextEncoder().encode(file.name);
    const crc=crc32(bytes), local=new Uint8Array(30+name.length), l=new DataView(local.buffer);
    l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint32(14,crc,true);l.setUint32(18,bytes.length,true);l.setUint32(22,bytes.length,true);l.setUint16(26,name.length,true);local.set(name,30);
    const central=new Uint8Array(46+name.length), c=new DataView(central.buffer);
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint32(16,crc,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.set(name,46);
    // Reuse the original Blob rather than retaining a second copy of every file.
    blocks.push(local,file.blob);directory.push(central);offset+=local.length+bytes.length;
    if(offset>0xffffffff) throw new Error('El ZIP supera 4 GB. Descarga los resultados por separado.');
  }
  const end=new Uint8Array(22), e=new DataView(end.buffer), size=directory.reduce((n,b)=>n+b.length,0);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
  return new Blob([...blocks,...directory,end],{type:'application/zip'});
}
