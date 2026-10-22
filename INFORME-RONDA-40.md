# INFORME-RONDA-40.md
Ronda 40 - La suite que da siempre lo mismo, y "Buscar ítem" en todo el catálogo
SGC - 2026-10-22

## 1. Qué hice

Cerré la ronda 40 siguiendo `ordenes/ORDEN-RONDA-40.md` (hito H27). Fueron dos
piezas, cada una con su suite completa en verde, su commit con cuerpo y su push.

- **Paso 0 (publicación).** Las órdenes y el plan estaban sin publicar en `dev\`.
  Se subieron en `e03869b`, **Revisor: ordenes y plan al dia**, con
  `ordenes/ORDEN-RONDA-40.md`, `ordenes/ORDEN-RONDA-40-AUDITORIA.md` y
  `PLAN_DESARROLLO.md`. Ese commit no lleva nada de `app\` ni de `tests\`.
- **Pieza 1 (la suite estable).** Nuevo `tools/suite.js`: corre en serie los
  tests que levantan un servidor o la montura de la aplicación y en paralelo el
  resto; imprime una sola línea de totales y sale con código distinto de 0 si
  algo falla. La elección no es una lista a mano: se deduce del grafo de
  `require` de cada archivo. Nuevo `tests/suite-herramienta.test.js` con cuatro
  tests de esa elección. Commit `8fb2210`, **Ronda 40 · la suite corre los tests
  de servidor en serie**.
- **Pieza 2 (Buscar ítem).** `tools/build-catalogo.js` escribe
  `app/catalogo/busqueda.js` con los 159.366 ítems `[codigo,item]`, sólo como
  `.js` y de forma determinista. `catalogo/carga.js` suma `cargarBusqueda()` con
  `unaSolaVez` y `peticion`, que se pide la primera vez que se escribe en
  "Buscar ítem". Nuevo `app/js/generador/busqueda-items.js` con la búsqueda por
  comienzo de palabra, sin mayúsculas ni acentos, con singular/plural,
  abreviaturas del catálogo y el ranking de la orden. `app/generador.html` suma
  el campo y la lista; `app/js/catalogo/buscador.js` los atiende y
  `app/js/generador.js` pasa la opción de cerrar la lista de clases sólo en el
  generador. Commit `3cbcdd0`, **Ronda 40 · buscar ítem en todo el catálogo**.

### Tests viejos que cambiaron, uno por uno

`git diff --stat 8fb2210..3cbcdd0 -- tests/`:

```
 tests/ronda-28-c5.test.js |   4 +-
 tests/ronda-33-p2.test.js |  17 +--
 tests/ronda-39-p2.test.js |   8 +-
 tests/ronda-40-p2.test.js | 332 ++++++++++++++++++++++++++++++++++++++++++++++
 4 files changed, 345 insertions(+), 16 deletions(-)
```

Tres tests viejos, todos de asunto, ninguno reescrito:

1. **`tests/ronda-33-p2.test.js`**, test 2 ("Buscar llena el buscador..."): antes
   "Buscar" ponía el texto en `#sgc-campo-clases` y el test elegía una clase y su
   primer ítem. Ahora, en el generador, "Buscar" lo pone en `#sgc-buscar-item`
   (orden 40 pieza 2e), así que el test espera `#sgc-opcion-buscar-item-0` y lee
   `buscarItem[0]` en vez de `itemsFiltrados[0]`. La aserción de fondo no cambió:
   el ítem elegido reemplaza al renglón "por buscar", conserva cantidad y
   aclaración y no agrega otro.
2. **`tests/ronda-39-p2.test.js`**, test 2b ("un código inexistente conserva el
   buscar..."): la misma corrección de asunto. Ahora comprueba que "Buscar"
   escribe `matafuego` en `#sgc-buscar-item` en vez de `#sgc-campo-clases`.
3. **`tests/ronda-28-c5.test.js`** ("el catálogo del paquete está completo..."):
   el test exigía que hubiera tantos `.js` de catálogo como `.json` en el repo.
   Con `busqueda.js` hay un `.js` más y ningún `.json` nuevo, así que la cuenta
   pasa a ser `.json + 1`. El resto de las aserciones del paquete no se tocaron.

El archivo nuevo es `tests/ronda-40-p2.test.js` (7 tests), descrito en §3.

## 2. Decisiones que tomé y por qué

- **La suite se elige por lo que el archivo usa, no por una lista.** El test de
  la herramienta inventa un archivo que requiere la montura y comprueba que cae
  en serie; también comprueba que uno que sólo usa `generador-montura.js` cae en
  paralelo y que serie + paralelo no pierden ningún `tests/*.test.js`. Así un
  test de servidor nuevo no necesita que nadie lo anote.
- **`--test-force-exit` sigue en la suite.** La orden pide
  `--test-timeout=120000`; `tests/LEEME.md` ya exigía además
  `--test-force-exit` para que el proceso no quede colgado con servidores de
  prueba. Se mantuvo, y el conteo coincide con el comando viejo (693 tests en la
  pieza 1).
- **El índice de búsqueda es sólo `.js`.** La aplicación con servidor no lo usa;
  sobre `file://` el generador lo carga con `<script>` por la rama que ya tenía
  `carga.js`. No se agregó `.json` ni se tocó `server/`.
- **La búsqueda tiene su propio índice en memoria.** El módulo nuevo normaliza y
  prepara los ítems al montar y arma un índice por prefijo de tres letras y por
  abreviaturas. La verificación final sigue siendo la regla completa
  (comienzo de palabra, plural, abreviaturas), pero sólo recorre los candidatos
  que el índice devuelve. Con eso las tres búsquedas de la tabla quedaron en
  93-136 ms en esta máquina, dentro de los 100-300 ms que midió el revisor.
- **El cierre de la lista de clases es una opción de `montar()`.** El generador
  la pasa desde `generador.js:583`; la aplicación con servidor no la pasa y
  conserva el comportamiento de siempre. Sus tests no se tocaron.
- **El test de la pieza 2 usa el catálogo completo y el fixture.** Los casos de
  búsqueda y de pantalla usan el catálogo real; el build determinista corre dos
  veces sobre `datos-prueba/catalogo_incisos.json` y se saltea con aviso si ese
  archivo no está en el clon, igual que el test de build que ya existía.

## 3. Verificación

### 3.1 Pieza 1 - cinco corridas completas

Comando nuevo, desde este commit la suite completa:

```
node tools/suite.js
```

| corrida | tests | pass | fail | cancelled | skipped | duration_ms | log |
|---|---|---|---|---|---|---|---|
| pieza 1 - 1 | 693 | 693 | 0 | 0 | 0 | 1476523 | `%TEMP%\sgc-suite-r40-1.log` |
| pieza 1 - 2 | 693 | 693 | 0 | 0 | 0 | 1449612 | `%TEMP%\sgc-suite-r40-2.log` |
| pieza 1 - 3 | 693 | 693 | 0 | 0 | 0 | 1543352 | `%TEMP%\sgc-suite-r40-3.log` |
| pieza 1 - 4 | 693 | 693 | 0 | 0 | 0 | 1825375 | `%TEMP%\sgc-suite-r40-4.log` |
| pieza 1 - 5 | 693 | 693 | 0 | 0 | 0 | 2121373 | `%TEMP%\sgc-suite-r40-5.log` |

Las cinco líneas de totales, copiadas del log:

```
tests 693 / pass 693 / fail 0 / cancelled 0 / skipped 0 / duration_ms 1476523
tests 693 / pass 693 / fail 0 / cancelled 0 / skipped 0 / duration_ms 1449612
tests 693 / pass 693 / fail 0 / cancelled 0 / skipped 0 / duration_ms 1543352
tests 693 / pass 693 / fail 0 / cancelled 0 / skipped 0 / duration_ms 1825375
tests 693 / pass 693 / fail 0 / cancelled 0 / skipped 0 / duration_ms 2121373
```

Comando viejo, para comparar la cantidad de tests:

```
node --test --test-timeout=120000 --test-force-exit "tests/*.test.js"
```

```
tests 693
pass 693
fail 0
cancelled 0
skipped 0
duration_ms 681197.0905
```

Log: `%TEMP%\sgc-suite-vieja-r40.log`.

### 3.2 Pieza 2 - corridas dirigidas y suite completa

| corrida | tests | pass | fail | duration_ms | observación |
|---|---|---|---|---|---|
| `ronda-40-p2` completa, primera | 7 | 6 | 1 | 210240.3713 | falló 2f por armado del test (faltaban unidad y valores) |
| `ronda-40-p2` test 2f solo | 1 | 1 | 0 | 3900.4136 | corregido el armado |
| `ronda-40-p2` 2a a 2f | 6 | 6 | 0 | 6161.8367 | sin el build completo |
| `ronda-40-p2` completa | 7 | 7 | 0 | 166952.7964 | incluye el build completo dos veces |
| suite pieza 2 - 1 | 700 | 699 | 1 | 1804459 | rojo en `ronda-28-c5` por la cuenta de `.js` |
| `ronda-28-c5` dirigida | 8 | 8 | 0 | 78523.2862 | corregida la cuenta |
| **suite pieza 2 - 2** | **700** | **700** | **0** | **1586711** | **verde, exit 0** |

La línea final de la suite verde, copiada de
`%TEMP%\sgc-suite-r40-p2b.log`:

```
tests 700 / pass 700 / fail 0 / cancelled 0 / skipped 0 / duration_ms 1586711
```

La suite clasifica **46 archivos en serie** y **59 en paralelo** (105 archivos,
700 tests). Los seis de la tabla de la orden quedaron en serie:

```
presupuestos-servidor.test.js
ronda-20.test.js
ronda-21-c6.test.js
ronda-25-c3.test.js
transiciones-servidor-matriz-2.test.js
transiciones-servidor-matriz.test.js
```

Controles:

- `node tools/check-compat.js` -> **OK - 6996 archivo(s) inspeccionado(s), 0
  violaciones**.
- `node tools/build-config.js --verificar` -> **OK - 2 archivo(s) al día**.
- `git diff -- app/js/core server/` -> **vacío**.
- `git diff --stat -- app/js/core server | Measure-Object -Line` -> **0 líneas**.
- No se modificó ningún test de la aplicación con servidor.

Los 7 tests de la pieza 2, en la corrida completa:

```
RONDA-40 pieza 2a - las tres búsquedas de la tabla traen lo que la orden pide
RONDA-40 pieza 2b - el mouse suma un solo renglón, cierra la lista y no duplica
RONDA-40 pieza 2c - con flechas y Enter se elige y la lista se cierra
RONDA-40 pieza 2d - elegir clase y ítem con triple clic deja un renglón y cierra la lista de ítems
RONDA-40 pieza 2e - "Buscar" llena "Buscar ítem" y el ítem elegido reemplaza al renglón
RONDA-40 pieza 2f - el requerimiento con el ítem elegido exporta y el JSON trae ese código
RONDA-40 pieza 2g - dos builds del catálogo completo dan busqueda.js igual, con 159.366 ítems
```

## 4. Contradicciones e información faltante

- **Las cinco corridas de la pieza 1 superaron los 20 minutos.** La orden pide
  decirlo si pasa. Todas pasaron: 24,6, 24,2, 25,7, 30,4 y 35,4 minutos. La
  corrida más lenta fue la quinta (`2121373` ms). La causa es la tanda en serie
  (los tests de servidor y de montura suman ~24 minutos) más la paralela; no
  hubo fallos ni cancelados en ninguna. La suite final de la pieza 2 tardó
  `1586711` ms (~26,4 min), también por la tanda en serie.
- **El primer intento de la suite de la pieza 2 dio 699/700.** El único rojo fue
  `tests/ronda-28-c5.test.js`, que contaba los `.js` del catálogo y esperaba
  tantos como `.json`; con `busqueda.js` hay uno más. Se corrigió la cuenta
  (`.json + 1`) y se repitió la suite completa: 700/700. Es el tercer test viejo
  de asunto de §1.
- **El primer test 2f falló por el armado del test, no por el código.** Al
  agregar el ítem, el renglón nuevo quedaba sin unidad y sin valores de
  referencia, así que "Siguiente" no pasaba. Se completaron unidad y dos valores
  con los presupuestos que trae el fixture; el test 2f pasó solo y después en la
  corrida completa.
- **El comando viejo se corrió con `--test-force-exit`.** La orden sólo nombra
  `--test-timeout=120000`; `tests/LEEME.md` ya pedía el force-exit para no dejar
  procesos de servidor colgados. Con esa variante dio los mismos 693 tests que
  la suite nueva.
- **La búsqueda se midió después de agregar el índice.** La primera
  implementación recorría los 159.366 ítems palabra por palabra y tardaba
  350-500 ms; no cumplía los 100-300 ms que midió el revisor. El índice por
  prefijo de tres letras y por abreviaturas la dejó en 93-136 ms para las tres
  búsquedas de la tabla. El montaje del índice tarda ~2,7 s y ocurre una sola vez,
  mientras el conteo dice "Cargando los ítems del catálogo.".
- **`app/catalogo/busqueda.js` no está en el clon si falta el catálogo completo.**
  Es un archivo generado y versionado, de 20.006.764 bytes (159.366 entradas).
  El test 2g lo compara con dos builds del catálogo completo y se saltea con
  aviso si `datos-prueba/catalogo_incisos.json` no está, igual que el test de
  build que ya existía. El auditor tiene que copiar ese archivo para correrlo.
- **No hay un test de tiempo.** La orden no lo pide en la lista de tests; la
  medición de 93-136 ms se hizo con el catálogo real en Node y quedó en §7. Un
  test de tiempo sería flaky en la suite paralela.

## 5. Qué NO hice

- No toqué `server/`, `app/js/core/` ni las vistas del servidor. Verificado con
  `git diff -- app/js/core server/` vacío.
- No modifiqué tests de la aplicación con servidor.
- No cambié la aplicación con servidor: sigue llamando a `buscador.montar()` con
  un solo argumento, y la opción de cierre sólo la pasa el generador.
- No edité las órdenes publicadas ni rehíce piezas de cero.
- No agregué un `.json` de búsqueda: el índice es sólo `.js`.
- No corrí la prueba del Jefe en navegador real (no hay Playwright/Chromium en
  este entorno; es lo mismo que las rondas 30 a 39).

## 6. Riesgos que veo

- **El índice en memoria pesa.** Además de los 20 MB del archivo, el módulo arma
  mapas de prefijos y abreviaturas al montar. En Node no hubo problema y el
  montaje tarda ~2,7 s, pero en una máquina muy justa de memoria el primer
  tecleo puede notarse. El conteo de carga lo dice mientras tanto.
- **Las palabras de menos de tres letras caen al recorrido completo.** El índice
  por prefijo de tres letras no puede usarse con términos de una o dos letras;
  en ese caso el módulo recorre todos los ítems, que es correcto pero más lento.
  Las palabras de unión de una letra ya se descartan como stopwords.
- **La suite completa sigue siendo larga.** La tanda en serie ronda los 24
  minutos y la completa los 26-35. Es el precio de que los tests de servidor no
  compitan; la orden lo acepta y pide declararlo.
- **El paquete crece ~20 MB.** `empaquetar-generador.js` ya copia todo
  `catalogo/*.js`; el test del paquete (`ronda-28-c5`) verifica que el catálogo
  llegue completo y que `busqueda.js` cuente como un `.js` más.
- **La prueba del Jefe queda pendiente.** El revisor corre
  `PRUEBAS-JEFE\prueba-ronda-40.js` y las de las rondas 30 a 39 antes de la
  devolución; acá no hay navegador real.

## 7. Medidas (métricas)

- Suite completa final de la pieza 2: **700/700** en `1586711` ms (~26,4 min),
  exit 0.
- Suite completa de la pieza 1: cinco corridas 693/693, `1476523`, `1449612`,
  `1543352`, `1825375` y `2121373` ms.
- Comando viejo: 693/693 en `681197.0905` ms.
- Dirigidos de la pieza 2: 7/7 en `166952.7964` ms; 2a-2f en `6161.8367` ms.
- `busqueda.js`: 159.366 entradas, **20.006.764 bytes** (19,1 MiB). Dos builds
  dieron el mismo SHA-256:
  `92D12D0326A05E115FB8046F3262F88041BBA65C1D1E2669AF0741394546513B`.
- Montaje del índice: ~2,7 s. Búsquedas en caliente con el catálogo real:
  - `mantenimiento recarga matafuego`: 111-136 ms;
  - `reparacion matafuegos`: 93-107 ms;
  - `válvula esférica`: 28-43 ms;
  - `matafuego`: 45-50 ms;
  - `papel`: 5-12 ms; `resma`: 12-15 ms.
- `check-compat.js`: 6996 archivos, 0 violaciones.
- `build-config.js --verificar`: 2 archivos al día.
- `git show --stat`:
  - `e03869b` (publicación del revisor): 3 files changed.
  - `8fb2210` (pieza 1): 2 files changed, 4 tests nuevos.
  - `3cbcdd0` (pieza 2): 11 files changed, 872 insertions(+), 22 deletions(-).

## 8. Accesos fuera del repositorio

- Ninguno nuevo de red. La montura del generador carga los módulos reales por
  `<script>` (file://); la app empaquetada no hace fetch ni usa servidor.
- `datos-prueba/catalogo_incisos.json`: catálogo completo usado por los tests de
  build; no está versionado. El test 2g se saltea con aviso si falta.
- Temporales de trabajo en `%TEMP%\opencode\` (wrapper de la suite) y
  `%TEMP%\sgc-suite-r40-*.log`, `%TEMP%\sgc-suite-vieja-r40.log`.
- Clon del auditor y paquete, fuera de `dev\`, en las rutas de §10.

## 9. Qué se lleva el paquete - criterios de aceptación (ORDEN-RONDA-40)

- **Pieza 1 (suite estable).** `node tools/suite.js` corre en serie los tests de
  servidor y de montura y en paralelo el resto; los seis archivos de la tabla
  están en serie; no se pierde ningún archivo; imprime una sola línea de totales
  y sale con código distinto de 0 si algo falla. Cinco corridas 693/693, 0 fail y
  0 cancelled. `tests/suite-herramienta.test.js` prueba la elección.
- **Pieza 2a (el índice).** `build-catalogo` escribe `app/catalogo/busqueda.js`
  con 159.366 ítems, sólo `.js`, determinista; dos corridas dan el mismo archivo
  byte a byte y el versionado coincide con el build (2g).
- **Pieza 2b (el campo).** "Buscar ítem" está arriba de "2 · Renglones", con la
  lista `#sgc-lista-buscar-item`, opciones con código, texto resaltado y clase, y
  el conteo "N coincidencias" con el aviso de las primeras 60 cuando supera 60
  (2a y 2b).
- **Pieza 2c (cómo busca).** Las tres búsquedas de la tabla traen lo que la
  orden pide; sin mayúsculas, acentos ni palabras de unión; al comienzo de
  palabra; singular/plural; abreviaturas; sin exigir todas las palabras y con el
  ranking pedido (2a).
- **Pieza 2d (elegir).** Un clic suma un renglón, cierra la lista y otro clic no
  duplica; con unidad y cantidad no hay error; flechas y Enter eligen y cierran;
  el código queda registrado para que no salga "El código no existe" (2b, 2c).
- **Pieza 2e (Buscar del renglón).** "Buscar" pone las palabras en
  `#sgc-buscar-item` y el ítem elegido reemplaza al renglón conservando cantidad,
  unidad y aclaración (2e).
- **Pieza 2f (la clase).** Elegir clase y su ítem con triple clic suma un solo
  renglón y cierra `#sgc-lista-items`, sólo en el generador (2d).
- **Pieza 2g (exportar).** Un requerimiento con el ítem elegido en "Buscar ítem"
  exporta y el JSON trae `3.3.3-1627.36` (2f).
- Suite completa en verde: **700/700**; `check-compat` 0 violaciones.
- Commit de la pieza 2 con cuerpo: `3cbcdd0` - y push hecho.
- Clon en `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-40`
  desde GitHub.
- Paquete generado con `node tools/empaquetar-generador.js --ronda 40 --destino
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Prueba del Jefe `PRUEBAS-JEFE\prueba-ronda-40.js`: la corre el revisor en
  navegador real; en este entorno no hay Chromium.

## 10. Verificación del cierre (ejecutada)

- Publicación del revisor: `e03869b`, **Revisor: ordenes y plan al dia**.
- Pieza 1: commit `8fb2210`, **Ronda 40 · la suite corre los tests de servidor en
  serie**, con su test nuevo y su cuerpo; push hecho.
- Pieza 2: commit `3cbcdd0`, **Ronda 40 · buscar ítem en todo el catálogo**, con
  sus tests y su cuerpo; push hecho (`8fb2210..3cbcdd0  main -> main`).
- Informe y su commit: `git add INFORME-RONDA-40.md` -> `git commit -m "Ronda 40 ·
  informe"` -> `git push`.
- `git status --short` en `dev\`: **vacío**.
- Clon para el auditor desde GitHub, ruta absoluta:
  `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-40`.
- Paquete: `node tools/empaquetar-generador.js --ronda 40 --destino
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Después del clon no se commitea nada. Los dos HEAD van en el mensaje final.
