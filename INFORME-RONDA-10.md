# INFORME - RONDA 10

## 1. Qué hice

Cerré la ronda 10: **H11 — pantalla de carga del requerimiento** y **H12 — anexo
de EETT**, más los cuatro pendientes de la orden de cierre (§1.1 a §1.4). Todo
el trabajo de la ronda estaba en el árbol sin commitear; esta sesión lo
revisé, completé lo que faltaba, verifiqué y publiqué.

- **H11 — Pantalla de carga del requerimiento (§3.1).** Vista embebida en el
  expediente, visible sólo en `ESPECIFICACIONES_TECNICAS` y no archivada:
  encabezado con los dieciséis campos de `core/requerimiento.js` prellenado con
  lo derivable (unidad ← dependencia solicitante, lugar, fecha de hoy, objeto ←
  título, justificación ← fundamentación, rubro); presupuestos con nombre
  original, tamaño e id que asigna el servidor; valores de referencia por
  renglón con **el mismo cálculo vivo del núcleo** (`preventivoRenglon`);
  cantidades de la OCA cuando corresponde; imputación presupuestaria siempre
  visible pero deshabilitada (la completa Contaduría en AFECTACION, ADR-022
  §4); borrador local propio por expediente que sobrevive recargas.
- **H12 — Anexo de EETT (§3.2).** `core/anexo-eett.js` decide qué renglones
  desbordan (aclaración > `MAX_ACLARACION` = 256, contando **puntos de
  código**) y nombra los anexos con el alfabeto fonético (alfa, bravo, …,
  zulu, alfa-2…); `renders/anexo-eett.js` compone el HTML completo con la
  aclaración entera y las dos leyendas en el pie; el requerimiento impreso dice
  "según anexo alfa" en lugar del texto largo; el generador puede guardar los
  anexos como entregables (no obligatorios en ningún estado). El criterio de
  conteo está fijado por test: acentos y eñes cuentan 1, un emoji cuenta 1
  punto de código aunque `.length` sea 2.
- **§1.1 — Leyendas en las tres superficies.** La leyenda de ADR-023 y la de
  ADR-016 comparten ahora pie del entregable (`renders/documento.js`, constantes
  exportadas), `resumen.md` (`renders/resumen.js`; para ADR-016 agregué la línea
  canónica junto a la explicación extendida que ya existía) y pantalla del
  expediente (`app/index.html`, párrafos `#sgc-leyenda-adicion` y el nuevo
  `#sgc-leyenda-adr016`). Test §3.2.9 nuevo verifica las tres para ADR-016,
  además del §3.2.8 existente de ADR-023.
- **§1.2 — Cuerpo sobre 4 MB responde 413.** `leerCuerpo` (server/ayudantes.js)
  ya no destruye el socket en silencio: marca el error con código 413, deja de
  consumir el cuerpo, descarta el resto y `responderErrorPeticion` responde
  `413` con mensaje en español ("el cuerpo de la petición supera el límite de
  4 MB (4194304 bytes); achique el contenido y reintente") antes de cerrar la
  conexión (`Connection: close`). Los seis puntos de lectura de cuerpo del
  servidor usan el mismo respondedor.
- **§1.3 — Guardias del servidor completadas y verificadas en vivo.** Ya
  estaban del trabajo de ronda: PUT rechaza base ausente, valor negativo,
  base `total` con cantidad inválida y presupuestoId inexistente (misma
  `validarRenglon` que la pantalla, contra los presupuestos reales en disco).
  Agregué las dos que faltaban: **la creación valida los renglones igual que el
  PUT** (helper compartido `erroresDeRenglones`; en la creación se pasa un
  conjunto vacío de presupuestos, así que citar cualquiera es error) y **la
  justificación tiene tope duro** `MAX_JUSTIFICACION = 20000`
  (`validacion.validarJustificaciones`, cubre `fundamentacion.justificacion` y
  `requerimiento.justificacionNecesidad`; el wizard también lo valida del lado
  cliente). Las trece respuestas reales están en §3.
- **§1.4 — Ningún archivo sobre 400 líneas.** La pantalla se partió en módulos:
  `requerimiento-formulario.js` coordina y delega en `requerimiento-oca.js`,
  `requerimiento-encabezado.js`, `requerimiento-presupuestos.js`,
  `requerimiento-borrador.js`; `requerimiento-valores.js` quedó sin el bloque
  OCA. Del lado del servidor, `apiGuardarPresupuesto` se movió a su propio
  `server/presupuestos.js`. Verificación automática: ningún `.js` de `app/`,
  `server/`, `tools/` o `tests/` supera las 400 líneas (el mayor queda en 389).

## 2. Decisiones que tomé y por qué

- **`MAX_ACLARACION` tiene una sola definición: `app/js/core/config.js` (256),
  y vive ahí desde el trabajo de ronda.** Los demás módulos la importan
  (`config.MAX_ACLARACION`); nadie repite el número. Sobre el porqué del
  límite partido en dos —`MAX_ACLARACION` 256 y `MAX_ACLARACION_TOTAL` 2000—:
  mi orden original decía "cuando el texto supera el límite entra al anexo" sin
  decir cuál era el techo del anexo. Un solo límite era imposible: o el tope
  era 256 (y el anexo no existiría nunca) o era otro número (y entonces el
  impreso y el tope debían ser cosas distintas). Quedó: 256 es lo que se
  imprime en el requerimiento y el umbral de desborde; 2000 es el tope duro de
  entrada, porque nadie transcribe más que eso y el campo no es un cajón de
  sastre (enmienda ADR-014, riesgo del piloto). Es la misma lógica que apliqué
  después a la justificación: `MAX_JUSTIFICACION = 20000`, definición única en
  `config.js`.
- **Qué cuenta como "carácter": puntos de código, con una sola definición en
  todo el sistema.** `String.length` cuenta unidades UTF-16: para acentos y
  eñes coincide con lo que ve el usuario, para emojis no ('🛩'.length === 2 y
  el usuario ve uno). Adopté **puntos de código** porque es lo que percibe el
  operador y es el criterio que ya tenía la regla de desborde
  (`anexo-eett.contarCaracteres`). Al revisar encontré que el resto usaba
  `length`: el validador (`validacion.validarRenglon`), el contador visible
  (`catalogo/renglones.js`) y las guardas del wizard (`pasos.js`,
  `fasttrack.js`). Los unifiqué: la función vive ahora en
  `core/utils.contarCaracteres` (cargada antes que todo, cliente y servidor),
  `anexo-eett.js` delega en ella y los otros cuatro sitios la llaman. Mismo
  número en los tres lugares, garantizado por test (2000 emojis entran,
  2001 no, aunque `.length` diga 4000/4002). Una salvedad honesta: el atributo
  HTML `maxLength` del textarea lo impone el navegador en unidades UTF-16, así
  que con emojis corta la escritura antes de llegar a 2000 visibles; es sólo
  guarda de entrada, el validador y el servidor usan el criterio correcto.
- **Qué reglas del requerimiento valida el servidor por su cuenta**, sin
  ayuda de la pantalla: forma completa de cada renglón (código, cantidad
  positiva, unidad; vía `validarRenglon`), valores de referencia (base
  obligatoria `unitario|total`, valor numérico no negativo, normalización de
  base `total` contra cantidad positiva, presupuestoId existente entre los
  presupuestos reales del expediente), topes de aclaración (2000) y de
  justificación (20000, en ambos campos donde vive), y lo hace tanto en el PUT
  como —desde esta ronda— en la creación. Las respuestas reales están en §3.
- **La creación rechaza antes de quemar un número.** Las guardias corren antes
  del lock de numeración (ADR-009): un POST inválido no consume número de
  expediente.
- **El servidor se partió por responsabilidad, no por tamaño nomás.**
  `presupuestos.js` es el endpoint de subida (ORDEN-RONDA-09 §3.2); dejarlo
  adentro de `expedientes.js` era lo que lo había mandado a 428 líneas.
  `servidor.js` compone los manejadores con `Object.assign`, sin cambiar rutas.
- **Las vistas se parten por pieza de UI, con el estado en un solo lugar.**
  Cada módulo nuevo es autónomo (IIFE con namespace, patrón del código) y el
  formulario les pasa lo que depende de él (repo, operador, mensajes) por
  parámetro/inyección en el montaje; la API pública de
  `requerimientoFormulario` (montar, actualizar, fijarRepo, seleccionarOperador,
  fijarStorage, leerBorrador) no cambió, así que `app.js` y los tests siguen
  cableando igual.

## 3. Verificación

- **Suite completa**: `node --test` desde la raíz → **287 tests, 0 fallos, una
  sola pasada** (~131 s). La ronda 9 cerró en 260: +27 (anexo de EETT, pantalla
  del requerimiento, guardias de servidor incluidas las nuevas de creación y
  justificación, leyenda ADR-016, conteo en puntos de código).
- **Guardián**: `node tools/check-compat.js` → salida **0** ("OK - 46
  archivo(s) inspeccionados, 0 violaciones").
- **Límite de 400 líneas**: verificado por conteo automático sobre todos los
  `.js` de `app/`, `server/`, `tools/` y `tests/`: ninguno supera 400 (mayores:
  `requerimiento-valores.js` 389, `config.js` 385, `requerimiento-formulario.js`
  339).
- **Verificación en vivo de la orden de cierre §1.3 contra el servidor real**
  (carpeta temporal fresca, puerto asignado por el sistema; código y cuerpo
  textuales de cada respuesta):

| Caso | Esperado | Obtenido | Respuesta real |
|---|---|---|---|
| PUT valor de referencia sin base | rechazo | **400** | `{"error":"Renglón 1: Valor de referencia 1: la base debe ser \"unitario\" o \"total\""}` |
| PUT valor negativo | rechazo | **400** | `{"error":"Renglón 1: Valor de referencia 1: el valor debe ser un número no negativo"}` |
| PUT base 'total' con cantidad 0 | rechazo | **400** | `{"error":"Renglón 1: La cantidad debe ser un número positivo · Valor de referencia 1: con base \"total\" la cantidad debe ser un número positivo para poder normalizar"}` |
| PUT presupuestoId inexistente | rechazo | **400** | `{"error":"Renglón 1: el valor de referencia 1 cita el presupuesto \"presupuesto-99\", que no existe en este expediente"}` |
| PUT aclaración de 300 caracteres | rechazo según orden §1.3 | **200 — desviación endosada** (ver §4) | `{"version":3}`; en disco el texto completo y el anexo 'alfa' lo imprimen |
| PUT aclaración de exactamente 2000 | aceptado (tope inclusivo) | **200** | `{"version":4}` |
| PUT aclaración de 2001 | rechazo | **400** | `{"error":"Renglón 1: La aclaración no puede superar los 2000 caracteres"}` |
| PUT justificación de 50.000 | rechazo (pregunta de la auditoría) | **400** | `{"error":"la justificación de la necesidad no puede superar los 20000 caracteres"}` |
| PUT justificación de exactamente 20000 | aceptado | **200** | `{"version":5}` |
| PUT justificación de 20001 | rechazo | **400** | ídem 50.000 |
| POST creación con renglón inválido (cantidad −1) | rechazo | **400** | `{"error":"Renglón 1: La cantidad debe ser un número positivo"}` |
| POST creación citando presupuesto que aún no existe | rechazo | **400** | `{"error":"Renglón 1: el valor de referencia 1 cita el presupuesto \"presupuesto-1\", que no existe en este expediente"}` |
| POST con cuerpo > 4 MB (§1.2) | 413 explicado | **413** | `{"error":"el cuerpo de la petición supera el límite de 4 MB (4194304 bytes); achique el contenido y reintente"}` |

  En cada rechazo con expediente previo se verificó además que la versión en
  disco no cambia (sin escritura parcial).

## 4. Contradicciones e información faltante

- **La orden de cierre §1.3 pide que el servidor rechace una aclaración de 300
  caracteres, y no lo implementé tal cual: es la desviación que usted mismo
  endosó en la §0.** La enmienda de ADR-014/H12 manda el desborde (>256) al
  anexo de EETT en vez de rechazarlo, y el tope duro de entrada es 2000. Con el
  criterio de la orden literal, H12 no existiría. Documento ambas lecturas con
  las respuestas reales: 300 entra (va completa al anexo), 2000 entra, 2001 no.
  Si la lectura literal es la que vale, el cambio es una línea
  (`MAX_ACLARACION_TOTAL` ← 256) y se rompe H12.
- **El conteo de caracteres venía disparejo y la orden lo sospechaba ("hoy hay
  un length en cada uno").** Confirmado: la regla de desborde contaba puntos de
  código y el resto contaba unidades UTF-16. Unificado en puntos de código
  (§2). La contradicción latente era real: una aclaración con suficientes
  emojis pasaba el validador (por `.length`) y aun así desbordaba (por
  `contarCaracteres`) o viceversa según el umbral.
- **Contabilidad de tests y de archivos.** La orden de cierre no promete un
  número de tests; la suite pasó de 260 (ronda 9) a 287. Y donde la orden
  menciona cuatro archivos nuevos, el árbol termina con doce: los cuatro de la
  ronda original más los ocho que sumé al partir servidor y pantallas para
  cumplir el §1.4 sin tocar comportamiento.
- **No encuentro documentación sobre qué pasa con textos mixtos (mitad emoji,
  mitad texto) en el sistema oficial**; el criterio "lo que ve el usuario" es
  una decisión mía razonable, no un dato del dominio. Queda fijado por test
  para que sea barato de cambiar si el oficial dijera otra cosa.

## 5. Qué NO hice

- **No toqué la documentación de sólo lectura**: ADR-021 a ADR-028 y órdenes.
- **No subí ningún límite** (`LIMITE_CUERPO` 4 MB, presupuesto 2 MB,
  `MAX_ACLARACION_TOTAL` 2000, `MAX_JUSTIFICACION` 20000 quedaron como están).
- **No implementé la carga de la imputación presupuestaria para Contaduría**
  (la vista de AFECTACION con la grilla Ejerc…M): H11 cubre la Fase 1 del
  generador; el bloque en la pantalla del requerimiento se muestra deshabilitado
  por diseño (ADR-022 §4).
- **No toqué estilos**: las vistas nuevas reutilizan las clases existentes
  (`req-campo`, `exp-mensaje`, etc.).
- **No dejé el guion de verificación en vivo dentro del repositorio**: corre
  contra el servidor real con helpers de `tests/helpers/`, vive en el
  directorio temporal del usuario y sus resultados quedaron transcriptos en §3;
  los casos equivalentes están automatizados en
  `tests/requerimiento-servidor.test.js`.
- **No corrí el servidor contra datos de producción**: carpetas temporales y
  `127.0.0.1` con puerto 0, siempre.

## 6. Riesgos que veo

- **El `maxLength` del textarea es UTF-16** (limitación del navegador): con
  emojis deja de escribir antes de llegar a 2000 caracteres visibles. El
  validador y el servidor no tienen ese problema; el riesgo es sólo de
  fricción de entrada en un caso raro (aclaraciones con muchos emojis).
- **El promedio sigue aplanando valores dispares** por renglón (riesgo
  arrastrado de la ronda 9, decisión de ADR-022): no hay marca de advertencia
  cuando dos cotizaciones del mismo renglón difieren mucho.
- **La suite pesa ~130 s** por levantar servidores reales; sigue corriendo en
  una pasada verde, pero cada suma de tests de servidor la engorda.
- **`MAX_JUSTIFICACION` = 20000 es un número mío**, elegido por analogía con el
  tope de la aclaración (~10 páginas). Si el sistema oficial tiene su propio
  tope de justificación, hay que igualarlo en el único lugar donde vive
  (`config.js`).
- **El borrador local guarda el formulario en `localStorage`** sin cifrar, como
  todo el ciclo; no contiene nada que no vaya a ir al expediente, pero conviene
  recordarlo si algún día hay datos sensibles en pantalla.

## 7. Mediciones

**Tests:** 287 totales, 0 fallos, una sola pasada (~131 s). Sin skipped salvo
el intencional de `build-catalogo.test.js` sin `datos-prueba/`.

**Nuevos (ronda completa, líneas con blancos incluidos):**
`app/js/core/anexo-eett.js` 124, `app/js/renders/anexo-eett.js` 191,
`app/js/views/requerimiento-formulario.js` 339,
`app/js/views/requerimiento-valores.js` 389,
`app/js/views/requerimiento-oca.js` 125,
`app/js/views/requerimiento-encabezado.js` 118,
`app/js/views/requerimiento-presupuestos.js` 143,
`app/js/views/requerimiento-borrador.js` 116, `server/presupuestos.js` 124,
`tests/anexo-eett.test.js` 231, `tests/requerimiento-formulario.test.js` 315,
`tests/requerimiento-servidor.test.js` 352.

**Modificados (principales):** `server/expedientes.js` 364 (−64: salió el
endpoint de presupuestos; entraron las guardias de creación y justificación),
`server/ayudantes.js` 301 (+413 y respondedor), `server/servidor.js` 373
(wiring de `presupuestos.js` + catch unificados), `app/js/core/config.js` 385
(+`MAX_JUSTIFICACION`), `app/js/core/validacion.js` 218
(+`validarJustificaciones`, tope en `validarFundamentacion`, conteo unificado),
`app/js/core/utils.js` 43 (+`contarCaracteres`), `app/js/catalogo/renglones.js`,
`app/js/views/pasos.js`, `app/js/views/fasttrack.js` (conteo unificado),
`app/index.html` (leyenda ADR-016 + scripts de los módulos nuevos),
`tests/validacion.test.js` (+test de conteo), `tests/wizard.test.js`,
`tests/renders.test.js`.

**Tiempos:** suite completa ~131 s; check-compat < 1 s.

## 8. Accesos fuera del repositorio

- `os.tmpdir()` para las carpetas de datos de los tests y de la verificación
  en vivo (creadas y eliminadas por cada corrida).
- `127.0.0.1` con puerto 0 (asignado por el sistema) para los servidores de
  prueba.
- El guion puntual de la verificación §1.3 se escribió y ejecutó en el
  directorio temporal del usuario (fuera del repo); no tocó nada más allá de
  esa carpeta temporal.
- Nada más: cero dependencias, cero redes externas.

## 9. Correcciones arrastradas

Las cuatro tareas de la orden de cierre, cerradas:

- **§1.1 — Leyendas en las tres superficies.** ADR-023 ya estaba en pie y
  resumen; faltaba la pantalla. ADR-016 faltaba en la pantalla y no estaba como
  línea canónica en resumen.md. Hoy las dos comparten pie del entregable,
  resumen.md y pantalla, con test que lo verifica para ambas (§3.2.8 y §3.2.9).
- **§1.2 — 413 con explicación.** `leerCuerpo` marca el exceso con código 413,
  descarta el resto del cuerpo sin cortar la lectura, y el servidor responde
  JSON con mensaje en español antes de cerrar (`Connection: close`). Probado
  contra el servidor real con un cuerpo de 5 MB (§3).
- **§1.3 — Guardias del servidor completas y verificadas en vivo.** Los cuatro
  casos de PUT que ya estaban siguen en verde; se agregaron la validación de
  renglones en la creación y el tope duro de justificación (ambos campos).
  Tabla completa de respuestas reales en §3.
- **§1.4 — Suite, guardián y tamaños.** 287/287 en una pasada, check-compat
  con salida 0, y ningún archivo sobre 400 líneas tras partir la pantalla en
  cinco módulos y el endpoint de presupuestos en su propio archivo.
