# Stamp Art · Print Lab

Taller web para preparar diseños de impresión DTF. Carga varios archivos, trabaja por apartados y exporta PNG a 300 DPI, SVG o una plantilla DTF de largo automático. Todo el procesamiento se realiza en el dispositivo del usuario.

**Versión 2.0:** herramientas por tarjetas y navegación lateral, carga múltiple de hasta 200 MB por archivo, procesamiento por lotes y acomodo DTF de 88 cm sin escalar los diseños.

[Abrir aplicación privada](https://stamp-art-print-lab.eduardoyahel14743.chatgpt.site) · [Repositorio](https://github.com/EddyRuLop/stamp-art-print-lab) · [Guía de uso](docs/USO.md) · [Roadmap](docs/ROADMAP.md)

El acceso web requiere la cuenta de su propietario. Node.js solo es necesario para desarrollar o ejecutar el proyecto localmente.

## Herramientas

| Apartado | Función | Salida |
| --- | --- | --- |
| Tamaño y 300 DPI | Conservar píxeles o definir ancho en cm, altura proporcional y nitidez opcional | PNG |
| Quitar fondo | Eliminar blanco, negro o un color personalizado con tolerancia y suavizado | PNG transparente |
| Semitransparencias | Conservar alfa, limpiar con umbral o hacer opaco todo lo visible | PNG a 300 DPI |
| Vectorizar SVG | Trazar zonas oscuras/claras en un color, conservando huecos | SVG con trazados |
| Crear plantilla DTF | Acomodar diseños y cantidades en 88 cm, separación mínima de 1 mm y largo automático | PNG transparente a 300 DPI |

La biblioteca de diseños se comparte entre apartados. Selecciona los archivos que quieras procesar. Los resultados pueden descargarse por separado, en ZIP o reutilizarse en la plantilla DTF. Las miniaturas están reducidas para evitar decodificar todos los archivos originales simultáneamente.

## Ejecutar en VS Code

Instala [Node.js LTS](https://nodejs.org/) y [Git](https://git-scm.com/), abre una terminal y ejecuta:

```bash
git clone https://github.com/EddyRuLop/stamp-art-print-lab.git
cd stamp-art-print-lab
npm ci
npm run dev
```

Vite está incluido en las dependencias del proyecto: no necesitas instalarlo por separado. Abre la dirección que indique la terminal. Abrir `index.html` con doble clic no carga correctamente los módulos y Workers.

```bash
npm test
npm run build
npm run preview
```

La compilación genera `dist/`, que puede alojarse en un servidor estático.

## Medidas, píxeles y DPI

```text
píxeles = centímetros / 2.54 × 300
centímetros = píxeles / 300 × 2.54
```

Cambiar DPI no crea detalle. La ampliación por interpolación suaviza el resultado, y la nitidez refuerza contraste existente. No hay mejora por IA en esta versión.

El PNG usa el bloque `pHYs` con 11811 píxeles por metro: aproximadamente **299.9994 DPI**, la representación entera de 300 DPI. Una película nominal de 88 cm corresponde a **10394 píxeles**, o 88.00253 cm por redondeo. Para garantizar al menos 1 mm de separación se usan **12 píxeles = 1.016 mm**.

## Plantilla DTF

- Ancho predeterminado: 88 cm, editable; preset adicional de 58 cm.
- Largo automático; se puede establecer un máximo opcional.
- Separación configurable desde 1 mm y margen exterior configurable.
- Cantidad de copias por diseño, de 1 a 100; hasta 300 piezas por plantilla.
- Dos órdenes de colocación con algoritmo skyline; se elige el acomodo más corto. Es una heurística y no garantiza el mínimo matemático global.
- **No escala, gira ni recorta** los lienzos de los archivos.
- Las medidas se interpretan a 300 DPI. Si un archivo declara otro DPI, se muestra un aviso: conservar píxeles y conservar una medida física de otro DPI son objetivos distintos.
- El área transparente del PNG forma parte de su lienzo y del espacio reservado.
- Una pieza demasiado ancha se rechaza con su medida; nunca se reduce silenciosamente.

La salida se construye por filas con `CompressionStream`, sin reservar un Canvas RGBA de toda la película. Esto permite hojas mayores que el límite habitual de un Canvas. PNG de 8 bits sin entrelazado ni EXIF se decodifican directamente: sus valores RGB y alfa se copian sin remuestreo ni premultiplicación. Los perfiles PNG se conservan cuando todos los diseños usan los mismos bloques de color. Si tienen perfiles distintos se avisa, porque una sola imagen no puede conservar varios perfiles distintos simultáneamente.

JPG, WebP y otras variantes PNG se decodifican con el navegador y generan un aviso sobre el color. No se vuelven a comprimir como JPG; la salida es PNG sin pérdida. La opacidad original se conserva en DTF: usa **Semitransparencias** antes de acomodar si necesitas alfa estrictamente 0/255.

## Límites y funciones pendientes

| Límite | Valor |
| --- | --- |
| Peso por archivo | 200 MB |
| Imágenes cargadas | 100 por sesión |
| Píxeles por imagen | 100 MP |
| Salida de herramientas que usan Canvas | 100 MP y 32767 px por lado; depende también de la memoria del navegador |
| Fuentes distintas de una plantilla DTF | 100 MP en total (unos 400 MB de RGBA); las copias reutilizan la misma fuente |
| PNG DTF de salida | Hasta 500 MP, exportado por filas |
| Vectorización | Análisis reducido a 768 px por lado; trazados de un color |

Los límites de píxeles protegen la memoria: una imagen de 100 MP ocupa unos 400 MB sin comprimir aunque su archivo PNG pese mucho menos. Lotes grandes se procesan secuencialmente; un fallo en una imagen no cancela las demás. Si el navegador no tiene memoria suficiente, divide el lote.

Esta versión no incluye recorte automático de fondo por IA, vectorización a color, semitonos de impresión ni mockups. Quitar fondo por color también puede eliminar ese color dentro del dibujo. PNG de 16 bits y archivos animados se rechazan para evitar conversiones silenciosas.

## Organización técnica

| Archivo | Responsabilidad |
| --- | --- |
| `src/main.jsx` | Navegación, biblioteca, selección, lotes, resultados y DTF |
| `src/style.css` | Tarjetas, controles y diseño adaptable |
| `src/image.worker.js` | Inspección, miniaturas, preparación PNG y vectorización |
| `src/image-core.js` | DPI, límites, alfa, medidas, color y nitidez |
| `src/vector-core.js` | Contornos SVG de un color |
| `src/dtf-core.js` | Acomodo automático y exportación PNG por filas |
| `src/dtf.worker.js` | Lectura de diseños y exportación DTF fuera del hilo de interfaz |
| `src/png-decode.js` | Decodificación PNG de 8 bits con conservación exacta de RGBA |
| `src/downloads.js` | Descargas y ZIP sin re-encode de archivos |
| `scripts/verify-real-dtf.mjs` | Comparación de originales PNG con las piezas del PNG DTF |
| `tests/` | Pruebas de procesamiento, SVG, DTF, filtros PNG y ZIP |

## Validación

- 23 pruebas automáticas: DPI/CRC, conservación de PNG, alfa, nitidez, tamaños, vectorización, separación y límites de DTF, exportación por filas, cinco filtros PNG, paletas y ZIP. Incluyen un PNG generado de más de 25 MB, decodificado y comparado sin pérdida.
- Compilación de producción con Vite.
- Prueba con cuatro PNG reales de referencia: película de 10394 × 2072 px, largo 17.54293 cm, 300 DPI y comparación exacta de los bytes RGBA de cada pieza con su original.
- La interacción y el diseño visual en navegador quedan pendientes de una revisión manual: el entorno de creación no dispone de la herramienta de navegador permitida.

## Privacidad

Los archivos quedan en memoria del navegador y se descargan desde URLs locales. No se envían a una API, no hay analítica ni almacenamiento de diseños en servidores. Las fuentes tipográficas se solicitan a Google Fonts y tienen alternativas del sistema. Al recargar se pierden los archivos de la sesión: descarga tus resultados antes de cerrar.

## Autor

[Eduardo Ruiz — EddyRuLop](https://github.com/EddyRuLop). Proyecto de Stamp Art desarrollado con apoyo de ChatGPT.
