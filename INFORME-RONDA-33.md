# INFORME-RONDA-33.md
Ronda 33 — La plantilla para llenar con un asistente de IA
SGC — 2026-10-09

## 1. Qué hice

Se completaron las dos piezas de ORDEN-RONDA-33.md. La ronda 32 pedía rechazar
el archivo entero cuando un renglón no tenía código; el Jefe lo corrigió: la
persona le da al asistente la plantilla y sus papeles desordenados, y lo normal
es que vengan pocos códigos o ninguno. Ahora esos renglones entran "por buscar"
y se completan en pantalla.

- **Paso 0 (commit 13d5e8c, del revisor).** `ordenes/` con la orden y su
  auditoría, y `PLAN_DESARROLLO.md`. Ese commit no lleva nada más.

- **Pieza 1: la plantilla y su importación, con renglones "por buscar"
  (commit df1cdb2).**
  - `fasttrack.js` `modelo()`: `"instrucciones"` pasa a ser el texto de la orden
    **tal cual** (líneas 45–61), y los dos renglones modelo se reemplazan por
    uno con un código real del catálogo vigente (98201747: `2.3.1-6563.129`) y
    uno con `"codigo": ""` y `"buscar": "resma papel A4"`.
  - `fasttrack.js` `importar()`: un renglón sin código ya no rechaza el archivo.
    Valida primero el largo de la aclaración (sigue rechazando si se pasa), deja
    cantidad y unidad vacías si no vienen y lo empuja como
    `{codigo:'', item:'', buscar, cantidad, unidad, aclaracion, porBuscar:true}`.
    El código no vacío inexistente sigue siendo error en el Fast-Track con
    servidor (lo exige `wizard.test.js`).
  - `generador/intercambio.js`: `resolverItems` deja "por buscar" un código
    vacío o uno que no existe, con el aviso *"Renglón N: el código X no está en
    el catálogo; quedó para buscar"*; `revisarConElNucleo` valida con
    `{permitirPorBuscar:true}`; `contenido()`, `cuerpoDeExportado` y
    `cuerpoDePlantilla` transportan `porBuscar`/`buscar` (sólo si están) para
    que un avance se reimporte igual.
  - `views/pasos.js`: `validarPaso`/`validarRenglones` aceptan `opciones` con
    `permitirPorBuscar`; al avanzar, un renglón por buscar frena con el motivo
    exacto *"Renglón N: falta elegir el ítem del catálogo"*.
  - `views/wizard.js` y `generador.html`: botón **"Pegar texto"** que abre el
    `<textarea id="sgc-pegar-json">` y su botón **"Cargar lo pegado"**. Al texto
    se le recorta lo que quede antes de la primera llave y después de la última,
    porque los asistentes suelen envolverlo en ```` ```json ````. Después entra
    por el mismo `importar()` que el archivo.
  - Tests: `tests/ronda-33-p1.test.js` (3, por la pantalla); `ronda-32-p2` y
    `ronda-28-c4` actualizados al caso "por buscar".

- **Pieza 2: completar los renglones "por buscar" en pantalla (commit
  1e3c87c).**
  - `catalogo/renglones.js`: la fila por buscar se ve con el texto *"Falta
    elegir el ítem del catálogo — buscado como: «…»"*, en rojo, y un botón
    **"Buscar"**. "Buscar" deja ese renglón como destino; el próximo ítem
    elegido **reemplaza** a ese renglón (con `reconstruirLista()`, sin
    `insertBefore`/`replaceChild`) conservando cantidad, unidad y aclaración,
    en vez de sumar uno nuevo. `erroresDeRenglon` devuelve `[]` para las filas
    por buscar. Quitar y `cargar`/`montar`/`vaciar` resetean el destino.
  - `catalogo/buscador.js`: API `buscar(texto)` —pone el texto en
    `#sgc-campo-clases`, corre la misma búsqueda y deja el foco a la vista en el
    buscador.
  - `views/wizard-formulario.js`: el error "ítem del catálogo" lleva al botón
    "Buscar" de esa fila.
  - `generador/documentos.js`: `revision()` marca inválido un expediente con
    renglones por buscar y suma "elegir el ítem del catálogo en los renglones
    por buscar"; por eso "Exportar para Abastecimiento" queda deshabilitado
    mientras haya alguno.
  - `css/main.css`: `.renglon-por-buscar` en rojo (`--color-error`).
  - `tools/empaquetar-generador.js`: el `LEEME.txt` suma la sección **"LLENAR
    CON UN ASISTENTE DE IA"** con los cuatro pasos.
  - Tests: `tests/ronda-33-p2.test.js` (5, por la pantalla).

## 2. Decisiones que tomé y por qué

- **"Por buscar" no es "inválido": es un estado que se resuelve.** El renglón
  por buscar `erroresDeRenglon` devuelve `[]` (no arrastra el rojo de los
  demás errores) y sólo se pinta con `.renglon-por-buscar`; el freno real está
  en `validarRevision`, que lo detecta explícitamente porque
  `validarParaAvanzar` (core/validacion.js) **no** llama a `validarRenglon` para
  EETT. Agregar un ítem "elegir el ítem del catálogo en los renglones por
  buscar" a la revisión deshabilita "Exportar", y el avance los guarda.
- **El código inexistente no vacío se rechaza en el Fast-Track con servidor,
  pero se deja por buscar en el generador.** Son dos caminos distintos:
  `wizard.test.js` (montura con servidor, ~líneas 174–228) exige que Fast-Track
  **rechace** `99.9-9999.9` con *"no existen en el catálogo"*, así que
  `fasttrack.importar` sólo relaja el **código vacío**. La relajación del código
  inexistente vive en `intercambio.resolverItems` (ruta del generador, que llama
  a Fast-Track con un verificador que acepta todo), y ahí sale como **aviso**,
  no como error. Así ninguna prueba con servidor se rompe.
- **El destino de "Buscar" reemplaza en vez de agregar**, y se implementó con
  `reconstruirLista()` (vaciar la lista y volver a agregar todas las filas en
  orden) porque el stub de DOM de las pruebas no tiene `insertBefore` ni
  `replaceChild`. Se conserva el `id` del renglón para que los valores de
  referencia sigan colgando de él.
- **`porBuscar`/`buscar` viajan en la exportación sólo si están presentes.** El
  test export→import→export de `ronda-28-c4` compara el `expediente` con
  `deepStrictEqual`; agregar las claves siempre lo rompía, y sólo hacen falta
  cuando el renglón está por buscar.
- **El pegado recorta a la primera y la última llave** en vez de intentar
  entender el envoltorio: es lo que hacen los asistentes de verdad
  (```` ```json ````), y un texto sin llaves se rechaza como JSON roto.
- **`--ronda 33` va explícito al empaquetar** y la sección nueva del LEEME se
  probó llamando a `EMPAQUETAR.leerLeeme('r33-x','09/10/2026')`, sin depender de
  `ronda-28-c5`, que hardcodea `--ronda 32` y no se toca.

## 3. Verificación

Corridas completas, todas documentadas, no sólo la mejor.

Suite completa:

```
node --test --test-timeout=120000 "tests/*.test.js"
```

| corrida | tests | pass | fail | duration_ms | nota |
|---|---|---|---|---|---|
| 1 · tras el commit de pieza 2 | 628 | 628 | 0 | 553920.7074 | log completo en %TEMP%\opencode (ver abajo) |

Tests dirigidos de las piezas:

```
node --test --test-timeout=120000 "tests/ronda-33-p1.test.js" "tests/ronda-32-p1.test.js" "tests/ronda-32-p2.test.js" "tests/ronda-28-c4.test.js" "tests/ronda-23-c1.test.js"
```

→ 21 tests, 21 pass, 0 fail, duration_ms 5670.2785 (pieza 1: ronda-33-p1
3/3; afectadas: ronda-32-p1 4/4, ronda-32-p2 4/4, ronda-28-c4 8/8, ronda-23-c1
2/2).

```
node --test --test-timeout=120000 "tests/ronda-33-p2.test.js" "tests/ronda-31-p2.test.js"
```

→ 10 tests, 10 pass, 0 fail, duration_ms 1891.7358 (pieza 2: ronda-33-p2 5/5;
afectada: ronda-31-p2 5/5).

- `node tools/check-compat.js`: 6993 archivos, 0 violaciones.
- `git diff --stat 13d5e8c..HEAD -- server/`: vacío (la ronda no toca `server/`).
- `git status`: árbol limpio tras los dos commits.

Salida completa de la suite (recorte con los tests de la ronda y el resumen;
el log entero está en el archivo de salida de la corrida del 2026-10-09):

```
✔ RONDA-33 pieza 1 · la plantilla baja con las instrucciones de la orden, tal cual (318.3956ms)
✔ RONDA-33 pieza 1 · pegar el JSON del asistente carga los renglones y deja por buscar los que no tienen código (433.8818ms)
✔ RONDA-33 pieza 1 · un texto pegado que no es JSON no carga nada (161.7716ms)
✔ RONDA-33 pieza 2 · con un renglón por buscar, "Siguiente" no pasa y lleva a ese renglón (378.5666ms)
✔ RONDA-33 pieza 2 · "Buscar" llena el buscador y el ítem elegido reemplaza al renglón (109.3365ms)
✔ RONDA-33 pieza 2 · "Guardar avance" con un renglón por buscar se reimporta igual (306.4877ms)
✔ RONDA-33 pieza 2 · "Exportar para Abastecimiento" queda deshabilitado con uno por buscar (86.4591ms)
✔ RONDA-33 pieza 2 · el LEEME del paquete explica cómo llenar con un asistente de IA (1.0243ms)
… (resto de los 628 tests) …
ℹ tests 628
ℹ suites 0
ℹ pass 628
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 553920.7074
```

Detalle del pegado por buscar que prueba la pieza 1 (test 2): un JSON envuelto
en ```` ```json ```` con tres renglones —uno con código real, uno con
`"codigo": ""` y `"buscar": "papel"`, y uno con `"codigo": "9.9.9-0000.0"`—
entra completo; el primero trae la descripción ONC y los otros dos quedan
`porBuscar`, y el aviso dice *"Renglón 3: el código 9.9.9-0000.0 no está en el
catálogo; quedó para buscar"*.

## 4. Contradicciones e información faltante

- **El único cruce real fue el del código inexistente.** La orden (pieza 1b) dice
  que un código que no existe "ya no rechaza el archivo" y entra por buscar,
  pero `wizard.test.js` (Fast-Track con servidor) exige que un código
  inexistente **sí** se rechace. Se resolvió por camino: `fasttrack.importar`
  relaja sólo el código **vacío**; el inexistente se relaja en
  `intercambio.resolverItems`, que es la ruta del generador y donde la orden
  quiere el comportamiento. Queda declarado acá para que el auditor lo vea.
- No hay información faltante de peso. La orden nombra `app/generador.html:146-148`
  y `views/fasttrack.js:131-170`; los números de línea quedaron cerca pero no
  exactos (el bloque de pegado se armó en el cuerpo del paso 1), sin ambigüedad
  de contenido.

## 5. Qué NO hice

- No toqué `server/` (verificado con `git diff -- server/`): la ronda es del
  generador que se empaqueta.
- No modifiqué la orden ni `PLAN_DESARROLLO.md` (los tocó el paso 0 del revisor).
- No relajé el código inexistente no vacío en `fasttrack.importar`: sigue
  rechazando en el Fast-Track con servidor, como lo exige `wizard.test.js`.
- No toqué `tests/ronda-28-c5.test.js` (hardcodea `--ronda 32` y su regex
  `r32-…`); la sección del LEEME se prueba en `ronda-33-p2` llamando
  directamente a `leerLeeme`.
- No corrí la prueba del Jefe (`PRUEBAS-JEFE\prueba-ronda-33.js`): la corre el
  revisor en navegador real.

## 6. Riesgos que veo

- El aviso de código inexistente es un **aviso**, no un error: si un asistente
  inventa códigos con forma válida, esos renglones entran "por buscar" en vez de
  rechazarse. Es a propósito (la orden lo pide) y el renglón se ve en rojo hasta
  que la persona elige el ítem, pero conviene que el revisor mire el flujo real.
- La detección de "por buscar" en la revisión es explícita en
  `documentos.revision()` porque `validarParaAvanzar` no valida los renglones de
  EETT; si en otra ronda se agrega validación de renglones al núcleo, hay que
  revisar que no haya doble motivo.
- Bajo carga, la suite puede volver a cortarse en `ronda-12` (spawn de Python) o
  en un test de servidor, como en rondas anteriores: pasa en aislamiento y la
  corrida de cierre está 628/628 en verde.
- `check-compat.js` tardó más que otras veces (>2 min en la primera corrida con
  presupuesto de 120 s): escanea 6993 archivos; conviene darle margen de tiempo.

## 7. Mediciones

- Suite completa: 628 tests, ~554 s (duration_ms 553920.7074).
- check-compat.js: 6993 archivos, 0 violaciones (con presupuesto amplio).
- Tests dirigidos pieza 1: 21 tests, ~5,7 s.
- Tests dirigidos pieza 2: 10 tests, ~1,9 s.
- `git diff --stat`:
  - df1cdb2: 8 files changed, 368 insertions(+), 68 deletions(-).
  - 1e3c87c: 7 files changed, 321 insertions(+), 3 deletions(-).

## 8. Accesos fuera del repositorio

- Ninguno. La montura del generador carga los módulos reales por `<script>`
  (file://) y el catálogo se sirve como archivos .js estáticos generados por
  `tools/build-catalogo.js`. La única excepción de red de la suite sigue siendo
  el test `ronda-12`, que llama a Python local con PyYAML en la máquina de
  pruebas. No hay fetch, XMLHttpRequest ni servidor en la app que se empaqueta.

## 9. Qué se lleva el paquete — criterios de aceptación (ORDEN-RONDA-33)

- Pieza 1: la plantilla baja con `"instrucciones"` idénticas a la orden (test 1)
  y dos renglones —uno con código real `2.3.1-6563.129` y `buscar`, otro con
  `"codigo": ""` y `"buscar": "resma papel A4"`—; "Pegar texto" recorta el
  ```` ```json ```` y entra por `importar()`; los renglones sin código o con uno
  inexistente entran "por buscar", con el aviso del renglón 3; un texto que no
  es JSON no carga nada. Tests 3/3.
- Pieza 2: "Siguiente" no pasa con un renglón por buscar y lleva a ese renglón;
  "Buscar" llena `#sgc-campo-clases` y el ítem elegido reemplaza al renglón
  conservando cantidad y aclaración (siguen dos renglones); "Guardar avance" se
  reimporta todavía por buscar; "Exportar para Abastecimiento" queda
  deshabilitado; el `LEEME.txt` trae la sección "LLENAR CON UN ASISTENTE DE IA".
  Tests 5/5.
- Suite completa en verde: 628/628; check-compat 0 violaciones.
- Dos commits con cuerpo (df1cdb2 pieza 1, 1e3c87c pieza 2) y push hecho.
- Clon en
  `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-33`
  desde GitHub.
- Paquete generado con `node tools/empaquetar-generador.js --ronda 33
  --destino C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Prueba del Jefe `PRUEBAS-JEFE\prueba-ronda-33.js` (pendiente de que la corra
  el revisor en navegador real).

## 10. Verificación del cierre (ejecutada)

- Informe y su commit: `git add INFORME-RONDA-33.md` →
  `git commit -m "Ronda 33 · informe"` → `git push`.
- Clon para el auditor: `git clone
  https://github.com/contra3000/Contrataciones.git
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-33`
  (ruta absoluta).
- En el clon: `git log --oneline -5` coincide con `dev\`.
- Paquete: `node tools/empaquetar-generador.js --ronda 33 --destino
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Después del clon no se commitea nada. Los dos HEAD van en el mensaje final.
