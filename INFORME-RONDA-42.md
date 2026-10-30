# INFORME-RONDA-42.md
Ronda 42 - Abastecimiento junta los requerimientos, y el ANEXO I los muestra
SGC - 2026-10-30

## 1. Qué hice

Cerré la ronda 42 siguiendo `ordenes/ORDEN-RONDA-42.md`. Fueron dos piezas, cada
una con su suite completa en verde, su commit con cuerpo y su push.

- **Paso 0 (publicación).** Se publicaron las órdenes y el plan en `d370458`,
  **Revisor: ordenes y plan al dia**, con `ordenes/ORDEN-RONDA-42.md`,
  `ordenes/ORDEN-RONDA-42-AUDITORIA.md`, `ordenes/ORDEN-RONDA-41-AUDITORIA-BIS.md`
  y `PLAN_DESARROLLO.md`. Ese commit no lleva nada de `app\` ni de `tests\`.
- **Pieza 1 (Abastecimiento importa los requerimientos).**
  `generador/intercambio.js` suma `leerRequerimiento(texto)`: sólo acepta la
  forma `exportado` con `sello.estado === "para-abastecimiento"` y verifica la
  huella; un avance, una plantilla, otro formato o una copia modificada no
  entran. `generador/abastecimiento.js` es el rol nuevo: pide la identidad,
  importa los archivos, lista dependencia, título, año, moneda y renglones, no
  repite el mismo requerimiento y deja quitar filas. `generador.html` agrega la
  sección y `generador.js` rutea el rol. Los cuatro fixtures del Jefe se
  copiaron a `tests/fixtures/` con sus huellas verificadas. Commit `b26bd89`,
  **Ronda 42 · Abastecimiento importa los requerimientos**.
- **Pieza 2 (el ANEXO I consolidado).** `core/consolidacion.js` suma
  `SGC.core.consolidacion.renglones(requerimientos)`, con la misma regla que
  `server/sco.js`: clave `codigo|unidad`, cantidades sumadas, desglose por
  expediente, orden por código y unidad, y la descripción del ítem cuando el
  renglón no la trae. `generador/abastecimiento.js` pinta la tabla consolidada,
  avisa cuando un código viene en dos unidades, frena la impresión si hay pesos
  y dólares juntos y monta el ANEXO I con la SCo a asignar y la tabla de
  renglones. `renders/anexo-1.js` corrige `modelo()`: parte del modelo común de
  los documentos, así el encabezado y el pie dejan de decir `undefined`. Commit
  `6a80181`, **Ronda 42 · ANEXO I consolidado**.

### Tests viejos que cambiaron, uno por uno

`git diff --stat d370458..6a80181 -- tests/`:

```
 tests/fixtures/r42-avance-goe.json |  75 +++++++++++
 tests/fixtures/r42-req-gb7.json    | 117 ++++++++++++++++
 tests/fixtures/r42-req-goe.json    |  98 ++++++++++++++++
 tests/fixtures/r42-req-usd.json    |  79 ++++++++++++++
 tests/helpers/generador-montura.js |  20 +++
 tests/ronda-28-c2.test.js          |  33 ++---
 tests/ronda-42-p1.test.js          | 158 ++++++++++++++++++++++
 tests/ronda-42-p2.test.js          | 265 +++++++++++++++++++++++++++++++++++++
 8 files changed, 826 insertions(+), 19 deletions(-)
```

El único test viejo que cambió es **`tests/ronda-28-c2.test.js`**:

- **Test "Abastecimiento y Contrataciones dicen que llegan en la próxima
  versión".** Antes recorría los dos roles y esperaba que ninguno abriera el
  alta. Ahora se llama "Contrataciones dice que llega en la próxima versión" y
  sólo prueba Contrataciones. Abastecimiento ya tiene vista propia y por eso
  salió de ese caso. Las aserciones de Contrataciones no cambiaron: el alta
  sigue oculta, el aviso sigue visible, empieza nombrando el rol y dice
  "próxima versión".

`tests/helpers/generador-montura.js` no es un test: sumó
`m.elegirRequerimientos(nombres)` para importar los fixtures por la pantalla y
esperar la lista pintada. No se modificó ningún test de la aplicación con
servidor.

## 2. Decisiones que tomé y por qué

- **La importación no confía en el nombre del archivo.** `leerRequerimiento`
  mira la forma del JSON, el sello y la huella. Un avance exportado por el mismo
  generador se rechaza por el sello, no por el nombre.
- **El aviso de huella es el que ya usaba el generador.** Una copia modificada
  fuera del generador no se importa y el mensaje dice que el archivo fue
  modificado. El test acepta "modificado" y "modificó" para no atarse a la
  tilde.
- **La lista se arma con lo que el requerimiento declara.** Dependencia, título,
  año, moneda y renglones salen del JSON exportado; no se consulta el servidor.
  El mismo requerimiento dos veces se detecta por id y deja una sola fila con
  aviso.
- **La consolidación es la regla del servidor, no una parecida.**
  `core/consolidacion.js` replica clave, suma, desglose y orden de
  `server/sco.js`. La única diferencia deliberada es la descripción: toma
  `r.descripcion` y, si viene vacía, `r.item`, porque el JSON exportado no
  siempre trae la descripción larga.
- **El código solo no alcanza como clave.** El `2.3.1-6563.129` puede venir en
  UN y en CAJA; van en renglones separados y la pantalla lo avisa con el código
  y las dos unidades. Es lo que pide la orden y evita sumar peras con manzanas.
- **Pesos y dólares no se mezclan.** Si la lista tiene requerimientos en ARS y
  en USD, se esconde la tabla y el aviso de unidades, se deshabilita Imprimir y
  el mensaje nombra los títulos de cada moneda. Al quitar el USD vuelve todo.
  No hay conversión ni se elige una moneda por el usuario.
- **La impresión usa la plantilla real del servidor.** Se monta
  `renders/anexoUno.montar` con un expediente armado en memoria:
  `unidadSolicitante` son las etiquetas de las dependencias unidas por " · " y
  `numero` es "SCo a asignar". Después del nodo `.doc-unidad` se insertan la SCo,
  el título "Renglones de la SCo" y la tabla. El helper `insertarDespues` usa
  `insertBefore` en el navegador y `children.splice` en el stub.
- **El ANEXO 1 se arregla desde su modelo, sin copiar el del servidor.**
  `modelo()` parte de `d.modelo(expediente)` y superpone lo que el ANEXO 1 ya
  definía. Así aparecen `unidad`, `numero`, `id`, `estadoTitulo` y
  `catalogoVersion` sin cambiar el resto del documento. La aplicación con
  servidor sigue usando la misma función.
- **Cada caso va en su propio test.** La pieza 1 tiene 6 tests y la pieza 2
  tiene 7, incluido el 2c-5b del `undefined`. Todos entran por la pantalla del
  generador; la consolidación se compara contra la función del servidor.

## 3. Verificación

### 3.1 Suite completa después del último commit de código

Comando:

```
node tools/suite.js
```

Pieza 1, salida copiada de `%TEMP%\sgc-suite-r42-p1.log`:

```
INICIO PIEZA 1: 2026-10-30 09:59:26
tests 721 / pass 721 / fail 0 / cancelled 0 / skipped 0 / duration_ms 1564484
FIN PIEZA 1: 2026-10-30 10:25:32
```

Pieza 2, salida copiada de `%TEMP%\sgc-suite-r42-p2.log`:

```
INICIO PIEZA 2: 2026-10-30 10:32:37
tests 728 / pass 728 / fail 0 / cancelled 0 / skipped 0 / duration_ms 1474381
FIN PIEZA 2: 2026-10-30 10:57:12
```

La suite clasifica **46 archivos en serie** y **63 en paralelo** (109 archivos,
728 tests). Ambas corridas salieron con código 0.

### 3.2 Corridas dirigidas

Los dos archivos nuevos juntos, después del commit de la pieza 2:

```
node --test --test-timeout=120000 --test-force-exit tests/ronda-42-p1.test.js tests/ronda-42-p2.test.js
```

Salida final:

```
tests 13
pass 13
fail 0
cancelled 0
skipped 0
duration_ms 3962.6254
```

También quedaron verdes las regresiones puntuales de la ronda:
`ronda-42-p1` con `ronda-11` y `ronda-27-c5` dio **33/33**, y
`ronda-20-anexo` con `ronda-27-c5-vista` dio **11/11**. El ajuste de
`ronda-28-c2` se corrió solo y quedó en verde.

### 3.3 Controles

- `node tools/check-compat.js` -> **OK - 6998 archivo(s) inspeccionado(s), 0
  violaciones**.
- `node tools/build-config.js --verificar` -> **OK - 2 archivo(s) al día**.
- `git diff --stat d370458..6a80181 -- server` -> **vacío**.
- `git diff --stat d370458..6a80181 -- app/index.html` -> **vacío**.
- `git diff --name-status d370458..6a80181 -- app/js/core` -> sólo
  `A app/js/core/consolidacion.js`.
- No se modificó ningún test de la aplicación con servidor.

### 3.4 Los 13 tests nuevos, en la corrida completa

Pieza 1:

```
RONDA-42 pieza 1c-1 · Abastecimiento entra con la identidad completa y sin ella avisa como Usuario
RONDA-42 pieza 1c-2 · dos requerimientos exportados: dos filas con dependencia, título, año, moneda y renglones
RONDA-42 pieza 1c-3 · un avance no entra y el aviso nombra el archivo y que es un avance
RONDA-42 pieza 1c-4 · una copia con una cantidad cambiada no entra por la huella
RONDA-42 pieza 1c-5 · el mismo archivo dos veces deja una sola fila y avisa que ya estaba
RONDA-42 pieza 1c-6 · "Quitar" saca la fila
```

Pieza 2:

```
RONDA-42 pieza 2c-1 · consolidacion.renglones es la misma regla que server/sco.js, con la descripción del ítem
RONDA-42 pieza 2c-2 · el 3.3.3 es un solo renglón con 15 y el desglose de las dos dependencias
RONDA-42 pieza 2c-3 · el 2.3.1 va en dos renglones, UN 5 y CAJA 3, con el aviso de unidades
RONDA-42 pieza 2c-4 · sumar un requerimiento en USD esconde el consolidado, avisa e inhabilita Imprimir
RONDA-42 pieza 2c-5 · "Imprimir ANEXO I" trae el ANEXO 1, la SCo a asignar y el renglón con 15 y su desglose
RONDA-42 pieza 2c-5b · el ANEXO 1 no dice undefined ni en el generador ni con un expediente del servidor
RONDA-42 pieza 2c-6 · quitar el requerimiento del Grupo Base 7 deja el 3.3.3 con 10
```

## 4. Contradicciones e información faltante

- **El mensaje del commit de la pieza 1 no es exactamente el de la orden.** La
  orden lo nombra `Ronda 42 · Abastecimiento junta los requerimientos`; el
  commit quedó como `Ronda 42 · Abastecimiento importa los requerimientos`
  (`b26bd89`). No se reescribió porque ya estaba pusheado y el ciclo prohíbe el
  force-push sin pedido expreso. El contenido es el de la pieza 1 y el informe
  lo declara con su mensaje real.
- **El aviso de unidades nombra el código, no el título del renglón.** El texto
  es `el 2.3.1-6563.129 viene en UN y en CAJA: van en renglones separados`; la
  orden pedía avisar cuando un código viene en dos unidades, no fijaba el texto.
- **El aviso de monedas mezcladas lista títulos, no archivos.** Dice qué
  requerimientos quedan en ARS y cuáles en USD; no nombra los archivos
  importados. Alcanza para saber qué quitar, pero es una decisión de pantalla.
- **La suite completa tarda alrededor de 25 minutos por pieza.** Se corrieron
  las dos, una antes de cada commit, y las horas de inicio y fin quedaron
  copiadas en §3.1.
- **No hay navegador real en este entorno.** La prueba del Jefe queda para el
  revisor; acá se probó todo por la montura del generador y el DOM simulado.
- **`app/index.html` no se tocó.** El arreglo del `undefined` se probó con un
  expediente del servidor a través de la montura, no abriendo la aplicación con
  servidor en un navegador.

## 5. Qué NO hice

- No toqué `server/`.
- No toqué `app/index.html`.
- No cambié la aplicación con servidor: `renders/anexo-1.js` sólo cambió en
  `modelo()`, para las dos aplicaciones.
- No agregué nada a `app/js/core/` salvo el archivo nuevo `consolidacion.js`.
- No modifiqué tests de la aplicación con servidor.
- No agregué dependencias ni archivos de red.
- No edité las órdenes publicadas ni rehíce piezas de cero.
- No corrí la prueba del Jefe en navegador real.

## 6. Riesgos que veo

- **La lista de Abastecimiento vive en memoria.** Al cerrar el generador se
  pierden los requerimientos importados y hay que volver a elegir los archivos.
  La orden no pedía guardar el avance de Abastecimiento.
- **El mismo requerimiento con otro id se ve dos veces.** La deduplicación es
  por id del requerimiento; si el mismo pedido se exporta dos veces con ids
  distintos, se suman las cantidades. Es coherente con el servidor, pero puede
  sorprender.
- **Consolidar por código y unidad separa renglones del mismo ítem.** Es lo que
  pide la orden y evita mezclar UN con CAJA, pero un mismo código con unidades
  equivalentes no se une.
- **La impresión inserta nodos después de `.doc-unidad`.** Si otra ronda cambia
  la plantilla del ANEXO 1 y ese nodo desaparece, la SCo y la tabla no se
  insertan. El test 2c-5 lo detectaría.
- **El bloqueo por monedas es binario.** No hay conversión ni selección de
  moneda: o se quita el requerimiento en USD o no se imprime. Es lo que pide la
  orden.
- **La suite sigue siendo larga.** Alrededor de 25 minutos por corrida en esta
  máquina; el auditor debe prever el tiempo.
- **La prueba del Jefe queda pendiente.** El revisor corre
  `PRUEBAS-JEFE\prueba-ronda-42.js` y las de las rondas anteriores antes de la
  devolución; acá no hay Chromium.

## 7. Medidas (métricas)

- Suite completa pieza 1: **721/721** en `1564484` ms (~26,1 min), exit 0,
  inicio `2026-10-30 09:59:26` y fin `2026-10-30 10:25:32`.
- Suite completa pieza 2: **728/728** en `1474381` ms (~24,6 min), exit 0,
  inicio `2026-10-30 10:32:37` y fin `2026-10-30 10:57:12`.
- Dirigidos de la ronda 42: **13/13** en `3962.6254` ms.
- Suite: **46 archivos en serie** y **63 en paralelo**; **109 archivos**,
  **728 tests**.
- `check-compat.js`: **6998 archivos, 0 violaciones**.
- `build-config.js --verificar`: **2 archivos al día**.
- Fixtures del Jefe: **4 archivos** copiados a `tests/fixtures/`, con las
  huellas SHA-256 verificadas contra las entregadas.
- `git show --stat`:
  - `d370458` (publicación del revisor): 4 files changed, 425 insertions(+),
    13 deletions(-).
  - `b26bd89` (pieza 1): 11 files changed, 939 insertions(+), 23 deletions(-),
    6 tests nuevos.
  - `6a80181` (pieza 2): 5 files changed, 715 insertions(+), 42 deletions(-),
    7 tests nuevos.

## 8. Accesos fuera del repositorio

- Ninguno nuevo de red. La montura del generador sigue cargando los módulos
  reales por `<script>` sobre `file://`; el generador empaquetado no hace fetch
  ni usa servidor.
- Logs de trabajo en `%TEMP%`:
  - `%TEMP%\sgc-suite-r42-p1.log` (suite de la pieza 1);
  - `%TEMP%\sgc-suite-r42-p2.log` (suite de la pieza 2).
- Clon del auditor y paquete, fuera de `dev\`, en las rutas de §10.

## 9. Qué se lleva el paquete - criterios de aceptación (ORDEN-RONDA-42)

- **Pieza 1a (el rol).** Abastecimiento entra con la identidad completa; sin
  ella avisa como Usuario (1c-1).
- **Pieza 1b (importar y listar).** Dos requerimientos exportados dejan dos
  filas con dependencia, título, año, moneda y renglones; un avance no entra y
  el aviso nombra el archivo y que es un avance; una copia con una cantidad
  cambiada no entra por la huella; el mismo archivo dos veces deja una sola
  fila con aviso; "Quitar" saca la fila (1c-2 a 1c-6).
- **Pieza 2a (consolidar).** La regla es la misma que `server/sco.js`, con la
  descripción del ítem; el `3.3.3` es un solo renglón con 15 y el desglose de
  las dos dependencias (2c-1 y 2c-2).
- **Pieza 2b (unidades).** El `2.3.1-6563.129` va en dos renglones, UN 5 y CAJA
  3, con el aviso de unidades (2c-3).
- **Pieza 2c (monedas).** Sumar un requerimiento en USD esconde el consolidado,
  avisa y deshabilita Imprimir (2c-4).
- **Pieza 2d (ANEXO I).** "Imprimir ANEXO I" trae el ANEXO 1, la SCo a asignar y
  el renglón con 15 y su desglose; el ANEXO 1 no dice `undefined` ni en el
  generador ni con un expediente del servidor (2c-5 y 2c-5b).
- **Pieza 2e (quitar).** Quitar el requerimiento del Grupo Base 7 deja el 3.3.3
  con 10 (2c-6).
- Suite completa en verde: **728/728**, 0 fail y 0 cancelled.
- Commits con cuerpo y push: `b26bd89` y `6a80181`.
- Clon en
  `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-42`.
- Paquete con `node tools/empaquetar-generador.js --ronda 42 --destino
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Prueba del Jefe `PRUEBAS-JEFE\prueba-ronda-42.js`: la corre el revisor en
  navegador real; en este entorno no hay Chromium.

## 10. Verificación del cierre (ejecutada)

- Publicación del revisor: `d370458`, **Revisor: ordenes y plan al dia**.
- Pieza 1: commit `b26bd89`, **Ronda 42 · Abastecimiento importa los
  requerimientos**, con los fixtures, el helper, el ajuste de
  `tests/ronda-28-c2.test.js` y `tests/ronda-42-p1.test.js`; push hecho.
- Pieza 2: commit `6a80181`, **Ronda 42 · ANEXO I consolidado**, con
  `app/js/core/consolidacion.js`, el ANEXO I, el arreglo de `modelo()` y
  `tests/ronda-42-p2.test.js`; push hecho.
- Suite completa de cada pieza: **721/721** y **728/728**, logs
  `%TEMP%\sgc-suite-r42-p1.log` y `%TEMP%\sgc-suite-r42-p2.log`.
- Informe y su commit: `git add INFORME-RONDA-42.md` -> `git commit -m "Ronda 42
  · informe"` -> `git push`.
- `git status --short` en `dev\`: **vacío** (se pega en el mensaje final).
- Clon para el auditor desde GitHub, ruta absoluta:
  `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-42`.
- Paquete: `node tools/empaquetar-generador.js --ronda 42 --destino
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Después del clon no se commitea nada. Los dos HEAD van en el mensaje final.
