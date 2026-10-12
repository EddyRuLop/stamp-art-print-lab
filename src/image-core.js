export const DPI = 300;
export const MAX_PIXELS = 20_000_000;
export const MAX_BYTES = 25 * 1024 * 1024;
const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});

export function crc32(bytes) {
  let c = 0xffffffff;
  for (const value of bytes) c = crcTable[(c ^ value) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function isPng(bytes) {
  return bytes.length >= 8 && SIGNATURE.every((v, i) => bytes[i] === v);
}

export function pngChunks(bytes) {
  if (!isPng(bytes)) throw new Error('El archivo no es un PNG válido.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks = [];
  let offset = 8;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('El PNG está incompleto.');
    const length = view.getUint32(offset);
    const end = offset + length + 12;
    if (end > bytes.length) throw new Error('El PNG contiene un bloque incompleto.');
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    chunks.push({ type, data: bytes.subarray(offset + 8, end - 4), bytes: bytes.subarray(offset, end) });
    offset = end;
    if (type === 'IEND') break;
  }
  if (chunks[0]?.type !== 'IHDR' || chunks.at(-1)?.type !== 'IEND') throw new Error('La estructura del PNG no es válida.');
  return chunks;
}

export function packChunk(type, data) {
  const out = new Uint8Array(data.length + 12);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(Array.from(type, c => c.charCodeAt(0)), 4);
  out.set(data, 8);
  view.setUint32(out.length - 4, crc32(out.subarray(4, out.length - 4)));
  return out;
}

/** Replaces only the density chunk; other chunks, including IDAT and ICC, are retained. */
export function setPngDpi(bytes, dpi = DPI) {
  const chunks = pngChunks(bytes);
  const density = new Uint8Array(9);
  const view = new DataView(density.buffer);
  const pixelsPerMeter = Math.round(dpi / 0.0254);
  view.setUint32(0, pixelsPerMeter);
  view.setUint32(4, pixelsPerMeter);
  density[8] = 1;
  const physical = packChunk('pHYs', density);
  const blocks = [bytes.subarray(0, 8)];
  for (const chunk of chunks) {
    if (chunk.type === 'pHYs') continue;
    blocks.push(chunk.bytes);
    if (chunk.type === 'IHDR') blocks.push(physical);
  }
  const out = new Uint8Array(blocks.reduce((n, b) => n + b.length, 0));
  let position = 0;
  for (const block of blocks) { out.set(block, position); position += block.length; }
  return out;
}

export function readPngDpi(bytes) {
  const chunk = pngChunks(bytes).find(c => c.type === 'pHYs');
  if (!chunk || chunk.data.length !== 9 || chunk.data[8] !== 1) return null;
  const view = new DataView(chunk.data.buffer, chunk.data.byteOffset, 9);
  return { x: view.getUint32(0) * 0.0254, y: view.getUint32(4) * 0.0254 };
}

export function dimensionsForPrint(width, height, mode, widthCm) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error('Las dimensiones originales no son válidas.');
  let outWidth = width;
  let outHeight = height;
  if (mode === 'print') {
    if (!Number.isFinite(widthCm) || widthCm <= 0 || widthCm > 500) throw new Error('Ingresa un ancho entre 0.01 y 500 cm.');
    outWidth = Math.max(1, Math.round(widthCm / 2.54 * DPI));
    outHeight = Math.max(1, Math.round(outWidth * height / width));
  } else if (mode !== 'pixels') throw new Error('Selecciona un modo de tamaño válido.');
  if (outWidth * outHeight > MAX_PIXELS) throw new Error('La salida supera 20 megapíxeles. Reduce el ancho para preparar este archivo en el navegador.');
  return { width: outWidth, height: outHeight, widthCm: outWidth / DPI * 2.54, heightCm: outHeight / DPI * 2.54, scale: outWidth / width };
}

export function alphaStats(data) {
  let transparent = 0, semi = 0, opaque = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 0) transparent++;
    else if (data[i] === 255) opaque++;
    else semi++;
  }
  return { transparent, semi, opaque, total: data.length / 4 };
}

export function cleanAlpha(data, mode, threshold = 128, progress = () => {}) {
  if (!['keep', 'threshold', 'visible'].includes(mode)) throw new Error('El modo de transparencia no es válido.');
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 255) throw new Error('El umbral debe estar entre 1 y 255.');
  if (mode === 'keep') return;
  const step = Math.max(4, Math.floor(data.length / 40 / 4) * 4);
  for (let i = 3; i < data.length; i += 4) {
    const alpha = data[i];
    data[i] = mode === 'visible' ? (alpha > 0 ? 255 : 0) : (alpha >= threshold ? 255 : 0);
    if ((i - 3) % step === 0) progress(i / data.length);
  }
  progress(1);
}

/** Alpha-aware 3x3 unsharp mask. RGB in transparent neighbours cannot introduce dark edges. */
export function sharpenRgba(data, width, height, strength, progress = () => {}) {
  if (!Number.isFinite(strength) || strength < 0 || strength > 1) throw new Error('La nitidez debe estar entre 0 y 1.');
  if (strength === 0) return;
  const source = new Uint8ClampedArray(data);
  const kernel = [1, 2, 1];
  const amount = strength * 1.5;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      if (source[index + 3] === 0) continue;
      let weightSum = 0, r = 0, g = 0, b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const px = Math.min(width - 1, Math.max(0, x + kx));
          const py = Math.min(height - 1, Math.max(0, y + ky));
          const i = (py * width + px) * 4;
          const weight = kernel[ky + 1] * kernel[kx + 1] * source[i + 3] / 255;
          weightSum += weight;
          r += source[i] * weight; g += source[i + 1] * weight; b += source[i + 2] * weight;
        }
      }
      if (weightSum === 0) continue;
      const means = [r / weightSum, g / weightSum, b / weightSum];
      for (let c = 0; c < 3; c++) {
        const difference = source[index + c] - means[c];
        if (Math.abs(difference) > 2) data[index + c] = Math.round(source[index + c] + amount * difference);
      }
    }
    if (y % 64 === 0) progress(y / height);
  }
  progress(1);
}

/** Dimensions before decoding prevent allocating a huge canvas for supported file headers. */
export function inspectHeader(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (isPng(bytes)) {
    const chunks = pngChunks(bytes);
    const header = chunks[0].data;
    if (header.length !== 13) throw new Error('La cabecera del PNG no es válida.');
    if (chunks.some(c => c.type === 'acTL')) throw new Error('Usa un PNG fijo; esta versión no procesa animaciones.');
    if (header[8] === 16) throw new Error('Esta versión admite PNG de 8 bits. Convierte el PNG de 16 bits antes de cargarlo.');
    const h = new DataView(header.buffer, header.byteOffset, header.byteLength);
    return { type: 'PNG', width: h.getUint32(0), height: h.getUint32(4), dpi: readPngDpi(bytes)?.x ?? null };
  }
  if (bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 8) {
        return { type: 'JPG', width: view.getUint16(offset + 5), height: view.getUint16(offset + 3), dpi: null };
      }
      offset += length;
    }
    throw new Error('No se pudieron leer las dimensiones del JPG.');
  }
  if (bytes.length > 30 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') {
    const type = String.fromCharCode(...bytes.subarray(12, 16));
    if (type === 'VP8X') {
      if (bytes[20] & 2) throw new Error('Usa una imagen WebP fija; esta versión no procesa animaciones.');
      const read24 = i => bytes[i] | bytes[i + 1] << 8 | bytes[i + 2] << 16;
      return { type: 'WebP', width: read24(24) + 1, height: read24(27) + 1, dpi: null };
    }
    if (type === 'VP8 ' && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) return { type: 'WebP', width: view.getUint16(26, true) & 16383, height: view.getUint16(28, true) & 16383, dpi: null };
    if (type === 'VP8L' && bytes[20] === 47) {
      const packed = view.getUint32(21, true);
      return { type: 'WebP', width: (packed & 16383) + 1, height: ((packed >>> 14) & 16383) + 1, dpi: null };
    }
  }
  throw new Error('Sube una imagen PNG, JPG o WebP válida.');
}
