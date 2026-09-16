# ORDEN DE TRABAJO — RONDA 21

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hitos cubiertos: **H23 (cierre)** · **H16 — sistema de estilos**
Emitida: 2026-09-16

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`.

### La ronda 20 fue la mejor tuya del proyecto, y conviene que quede dicho

Cerraste los tres silencios con correcciones mínimas y exactas —lo verifiqué uno por uno—, reescribiste los nueve tests del asistente, entregaste las tres listas que pedí, pasaste de **2 a 6 caminos de persona cubiertos**, y dejaste la suite en **416 verde**. Además corregiste un test preexistente que había quedado obsoleto y que nadie te pidió.

Esta ronda es más corta en correcciones y más grande en superficie: **un defecto, los tres caminos que faltan, y el sistema de estilos.**

### Las reglas de tiempo siguen vigentes

Las de la ronda 20, íntegras: topes por comando, el que enciende apaga, un tope vencido es un hallazgo, y la ronda siempre cierra con commit e informe aunque esté incompleta. **No las repito acá para no alargar: están en `ordenes/ORDEN-RONDA-20.md` §0 y rigen igual.**

Lo que **sí** cambia es quién verifica qué, y está en §4.

### Accesos fuera del repositorio

`os.tmpdir()`, `127.0.0.1`, y **sólo lectura** sobre `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\`, con permiso de ejecutar `scripts/generar_pliego.py` hacia una carpeta temporal. Nada más.

---

## 1. El defecto de la versión vieja · **va primero y es de una línea**

Una persona sola, en una sola pestaña, guarda el documento y después no puede avanzar el expediente. El servidor le contesta que **"fue modificado por otro operador"**, y no hay otro operador.

### La causa

`app/js/views/exportar.js:169` — `guardarDocumento()` recibe del servidor la versión nueva y **la usa sólo para escribir un mensaje** (línea 187). Nunca se la pasa a la vista del expediente, que se queda con la versión anterior. El siguiente "avanzar" manda la vieja → conflicto.

### Lo que ya está bien y hay que copiar

**El resto del código ya hace lo correcto.** Al subir un presupuesto (`requerimiento-presupuestos.js:110`) y al guardar un cambio (`expediente.js` → `manejarResultado`), las dos llaman a `SGC.views.expediente.abrir(...)`, que vuelve a leer el expediente y refresca la versión.

**Sólo el guardado del documento se olvidó.** Aplicá el mismo patrón.

### Y la parte que importa más que la corrección

**Buscá todas las escrituras que devuelven una versión y verificá que la vista la tome.** No son tres, son todas: entregables, presupuestos, adjuntos, ANEXO 1, requerimiento, avance, devolución, archivado. Por cada una, en el informe: **qué devuelve el servidor, qué hace la vista con eso.**

Es la quinta aparición de la misma familia —el servidor devuelve el dato fresco y la pantalla lo usa para un cartelito y lo tira— y esta vez quiero la lista completa, no el caso que rompió.

### El mensaje, además

*"El expediente fue modificado por otro operador"* sólo puede decirse cuando **efectivamente lo modificó otro**. Si la versión del servidor cambió por una acción de la misma sesión, el mensaje tiene que decir otra cosa —o, mejor, no aparecer, porque con la corrección de arriba ya no debería haber conflicto—. Un mensaje que manda a buscar a un compañero inexistente cuesta media mañana.

---

## 2. Los tres caminos que faltan

De los nueve, tenés seis. Cerrá los tres que quedan, con la montura real, por el DOM:

- **C6 · la cadena de roles hasta la firma.** Del `abastecimiento` en adelante, con los roles que haya, hasta donde llegue el circuito. Es el que prueba que la matriz de 18 × 7 funciona en la pantalla y no sólo en el núcleo.
- **C7 · repartir las catorce claves.** Importar `PADRON_INICIAL.csv`, **leer las claves de la pantalla**, y entrar con tres de ellas. La batería cubre el CSV por la API; esto cubre *la persona entra con la clave que vio*.
- **C9 · salir y volver.** Salir, verificar que queda **una** pantalla de ingreso limpia, y volver a entrar.

Al terminar: **9 de 9**, con la cuenta hecha en el informe y cada uno verificable quitando la corrección que lo sostiene.

---

## 3. H16 · el sistema de estilos · **la mitad de esta ronda**

Leé **H16 completo en `PLAN_DESARROLLO.md`** antes de tocar nada.

**El sistema no se inventa: existe, está aprobado, y ya gobierna los pliegos de la UOC.** Está en `EjemplosProcesoActual\DocUOC\Generador de Pliegos\estilos\guia_estilos\paquete\`: `tokens.json` (10 KB), `styles.css` (23,6 KB), `design-system.md` (13,8 KB), `templates/` y los cuatro logos. Paleta navy y dorado sobre papel cálido, tres familias tipográficas, grilla A4, reglas de tabla y de sello, y una sección de reglas no negociables.

### Las dos mitades, que no son iguales

**Los entregables impresos adoptan el sistema directo.** Es exactamente para lo que fue hecho: A4, tamaños en puntos, portadas, filetes. Es la parte barata y la que más se nota, porque esos papeles se firman y se archivan. El criterio: **un documento salido de la aplicación y uno salido del generador de la UOC tienen que verse de la misma familia, sin retoques.**

**Las pantallas necesitan una capa derivada**: la misma paleta y las mismas familias, pero medidas de pantalla, estados de interacción, controles de formulario y tablas. Ese es el trabajo real.

### Lo que no se negocia

- **Todo sale de una capa de variables en un solo archivo.** Ningún color ni tipografía escrita a mano fuera de ahí. El criterio de aceptación es literal: **cambiar el color primario de toda la aplicación tiene que ser una línea.** El Jefe de Contrataciones va a corregir estilo durante el piloto, y eso sólo es barato si esa línea existe.
- **Compatible con Chrome 109** (ADR-011): sin anidamiento nativo, sin `text-wrap: balance`. El guardián de compatibilidad se extiende al CSS nuevo.
- **Tres pedidos concretos del Jefe de Contrataciones**, de cuando vio la aplicación por primera vez: el padrón **como tabla** con encabezado y filas alternas; **los botones agrupados con sentido** y la disposición respondiendo al ancho; y el botón flotante de sugerencias **deja de ser un `?`** — hoy es un signo de pregunta literal (`sugerencias.js:210`) y se lee como "ayuda", no como "enviar una sugerencia".
- **Ningún cambio de comportamiento.** Es una ronda de estilos: si algo funciona mal, se anota, no se arregla acá. Los 9 caminos tienen que seguir en verde **sin tocar un solo test**. Si un test se rompe por el estilo, es que dependía de una clase o de un color, y **eso es un hallazgo**: decilo.

---

## 4. Quién verifica qué · **esto cambió y es lo más importante de la orden**

El ciclo 20 se fue de tiempo porque el auditor construyó un programa que maneja el navegador de punta a punta: más de siete minutos por corrida, roto con cada cambio de pantalla, colgado al perder la sesión. El error fue de quien dio esa instrucción, no de quien la ejecutó.

Queda repartido así, y rige desde esta ronda:

- **Vos** cubrís los caminos de persona **con tests automáticos sobre la montura real**. Corren en segundos y se repiten solos. Es tu trabajo y ya lo hacés bien.
- **El auditor no maneja el navegador.** Lee el código, ataca la API, corre la batería, y **quita tus correcciones para ver si tus tests se ponen en rojo**.
- **El Jefe de Contrataciones hace el recorrido humano**, con una guía corta.

Consecuencia para vos: **tus e2e son ahora la única verificación automática del circuito.** Si uno de ellos pasa sin sostener nada, no hay una segunda red atrás. Escribilos como si nadie fuera a revisarlos — porque casi nadie va a hacerlo.

---

## 5. `INFORME-RONDA-21.md` — en la raíz del repositorio

Las nueve secciones. Tres cosas propias de esta ronda:

- **La lista completa de escrituras que devuelven versión**, y qué hace la vista con cada una.
- **La cuenta de caminos: 9 de 9**, con el test de cada uno.
- **Qué quedó fuera del sistema de estilos** y por qué. Si no llegaste a los entregables impresos, decilo — es peor entregarlos a medias que declararlos pendientes.

---

## 6. Cierre

Un solo commit, `Ronda 21`, **y push**.

**Si el tiempo se acaba, cortá en este orden:** entregá siempre §1 (el defecto de la versión), después §2 (los tres caminos), y **el sistema de estilos es lo que puede quedar a medias** — pero entonces tiene que quedar a medias *por mitades enteras*: primero las pantallas o primero los entregables, nunca las dos a medio hacer.

---

## 7. Criterios de aceptación

- Guardar un documento y avanzar el expediente **sin pasar por un conflicto**, con una sola persona y una sola pestaña.
- La lista completa de escrituras que devuelven versión, con lo que hace la vista.
- **9 de 9 caminos** con test que los recorre entero.
- Cambiar el color primario de toda la aplicación es **una línea**.
- Un entregable impreso desde la aplicación y uno del generador de la UOC **se ven de la misma familia**.
- 416 tests o más en verde, **sin haber tocado ningún test por motivos de estilo**.

---

## 8. Qué se está evaluando

**Que el Jefe de Contrataciones pueda empezar a cargar expedientes de verdad la semana que viene.**

No es una figura retórica: lo va a hacer. Va a abrir la aplicación en su máquina, cargar un requerimiento real de los que tramita todos los días, generar el documento, y pasárselo al que sigue.

Lo único que hoy se lo impide es el defecto de §1 — un dato viejo que una pantalla no refrescó. Todo lo demás de esta orden es para que, cuando lo haga, la aplicación además **se vea como un documento de la Fuerza y no como un borrador**.
