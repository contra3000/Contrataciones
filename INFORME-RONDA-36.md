# INFORME-RONDA-36.md
Ronda 36 — La justificación del PAC en Fundamentación, y el requerimiento sin "Lugar"
SGC — 2026-10-15

## 1. Qué hice

Se completaron las dos piezas de `ordenes/ORDEN-RONDA-36.md` (hito H27, piloto
`r34-187a184`). La pieza 1 mudó la "Justificación del PAC" de "1 · Identificación"
a "3 · Fundamentación", la hizo aparecer por tres causas (año, trimestre y monto,
además de "No autorizado") y obligatoria cuando aparece; la pieza 2 sacó la fila
"Lugar" del requerimiento del generador y la constante de `config/aplicacion.json`,
dejando el lugar de entrega sólo en la EETT.

Cada pieza corrió la **suite completa en verde antes de su commit**, como pidió la
orden tras lo de la 35. No hubo deuda.

- **Paso 0 (commit `bad391f`, ya publicado).** `ordenes/` con la orden y su
  auditoría, y `PLAN_DESARROLLO.md`. Ese commit no lleva nada más.

- **Pieza 1: la justificación del PAC, en Fundamentación y por tres causas
  (commit `38e9ffa`, 10 files, 688 insertions, 117 deletions).**
  - La cuenta de las causas vive en el núcleo, una sola vez
    (`core/validacion.js`: `causasDelPac(identificacion, renglones)` y su auxiliar
    `montoDelPac(n, moneda)`, exportados). Devuelve `{ requerida, motivos, items }`:
    **año** (el del requerimiento no es el `anio` del PAC, 2026), **trimestre** (el
    elegido no es el del proceso), **monto** (el preventivo, en ARS o en USD, supera
    el monto del proceso, como `itemsDelPac`), y **no autorizado** ("No autorizado
    en el PAC").
  - El **campo `#sgc-pac-justificacion`** y su contenedor se mudaron de
    `#sgc-paso-identificacion` a `#sgc-paso-fundamentacion`, **después de
    "Justificación del requerimiento" y antes de "Objetivo"** (`app/generador.html`).
    Conserva el mismo id y el JSON sigue en `pac.justificacion`.
  - Arriba del campo, `#sgc-pac-justificacion-motivos` escribe una línea por cada
    causa con sus datos (p. ej. *"El preventivo ($ 106.000.369,00) supera el monto
    del proceso 32 del PAC ($ 762.637,50)."*, *"Se pide para el 4° trimestre y el
    PAC prevé el proceso 32 para el 3°."*, *"El requerimiento es del año 2027 y el
    PAC es de 2026."*, *"El pedido no está autorizado en el PAC."*).
  - **Obligatorio cuando aparece:** `views/pasos.js` `validarFundamentacion(datos,
    opciones)` agrega `errorCampo('pacJustificacion', …)`; "Siguiente" no pasa y
    deja el foco en `#sgc-pac-justificacion` con `campo-con-error`; el faltante
    llega a `pasosPendientes()` (`generador.js`) como campo de Fundamentación, así
    el paso "3 · Fundamentación" queda "· falta"; Imprimir y Exportar siguen
    frenados (`generador/documentos.js`, `revision()` empuja `'pacJustificacion'` a
    `r.faltantes.campos`). La importación pasa `exigirCompleto:false`, que es lo que
    deja entrar un avance a medio completar (test 1d del `ronda-34-p2` de la 34,
    ahora en verde).
  - **Si la causa desaparece el campo se oculta y NO se borra lo escrito:**
    `views/wizard.js` `actualizarPac` (reescrito) lee `estado.datos.identificacion`,
    llama a `causasDelPac`, muestra u oculta el campo y los motivos, y **nunca**
    limpia el textarea. Sólo se imprime/exporta mientras haya causa
    (`generador/documentos.js` vacía `datosIniciales.pac.justificacion` cuando
    `!causasPac.requerida`), test 1f.
  - El **requerimiento impreso** sigue diciendo "Justificación del PAC"
    (`renders/requerimiento.js`), test 1b.
  - Tests: `tests/ronda-36-p1.test.js` (6, por la pantalla).

- **Pieza 2: el requerimiento sin "Lugar" (commit `8e5a2b9`, 7 files, 232
  insertions, 30 deletions).**
  - **Sale la constante:** `lugarEntrega` de `config/aplicacion.json` y la función
    `lugarEntrega()` de `generador/documentos.js`; `expedienteLocal()` deja de poner
    `lugar`. El paquete se regeneró con `node tools/build-config.js`
    (`app/config/aplicacion.js` ya no la trae).
  - **El requerimiento saltea la fila:** en `renders/documento.js` `modelo.lugar`
    cae a `''` en vez de `'—'`, así `paresEncabezado` no agrega el par vacío. Es la
    clave para no tocar la aplicación con servidor: **su `identificacion.lugar`
    viene en los datos** y se imprime igual.
  - **La EETT sigue con "Lugar de entrega"** = lo que escribió la persona
    (`renders/especificacion-tecnica.js` usa `m.lugarEntrega || m.lugar`).
  - Tests: `tests/ronda-36-p2.test.js` (3, por la pantalla).

### Tests viejos que cambié, uno por uno

Pieza 1 (`38e9ffa`):

- **`tests/ronda-34-p2.test.js` · test "2d" (proceso 4, monto superado).**
  Renombrado a *"…la justificación del PAC en Fundamentación frena y desbloquea"*.
  Antes: el bloque del PAC vivía en Identificación y "Siguiente" pasaba; exportar
  frenaba con el motivo. Ahora: el campo vive en Fundamentación, se afirma el texto
  de `#sgc-pac-justificacion-motivos` (nombra el proceso 4), "Siguiente" **no**
  pasa y deja `#sgc-pac-justificacion` con `campo-con-error` y el foco; con la
  justificación cargada recién exporta.
- **`tests/ronda-34-p2.test.js` · mitad en dólares del "proceso 22".**
  El avance USD ahora se detiene en Fundamentación pidiendo la justificación del
  proceso 22; el test la llena ahí antes de avanzar a Revisión (antes la llenaba en
  Identificación). El resto (moneda USD en el impreso) no cambió.
- **`tests/ronda-34-p2.test.js` · test "2h" ("No autorizado en el PAC").**
  Renombrado a *"…la justificación en Fundamentación frena y desbloquea, y el
  documento impreso lo dice"*. Ahora verifica el campo en Fundamentación, el texto
  *"no está autorizado en el PAC"* y que "Siguiente" no pasa sin justificar.
- **`tests/ronda-35-p2.test.js` · test "2c" (proceso 32, "Imprimir" frena).**
  Renombrado a *"el PAC superado pide la justificación en Fundamentación y frena
  Imprimir"*. Además de que "Imprimir" no compone nada, ahora "Siguiente" tampoco
  pasa de Fundamentación sin la justificación. Se actualizó el comentario de cabecera.
- **`tests/ronda-34-p1.test.js` · fixture del "exportadoCompleto".**
  El proceso del PAC pasó de `'4'` a `'8'`, porque el test prueba el 2° trimestre y
  el proceso 4 es del 1°: con el proceso 4 aparecía la causa de trimestre y el test
  dejaba de medir lo que mide. Se actualizó el comentario de cabecera.
- **`tests/ronda-34-p2.test.js` y `tests/ronda-35-p2.test.js`: mapa nuevo
  `TRIMESTRE_DEL_PROCESO = { '4':'1', '8':'2', '22':'3', '32':'3' }`.** Los
  archivos de estos tests eligen un proceso del PAC; ahora el trimestre del archivo
  tiene que ser el del proceso para que no aparezca la causa de trimestre (si no,
  pedirían justificación por un motivo que no es el que el test mide).

Pieza 2 (`8e5a2b9`):

- **`tests/ronda-34-p1.test.js` · test "1b" y cabecera.** Afirmaba
  `apariciones(impreso, 'VII Brigada Aérea - Moreno') === 1`; ahora afirma `=== 0`
  (el requerimiento ya no imprime la constante). Se sacó "Lugar VII Brigada Aérea -
  Moreno" de la cabecera del archivo.
- **`tests/ronda-35-p1.test.js` · test "1b" y cabecera.** Afirmaba
  `impreso.includes(CONSTANTE)` (presente); ahora `=== false` (ausente). Se cambió
  "el requerimiento sigue con la constante de config" por "ya no lleva la fila
  Lugar" en la cabecera.

## 2. Decisiones que tomé y por qué

- **La cuenta de las causas vive en el núcleo y la comparten pantalla y
  documento.** `causasDelPac` se calcula una sola vez y la usan `views/wizard.js`
  (para mostrar/ocultar y redactar los motivos) y `generador/documentos.js` (para
  decidir si la justificación viaja y se imprime). Así el texto que ve la persona
  y lo que hace el documento no pueden divergir.
- **Lo escrito se conserva.** La orden lo pide explícito (§e): cuando la causa
  desaparece, el campo se oculta pero no se borra. `actualizarPac` nunca limpia el
  textarea; el documento sólo incluye la justificación mientras `causasPac.requerida`
  sea verdadero. Si la causa vuelve, reaparece con lo escrito (test 1f).
- **El faltante del PAC entra como campo de Fundamentación.** `revision()` empuja
  `'pacJustificacion'` a `r.faltantes.campos`; eso es lo que lee
  `pasosPendientes()` y hace que el paso 3 quede "· falta" (era justo el síntoma que
  reportó el Jefe en la 35: sólo quedaba marcada "4 · Revisión").
- **El campo va en Fundamentación, no en Identificación.** Además de lo que pidió el
  Jefe, la justificación es una fundamentación del pedido; dejarla junto a la
  Justificación del requerimiento la pone donde se lee.
- **Pieza 2: la fila se saltea desde `modelo.lugar`, no sacando `lugar` de
  `expedienteLocal`.** El valor del requerimiento cae a `m.base.lugar`; si sólo se
  sacaba de los datos, el generador habría impreso *"Lugar: —"*. Con `modelo.lugar`
  en `''` el par no se agrega, y la aplicación con servidor (que sí trae su `lugar`)
  sale byte a byte igual.
- **La constante sale de `config/aplicacion.json` (una sola vez) y se regenera el
  paquete.** `build-config --verificar` queda como control de que fuente y paquete
  no se separan.
- **No toqué la aplicación con servidor ni sus tests.** El requerimiento del
  servidor sale idéntico byte a byte (control pieza 1e de la 34 y 2c de esta ronda).

## 3. Verificación

Corridas completas, todas documentadas, no sólo la mejor.

Suite completa:

```
node --test --test-timeout=120000 "tests/*.test.js"
```

| corrida | tests | pass | fail | duration_ms | nota |
|---|---|---|---|---|---|
| pieza 1 · final | 657 | 657 | 0 | — | `tests/ronda-36-p1.test.js` incluido; corrida de la sesión de la pieza 1 |
| pieza 2 · final | 660 | 660 | 0 | 727570.2264 | `%TEMP%\r36-suite.txt` |

Tests dirigidos de la ronda (camino rápido, antes de la suite final):

```
node --test --test-timeout=120000 tests/ronda-36-p2.test.js
```
→ 3 tests, 3 pass, 0 fail, duration_ms 1054.5808.

```
node --test --test-timeout=120000 tests/ronda-34-p1.test.js tests/ronda-35-p1.test.js tests/renders.test.js tests/ronda-36-p1.test.js
```
→ 22 tests, 22 pass, 0 fail, duration_ms 2456.0034.

Camino rápido de la pieza 1 (sesión de la pieza 1): `ronda-34-p2` + `ronda-35-p2`
→ 12 tests, 12 pass.

- `node tools/check-compat.js app`: **6994 archivos, 0 violaciones**.
- `git diff --stat 38e9ffa^..HEAD -- server/`: **vacío** (la ronda no toca
  `server/`).
- `git status`: árbol limpio tras los commits.

Salida de la suite final (los tests de la ronda y el resumen; el log entero está
en `%TEMP%\r36-suite.txt`):

```
✔ RONDA-36 pieza 1a · la justificación del PAC está en Fundamentación, no en Identificación; y con el monto superado aparece y dice por qué (1187.9197ms)
✔ RONDA-36 pieza 1b · sin la justificación "Siguiente" no pasa y marca el campo; con ella imprime, exporta y el requerimiento lo dice (495.587ms)
✔ RONDA-36 pieza 1c · pidiendo para otro trimestre, el campo aparece, nombra los dos y frena la exportación (340.2985ms)
✔ RONDA-36 pieza 1d · con otro año, el campo aparece y nombra 2027 y 2026 (277.7256ms)
✔ RONDA-36 pieza 1e · sin causas el campo no aparece y el requerimiento exporta (368.8105ms)
✔ RONDA-36 pieza 1f · lo escrito se conserva si la causa desaparece y vuelve (396.5845ms)
✔ RONDA-36 pieza 2a · el requerimiento impreso no tiene "Lugar"; la EETT dice el lugar de entrega y la constante no aparece (1495.2663ms)
✔ RONDA-36 pieza 2b · la constante salió del paquete del generador y build-config queda al día (856.8969ms)
✔ RONDA-36 pieza 2c · control: el requerimiento de la aplicación con servidor sale idéntico a antes (13.0689ms)
… (resto de los 660 tests) …
ℹ tests 660
ℹ suites 0
ℹ pass 660
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 727570.2264
```

## 4. Contradicciones e información faltante

- **Ninguna contradicción de la orden esta vez.** A diferencia de la 35, cada pieza
  corrió la suite completa antes de commitear y quedó en verde (pieza 1: 657/657;
  pieza 2: 660/660). No hubo deuda ni commit de corrección.
- Los números de línea que cita la orden quedaron aproximados, como en rondas
  anteriores: el bloque del PAC (`generador.html:201-204`) y el de
  "Justificación del requerimiento" (`generador.html:316-317`) se ubicaron por su
  contenido, sin ambigüedad.
- **La prueba del Jefe (`PRUEBAS-JEFE\prueba-ronda-36.js`) no la corrí:** la corre
  el revisor en navegador real. Sí quedó escrito
  `PRUEBAS-JEFE\DEVOLUCION-RONDA-36.md`.

## 5. Qué NO hice

- No toqué `server/` (verificado con `git diff -- server/`, vacío).
- No modifiqué la orden ni `PLAN_DESARROLLO.md` (los tocó el paso 0).
- No modifiqué los tests de la aplicación con servidor.
- No toqué la plantilla ni sus instrucciones.
- **No toqué `tests/helpers/`**: la montura del generador ya ofrecía todo lo que hizo
  falta (`elegirPac`, `escribir`, `elegirArchivo`, `limpiarDescargas`). Los únicos
  archivos de `tests/` fuera de los tests de la ronda fueron las suites viejas
  ajustadas (§1).
- No corrí la prueba del Jefe en navegador.

## 6. Riesgos que veo

- **La suite completa es larga:** el run final tardó 727 s (≈ 12 min) y entró en el
  presupuesto de la herramienta, pero conviene correrla con margen. No hubo flakes.
- **La causa de monto no distingue redondeos** de más de dos decimales (viene de la
  35): un proceso en USD con muchos presupuestos podría quedar al borde del monto.
- **El texto de los motivos es prosa generada.** Si en el futuro cambia el monto de
  un proceso del PAC (`config/pac.json`), las líneas de los motivos cambian con él;
  los tests de la ronda afirman los procesos 3, 4, 8, 22 y 32, así que un cambio de
  montos los tocaría (es lo deseable: que el test note el cambio).
- **La constante salió del paquete, no del repositorio:** no queda ningún lugar que
  imprima "VII Brigada Aérea - Moreno" en el generador (test 2a y `ronda-34-p1` 1b
  lo afirman), pero el string sigue existiendo en documentos archivados de rondas
  anteriores, como es lógico.

## 7. Medidas (métricas)

- Suite completa final: **660/660** en 727570.2264 ms (≈ 12,1 min).
- Suite completa de la pieza 1: **657/657**.
- Camino rápido de la ronda: 3/3 en 1054.5808 ms (pieza 2) y 22/22 en 2456.0034 ms
  (módulos tocados + rondas 34/35/36). Pieza 1: 12/12.
- `check-compat.js`: 6994 archivos, 0 violaciones.
- `git diff --stat`:
  - `38e9ffa` (pieza 1): 10 files changed, 688 insertions(+), 117 deletions(-),
    incluye `tests/ronda-36-p1.test.js` (nuevo).
  - `8e5a2b9` (pieza 2): 7 files changed, 232 insertions(+), 30 deletions(-),
    incluye `tests/ronda-36-p2.test.js` (nuevo).

## 8. Accesos fuera del repositorio

- Ninguno nuevo en esta ronda. La montura del generador carga los módulos reales
  por `<script>` (file://); no hay fetch, XMLHttpRequest ni servidor en la app que
  se empaqueta. La única salida de red de la suite sigue siendo el test `ronda-12`
  (Python local).
- El fixture `tests/fixtures/r33-completo.json` (de la 35) se reutiliza tal cual.
- `tools/build-config.js` regenera `app/config/aplicacion.js` y `app/config/pac.js`
  a partir de `config/`; `--verificar` controla que estén al día.

## 9. Qué se lleva el paquete — criterios de aceptación (ORDEN-RONDA-36)

- **Pieza 1.** En Identificación no hay `#sgc-pac-justificacion` (test 1a). Con el
  proceso 4 y un preventivo que lo supera, el campo aparece en Fundamentación con el
  texto que nombra el monto, "Siguiente" no pasa, deja el foco en el campo con
  `campo-con-error` y el paso 3 dice "· falta" (test 1a/1b). Con la justificación
  cargada imprime, exporta y el requerimiento dice "Justificación del PAC" (test 1b).
  Trimestre distinto (proceso 3, pidiendo el 2°) → el campo aparece y nombra los dos
  (test 1c). Año 2027 con un proceso 2026 → el campo aparece y dice 2027 y 2026
  (test 1d). Sin causas → no aparece y exporta (test 1e). Escribir, corregir el
  trimestre y volver → reaparece con lo escrito (test 1f). Tests 6/6.
- **Pieza 2.** Con el lugar de entrega "Depósito de Intendencia, Hangar 3": el
  requerimiento impreso no tiene la fila "Lugar", la EETT dice "Lugar de entrega:
  Depósito de Intendencia, Hangar 3" y en ningún documento aparece "VII Brigada
  Aérea - Moreno" (test 2a). `build-config --verificar` en verde y el paquete sin
  `lugarEntrega` (test 2b). El requerimiento de la aplicación con servidor, byte a
  byte igual que antes (test 2c). Tests 3/3.
- Suite completa en verde: **660/660**; `check-compat` 0 violaciones.
- Commits con cuerpo: `38e9ffa` (pieza 1) y `8e5a2b9` (pieza 2) — y push hecho.
- Clon en
  `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-36` desde
  GitHub.
- Paquete generado con
  `node tools/empaquetar-generador.js --ronda 36 --destino C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Prueba del Jefe `PRUEBAS-JEFE\prueba-ronda-36.js` (pendiente de que la corra el
  revisor en navegador real).

## 10. Verificación del cierre (ejecutada)

- Informe y su commit: `git add INFORME-RONDA-36.md` →
  `git commit -m "Ronda 36 · informe"` → `git push`.
- Clon para el auditor: `git clone
  https://github.com/contra3000/Contrataciones.git
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-36`
  (ruta absoluta).
- En el clon: `git log --oneline -6` coincide con `dev\`.
- Paquete: `node tools/empaquetar-generador.js --ronda 36 --destino
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Después del clon no se commitea nada. Los dos HEAD van en el mensaje final.
