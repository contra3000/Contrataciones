# INFORME — RONDA 3

## 1. Qué hice

- **Corrección §2.1 — URLs absolutas se reportan siempre.** Ajusté `tools/check-compat.js`: la comprobación de URLs vuelve a correr sobre `conCadenas` (texto con los literales de cadena conservados), de modo que `fetch('https://...')`, `href="https://..."` o `url("https://...")` se reportan como violación. Sólo las URLs dentro de comentarios quedan exceptuadas. Actualicé la suite adversaria (`tests/check-compat.test.js`): 5 casos que eran negativos (URL en string JS, template string, URL CSS entre comillas, URL en atributo HTML, URL en `fetch`) pasaron a positivos; siguen siendo negativos los de URL en comentario (`// ver https://...` y `/* fuente: https://... */`). Los temporales se crean y eliminan dentro de la suite, en `os.tmpdir()`.
- **Corrección §2.2 — Cobertura del guardián.** Verifiqué con casos en la suite que detecta `<script type="module">` (HTML), el anidamiento CSS con `&` y el flag `v` en expresiones regulares. Ya estaban cubiertos; no hizo falta ningún cambio de código.
- **Corrección §2.3 — Temporales de test.** Todos los temporales de la ronda 3 viven en `os.tmpdir()`. Verificado al final: ningún `.tmp`, `.lock` ni carpeta de prueba quedó dentro del repositorio.
- **§2.4 — Contrato congelado.** La forma del expediente nuevo cumple el contrato: `estadoActual` es una **cadena** y el registro de auditoría es el arreglo **`auditLog`**. La garantía se sostiene con un constructor único compartido (ver §2).
- **`app/js/adapters/repo.js`** — el contrato de persistencia de ADR-002 y el selector: `usar(implementacion)` inyecta la implementación activa; los 7 métodos delegan en ella; sin implementación, toda llamada falla con un mensaje claro en español. Un conflicto de versión **no es una excepción**: se devuelve `{ok:false, conflicto:true, versionRemota}`. Incluye los helpers compartidos que el servidor y `repo.memoria` usan para que el expediente inicial y el formato del índice sean idénticos en ambas caras (`construirExpediente`, `anioDe`, `rellenar`, `entradaIndice`).
- **`app/js/adapters/repo.memoria.js`** — implementación completa en memoria para tests y fixtures. Reproduce la semántica de conflicto (si `versionEsperada` no coincide, devuelve el conflicto sin escribir), numera consecutivo por año, y cubre también `listarArchivoHistorico`, `archivar` y `guardarEntregable` (el servidor no los expone; acá sí).
- **`server/servidor.js`** — el servidor mínimo sobre `node:http` y `node:fs`, sin una sola dependencia. `--datos` obligatorio y validado antes de arrancar (ruta inexistente, archivo en vez de carpeta, o carpeta no escribible → mensaje claro en español y exit ≠ 0). `--puerto` por defecto 8123, con 0 asigna puerto libre y lo imprime en `SGC-SERVIDOR-PUERTO <n>`. Sirve los estáticos de `app/` en `/`. API literal: `GET /api/salud` → `{ok, version, datos}`, `GET /api/indice`, `POST /api/expedientes` → `201 {id, version, expediente}`, `GET /api/expedientes/:id` → `200 {expediente, version}` · `404`, `PUT /api/expedientes/:id` → `200 {version}` · `409 {conflicto, versionRemota}` · `404`.
- **`app/js/adapters/repo.http.js`** — factoría `crear(baseUrl)` que habla con el servidor. Traduce `409` a `{ok:false, conflicto:true, versionRemota}` sin excepción; los errores de red son excepciones con mensaje en español y código `RED`; un expediente inexistente rechaza con `NO_ENCONTRADO`. Sin una sola dirección literal en el archivo (la base se inyecta): el guardián de ADR-018 sigue en cero violaciones.
- **Tests de la ronda 3**: batería única del contrato en `tests/helpers/repo-bateria.js` corrida contra ambas implementaciones (`tests/repo.memoria.test.js`, `tests/repo.http.test.js`), y `tests/servidor.test.js` con unidad (atomicidad, lock, contador), arranque, API, estáticos, índice, recorrido de rutas y los dos tests de concurrencia. Utilidades de spawn en `tests/helpers/servidor-util.js`.
- **`INFORME-RONDA-03.md`** — este informe.

## 2. Decisiones que tomé y por qué

- **Un constructor único garantiza el contrato.** `construirExpediente` vive en `repo.js` y lo usan `repo.memoria` y el servidor. Así el expediente que crea un `POST` y el que crea un test en memoria tienen exactamente la misma forma: `estadoActual` cadena, `auditLog` arreglo con la entrada inicial (`accion: 'crearExpediente'`, `hashPrevio: null`) generada con `auditoria.crearEntrada`, `schemaVersion` = `migraciones.VERSION_ACTUAL` (2), `version: 1`, `expedienteId`/`anio`/`numero`. Es la única forma de que la batería única de §3.5.1 tenga sentido.
- **La verificación de versión ocurre en el servidor con un bloque síncrono.** Lectura → chequeo → escritura se hacen con `fs` síncrono en el mismo tramo del handler; un bloque síncrono no se intercala con otra petición, así que el chequeo es atómico de hecho. Para la numeración (ADR-009) agregué además el lock con creación exclusiva `wx` y reintento que pide la orden, documentado en el código: la estrategia pedida por la orden y la garantía real (sección crítica síncrona) se refuerzan mutuamente. El lock duerme entre reintentos con `Atomics.wait` (síncrono, sin ceder el event loop).
- **`origen.log` como archivo propio, no dentro de `auditLog`.** ADR-017 medida 3 pide guardar IP y nombre de equipo "junto al contexto recibido". Lo elegí como JSONL en `<datos>/origen.log`, una línea por petición con `{recibido, ip, hostname, metodo, ruta, id, contexto}`. No lo fundo en las entradas de `auditLog` porque `auditoria.serializarEntrada` serializa una lista fija de campos: sumarle campos a la entrada no rompe la cadena de hash, pero la deja sin cubrir, y además mezcla un dato observado con campos declarados. El log separado conserva el contexto tal cual lo envió el operador. El hostname sale de reverse DNS con un tope de 400 ms; si la resolución falla, se registra la IP.
- **`historico` / `archivar` / `guardarEntregable` no están en el servidor** (la orden §3.4 lo dice explícitamente), pero sí están en la interfaz de ADR-002 y en `repo.memoria`. La salida honesta: `repo.http` los declara en el contrato y lanza un error en español con código `NO_EXPUESTO`. La batería común cubre los 4 métodos centrales contra ambas implementaciones; los tres extra se testean en memoria.
- **`repo.js` exige `usar(...)` explícito.** No hay default silencioso: sin implementación inyectada, toda llamada lanza un error que dice exactamente qué falta. ADR-002 marca `repo.http` como el adaptador del producto, pero la elección ocurre en el arranque de la app, no dentro de la interfaz.
- **`version` es un contador monotónico entero** que arranca en 1 y lo incrementa el servidor en cada `PUT` exitoso (optimistic concurrency). En `GET /api/salud`, `version` es la versión del servidor (`1.0.0`), un dato distinto.
- **El índice fragmentado se mantiene al día en POST y PUT** con `repo.entradaIndice`, derivando `fase`, `rolEjecutor` y `sector` de `config.ESTADOS`/`ROLES`. `GET /api/indice` arma el listado leyendo `idx/`; no existe un `master_index.json`.
- **Guardia de recorrido de rutas por formato del id.** El id válido es `^\d{4}-\d{3,}$` (año-número). Cualquier `:id` que no cumpla —`..`, barras, codificaciones— se rechaza con `400` antes de tocar el disco, y por defensa en profundidad se verifica además que la ruta resuelta quede dentro de `--datos`.

## 3. Verificación

`node --test` (desde la raíz): **116 tests, 0 fallos**. Los 75 de las rondas 1 y 2 siguen en verde; la ronda 3 agrega 41.

`node tools/check-compat.js` (desde la raíz):

```
check-compat: OK - 12 archivo(s) inspeccionado(s), 0 violaciones.
```

`node tools/check-compat.js tools` (auto-inspección, con la nueva regla de URLs sobre `conCadenas`):

```
check-compat: OK - 2 archivo(s) inspeccionado(s), 0 violaciones.
```

Arranque real del servidor (criterio de aceptación 5):

```
node server/servidor.js --datos <ruta temporal> --puerto 0
SGC-SERVIDOR-PUERTO 50914
SGC-SERVIDOR-DATOS <ruta temporal>
SGC-SERVIDOR-LISTO
GET /api/salud → 200 {"ok":true,"version":"1.0.0","datos":"accesible"}
```

Además:
- Criterio 5: cero `Date.now(` / `new Date(` en `app/js/core/`.
- Criterio 6: cero "inmutable" / "no repudio" en el código nuevo.
- Dependencias de terceros: cero (los tres archivos nuevos de `server/` y `app/js/adapters/` sólo usan la biblioteca estándar y los módulos propios).
- Temporales de test dentro del repositorio: ninguno (los de la ronda 3 viven en `os.tmpdir()`).
- `tools/scraper-catalogo/`, documentación e `index.html` sin modificar.

## 4. Contradicciones e información faltante

1. **La orden §2.1 corrige la regla de la ronda 2** (que ordenaba no reportar URLs en strings). La contradicción es explícita y está resuelta como manda la orden: las URLs absolutas se reportan siempre, también dentro de literales de cadena; las APIs vetadas siguen sin reportarse en comentarios o strings.
2. **Divergencia justificada de `esquemas/datos.v1.ejemplo.json`.** El ejemplo de la ronda 2 es un fixture del esquema original v1 (para el test de migración): su `auditLog` usa nombres de campo (`usuario`, `detalle`) que no coinciden con los que produce `auditoria.crearEntrada` (`email`, `rol`, `equipo`, `accion`, `de`, `a`, ...). No lo modifiqué porque es un documento de entrada congelado de la migración. Lo que se gana al mantenerlo: el test de migración sigue consumiendo un v1 real, sin fabricar un intermedio que nadie tendrá. **No es divergencia silenciosa**: los expedientes nuevos —creados por `repo.memoria` o por el servidor— se escriben con la forma contractual de `construirExpediente`, y esto queda asentado acá.
3. **`historico` / `archivar` / `guardarEntregable` son parte de ADR-002 pero no de la API del servidor.** La orden §3.4 los declara no expuestos; la interfaz los declara. Ambas cosas se cumplen: existen en el contrato y en `repo.memoria`, y `repo.http` lanza `NO_EXPUESTO`. Si la batería externa espera esos endpoints, habrá que agregarlos en una ronda futura.
4. **No definido en la documentación: el significado exacto de `version`.** Lo interpreté como contador de concurrencia optimista dentro de `datos.json` (arranca en 1, lo sube el servidor). Si la batería externa espera otra semántica (p. ej. un hash o una fecha), este punto es el primero a revisar.

## 5. Qué NO hice

- **No escribí** interfaz de usuario, catálogo, copia de respaldo ni la restricción de rol por máquina (ADR-017 medida 4): la orden §1 los deja fuera de alcance.
- **No modifiqué** `index.html` ni ningún archivo de las rondas 1-2 salvo el guardián y su suite (por §2.1).
- **No modifiqué** la documentación ni `tools/scraper-catalogo/`.
- **No escribí** nada fuera de la raíz del repositorio: los temporales de test van a `os.tmpdir()`.
- **No hice commit ni push**: un solo commit local al final de la ronda.

## 6. Riesgos que veo

- **Escrituras síncronas en el event loop del servidor.** Cada petición de escritura lee y escribe con `fs` síncrono. A la escala de ADR-008 (<10 usuarios, <100 expedientes/año) es correcto y es lo que hace atómica la verificación de versión; si la concurrencia creciera de verdad, habría que migrar a un mecanismo asíncrono con lock real, y la sección crítica dejaría de ser trivial.
- **Reverse DNS por petición.** Si la resolución no responde, cada petición se topa con el tope de 400 ms. En una intranet sin DNS inverso el impacto es latencia constante; el hostname cae a la IP y el log sigue siendo útil. Alternativa futura: resolver una vez por origen y cachear.
- **`origen.log` se anexa sin atomicidad.** Un corte entre dos `appendFileSync` podría intercalar bytes en una línea. Es un log operacional de mejor esfuerzo, no un documento; documentado.
- **`construirExpediente` depende de `config`, `auditoria` y `migraciones` cargados.** El servidor los carga en orden; en el navegador, cuando se incorpore la UI, los adapters deberán cargarse después del núcleo. `index.html` hoy no carga adapters, así que no hay superficie expuesta.
- **`entradaIndice` degrada a `null`** fase/rol/sector si el estado del expediente no está en `config.ESTADOS`. Es el comportamiento honesto para un documento corrupto o futuro; el índice lo refleja en lugar de inventar un valor.
- **El conflicto de versión del lado del cliente sigue siendo una carrera** (el 409 se procesa al vuelo y se reintenta). El servidor garantiza la atomicidad; la app deberá resolver el conflicto con el operador, que es trabajo de una ronda con interfaz.

## 7. Evidencia de concurrencia

Salida literal de los tests de concurrencia (§3.5 puntos 2 y 3) sobre el proceso real:

```
✔ CONCURRENCIA PUT: 20 PUT simultáneos dan exactamente 1×200 y 19×409 (905.2072ms)
✔ CONCURRENCIA POST: 20 POST simultáneos dan 20 ids distintos, 10 corridas (7563.6404ms)
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

Punto 2 — 20 `PUT` simultáneos con `versionEsperada: 1` sobre el mismo expediente. Conteo real de una corrida y verificación del contenido ganador en disco:

```
PUT: 200=1  409=19
ganador: marca=put-0 version=2
```

`datos.json` quedó como JSON válido, con la `marca` exacta del único `PUT` que respondió `200`, y `version: 2`. Los otros 19 recibieron `409 {conflicto:true, versionRemota: ...}` sin escribir nada.

Punto 3 — 20 `POST /api/expedientes` simultáneos, 10 corridas con carpeta de datos fresca por corrida. Las 10 pasaron; tres corridas representativas (se muestran tal como salieron, en orden de llegada, que varía de corrida a corrida):

```
POST corrida 0: ids=2026-002,2026-003,2026-004,2026-005,2026-006,2026-007,2026-008,2026-009,2026-010,2026-011,2026-012,2026-013,2026-014,2026-015,2026-016,2026-017,2026-001,2026-018,2026-019,2026-020  distintos=20
POST corrida 1: ids=2026-001,2026-002,2026-003,2026-004,2026-005,2026-006,2026-007,2026-008,2026-009,2026-010,2026-011,2026-012,2026-013,2026-014,2026-015,2026-016,2026-017,2026-018,2026-019,2026-020  distintos=20
POST corrida 2: ids=2026-003,2026-005,2026-009,2026-004,2026-006,2026-007,2026-008,2026-001,2026-002,2026-020,2026-011,2026-018,2026-015,2026-016,2026-019,2026-017,2026-012,2026-010,2026-014,2026-013  distintos=20
```

En las 10 corridas el conjunto de números es siempre exactamente `1..20` sin huecos ni duplicados. El orden de llegada cambia (cada `POST` cierra su sección crítica en un momento distinto), pero el resultado es invariante: es la evidencia de que la numeración está serializada.