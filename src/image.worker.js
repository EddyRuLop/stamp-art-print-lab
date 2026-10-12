import { DPI, MAX_PIXELS, MAX_BYTES, inspectHeader, dimensionsForPrint, alphaStats, cleanAlpha, sharpenRgba, setPngDpi, readPngDpi } from './image-core.js';

function progress(value, message) { self.postMessage({ type: 'progress', value, message }); }

self.onmessage = async ({ data: job }) => {
  let bitmap;
  let canvas;
  try {
    if (!self.OffscreenCanvas || !self.createImageBitmap) throw new Error('Abre la herramienta en una versión reciente de Chrome, Edge, Firefox o Safari. Tu navegador no admite el procesamiento de esta versión.');
    if (job.file.size > MAX_BYTES) throw new Error('El archivo supera 25 MB. Usa una imagen más ligera.');
    progress(5, 'Leyendo la imagen…');
    const bytes = new Uint8Array(await job.file.arrayBuffer());
    const header = inspectHeader(bytes);
    if (header.width * header.height > MAX_PIXELS || header.width < 1 || header.height < 1) throw new Error('La imagen supera 20 megapíxeles. Reduce sus dimensiones antes de cargarla.');
    bitmap = await createImageBitmap(job.file);
    const sourceWidth = bitmap.width, sourceHeight = bitmap.height;
    if (sourceWidth * sourceHeight > MAX_PIXELS) throw new Error('La imagen supera 20 megapíxeles.');
    const dims = job.type === 'inspect' ? { width: sourceWidth, height: sourceHeight } : dimensionsForPrint(sourceWidth, sourceHeight, job.options.mode, job.options.widthCm);
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
    if (job.type === 'inspect') {
      self.postMessage({ type: 'done', info: { width: sourceWidth, height: sourceHeight, fileType: header.type, inputDpi: header.dpi, stats: before } });
      return;
    }
    const { alphaMode, threshold, sharpen, strength } = job.options;
    if (sharpen) {
      progress(25, 'Ajustando la nitidez…');
      sharpenRgba(image.data, dims.width, dims.height, strength / 100, v => progress(25 + Math.round(v * 35), 'Ajustando la nitidez…'));
    }
    progress(65, 'Preparando la transparencia…');
    cleanAlpha(image.data, alphaMode, threshold, v => progress(65 + Math.round(v * 12), 'Preparando la transparencia…'));
    const after = alphaStats(image.data);
    if (alphaMode !== 'keep' && after.semi !== 0) throw new Error('No se pudo verificar la limpieza de transparencia.');
    progress(80, 'Guardando el PNG…');
    let png;
    // Metadata-only PNG export does not decode/re-encode or alter the original IDAT/color profile.
    const metadataOnly = header.type === 'PNG' && job.options.mode === 'pixels' && !sharpen && alphaMode === 'keep' && sourceWidth === header.width && sourceHeight === header.height;
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
    self.postMessage({ type: 'done', blob: new Blob([png], { type: 'image/png' }), info: { ...dims, dpi: density.x, stats: after, semiBefore: before.semi, metadataOnly } });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message || 'No se pudo procesar la imagen. Prueba con un archivo más pequeño.' });
  } finally {
    bitmap?.close();
    if (canvas) { canvas.width = 1; canvas.height = 1; }
  }
};
