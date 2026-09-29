# `tests/` — cómo se corre la suite

**Todos los comandos llevan los dos topes**: `--test-timeout=120000` y
`--test-force-exit` (ORDEN-RONDA-27 pieza 2). Ninguno de los dos es opcional, y
no son lo mismo:

| | qué corta | qué pasa si falta |
|---|---|---|
| `--test-timeout=120000` | el **test** | el test espera para siempre |
| `--test-force-exit` | la **corrida** | la corrida no termina, aunque el test ya falló |

Medido en esta máquina (Node v24.16.0, 4 CPU), quitando el tope de `python` de
`server/pliego-probador.js` y corriendo `ronda-26-c3.test.js`:

- sólo con `--test-timeout`: el test se pone rojo a los 2 min, pero **la
  corrida queda colgada** (el `python` huérfano mantiene el bucle de eventos
  vivo). Medido: seguida viva a los 300 s.
- con los dos: rojo a los **120.7 s** y la corrida termina sola.

Un test roto tiene que **fallar**, no colgar. Con los dos topes, el código de
salida es 1 si algo se cuelga (comprobado con un test que espera para siempre) y
0 si todo pasa.

## Suite completa (una sola pasada, al cerrar la ronda)

    node --test --test-timeout=120000 --test-force-exit "tests/*.test.js"

Medido: **~328 s**. El runner reparte los archivos entre procesos, pero su
default es **3 a la vez**, no 4 (en esta versión, `os.availableParallelism()` − 1).
Pedir explícito el 4 baja el muro a **~269 s**:

    node --test --test-timeout=120000 --test-force-exit --test-concurrency=4 "tests/*.test.js"

## Camino rápido (lo que se corre quince veces por ronda)

Enumerá sólo los archivos que tocaste. No hace falta correr los 60:

    node --test --test-timeout=120000 --test-force-exit tests/presupuestos-servidor.test.js tests/requerimiento-formulario.test.js tests/ronda-23-c4.test.js

Ejemplos de la ronda 26:

- Pieza 3 (transporte binario): `node --test --test-timeout=120000 --test-force-exit tests/presupuestos-servidor.test.js tests/requerimiento-servidor.test.js`
- Pieza 4 (límite 20 MB): `node --test --test-timeout=120000 --test-force-exit tests/presupuestos-servidor.test.js tests/requerimiento-formulario.test.js tests/ronda-23-c4.test.js`
- Pieza 5 (barrido): sólo documentación.
- Pieza 6 (esta medición): sólo documentación.

## Reglas

- Si agregás, borrás o renombrás un archivo, corré también
  `node tools/check-compat.js` (y `tests/check-compat.test.js`).
- Antes de commitear una pieza: el camino rápido. Antes del cierre: la suite
  entera, una sola pasada.
- **Todo test que levante un proceso lo cierra en `finally`** (ORDEN-RONDA-27
  pieza 2). El control automático es `tests/ronda-27-c2.test.js`: recorre todos
  los archivos de `tests/` y falla si encuentra uno que levante un proceso y no
  lo cierre en `finally`. Un cierre en el camino feliz no cuenta: si la
  aserción de antes falla, el proceso queda vivo y la corrida se cuelga.
  - `before`/`after` sí están bien: `after` corre aunque `before` falle.
  - `spawnSync`/`execSync` no cuentan: son sincrónicos y su hijo muere con la
    llamada.
- Las carpetas de datos son por test (`fs.mkdtempSync(os.tmpdir())`) y los servidores
  piden **puerto libre** (`--puerto 0` / `listen(0)`): dos tests pueden convivir.
