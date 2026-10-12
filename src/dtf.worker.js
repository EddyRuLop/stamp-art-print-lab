import { inspectHeader, pngChunks, crc32, MAX_BYTES, MAX_PIXELS } from './image-core.js';
import { packDtf, encodeDtfPng, DTF_MAX_SOURCE_PIXELS } from './dtf-core.js';
import { decodePngExact } from './png-decode.js';

self.onmessage=async({data:job})=>{
  const sources=new Map();let canvas,bitmap;
  const progress=(value,message)=>self.postMessage({type:'progress',value,message});
  try {
    const layout=packDtf(job.items,job.options);
    const used=job.items.filter(item=>layout.placements.some(p=>p.id===item.id));
    if(used.reduce((sum,item)=>sum+item.width*item.height,0)>DTF_MAX_SOURCE_PIXELS) throw new Error('Los diseños originales suman más de 100 MP (400 MB de píxeles). Divide este pedido en dos plantillas.');
    const warnings=[];let commonColorChunks=null,commonSignature=null,mixedColor=false;
    for(let index=0;index<used.length;index++){
      const item=used[index];if(item.file.size>MAX_BYTES)throw new Error(`${item.name}: supera 200 MB.`);
      progress(Math.round(index/used.length*40),`Leyendo ${index+1} de ${used.length}: ${item.name}`);
      const bytes=new Uint8Array(await item.file.arrayBuffer()),header=inspectHeader(bytes);
      if(header.width*header.height>MAX_PIXELS)throw new Error('Un diseño supera 100 MP.');
      let exact=header.type==='PNG'&&!header.hasExif?await decodePngExact(bytes):null;
      const colorChunks=exact?pngChunks(bytes).filter(c=>['iCCP','sRGB','gAMA','cHRM'].includes(c.type)).map(c=>c.bytes):[];
      const signature=colorChunks.map(chunk=>crc32(chunk)+':'+chunk.length).join('|');
      if(commonSignature===null){commonSignature=signature;commonColorChunks=colorChunks;}else if(commonSignature!==signature)mixedColor=true;
      if(exact && (exact.width!==item.width||exact.height!==item.height))throw new Error(`${item.name}: contiene una orientación especial. Prepara el PNG en el apartado de imágenes antes de acomodarlo.`);
      if(exact) sources.set(item.id,exact.data);
      else {
        bitmap=await createImageBitmap(item.file);canvas=new OffscreenCanvas(bitmap.width,bitmap.height);
        const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw new Error('No se pudo decodificar el diseño.');
        ctx.drawImage(bitmap,0,0);bitmap.close();bitmap=null;
        if(canvas.width!==item.width||canvas.height!==item.height)throw new Error('Cambió la dimensión al leer el diseño.');
        sources.set(item.id,ctx.getImageData(0,0,canvas.width,canvas.height).data);
        canvas.width=canvas.height=1;canvas=null;
        warnings.push(`${item.name}: decodificado con el navegador; revisa el perfil de color.`);
      }
      if(header.dpi&&Math.abs(header.dpi-300)>1)warnings.push(`${item.name}: declara ${Math.round(header.dpi)} DPI. Aquí se conservan sus píxeles y se colocan a 300 DPI; revisa sus cm.`);
    }
    if(mixedColor)warnings.push('Los diseños tienen perfiles de color distintos. Se conservan los valores RGB, pero no se puede asignar un perfil común: revisa la prueba de color con tu proveedor.');
    const blob=await encodeDtfPng(layout,sources,v=>progress(40+Math.round(v*60),'Exportando plantilla PNG a 300 DPI…'),mixedColor?[]:commonColorChunks||[]);
    self.postMessage({type:'done',blob,layout,warnings});
  }catch(error){self.postMessage({type:'error',message:error.message||'No se pudo crear la plantilla. Divide el pedido e inténtalo de nuevo.'});}
  finally {sources.clear();bitmap?.close();if(canvas)canvas.width=canvas.height=1;}
};
