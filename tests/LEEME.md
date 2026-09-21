# `tests/` — cómo se corre la suite

## Suite completa (una sola pasada, al cerrar la ronda)

    node --test "tests/*.test.js"

Medido en esta máquina (4 CPU, Node v24.16.0): **~328 s**. El runner reparte los
archivos entre procesos, pero su default es **3 a la vez**, no 4 (en esta versión,
`os.availableParallelism()` − 1). Pedir explícito el 4 baja el muro a **~269 s**:

    node --test --test-concurrency=4 "tests/*.test.js"

## Camino rápido (lo que se corre quince veces por ronda)

Enumerá sólo los archivos que tocaste. No hace falta correr los 56:

    node --test tests/presupuestos-servidor.test.js tests/requerimiento-formulario.test.js tests/ronda-23-c4.test.js

Ejemplos de esta ronda:

- Pieza 3 (transporte binario): `node --test tests/presupuestos-servidor.test.js tests/requerimiento-servidor.test.js`
- Pieza 4 (límite 20 MB): `node --test tests/presupuestos-servidor.test.js tests/requerimiento-formulario.test.js tests/ronda-23-c4.test.js`
- Pieza 5 (barrido): sólo documentación.
- Pieza 6 (esta medición): sólo documentación.

## Reglas

- Si agregás, borrás o renombrás un archivo, corré también
  `node tools/check-compat.js` (y `tests/check-compat.test.js`).
- Antes de commitear una pieza: el camino rápido. Antes del cierre: la suite entera,
  una sola pasada.
- Las carpetas de datos son por test (`fs.mkdtempSync(os.tmpdir())`) y los servidores
  piden **puerto libre** (`--puerto 0` / `listen(0)`): dos tests pueden convivir.
