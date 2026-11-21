import { DPI } from './image-core.js';

/** Simulate garment colour showing through a rotated dot screen, preserving artwork dimensions. */
export function applySemitone(data, width, height, { frequency, angle, garment }, progress) {
  if (!Number.isFinite(frequency) || frequency < 15 || frequency > 75 ||
      !Number.isFinite(angle) || angle < 0 || angle > 90 || !/^#[0-9a-f]{6}$/i.test(garment)) {
    throw new Error('Usa una frecuencia de 15 a 75 LPI y un ángulo de 0 a 90 grados.');
  }
  const rgb = [1, 3, 5].map(offset => parseInt(garment.slice(offset, offset + 2), 16));
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const scale = frequency / DPI;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const opacity = data[index + 3] / 255;
      const distance = Math.hypot(data[index] - rgb[0], data[index + 1] - rgb[1], data[index + 2] - rgb[2]);
      const coverage = opacity * Math.min(1, distance / 260);
      const u = (x * cos + y * sin) * scale;
      const v = (y * cos - x * sin) * scale;
      const radius = Math.sqrt(coverage / Math.PI);
      const inside = Math.hypot(u - Math.floor(u) - .5, v - Math.floor(v) - .5) < radius;
      data[index + 3] = coverage >= .98 || inside ? 255 : 0;
    }
    if (y % 32 === 0) progress(y / height);
  }
  progress(1);
}
