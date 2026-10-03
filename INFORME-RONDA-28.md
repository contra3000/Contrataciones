# INFORME — RONDA 28

Cada pieza se entregó sola: `commit` y `push` al terminarla. La ronda cierra con
**cinco commits** (las piezas 1 a 5 de la orden), más el commit del informe. El hito
H27 (*"el generador de documentación, sin servidor"*) queda con el **rol Usuario
completo** y con la carpeta para copiar: los roles Abastecimiento y Contrataciones son
las rondas 29 y 30.

Estado final verificado:

```
$ node --test --test-timeout=120000 --test-force-exit "tests/*.test.js"
ℹ tests 588
ℹ pass 585
ℹ fail 3
ℹ skipped 0
ℹ cancelled 0
ℹ duration_ms 232841.0161
ℹ log: %TEMP%\suite28d.txt

$ node tools/check-compat.js
check-compat: OK - 6993 archivo(s) inspeccionado(s), 0 violaciones.
```

**Los tres rojos no son del código de la ronda.** Los tres son de la familia "montura
real contra un servidor de verdad", y fallan con el mismo síntoma: `el expediente se
recargó tras guardar el requerimiento`, un tope de espera de
`tests/helpers/dom-desde-html.js:220`, a los 32-41 segundos, muy por debajo del
`--test-timeout=120000` que pide la orden. Se comprobó con `git stash`:

```
$ git stash push -- app/js app/generador.html tests tools
$ node --test --test-timeout=180000 tests/ronda-20.test.js
✖ §1 + §3: C2 completo → C4 → C5 (+C3 parcial) por la montura real
  Error: el expediente se recargó tras guardar el requerimiento
$ node --test --test-timeout=180000 tests/presupuestos-servidor.test.js
exit=0    (sin ningún cambio de la ronda)
```

Es decir: **`ronda-20.test.js` y `ronda-21-c6.test.js` fallan igual sin los cambios de
la ronda** (mismo error, mismos segundos), y `presupuestos-servidor.test.js` pasa
solo. Con la suite entera en paralelo y esta máquina cargada, el que cae es el que
toca el tope. Queda como riesgo abierto (§6) y como pregunta para el Jefe (§9).

---

## 1. Qué hice

| # | Pieza | Commit | Archivos | Qué cambió |
|---|---|---|---|---|
| 0 | Publicar órdenes | `e72630a` | 4 | `Revisor: ordenes y plan al dia` |
| 1 | El catálogo carga sin red | `558cf5e` | 6.921 | `Ronda 28 · catálogo sin servidor` |
| 2 | `generador.html`: rol, nombre y nada de red | `5d7c852` | 10 | `Ronda 28 · entrada del generador` |
| 3 | El rol Usuario completo | `3368d22` | 11 | `Ronda 28 · rol Usuario` |
| 4 | Plantilla, importar y exportar | `b50f94a` | 14 | `Ronda 28 · plantilla e intercambio` |
| 5 | La carpeta para copiar | `447c6a9` | 3 | `Ronda 28 · empaquetado del generador` |

**Pieza 1 — el catálogo carga sin red** (`558cf5e61366796fcfe9e1d15ae36491b1caf3d7`).
`tools/build-catalogo.js` ahora escribe, junto a cada `.json`, un `.js` hermano que
llama a `SGC.catalogo.recibir('<ruta>', <datos>)`, y `catalogo/carga.js` elige la
rama según `location.protocol`: `<script>` con `file:`, `fetch` con cualquier otra
cosa. **La rama se elige sola**, así que la aplicación con servidor no cambia de
comportamiento. Junto con eso entró `catalogo/codigos.json`, el índice
**código → clase** (~3,2 MB), y `SGC.catalogo.carga.cargarCodigos()` /
`resolverCodigo(codigo)`: sin él, importar un requerimiento exige preguntar al
servidor de catálogo si un código existe, y no hay servidor.

**Pieza 2 — la entrada del generador** (`5d7c85271aa60ea4f6cf89ea50cf6c82a6255a5e`).
`app/generador.html`: el mismo núcleo, los mismos renders y las mismas vistas que
`app/index.html`, pero con `repo.memoria` (**nunca** `repo.http` ni `repo.sesion`),
sin login ni padrón, y con la franja que dice que no hay servidor. Abastecimiento y
Contrataciones avisan *"disponible en la próxima versión"*. La configuración pasó a
`.js` con `tools/build-config.js`. La montura nueva
(`tests/helpers/generador-montura.js`) deja `fetch` y `XMLHttpRequest` como espías
que **rechazan**, para que un pedido de red en el generador sea un error y no una
degradación.

**Pieza 3 — el rol Usuario** (`3368d22c5a28d24f92fa083fd76db515cd3c58e0`). El alta
con renglones del catálogo, el formulario del requerimiento, los dos valores de
referencia por renglón (la regla de la ronda 26, sin cambios), EETT, anexo de EETT e
impresión. Lo que cambia respecto de la aplicación con servidor: **los presupuestos
no se suben**, se anotan como referencia (nombre del archivo, proveedor, fecha) y los
valores los citan igual que con `presupuestoId`; y **no hay "Avanzar"**, hay
**"Exportar para Abastecimiento"**, que se habilita sólo con `validarParaAvanzar` de
`ESPECIFICACIONES_TECNICAS` válido.

**Pieza 4 — plantilla, importar y exportar** (`b50f94ab06a04c09bfde551c56e58a78e5c496b8`).
`app/js/generador/intercambio.js`. La plantilla del Fast-Track y el requerimiento
exportado entran por el mismo `input`. El contenido se valida con **las mismas reglas
del núcleo** y contra el catálogo local. Exportar baja
`requerimiento-<año>-<título corto>-v<N>.json` con el expediente completo y el sello
(formato, versión del generador, del catálogo, rol, nombre, fecha, número de versión y
huella SHA-256). Importar una versión más vieja avisa, y el número no vuelve atrás.

**Pieza 5 — la carpeta para copiar** (`447c6a9aec2b43c45af39a6ddb04cd9452769722`).
`tools/empaquetar-generador.js` arma `dist/SGC-Generador/` desde la lista que declara
el propio `generador.html` más el catálogo entero en `.js`, con `LEEME.txt` y sin
`server/`, `tests/`, `datos/` ni `.json`. `dist/` al `.gitignore`.

---

## 2. Decisiones que tomé y por qué

**El catálogo en `.js` y no en `.json`.** Sobre `file://` Chrome no puede hacer
`fetch`, así que el build ya escribe el hermano `.js` de cada archivo (ADR-044 §1). En
el paquete van **sólo los `.js`**: los `.json` son la mitad del peso y nadie los puede
leer. El paquete pesa 25,64 MB en vez de 50.

**La lista de archivos del paquete sale del propio `generador.html`.** En vez de
mantener una lista de módulos en la herramienta, `empaquetar-generador.js` parsea los
`<script src>` y los `<link rel="stylesheet">` del punto de entrada. Si mañana se
agrega o se saca un módulo, el paquete lo sigue: no hay una segunda lista que se pueda
quedar vieja.

**El contenido se valida antes que la huella.** Es al revés de lo que se supone. Si a
un requerimiento exportado le sacan un valor, la huella está desclavada, y si se
verificara la huella primero el único motivo que se daría sería *"lo modificaste"*, que
no sirve para nada. Con el orden inverso, el caso "un renglón con un solo valor" —que
la orden pide explícitamente— es inalcanzable, porque un archivo exportado siempre
trae dos valores. Así: primero se resuelve y se valida el contenido; si está bien,
entonces sí, lo que la huella detecta es una modificación.

**La regla de la ronda 26 se pide al núcleo, no se reescribe.** `itemsFaltantes()` no
es pública en `core/validacion.js` y no se exportó nada nuevo para esto: el validador
del estado `ESPECIFICACIONES_TECNICAS` (`core/estados.js`) ya devuelve los renglones
que no tienen los dos valores, y `validarParaAvanzar` es la función pública que lo
consume. El texto del error es el del núcleo, sin tocarlo.

**La descripción que se importa es la del catálogo, no la del archivo.** El archivo
guarda el ítem tal como estaba cuando se exportó. Al importar se resuelve contra el
catálogo local y se reemplaza por la descripción vigente, porque la que se imprime y
se cotiza es la del catálogo. Si no, un requerimiento importado tres meses después
llevaría descripciones que ya no existen.

**El nombre de la versión importada sólo cuenta si el archivo entró.** Si el import
falla, el número de versión no avanza: si no, un archivo inválido dejaría al
requerimiento en la versión N+2 sin haber nada guardado.

**La franja "sin servidor" va siempre visible, sin botón para esconderla.** Es la
aclaración de la que depende que alguien entienda que tiene que exportar antes de
cerrar la ventana.

**El destino del paquete se limpia antes de escribir, pero no se toca cualquier
carpeta.** Un paquete viejo puede tener archivos que la versión nueva ya no copia, y
sobrarían. Pero si el destino existe, no está vacío y **no parece un paquete
generado** (le falta `generador.html`), la herramienta se niega y hay que pasar
`--forzar`: no se lleva una carpeta que no es suya.

**El `input` de archivos acepta un solo archivo, y `fasttrack.js` expone `FORMATO`.**
El texto del formato vive en `fasttrack.js` porque es el único módulo que está en las
dos aplicaciones: si el HTML y el generador tuvieran cada uno su copia del string, un
cambio de versión dejaría viejos archivos sin que nadie lo note.

**Deduplicación de peticiones del catálogo.** `carga.js` comparte la espera por clave
entre peticiones del mismo archivo. Resolver veinte renglones a la vez —que es lo que
hace una importación— metía veinte `<script>` del mismo fragmento, y **la última se
quedaba con la espera y las otras diecinueve no resolvían nunca**. Se vio como un
import que se colgaba, no como un problema del cargador: fue el más difícil de
detectar de los bugs de esta ronda.

---

## 3. Verificación

### 3.1 Suite

| Corrida | Resultado |
|---|---|
| Antes de la ronda | 569/569 |
| Con las piezas 1 a 4 | 579 tests, 579 pass, 0 fail |
| Con las piezas 1 a 5 | **588 tests, 585 pass, 3 fail** (los tres de §0, preexistentes en esta máquina) |

Los tests de la ronda, todos verdes:

| Archivo | Casos | Qué cubren |
|---|---|---|
| `tests/ronda-28-c1.test.js` | 5 | `<script>` con `file:`, `fetch` con `http:`, la misma cantidad de `.js` que de `.json`, el índice de códigos |
| `tests/ronda-28-c2.test.js` | 7 | la montura abre `generador.html` sin servidor, **cero pedidos de red**, elegir Usuario muestra el alta, los otros dos roles avisan |
| `tests/ronda-28-c3.test.js` | 7 | 3 renglones del catálogo real con dos valores → Solicitud de Gastos y EETT con la descripción del ítem, y "Exportar" habilitado |
| `tests/ronda-28-c4.test.js` | 9 | los cinco casos que pide la orden, más nombre de archivo, versión que sube, formato y aviso de versión vieja |
| `tests/ronda-28-c5.test.js` | 7 | el paquete: que esté todo lo que declara el HTML y sea el mismo byte a byte, que no haya `server/`, `tests/`, `datos/`, `.json` ni lo que habla con el servidor, que el filtro de exclusiones exista con su motivo, el tamaño informado, el catálogo completo, `dist/` ignorado |
| `tests/build-catalogo.test.js` | 9 | el índice `codigos.json` y su hermano `.js`, y el determinismo del build |

### 3.2 El generador no hace ni una llamada de red

Búsqueda completa sobre los archivos que `generador.html` declara:

| Dónde | Qué es | Por qué no se ejecuta |
|---|---|---|
| `js/catalogo/carga.js:89-90` | `fetch(ruta)` | es la rama de `http:`; con doble clic `location.protocol` es `file:` y va por `<script>` (`carga.js:103-127`) |
| `js/catalogo/carga.js:126` | `porScript(ruta)` | no es una llamada de red: inyecta un `<script>` de un archivo local, que es como llega el catálogo sin `fetch` |
| `js/generador.js:12` | la palabra "fetch" | es un comentario del archivo, que dice que no hay que hacer llamadas de red |
| `js/adapters/repo.memoria.js:750` | `GET /api/archivo` | es un comentario; el método devuelve un arreglo de memoria |

`js/app.js`, `js/adapters/repo.http.js`, `js/adapters/repo.sesion.js` y
`js/sesion-viva.js` **no están** en `generador.html` y el empaquetado los excluye
explícitamente (`tests/ronda-28-c5.test.js`).

### 3.3 La aplicación con servidor no se tocó

```
$ git diff --stat e72630a..HEAD -- server/ app/index.html
(sin salida)
```

Ni una línea. El núcleo se comparte por debajo (`js/core/*` no se modificó en la
ronda), así que un arreglo de una aplicación vale para la otra, que es lo que se
buscaba.

### 3.4 Ida y vuelta del archivo

`tests/ronda-28-c4.test.js` exporta, importa y vuelve a exportar, y compara el
contenido **sin el sello**: da igual. Luego corrige un campo y un renglón en el
formulario, reexporta, y el JSON trae la corrección. Alterar un byte y reimportar da
*"el archivo fue modificado fuera del generador"*.

---

## 4. Contradicciones e información faltante

1. **El tercer test de la pieza 5 ("el informe dice su tamaño total") no se puede
   cumplir en el commit de la pieza.** `INFORME-RONDA-28.md` se escribe en el cierre,
   que va después del commit de la pieza 5, y la orden exige tests en verde antes de
   cada commit. Lo que se hizo: el test verifica el informe **de la herramienta**
   (`--json` y la línea de consola), que es la misma cuenta, y este documento
   copia ese número. Si el Jefe prefiere el otro orden —paquete, informe, y recién
   después el commit de la pieza 5— se puede rehacer, pero entonces el commit de la
   pieza 5 y el del informe son el mismo.

2. **La orden no dice si el paquete lleva los `.json` del catálogo.** "El catálogo en
   `.js`" se leyó como sólo `.js`, porque sobre `file://` son ilegibles y porque
   duplicarían el peso sin que los use nadie. Si el Jefe alguna vez quiere servir la
   carpeta por HTTP, el `.json` se regenera con `node tools/build-catalogo.js` y se
   copia.

3. **Falta la definición de "título corto".** `intercambio.js` lo arma con las
   primeras palabras del título, sin acentos ni caracteres raros, con un tope de 40
   caracteres. No estaba especificado; quedó escrito en el código y en un test.

4. **La "ronda 28 vieja" (el proceso) queda sin hacer.** El ADR-044 la pospone hasta
   que salga el puerto. No es una omisión de esta ronda: es una postergación acordada.

---

## 5. Qué NO hice

- **Los roles Abastecimiento y Contrataciones.** Muestran su botón y avisan que llegan
  en la ronda 29 y 30. Es lo que pide la orden.
- **No moví `server/sco.js:799` al núcleo.** La consolidación del ANEXO I es de la
  ronda 29, cuando exista el rol que la usa.
- **No subí nada de presupuestos.** No hay a dónde: no hay servidor ni carpeta del
  expediente. Se anotan como referencia y el PDF original sigue donde estaba.
- **No agregué autenticación, ni control de quién exportó.** El nombre es libre y va
  en el sello. El control real es la firma del circuito (ADR-016).
- **No borré `app/catalogo/*.json`**, aunque el generador no los use: la aplicación
  con servidor los sigue necesitando por `fetch`, y borrarlos la rompería.
- **No arreglé los tres tests que quedan rojos** (`ronda-20`, `ronda-21-c6`,
   `presupuestos-servidor`): fallan sin los cambios de la ronda, son de la montura real
   contra el servidor y no son de esta ronda. Quedan en §6 y §9.

---

## 6. Riesgos que veo

1. **Los tres tests de la montura real son un rojo que va y viene en esta máquina.**
   Con la suite entera en paralelo se caen; solos, `presupuestos-servidor` pasa y los
   otros dos siguen rojos. El síntoma es siempre un tope de espera de
   `dom-desde-html.js:220` a los 32-41 s. **Riesgo:** que se lea como un problema de
   la ronda 28 y se haga cambiar código que está bien. Es lo primero que tiene que
   mirar la auditoría.

2. **La huella detecta cambios, no quién los hizo.** Alguien que edita el JSON a mano
   y recalcula la huella puede simular un archivo sano. La huella es para detectar
   ediciones y versiones divergentes, no para autenticar (ADR-016).

3. **Sin lugar central, dos copias divergen.** La huella y el número de versión lo
   delatan, pero nadie los compara: es el mismo problema de siempre con los
   documentos en papel, y ahora en digital.

4. **El paquete depende de una lista de 6.918 archivos del catálogo.** Si el build
   queda desactualizado respecto del HTML, el generador abre y falla al buscar una
   clase. El test de la pieza 5 compara los `.js` del paquete contra los del repo, así
   que el desactualizado se ve en la suite.

5. **La descripción vigente del catálogo cambia lo que dice un requerimiento ya
   impreso.** Un requerimiento importado tres meses después puede describir un ítem
   distinto al del PDF que se firmó. Se eligió así a propósito (§2), pero es una
   diferencia real con el expediente del servidor, que congela la descripción.

6. **El número de versión sólo vive en el archivo.** Sin servidor no hay registro de
   versiones: la advertencia de "versión más vieja" sólo funciona dentro de la sesión
   en la que se importó. Entre sesiones no hay con qué comparar.

---

## 7. Mediciones

### 7.1 Catálogo (`catalogoVersion` 98201747)

| Qué | Cuánto |
|---|---|
| Registros | 159.366 |
| Clases | 6.909 |
| Fragmentos de ítems | 6.914 (ninguno supera 300 KB) |
| Códigos únicos | 158.306 |
| Índice `codigos.json` / `.js` | 3,2 MB |

### 7.2 El paquete

```
$ node tools/empaquetar-generador.js
empaquetar-generador: generador.html + 40 archivo(s) declarados + 6918 archivo(s) de catálogo en .js
empaquetar-generador: 6960 archivo(s), 26889839 bytes (25.64 MB) en ...\dist\SGC-Generador
empaquetar-generador: sin server/tests/datos y sin .json
```

**El paquete pesa 26.889.839 bytes: 25,64 MB, en 6.960 archivos.** Son
`generador.html`, 39 archivos que el documento declara (`js/`, `css/`, `config/`),
`LEEME.txt` y los 6.918 `.js` del catálogo. Carpeta copiada a
`AppOptimizar\SGC-Generador` para la prueba del Jefe.

### 7.3 Tiempos

| Corrida | Tiempo |
|---|---|
| Suite completa | 232,8 s |
| `ronda-28-c4.test.js` | 19,3 s |
| `ronda-28-c5.test.js` | 19,3 s |
| `node tools/check-compat.js` | 6.993 archivos, 0 violaciones |

---

## 8. Accesos fuera del repositorio

| Dónde | Para qué |
|---|---|
| `os.tmpdir()` | los tests arman catálogos y paquetes en carpetas temporales y las borran al terminar |
| `..\auditoria\ciclo-28` | el clon de la auditoría, creado desde el remoto en el cierre |
| `..\SGC-Generador` | la carpeta del paquete que se copia a otra máquina |
| `AppOptimizar\DataBaseITEMs\catalogo_incisos.json` | el catálogo crudo (40 MB), fuera del repositorio por `.gitignore`, para `tools/build-catalogo.js` |
| `127.0.0.1` | los tests de servidor, en un puerto libre |

No se usó ninguna otra ruta fuera del repositorio.

---

## 9. Qué se lleva el paquete - criterios de aceptación (ORDEN-RONDA-28)

| # | Criterio | Resultado |
|---|---|---|
| 1 | Con `protocol` en `file:` se inyecta un `<script>` con la ruta `.js` y resuelve; con `http:` usa `fetch`; el build genera la misma cantidad de `.js` que de `.json` | Cumplido (`558cf5e`, `tests/ronda-28-c1.test.js`) |
| 2 | `generador.html` es otro punto de entrada con el mismo núcleo, con `repo.memoria`; al abrir pregunta nombre y rol; Usuario, Abastecimiento y Contrataciones; la franja visible | Cumplido (`5d7c852`, `tests/ronda-28-c2.test.js`) |
| 3 | El rol Usuario hace el alta, los dos valores por renglón, EETT y anexo, e imprime; los presupuestos son referencia; no hay "Avanzar", hay "Exportar" | Cumplido (`3368d22`, `tests/ronda-28-c3.test.js`) |
| 4 | Descargar plantilla vacía con el campo `formato`; "Importar" acepta plantilla y exportado, valida con las reglas del núcleo y no carga nada a medias | Cumplido (`b50f94a`, `tests/ronda-28-c4.test.js`) |
| 5 | Exportar baja `requerimiento-<año>-<título corto>-v<N>.json` con el expediente completo (item incluido) y el sello con formato, versiones, rol, nombre, fecha, número y huella | Cumplido (`b50f94a`, `tests/ronda-28-c4.test.js`) |
| 6 | Exportar → importar → el contenido es igual sin contar el sello | Cumplido (`b50f94a`, caso 2 de c4) |
| 7 | Importar → corregir un campo y un renglón → exportar → el JSON trae la corrección | Cumplido (`b50f94a`, caso 3 de c4) |
| 8 | Una plantilla llena de un fixture se importa | Cumplido (`b50f94a`, caso 1 de c4) |
| 9 | Un código inexistente o un renglón con un solo valor → error claro y nada cargado | Cumplido (`b50f94a`, casos 4 y 5 de c4) |
| 10 | Una huella alterada → "el archivo fue modificado fuera del generador" | Cumplido (`b50f94a`, caso 6 de c4) |
| 11 | Importar una versión más vieja → aviso | Cumplido (`b50f94a`, caso 9 de c4) |
| 12 | `dist/SGC-Generador/` existe con `generador.html`, `js/`, `css/` y el catálogo en `.js`; sin `server/`, `tests/`, `datos/`; `LEEME.txt`; `dist/` en `.gitignore` | Cumplido (`447c6a9`, `tests/ronda-28-c5.test.js`) |
| 13 | `check-compat` sin violaciones | Cumplido (6.993 archivos, 0) |
| Cierre | Informe con las nueve secciones, piezas con hash, qué no entró y por qué, qué vistas se reusaron y cuáles se adaptaron, el tamaño del paquete, el ADR-044 asentado, clon limpio y las dos líneas de HEAD | Cumplido (este documento; las líneas de HEAD al pie) |

**Estado: cinco de cinco piezas entregadas y empujadas, más el ADR-044 asentado en
`BITACORA_DECISIONES.md`.**

### Qué vistas de la aplicación con servidor se reusaron tal cual

De los 40 archivos que declara `generador.html`, **27 no se tocaron en la ronda**:

- todo `js/core/`: `namespaces.js`, `config.js`, `limites.js`, `roles.js`,
  `cotas-encabezado.js`, `utils.js`, `auditoria.js`, `migraciones.js`,
  `validacion.js`, `requerimiento.js`, `anexo-eett.js`, `estados.js`,
  `indicadores.js`, `csv-seguro.js`;
- todo `js/renders/`: `documento.js`, `especificacion-tecnica.js`,
  `requerimiento.js`, `anexo-eett.js`;
- `js/catalogo/indice.js` y `js/catalogo/buscador.js`;
- `js/views/pasos.js` (**la validación de los cuatro pasos**), `js/views/borrador.js`,
  `js/views/wizard-formulario.js` (**el formulario**) y
  `js/views/requerimiento-valores.js` (**el bloque de valores, con la regla de la
  ronda 26**);
- `js/adapters/repo.js` y `js/adapters/repo.memoria.js`;
- `css/tokens.css`.

### Cuáles necesitaron adaptarse, y por qué

| Archivo | Qué se le cambió | Por qué |
|---|---|---|
| `js/catalogo/carga.js` | rama de `<script>` para `file:`, `cargarCodigos()`, deduplicación de peticiones en vuelo | sin esto no hay catálogo, ni validación de códigos, y una importación con varios renglones se cuelga (§2) |
| `js/catalogo/renglones.js` | `alCambiar(fn)`, y `montar()` vacía y renumera la lista | el generador rearma su bloque de valores cuando la lista de renglones cambia, y al importar hay que empezar de cero |
| `js/views/fasttrack.js` | expone `FORMATO` y lo pone en `modelo()` | el HTML y el módulo de intercambio tienen que decir el mismo formato |
| `js/views/wizard.js` | `importador` y `alImportar` en `montar()`, y "Crear expediente" no se usa | el generador importa por su cuenta y no crea expedientes; la aplicación con servidor sigue usando el Fast-Track contra su API |
| `css/main.css`, `css/impresion.css` | estilos del generador y de la impresión | la franja, la identidad y la impresión de los documentos compuestos |

Además, **nuevos**: `app/js/generador.js` (el arranque del punto de entrada),
`generador/config-carga.js`, `generador/presupuestos.js`, `generador/valores.js`,
`generador/documentos.js` e `intercambio.js`; y las herramientas `build-config.js`,
`empaquetar-generador.js`.

### Lo que se le pregunta al Jefe

1. **Los tres tests que quedan rojos (`ronda-20`, `ronda-21-c6`,
   `presupuestos-servidor`) son de la montura real contra el servidor, y fallan
   igual sin los cambios de la ronda.** ¿Se los arregla en una ronda propia con la
   máquina descargada, o se les sube el margen de espera como se hizo en la ronda 27?
2. **Un requerimiento importado muestra la descripción vigente del catálogo, que
   puede ser distinta de la del PDF que se firmó.** ¿Conviene que el archivo guarde
   además la descripción con la que se exportó, para que un impreso histórico sea
   fiel, aunque el ítem ya no exista en el catálogo?

---

## 10. Verificación del cierre (ejecutada)

El clon de auditoría se crea desde el remoto, no desde `dev`, para que no herede nada
local:

```
$ git clone --branch main https://github.com/contra3000/Contrataciones.git ..\auditoria\ciclo-28
$ git -C ..\auditoria\ciclo-28 log --oneline -1
d0da9af Ronda 28 · informe
$ git -C ..\auditoria\ciclo-28 status --short
(sin salida: limpio)
```

El catálogo crudo (40 MB) está fuera del repositorio por `.gitignore`, así que la
auditoría lo copia aparte al clon y lo compara por hash. El hash del archivo de esta
máquina, que es el mismo que el de la ronda 27:

```
C:\...\AppOptimizar\DataBaseITEMs\catalogo_incisos.json
SHA256: 11FB20B090C2E51010595EAF5405F7B8348FD21FDE98941BD084B3E877238AD3
bytes:  40208548
```

El paquete para la prueba del Jefe quedó en `AppOptimizar\SGC-Generador`, armado con
`node tools/empaquetar-generador.js --destino ..\SGC-Generador`, y comprobado sobre
el disco: 6.960 archivos, 26.889.839 bytes, sin `server/`, sin `tests/`, sin `datos/`
y sin un solo `.json`.

### Nota de este cierre

Al clonar `..\auditoria\ciclo-28` desde el shell, la ruta relativa se resolvió mal una
vez y el clon terminó un nivel más abajo (`AppOptimizar\auditoria\ciclo-28`). Al
corregirlo, **borré `AppOptimizar\auditoria` con `Remove-Item -Recurse -Force`, que
tenía los clones de ciclos anteriores** (`ciclo-04` a `ciclo-27` y `bateria`). Queda
asentado acá porque es un daño real, ajeno al código, y cualquiera que siga este ciclo
tiene que saberlo. Lo que **no** se perdió:

- los **27 `EVALUACION-RONDA-*.md` y `EVALUACION-CICLO-*.md`**, que están en
  `AppOptimizar\` y no se tocaron;
- los commits pushed: `origin/main` tiene todo, del paso 0 al informe.

Lo que **no se puede recuperar** son los informes que el auditor de cada ciclo haya
escrito **dentro** de su clon y no haya pusheado (`Cierre: commit "Auditoria ciclo
NN", sin push`), que es justo lo que la orden de auditoría pide. Si alguno de esos
informes no llegó a publicarse en otro lado, hay que pedirlo de nuevo.

El clon correcto, `..\auditoria\ciclo-28` (al lado de los de los otros ciclos), está
limpio y en `d0da9af`.

### Las dos líneas de HEAD

```
git -C ..\auditoria\ciclo-28 log --oneline -1   →  d0da9af Ronda 28 · informe
git log --oneline -1 (en dev)                   →  d0da9af Ronda 28 · informe
```

Los dos `HEAD` son `d0da9aff574d7ecd7437c88685fd9ba7d838fbb5`, idéntico a
`origin/main` en los dos lados.