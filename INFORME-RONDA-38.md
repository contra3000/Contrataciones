# INFORME-RONDA-38.md
Ronda 38 — La justificación al cambiar de proceso, y la modalidad común u OCA
SGC — 2026-10-17

## 1. Qué hice

Se completaron las dos piezas de `ordenes/ORDEN-RONDA-38.md` (hito H27). La pieza 1
hizo que cambiar el proceso del PAC pida revisar la justificación del PAC, aunque
la causa sea la misma. La pieza 2 agregó la **modalidad de compra** al generador:
Común u Orden de Compra Abierta; con OCA pide la justificación (con la guía de la
norma), la cantidad máxima de cada renglón, y la causal de la OCA cita sólo el
Decreto 1030/2016. "Objetivo" salió de Fundamentación.

Cada pieza corrió la **suite completa en verde antes de su commit**, como pide la
orden desde la 36. No hubo deuda.

- **Paso 0 (commit `3e2e79f`, ya publicado).** `ordenes/` con la orden y su
  auditoría, y `PLAN_DESARROLLO.md`. Sin cuerpo y sin nada más.

- **Pieza 1: la justificación se revisa al cambiar de proceso (commit `5d4d808`,
  6 files, 374 insertions, 4 deletions).**
  - Junto con `pac.causas`, se guarda **`pac.procesoJustificado`**: el número de
    proceso, o `no-autorizado`, cuando se escribe o se confirma la justificación
    (`views/wizard.js` `guardarCausasPac()`).
  - `core/validacion.js` `cerrarCausas()` también pide revisar si
    `pac.procesoJustificado` no es el proceso de ahora. Un archivo con `pac.causas`
    y sin `pac.procesoJustificado` (de la 37) toma el de ahora: no pide revisar.
  - `views/wizard-formulario.js` conserva `procesoJustificado` al reconstruir el
    `pac`; `generador/documentos.js` (`pacDelWizard`) e `generador/intercambio.js`
    (`pacExportado` + las dos ramas del import) lo llevan por el JSON.
  - **El aviso se va en el momento** (lo que dejó la 37, punto b de la orden).
  - Tests: `tests/ronda-38-p1.test.js` (5, por la pantalla del generador).

- **Pieza 2: la modalidad común u OCA (commit `c000ce1`, 31 files, 904
  insertions, 29 deletions).**
  - **a.** `generador.html`: `<select id="sgc-modalidad">` con opción vacía,
    `comun` ("Común") y `oca` ("Orden de compra abierta (OCA)"), obligatorio con
    la marca del generador, después del PAC. `core/validacion.js`
    `validarIdentificacion()` lo exige **sólo con la marca o si el campo existe**,
    y el mensaje "Elegí la modalidad de compra" lleva el foco al select
    (`views/pasos.js` `camposTituloDelError`).
  - **b.** Con OCA: `#sgc-oca-justificacion-campo` en "3 · Fundamentación", con la
    guía de la norma arriba y el mismo trato que la del PAC (`views/pasos.js`
    `validarFundamentacion()` frena "Siguiente"; `generador/documentos.js`
    `itemsOca()` frena "Imprimir" y "Exportar" con *"justificar la modalidad
    orden de compra abierta"* y *"Renglón N: falta la cantidad máxima por
    Solicitud de Provisión"*); y en "2 · Renglones" la **"Cantidad máxima por
    Solicitud de Provisión"** (obligatoria, `aria-label` exacto) y la "Cantidad
    mínima" (opcional), con las reglas del núcleo (`validarCantidades`, sin
    tocarlas).
  - **c.** `renders/requerimiento.js` `CAUSAL_OCA_NORMATIVA` pasa a nombrar sólo
    el **Decreto 1030/2016, art. 25 inc. c)**, con el texto de la guía. Es la
    única línea del documento que cambió, y sólo aparece en un expediente con OCA.
  - **d.** "Objetivo" salió de Fundamentación. El JSON sigue llevando
    `objetivo: ""` y un objetivo importado se conserva sin mostrarse
    (`views/wizard-formulario.js` y `views/wizard.js` sólo tocan el nodo si
    existe).
  - **e.** El JSON lleva `modalidad`, `ocaJustificacion` y por renglón
    `cantidadMaxima`/`cantidadMinima`, ida y vuelta; el avance los guarda y los
    recupera; la plantilla y sus instrucciones no cambiaron.
  - **Un hallazgo propio:** `generador.html` **no cargaba
    `js/views/requerimiento-oca.js`** (la pantalla del servidor sí). Era por eso
    que en "2 · Renglones" no aparecían las cantidades de la OCA. Se agregó el
    `<script>` en el mismo commit; `tools/empaquetar-generador.js` toma la lista
    de archivos del propio HTML, así que el paquete queda consistente.
  - Tests: `tests/ronda-38-p2.test.js` (7, por la pantalla del generador) y la
    cita de la causal en `tests/plantillas.test.js`.

### Tests viejos que cambié, uno por uno

`git diff --stat 3e2e79f..HEAD -- tests/` (20 files, 833 insertions, 1 deletion):

```
 tests/helpers/generador-montura.js |  46 ++++
 tests/plantillas.test.js           |   6 +-
 tests/ronda-28-c3.test.js          |   1 +
 tests/ronda-28-c4.test.js          |   1 +
 tests/ronda-29-p2.test.js          |   1 +
 tests/ronda-30-p1.test.js          |   1 +
 tests/ronda-30-p2.test.js          |   1 +
 tests/ronda-31-p1.test.js          |   1 +
 tests/ronda-31-p2.test.js          |   1 +
 tests/ronda-32-p1.test.js          |   1 +
 tests/ronda-34-p1.test.js          |   1 +
 tests/ronda-34-p2.test.js          |   2 +
 tests/ronda-35-p1.test.js          |   1 +
 tests/ronda-35-p2.test.js          |   1 +
 tests/ronda-36-p1.test.js          |   1 +
 tests/ronda-36-p2.test.js          |   1 +
 tests/ronda-37-p1.test.js          |   1 +
 tests/ronda-37-p2.test.js          |   8 +
 tests/ronda-38-p1.test.js          | 322 +++++++++++++++++++++++++++
 tests/ronda-38-p2.test.js          | 436 +++++++++++++++++++++++++++++++++++++
 20 files changed, 833 insertions(+), 1 deletion(-)
```

La modalidad nueva es obligatoria, así que todo expediente que se arme por la
pantalla o se importe por JSON tiene que elegirla. Diecisiete archivos viejos
tuvieron que decir qué modalidad usan; **en todos el cambio es de una línea, y
ninguno cambió de asunto.** Cómo quedó cada uno:

**Con `m.elegirModalidad('comun')` al llenar la pantalla** (una línea, en el
mismo punto donde se escribe el lugar de entrega; sin ella "Siguiente" ya no
sale de Identificación):

1. **`tests/ronda-28-c3.test.js`** (7 tests · "rol Usuario: el requerimiento, los
   valores, los documentos"). Copia la pantalla del servidor y compone la Solicitud
   de Gastos y la EETT. El expediente que arma ahora elige Común: las
   cantidades de la OCA no aparecen y el impreso sale como siempre.
2. **`tests/ronda-28-c4.test.js`** (9 tests · "plantilla, importar y exportar").
   Baja la plantilla, exporta, importa y vuelve a exportar: el sello es lo único
   que cambia. La ida y vuelta ahora también comprueba que `modalidad: "comun"`
   vuelve igual.
3. **`tests/ronda-29-p2.test.js`** (8 tests · "identidad y documentos sin firma").
   Identidad del operador y sello del JSON. Elige Común.
4. **`tests/ronda-30-p1.test.js`** (3 tests · "presupuestos distintos de verdad").
   Presupuestos repetidos y renglones sin unidad. Elige Común.
5. **`tests/ronda-30-p2.test.js`** (5 tests · "Guardar avance" que se descarga).
   El avance se guarda, se reimporta y se rechaza si se tocó un byte. Elige
   Común.
6. **`tests/ronda-31-p1.test.js`** (3 tests · "un documento de referencia no es un
   archivo que se sube"). Documentos de referencia con huella y leyenda impresa.
   Elige Común.
7. **`tests/ronda-31-p2.test.js`** (5 tests · "lo que traba o no se ve"). Incluye
   el test 2d, que afirma que "Siguiente" lleva el foco al primer campo con
   error: el foco a `#sgc-modalidad` de la pieza 2a entra en el mismo esquema.
   Elige Común.
8. **`tests/ronda-32-p1.test.js`** (3 tests · "el arreglo h1, y la versión en el
   paquete"). Plantilla y CSS. Elige Común.
9. **`tests/ronda-35-p1.test.js`** (5 tests · "Identificación obligatoria también
   en archivos viejos"). Es el test que enseñó el patrón de los campos
   obligatorios con la marca del generador (ronda 35): ahora la modalidad se le
   suma al mismo grupo de trimestre, PAC y lugar de entrega. Elige Común.
10. **`tests/ronda-36-p2.test.js`** (3 tests · "el requerimiento sin Lugar").
    Elige Común.
11. **`tests/ronda-37-p1.test.js`** (2 tests · "el requerimiento dice el lugar de
    entrega", con su control byte a byte del requerimiento del servidor). Elige
    Común: el control sigue pasando porque el expediente con OCA es el único que
    cambia, y este es Común.

**Con `modalidad: 'comun'` en el JSON que importan** (una línea en el helper del
expediente; sin ella el import pide la modalidad y esos tests se quedan en
Identificación):

12. **`tests/ronda-34-p1.test.js`** (5 tests · "Trimestre y los campos de los
    documentos"), en `exportadoCompleto()`.
13. **`tests/ronda-34-p2.test.js`** (8 tests · "El proceso del PAC en
    Identificación"), en `exportadoConPac()`. Este es el único que cambió en los
    dos lugares: además de la línea del JSON, su recorrido por la pantalla (los
    tests 2a y 2b) eligió la modalidad con `m.elegirModalidad('comun')`, porque
    ahí se arma el expediente de cero. Por eso su diff son dos líneas.
14. **`tests/ronda-35-p2.test.js`** (4 tests · "La moneda del proceso del PAC"),
    en `exportadoConPac()`.
15. **`tests/ronda-36-p1.test.js`** (6 tests · "La justificación del PAC, en
    Fundamentación y por sus causas"), en `archivo()`.
16. **`tests/ronda-37-p2.test.js`** (8 tests · "La justificación del PAC, al
    día"), en `archivo()`. **Además tuvo un cambio de fondo en su test 2f:** ese
    test importa `tests/fixtures/r36-avance-justificado.json`, que es un avance
    auténtico de la ronda 36 **sin modalidad** (y con huella, que no se recalculó
    porque el fixture no se toca). El test ahora elige la modalidad **en
    pantalla**, después de importar y antes de seguir:
    `await ir('identificacion'); m.elegirModalidad('comun'); await
    ir('fundamentacion');`. El resto del test (la revisión de la justificación
    por el cambio de causas) quedó igual y sigue verde.
17. **`tests/ronda-38-p1.test.js`** (5 tests · "La justificación del PAC se
    revisa también al cambiar de proceso"), en `archivo()`.

**Un test de asunto, no de relleno:**

18. **`tests/plantillas.test.js`** (10 tests · "el requerimiento descompone el
    código, imprime el preventivo en letras y la OCA"). Su aserción de la causal
    de la OCA pasó de nombrar "Art. 25 inc. c) del Decreto 1023/01 y Art. 111 del
    Decreto 1030/16" a nombrar **"Decreto 1030/2016, art. 25 inc. c)"** (pieza
    2c). También verifica que la tabla de la OCA y la cantidad mínima sigan
    imprimiéndose como antes.

**Y una ayuda nueva en `tests/helpers/generador-montura.js` (+46):**
`m.elegirModalidad(valor)` (elige y dispara el `change`, como una persona) y
`m.cargarOca(filasPorRenglon)` (escribe cantidad máxima y mínima en cada
renglón). No es un test: es lo que usan los tests nuevos.

**Qué NO cambié, y por qué:** `tests/ronda-32-p2.test.js`,
`tests/ronda-33-p1.test.js` y `tests/ronda-33-p2.test.js` usan la montura pero no
arman un expediente por Identificación, así que no necesitaron modalidad. Y los
controles de "requerimiento del servidor byte a byte" (`ronda-34-p1` 1e,
`ronda-36-p2` 2c, `ronda-37-p1` 1b, `ronda-37-p2` 2h) siguen intactos y en verde.

## 2. Decisiones que tomé y por qué

- **La modalidad vive en `identificacion.modalidad` y se decide en un solo
  lugar.** `core/validacion.js` `modalidadOca(datos)` es el único predicado; la
  pantalla (`wizard.js`, `pasos.js`) y la exportación (`documentos.js`) lo usan,
  así que el freno y el campo no pueden divergir. Con servidor no hay campo, el
  predicado da falso y nada cambia (ADR-044).
- **Obligatoria sólo con la marca o si el campo existe** (mismo criterio que
  trimestre, PAC y lugar de entrega de la ronda 35). Así un archivo importado
  pide la modalidad, pero la aplicación con servidor, que no la tiene, no se
  entera.
- **Las cantidades de la OCA quedaron donde estaban:** en el módulo de pantalla
  `views/requerimiento-oca.js`, que ya existía. Lo nuevo es que
  `generador/valores.js` las recuerda por id de renglón (`cantidadesPorId`) y las
  sube a los datos sólo con `mostrarOca`, como `cantidadMaxima`/`cantidadMinima`
  numéricos. El núcleo `validarCantidades` no se tocó: la misma función valida lo
  que se imprime y lo que frena.
- **`requerimiento.oca` en el expediente local enciende el render, sin código
  nuevo en el render.** El bloque de la OCA del requerimiento ya existía
  (`ocaActiva()`); lo que faltaba era que el generador lo alimentara. Por eso la
  única línea del documento que cambió es la de la causal.
- **`itemsOca()` frena Imprimir y Exportar con la misma lista**, y el motivo que
  aparece en `#sgc-exportar-msj` es el mismo que ve la persona al imprimir: no
  puede salir un papel que el botón de exportar no deja exportar.
- **"Objetivo" se quitó de la pantalla, no del archivo.** Todo lo que lo
  tocaba quedó con guarda (`if (campoInput(...))`), así que un objetivo
  importado se conserva en los datos y simplemente no se muestra.
- **El fixture `tests/fixtures/r36-avance-justificado.json` no se tocó.** Tiene
  huella, y recalcularla lo haría un archivo "de la 38". Además es justamente lo
  que pide el test 7 de la orden: un avance escrito antes de esta pieza, sin
  modalidad. Lo usa `ronda-37-p2` 2f (ahora elige la modalidad en pantalla) y
  `ronda-38-p2` 2g.
- **Los tests viejos se arreglaron con una línea por archivo, con la orden
  declarada en el comentario**, siguiendo el precedente de la ronda 35 (commit
  `30c6c32`, 8 archivos, 8 inserciones). No se reescribieron tests: se les dijo
  qué modalidad usan.
- **`generador.html` carga `requerimiento-oca.js`.** Sin ese `<script>` las
  cantidades de la OCA no existían en la pantalla del generador. Lo descubrió el
  test nuevo (el helper no encontraba `data-oca-max`), no una revisión manual.

## 3. Verificación

Corridas completas, todas documentadas, no sólo la mejor.

Suite completa:

```
node --test --test-timeout=120000 --test-force-exit "tests/*.test.js"
```

| corrida | tests | pass | fail | duration_ms | log / nota |
|---|---|---|---|---|---|
| pieza 1 · sesión | 675 | 675 | 0 | — | declarada en el cuerpo de `5d4d808` (log de la sesión no conservado) |
| pieza 2 · ronda-38-p2, antes de arreglar | 7 | 5 | 2 | 3674.73 | `%TEMP%\r38p2.txt` |
| pieza 2 · generador (23 archivos de montura) | 125 | 125 | 0 | 69383.6483 | `%TEMP%\gen-tap.txt` |
| pieza 2 · plantillas + empaquetar | 18 | 18 | 0 | — | `%TEMP%\fastcheck.txt` |
| pieza 2 · completa, 1ª corrida (2 flakes de servidor) | 683 | 681 | 2 | 691056.7481 | `%TEMP%\full-tap.txt` |
| final del informe (HEAD `c000ce1`) | 682 | 682 | 0 | 659165.0868 | `%TEMP%\full-tap2.txt` |

Cola de la corrida final (copiada del log):

```
# tests 682
# suites 0
# pass 682
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 659165.0868
```

Los tests de la ronda, en esa corrida (copiados del log de la corrida dirigida
de la pieza 2, `%TEMP%\r38p2.txt`, que dio los mismos 7 nombres):

```
ok 1 - RONDA-38 pieza 2a · sin modalidad "Siguiente" no pasa de Identificación y el foco queda en \#sgc-modalidad
ok 2 - RONDA-38 pieza 2b · con "Común" no hay justificación de la OCA ni cantidades máximas, y exporta como siempre
ok 3 - RONDA-38 pieza 2c · con OCA, sin justificación: Fundamentación dice "falta", la guía cita el Decreto, y no imprime ni exporta
ok 4 - RONDA-38 pieza 2d · con OCA y sin cantidad máxima en un renglón: no exporta y el motivo nombra el renglón
ok 5 - RONDA-38 pieza 2e · con OCA completa el requerimiento trae la justificación, la tabla y la nota; el JSON trae modalidad y cantidad máxima
ok 6 - RONDA-38 pieza 2f · en "3 · Fundamentación" ya no hay \#sgc-objetivo
ok 7 - RONDA-38 pieza 2g · un avance escrito antes de esta pieza, sin modalidad, pide la modalidad antes de exportar
```

Tests dirigidos de la pieza 2 (camino rápido):

```
node --test --test-timeout=120000 --test-force-exit tests/ronda-38-p2.test.js
```
→ 7 tests, 7 pass, 0 fail, duration_ms 3672.6763 (`%TEMP%\r38p2.txt`).

Los dos fallos de la corrida intermedia **no son regresiones**: son los dos
suites que levantan servidor HTTP real corriendo en paralelo. Al correrlos solos
pasan los dos (`presupuestos-servidor.test.js` abortó con `exitCode
3221226505`, y `ronda-25-c3.test.js` 401 falló por interferencia; aislados:
11 tests / 10 pass con los dos archivos juntos, y 2/2 cada uno por su cuenta).
La corrida final, sin procesos colgados, dio 682/682.

Controles:

- `node tools/check-compat.js` → **OK — 6994 archivo(s) inspeccionado(s), 0
  violaciones** (código 0).
- `node tools/build-config.js --verificar` → **OK — 2 archivo(s) al día** (código 0).
- `git diff --stat 3e2e79f..HEAD -- server/` → **vacío** (la ronda no toca
  `server/`).
- `git status` → árbol limpio tras los commits.

## 4. Contradicciones e información faltante

- **Ninguna contradicción de la orden.** Las dos piezas corrieron la suite
  completa antes de commitear y quedaron en verde.
- **El commit de la pieza 2 difiere del que nombra la orden.** La orden propone
  `Ronda 38 · modalidad común u OCA`; el commit salió como `Ronda 38 · modalidad
  de compra: común u orden de compra abierta` (mismo sentido, redacción más
  larga, ya publicado). Lo dejo declarado; no reescribí historia publicada.
- **El test 7 de la orden dice "un avance de la 37" y el test usa el avance de
  la 36.** El repositorio no tiene un fixture de avance de la 37;
  `tests/fixtures/r36-avance-justificado.json` es un avance auténtico, anterior a
  esta pieza, **sin `modalidad`**, que es exactamente lo que el test necesita (y
  además trae una justificación del PAC escrita, así que se puede exportar
  apenas se elige la modalidad). Declarado; el fixture no se tocó.
- **Los números de línea que cita la orden** (`generador.html:194-195`,
  `generador.html:336-337`, `renders/requerimiento.js:49-52`,
  `core/requerimiento.js:186`) quedaron aproximados; los bloques se ubicaron por
  su contenido, sin ambigüedad.
- **La orden dice "es la única línea que puede cambiar en la aplicación con
  servidor" refiriéndose a la causal.** Se cumple para el **documento impreso**:
  el requerimiento del servidor sale byte a byte igual salvo en un expediente con
  OCA, donde cambia la cita. Aparte, y porque la orden lo pidió con esas
  palabras, cambiaron los `aria-label` de los inputs de la OCA en
  `views/requerimiento-oca.js` ("Cantidad máxima del renglón N" → "Cantidad
  máxima por Solicitud de Provisión"): es una vista compartida, así que la
  pantalla del servidor con un expediente OCA muestra las etiquetas nuevas. No es
  un documento ni un test del servidor.
- **La suite completa flakeó una vez** con los dos archivos de servidor HTTP en
  paralelo (ver §3). No se modificó ningún test del servidor por eso.
- **La prueba del Jefe (`PRUEBAS-JEFE\prueba-ronda-38.js`) no la corrí:** usa
  Playwright/Chromium y en este entorno no hay navegador. Es lo mismo que las
  rondas 30 a 37. La prueba está escrita y
  `PRUEBAS-JEFE\DEVOLUCION-RONDA-38.md` está lista para que la complete el Jefe.

## 5. Qué NO hice

- No toqué `server/` (verificado: `git diff --stat 3e2e79f..HEAD -- server/`
  vacío).
- No modifiqué los tests de la aplicación con servidor.
- No modifiqué la orden, la auditoría ni `PLAN_DESARROLLO.md` (los tocó el paso
  0).
- No toqué la plantilla ni sus instrucciones (pieza 2e).
- No toqué `tests/fixtures/r36-avance-justificado.json` (ver §2).
- No reescribí ningún test viejo: a los diecisiete les agregué una línea que dice
  qué modalidad usan, y a `plantillas.test.js` le cambié la aserción de la cita.
- No corrí la prueba del Jefe en navegador (no hay Playwright en este entorno).

## 6. Riesgos que veo

- **La suite completa flakea con carga.** Los dos archivos que levantan servidor
  HTTP real (`presupuestos-servidor.test.js`, `ronda-25-c3.test.js`) fallan si
  corren en paralelo con el resto; solos pasan. Conviene correr la suite con
  margen, y si algo raro aparece en esos dos, correrlos aislados antes de
  concluir que es una regresión.
- **La modalidad es el cuarto campo obligatorio del generador.** El patrón está
  repetido en cuatro lugares (HTML, `validarIdentificacion`, `camposTituloDelError`
  y el marcado del error). Un quinto campo obligatorio tendría que repetirlo; ya
  hay precedente escrito (ronda 35, ronda 38).
- **Las cantidades de la OCA se recuerdan por id de renglón** (`cantidadesPorId`),
  igual que los valores de referencia: si el catálogo volviera a numerar los ids,
  las cantidades seguirían al id, no a la posición. Es el mismo contrato que ya
  rige para los valores.
- **`views/requerimiento-oca.js` es una vista compartida.** Cambiar ahí afecta a
  la pantalla del servidor cuando abre un expediente OCA (hoy: los `aria-label`).
  Es raro pero no imposible; conviene mirarlo dos veces.
- **`tools/check-compat.js` contra `app/` es lento** (camina 6994 archivos). El
  control que corre por defecto es el de la suite (`tests/check-compat.test.js`).

## 7. Medidas (métricas)

- Suite completa final (log): **682/682** en 659165.0868 ms (≈ 11,0 min).
- Suite completa de la sesión: pieza 1 **675/675**; pieza 2 final **682/682**.
- Corrida intermedia con flakes: 683 tests, 681 pass, 2 fail (691056.7481 ms).
- Generador (23 archivos de montura, incluida la ronda 38): **125/125** en
  69383.6483 ms.
- Dirigidos de la pieza 2: 7/7 en 3672.6763 ms.
- `check-compat.js`: 6994 archivos, 0 violaciones.
- `build-config.js --verificar`: 2 archivos al día.
- `git show --stat`:
  - `5d4d808` (pieza 1): 6 files changed, 374 insertions(+), 4 deletions(-).
  - `c000ce1` (pieza 2): 31 files changed, 904 insertions(+), 29 deletions(-).

## 8. Accesos fuera del repositorio

- Ninguno nuevo de red. La montura del generador carga los módulos reales por
  `<script>` (file://); la app que se empaqueta no hace fetch ni usa servidor. La
  única salida de red de la suite sigue siendo el test `ronda-12` (Python local).
- `tools/build-config.js` regenera `app/config/*.js` a partir de `config/`;
  `--verificar` controla que estén al día (en verde).
- `PRUEBAS-JEFE\DEVOLUCION-RONDA-38.md` (fuera del repositorio, ya escrita) y
  `PRUEBAS-JEFE\prueba-ronda-38.js` (Playwright, pendiente de navegador real).

## 9. Qué se lleva el paquete — criterios de aceptación (ORDEN-RONDA-38)

- **Pieza 1.** Proceso 4 con el monto superado, justificado; pasar al proceso 5
  que también lo supera pide revisar, frena "Siguiente" y "Exportar", y "Sigue
  valiendo" lo saca en el momento y exporta con `pac.procesoJustificado: "5"`
  (tests 1a, 1b, 1c). Un avance de la 37 entra sin pedir revisión y uno de la 36
  la sigue pidiendo (1d, 1e). Tests 5/5.
- **Pieza 2.** Sin modalidad, "Siguiente" no pasa y el foco queda en el select
  (2a). Con Común no hay justificación ni cantidades y exporta como siempre
  (2b). Con OCA sin justificación Fundamentación dice "falta", la guía cita el
  Decreto, y no imprime ni exporta (2c). Sin cantidad máxima no exporta y el
  motivo nombra el renglón (2d). Con OCA completa el requerimiento trae
  justificación, tabla y nota, **sin "1023/01" ni "Art. 111"**, y el JSON trae
  `modalidad: "oca"`, `ocaJustificacion` y `cantidadMaxima` (2e). "Objetivo" ya
  no está y el objetivo importado se conserva (2f). Un avance sin modalidad pide
  la modalidad antes de exportar (2g). Tests 7/7.
- Suite completa en verde: **682/682**; `check-compat` 0 violaciones.
- Commits con cuerpo: `5d4d808` (pieza 1) y `c000ce1` (pieza 2) — y push hecho.
- Clon en
  `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-38` desde
  GitHub.
- Paquete generado con
  `node tools/empaquetar-generador.js --ronda 38 --destino C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Prueba del Jefe `PRUEBAS-JEFE\prueba-ronda-38.js` (pendiente de que la corra
  el revisor en navegador real; la devolución está escrita).

## 10. Verificación del cierre (ejecutada)

- Informe y su commit: `git add INFORME-RONDA-38.md` →
  `git commit -m "Ronda 38 · informe"` → `git push`.
- Clon para el auditor: `git clone
  https://github.com/contra3000/Contrataciones.git
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-38`
  (ruta absoluta).
- En el clon: `git log --oneline -5` coincide con `dev\`.
- Paquete: `node tools/empaquetar-generador.js --ronda 38 --destino
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Después del clon no se commitea nada. Los dos HEAD van en el mensaje final.
