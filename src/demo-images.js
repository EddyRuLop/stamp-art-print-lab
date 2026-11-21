/** Original synthetic examples. No customer artwork is included. */
export async function demoImages() {
  const samples = [
    { name: 'Muestra-sello.png', width: 600, height: 520, paint(ctx) {
      ctx.fillStyle = '#732d9f';
      ctx.beginPath();
      ctx.arc(300, 260, 215, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#efff97';
      ctx.font = 'bold 180px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SA', 300, 262);
    } },
    { name: 'Muestra-hojas.png', width: 460, height: 600, paint(ctx) {
      ctx.fillStyle = '#16574e';
      ctx.fillRect(219, 170, 22, 325);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 ? '#a9c744' : '#22735a';
        ctx.beginPath();
        ctx.ellipse(i % 2 ? 303 : 157, 193 + i * 53, 91, 34, i % 2 ? -.5 : .5, 0, Math.PI * 2);
        ctx.fill();
      }
    } },
  ];
  return Promise.all(samples.map(async ({ name, width, height, paint }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext('2d'));
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('No se pudo generar la muestra.')));
    });
    return new File([blob], name, { type: 'image/png' });
  }));
}
