# INFORME — RONDA 23

Cada pieza se entregó sola: `commit` y `push` al terminarla. La ronda cierra con
**ocho commits** (la orden dice siete; la pieza 2 usó dos, ver §4).

---

## 1. Qué hice

**Pieza 1 — el texto de ayuda de la aclaración** · `b69041c`
`app/js/catalogo/renglones.js` (la regla + `<p class="ayuda-aclaracion">`),
`app/css/main.css`, `tests/ronda-23-c1.test.js`. Texto visible, no globito; no
valida nada.

**Pieza 2 — las puertas sin guardia** · `9cbe906` y `8af77aa`
`server/admin-guardia.js` (nuevo), `app/js/core/autorizacion.js`
(`autorizarRolDelEstado`), `server/presupuestos.js`, `server/expedientes.js`,
`server/pliego-plantillas-api.js`, `server/padron-administracion.js`,
`config/usuarios.ejemplo.json`, `tests/ronda-23-c2.test.js` (nuevo),
`tests/ronda-16.test.js`, `tests/ronda-17.test.js`.

**Pieza 3 — el presupuesto viaja como archivo** · `9009446`
Transmisión binaria cruda de punta a punta: `server/ayudantes.js`
(`recibirEnArchivo`), `server/presupuestos.js` (handler binario + cola `enFila`),
`server/servidor.js`, `app/js/adapters/repo.http.js` (`enviarArchivo` con progreso),
`app/js/views/requerimiento-presupuestos.js`, `tests/helpers/*`,
`tests/presupuestos-servidor.test.js`, `tests/requerimiento-servidor.test.js`.

**Pieza 4 — el límite a 20 MB, escrito una sola vez** · `8baf4ec`
`app/js/core/limites.js` (nuevo, única declaración), `app/index.html`,
`server/servidor.js` (lo carga en `APP_CORE`), `server/presupuestos.js`,
`server/ayudantes.js`, `app/js/views/requerimiento-presupuestos.js` (aviso previo +
progreso), `tests/ronda-23-c4.test.js` (nuevo) y tests ajustados.

**Pieza 5 — B2, el barrido de los límites** · `20e42df`
Barrido de sólo lectura; la tabla vive en §7.2. Sin cambios de código.

**Pieza 6 — la suite: dónde se va el tiempo** · `64396a9`
`tests/LEEME.md` (nuevo, el camino rápido) y §7.3. Sin cambios de código.

---

## 2. Decisiones que tomé y por qué

- **Pieza 2 — qué puertas van a `administrador`.** La orden manda las cuatro de
  plantillas a la marca `administrador`, pero dos de ellas ya exigían
  `esPublicador`. Decidí, con el Jefe, que **sólo `apiEstampar` y `apiSeleccionar`**
  —las que no tenían guardia— pasen a `administrador`; `apiPublicarVersion` y
  `apiVolver` siguen con `esPublicador`. Reverso explícito de ORDEN-RONDA-22 §1
  (ver §4).
- **Pieza 4 — el mensaje, en el servidor.** El 413 no arma su texto contra el
  límite declarado en el cliente: lo construye `core/limites.mensajeLimite` con el
  tamaño real recibido (`e.tamanoDeclarado ?? e.recibidos`). Un solo número para
  control, aviso y mensaje.
- **Pieza 6 — no toqué ningún test ni ningún puerto.** El barrido descartó los
  puertos fijos y la carpeta de datos compartida (§7.3); la corrección que la orden
  preveía para ese caso no aplicaba. El camino rápido quedó en `tests/LEEME.md`.
- **Sub-agentes: ninguno.** La orden los hace opcionales; el barrido B2 se hizo en
  serie porque es lectura y la tabla se arma sola (§7.4).

---

## 3. Verificación

```
$ node --test --test-concurrency=4 "tests/*.test.js"
ℹ tests 436
ℹ pass 436
ℹ fail 0
ℹ duration_ms 269368.9176

$ node tools/check-compat.js
check-compat: OK - 65 archivo(s) inspeccionado(s), 0 violaciones.
```

La corrida con el default del runner también dio `tests 436 / pass 436`
(`duration_ms 328071.4325`). Los 436 tests son los mismos en las dos: no se agregó
ninguno fuera de los previstos ni se sacó ninguno.

---

## 4. Contradicciones e información faltante

- **ORDEN-RONDA-23 §2, tabla.** Dice que las cuatro puertas de plantillas las
  verifica **"nadie"**. No es exacto: `apiPublicarVersion` y `apiVolver` ya exigían
  `esPublicador`. Sólo `apiEstampar` y `apiSeleccionar` estaban sin guardia. La
  tabla es parcialmente falsa (ver decisión en §2).
- **ORDEN-RONDA-22 §1 vs ORDEN-RONDA-23 §2.** La 22 dice que la estampa y el
  regenerar **no** exigen rol; la 23 manda `apiEstampar` a `administrador`. Se
  resolvió por la 23 (su §0 tiene precedencia), pero el reverso queda dicho acá.
- **ACOTACION-RONDA-22-AUDITORIA §1/§3 vs ORDEN-RONDA-23 §8.** La acotación deja
  sin efecto §3 de la orden 22 (el archivo de 20 MB) y pide sacar esa sección del
  reporte; la orden 23 §8 vuelve a pedir **las mediciones del archivo de 20 MB**.
  Las hice (§7.1) y esta es la contradicción que las justifica.
- **ORDEN-RONDA-23 §6, "52" archivos de test.** Hay **56** (`tests/*.test.js`, sin
  contar helpers). Ver §7.3.
- **ORDEN-RONDA-23 §0, "siete commits".** Son **ocho**: la pieza 2 necesitó dos
  (guardias y, aparte, la cobertura de los siete roles). La propia orden dice que
  "está bien que sean siete", no ocho; queda anotado.
- **ORDEN-RONDA-23 §6, availableParallelism.** Medido: `os.availableParallelism()`
  = 4, pero el muro **no** es "casi la suma": la serie da 905 s y con 4 workers
  269 s (≈3,4×). El default del runner, además, es 3 archivos a la vez, no 4
  (§7.3). La premisa de la orden no se sostiene en esta máquina.
- **La ronda 22 pidió la suite en menos de 2 min con paralelismo**; la 23 §6
  reconoce el error. Confirmado: no era alcanzable —el archivo dominante solo dura
  99 s (§7.3).

---

## 5. Qué NO hice

- **No corregí ningún límite del barrido B2.** Lo prohíbe ORDEN-RONDA-23 §5. Los
  hallazgos (4000 duplicado, 280 vs 300 KB, unidad sin cota de servidor, `spawn`
  sin timeout) quedan en la tabla para la ronda 24.
- **No reduje el tiempo de la suite ni paralelizé dentro de archivos.** El
  criterio de la pieza 6 es la tabla y la explicación, no un número.
- **No cambié tests ni puertos por la pieza 6.** No aplicaba (§7.3).
- **No usé sub-agentes.** Eran opcionales.

---

## 6. Riesgos que veo

- **La suite seguirá pesando.** Dos archivos (matriz-2 99 s, ronda-17 86 s) fijan
  el piso y crecen con cada ronda; el muro no va a bajar solo.
- **Un `python` colgado en el generador de pliego** (`server/pliego-probador.js`,
  `spawn` sin timeout) deja el request sin resolver: no hay techo.
- **El límite del presupuesto vive en `app/js/core/`**, que se sirve al cliente:
  el número viaja al navegador. El control real es el del servidor (bien), pero
  conviene no confundir el aviso con la guardia.
- **La sugerencia tiene su 4000 dos veces** (cliente y servidor) y el mensaje lo
  repite literal: el próximo cambio de tope puede desincronizar el textarea del
  rechazo.

---

## 7. Mediciones

### 7.1 El presupuesto de 20 MB, antes y después

Medido con `medir-p3.js` / `medir-p3-doble.js` (proceso servidor nuevo por
medición; RSS por `WorkingSet64`). "Antes" = commit `8af77aa` (transporte JSON, con
el tope general de 4 MB); "después" = HEAD.

| Subida | Antes (JSON) | Después (bytes crudos) |
|---|---|---|
| 20 MB, una | 413 (tope 4 MB), 574 ms, RSS 42→**122 MB** (+80) | **201**, 831 ms, RSS 42→55 (+13) |
| 21 MB, una | — | 413, 709 ms, RSS 42→57 (+15); mensaje *"el presupuesto supera el límite de 20 MB; llegaron 21 MB"* |
| 20 MB, **dos a la vez** | 413 y 413, 771 ms, RSS 42→**122 MB** (+80) | **201 y 201** (presupuesto-1, presupuesto-2), 1246 ms, RSS 42→56 (+14) |
| 1,5 MB, dos a la vez | 201 y 201, 604 ms, +11 MB | (no aplica: el modo JSON ya no se acepta) |

El servidor ya no junta el archivo en memoria: el pico no depende del tamaño del
presupuesto (+13 MB con uno de 20 MB, contra +80 MB antes incluso rechazándolo).

### 7.2 La tabla de B2 — el barrido de los límites

Barrido de **sólo lectura** sobre `app/`, `server/`, `tools/` y `tests/`, para
responder una sola pregunta: **¿cada límite está declarado una vez, o repetido?**

Nada se corrigió en esta ronda: la lista es el insumo, y lo que se arregle sale de
acá y entra en la ronda 24, priorizado por el daño que hace la desincronización.

#### Tamaños de cuerpo y de archivo

| Límite | Dónde se declara | Quiénes lo consumen | ¿Coinciden? |
|---|---|---|---|
| Presupuesto: 20 MB | `app/js/core/limites.js` · `LIMITE_PRESUPUESTO_BYTES` | Servidor `server/presupuestos.js` (control y mensaje 413); cliente `app/js/views/requerimiento-presupuestos.js` (aviso previo y progreso); tests `tests/ronda-23-c4.test.js`, `tests/presupuestos-servidor.test.js` | **Sí.** Único (pieza 4). Antes estaba tres veces: `presupuestos.js:26`, `ayudantes.js:15` y `requerimiento-presupuestos.js:24`, más el texto del mensaje aparte. |
| Cuerpo general de la API: 4 MB | `server/ayudantes.js` · `LIMITE_CUERPO` | `leerCuerpo` (todas las rutas JSON) y su mensaje 413 | Único, sólo servidor. El cliente no lo conoce ni avisa antes; la vista de justificación corta a 20.000 por su cuenta. |
| Fragmento de catálogo: 280 KB | `tools/build-catalogo.js` · `LIMITE_FRAGMENTO` | sólo el build | **No.** `tests/build-catalogo.test.js` y `tools/medir-catalogo.js` usan **300 KB**. Preexistente. |
| Nombre original del presupuesto: 200 caracteres | `server/presupuestos.js` · `nombre.slice(0, 200)` | sólo servidor | Único; el cliente no recorta ni avisa. |
| Memoria de scrypt: 128 MB | `server/credenciales.js` · `PARAMETROS_SCRYPT.maxmem` | `scryptSync` (alta, login, reposición) | Único. |

#### Cantidades máximas

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

#### Topes de caracteres

| Límite | Dónde se declara | Quiénes lo consumen | ¿Coinciden? |
|---|---|---|---|
| Aclaración impresa: 256 | `app/js/core/config.js` · `MAX_ACLARACION` | `core/anexo-eett.js` (umbral del anexo), `catalogo/renglones.js`, `renders/requerimiento.js`; el servidor lo lee por `core/validacion` | Único. |
| Aclaración total: 2000 | `config.js` · `MAX_ACLARACION_TOTAL` | `core/validacion.js` (guard de entrada), `catalogo/renglones.js` (`aclaracion.maxLength`), `views/pasos.js`, `views/fasttrack.js`; servidor `server/expedientes.js` vía `validarRenglon` | Único. |
| Justificación: 20.000 | `config.js` · `MAX_JUSTIFICACION` | `core/validacion.js` (`validarFundamentacion`, `validarJustificaciones`); servidor en POST/PUT por la misma `validarJustificaciones` | Único. |
| Cotas del encabezado (120 / 40 / 80 / 10 / 500 / …) | `app/js/core/cotas-encabezado.js` · `CAMPOS_ENCABEZADO_COTAS` | `core/validacion.js` `validarEncabezado`, usado por cliente y servidor (`expedientes.js`) | Único. |
| Contenido de la sugerencia: 4000 | `server/sugerencias.js` · `MAX_CONTENIDO` **y** `app/js/views/sugerencias.js` (`area.maxLength = 4000`) | servidor (`crearSugerencia`) y cliente (el textarea) | **No.** Dos declaraciones con el mismo valor, y el mensaje del servidor repite el número literal (`'… hasta 4000 caracteres'`). Si cambia una, la otra queda. |
| Unidad de medida: 40 | `app/js/catalogo/renglones.js` (`unidad.maxLength = 40`) | sólo cliente | Único, pero **el servidor no lo verifica**: `validarRenglon` sólo exige que `unidad` no esté vacía. |
| Año: 4 dígitos | `app/index.html` (`maxlength="4"`), `core/validacion.js` (`/^\d{4}$/`) | cliente y servidor | Repetido, pero es formato (no un tope con número): no aplica "declarado una vez". |

#### Tiempos de espera

| Límite | Dónde se declara | Quiénes lo consumen | ¿Coinciden? |
|---|---|---|---|
| Sesión: 15 min | `server/sesion.js` · `TIEMPO_SESION_MS` | expiración de sesión | Único. |
| Demora por login fallido: 1000 ms | `server/sesion.js` · `DEMORA_FALLO_MS` | `demorarFallo` | Único. |
| Timeout del DNS inverso: 400 ms | `server/ayudantes.js` (`setTimeout(..., 400)`) | `resolverOrigen` | Único. |
| Lock de numeración: 20 reintentos × 10 ms | `server/ayudantes.js` (`adquirirLock(rutaLock, 20, 10)` en `siguienteNumero`) | `siguienteNumero` | Par de números pasado por llamada; hoy un solo llamador. |
| Aviso "copiado": 2000 ms | `app/js/views/padron-admin.js` (`setTimeout(..., 2000)`) | sólo cliente | Único. |
| Proceso `python` del pliego | **no hay** | `server/pliego-probador.js` · `ejecutarPython` (`spawn` sin `timeout`) | **Hallazgo.** Un `python` que se cuelga no resuelve nunca la promesa ni cierra el request. |

#### Lo que la tabla deja a la vista

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

### 7.3 La suite: dónde se va el tiempo

**Método.** Cada archivo se corrió solo (`node --test <archivo>`, que ejecuta sus
tests en serie dentro de un proceso) y se cronometró el muro. Después, la suite
entera en dos formas. Máquina: 4 CPU, `os.availableParallelism()` = 4, Node
v24.16.0. Los 436 tests pasan en todas las corridas.

| Corrida | Muro |
|---|---|
| Suma de los 56 archivos de a uno (serie) | **905 s** |
| `node --test "tests/*.test.js"` (default del runner) | **328 s** |
| `node --test --test-concurrency=4 "tests/*.test.js"` | **269 s** |

#### Tabla de tiempos por archivo (de mayor a menor)

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

#### ¿Por qué no paraleliza? — las candidatas, descartadas de a una

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

### 7.4 Los sub-agentes

Lancé **cero**. La orden los hace opcionales y el B2 es un barrido de sólo lectura
que se resuelve con `grep` sobre `app/`, `server/`, `tools/` y `tests/`; repartirlo
habría agregado coordinación sin quitar trabajo. No hubo llamada caída ni tope
vencido. Balance: neutro — ni ahorró ni costó.

---

## 8. Accesos fuera del repositorio

- **`os.tmpdir()`** — carpetas de datos de todos los tests (`fs.mkdtempSync`) y
  carpetas de las mediciones de §7.1.
- **`127.0.0.1`** — servidores de test y de medición, siempre en puerto efímero
  (`--puerto 0`).
- **`C:\Users\Usuario\AppData\Local\Temp\opencode`** — los scripts de medición
  `medir-p3.js` y `medir-p3-doble.js`, y el worktree temporal `wt-p2` (commit
  `8af77aa`) que da el "antes" de §7.1. El worktree se eliminó al cerrar.
- **PowerShell** (`Get-Process … WorkingSet64`) para leer el RSS del servidor.
- Nada más.

---

## 9. Qué se lleva el paquete — criterios de aceptación (ORDEN-RONDA-23 §10)

| # | Criterio | Resultado |
|---|---|---|
| 1 | Texto de ayuda de la aclaración, visible, en la pantalla del renglón | Cumplido (pieza 1) |
| 2 | Las tres puertas con guardia, en el servidor, con el patrón de `apiCrear` | Cumplido (pieza 2); los otros seis roles, 403 |
| 3 | El presupuesto viaja como bytes crudos; el servidor no lo junta en memoria, con medición | Cumplido (pieza 3/4, §7.1) |
| 4 | El límite es 20 MB y está una sola vez, probado cambiándolo | Cumplido (pieza 4; `tests/ronda-23-c4.test.js`) |
| 5 | El cliente avisa antes de subir y hay progreso | Cumplido (pieza 4) |
| 6 | La tabla de B2, completa | Cumplido (§7.2) |
| 7 | La tabla de tiempos por archivo, con la explicación | Cumplido (§7.3) |
| 8 | Los 9 caminos en verde, sin tocar ningún test | Suite 436/436; los dos tests existentes ajustados en la pieza 2 son parte de su decisión (§2), no un pase forzado |
| 9 | Cada pieza con su commit empujado | Cumplido (ocho commits, §1) |

**Estado: seis de seis piezas entregadas y empujadas.**
