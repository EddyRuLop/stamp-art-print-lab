import { DPI, MAX_PIXELS, MAX_BYTES, inspectHeader, dimensionsForPrint, alphaStats, cleanAlpha, removeColor, sharpenRgba, setPngDpi, readPngDpi } from './image-core.js';
import { traceMask } from './vector-core.js';

function progress(value, message) { self.postMessage({ type: 'progress', value, message }); }

self.onmessage = async ({ data: job }) => {
  let bitmap;
  let canvas;
  try {
    if (!self.OffscreenCanvas || !self.createImageBitmap) throw new Error('Abre la herramienta en una versión reciente de Chrome, Edge, Firefox o Safari. Tu navegador no admite el procesamiento de esta versión.');
    if (job.file.size > MAX_BYTES) throw new Error('El archivo supera 200 MB.');
    progress(5, 'Leyendo la imagen…');
    const bytes = new Uint8Array(await job.file.arrayBuffer());
    const header = inspectHeader(bytes);
    if (header.width * header.height > MAX_PIXELS || header.width < 1 || header.height < 1) throw new Error('La imagen supera 100 megapíxeles. Divide o reduce este archivo antes de cargarlo.');
    bitmap = await createImageBitmap(job.file);
    const sourceWidth = bitmap.width, sourceHeight = bitmap.height;
    if (sourceWidth * sourceHeight > MAX_PIXELS) throw new Error('La imagen supera 100 megapíxeles.');
    const vectorScale = Math.min(1, 768 / Math.max(sourceWidth, sourceHeight));
    const thumbScale = Math.min(1,800/Math.max(sourceWidth,sourceHeight));
    const dims = job.type === 'inspect' ? { width:Math.max(1,Math.round(sourceWidth*thumbScale)),height:Math.max(1,Math.round(sourceHeight*thumbScale)) } : job.type === 'vector' ? { width: Math.max(1, Math.round(sourceWidth*vectorScale)), height: Math.max(1,Math.round(sourceHeight*vectorScale)) } : dimensionsForPrint(sourceWidth, sourceHeight, job.options.mode, job.options.widthCm);
    canvas = new OffscreenCanvas(dims.width, dims.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('No fue posible preparar el lienzo de la imagen.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, dims.width, dims.height);
    bitmap.close(); bitmap = null;
    progress(20, 'Revisando los píxeles…');
    const image = context.getImageData(0, 0, dims.width, dims.height);
    const before = alphaStats(image.data);
    if (job.type === 'vector') {
      progress(35, 'Trazando contornos SVG…');
      const vector = traceMask(image.data, dims.width, dims.height, { ...job.options, outputWidth: sourceWidth, outputHeight: sourceHeight });
      self.postMessage({ type:'done', ...vector });
      return;
    }
    if (job.type === 'inspect') {
      const thumbnail=await canvas.convertToBlob({type:'image/png'});
      self.postMessage({ type: 'done', thumbnail, info: { width: sourceWidth, height: sourceHeight, fileType: header.type, inputDpi: header.dpi, stats: before, sampled:true } });
      return;
    }
    const { alphaMode, threshold, sharpen, strength, backgroundMode = 'none', backgroundColor = '#ffffff', backgroundTolerance = 24, backgroundFeather = 0 } = job.options;
    if (backgroundMode === 'color') {
      progress(24, 'Quitando el color de fondo…');
      removeColor(image.data, backgroundColor, backgroundTolerance, backgroundFeather, v => progress(24 + Math.round(v * 30), 'Quitando el color de fondo…'));
    } else if (backgroundMode !== 'none') throw new Error('El modo de quitar fondo no es válido.');
    if (sharpen) {
      progress(55, 'Ajustando la nitidez…');
      sharpenRgba(image.data, dims.width, dims.height, strength / 100, v => progress(55 + Math.round(v * 20), 'Ajustando la nitidez…'));
    }
    progress(76, 'Preparando la transparencia…');
    cleanAlpha(image.data, alphaMode, threshold, v => progress(76 + Math.round(v * 8), 'Preparando la transparencia…'));
    const after = alphaStats(image.data);
    if (alphaMode !== 'keep' && after.semi !== 0) throw new Error('No se pudo verificar la limpieza de transparencia.');
    progress(85, 'Guardando el PNG…');
    let png;
    // Metadata-only PNG export does not decode/re-encode or alter the original IDAT/color profile.
    const metadataOnly = header.type === 'PNG' && !header.hasExif && job.options.mode === 'pixels' && !sharpen && alphaMode === 'keep' && backgroundMode === 'none' && sourceWidth === header.width && sourceHeight === header.height;
    if (metadataOnly) {
      png = setPngDpi(bytes, DPI);
    } else {
      context.putImageData(image, 0, 0);
      const output = await canvas.convertToBlob({ type: 'image/png' });
      png = setPngDpi(new Uint8Array(await output.arrayBuffer()), DPI);
    }
    const density = readPngDpi(png);
    if (!density || Math.abs(density.x - DPI) > .01 || Math.abs(density.y - DPI) > .01) throw new Error('No fue posible verificar los 300 DPI.');
    progress(100, 'Archivo preparado');
    const previewScale=Math.min(1,800/Math.max(dims.width,dims.height));
    const preview=new OffscreenCanvas(Math.max(1,Math.round(dims.width*previewScale)),Math.max(1,Math.round(dims.height*previewScale)));
    if(metadataOnly)context.putImageData(image,0,0);
    preview.getContext('2d').drawImage(canvas,0,0,preview.width,preview.height);
    const thumbnail=await preview.convertToBlob({type:'image/png'});preview.width=preview.height=1;
    self.postMessage({ type: 'done', blob: new Blob([png], { type: 'image/png' }), thumbnail, info: { ...dims, dpi: density.x, stats: after, semiBefore: before.semi, metadataOnly } });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message || 'No se pudo procesar la imagen. Prueba con un archivo más pequeño.' });
  } finally {
    bitmap?.close();
    if (canvas) { canvas.width = 1; canvas.height = 1; }
  }
};
