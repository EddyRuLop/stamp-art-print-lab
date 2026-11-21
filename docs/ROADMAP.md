# Roadmap de Stamp Art Print Lab

## Implementado — versión 2.1

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

- Diseños de muestra y recuperación de una sesión guardada en el navegador.
- Semitonos con frecuencia, ángulo y color de prenda.
- Vectorización por paleta de hasta ocho colores y mockups de playera o totebag.
- Ajuste manual de posición por pieza DTF con validación de separación y límites.

## Siguientes módulos

1. Recorte automático de fondos mediante un modelo local con licencia adecuada.
2. Suavizado de curvas en los SVG de paleta.
3. Giro opcional de las piezas DTF y exportación en varias páginas.
4. Verificación con pedidos reales y distintos dispositivos de impresión.

## Flujo de desarrollo

El repositorio es [EddyRuLop/stamp-art-print-lab](https://github.com/EddyRuLop/stamp-art-print-lab). Los cambios se documentan y se suben con commits por función. Antes de entregar se ejecutan `npm test` y `npm run build`.

Los archivos de clientes y las credenciales no forman parte del repositorio. La app continúa siendo una herramienta del propietario y su publicación web mantiene acceso privado.
