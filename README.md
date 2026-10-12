# Stamp Art · Print Lab

Herramienta web para preparar archivos de impresión: definir medidas en centímetros, exportar PNG a 300 DPI, ampliar mediante interpolación, aplicar nitidez, quitar fondos de color sólido y eliminar semitransparencias. Procesa imágenes en el navegador sin enviar los archivos a un servidor.

## Funciones de la primera versión

- Carga de PNG, JPG y WebP fijos, hasta 25 MB y 20 megapíxeles.
- Análisis de dimensiones, densidad PNG disponible y píxeles semitransparentes.
- Conservación de píxeles o ajuste a un ancho de impresión a 300 DPI.
- Proporciones bloqueadas y altura calculada automáticamente.
- Ampliación mediante interpolación del navegador y máscara de enfoque opcional.
- Tres modos de transparencia: conservar, umbral y opacidad completa de todo lo visible.
- Eliminación local de fondo por color: blanco, negro, verde chroma o color personalizado, con tolerancia y suavizado de borde.
- Vista del original y resultado sobre fondos de cuadros, blanco u oscuro; zoom 100% y 200%.
- Descarga PNG con bloque `pHYs` de 300 DPI y verificación de su densidad.
- Cancelación del procesamiento y conservación del archivo original.
- Diseño de prueba generado con vectores para explorar las funciones.

## Qué significa mejorar la calidad

La interpolación crea píxeles intermedios al ampliar; la nitidez refuerza contraste que ya existe. No reconstruyen automáticamente detalle perdido. Cambiar solo DPI modifica la escala física de impresión, no añade píxeles.

Para 30 × 28 cm a 300 DPI se necesitan aproximadamente 3543 × 3307 píxeles:

```text
píxeles = centímetros / 2.54 × 300
```

La mejora mediante IA no está implementada en esta versión. Requeriría un modelo adicional y una comparación cuidadosa en textos y logotipos.

## Tecnologías

React 19, Vite 6, JavaScript, CSS, Web Workers, OffscreenCanvas y Canvas 2D. Esta primera versión funciona enteramente en el navegador: no necesita Python, FastAPI, base de datos ni una API de pago. Un backend con FastAPI y Pillow puede añadirse posteriormente si se necesita procesamiento de archivos más grandes, control de perfiles de color o integración con modelos de IA.

## Ejecutar en tu computadora

Instala Node.js compatible con Vite 6 y abre la carpeta en VS Code.

```bash
npm install
npm run dev
```

Abre la dirección local indicada por Vite. El proyecto requiere servir los archivos mediante HTTP: abrir `index.html` con doble clic no carga los módulos y el Worker correctamente.

```bash
npm test
npm run build
npm run preview
```

`npm run build` genera `dist/` para un alojamiento estático.

## Uso

1. Carga una imagen o usa **Probar con un diseño**.
2. Selecciona **Conservar píxeles** para mantener sus dimensiones en píxeles o **Medida en cm** para adaptarla a un ancho de impresión.
3. Activa nitidez solo si necesitas reforzar los bordes.
4. Selecciona el tratamiento de transparencia:
   - **Conservar:** mantiene alfa parcial, sombras y bordes suaves.
   - **Umbral:** alfa menor al umbral pasa a 0; alfa igual o superior pasa a 255.
   - **Hacer opaco todo lo visible:** alfa 0 se conserva; cualquier alfa mayor que 0 pasa a 255.
5. Pulsa **Preparar PNG**, compara las vistas y descarga.

Los ajustes no se aplican automáticamente: si los cambias, el resultado anterior se descarta y debes preparar un archivo nuevo.

## Organización

| Archivo | Responsabilidad |
| --- | --- |
| `src/main.jsx` | Interfaz, selección de archivos y gestión de tareas. |
| `src/style.css` | Diseño adaptable. |
| `src/image.worker.js` | Decodificación, interpolación, procesamiento y exportación. |
| `src/image-core.js` | Densidad PNG, CRC, cálculo de medidas, alfa y nitidez. |
| `tests/image-core.test.mjs` | Pruebas de densidad, conservación de chunks, alfa, bordes, tamaños y límites. |

## Detalles de exportación

El navegador exporta Canvas normalmente a 96 DPI. Print Lab inserta o reemplaza `pHYs` con 11811 píxeles por metro en ambos ejes; PNG usa un entero por metro, equivalente a aproximadamente 299.9994 DPI. La salida se vuelve a leer para comprobarlo.

En un PNG con **Conservar píxeles**, sin nitidez y con transparencia conservada, solo cambia el bloque de densidad: mantiene los bloques de imagen originales, incluido `IDAT`, y el perfil de color presente. La excepción es un PNG cuya orientación provoque un intercambio de dimensiones al decodificarlo: se exporta orientado mediante Canvas. Las operaciones que requieren Canvas se exportan en el espacio de color del navegador, por lo que no se promete conservación del perfil ICC original.

El orden del tratamiento es decodificar, redimensionar, aplicar nitidez, limpiar alfa y exportar. La limpieza de alfa es posterior al redimensionado para evitar que éste introduzca nuevas semitransparencias después del filtro.

## Quitar fondo

La versión 1.1 incluye **quitar un color de fondo**, no un recorte automático de personas u objetos. Elige el color exacto, aumenta la tolerancia solo hasta que desaparezca el fondo y ajusta el suavizado si el borde queda escalonado. Después, selecciona **Limpiar con umbral** si el proveedor requiere que el PNG no tenga semitransparencias.

No elimina únicamente el fondo por posición: cualquier parte del diseño parecida al color elegido también puede quedar transparente. Por eso es ideal para fondos planos y para el flujo de quitar negro/blanco que se usa antes de crear semitonos.

El siguiente módulo será el recorte automático con IA ejecutado localmente. Se elegirá un modelo con licencia compatible con publicar la herramienta; no se integrará una API de pago ni un modelo que obligue a abrir el código de una futura versión comercial.

## Alcance y límites

- No elimina todavía fondos complejos, personas u objetos mediante IA. JPG no incorpora canal alfa, pero puede convertirse a PNG transparente con la eliminación por color.
- No vectoriza y no genera semitonos todavía.
- La medida física incluye el lienzo completo, también sus márgenes transparentes.
- El ajuste con umbral puede eliminar detalles tenues; convertir todo lo visible en opaco puede hacer visibles residuos.
- Se admiten imágenes fijas. PNG de 16 bits y archivos animados se rechazan para evitar conversiones silenciosas.
- Las imágenes grandes pueden requerir varios segundos y suficiente memoria disponible. El trabajo se realiza en un Worker para mantener la interfaz disponible y permitir cancelación.
- El aspecto puede variar según el algoritmo de interpolación del navegador. Comprueba el resultado al 100% y con tu proveedor antes de usarlo en una tirada.

## Privacidad

Los archivos se leen en memoria y se descargan desde una URL local del navegador. No hay subida, almacenamiento remoto ni analítica. La interfaz solicita sus fuentes tipográficas a Google Fonts; si no están disponibles, utiliza fuentes del sistema.

## Validación

`npm test` comprueba que la densidad escrita corresponde a 300 DPI, que los bloques de imagen y color se conservan en el modo de metadatos, que la limpieza produce exclusivamente alfa 0/255 sin alterar RGB, que la nitidez no incorpora colores de vecinos transparentes y que las medidas y límites se calculan correctamente. La compilación también se verifica. La prueba visual en navegador queda pendiente en el entorno de creación.

## Autor

[Eduardo Ruiz — EddyRuLop](https://github.com/EddyRuLop)

Proyecto inicial preparado con apoyo de ChatGPT para Stamp Art. Pendiente de conectar GitHub para publicar el repositorio personal.
