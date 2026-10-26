# INFORME-RONDA-41.md
Ronda 41 - Los presupuestos en la plantilla, y los pasos que se clickean
SGC - 2026-10-26

## 1. Qué hice

Cerré la ronda 41 siguiendo `ordenes/ORDEN-RONDA-41.md` (hito H27). Fueron dos
piezas, cada una con su suite completa en verde, su commit con cuerpo y su push.

- **Paso 0 (publicación).** Se publicaron las órdenes y el plan en `f1c5c4b`,
  **Revisor: ordenes y plan al dia**, con `ordenes/ORDEN-RONDA-41.md`,
  `ordenes/ORDEN-RONDA-41-AUDITORIA.md` y `PLAN_DESARROLLO.md`. Ese commit no
  lleva nada de `app\` ni de `tests\`.
- **Pieza 1 (los presupuestos en la plantilla).** `views/fasttrack.js` suma
  `conMarcaDelGenerador()`; sólo con la marca del generador, `modelo()` agrega
  el presupuesto de ejemplo y reemplaza la regla 6. `generador/intercambio.js`
  lee `presupuestos`, crea documentos `ref-N` con `sinPdf: true` y vuelca los
  valores válidos a `valoresReferencia`; lo inválido se saltea con aviso y una
  plantilla no pasa por `revisarValores`. `generador/presupuestos.js` conserva
  los documentos sin PDF, los muestra como "Proveedor · fecha · tipo · falta el
  PDF", agrega el selector `data-pdf-de` y calcula nombre, tamaño y SHA-256 al
  elegir el archivo sin cambiar el id. `generador/documentos.js` frena Imprimir
  y Exportar mientras quede un documento sin PDF y deja "2 · Renglones" en
  falta. Commit `0498ea9`, **Ronda 41 · los presupuestos en la plantilla**.
- **Pieza 2 (los pasos se clickean).** `generador.html` cambia los `<span>` de
  `#sgc-pasos` por `<button type="button" data-ir-paso="...">`. `views/wizard.js`
  suma `irA(idPaso)`, que sincroniza el formulario y navega con `irAPaso(n,
  false)` sin validar. `generador.js` escucha el clic en `#sgc-pasos` y llama a
  `irA`. `main.css` agrega el aspecto de botón dentro del `<li>`. Commit
  `a668941`, **Ronda 41 · los pasos del asistente se clickean**.

### Tests viejos que cambiaron, uno por uno

`git diff --stat f1c5c4b..a668941 -- tests/`:

```
 tests/helpers/generador-montura.js |  24 +++
 tests/ronda-33-p1.test.js          |  16 +-
 tests/ronda-41-p1.test.js          | 373 +++++++++++++++++++++++++++++++++++++
 tests/ronda-41-p2.test.js          | 141 +++++++++++++++++++++++++++++++++++++
 4 files changed, 551 insertions(+), 3 deletions(-)
```

El único test viejo que cambió es **`tests/ronda-33-p1.test.js`**:

- **Test 1 ("la plantilla baja con las instrucciones de la orden...").** Antes
  comparaba las instrucciones de la plantilla contra el texto de
  `ORDEN-RONDA-33`, con el reemplazo de la regla 3 que ya hacía la ronda 39.
  Ahora `instruccionesDeLaOrden()` también reemplaza la regla 6 vieja
  (`6) Los precios y los presupuestos no van en este JSON...`) por la regla 6
  nueva de la ronda 41. El título pasó a "la plantilla baja con las
  instrucciones de la orden 33 y la regla 6 de la 41" y el mensaje de la
  aserción dice lo mismo. La aserción de fondo no cambió: sigue comparando el
  texto completo normalizado, sin agregar ni quitar nada más.

`tests/helpers/generador-montura.js` no es un test: sumó `m.elegirPdfDe(id,
nombre, contenido)` para que los casos de la pieza 1 elijan el PDF por la
pantalla. No se modificó ningún test de la aplicación con servidor.

## 2. Decisiones que tomé y por qué

- **La marca es la misma que ya usa la Identificación.** `conMarcaDelGenerador()`
  consulta `SGC.core.validacion.exigirIdentificacionCompleta()`, que el
  generador enciende al montar. No se agregó una bandera nueva ni se tocó
  `core/`; la aplicación con servidor nunca la enciende.
- **La regla 6 se reemplaza en su índice real.** En el arreglo de instrucciones
  ocupa el índice 17, no el 5. Sólo con la marca se cambia esa línea y se agrega
  `plantilla.presupuestos`; sin la marca, la plantilla del servidor sale igual
  byte a byte (hash `427c0dcc...` y 1911 caracteres).
- **La plantilla no rechaza lo que no sirve.** `cuerpoDePlantilla` saltea un
  presupuesto sin proveedor, un renglón inexistente o un valor que no es número
  mayor que 0, y devuelve avisos que nombran proveedor, renglón y valor. La
  plantilla entra igual; lo que falte se ve en la pantalla.
- **`revisarValores` no se aplica a una plantilla.** Se usa la misma salida que
  para un avance (`esAvance || forma === 'plantilla'`). Si un renglón trae un
  solo valor, la plantilla no se rechaza: el renglón pide el segundo valor en
  la pantalla.
- **El documento sin PDF conserva su id.** `completarPdf` cambia nombre, bytes y
  huella, pero no el id: los valores de los renglones lo siguen citando con
  `base: "unitario"`. Al elegir el archivo se va `sinPdf` y se vuelve a pintar
  la lista.
- **El freno mira el expediente, no la pantalla.** `documentos.revision()` busca
  `presupuestos` con `sinPdf === true`, marca el paso 2 en falta y arma el
  motivo con los proveedores. Así Imprimir y Exportar frenan también después de
  importar un avance, sin depender de que la lista esté pintada.
- **La navegación por pasos no valida.** `irA` sincroniza y llama a
  `irAPaso(n, false)`, igual que "Anterior". "Siguiente" sigue validando como
  hoy. La función es nueva y sólo la llama el generador; `index.html` no se tocó.
- **El CSS nuevo es acotado.** Las reglas `.pasos li button` viven en
  `main.css`, que comparten las dos aplicaciones, pero sólo alcanzan a botones
  dentro de `.pasos`; la aplicación con servidor sigue usando `<span>`.
- **Cada caso va en su propio test.** La pieza 1 tiene 10 tests y la pieza 2
  tiene 5. Todos entran por la pantalla del generador; cuando leen el JSON
  exportado, es el que se descargó por la pantalla.
- **El stub del DOM no burbujea.** Los tests de la pieza 2 emiten el clic en
  `#sgc-pasos` con `target` apuntando al botón, que es lo que hace el navegador
  al subir desde el `<button>`. El test 2-4 usa `focus()` y ese clic para
  representar Tab y Enter.

## 3. Verificación

### 3.1 Suite completa después del último commit de código

Comando:

```
node tools/suite.js
```

Salida final, copiada de `%TEMP%\sgc-suite-r41.log`:

```
tests 715 / pass 715 / fail 0 / cancelled 0 / skipped 0 / duration_ms 1740411
```

La suite clasifica **46 archivos en serie** y **61 en paralelo** (107 archivos,
715 tests). La corrida posterior a `a668941` tardó `1740411` ms (~29,0 min) y
salió con código 0.

También quedó registrada la corrida completa anterior a separar los commits,
con el mismo árbol final: `715/715` en `1590177` ms, log
`%TEMP%\sgc-suite-r41-previa.log`.

### 3.2 Corridas dirigidas

Después del commit de la pieza 1 se corrieron los dos archivos nuevos juntos:

```
node --test --test-timeout=120000 --test-force-exit tests/ronda-41-p1.test.js tests/ronda-41-p2.test.js
```

Salida final, copiada de `%TEMP%\sgc-suite-r41-dirigidos.log`:

```
tests 15
pass 15
fail 0
cancelled 0
skipped 0
duration_ms 2470.1033
```

### 3.3 Controles

- `node tools/check-compat.js` -> **OK - 6996 archivo(s) inspeccionado(s), 0
  violaciones**.
- `node tools/build-config.js --verificar` -> **OK - 2 archivo(s) al día**.
- `git diff --stat -- app/js/core server` -> **vacío**.
- No se modificó ningún test de la aplicación con servidor.

### 3.4 Los 15 tests nuevos, en la corrida completa

Pieza 1:

```
RONDA-41 pieza 1a-1 · la plantilla del generador trae presupuestos y la regla 6 nueva
RONDA-41 pieza 1a-2 · la plantilla del servidor, sin la marca, sale igual byte a byte que en 1ebf5ef
RONDA-41 pieza 1b-3 · dos presupuestos con los dos renglones: dos documentos "falta el PDF" y los cuatro valores en sus renglones
RONDA-41 pieza 1d-4 · sin los PDF no imprime ni exporta, y el motivo nombra a los dos proveedores
RONDA-41 pieza 1c-5 · con el PDF de cada uno exporta, y cada documento viaja con nombre y huella
RONDA-41 pieza 1b-6 · la fecha 02/10/2026 sale 2026-10-02
RONDA-41 pieza 1c-7 · un avance con documentos sin PDF vuelve sin PDF y con sus valores
RONDA-41 pieza 1b-8 · un renglón cotizado una sola vez: la plantilla entra y el renglón pide su segundo valor
RONDA-41 pieza 1b-9 · el renglón 9 que no existe y el valor "$ 5.400": entra lo demás y el aviso los nombra
RONDA-41 pieza 1b-10 · una plantilla sin presupuestos entra como hoy
```

Pieza 2:

```
RONDA-41 pieza 2-1 · desde Identificación vacía, un clic en "4 · Revisión" va a Revisión con aria-current y no exporta
RONDA-41 pieza 2-2 · desde Revisión, "2 · Renglones" vuelve a Renglones
RONDA-41 pieza 2-3 · lo escrito no se pierde: el título sobrevive a ir al 3 y volver al 1
RONDA-41 pieza 2-4 · con Tab se llega a cada botón y con Enter se va al paso
RONDA-41 pieza 2-5 · "Siguiente" sigue frenando con la Identificación vacía
```

## 4. Contradicciones e información faltante

- **El mensaje del commit de la pieza 2 no es exactamente el de la orden.** La
  orden lo nombra `Ronda 41 · los pasos se clickean`; el commit quedó como
  `Ronda 41 · los pasos del asistente se clickean` (`a668941`). No se reescribió
  porque ya estaba pusheado y el ciclo prohíbe el force-push sin pedido expreso.
  El contenido del commit es el de la pieza 2 y el informe lo declara con su
  mensaje real.
- **La suite completa tardó casi 29 minutos.** La corrida posterior al último
  commit de código dio `1740411` ms. Es el mismo costo de la tanda en serie de
  las rondas anteriores; no hubo fallos ni cancelados.
- **El caso 1c-5 necesitó elegir la modalidad "común".** Sin modalidad, el
  generador no deja salir de Identificación y el test no llegaba a exportar. Se
  agregó `m.elegirModalidad('comun')` al armado del caso; no fue un cambio de
  código.
- **No hay navegador real en este entorno.** La prueba del Jefe queda para el
  revisor; acá se probó todo por la montura del generador y el DOM simulado.
- **El aviso de importación no se pinta en un bloque aparte.** Se suma al
  mensaje de importación que ya existía; los tests 1b-8, 1b-9 y 1b-10 leen ese
  mensaje por la pantalla.

## 5. Qué NO hice

- No toqué `server/` ni `app/js/core/`. Verificado con
  `git diff --stat -- app/js/core server` vacío.
- No modifiqué tests de la aplicación con servidor.
- No toqué `app/index.html`.
- No cambié la aplicación con servidor: sigue usando `<span>` en los pasos y no
  llama a `irA`.
- No agregué dependencias ni archivos de red.
- No edité las órdenes publicadas ni rehíce piezas de cero.
- No corrí la prueba del Jefe en navegador real.

## 6. Riesgos que veo

- **Un documento sin PDF bloquea hasta que se elija el archivo.** Es lo que pide
  la orden, pero si la persona importa una plantilla y cierra el generador, al
  volver el avance conserva los documentos sin PDF y sigue frenando. El aviso
  nombra a los proveedores para que se sepa qué falta.
- **El selector de PDF no valida el tipo de archivo.** Se acepta cualquier
  archivo y se calcula su huella; la orden no pide filtro por MIME. Si el Jefe
  quiere PDF solamente, es otra ronda.
- **La regla 6 nueva depende del índice 17.** Si otra ronda inserta una línea
  antes de la regla 6, el reemplazo puede apuntar al lugar equivocado. El test
  1a-1 lo detectaría porque compara el texto completo.
- **El CSS de los pasos es compartido.** Las reglas sólo alcanzan a botones
  dentro de `.pasos`, pero si la aplicación con servidor incorpora botones ahí,
  heredará el aspecto. Hoy no los tiene.
- **La suite sigue siendo larga.** Casi 29 minutos en esta máquina; el auditor
  debe prever el tiempo.
- **La prueba del Jefe queda pendiente.** El revisor corre
  `PRUEBAS-JEFE\prueba-ronda-41.js` y las de las rondas 30 a 40 antes de la
  devolución; acá no hay Chromium.

## 7. Medidas (métricas)

- Suite completa posterior a `a668941`: **715/715** en `1740411` ms (~29,0 min),
  exit 0.
- Suite completa anterior a separar commits: **715/715** en `1590177` ms
  (~26,5 min), exit 0.
- Dirigidos de la ronda 41: **15/15** en `2470.1033` ms.
- Suite: **46 archivos en serie** y **61 en paralelo**; **715 tests**.
- `check-compat.js`: **6996 archivos, 0 violaciones**.
- `build-config.js --verificar`: **2 archivos al día**.
- Plantilla del servidor sin la marca: SHA-256
  `427c0dcc1bfc1f7881e1944b1fa798674855bb3fe9c7ff4d96dedadd666fa8f3`,
  longitud **1911**.
- `git show --stat`:
  - `f1c5c4b` (publicación del revisor): 3 files changed, 279 insertions(+),
    14 deletions(-).
  - `0498ea9` (pieza 1): 7 files changed, 670 insertions(+), 52 deletions(-),
    10 tests nuevos.
  - `a668941` (pieza 2): 5 files changed, 197 insertions(+), 4 deletions(-),
    5 tests nuevos.

## 8. Accesos fuera del repositorio

- Ninguno nuevo de red. La montura del generador sigue cargando los módulos
  reales por `<script>` sobre `file://`; el generador empaquetado no hace fetch
  ni usa servidor.
- Logs de trabajo en `%TEMP%`:
  - `%TEMP%\sgc-suite-r41.log` (suite posterior al último commit de código);
  - `%TEMP%\sgc-suite-r41-previa.log` (suite anterior a separar commits);
  - `%TEMP%\sgc-suite-r41-dirigidos.log` (los 15 tests nuevos juntos).
- Clon del auditor y paquete, fuera de `dev\`, en las rutas de §10.

## 9. Qué se lleva el paquete - criterios de aceptación (ORDEN-RONDA-41)

- **Pieza 1a (la plantilla).** La plantilla del generador trae `presupuestos` con
  proveedor, fecha, tipo y valores unitarios, y la regla 6 nueva; sin la marca,
  la del servidor sale igual byte a byte (1a-1 y 1a-2).
- **Pieza 1b (importar).** Dos presupuestos con los dos renglones entran como
  documentos "falta el PDF" y sus cuatro valores quedan citados; la fecha
  `02/10/2026` sale `2026-10-02`; un renglón cotizado una sola vez entra y pide
  el segundo valor; el renglón 9 inexistente y `"$ 5.400"` se saltean con aviso;
  una plantilla sin presupuestos entra como hoy (1b-3, 1b-6, 1b-8, 1b-9 y
  1b-10).
- **Pieza 1c (el documento sin PDF).** La lista dice "Proveedor · fecha · tipo ·
  falta el PDF"; cada documento tiene su selector `data-pdf-de`; al elegir el
  PDF se calculan nombre, tamaño y SHA-256 sin cambiar el id, y el documento
  viaja con nombre y huella; un avance con documentos sin PDF vuelve igual (1b-3,
  1c-5 y 1c-7).
- **Pieza 1d (los frenos).** Sin los PDF no imprime ni exporta, el motivo nombra
  a los dos proveedores y "2 · Renglones" queda en falta (1d-4).
- **Pieza 1e (la moneda).** Los valores se toman en la moneda del proceso del
  PAC, igual que los escritos a mano; la plantilla no la elige (1c-5 y el
  comportamiento existente de valores).
- **Pieza 2 (los pasos).** Cada paso es un botón; un clic desde Identificación
  vacía va a Revisión con `aria-current="step"` y no exporta; desde Revisión
  vuelve a Renglones; lo escrito no se pierde; se llega con Tab y se activa con
  Enter; "Siguiente" sigue frenando (2-1 a 2-5).
- Suite completa en verde: **715/715**, 0 fail y 0 cancelled.
- Commits con cuerpo y push: `0498ea9` y `a668941`.
- Clon en
  `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-41`.
- Paquete con `node tools/empaquetar-generador.js --ronda 41 --destino
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Prueba del Jefe `PRUEBAS-JEFE\prueba-ronda-41.js`: la corre el revisor en
  navegador real; en este entorno no hay Chromium.

## 10. Verificación del cierre (ejecutada)

- Publicación del revisor: `f1c5c4b`, **Revisor: ordenes y plan al dia**.
- Pieza 1: commit `0498ea9`, **Ronda 41 · los presupuestos en la plantilla**, con
  `tests/ronda-41-p1.test.js`, el ajuste de `tests/ronda-33-p1.test.js` y su
  cuerpo; push hecho.
- Pieza 2: commit `a668941`, **Ronda 41 · los pasos del asistente se clickean**,
  con `tests/ronda-41-p2.test.js` y su cuerpo; push hecho.
- Suite completa posterior al último commit de código: **715/715**, log
  `%TEMP%\sgc-suite-r41.log`.
- Informe y su commit: `git add INFORME-RONDA-41.md` -> `git commit -m "Ronda 41
  · informe"` -> `git push`.
- `git status --short` en `dev\`: **vacío** (se pega en el mensaje final).
- Clon para el auditor desde GitHub, ruta absoluta:
  `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-41`.
- Paquete: `node tools/empaquetar-generador.js --ronda 41 --destino
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Después del clon no se commitea nada. Los dos HEAD van en el mensaje final.
