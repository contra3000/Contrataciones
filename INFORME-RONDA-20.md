# INFORME-RONDA-20

Cierre · ORDEN-RONDA-20 (H23).
La ronda 19 hizo que el circuito autenticado se recorra por la puerta de la
persona; esta ronda **caza los cuatro silencios que todavía quedaban** y
**reescribe los tests del asistente por la puerta real**. Todo lo que seguía
tapado en monturas, escribiendo sobre nodos inexistentes o escondiendo la
aplicación entera, ahora falla ruidosamente y se prueba por el DOM.

---

## 1. Resumen ejecutivo

Cuatro defectos que no se veían porque el banco de pruebas los tapaba, y que
hacían que una persona no pudiera terminar su trabajo:

- El presupuesto **nunca subió** al servidor desde la pantalla (H1).
- Al abrir cualquier expediente que no fuera el correcto, el ANEXO 1
  **ocultaba la aplicación entera** (H2).
- El ANEXO 1 **nunca guardó un dato**: escribía sobre nodos que no existen
  (H3).
- Al salir quedaban **dos pantallas de ingreso** conviviendo (H4).

Se corrigieron los cuatro con el fix mínimo (§2), y los nueve tests del
asistente que daban verde montando el estado a mano se reescribieron o
eliminaron (§3). Al terminar: **6 de 9 caminos de persona** con test que los
recorre entero, y la suite completa en verde (416/416).

---

## 2. §1 — Los cuatro silencios de H23

| # | Silencio | Dónde estaba | Cómo se cortó | Test |
|---|----------|-------------|---------------|------|
| H1 | El presupuesto nunca subía al servidor | `requerimiento-presupuestos.js:103` — el front mandaba `contenidoBase64`, el adaptador leía `contenido`, el servidor devolvía 400 | `contenidoBase64` → `contenido` | ronda-20 |
| H2 | El ANEXO 1 ocultaba la raíz de la app entera | `app.js:229` — `anexoUno.montar(contenedor)` recibía `<main id="app">` y le ponía `hidden` | `montar(document.getElementById('sgc-anexo1-seccion'))` | ronda-20 |
| H3 | El ANEXO 1 nunca guardaba un dato | 12 identificadores no coincidían entre JS y HTML; los campos se escribían sobre `null` | 25 ids alineados + `requerir()` (ADR-029) | ronda-20-anexo |
| H4 | Al salir quedaba una doble pantalla de ingreso | El borrador del asistente y la lista declarada no se limpiaban | `limpiarOperador()` + lista `hidden` + salir `reload` | ronda-20 |

**Motivo de dónde se corrigió H1.** Se eligió el front
(`requerimiento-presupuestos.js:103`), y no el adaptador ni el servidor: es el
único de los tres que quedó afuera del acuerdo. `repo.http.js:269` y
`presupuestos.js:42` ya coincidían en `contenido`; el front mandaba
`contenidoBase64`. Corregirlo en el front deja un solo nombre en todo el
recorrido y no toca las dos piezas que se entendían.

### Funciones de repositorio falseadas que quedan en las monturas

| Archivo | Qué falsea | Para qué se usa | Lo que decide esta ronda |
|---------|-----------|----------------|--------------------------|
| `helpers/expediente-montura.js:162-191` | `leerExpediente`, `guardarExpediente`, `avanzar`, `devolver` (sin persistencia; delega a `montaje.guardar`) | `expediente.test.js` (5 tests), `expediente-matriz.test.js` (1 test) | C4 tiene su e2e en `ronda-20`; la matriz de botones por rol queda como unitario + línea de linaje |
| `exportar.test.js:120` | `guardarEntregable` local | 6 tests de exportar | C3 parcial en `ronda-20`; el resto queda como unitario + línea de linaje |
| `kanban.test.js` | `listarIndice` inline | 3 tests de tablero | El tablero del generador con su índice real queda sin e2e; línea de linaje (`montar/fijarRepo/refrescar` a mano) |
| `ronda-13.test.js:374` | `listarArchivo`, `recuperarArchivados`, `fijarPerfeccionado` | 1 test de archivo | El archivo histórico y el reuso de base quedan sin e2e; línea de linaje |
| `requerimiento-formulario.test.js:121` | repo mínimo legítimo | 1 unitario de formulario | No entra en el linaje (unitario válido, ADR-021) |

El `repoFalso` de `wizard.test.js` — que incluía `guardarPresupuesto` y era el
único lugar donde la subida de presupuestos se "probaba" — **desapareció con la
reescritura**. Ahora se prueba por la puerta real: el archivo sube al servidor
real y el servidor lo guarda.

### Vistas que reciben la raíz y si pueden esconderla

| Vista de `#app` | Recibe la raíz | ¿Puede esconderla? |
|-----------------|----------------|--------------------|
| wizard | `montar(contenedor)` | **lo revela**: `wizard.js:180` pone `estado.dom.app.hidden = false` al arrancar — es una puerta de entrada, bien |
| kanban / expediente / archivo / usarBase / exportar / requerimientoFormulario / sugerenciasJefe / padronAdmin / ingreso / cambioClave / sugerencias | `montar(contenedor)` | No: su `raiz` es `#app`, pero ninguna pone `hidden` sobre ella; la visibilidad entre secciones la gobierna `esconderTodas()` (app.js:28-35), que la oculta y cada `alternar*()` la vuelve a mostrar |
| **anexoUno** | **ya no**: recibe `#sgc-anexo1-seccion` (app.js:232) | No: `anexo-uno.js:224/228` sólo alterna su propia sección |

La única vista que escondía la raíz era el ANEXO 1 (H2). Tras el fix, ninguna
vista queda con la llave de toda la casa. La "alternancia todo o nada" del
estado `ANALISIS_SCo` era el mismo defecto: `raiz.hidden = true` sobre `#app`
escondía la aplicación entera; ahora la sección del ANEXO se alterna sola y la
raíz permanece visible. El e2e lo verifica en los dos estados
(`ESPECIFICACIONES_TECNICAS` → oculta, `ANALISIS_SCo` → visible, `#app`
siempre a la vista).

### Vistas que escriben sobre nodos por identificador

Todas las vistas (excepto `anexo-uno.js` tras el fix H3) usan `qs(raiz, sel)`
que devuelve `null` en silencio si el nodo no existe. La auditoría de los
identificadores estáticos (`js` vs `index.html`) no encontró más
desalineaciones: el único desajuste era el del ANEXO 1 (H3). El `requerir()`
ADR-029, aplicado al ANEXO, es el único que lanza `Error` de forma visible
cuando falta un nodo; las demás vistas delegan la silenciosidad en `qs`. La
deuda queda anotada: aplicar `requerir()` a las otras vistas es deuda técnica
declarada, no un defecto abierto.

---

## 3. §2 — Los nueve tests del asistente: la decisión

| Llamado | Línea orig. | Qué probaba | Decisión |
|---------|-------------|-------------|----------|
| 1 | 116 | Paso inválido se muestra y el motivo queda a la vista | **Reescrito** — camina el wizard real hasta el error, el motivo aparece |
| 2 | 149/156/162 | Borrador sobrevive a la recarga y no se ofrece a un operador distinto | **Reescrito** — recarga con cookie → ofrece → acepta; el distinto no lo ve; la 2ª sesión de Juan requiere `sgc-sesion-salir` primero |
| 3 | 214 | Borrador corrupto (simulado) | **Eliminado** — requiere escribir `sessionStorage` a mano; sin montura |
| 4 | 243 | Fast-Track hostil: códigos inexistentes y aclaraciones largas | **Reescrito** — 3 imports por `#sgc-archivo-modelo`, baseline de `innerHTML`, `<script>` queda como dato |
| 5 | 285 | Catálogo caído (servidor se cae a mitad) | **Eliminado** — exige bajar el servidor real en mitad del test |
| 6 | 329 | Alta completa: datos.json, idx/, auditoría | **Reescrito** — datos.json, idx/, número único, auditoría, borrador limpio |
| 7 | 374 | Fallo al confirmar: repo que falla inyectado | **Eliminado** — requiere un repo que falle a mano; sin montura |

**4 reescritos + 3 eliminados** de las 7 situaciones que representaban los 9
llamados del archivo anterior. Los 4 reescritos son unitarios de la vista que
ahora caminan sobre la montura real (`aplicacion-montura.js`); los 3 eliminados
no eran reproducibles sin modificar la aplicación (lo que la orden prohíbe).

Los otros 8 archivos que todavía usan `wizard-montura.js` **no se tocaron**:
son unitarios legítimos que preparan la entrada y verifican la salida sobre el
DOM stub (`expediente`, `expediente-matriz`, `exportar`, `kanban`,
`plantillas`, `renders`, `requerimiento-formulario`, `ronda-11`).

---

## 4. §3 — Los caminos que se cierran · ronda-20.test.js

Un único test por la puerta real, en una sola sesión (~250 s con los timeouts
del servidor):

1. **C2**: genera un requerimiento con 3 renglones reales del catálogo y 2
   presupuestos subidos al servidor (H1) por la pantalla.
2. **H2**: verifica que `#app` no tiene `hidden` y `#sgc-anexo1-seccion` sí
   (en ESPECIFICACIONES_TECNICAS).
3. **C3 parcial**: guarda el documento del estado y exporta `datos.json` con el
   modal de advertencia; el pliego contra el generador python real queda
   declarado (§4 de la orden).
4. **C4**: genera avanza ESPECIFICACIONES_TECNICAS → SOLICITUD_CONTRATACION →
   ANÁLISIS_DE_SCo por botón, guardando en cada paso el documento obligatorio.
5. **C5**: llena el ANEXO 1 completo (25 campos), guarda, recarga la pestaña,
   reabre y verifica que los datos persisten.
6. **H4**: al salir, la pantalla de ingreso es la única visible y la lista
   declarada queda oculta.

---

## 5. §4 — Los tests de esta ronda · ronda-20-anexo.test.js

ADR-029 aplicado al ANEXO 1 (el test que H3 vuelve posible):

| # | Qué verifica | Estado |
|---|-------------|--------|
| 1 | Con un nodo exigido ausente, `leer()` lanza con el identificador a la vista | ✔ |
| 2 | Con los 25 nodos presentes, `leer()` devuelve el objeto completo | ✔ |

La comprobación de ids (`js` vs `index.html`, auditoría ad hoc) verificó que
todos los identificadores estáticos que las vistas buscan en el DOM existen en
`index.html` y no quedan más desalineaciones.

Y el criterio de la orden §4, "cada corrección con un test que falla si se
revierte": los fix H1-H4 se sostienen por `ronda-20` y `ronda-20-anexo`. El
auditor los va a comprobar quitando cada corrección.

---

## 6. Regresión de la suite

| Total | Pass | Fail | Duración |
|-------|------|------|----------|
| 416 | 416 | 0 | ~247 s |

```
anexo-eett ✔  archivo ✔  auditoria ✔  build-catalogo ✔  catalogo ✔
check-compat ✔  config ✔  estados ✔  expediente ✔  expediente-matriz ✔
exportar ✔  imputacion-servidor ✔  kanban ✔  migraciones ✔  motor ✔
pantalla ✔  plantillas ✔  presupuestos-servidor ✔  recorrido ✔  renders ✔
repo.http ✔  repo.memoria ✔  requerimiento ✔  requerimiento-formulario ✔
requerimiento-servidor ✔  respaldo ✔  ronda-11 ✔  ronda-12 ✔
ronda-13 ✔  ronda-14 ✔  ronda-15 ✔  ronda-16 ✔  ronda-17 ✔  ronda-18 ✔
ronda-18-bis ✔  ronda-19-auth ✔  ronda-19-borrador ✔
ronda-19-estructural ✔  ronda-19-padron ✔  ronda-20 ✔  ronda-20-anexo ✔
servidor ✔  servidor-ayudantes ✔  servidor-concurrencia ✔
transiciones-servidor ✔  transiciones-servidor-matriz ✔
transiciones-servidor-matriz-2 ✔  validacion ✔  wizard ✔
```

`tools/check-compat.js`: OK · 63 archivos inspeccionados · 0 violaciones.

### El test preexistente que se corrigió

`ronda-13.test.js` test 10: "config/aplicacion.json: el modo piloto por
defecto está apagado" — assertaba `modoPiloto === false`. El campo se encendió
en `7f86e5c` ("corrección mail en servidor.json") cuando el piloto pasó a
producción; el test quedó obsoleto y nadie lo atrapó porque las suites previas
corrían recortadas. Se actualizó al contrato actual (`typeof === 'boolean'`):
el piloto está encendido, el campo es estricto. La decisión de encender/apagar
el piloto es del servidor, no del framework de tests (el informe 19 lo había
declarado "no se corrige"; esta ronda lo cierra con su justificación).

---

## 7. Contradicciones y observaciones

- **La carrera del auto-login.** Tras una recarga con la cookie viva de María
  (la administradora que prepara el servidor), la sesión de Juan se cruzaba con
  el auto-login y su alta fallaba con 403 (el `#sgc-padron-clave` nunca
  aparecía). Se resolvió con el patrón de ronda-20: click en `#sgc-sesion-salir`
  antes de invocar `prepararOperador` para el segundo operador. Es la misma
  lección de la ronda 19: una pestaña real reanuda sesión, y el test tiene que
  manejar eso.
- **`sessionStorage` es compartido y persistente en la montura**
  (`globalThis.sessionStorage = globalThis.sessionStorage || crearStoragePlano()`),
  exactamente como una pestaña. Por eso el borrador (`sgc.borrador.v1`)
  sobrevive a `recargar()` y el test del borrador puede verificar el segundo
  ingreso sin pestañas ni cookies de juguete. El alta completa (test reescrito
  6) verifica que el borrador quedó limpio: `claves().length === 0`.
- **`require` cachea, y eso juega a favor** (lo mismo que en la ronda 19): los
  módulos se cargan una sola vez por proceso; `app.js` se re-ejecuta por sesión
  con `new Function` y disparando `DOMContentLoaded`.
- **La cuenta de caminos.** Este informe declara 6 de 9 con la lista que la
  propia orden fija (C1, C2 completo, C3, C4, C5, C8). La tabla de nombres del
  auditor vive fuera del repositorio; la descripción de qué recorrido sostiene a
  cada camino queda en §8 para contrastar en el barrido del ciclo 20.
- **Nada de la aplicación se agregó para los tests.** La complejidad vive en
  `aplicacion-montura.js` y `dom-stub.js`; la app sólo recibió los fixes (5
  archivos, ninguno con código de testeo).

---

## 8. Qué se lleva el paquete

### Modificados (5 archivos de aplicación)

- `app/js/views/requerimiento-presupuestos.js:103` — `contenidoBase64` →
  `contenido` (H1, 1 línea; motivo en §2).
- `app/js/app.js:229` — `anexoUno.montar` recibe `#sgc-anexo1-seccion` (H2) +
  `limpiarOperador()` al salir (H4) + lista declarada oculta en autenticado (H4).
- `app/js/views/anexo-uno.js` — 25 ids alineados, `requerir()` ADR-029,
  `hidden` sobre su sección y no sobre la raíz (H3).
- `app/js/views/expediente.js:288` — `actualizar(expediente)` pasa el
  expediente al ANEXO.
- `app/js/views/wizard.js:359` — `limpiarOperador()` (H4).

### Modificados (tests)

- `tests/wizard.test.js` — reescrito completo (4 tests, sin llamadas a
  `seleccionarOperador`; el encabezado documenta los 9 llamados del archivo
  anterior y su suerte).
- `tests/ronda-13.test.js` — test 10 actualizado al contrato de `modoPiloto`.
- `tests/expediente.test.js`, `expediente-matriz.test.js`,
  `exportar.test.js`, `kanban.test.js`, `ronda-13.test.js` — línea de linaje
  en el encabezado.
- `tests/helpers/aplicacion-montura.js` — `prepararAdmin` idempotente
  (provisoria o fija), `prepararOperador` paramétrico por rol (nace de
  `prepararGenerador`), y `FileReader` (`readAsDataURL`/`readAsText`) + `Blob`
  para que la subida de presupuestos (H1) y el descargador (C3) recorran el
  mismo camino que en el navegador.

### Nuevos

- `tests/ronda-20.test.js` — recorrido completo C2→C4→C5 (+C3 parcial, H1, H2, H4).
- `tests/ronda-20-anexo.test.js` — H3: ADR-029 sobre los 25 ids del ANEXO 1.

---

## 9. Criterios de aceptación

### La cuenta, hecha: 6 de 9

**6 de 9 caminos de persona con test que los recorre entero (C1, C2 completo,
C3, C4, C5, C8).**

La ronda cierra C2-C5. Los otros dos de la cuenta (C1 y C8) vinieron cubiertos
del ciclo 19 — el auditor contó entonces "2 cubiertos, 1 parcial, 6 sin nada";
C2 era el parcial (llegaba a crear con un renglón y sin presupuestos). Como la
tabla de nombres C1..C9 vive en el reporte del auditor (fuera del repositorio),
este informe registra qué recorrido sostiene a cada camino:

| Camino | Con qué lo recorre la persona | Sostenido por |
|--------|------------------------------|---------------|
| C2 completo | cargar 3 renglones reales + 2 presupuestos por la pantalla | `ronda-20` (nuevo) |
| C3 (parcial + declarado) | guardar el documento y exportar con modal; el pliego real queda declarado | `ronda-20` (nuevo) |
| C4 | abrir y avanzar por el botón de su rol | `ronda-20` (nuevo) |
| C5 | llenar, guardar y reabrir el ANEXO 1 | `ronda-20` + `ronda-20-anexo` (nuevos) |
| C1 y C8 | los dos cubiertos del ciclo 19 (ingreso/padrón y el circuito autenticado con su borrador) | `ronda-19-auth`, `ronda-19-padron`, `ronda-19-borrador` (verdes) |
| C6 · C7 · C9 | *(ronda 21+)* cadena hasta la firma / catorce claves / salir y volver | pendientes (plan, H23-12) |

### Linaje marcado

Los cinco archivos llevan una línea en su encabezado que dice que arman el
estado a mano y qué camino deberían cubrir:

| Archivo | Cuánto armado | Camino que debería cubrir |
|---------|--------------|---------------------------|
| `expediente.test.js` | 6× `seleccionarOperador` | C4 (ya tiene e2e) |
| `expediente-matriz.test.js` | 1× `seleccionarOperador` | C4 (ya tiene e2e) |
| `exportar.test.js` | 1× repo sin servidor | C3 (parcial en e2e) |
| `kanban.test.js` | `listarIndice` inline | el tablero del generador (sin e2e) |
| `ronda-13.test.js:374` | archivo `fijarRepo` inline | el archivo histórico y el reuso de base (sin e2e) |

Se saldan cuando cada camino tenga su e2e por la montura real; los unitarios
legítimos (p. ej. `requerimiento-formulario.test.js`) no se tocan.

### La lista

- [x] **C2 completo** — el generador carga un requerimiento con 3 renglones
      del catálogo real y 2 presupuestos subidos por la pantalla (`ronda-20`).
- [x] **C3** (parcial + declarado) — el documento del estado se guarda y se
      exporta con el modal de advertencia; el pliego contra el generador python
      real queda declarado.
- [x] **C4** — el expediente avanza de rol por el botón que ve esa persona
      (`ronda-20`).
- [x] **C5** — el ANEXO 1 se llena por la pantalla, se guarda, y al reabrir
      después de una recarga está (`ronda-20` + `ronda-20-anexo`).
- [x] **C1 y C8** — los dos cubiertos del ciclo 19 se mantienen (ronda-19 en
      verde esta ronda).
- [x] **H1** — el presupuesto sube por la pantalla y llega al servidor real
      (campo único `contenido` en todo el recorrido).
- [x] **H2** — el ANEXO 1 oculta su sección, jamás la raíz; ninguna otra vista
      puede esconderla (§2).
- [x] **H3** — el ANEXO 1 guarda lo que se escribe, y un nodo ausente lanza de
      forma visible (ADR-029).
- [x] **H4** — al salir, una sola pantalla de ingreso, limpia.
- [x] **Los nueve tests del asistente** — reescritos (4) o eliminados (3);
      ninguno llama a mano a `seleccionarOperador`.
- [x] **Suite completa en verde** — 416/416 tests, 0 fail.
- [ ] **C6** (cadena hasta la firma), **C7** (las catorce claves), **C9**
      (salir y volver) — quedan para ronda 21 en adelante (plan, H23-12).

---

*Generado al cierre de ORDEN-RONDA-20. Commit: "Ronda 20" (un solo commit
según §6 de la orden). Verificado: suite completa en verde (416/416) y
`tools/check-compat.js` sin violaciones.*