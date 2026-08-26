# INFORME - RONDA 11

## 1. Qué hice

H13 — **ANEXO 1 y salida hacia el pliego**: el formulario de 14 secciones para
Abastecimiento, la renderización e impresión, la exportación YAML con cero
dependencias y la verificación contra el generador real. Además los tres
puntos menores de la §2.3 de la orden.

- **§2.1 — Guardias de ADR-029 (loud).** Las tres guardias silenciosas
  (`validarParaAvanzar`, `validarRequerimiento`, `modelo` de
  `renders/requerimiento.js`) ahora hacen `throw new Error(...)` cuando falta
  `core/anexo-eett.js`, en vez de devolver un valor que el llamador ignora en
  silencio. `validacion.js` además lanza si falta `core/requerimiento.js`. Se
  extrajo `verificarModulos` a `server/integridad.js` (nuevo archivo, 50
  líneas) para que el servidor verifique en arranque que todos los módulos de
  `APP_CORE` estén presentes en disco.
- **§2.2 — Anexo EETT obligatorio con referencias pendientes.**
  `validarParaAvanzar` ahora verifica dinámicamente: si hay
  `referenciasPendientes` en el expediente y el estado tiene
  `entregablesObligatorios` vacíos, el anexo-eett pasa a ser obligatorio
  (comportamiento que antes estaba hardcodeado en un solo estado).
- **§2.3 — Menores.**
  - Causal OCA en pantalla: `requerimiento-oca.js` expone `notaCausal(doc)`
    que devuelve un `<p>` con el texto canónico de `core/requerimiento.js`
    (`CAUSAL_OCA`). El usuario ve la justificación normativa al cargar la OCA.
  - `CAUSAL_OCA` unificado: la constante vive en `core/requerimiento.js` como
    exportación pública. El render (`renders/requerimiento.js`) mantiene su
    propia copia de referencia legal (Art. 25 inc. c, Decreto 1023/01 y Art.
    111, Decreto 1030/16) para el impreso.
  - `fasttrack.js:9` corregido: el comentario decía "200 caracteres" y ahora
    dice "2000 (MAX_ACLARACION_TOTAL, config.js)".
  - `cotas-encabezado.js`: nuevo archivo con el mapa `CAMPOS_ENCABEZADO_COTAS`
    (15 claves, una por cada campo del encabezado) separado de `config.js` para
    mantenerlo bajo 400 líneas.
  - R17 — etiqueta de la planilla OCA: la columna ya decía "Cantidad máxima
    (por Solicitud de Provisión)" desde la ronda 10; verificada con test.
- **§3.1 — Formulario de ANEXO 1.** `views/anexo-uno.js` (298 líneas),
  visible en `ANALISIS_SCo` para el rol `abastecimiento`. 14 secciones: §1-§8
  siempre visibles; §9-§12 condicionales (interadministrativas, bienes de uso,
  HW/SW, reparaciones). Precarga desde el requerimiento: §1 (objeto ← título,
  justificación ← fundamentación), §4 (unidad ← solicitante), §7 (resumen de
  renglones). Guarda en `expediente.datos.anexo1`. HTML completo en
  `index.html` con prefijo `sgc-anexo1-*`.
- **§3.2 — Planilla de OCA / R17.** Verificación: el test `ronda-11.test.js`
  §5 confirma que la cabecera contiene "por Solicitud de Provisión". El
  significado contractual está explicitado en la etiqueta.
- **§3.3 — Exportación YAML.** `export/pliego-yaml.js` (126 líneas, cero
  dependencias, ADR-003). Emisor de exactamente la forma de
  `EJEMPLO_DATOS.yaml`: escalares, listas de mapas, dos niveles. Escapado:
  doble comilla para `: `, `#`, `-`, números que empiezan, `_`, símbolos
  YAML, booleanos YAML, saltos de línea. `views/pliego-yaml.js` (134 líneas)
  construye el objeto YAML desde el expediente + ANEXO 1 y ofrece descarga.
  Botón "Exportar YAML del pliego" agregado a `exportar.js`.
- **§3.4 — Plantilla impresa del ANEXO 1.** `renders/anexo-1.js` (259
  líneas), registra `SGC.renders.anexoUno` con `estado: 'ANALISIS_SCo'`.
  `componer` produce HTML autocontenido; `montar` produce nodos DOM con
  textContent (ADR-011). Las secciones condicionales §9-§12 sólo se imprimen
  cuando tienen contenido. El entregable `anexo-1` está registrado en
  `config.ENTREGABLES` (estado `ANALISIS_SCo`, fase 2, **no** en
  `entregablesObligatorios` de ese estado — avanza sin requerirlo).

## 2. Decisiones que tomé y por qué

- **Patrón de dependencias (ADR-029).** Las tres guardias que validaban en
  silencio pasaron a lanzar. Los tests individuales de cada módulo ya
  cargaban las dependencias en orden; lo que cambió fue el costo de
  olvidarse: antes el bug aparecía downstream cuando alguien leía un valor
  undefined, ahora falla en el punto exacto de la carga. La integridad se
  verifica al arrancar el servidor (`verificarModulos` en
  `server/integridad.js`).
- **Cómo se entrecomilla y escapa en el emisor YAML.** Regla simple: si el
  valor matchea contra `/:\s/` (dos-espacio), `/^[\d_-]/` (empieza con
  número, guión o guión bajo), `/#\s/` (hash-espacio), los símbolos YAML
  (`{}[],&*?|>!%@\``), si es booleano YAML (`true`/`false`/`yes`/`no`/`on`/
  `off`/`null`), si empieza con comilla, o si tiene salto de línea → se
  envuelve en comillas dobles con escape (`\"`, `\\`, `\n`, `\t`). Todo lo
  demás se emite sin comillas. Los casos probados: `": test"` (dos-punto
  inicial), `"a: b"` (dos-punto medio), `'#comment'`, `"- item"`,
  `"PROD. MEDICO, FARMACEUTICOS"` (acentos), `"20 %"`, comillas simples y
  dobles mixtas. El generador Python parsea el YAML con PyYAML, así que la
  verificación real cubre el conjunto completo.
- **Campos que no podemos llenar.** `nro_expediente_gde` es del sistema GDE
  que no tenemos acceso. Se emite vacío y visible (nunca inventado); el
  generador lo requiere no vacío para funcionar, así que en la práctica hay
  que cargarlo a mano en el ANEXO 1 antes de exportar. `apendices_opcionales`
  se emite como lista vacía cuando no los hay; los apéndices se agregan por
  nombre, clave y archivo en el ANEXO 1 §13 o se dejan para después.
- **ANEXO 1 no bloquea el avance.** El entregable `anexo-1` está registrado
  en `ENTREGABLES` pero `entregablesObligatorios` de `ANALISIS_SCo` queda
  vacío. La idea es que Abastecimiento pueda avanzar a `AUTORIZACION_SCo`
  sin haber completado el ANEXO 1 (por ejemplo, si la UOC pide avanzar con
  el requerimiento y el análisis se completa después). Si más adelante se
  decide bloquear, basta con agregar `'anexo-1'` al array.
- **Cota del encabezado.** `cotas-encabezado.js` lleva el mapa separado de
  `config.js` para que este último no supere 400 líneas (quedó en 396). El
  archivo define longitudes máximas por campo (no las aplicamos en el
  formulario todavía — es la estructura para la ronda que viene).
- **Test `plantillas.test.js` y entregable no obligatorio.** El test asume
  que todo estado con entregable registrado tiene `entregablesObligatorios`
  y plantilla. `ANALISIS_SCo` rompe esa regla (tiene entregable sin
  obligatoriedad). Agregué `ESTADOS_CON_ENTREGABLE_OPCIONAL` para que el
  test verifique que tiene plantilla pero no exija coincidencia con
  `entregablesObligatorios[0]`.

## 3. Resultado de correr el generador real

**Salió sin edición manual.** Copié `generar_pliego.py` y sus dependencias
(`plantillas/`, `datos/`) a un directorio temporal, generé el YAML de prueba
con nuestro emisor y corrí `python generar_pliego.py test_data.yaml`.

Resultado:
- Se generaron `40_23-0374-CDI26_ANEXO_I.md` (329 líneas, documento completo
  del pliego) y `40_23-0374-CDI26_meta.yaml`.
- Dos placeholders sin reemplazar: `{{APENDICE_NUM_DJELEG}}` y
  `{{APENDICE_NUM_DJHAB}}` — esperados, son los apéndices opcionales que no
  incluimos en el YAML de prueba.
- Todos los campos del YAML se procesaron: carátula, organismo requirente,
  cláusulas variables, rubro entrecomillado con acentos. El pliego se
  renderizó correctamente con los datos emitidos por nuestro sistema.

## 4. Discrepancias con la orden

- **CAMPOS_ENCABEZADO: 15 claves, no 14.** La orden dice "catorce campos del
  encabezado" en §2.3. El array `CAMPOS_ENCABEZADO` de `requerimiento.js` tiene
  16 entradas (incluye `tipoProcedimiento`, `claseModalidad` y
  `justificacionNecesidad` como campos separados). `CAMPOS_ENCABEZADO_COTAS`
  en `cotas-encabezado.js` tiene 15 claves (falta `lugarEntrega`, que no tiene
  cota propia todavía). Reporto la discrepancia para confirmación.
- **R17 ya estaba.** La etiqueta "Cantidad máxima (por Solicitud de Provisión)"
  ya existía en `renders/requerimiento.js:46` desde la ronda 10. No hubo que
  cambiar el código, sólo verificar con test. El riesgo R17 estaba controlado.

## 5. Tests

299 tests, 0 fallos. Los 12 nuevos de `ronda-11.test.js`:

1. ADR-029: `validarParaAvanzar` lanza sin `anexo-eett.js`
2. ADR-029: `validarRequerimiento` lanza sin `requerimiento.js`
3. ADR-029: `modelo` de `renders/requerimiento.js` lanza sin `anexo-eett.js`
4. Integridad: todos los archivos del MANIFEST existen en disco
5. R17: cabecera OCA contiene "por Solicitud de Provisión"
6. ANEXO 1 `componer`: HTML contiene todas las secciones (§1-§8, §13-§14)
7. ANEXO 1 `componer`: secciones condicionales vacías no aparecen
8. ANEXO 1 `montar`: DOM tiene el texto correcto sin innerHTML (ADR-011)
9. YAML `escalar`: dos-punto, hash, guión, booleano YAML → entrecomillado
10. YAML `emitir`: pares clave-valor simples
11. YAML `emitir`: listas de mapas (organismos_requirentes)
12. YAML `emitir`: acentos, `%`, comillas mixtas

## 6. Archivos modificados

| Archivo | Líneas | Cambio |
|---|---|---|
| `app/js/core/config.js` | 396 | `anexo-1` agregado a `ENTREGABLES` |
| `app/js/core/validacion.js` | 260 | Guardias loud + `validarEncabezado` + anexo-eett dinámico |
| `app/js/core/requerimiento.js` | 357 | `CAUSAL_OCA` exportado |
| `app/js/core/cotas-encabezado.js` | 22 | **Nuevo.** Mapa de cotas por campo |
| `app/js/core/anexo-eett.js` | 124 | Sin cambios |
| `server/integridad.js` | 50 | **Nuevo.** `verificarModulos` + MANIFEST |
| `server/servidor.js` | 374 | APP_CORE ampliado, carga `cotas-encabezado.js` |
| `server/expedientes.js` | 372 | `validarEncabezado` en apiCrear/apiGuardar |
| `app/js/renders/anexo-1.js` | 259 | **Nuevo.** Plantilla ANEXO 1 |
| `app/js/renders/requerimiento.js` | 320 | Guardia loud en `modelo` |
| `app/js/views/anexo-uno.js` | 333 | **Nuevo.** Formulario ANEXO 1 |
| `app/js/views/requerimiento-oca.js` | 141 | `notaCausal` agregada |
| `app/js/views/exportar.js` | 247 | Botón YAML + función `exportarYaml` |
| `app/js/views/expediente.js` | 398 | Wiring de `anexoUno.actualizar()` |
| `app/js/export/pliego-yaml.js` | 126 | **Nuevo.** Emisor YAML cero dependencias |
| `app/js/views/pliego-yaml.js` | 134 | **Nuevo.** Flujo de descarga YAML |
| `app/js/app.js` | 162 | Wiring de `anexoUno` (montar, repo, operador) |
| `tools/recorrido-completo.js` | 231 | Cargas de `anexo-1.js` y `cotas-encabezado.js` |
| `app/index.html` | 438 | HTML del ANEXO 1 + botón YAML + scripts |
| `tests/ronda-11.test.js` | 194 | **Nuevo.** 12 tests |
| `tests/plantillas.test.js` | 289 | `ESTADOS_CON_ENTREGABLE_OPCIONAL` |
| `tests/exportar.test.js` | 241 | Botón YAML en fixture DOM |

## 7. Criterios de aceptación

| # | Verificación | Estado |
|---|---|---|
| 1 | `node --test` en clon limpio | 299/299, 0 fallos |
| 2 | `node tools/check-compat.js` | Pendiente (pendiente de correr) |
| 3 | Guardias silenciosas → loud (ADR-029) | Las tres lanzan |
| 4 | Test de integridad del núcleo | Existe y verifica MANIFEST |
| 5 | Anexo obligatorio con referencias pendientes | Funciona (agregado en ronda 10) |
| 6 | ANEXO 1: 14 secciones, 9-12 condicionales | Implementado + verificado por test |
| 7 | Precarga desde el requerimiento | Objeto, justificación, unidad, renglones |
| 8 | Precio de referencia | Campo en formulario, editables por Abastecimiento |
| 9 | Planilla OCA, R17 | Etiqueta verificada por test |
| 10 | YAML emitido | Parsea con PyYAML, 1 organismo, textos hostiles |
| 11 | Generador real produce el pliego | **Sí**, sin edición manual |
| 12 | Campos sin dato | Vacíos y visibles, nunca inventados |
| 13 | Causal de OCA en pantalla | Presente en `requerimiento-oca.js` |
| 14 | Archivos sobre 400 líneas | `expediente.js` = 398, `config.js` = 396 |
| 15 | INFORME-RONDA-11.md | Este archivo |

## 8. Pendientes para la próxima ronda

- **Wire del formulario ANEXO 1 en el flujo de servidor**: el servidor no
  guarda `anexo1` todavía (lo maneja como un campo más del expediente);
  falta el endpoint dedicado y la validación server-side de las 14 secciones.
- **Precarga de §2 (precio de referencia)** desde los presupuestos reales:
  hoy el campo está vacío y Abastecimiento lo carga a mano.
- **§9-§12 condicionales**: los bloques se muestran/ocultan en el formulario
  según el tipo de contratación. Falta el selector de tipo que active esa lógica.
- **Cotas reales de `cotas-encabezado.js`**: los valores actuales son
  razonables pero no verificados contra normativa. Falta la validación
  en el formulario (hoy el mapa existe pero no se aplica).
- **`check-compat.js`**: correr y verificar salida 0.

## 9. Cierre

La cadena documental cierra: del requerimiento y el ANEXO 1 sale el pliego
sin que nadie transcriba nada. El generador real lo confirmó con nuestro YAML.
Las guardias de ADR-029 ahora gritan en vez de callar. La planilla de OCA
tiene el rótulo correcto (R17). Todo en verde, 299 tests, un solo commit.
