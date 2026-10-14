# INFORME-RONDA-35.md
Ronda 35 — Identificación completa, y el PAC bien impreso
SGC — 2026-10-14

## 1. Qué hice

Se completaron las dos piezas de `ordenes/ORDEN-RONDA-35.md` (hito H27). La
pieza 1 hizo obligatoria la Identificación completa —trimestre, proceso del PAC
y lugar de entrega— también en los archivos viejos, con una marca explícita del
generador; la pieza 2 sacó el campo manual del preventivo en dólares, calculó la
moneda del requerimiento desde el proceso del PAC, y frenó "Imprimir" cuando
falta la justificación del PAC.

- **Paso 0 (commit `d4c6a06`, ya publicado).** `ordenes/` con la orden y su
  auditoría, y `PLAN_DESARROLLO.md`. Ese commit no lleva nada más.

- **Pieza 1: la Identificación de los avances viejos, y el lugar de entrega
  (commit `c4a8662`).**
  - La obligación de trimestre y PAC deja de depender de que el campo exista en
    los datos y pasa a depender de **una marca explícita del generador**
    (`core/validacion.js`: `validarIdentificacion(datos, { exigirCompleto })`).
    El generador la pone al montarse (`generador.js`); **sin la marca**, como en
    la aplicación con servidor, la validación sigue como siempre (test 1e).
  - Con la marca, un requerimiento de la 33 sin trimestre, PAC ni lugar de
    entrega **entra pero no exporta**: el motivo pide las tres cosas y el paso
    "1 · Identificación" queda marcado "· falta" (test 1a).
  - Nuevo campo **`#sgc-lugar-entrega`** ("Lugar de entrega") al final de
    Identificación, vacío, con su `#sgc-error-lugar-entrega`; obligatorio con la
    misma marca, con el mensaje *"Escribí el lugar de entrega"* y el mismo trato
    de "Siguiente" que el trimestre y el PAC (test 1d: el foco queda en el campo
    con `campo-con-error`).
  - La **EETT** imprime en "Lugar de entrega" lo que escribió la persona
    (`renders/especificacion-tecnica.js` usa `m.lugarEntrega || m.lugar`), y el
    **requerimiento** sigue con la constante de `config/aplicacion.json` (*"VII
    Brigada Aérea - Moreno"*) (test 1b).
  - El **JSON** lleva `"lugarEntrega"` junto al trimestre; el avance lo recupera
    y un archivo sin él entra con el campo para escribir (tests 1b/1c).
  - Tests: `tests/ronda-35-p1.test.js` (5, por la pantalla), con el fixture
    `tests/fixtures/r33-completo.json` (un requerimiento completo de la 33).

- **Corrección de la pieza 1 (commit `30c6c32`, declarado).** Ocho suites viejas
  (rondas 28 a 32) armaban la Identificación con título, año, dependencia,
  trimestre y PAC, pero **sin el lugar de entrega**: al volverse obligatorio,
  "Siguiente" ya no pasaba y las 25 pruebas quedaban en rojo. Al montar el cierre
  de la pieza 1 nunca se corrió la suite completa, así que el rojo apareció recién
  en el cierre de esta ronda (ver §3). Se agregó la escritura de
  `#sgc-lugar-entrega` en el helper de cada una de las ocho suites, con la misma
  marca de la 35, y quedan 43/43 verdes. Es test-only: no toca `app/`.

- **Pieza 2: los procesos del PAC en dólares, e "Imprimir" que frena
  (commit `9c6967b`).**
  - **La moneda** sale del proceso del PAC elegido (`generador/documentos.js`,
    `monedaDe`): `USD` si el proceso es en dólares, `ARS` en los demás casos,
    también "No autorizado en el PAC". El expediente del generador la lleva en
    `datos.moneda`; **sin ella** (aplicación con servidor) queda `ARS`.
  - **Sale el campo manual del preventivo en dólares:** el bloque de
    `app/generador.html:201-204`, y lo que lo manejaba en `views/wizard.js`
    (`actualizarPac`, reescrito) y `views/wizard-formulario.js`
    (`sincronizar`/`aplicar`). El preventivo del proceso 22 ahora se calcula igual
    que en pesos, con el promedio de los valores de referencia (tests 2a/2g).
  - **El bloque de valores dice la moneda** (`views/requerimiento-valores.js`:
    `simbolo()` devuelve `USD` o `$`): "Promedio unitario", "Preventivo del
    renglón" y "Valor preventivo de la contratación" (test 2a).
  - **El requerimiento impreso** (`renders/requerimiento.js`: `prefijoMoneda` y
    `totalEnLetras` con la moneda) dice "Total general: USD 1.000,00" y **"LA
    SUMA DE: DÓLARES ESTADOUNIDENSES MIL CON 00/100.-"**; la fila "Preventivo en
    dólares" dejó de imprimirse (tests 2a/2b; `tests/requerimiento.test.js` cubre
    `totalEnLetras(x, 'USD')`). Sin moneda sigue diciendo PESOS: el requerimiento
    del servidor sale byte a byte igual (test 1e de la 34, en verde).
  - **La comparación con el PAC** (`itemsDelPac`) usa en USD el mismo preventivo
    calculado que en ARS, contra el monto del proceso, con el mismo motivo:
    *"justificar el preventivo que supera el monto del proceso N del PAC"* (test
    2g, y el 2c de "Imprimir").
  - **"Imprimir" frena con lo que falta del PAC** (`generador/documentos.js`,
    `imprimir()`): si supera el monto y no hay justificación, no compone nada y
    dice por qué (test 2c, el caso del PDF del Jefe, proceso 32).
  - El **JSON** lleva `"moneda": "ARS" | "USD"` y deja de llevar
    `pac.preventivoUsd`; un avance de la 34 que traiga `pac.preventivoUsd` entra
    con el aviso *"el preventivo en dólares ahora sale de los valores de
    referencia"* (`generador/intercambio.js`, `contenido`/`cuerpoDeExportado`)
    (test "avance de la 34").

## 2. Decisiones que tomé y por qué

- **La obligación de Identificación vive en una marca, no en la forma del
  archivo.** La pieza 1 lo pide así para no tocar la aplicación con servidor
  (ADR-044): el generador pasa `exigirCompleto` y el servidor no, así que un
  expediente suyo sin trimestre, PAC ni lugar sigue siendo válido (test 1e). Es
  lo que resuelve la pregunta del auditor 34.
- **La moneda sube sola al documento.** En vez de tocar cada render con
  condiciones, se calcula una vez (`monedaDe`) y viaja en `m.base.moneda`; los
  renders sólo eligen `"USD "` o `"$ "` y `DÓLARES` o `PESOS`. Sin moneda, todo
  sale como antes, que es lo que mantiene idéntico el requerimiento del servidor.
- **`totalEnLetras` recibe la moneda con valor por defecto PESOS** (no se rompe
  ninguna llamada vieja) y sólo dice DÓLARES si recibe `'USD'` exactamente.
- **El aviso del `preventivoUsd` viejo sale de `cuerpoDeExportado`, no de
  `revisarConElNucleo`.** Cuando la pieza 2 hizo que `pacExportado` dejara de
  emitir `preventivoUsd`, la detección del archivo viejo tenía que mirar el crudo
  antes de normalizarlo; por eso `cuerpoDeExportado` devuelve `avisos` y
  `importar` los mezcla al final (`armado.avisos`).
- **`imprimir()` no puede usar `!revision.valido`.** Antes de imprimir, los
  entregables del expediente todavía están vacíos, así que el expediente no es
  "válido" aunque todo lo demás esté bien; frenar por `!valido` trabaría la
  primera impresión. El freno es puntual: ítems del PAC pendientes, o campos o
  renglones faltantes (los mismos que ya miraba).
- **`generador/valores.js` recuerda la moneda entre sincronizaciones.** Cambiar
  de renglón no puede hacer que el bloque de valores "olvide" que el proceso es
  en dólares: `estado.moneda` se conserva y sólo se pisa cuando llega una nueva.
- **El aviso del proceso que no está en el PAC se deja como estaba** (avisa y
  deja el campo para elegir): no era parte de esta ronda y la 34 ya lo había
  decidido.
- **Las ocho suites viejas se corrigen en un commit propio y declarado**, no
  dentro del commit de la pieza 2: son deuda de la pieza 1, no del cambio de la
  moneda. Es el único commit extra respecto de las dos piezas que pide la orden.

## 3. Verificación

Corridas completas, todas documentadas, no sólo la mejor.

Suite completa:

```
node --test --test-timeout=120000 --test-force-exit "tests/*.test.js"
```

| corrida | tests | pass | fail | duration_ms | nota |
|---|---|---|---|---|---|
| 1 · previa a la corrección | 651 | 626 | 25 | 710147.6953 | deuda de la pieza 1: 8 suites viejas sin lugar de entrega (`%TEMP%\opencode\suite35.log`) |
| 2 · final, tras la corrección | 651 | 651 | 0 | 557067.847 | `%TEMP%\opencode\suite35b.log` |

Tests dirigidos de la ronda (camino rápido, antes de la suite final):

```
node --test --test-timeout=120000 --test-force-exit "tests/ronda-35-p2.test.js" "tests/ronda-34-p2.test.js" "tests/requerimiento.test.js"
```
→ 23 tests, 23 pass, 0 fail, duration_ms 2077.9408.

```
node --test --test-timeout=120000 --test-force-exit "tests/anexo-eett.test.js" "tests/exportar.test.js" "tests/plantillas.test.js" "tests/renders.test.js" "tests/requerimiento-formulario.test.js" "tests/requerimiento-servidor.test.js" "tests/validacion.test.js" "tests/wizard.test.js" "tests/ronda-34-p1.test.js" "tests/ronda-35-p1.test.js"
```

→ 79 tests, 79 pass, 0 fail, duration_ms 52526.3666.

Corrección de la pieza 1:

```
node --test --test-timeout=120000 --test-force-exit "tests/ronda-28-c3.test.js" "tests/ronda-28-c4.test.js" "tests/ronda-29-p2.test.js" "tests/ronda-30-p1.test.js" "tests/ronda-30-p2.test.js" "tests/ronda-31-p1.test.js" "tests/ronda-31-p2.test.js" "tests/ronda-32-p1.test.js"
```

→ 43 tests, 43 pass, 0 fail, duration_ms 5298.1916.

- `node tools/check-compat.js app`: **6994 archivos, 0 violaciones**.
- `git diff --stat c4a8662^..HEAD -- server/`: **vacío** (la ronda no toca
  `server/`).
- `git status`: árbol limpio tras los commits y el del informe.

Salida de la suite final (los tests de la ronda y el resumen; el log entero está
en `suite35b.log`):

```
✔ RONDA-35 pieza 1a · un requerimiento de la 33 no exporta sin trimestre, PAC ni lugar de entrega, y el paso 1 queda "falta" (920.0229ms)
✔ RONDA-35 pieza 1b · con trimestre, PAC y lugar, imprime y exporta: el JSON trae los tres (283.6142ms)
✔ RONDA-35 pieza 1c · un avance de la 31, sin trimestre ni PAC, entra y no exporta hasta completar la Identificación (278.6638ms)
✔ RONDA-35 pieza 1d · sin lugar de entrega, "Siguiente" no pasa y deja el foco en el campo (228.9865ms)
✔ RONDA-35 pieza 1e · sin la marca (aplicación con servidor), la Identificación sin trimestre, PAC ni lugar sigue siendo válida (1.0901ms)
✔ totalEnLetras: en un proceso en dólares dice DÓLARES ESTADOUNIDENSES (0.6716ms)
✔ RONDA-35 pieza 2a · ya no hay campo manual "Preventivo en dólares" (194.4826ms)
✔ RONDA-35 pieza 2a · el proceso 22 (USD) exporta moneda USD y el impreso lo dice (903.5936ms)
✔ RONDA-35 pieza 2b · el proceso 4 (ARS) exporta moneda ARS y el impreso sigue en pesos (203.8529ms)
✔ RONDA-35 pieza 2c · "Imprimir" frena con el PAC superado y sin justificación (proceso 32) (211.9123ms)
✔ RONDA-35 pieza 2a · el proceso 22 calcula el preventivo de los valores, en USD (400.3589ms)
✔ RONDA-35 pieza 2a · un avance de la 34 con "preventivoUsd" entra, con el aviso (182.8212ms)
… (resto de los 651 tests) …
ℹ tests 651
ℹ suites 0
ℹ pass 651
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 557067.847
```

## 4. Contradicciones e información faltante

- **La única contradicción fue de proceso, no de la orden: la pieza 1 se
  commiteó sin correr la suite completa.** Su camino rápido quedó verde
  (`ronda-35-p1` 5/5) y su prueba dirigida también, pero ocho suites viejas
  (rondas 28 a 32) hacían Identificación sin el lugar de entrega y quedaron en
  rojo. Lo detectó la suite completa de esta ronda (§3, corrida 1) y se corrigió
  en un commit propio y declarado (`30c6c32`). Con eso, 651/651.
- Los números de línea que cita la orden quedaron aproximados, como en la 34: el
  bloque del campo manual (`generador.html:201-204`) es el que se eliminó, sin
  ambigüedad de contenido.
- **La prueba del Jefe (`PRUEBAS-JEFE\prueba-ronda-35.js`) no la corrí:** la corre
  el revisor en navegador real. Sí quedó escrito
  `PRUEBAS-JEFE\DEVOLUCION-RONDA-35.md`.

## 5. Qué NO hice

- No toqué `server/` (verificado con `git diff -- server/`, vacío).
- No modifiqué la orden ni `PLAN_DESARROLLO.md` (los tocó el paso 0).
- No modifiqué los tests de la aplicación con servidor.
- No toqué la plantilla ni sus instrucciones: la moneda y el PAC salen del SGC.
- **No toqué `tests/helpers/`**: la montura del generador
  (`tests/helpers/generador-montura.js`) ya ofrecía todo lo que hizo falta
  (`elegirPac`, `escribir`, `cargarValores`, `elegirArchivo`). El único archivo de
  `tests/` fuera de los tests de la ronda fue el fixture `r33-completo.json` de la
  pieza 1 y las ocho suites viejas de la corrección.
- No corrí la prueba del Jefe en navegador.

## 6. Riesgos que veo

- **La suite completa es delgada en el borde del tiempo.** El primer run tardó
  710 s y el segundo 557 s; ambos entraron en el presupuesto de la herramienta,
  pero conviene correrla con margen. No hubo flakes en esta ronda.
- **`check-compat.js` sigue siendo lento** (6994 archivos). La primera invocación
  con `Select-Object` se colgó por el pipe; corrido directo devuelve el resultado
  en segundos. No es de la pieza.
- **La deuda de la pieza 1 se ve recién con la suite completa.** Para las rondas
  que sigan, correr SIEMPRE la suite entera antes de commitear, no sólo el camino
  rápido: es lo que dejó pasar el rojo.
- **La comparación con el PAC en dólares no distingue redondeos** de más de dos
  decimales; el promedio de los valores se calcula como en pesos. Es lo que pidió
  el Jefe, pero un proceso en USD con muchos presupuestos podría quedar al borde
  del monto.

## 7. Medidas (métricas)

- Suite completa final: **651/651** en 557067.847 ms (≈ 9,3 min).
- Suite completa previa (con la deuda): 651 tests, 626 pass, 25 fail.
- Corrección de las suites viejas: 43/43 en 5298.1916 ms.
- Camino rápido de la ronda: 23/23 en 2077.9408 ms (pieza 2) y 79/79 en
  52526.3666 ms (módulos tocados + rondas 34/35).
- `check-compat.js`: 6994 archivos, 0 violaciones.
- `git diff --stat`:
  - `c4a8662` (pieza 1): 14 files changed, 525 insertions(+), 20 deletions(-).
  - `30c6c32` (corrección de la pieza 1): 8 files changed, 8 insertions(+).
  - `9c6967b` (pieza 2): 14 files changed, 443 insertions(+), 150 deletions(-),
    incluye `tests/ronda-35-p2.test.js` (nuevo).

## 8. Accesos fuera del repositorio

- Ninguno nuevo en esta ronda. La montura del generador carga los módulos reales
  por `<script>` (file://); no hay fetch, XMLHttpRequest ni servidor en la app que
  se empaqueta. La única salida de red de la suite sigue siendo el test `ronda-12`
  (Python local).
- El fixture `tests/fixtures/r33-completo.json` es una copia de
  `PRUEBAS-JEFE\r33-completo.json` (un requerimiento de la 33), versionada dentro
  del repositorio.

## 9. Qué se lleva el paquete — criterios de aceptación (ORDEN-RONDA-35)

- **Pieza 1.** Un requerimiento de la 33 (sin trimestre, PAC ni lugar) entra y no
  exporta: el motivo pide los tres y el paso 1 dice "· falta" (test 1a). Elegidos
  el trimestre, el proceso 1 y un lugar escrito, imprime y exporta: el JSON trae
  los tres, la EETT dice el lugar escrito y el requerimiento sigue con "VII
  Brigada Aérea - Moreno" (test 1b). Un avance de la 31 sin trimestre ni PAC entra
  y no exporta hasta completar la Identificación (test 1c). Sin lugar, "Siguiente"
  no pasa y deja el foco en `#sgc-lugar-entrega` con `campo-con-error` (test 1d).
  Sin la marca, la aplicación con servidor sigue válida sin los tres campos (test
  1e). Tests 5/5.
- **Pieza 2.** Con el proceso 22 no existe `#sgc-pac-preventivo-usd` (test 2a);
  con 10 × 100 el bloque dice "USD" y el impreso "USD 1.000,00" y "DÓLARES
  ESTADOUNIDENSES MIL", y no dice "PESOS" ni "$ 1.000,00" (test 2a); con el
  proceso 4 (ARS) el impreso sigue en "$ 1.000,00"/"PESOS MIL" y el JSON dice
  `"moneda": "ARS"` (test 2b); con el proceso 32 y $ 106.000.000 sin
  justificación, "Imprimir" no compone nada y dice *"justificar el preventivo que
  supera el monto del proceso 32 del PAC"* (test 2c); un avance de la 34 con
  `pac.preventivoUsd` entra con el aviso (test 4); el proceso 22 usa el preventivo
  calculado en USD y no exporta sin justificación si supera el monto (test 2g del
  `ronda-34-p2`). Tests 4 + 8.
- Suite completa en verde: **651/651**; `check-compat` 0 violaciones; el
  requerimiento del servidor byte a byte idéntico (control 1e de la 34).
- Commits con cuerpo: `c4a8662` (pieza 1), `30c6c32` (corrección declarada de la
  pieza 1), `9c6967b` (pieza 2) — y push hecho.
- Clon en
  `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-35`
  desde GitHub.
- Paquete generado con
  `node tools/empaquetar-generador.js --ronda 35 --destino C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Prueba del Jefe `PRUEBAS-JEFE\prueba-ronda-35.js` (pendiente de que la corra el
  revisor en navegador real).

## 10. Verificación del cierre (ejecutada)

- Informe y su commit: `git add INFORME-RONDA-35.md` →
  `git commit -m "Ronda 35 · informe"` → `git push`.
- Clon para el auditor: `git clone
  https://github.com/contra3000/Contrataciones.git
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-35`
  (ruta absoluta).
- En el clon: `git log --oneline -6` coincide con `dev\`.
- Paquete: `node tools/empaquetar-generador.js --ronda 35 --destino
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Después del clon no se commitea nada. Los dos HEAD van en el mensaje final.
