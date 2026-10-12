# Roadmap de Stamp Art Print Lab

## Propósito

Herramienta privada de Stamp Art para preparar artes de impresión DTF sin subir los archivos de clientes a un servidor. La prioridad es conservar dimensiones, transparencia y control de salida para producción.

## Estado actual — versión 1.1

- Carga de PNG, JPG y WebP fijos (hasta 25 MB / 20 MP).
- Salida PNG con metadato de 300 DPI comprobado.
- Conversión a una medida física en centímetros, conservando proporción.
- Interpolación de navegador y nitidez opcional.
- Eliminación de semitransparencias mediante umbral u opacidad completa.
- Quitar un color de fondo: blanco, negro, verde chroma o color manual; tolerancia y suavizado configurables.
- Procesamiento local en el navegador; los diseños no se almacenan en la app.

## Próximos módulos

Se añadió vectorización SVG de un color con umbral, inversión, huecos y color configurable. La vectorización con curvas suavizadas y paleta múltiple será una ampliación posterior.

1. **Recorte automático con IA local**: elegir un modelo con licencia apta para publicación, mostrar progreso de descarga del modelo y mantener el archivo en el equipo. Se probará con artes reales antes de integrarlo.
2. **Semitonos DTF**: modos de puntos configurables y modo de quitar color sin puntos; controles de color, tolerancia, tamaño, densidad y vista previa.
3. **Plantilla DTF**: cargar múltiples PNG, elegir ancho/alto, separación de 1 mm y acomodar sin escalar ni recomprimir los diseños.
4. **Mockups**: catálogo de prendas y colores con zona imprimible configurable.
5. **Producción**: selector de perfiles y pruebas visuales con archivos reales del taller.

## Ejecutar localmente

1. Instalar Node.js LTS desde <https://nodejs.org>.
2. Abrir esta carpeta con VS Code.
3. En la terminal integrada ejecutar `npm install`.
4. Ejecutar `npm run dev` y abrir la dirección que indique Vite.

Comprobaciones antes de cada entrega:

```bash
npm test
npm run build
```

## Git y commits

El repositorio en GitHub es [EddyRuLop/stamp-art-print-lab](https://github.com/EddyRuLop/stamp-art-print-lab). Los commits usan mensajes por función, por ejemplo:

```text
feat: agrega eliminación de fondo por color
test: cubre tolerancia de eliminación de color
docs: documenta flujo local y roadmap
```

No se agregarán archivos de clientes, resultados de producción ni claves al repositorio.

## Decisiones de privacidad y licencia

- No se usan APIs de pago en la versión actual.
- El recorte por color se ejecuta completamente en el navegador.
- La primera alternativa evaluada para IA automática fue descartada porque utiliza licencia AGPL; antes de publicar se seleccionará un modelo y librería compatibles con el uso futuro de Stamp Art.
