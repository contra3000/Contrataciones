# INFORME-RONDA-32.md
Ronda 32 — Lo que pide la prueba piloto
SGC — 2026-10-08

## 1. Qué hice

Se completaron las dos piezas de ORDEN-RONDA-32.md, más el paso 0 que dejó el
revisor listo para entrar.

- **Paso 0 (commit 047266f, del revisor).** `ordenes/` con la orden, la
  acotación de auditoría y el parche h1, y `PLAN_DESARROLLO.md`.

- **Pieza 1: el arreglo h1 y la versión en el paquete (commit 7cb00b7).**
  - El parche h1 se aplicó **tal cual**, con `git apply`. Toca dos cosas:
    - `app/css/tokens.css`: `--color-error: #b3261e` — el rojo que pedía el
      Jefe. Venía en `var(--ink-900)`, casi negro, y el campo con error no se
      distinguía del resto.
    - `app/js/generador/intercambio.js`: la plantilla baja con `item: ''`,
      para que la descripción del ítem la ponga el catálogo ONC y no lo que
      diga el archivo. Era el vicio de la ronda 28: `fasttrack.js` ponía el
      código como relleno, `resolverItems` lo tomaba como «la descripción del
      archivo» y esa ganaba.
  - `app/js/generador.js`: la marca del paso pendiente pasa de `· falta` a
    ` · falta` (con espacio), y el paso lee **"2 · Renglones · falta"** en
    lugar de quedarse pegada.
  - `tools/empaquetar-generador.js`: el paquete ahora dice de qué salió —
    escribe `config/aplicacion.js` del destino con la versión
    **`r<NN>-<commit>`** (la misma que mira `sello.versionGenerador`), deja un
    `VERSION.txt` (ronda, commit, fecha, versión del catálogo), y su
    `LEEME.txt` es el de la prueba piloto con la versión. El `--ronda` entra
    por argumento o se deduce del último `INFORME-RONDA-NN.md`.
  - Tests: `tests/ronda-32-p1.test.js` (3, por la pantalla), `ronda-31-p2`
    actualizada (la marca ahora se afirma con su espacio) y `ronda-28-c5`
    ampliada (8, el paquete y su versión).

- **Pieza 2: una plantilla que sirva para llenarla con un asistente de IA
  (commit ed499fa).**
  - `fasttrack.js` `modelo()`: la plantilla baja con **"instrucciones"**, el
    texto que se le pasa al asistente junto con el JSON —devolverlo tal cual,
    con la misma forma; no inventar códigos de catálogo; no escribir la
    descripción del ítem (la pone el catálogo ONC); aclaración que no repita
    ni nombre marcas, hasta 256 caracteres; cantidad como número y unidad
    corta—, y **dos renglones**: uno modelo de papelería con un **código real
    del catálogo vigente** (98201747: `2.3.1-6563.129`, papel A4 80 gr en
    resma) y uno con el **código vacío**, que muestra cómo se deja el código
    que no se sabe. El renglón anterior —`2.9.6-1115.1`, un termostato— se
    reemplazó por el caso común de un requerimiento de insumos.
  - `fasttrack.js` `importar()`: ignora `instrucciones` a propósito (es texto
    para el asistente, no parte del requerimiento). El test lo prueba
    importando la misma plantilla con y sin el campo.
  - `ronda-28-c4` y `ronda-32-p1` ajustadas: un código vacío no entra —dice
    "Renglón N: falta el código del catálogo" y no carga nada—; «la bajé y la
    volví a subir» completa el código del renglón 2 con uno real primero, como
    la orden pide que haga la persona (o el asistente).
  - Tests: `tests/ronda-32-p2.test.js` (4, por la pantalla).

## 2. Decisiones que tomé y por qué

- **El renglón modelo es papelería, y con un código real del catálogo
  vigente.** La orden pedía «un renglón modelo creíble». El código
  `2.3.1-6563.129` existe en el catálogo de la versión 98201747 —PAPELES EN
  HOJA, A4, 80 gr/m, resma— y es el caso común de un pedido de insumos; el
  termostato de la plantilla vieja (2.9.6-1115.1) servía para probar, no para
  mostrar.
- **La versión del paquete vive en `config/aplicacion.js` del destino**, no en
  un archivo aparte: es el lugar que ya lee `sello.versionGenerador()`, así
  cada JSON exportado desde el paquete dice de qué paquete salió.
  `VERSION.txt` es la versión para leer sin abrir la app. `r<NN>-<commit>`: si
  después del empaquetado se corrige algo con un commit nuevo, el hash corto
  cambia y el paquete distingue esa corrección.
- **El doble conteo de bytes en el informe del paquete.** La primera corrida de
  `ronda-28-c5` dio `informe.bytes` de más exactamente el tamaño del config:
  el bucle de copiado ya había contado `config/aplicacion.js`, y la
  reescritura de la versión volvía a sumarlo. Se corrige restando el tamaño
  viejo y sumando el nuevo (el delta), no el archivo dos veces.
- **El rojo y el «· falta» con espacio van juntos**: son los dos detalles
  visuales que el Jefe pidió ver, y la prueba del Jefe los revisa en el
  navegador (getComputedStyle y el texto del paso).
- **Se mantuvo `node tools/check-compat.js` como gate**: nada de `innerHTML`
  con datos, `import`/`export`, o APIs fuera del Chrome de referencia. No
  tiene regla sobre colores; el cambio a `#b3261e` no genera violaciones.

## 3. Verificación

Corridas completas de la suite (`node --test --test-timeout=120000
--test-force-exit "tests/*.test.js"`), todas documentadas, no sólo la mejor:

| corrida | tests | pass | fail | duration_ms | nota |
|---|---|---|---|---|---|
| 1 · tras el commit de pieza 1 | 616 | 616 | 0 | 648438 | gate de pieza 1 (recuento capturado en pantalla) |
| 2 · tras el commit de pieza 2 | 620 | 619 | 1 | 616501 | cruce declarado abajo; se ajusta y pasa |
| 3 · tras ajustar ronda-32-p1 | 620 | 620 | 0 | 669769 | suite32-b.txt |
| 4 | 620 | 620 | 0 | 547493 | suite32-run2.txt |
| 5 | 620 | 620 | 0 | 544933 | suite32-run3.txt — ésta va completa al final |

- La única falla de la corrida 2 (y pasa en aislamiento): `ronda-32-p1` pieza
  1a volvía a subir la plantilla **sin tocarla**, y la plantilla de la pieza 2
  trae un renglón con el código vacío que, por diseño, no entra. Se completó
  ese código con uno real antes de volver a subir — el mismo ajuste que se le
  hizo a `ronda-28-c4` — y la pieza 1a sigue probando lo que probaba.
- Tests dirigidos de las piezas:
  - Pieza 1: `tests/ronda-32-p1.test.js` → 3/3 (1a · la descripción la pone el
    catálogo aunque el archivo diga otra cosa; 1a-h1 · el error es `#b3261e` y
    `campo-con-error` lo usa en el borde; 1b · el paso lee "Renglones · falta"
    con espacio). `tests/ronda-28-c5.test.js` → 8/8 (el paquete con su
    versión `r32-…`, VERSION.txt y el LEEME del piloto).
  - Pieza 2: `tests/ronda-32-p2.test.js` → 4/4 (la plantilla baja con
    instrucciones y dos renglones; con el código completado entra sin errores;
    con el segundo vacío sale el mensaje del renglón 2 y no carga nada;
    importar() ignora "instrucciones").
  - Afectadas por las piezas: `ronda-31-p2` 5/5, `ronda-28-c4` en verde.
- `node tools/check-compat.js`: 6993 archivos, 0 violaciones.
- `git diff --check`: limpio (solo warnings de CRLF preexistentes).

Salida completa de las corridas: `%TEMP%\opencode\suite32-b.txt`,
`suite32-run2.txt`, `suite32-run3.txt` (las tres verdes) y `suite32-full.txt`
(la corrida 2, con la falla documentada).

## 4. Contradicciones e información faltante

- Ninguna de peso. La línea «Pero dejá de lado la del archivo y la orden» de la
  sección del LEEME (pieza 1d) se leyó al final con su sección completa y no
  queda ambigüedad: el LEEME del piloto lo escribe `empaquetar`, y el
  `LEEME-PILOTO.txt` que quedó en `SGC-Generador` de la prueba anterior deja de
  hacer falta.
- El único conflicto real fue el cruce entre piezas ya declarado (la plantilla
  de la pieza 2 con el renglón vacío vs. los tests que la volvían a subir tal
  cual): la orden misma preveía ajustar «pruebas de piezas anteriores».

## 5. Qué NO hice

- No modifiqué `server/` ni la orden ni `PLAN_DESARROLLO.md`.
- No toqué el parche h1: se aplicó con `git apply` tal como lo dejó el
  revisor, y no se le editó ninguna línea.
- No cambié la regla de validación de los renglones (un código vacío ya se
  rechazaba en `fasttrack.js`; la pieza 1b/1c sólo cambian qué tan pegada se
  ve la marca).
- No corrí la prueba del Jefe (`PRUEBAS-JEFE\prueba-ronda-32.js`): la corre el
  revisor en navegador real. Los checks 1, 1b, 2, 3, 4b y 5 quedan cubiertos
  por los tests por la pantalla; el 4 (getComputedStyle en rgba) y el 6/7 los
  hace el revisor.
- No dejé `LEEME-PILOTO.txt` aparte en el paquete: el LEEME del piloto lo
  escribe `empaquetar-generador.js` en el destino.

## 6. Riesgos que veo

- El check 4 de la prueba del Jefe (rojo real en `getComputedStyle`) depende
  del navegador; el test 1a-h1 verifica el valor en `tokens.css` y su uso en
  `campo-con-error`, y el paquete lleva ese CSS.
- La versión `r32-<commit>` que devuelve `versionGenerador` es la de
  `config/aplicacion.js` dentro del paquete: si alguien edita a mano el
  SGC-Generador, el sello de futuros JSON puede no corresponder al paquete
  empaquetado. `VERSION.txt` y el commit en el nombre ayudan a detectarlo.
- Bajo carga, la suite puede volver a cortarse en `ronda-12` (spawn de Python)
  o en un test de servidor, como en rondas anteriores: pasa en aislamiento y
  las corridas 3/4/5 están 620/620 en verde.

## 7. Mediciones

- Suite completa: 620 tests, ~9–11,5 min por corrida (las verdes: 544–670 s).
- check-compat.js: ~3 s, 6993 archivos, 0 violaciones.
- Tests Pieza 1 (dirigidos): ronda-32-p1 3 (~1–2 s) y ronda-28-c5 8 (~55 s).
- Tests Pieza 2 (dirigidos): ronda-32-p2 4 (~1 s).
- `git diff --stat`:
  - 047266f (del revisor): 4 files changed, 212 insertions(+), 2 deletions(-).
  - 7cb00b7: 7 files changed, 402 insertions(+), 32 deletions(-).
  - ed499fa: 4 files changed, 202 insertions(+), 4 deletions(-).

## 8. Accesos fuera del repositorio

- Ninguno. La montura del generador carga los módulos reales por `<script>`
  (file://), y el catálogo se sirve como archivos .js estáticos generados por
  tools/build-catalogo.js. La única excepción de red de la suite es el test
  ronda-12, que llama a Python local con PyYAML en la máquina de pruebas. No
  hay fetch, XMLHttpRequest ni servidor en la app que se empaqueta.

## 9. Qué se lleva el paquete — criterios de aceptación (ORDEN-RONDA-32)

- Pieza 1: el error se ve en rojo (`--color-error: #b3261e`, parche aplicado
  tal cual); la marca de paso pendiente lee «2 · Renglones · falta» con
  espacio; el paquete dice su versión (config con `r32-…`, `VERSION.txt`,
  `LEEME.txt` del piloto, informe con la versión). Tests 3/3 y 8/8.
- Pieza 2: la plantilla baja con "instrucciones" (lo que le dice al asistente)
  y dos renglones —papelería real `2.3.1-6563.129` y uno con el código
  vacío—; importar() ignora "instrucciones"; con el segundo vacío sale
  "Renglón 2: falta el código del catálogo" y no se carga nada. Tests 4/4.
- Suite completa en verde: 620/620 en las corridas 3, 4 y 5. check-compat 0
  violaciones.
- Tres commits con cuerpo (paso 0 del revisor, pieza 1, pieza 2), push hecho.
- Clon en
  `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-32`
  desde GitHub.
- Paquete generado con `node tools/empaquetar-generador.js --ronda 32
  --destino C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Prueba del Jefe `PRUEBAS-JEFE\prueba-ronda-32.js` (pendiente de que la corra
  el revisor en navegador real).

---

### Salida completa de la corrida 5 (última, tras el commit ed499fa)

```
node --test --test-timeout=120000 --test-force-exit "tests/*.test.js"
```
```
✔ RONDA-32 pieza 1a · la plantilla importada deja la descripción del ítem al catálogo (1103.7844ms)
✔ RONDA-32 pieza 1a h1 · el error se ve en rojo (--color-error #b3261e) (5.6854ms)
✔ RONDA-32 pieza 1b · el paso pendiente dice "· falta" con espacio (366.5649ms)
✔ RONDA-32 pieza 2 · la plantilla baja con "instrucciones" y dos renglones (419.8632ms)
✔ RONDA-32 pieza 2 · con el código del segundo completado, entra sin errores (939.0614ms)
✔ RONDA-32 pieza 2 · con el segundo vacío, sale el mensaje del renglón 2 y no se carga nada (350.6799ms)
✔ RONDA-32 pieza 2 · importar() ignora "instrucciones" explícitamente (211.1991ms)
… (resto de los 620 tests) …
✔ alta completa: datos.json, entrada en idx/, número único, auditoría con el correo (5627.9125ms)
ℹ tests 620
ℹ suites 0
ℹ pass 620
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

## 10. Verificación del cierre (ejecutada)

- Informe y su commit: `git add INFORME-RONDA-32.md` → `git commit -m "Ronda 32 · informe"` → `git push`.
- Clon para el auditor: `git clone https://github.com/contra3000/Contrataciones.git C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-32` (ruta absoluta).
- En el clon: `git log --oneline -5` coincide con `dev\`.
- Paquete: `node tools/empaquetar-generador.js --ronda 32 --destino C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Después del clon no se commitea nada. Los dos HEAD van en el mensaje final.