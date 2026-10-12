# Roadmap de Stamp Art Print Lab

## Implementado — versión 2.0

- Pantalla de herramientas por tarjetas y navegación por apartados.
- Biblioteca de archivos compartida con selección, eliminación y carga múltiple.
- Hasta 200 MB por archivo y 100 MP por imagen; miniaturas reducidas.
- PNG a 300 DPI, ajuste de centímetros y nitidez opcional por lotes.
- Quitar color/fondo plano y limpieza de alfa por lotes.
- Vectorización SVG de un color por lotes.
- Descarga individual, descarga ZIP y reutilización de resultados PNG en DTF.
- Plantilla DTF de 88 cm, largo automático, separación mínima de 1 mm, cantidades y margen exterior.
- Conservación de dimensiones y bytes RGBA de PNG de 8 bits sin entrelazado/EXIF.
- Exportación DTF por filas y preservación de perfiles PNG cuando son comunes a todos los diseños.
- Pruebas de procesamiento, acomodo, conservación de píxeles y archivos ZIP.

## Siguientes módulos

1. Recorte automático de objetos/fondos con un modelo local y licencia adecuada.
2. Semitonos de impresión con parámetros de tamaño, frecuencia, ángulo y color de prenda.
3. Vectorización a color y suavizado de curvas.
4. Mockups de diferentes prendas y colores.
5. Ajuste manual de posiciones DTF, giro opcional y exportación por páginas.
6. Guardado local de sesiones y recuperación de proyectos.
7. Pruebas con grandes archivos de producción y verificación visual de escritorio/móvil.

## Flujo de desarrollo

El repositorio es [EddyRuLop/stamp-art-print-lab](https://github.com/EddyRuLop/stamp-art-print-lab). Los cambios se documentan y se suben con commits por función. Antes de entregar se ejecutan `npm test` y `npm run build`.

Los archivos de clientes y las credenciales no forman parte del repositorio. La app continúa siendo una herramienta del propietario y su publicación web mantiene acceso privado.
