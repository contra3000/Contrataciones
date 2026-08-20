# INFORME - RONDA 9

## 1. Qué hice

Implementé el **H11 — Requerimiento completo y presupuestos**: la Solicitud de
Gastos real reemplaza a la Especificación Técnica genérica de la Fase 1, con
presupuestos adjuntos, valores de referencia, valor preventivo calculado, OCA y
la imputación presupuestaria cerrada por rol y por estado **en el servidor**.

- **Esquema del requerimiento (§3.1, ADR-022).** `app/js/core/requerimiento.js`
  define `expediente.requerimiento` (16 campos de encabezado) e
  `expediente.imputacion` (filas de 16 campos `Ejerc…M`). La **imputación NO la
  carga el generador**: el PUT que intenta escribir esos campos pasa por la
  matriz de autorización (ADR-021), exige rol `contaduria` y estado `AFECTACION`
  (paso 16); si la petición no la trae, se conserva la de disco. En la Fase 1 el
  bloque se imprime vacío.
- **Presupuestos adjuntos (§3.2).** `POST /api/expedientes/<id>/presupuestos`
  acepta PDF/PNG/JPG en base64 con un **límite de 2 MB** (documentado: convive
  con el tope de 4 MB del cuerpo, que infla el base64 ~33%). El **nombre en
  disco lo decide el servidor** (`presupuesto-<n>.<ext>`, en
  `presupuestos/` dentro de la carpeta del expediente) con id estable que los
  valores de referencia citan; el `nombreOriginal` queda sólo como dato. Se
  registra en `datos.json` con versión y snapshot en `hist/`. El base64 se
  valida con alfabeto estricto (`Buffer.from` ignora basura en silencio).
- **Valores de referencia y valor preventivo (§3.3, el corazón).** Por renglón,
  `valoresReferencia: [{presupuestoId, base: 'unitario'|'total', valor}]`. El
  cálculo es **en este orden** (ADR-022 §2): normalizar a unitario (total →
  `valor/cantidad`), promediar, multiplicar por la cantidad, sumar. Base
  `total` con cantidad cero o ausente se **rechaza en la validación**, nunca se
  divide por cero.
- **OCA (§3.4).** `cantidadMaxima` por renglón con etiqueta y ayuda que dicen
  que es el tope **en una sola Solicitud de Provisión**; `cantidadMinima`
  opcional y vacía por defecto (se imprime sólo si tiene valor); justificación
  de OCA como texto libre, con la causal (Art. 25 inc. c) Dec. 1023/01 y Art.
  111 Dec. 1030/16) como ayuda contextual.
- **Plantilla del requerimiento (§3.5).** `app/js/renders/requerimiento.js`
  reutiliza `renders/documento.js`. **El id del entregable no cambia**
  (`especificacion-tecnica`): lo que cambia es el documento impreso. El código
  se descompone en **IPP / Clase / Ítem** (`2.5.8-378.186` → `258 | 378 | 186`)
  sin perder el código completo ni la columna Aclaración; la tabla lleva el
  importe unitario (el promedio) y el total por renglón; total general en
  números y en **letras** ("LA SUMA DE: PESOS … CON 00/100.-"); bloque de
  imputación vacío o completo; OCA con justificación y planilla de máximos.
  `especificacion-tecnica.js` queda con `estado: null` (base del anexo de EETT
  de H12); `resumen.js` y `renders.test.js` la siguen usando por nombre.
- **Correcciones arrastradas (§2).** 2.1: la matriz por servidor se parte en
  dos archivos que el runner ejecuta en paralelo + timeout explícito por test.
  2.2: la restauración lista los **huérfanos** (archivos del destino que no
  estaban en el respaldo). 2.3: la restauración **valida** el respaldo antes de
  copiar (contador.json, idx/ y que los JSON parseen) y aborta sin tocar el
  destino si algo falla.

## 2. Decisiones que tomé y por qué

- **La imputación se protege en el PUT con la matriz de ADR-021, no con una
  capa nueva.** El servidor normaliza las imputaciones de disco y recibida;
  si cambian y la recibida no está vacía exige `verificar(PADRON, contexto)`,
  `rol === 'contaduria'` y `estado.id === 'AFECTACION'` (403 en español si no);
  si cambian y la recibida está vacía, conserva la de disco sin pisarla. Así un
  generador que edita otros campos tras una devolución no borra ni altera la
  imputación, y contaduría no puede imputar fuera del paso 16.
- **El id del entregable de Fase 1 no cambia; cambia la plantilla.** Los tests
  y el flujo hardcodean `especificacion-tecnica` en ~61 puntos; cambiar el id
  era un ripple innecesario. La plantilla nueva reutiliza `documento.js` y se
  registra con el mismo id/nombre (`especificacion-tecnica.html`), y
  `especificacion-tecnica.js` deja de reclamar el estado. `paraEstado` sigue
  devolviendo una sola plantilla por estado.
- **`especificacion-tecnica.js` no se borra: es la base del anexo de EETT de
  H12.** La dejo registrada por nombre (acceso directo) con `estado: null`.
- **El nombre del presupuesto en disco lo decide el servidor.** Un nombre que
  venga del usuario es una vía de recorrido de rutas; se guarda el dato
  (`nombreOriginal`) pero el archivo se llama `presupuesto-<n>.<ext>` generado
  por el servidor, y `estaDentro` vuelve a defender el límite de la carpeta.
- **El preventivo se muestra donde el usuario lo firma: la columna de la
  plantilla.** La batería externa carga bases mixtas y verifica contra un
  cálculo aparte; el cálculo del caso se muestra en §3.
- **La matriz por archivo, no por test.** `node --test` no tiene límite por
  defecto (verificado empíricamente en Node v24), pero la matriz completa en un
  solo archivo era el cuello de botella de la suite (~133 s). Partirla en dos
  archivos la paraleliza (~86 s) y cada test lleva su timeout explícito: la
  suite entera termina en verde de una sola pasada.
- **La validación del respaldo es abortiva, no avisadora.** Un respaldo
  truncado se restaura tal cual y el servidor arranca con datos incompletos en
  silencio: antes de copiar, `validarRespaldo` exige `contador.json`, `idx/` y
  que todo JSON parsee; si falla, no se copia nada y el mensaje dice qué está
  mal.
- **El base64 se valida con alfabeto estricto.** `Buffer.from(x, 'base64')`
  ignora en silencio los caracteres ajenos al alfabeto (`"no-es-base64!!!"`
  decodifica a bytes); se exige `/^[A-Za-z0-9+/]+={0,2}$/` para no aceptar
  basura como archivo.

## 3. Verificación

- **Suite completa** (repositorio de trabajo): `node --test` → **260 tests, 0
  fallos, una sola pasada** (~156 s).
- **Guardián**: `node tools/check-compat.js` → **0 violaciones** (38 archivos
  inspeccionados).
- **Límite de 400 líneas**: ningún `.js` de `app/`, `server/`, `tools/` o
  `tests/` lo supera (conteo automático; los más grandes son `server/expedientes.js`
  397 y `app/js/views/expediente.js` 394).
- **Clon limpio**: se re-verifica con un `git clone` real del commit antes del
  push (cierre §4). En el árbol de trabajo la suite ya corre en verde de una
  sola pasada.
- **Cálculo del preventivo, caso con bases mixtas (verificable a mano).**
  Renglón: `2.1.1-439.101`, cantidad **2**, dos presupuestos:
  - `presupuesto-1`: base `unitario`, valor **100** → 100 × 1 = **100**
    (ya es unitario, se conserva);
  - `presupuesto-2`: base `total`, valor **300** → 300 / 2 = **150**
    (normalizado a unitario);
  - promedio = (100 + 150) / 2 = **125**;
  - preventivo del renglón = 125 × 2 = **250**;
  - con un segundo renglón de 1 × 50 = **50**, preventivo de la contratación =
    **250 + 50 = 300** → "LA SUMA DE: PESOS TRESCIENTOS CON 00/100.-".
  Cubierto por `requerimiento.test.js` y por la plantilla (columna promedio y
  total en letras).
- **Criterios de la orden** (tabla §5): 1 ✓ (suite en una pasada), 2 ✓
  (check-compat), 3 ✓ (bases mixtas, números en el punto anterior), 4 ✓
  (base total con cantidad cero rechazada), 5 ✓ (imputación: sólo `contaduria`,
  sólo `AFECTACION`, validado contra el servidor en `imputacion-servidor.test.js`),
  6 ✓ (`../` en el nombre no escapa), 7 ✓ (código en tres columnas), 8 ✓
  (total en letras, incluido el cero), 9 ✓ (etiqueta y ayuda del máximo por
  Solicitud de Provisión), 10 ✓ (mínima vacía no se imprime), 11 ✓ (justificación
  de OCA con la causal), 12 ✓ (restauración: huérfanos + validación), 13 ✓
  (sin archivos sobre 400 líneas), 14 ✓ (este informe).

## 4. Contradicciones e información faltante

- **La §0 dice que la recuperación ante desastre la verificó el propio
  evaluador y la ronda 8 ya la documentó; esta ronda no la re-probó a mano.**
  No contradice nada: la herramienta se extendió (validación y huérfanos) y se
  probó con tests sobre el mismo mecanismo de copia con punto de commit.
- **El número de tests de la orden sigue sin coincidir con el real.** La §1
  decía "conservando en verde lo anterior"; la suite pasó de 233 a **260**
  (+27: 10 de requerimiento, 7 de presupuestos, 5 de imputación, 2 de
  plantilla requerimiento, 2 de respaldo, 1 por la partición de la matriz).
  No afecta nada; queda la contabilidad honesta.
- **`respaldo.js` no pasó por la validación de `restaurar.js`.** Es el lado
  creador; la validación vive en la restauración (corrección 2.3). El respaldo
  se crea siempre completo por su rename atómico, así que no se valida al
  crearlo.

## 5. Qué NO hice

- **No toqué el wizard/fasttrack para cargar los campos nuevos.** La batería
  externa y los tests cargan el requerimiento, los presupuestos y los valores
  de referencia por API/PUT (el modelo y el servidor están listos); la pantalla
  de carga del requerimiento (formulario de los 16 campos, subida de
  presupuestos, edición de valores de referencia por renglón) queda pendiente
  de una ronda UI. Lo dejo explícito porque es la pieza que falta para que el
  usuario final cargue los datos.
- **No implementé H12** (anexo de EETT con su regla de desborde) **ni H13**
  (ANEXO 1): fuera de alcance declarado en la §1.
- **No toqué los estilos**: la ronda es estructura de datos y generación
  funcional.
- **No modifiqué la documentación de sólo lectura**: ADR-021, ADR-022, órdenes.
- **No corrí el servidor contra datos de producción**: todo con carpetas
  temporales en `os.tmpdir()`.

## 6. Riesgos que veo

- **La carga UI del requerimiento es el eslabón que falta** (ver §5): el
  modelo, el cálculo y el servidor están, pero un usuario final hoy no puede
  cargar los 16 campos ni subir presupuestos desde la página. Es el riesgo
  operativo más grande de la ronda.
- **El promedio es un solo número por renglón.** Si los presupuestos de un
  mismo renglón son dispares, el promedio lo aplana sin avisar. Es lo que pide
  ADR-022 (§2 paso 2) y lo que el Jefe de Contrataciones firma; un extremo
  (valores muy distintos) convendría marcarlo, pero queda fuera de alcance.
- **El límite de 2 MB es una consecuencia del tope global de 4 MB del cuerpo.**
  Está documentado y probado; si en el futuro se quieren presupuestos más
  grandes habrá que subir `LIMITE_CUERPO` (ayudantes.js) y re-verificar.
- **La suite sigue siendo pesada** (~156 s) por los tests que levantan el
  servidor real; ya partida la matriz, sigue siendo aceptable y corre en una
  pasada.

## 7. Mediciones

**Tests:** 260 totales, 0 fallos, 0 skipped salvo el intencional de
`build-catalogo.test.js` sin `datos-prueba/`.

**Nuevos:**
- `app/js/core/requerimiento.js` 345, `app/js/renders/requerimiento.js` 299.
- `server/` sin archivos nuevos (el endpoint vive en `expedientes.js`).
- `tests/requerimiento.test.js` 214, `tests/presupuestos-servidor.test.js` 219,
  `tests/imputacion-servidor.test.js` 155,
  `tests/helpers/matriz-servidor-bateria.js` 107,
  `tests/transiciones-servidor-matriz-2.test.js` 14.

**Modificados (principales):** `server/expedientes.js` 397 (PUT con restricción
de imputación + endpoint de presupuestos), `app/js/views/expediente.js` 394
(refactor a ≤400), `server/servidor.js` 367 (+routing), `server/ayudantes.js`
(+'presupuestos' en `accionDeRuta`), `app/js/adapters/repo.http.js`
(+`guardarPresupuesto`), `app/js/core/validacion.js` (+validadores del
requerimiento), `tools/ayudantes-respaldo.js` (+validación y huérfanos),
`tools/restaurar.js`, `renders/especificacion-tecnica.js` (estado null),
`app/index.html` y los andamiajes (`expediente-montura.js`, `exportar.test.js`,
`plantillas.test.js`, `recorrido-completo.js`) que cargan el módulo nuevo.

**Tiempos:** suite completa ~156 s; matriz partida ~86 s (antes ~133 s).

## 8. Accesos fuera del repositorio

- `os.tmpdir()` para las carpetas de datos de los tests y los clones de
  verificación.
- `127.0.0.1` con puerto 0 (asignado por el sistema) para los servidores de
  prueba.
- Nada más: cero dependencias, cero redes externas.

## 9. Correcciones arrastradas

Las tres del §2 de la orden, cerradas:

- **2.1 — La suite completa termina en verde de una sola pasada.** La matriz se
  partió en dos archivos que corren en paralelo y cada test tiene su timeout
  explícito (300 s): `node --test` desde la raíz = **260/260 en una pasada**.
- **2.2 — La restauración avisa qué queda mezclado.** `restaurarRespaldo`
  devuelve y `restaurar.js` imprime los archivos del destino que no estaban en
  el respaldo (huérfanos), con ruta relativa y en orden.
- **2.3 — La restauración valida el respaldo antes de usarlo.** Exige
  `contador.json`, `idx/` y que todos los JSON parseen; si algo falla aborta
  con el detalle y **no copia nada** (probado: el destino queda intacto).