# INFORME — RONDA 23

> **Informe parcial.** Las piezas 1 a 4 se entregaron en sus propios commits
> (`b69041c`, `9cbe906`, `8af77aa`, `9009446`, `8baf4ec`). Este archivo crece con
> cada pieza; la versión final, con las nueve secciones, se cierra en el commit
> `Ronda 23 · informe`.

---

## Pieza 5 · B2 — el barrido de los límites

Barrido de **sólo lectura** sobre `app/`, `server/`, `tools/` y `tests/`, para
responder una sola pregunta: **¿cada límite está declarado una vez, o repetido?**

Nada se corrigió en esta ronda: la lista es el insumo, y lo que se arregle sale de
acá y entra en la ronda 24, priorizado por el daño que hace la desincronización.

### Tamaños de cuerpo y de archivo

| Límite | Dónde se declara | Quiénes lo consumen | ¿Coinciden? |
|---|---|---|---|
| Presupuesto: 20 MB | `app/js/core/limites.js` · `LIMITE_PRESUPUESTO_BYTES` | Servidor `server/presupuestos.js` (control y mensaje 413); cliente `app/js/views/requerimiento-presupuestos.js` (aviso previo y progreso); tests `tests/ronda-23-c4.test.js`, `tests/presupuestos-servidor.test.js` | **Sí.** Único (pieza 4). Antes estaba tres veces: `presupuestos.js:26`, `ayudantes.js:15` y `requerimiento-presupuestos.js:24`, más el texto del mensaje aparte. |
| Cuerpo general de la API: 4 MB | `server/ayudantes.js` · `LIMITE_CUERPO` | `leerCuerpo` (todas las rutas JSON) y su mensaje 413 | Único, sólo servidor. El cliente no lo conoce ni avisa antes; la vista de justificación corta a 20.000 por su cuenta. |
| Fragmento de catálogo: 280 KB | `tools/build-catalogo.js` · `LIMITE_FRAGMENTO` | sólo el build | **No.** `tests/build-catalogo.test.js` y `tools/medir-catalogo.js` usan **300 KB**. Preexistente. |
| Nombre original del presupuesto: 200 caracteres | `server/presupuestos.js` · `nombre.slice(0, 200)` | sólo servidor | Único; el cliente no recorta ni avisa. |
| Memoria de scrypt: 128 MB | `server/credenciales.js` · `PARAMETROS_SCRYPT.maxmem` | `scryptSync` (alta, login, reposición) | Único. |

### Cantidades máximas

| Límite | Dónde se declara | Quiénes lo consumen | ¿Coinciden? |
|---|---|---|---|
| Códigos por llamada: 1000 | `server/manejadores.js` · `MAX_CODIGOS_POR_LLAMADA` | `apiValidarCodigos` | Único; el cliente no lo conoce ni avisa. |
| Filas de importación de padrón: 500 | `server/padron-csv.js` · `TOPE_IMPORTACION` | `importar` | Único; el cliente (`views/padron-admin.js`) no lo conoce ni avisa. |
| Sucesos del diálogo: 4000 | `server/sugerencias.js` · `TOPE_SUCESOS` | `crearSugerencia` y el estado (`completo`) | Único. |
| Sugerencias de catálogo: 8 · ítems: 60 | `app/js/catalogo/buscador.js` · `LIMITE_SUGERENCIAS`, `LIMITE_ITEMS` | sólo cliente | Único, sólo cliente. |
| Filas de la exploración: 200 | `app/js/views/exploracion.js` (comparación `> 200`) | sólo cliente | Único, sólo cliente. |
| Columnas del tablero: 10 | `app/js/views/tablero.js` (`Math.min(..., 10)`) | sólo cliente | Único, sólo cliente. |
| Ausentes listados: 10 (+ "resto") | `app/js/views/padron-admin.js` (`slice(0, 10)`) | sólo cliente | Único, sólo cliente. |
| Intentos fallidos de login: 10 | `server/sesion.js` · `MAX_FALLOS` | login y bloqueo | Único, sólo servidor. |

### Topes de caracteres

| Límite | Dónde se declara | Quiénes lo consumen | ¿Coinciden? |
|---|---|---|---|
| Aclaración impresa: 256 | `app/js/core/config.js` · `MAX_ACLARACION` | `core/anexo-eett.js` (umbral del anexo), `catalogo/renglones.js`, `renders/requerimiento.js`; el servidor lo lee por `core/validacion` | Único. |
| Aclaración total: 2000 | `config.js` · `MAX_ACLARACION_TOTAL` | `core/validacion.js` (guard de entrada), `catalogo/renglones.js` (`aclaracion.maxLength`), `views/pasos.js`, `views/fasttrack.js`; servidor `server/expedientes.js` vía `validarRenglon` | Único. |
| Justificación: 20.000 | `config.js` · `MAX_JUSTIFICACION` | `core/validacion.js` (`validarFundamentacion`, `validarJustificaciones`); servidor en POST/PUT por la misma `validarJustificaciones` | Único. |
| Cotas del encabezado (120 / 40 / 80 / 10 / 500 / …) | `app/js/core/cotas-encabezado.js` · `CAMPOS_ENCABEZADO_COTAS` | `core/validacion.js` `validarEncabezado`, usado por cliente y servidor (`expedientes.js`) | Único. |
| Contenido de la sugerencia: 4000 | `server/sugerencias.js` · `MAX_CONTENIDO` **y** `app/js/views/sugerencias.js` (`area.maxLength = 4000`) | servidor (`crearSugerencia`) y cliente (el textarea) | **No.** Dos declaraciones con el mismo valor, y el mensaje del servidor repite el número literal (`'… hasta 4000 caracteres'`). Si cambia una, la otra queda. |
| Unidad de medida: 40 | `app/js/catalogo/renglones.js` (`unidad.maxLength = 40`) | sólo cliente | Único, pero **el servidor no lo verifica**: `validarRenglon` sólo exige que `unidad` no esté vacía. |
| Año: 4 dígitos | `app/index.html` (`maxlength="4"`), `core/validacion.js` (`/^\d{4}$/`) | cliente y servidor | Repetido, pero es formato (no un tope con número): no aplica "declarado una vez". |

### Tiempos de espera

| Límite | Dónde se declara | Quiénes lo consumen | ¿Coinciden? |
|---|---|---|---|
| Sesión: 15 min | `server/sesion.js` · `TIEMPO_SESION_MS` | expiración de sesión | Único. |
| Demora por login fallido: 1000 ms | `server/sesion.js` · `DEMORA_FALLO_MS` | `demorarFallo` | Único. |
| Timeout del DNS inverso: 400 ms | `server/ayudantes.js` (`setTimeout(..., 400)`) | `resolverOrigen` | Único. |
| Lock de numeración: 20 reintentos × 10 ms | `server/ayudantes.js` (`adquirirLock(rutaLock, 20, 10)` en `siguienteNumero`) | `siguienteNumero` | Par de números pasado por llamada; hoy un solo llamador. |
| Aviso "copiado": 2000 ms | `app/js/views/padron-admin.js` (`setTimeout(..., 2000)`) | sólo cliente | Único. |
| Proceso `python` del pliego | **no hay** | `server/pliego-probador.js` · `ejecutarPython` (`spawn` sin `timeout`) | **Hallazgo.** Un `python` que se cuelga no resuelve nunca la promesa ni cierra el request. |

### Lo que la tabla deja a la vista

- **Un solo límite repetido con el mismo valor (y con el número copiado en un
  mensaje):** los 4000 de la sugerencia viven en `server/sugerencias.js` y en
  `app/js/views/sugerencias.js`.
- **Un límite con dos números:** el fragmento de catálogo: 280 KB (build) contra
  300 KB (test y medidor).
- **Un tope de entrada que el servidor no verifica:** la unidad de medida (40) en
  `catalogo/renglones.js`; `validarRenglon` no tiene cota para `unidad`.
- **Una espera sin techo:** el `spawn` del generador de pliego, sin `timeout`.
- El límite del presupuesto quedó **en un solo lugar** en la pieza 4; es el único
  de los topes grandes con control de servidor y aviso de cliente saliendo del
  mismo número.

---

## Pieza 6 · La suite: dónde se va el tiempo

**Método.** Cada archivo se corrió solo (`node --test <archivo>`, que ejecuta sus
tests en serie dentro de un proceso) y se cronometró el muro. Después, la suite
entera en dos formas. Máquina: 4 CPU, `os.availableParallelism()` = 4, Node
v24.16.0. Los 436 tests pasan en todas las corridas.

| Corrida | Muro |
|---|---|
| Suma de los 56 archivos de a uno (serie) | **905 s** |
| `node --test "tests/*.test.js"` (default del runner) | **328 s** |
| `node --test --test-concurrency=4 "tests/*.test.js"` | **269 s** |

### Tabla de tiempos por archivo (de mayor a menor)

| s | Archivo |
|---:|---|
| 99,4 | `transiciones-servidor-matriz-2.test.js` |
| 85,9 | `ronda-17.test.js` |
| 72,2 | `ronda-21-c6.test.js` |
| 59,2 | `transiciones-servidor-matriz.test.js` |
| 58,5 | `ronda-14.test.js` |
| 58,1 | `ronda-23-c2.test.js` |
| 45,7 | `wizard.test.js` |
| 42,2 | `imputacion-servidor.test.js` |
| 39,9 | `ronda-18.test.js` |
| 37,5 | `ronda-13.test.js` |
| 36,6 | `ronda-20.test.js` |
| 28,0 | `ronda-22-nacimiento.test.js` |
| 26,8 | `repo.http.test.js` |
| 19,5 | `servidor.test.js` |
| 19,0 | `build-catalogo.test.js` |
| 15,8 | `requerimiento-servidor.test.js` |
| 15,2 | `transiciones-servidor.test.js` |
| 15,0 | `ronda-21-c7.test.js` |
| 13,9 | `archivo.test.js` |
| 13,4 | `ronda-18-bis.test.js` |
| 13,0 | `recorrido.test.js` |
| 12,5 | `servidor-concurrencia.test.js` |
| 11,8 | `ronda-19-padron.test.js` |
| 9,4 | `presupuestos-servidor.test.js` |
| 9,3 | `ronda-12.test.js` |
| 9,0 | `ronda-21-c9.test.js` |
| 6,7 | `ronda-19-borrador.test.js` |
| 6,6 | `ronda-19-auth.test.js` |
| 6,1 | `ronda-16.test.js` |
| 4,4 | `check-compat.test.js` |
| 1,9 | `ronda-20-anexo.test.js` |
| 1,5 | `pantalla.test.js` |
| 1,3 | `servidor-ayudantes.test.js` |
| 1,3 | `ronda-19-estructural.test.js` |
| 0,69 | `respaldo.test.js` |
| 0,65 | `ronda-23-c4.test.js` |
| 0,54 | `catalogo.test.js` |
| 0,45 | `expediente-matriz.test.js` |
| 0,44 | `requerimiento-formulario.test.js` |
| 0,43 | `ronda-15.test.js` |
| 0,41 | `ronda-11.test.js` |
| 0,41 | `repo.memoria.test.js` |
| 0,39 | `expediente.test.js` |
| 0,38 | `kanban.test.js` |
| 0,37 | `exportar.test.js` |
| 0,37 | `plantillas.test.js` |
| 0,37 | `anexo-eett.test.js` |
| 0,35 | `renders.test.js` |
| 0,35 | `requerimiento.test.js` |
| 0,35 | `validacion.test.js` |
| 0,34 | `migraciones.test.js` |
| 0,34 | `motor.test.js` |
| 0,33 | `config.test.js` |
| 0,33 | `auditoria.test.js` |
| 0,32 | `ronda-23-c1.test.js` |
| 0,32 | `estados.test.js` |

Son **56 archivos** (la orden dice 52).

### ¿Por qué no paraleliza? — las candidatas, descartadas de a una

**1. Los puertos fijos — descartado.** No hay ninguno. Todos los tests levantan el
servidor con `--puerto 0` o `listen(0, …)` y leen el puerto real de la línea
`SGC-SERVIDOR-PUERTO <n>`; el `8123` sólo es el default de `server/arranque.js` y
los tests lo pisan siempre. Por eso esta pieza **no cambió código**: la corrección
que la orden preveía para este caso no aplica.

**2. La carpeta de datos compartida — descartado.** Cada test crea su propio
directorio con `fs.mkdtempSync(path.join(os.tmpdir(), …))`. No hay un
`datos` común entre archivos, así que no se serializan por el `contador.lock`.

**3. La bandera no hace lo que suponíamos — hallazgo real.** El default del runner
en Node 24 es **3 archivos a la vez**, no `availableParallelism()` (=4). Pedir
`--test-concurrency=4` bajó el muro de 328 s a 269 s: un 18% que estaba sobre la
mesa. Vale como corrección de una línea en el comando de cierre.

**4. Sí paraleliza; lo que pasa es que el piso es alto y el reparto es desparejo.**
La serie suma 905 s y con 4 workers el muro es 269 s: **≈3,4×**, cerca del techo de
4. El problema no es la falta de paralelismo, son dos cosas:

- **Un archivo dominante:** `transiciones-servidor-matriz-2.test.js` dura 99 s solo.
  Los cuatro más lentos suman 316 s. El ideal teórico (905 / 4) es ≈226 s y se
  llega a 269 s: la diferencia es la cola de archivos grandes que no entra a la
  primera tanda. Dentro de un archivo los tests corren **en serie** (Node no parte
  un archivo), así que esos 99 s no se reparten.
- **Esos archivos son lentos porque levantan el servidor como proceso real** una vez
  por escenario (matriz 18 × 7, `wizard`, `imputacion-servidor`, `ronda-14/17/18`) y
  porque el login usa **scrypt** (`N=16384`), que es CPU y deliberadamente caro.

**Camino rápido, escrito en el repositorio:** `tests/LEEME.md`. Deja el comando de
la suite completa (`--test-concurrency=4`), el de los archivos tocados, la regla de
`check-compat` y los ejemplos de esta ronda.
