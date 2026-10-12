# Guía del taller

## Cargar varias imágenes

1. En la pantalla de herramientas pulsa **Cargar imágenes** o arrastra varios archivos.
2. Puedes usar PNG, JPG o WebP fijos de hasta 200 MB cada uno y 100 MP.
3. Las tarjetas muestran nombre, píxeles, peso y medida física a 300 DPI.
4. Marca únicamente los diseños que quieres procesar. Puedes añadir más archivos sin perder los anteriores.
5. Abre una herramienta desde su tarjeta o desde la navegación lateral.

Si una imagen falla, las demás siguen cargándose. El mensaje identifica el archivo que requiere atención. La carga y los procesos pueden cancelarse.

## Preparar PNG

**Conservar píxeles originales** cambia la densidad a 300 DPI conservando sus dimensiones. **Ajustar ancho en centímetros** aplica el mismo ancho a cada diseño seleccionado, con altura proporcional. Activa nitidez solo si el diseño la necesita. Procesa el lote y revisa los resultados antes de descargar.

## Quitar un fondo o color

Elige blanco, negro o un color personalizado. La tolerancia amplía la selección a colores parecidos. Con suavizado 0 el borde es duro; un suavizado mayor crea alfa parcial. Para evitar semitransparencias selecciona la salida **Sin semitransparencias · Umbral**.

Esto elimina el color en toda la imagen, no solo en su perímetro. No es un recorte de objetos mediante IA. Comprueba que no desaparezcan partes importantes del diseño.

## Limpiar semitransparencias

Con umbral 128, alfa inferior a 128 pasa a transparente y alfa igual o mayor queda opaco. **Hacer opaco todo lo visible** mantiene alfa 0, pero convierte cualquier opacidad mayor a 0 en 255. Las sombras débiles pueden desaparecer o hacerse visibles según el modo elegido.

## Vectorizar varios diseños

Selecciona los archivos, ajusta el umbral e indica si quieres zonas oscuras o claras. Elige el color del vector y pulsa **Vectorizar seleccionados**. Descarga los SVG por separado o en ZIP. Se generan trazados, no imágenes raster incrustadas. Es un trazado de siluetas de un color; fotografías a color necesitan un proceso distinto.

## Acomodar la película DTF

1. Carga tus PNG preparados a 300 DPI o pulsa **Usar en DTF** desde un lote de resultados.
2. Abre **Crear plantilla DTF**.
3. Usa 88 cm de ancho; la separación predeterminada es 1 mm y el margen exterior es 1 mm.
4. Indica la cantidad de cada diseño en su tarjeta.
5. Deja **Largo máximo** en 0 para que el algoritmo lo calcule. Puedes poner un límite si tu película tiene un largo fijo.
6. Revisa el acomodo y las medidas de cada archivo. No se gira, escala ni recorta ninguna imagen.
7. Pulsa **Exportar plantilla PNG** y después **Descargar plantilla**.

Las medidas dependen del número de píxeles a 300 DPI. Un PNG de 3543 × 3307 px mide aproximadamente 30 × 28 cm. Un archivo a 96 DPI con esos mismos píxeles ocupará esa misma medida dentro de la película de 300 DPI; la app avisa si la densidad de origen difiere.

El área transparente de cada archivo ocupa espacio. No se recorta automáticamente para conservar el lienzo original. El algoritmo busca un acomodo corto, pero no garantiza el aprovechamiento máximo posible.

## Descargar y revisar

- Usa **Descargar ZIP** para obtener todos los resultados sin que el navegador bloquee múltiples descargas.
- Usa **Abrir al 100%** para revisar el archivo completo.
- Las miniaturas son reducidas; no representan una pérdida de resolución del archivo descargado.
- DTF conserva el alfa de origen: si necesitas que todo sea 0 o 255, limpia los archivos antes.
- Si la exportación muestra un aviso sobre perfiles de color, realiza una prueba con tu proveedor.
- Descarga antes de recargar o cerrar la página: los diseños no se guardan de forma permanente.
