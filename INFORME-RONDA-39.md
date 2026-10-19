# INFORME-RONDA-39.md
Ronda 39 — Cierre: normalización de códigos, buscar conservado, cantidades de la OCA en el paso, y el test reparado
SGC — 2026-10-19

## 1. Qué hice

Cerré la ronda 39, que había quedado **a medias por el corte de la sesión del
17/10**, siguiendo `ordenes/ORDEN-RONDA-39-CIERRE.md` (ítem 32 de la cola, N1).
No se rehízo nada de cero:

- **Paso 0 (publicación).** Las órdenes y el plan del revisor estaban **sin
  publicar** en `dev\` (ver §4). Se subieron en el commit `cb68358`, **Revisor:
  ordenes y plan al dia**, con las tres órdenes de la 39 (`ORDEN-RONDA-39.md` ya
  estaba publicada; se sumaron `ORDEN-RONDA-39-AUDITORIA.md`,
  `ORDEN-RONDA-39-CIERRE-AUDITORIA.md` y `ORDEN-RONDA-39-CIERRE.md`) y
  `PLAN_DESARROLLO.md`. Es el paso 2.0 del ciclo, en su commit propio: no lleva
  nada de `app\` ni de `tests\`.
- **Paso 2 (el test que no compilaba).** En `tests/ronda-39-p1.test.js:262-263`
  quedó suelto el fragmento `20000, 'los documentos se compusieron');`, sin el
  `await m.esperar(...)` que lo contenía. Se rehízo el bloque: toma la cantidad
  de entregables, aprieta "Imprimir" y espera a que se compongan. **No se cambió
  lo que el test pide.**
- **Dos pasos de armado que faltaban en el mismo archivo** (y que sólo se vieron
  cuando el archivo pudo compilar y correr; ver §4): al test 1a-2 le faltaba
  apretar "Imprimir" antes de mirar "Exportar" (el entregable de la EETT es el
  que habilita la exportación, igual que en `ronda-38-p2`), y al test 1b le
  faltaba escribir la justificación de la OCA en Fundamentación para poder pasar
  a Revisión. Son los dos únicos cambios de armado; las aserciones quedaron
  iguales.
- **Commit de código.** Un solo commit, `6ebff20`, con los **tres archivos que la
  sesión anterior había dejado arreglados pero sin commitear** y el test
  reparado:
  - `app/js/views/fasttrack.js` (+26 líneas en el árbol): la normalización
    (`FORMA_CODIGO`) reescribe el código como `d.d.d-NNNN.N` respetando puntos,
    espacios, tabulaciones y guiones (el `replace` del HEAD colapsaba también los
    puntos y era un no-op), y un código inexistente conserva el `buscar` del
    asistente.
  - `app/js/generador/intercambio.js` (+5): conserva el `buscar` también en un
    renglón con código, para que el generador lo deje "por buscar" con ese texto.
  - `app/js/generador/documentos.js` (+30/−…): con OCA, la máxima por Solicitud
    de Provisión no puede superar la cantidad del renglón, aplica la regla de la
    mínima del núcleo (`validarCantidades`) y marca "2 · Renglones" con "· falta".
  - `tests/ronda-39-p1.test.js`: el bloque reparado y el armado de 1a-2 y 1b.

La corrección de la 38 (paso 0b, commit `3c7863e`) ya estaba publicada por la
sesión anterior; no se tocó.

### Tests viejos que cambiaron, uno por uno

`git diff --stat fa1817c..HEAD -- tests/`:

```
 tests/plantillas.test.js  |   3 +-
 tests/ronda-33-p1.test.js |  14 ++-
 tests/ronda-38-p2.test.js |   2 +-
 tests/ronda-39-p1.test.js | 277 ++++++++++++++++++++++++++++++++++++++++++++++
 tests/ronda-39-p2.test.js | 145 +++++++++++++++++++++++++
 5 files changed, 438 insertions(+), 3 deletions(-)
```

Tres tests viejos, todos de asunto, ninguno reescrito:

1. **`tests/plantillas.test.js`** (el requerimiento descompone el código, imprime
   el preventivo en letras y la OCA). La aserción de la causal de la OCA pasa de
   `'Decreto 1030/2016, art. 25 inc. c)'` a `'Decreto 1030/2016, arts. 25 inc. c)
   y 111'` (pieza 1b). Sigue exigiendo que no aparezcan ni "1023/01" ni "Art. 111".
2. **`tests/ronda-33-p1.test.js`** (la plantilla y sus instrucciones). La regla 3
   cambió (el código ahora se copia tal como aparezca y el SGC lo acomoda), así
   que el test aplica esa enmienda sobre el texto de la orden 33 publicada, con
   dos constantes (`REGLA_33_CODIGO` → `REGLA_39_CODIGO`), sin reescribir la orden.
3. **`tests/ronda-38-p2.test.js`** (con OCA, sin justificación). La guía de
   Fundamentación se compara con `arts?` (plural o singular), porque la pieza 1b
   la pasó a "arts. 25 inc. c) y 111".

Y los **dos archivos nuevos** de la ronda: `tests/ronda-39-p1.test.js` (4 tests,
por la pantalla del generador) y `tests/ronda-39-p2.test.js` (3 tests).

## 2. Decisiones que tomé y por qué

- **Se commitea lo que ya estaba bien, tal como quedó.** Los tres archivos
  arreglados el 17/10 a la noche hacen pasar la prueba de la ronda (el Jefe la
  probó: 13/13) y las regresiones. Rehacerlos habría dejado otra vez un HEAD a
  mitad de camino.
- **El test se completa, no se reescribe.** Al archivo roto le faltaba compilar
  (el bloque cortado) y le faltaban dos pasos de armado que no tocan lo que el
  test afirma: imprimir antes de exportar (1a-2) y escribir la justificación de
  la OCA (1b). La causa de la 39 dice que el test se usa tal cual; por eso las
  aserciones y los textos esperados no se tocaron.
- **Las órdenes y el plan van en el commit estándar del ciclo, separados del
  código.** El commit de cierre de la orden pide "un solo commit" para la
  corrección; los archivos del revisor no pueden mezclarse ahí. El ciclo 2.0 ya
  tiene su commit y su mensaje para esto ("Revisor: ordenes y plan al dia"), y es
  el que deja el árbol limpio.
- **La regla de las cantidades va en el generador, no en `core/`** (ADR-044). Se
  apoya en `SGC.core.requerimiento.validarCantidades` para la mínima, pero la
  regla de la máxima contra la cantidad del renglón se evalúa en
  `generador/documentos.js`. `core/requerimiento.js` y `server/` no se tocaron.
- **El aviso de importación quedó del HEAD.** El contador de códigos acomodados
  (`intercambio.js:904`) ya estaba en `3c82e82`; lo que faltaba era que la
  normalización funcionara. Ahora el aviso dice cuántos se acomodaron de verdad.

## 3. Verificación

Corridas completas, todas documentadas, no sólo la mejor.

Comando de la orden:

```
node --test --test-timeout=120000 "tests/*.test.js"
```

| corrida | tests | pass | fail | cancelled | skipped | duration_ms | log |
|---|---|---|---|---|---|---|---|
| auditoría 39 · HEAD `d7863a6` · 1 | 686 | 683 | **3** | 0 | 0 | 781930.4613 | `%TEMP%\opencode\c39-s2-run1.log` |
| auditoría 39 · HEAD `d7863a6` · 2 | 686 | 683 | **3** | 0 | 0 | 733534.8808 | `%TEMP%\opencode\c39-s2-run2.log` |
| auditoría 39 · HEAD `d7863a6` · 3 | 686 | 683 | **3** | 0 | 0 | 630596.8259 | `%TEMP%\opencode\c39-s2-run3.log` |
| cierre · dirigida p1+p2, antes de arreglar el armado | 7 | 5 | 2 | 0 | 0 | 25828.1930 | `%TEMP%\opencode\r39-cierre-dirigido.txt` |
| cierre · dirigida p1+p2, con el armado reparado | 7 | 7 | 0 | 0 | 0 | 2861.8685 | `%TEMP%\opencode\r39-cierre-dirigido2.txt` |
| cierre · completa final (HEAD `6ebff20`) | **689** | **689** | **0** | 0 | 0 | 712248.6488 | `%TEMP%\opencode\r39-cierre-full1.txt` |

Las tres corridas rojas del HEAD, copiadas del log (`c39-s2-run1.log`), con los
mismos tres fallos siempre:

```
ℹ pass 683
ℹ fail 3
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 781930.4613

✖ failing tests:

test at tests\ronda-39-p1.test.js:1:1
✖ tests\ronda-39-p1.test.js (1139.2043ms)
  'test failed'          ← el archivo no compila (línea 263)

test at tests\ronda-39-p2.test.js:75:1
✖ RONDA-39 pieza 2a · los códigos con separadores raros se acomodan … (1084.907ms)
  AssertionError [ERR_ASSERTION]: el aviso dice cuántos códigos se acomodaron:
    … Renglón 1: el código 3.3.3   1627  36 no está en el catálogo; quedó para buscar …
  expected: /4 códigos se acomodaron a la forma del catálogo/

test at tests\ronda-39-p2.test.js:103:1
✖ RONDA-39 pieza 2b · un código inexistente conserva el "buscar" … (376.8541ms)
  AssertionError [ERR_ASSERTION]: conserva el "buscar" del asistente, no el código
  + '9.9.9-0000.0'
  - 'matafuego'
```

Cola de la corrida final (`r39-cierre-full1.txt`, HEAD `6ebff20`):

```
ℹ tests 689
ℹ suites 0
ℹ pass 689
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 712248.6488
```

Los 7 tests de la ronda, en la corrida dirigida reparada
(`r39-cierre-dirigido2.txt`):

```
✔ RONDA-39 pieza 1a-1 · con OCA, cantidad 10 y máxima 12: no imprime ni exporta, el motivo los nombra y "2 · Renglones" dice falta
✔ RONDA-39 pieza 1a-2 · con OCA y máxima 10 (igual a la cantidad del renglón): exporta
✔ RONDA-39 pieza 1a-3 · con OCA, máxima 5 y mínima 8: no exporta y el motivo habla de la mínima
✔ RONDA-39 pieza 1b · el requerimiento con OCA y la guía de Fundamentación citan "Decreto 1030/2016, arts. 25 inc. c) y 111"
✔ RONDA-39 pieza 2a · los códigos con separadores raros se acomodan y entran con descripción, sin quedar por buscar
✔ RONDA-39 pieza 2b · un código inexistente conserva el "buscar" y "Buscar" lo pone en el buscador
✔ RONDA-39 pieza 2c · la plantilla trae las instrucciones nuevas del código
```

Controles:

- `node tools/check-compat.js` → **OK — 6994 archivo(s) inspeccionado(s), 0
  violaciones** (código 0).
- `node tools/build-config.js --verificar` → **OK — 2 archivo(s) al día** (código 0).
- `git diff fa1817c..HEAD -- app/js/core/ server/` → **vacío** (la ronda no toca el
  núcleo ni la aplicación con servidor).

## 4. Contradicciones e información faltante

- **Dónde se cortó la sesión (lo que pide la §4 de la orden).** El 17/10 la sesión
  commiteó `3c7863e` (corrección 0b), `aec716a` (pieza 1) y `3c82e82` (pieza 2),
  y **después** `d7863a6` (los tests), y ahí se cortó: **los tres commits de
  código quedaron en GitHub con la suite en rojo** (686/683/3 en las tres
  corridas de la auditoría) y **los arreglos de los tres archivos quedaron sin
  commitear** en `dev\` (17/10, 23:07-23:12). Faltaban el informe y el test
  reparado. La auditoría 39 lo dejó escrito: *"la ronda no está entregada"*.
- **El commit de tests quedó sin cuerpo.** La orden 39 pide commit con cuerpo; en
  `d7863a6` el cuerpo es sólo el asunto. Está publicado; no se reescribe historia.
  Queda declarado (lo marcó la auditoría 39).
- **Aparecieron más archivos que los tres de la orden.** `git status --short` del
  paso 1 devolvió: los tres archivos (`documentos.js`, `intercambio.js`,
  `fasttrack.js`), el test roto, **`PLAN_DESARROLLO.md` modificado** y **tres
  órdenes sin trackear** (`ORDEN-RONDA-39-AUDITORIA.md`,
  `ORDEN-RONDA-39-CIERRE-AUDITORIA.md`, `ORDEN-RONDA-39-CIERRE.md`), del revisor.
  No entraron en el commit de código: se publicaron aparte, en `cb68358`
  ("Revisor: ordenes y plan al dia", paso 2.0 del ciclo), que es lo que deja el
  árbol limpio. La primera auditoría ya había avisado que la orden de auditoría
  no estaba trackeada en el clon.
- **El test de la ronda nunca había corrido.** `tests/ronda-39-p1.test.js` no
  compilaba, así que sus **4 tests no existían para la suite**. Reparado el bloque,
  aparecieron **dos pasos de armado faltantes** (1a-2 sin "Imprimir" y 1b sin la
  justificación de la OCA) que se completaron sin cambiar las aserciones. El test
  rojo de la 2a y el de la 2b sí eran de código, y los arregla el commit de cierre.
- **La corrección 0b quedó sin test.** El experimento E1 de la auditoría (quitar
  el bloque que vacía y oculta `#sgc-error-pac-justificacion`) **no pone nada en
  rojo**: ningún test aprieta "Siguiente" y después verifica que ese nodo quede
  vacío/oculto. `ronda-38-p1` prueba "Sigue valiendo" pero no ese nodo. **Es un
  faltante declarado**; no se agregó test en el cierre porque la orden pide
  completar el test roto y commitear lo que ya estaba bien, no escribir cobertura
  nueva.
- **La prueba del Jefe ya está hecha.** `PRUEBAS-JEFE\DEVOLUCION-RONDA-39.md`
  tiene las tres respuestas ("me frena y me dice por qué"; "entran con su
  descripción"; "parece que está ok") y dos pedidos para el final del roadmap, que
  quedaron en la cola del plan (ítems 29, 5 y 31). El revisor corre
  `prueba-ronda-39.js` sobre el HEAD; con estos archivos daba 13/13.

## 5. Qué NO hice

- No toqué `core/` ni `server/` (verificado: `git diff fa1817c..HEAD -- app/js/core/
  server/` vacío). La regla de las cantidades quedó en el generador (ADR-044).
- No modifiqué tests de la aplicación con servidor.
- No reescribí ningún test viejo: los tres que cambiaron son de asunto (la cita,
  las instrucciones de la plantilla y la guía), descritos en §1.
- No rehíce las piezas de cero ni edité las órdenes publicadas.
- No agregué el test que le falta a la corrección 0b (§4): queda declarado.
- No corrí la prueba del Jefe en navegador (no hay Playwright/Chromium en este
  entorno; es lo mismo que las rondas 30 a 38).

## 6. Riesgos que veo

- **La corrección 0b viaja sin test.** Si alguien revierte el bloque de
  `wizard.js`, la corrección de la 38 queda desprotegida. Es el faltante que dejó
  el auditor en E1; conviene un test de pantalla que apriete "Siguiente" antes.
- **Este HEAD nació de dos tiempos.** Los tests y el código se separaron en la
  sesión cortada, y el árbol de `dev\` fue lo que probó el Jefe (no el HEAD). La
  regla nueva del ciclo (una ronda no cierra con cambios sin commitear) es la
  respuesta; quedó aplicada: `git status` limpio.
- **La suite completa flakea con carga.** `ronda-21-c6` ("la cadena de roles hasta
  la firma por la montura real") dio un timeout en los dos worktrees que corrió la
  auditoría; aislado pasa. No apareció en la corrida final de este cierre.
- **La normalización es por forma, no por catálogo.** Un código que "parezca" la
  forma `d.d.d-NNNN.N` se reescribe y después se valida: si no existe, queda "por
  buscar" con el `buscar` del asistente. Es lo que pide la orden, pero conviene
  no leerlo como "todo código entra".

## 7. Medidas (métricas)

- Suite completa final (log): **689/689** en 712248.6488 ms (≈ 11,9 min).
- Corridas rojas del HEAD: 686/683/3 (781930.4613 · 733534.8808 · 630596.8259 ms).
- Dirigidos de la ronda: 7/7 en 2861.8685 ms (antes del arreglo de armado: 5/7 en
  25828.1930 ms).
- `check-compat.js`: 6994 archivos, 0 violaciones.
- `build-config.js --verificar`: 2 archivos al día.
- `git show --stat`:
  - `cb68358` (publicación del revisor): 4 files changed, 226 insertions(+), 10 deletions(-).
  - `6ebff20` (cierre): 4 files changed, 52 insertions(+), 18 deletions(-).

## 8. Accesos fuera del repositorio

- Ninguno nuevo de red. La montura del generador carga los módulos reales por
  `<script>` (file://); la app empaquetada no hace fetch ni usa servidor.
- `PRUEBAS-JEFE\DEVOLUCION-RONDA-39.md` (fuera del repositorio, ya escrita por el
  Jefe) y `PRUEBAS-JEFE\prueba-ronda-39.js` (Playwright, pendiente de navegador
  real; lo corre el revisor).
- Temporales de trabajo (logs y el script de diagnóstico) en `%TEMP%\opencode\`.

## 9. Qué se lleva el paquete — criterios de aceptación (ORDEN-RONDA-39)

- **Pieza 1a (cantidades de la OCA).** Con OCA, cantidad 10 y máxima 12: no
  imprime ni exporta, el motivo nombra el renglón y los dos números, y
  "2 · Renglones" dice "falta" (test 1a-1). Máxima 10: exporta y el JSON lleva
  `cantidadMaxima: 10` (1a-2). Máxima 5 y mínima 8: no exporta y el motivo habla
  de la mínima, con el texto del núcleo (1a-3).
- **Pieza 1b (la cita).** El requerimiento con OCA y la guía de Fundamentación
  citan `Decreto 1030/2016, arts. 25 inc. c) y 111` (test 1b; `plantillas.test.js`
  y la guía de `ronda-38-p2`).
- **Pieza 2a (los códigos).** Los cuatro códigos de la tabla entran como
  `3.3.3-1627.36`, ninguno "por buscar", y el aviso dice que se acomodaron (2a).
- **Pieza 2b (el buscar).** Un renglón con `9.9.9-0000.0` y `"buscar":
  "matafuego"` queda "por buscar" y "Buscar" pone "matafuego" (2b).
- **Pieza 2c (las instrucciones).** La plantilla trae las instrucciones nuevas
  (2c; `ronda-33-p1`).
- **Corrección 0b (de la 38).** El aviso rojo se va con "Sigue valiendo": sin
  test que lo respalde (faltante declarado, §4).
- Suite completa en verde: **689/689**; `check-compat` 0 violaciones.
- Commit de cierre con cuerpo: `6ebff20` — y push hecho.
- Clon en `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-39b`
  desde GitHub (la carpeta `ciclo-39` no se toca).
- Paquete generado con `node tools/empaquetar-generador.js --ronda 39 --destino
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Prueba del Jefe `PRUEBAS-JEFE\prueba-ronda-39.js` (13/13 con estos archivos; la
  corre el revisor en navegador real; la devolución del Jefe ya está escrita).

## 10. Verificación del cierre (ejecutada)

- Publicación del revisor: `git add ordenes PLAN_DESARROLLO.md` → `git commit -m
  "Revisor: ordenes y plan al dia"` → `cb68358`.
- Commit de código y test reparado: `6ebff20`, con cuerpo → `git push`
  (`d7863a6..6ebff20 main -> main`).
- Informe y su commit: `git add INFORME-RONDA-39.md` → `git commit -m "Ronda 39 ·
  informe"` → `git push`.
- `git status --short` en `dev\`: **vacío** (regla nueva del ciclo: una ronda no
  se cierra con cambios sin commitear; se pega en el mensaje final).
- Clon para el auditor desde GitHub, ruta absoluta:
  `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-39b`.
- Paquete: `node tools/empaquetar-generador.js --ronda 39 --destino
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Después del clon no se commitea nada. Los dos HEAD van en el mensaje final.
