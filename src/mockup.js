const silhouettes = {
  playera: 'M320 125L212 154 107 308 231 397 282 337 282 709 618 709 618 337 669 397 793 308 688 154 580 125Q550 213 450 214Q350 213 320 125Z',
  totebag: 'M246 278H654L629 709H271Z',
};

/** Render a shareable garment preview. Output is a mockup, not a print file. */
export async function renderMockup(bitmap, { garmentType, garmentColor, printSize }) {
  const silhouette = silhouettes[garmentType];
  if (!silhouette || !/^#[0-9a-f]{6}$/i.test(garmentColor) || !Number.isFinite(printSize) || printSize < 15 || printSize > 90) {
    throw new Error('Los ajustes del mockup no son válidos.');
  }
  const canvas = new OffscreenCanvas(900, 800);
  const ctx = canvas.getContext('2d');
  const background = ctx.createLinearGradient(0, 0, 900, 800);
  background.addColorStop(0, '#f1edf4');
  background.addColorStop(1, '#c7bccd');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 900, 800);
  ctx.fillStyle = garmentColor;
  ctx.strokeStyle = garmentColor;
  ctx.shadowColor = '#26202466';
  ctx.shadowBlur = 42;
  ctx.shadowOffsetY = 22;
  if (garmentType === 'totebag') {
    ctx.lineWidth = 29;
    ctx.stroke(new Path2D('M335 285V192Q335 104 450 104Q565 104 565 192V285'));
  }
  const path = new Path2D(silhouette);
  ctx.fill(path);
  ctx.shadowColor = 'transparent';
  const maxWidth = 320 * printSize / 100;
  const maxHeight = 405 * printSize / 100;
  const scale = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height);
  const width = bitmap.width * scale, height = bitmap.height * scale;
  ctx.save();
  ctx.clip(path);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (900 - width) / 2, 454 - height / 2, width, height);
  ctx.restore();
  return canvas.convertToBlob({ type: 'image/png' });
}
