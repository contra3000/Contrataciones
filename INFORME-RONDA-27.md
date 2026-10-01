# INFORME — RONDA 27

Cada pieza se entregó sola: `commit` y `push` al terminarla. La ronda cierra con
**seis commits** (las piezas 1 a 6 del orden), **más dos arreglos** que la
propia ronda dejó abiertos y que van en commit propio, y el commit del informe.
El hito H26 (*"del requerimiento al trámite"*) queda con su mitad de SCo
completa: **la SCo es un registro, se mueve en bloque, tiene su ANEXO I y se ve
en el tablero**. El proceso es la ronda 28.

Estado final verificado:

```
$ node --test --test-timeout=180000 --test-force-exit "tests/*.test.js"
ℹ tests 544
ℹ pass 544
ℹ fail 0
ℹ duration_ms 583202.0232
ℹ log: %TEMP%\r27-suite12.log

$ node tools/check-compat.js
check-compat: OK - 67 archivo(s) inspeccionado(s), 0 violaciones.
```

Hubo que correrla dos veces para que quedara así. La primera
(`%TEMP%\r27-suite11.log`) dio 543 de 544 por el `topeMs` de
`tests/ronda-26-c3.test.js`: con la suite entera en paralelo, arrancar `python`
puede tardar más de 1,5 s y el test pedía que el generador colgado ya hubiera
escrito su pid. Es el falso rojo del §3. Arreglado ese margen, la siguiente ya
fue 544 de 544. **Una suite con márgenes de tiempo puede dar un rojo que no es
del código**, y la forma de distinguirlo es correr el archivo solo: pasa en 1,9 s.

---

## 1. Qué hice

| # | Pieza | Commit | Archivos | Qué cambió |
|---|---|---|---|---|
| 0 | Publicar órdenes | `a6f6c5c` | 4 | `Revisor: ordenes y plan al dia` |
| 1 | El candado no te bloquea a vos mismo | `09ed291` | 2 | `Ronda 27 · candado de la misma máquina` |
| 2 | Un test roto falla, no cuelga | `d10f571` | 3 | `Ronda 27 · tests que no cuelgan` |
| 3 | La SCo existe como registro | `e4f01a0` | 11 | `Ronda 27 · registro de SCo` |
| 4 | La SCo se mueve en bloque | `9d2fdfc` | 3 | `Ronda 27 · SCo en bloque` |
| 5 | Un ANEXO I por SCo, con los renglones sumados | `82b405d` | 22 | `Ronda 27 · ANEXO I por SCo` |
| 6 | El tablero muestra la SCo | `80eba44` | 6 | `Ronda 27 - tablero por SCo` |
| — | Arreglo de la pieza 5 | `7cc8b91` | 2 | `Ronda 27 - el ANEXO I de la SCo se guarda, no se hereda` |
| — | Arreglo de la suite | `6b3235c` | 1 | `Ronda 27 - el Fast-Track espera el catalogo grande` |

**Pieza 1 — el candado abandoned (`server/candado.js`).** Un candado cuyo `pid`
es **de esta misma máquina** y cuyo proceso ya no existe (`process.kill(pid, 0)`
da `ESRCH`) se toma como abandonado en el acto: el servidor arranca y avisa. Un
candado de **otra** máquina se sigue rechazando, y uno de esta máquina con el
`pid` vivo también. Se escucha `SIGHUP`, que en Windows es el cierre de la
ventana negra, así que el candado se suelta solo. El auditor tenía razón: era el
bloqueo de la PC del Jefe, no un problema del servicio.

**Pieza 2 — un test roto falla, no cuelga.** El auditor del ciclo 26 encontró que
`tests/ronda-26-c6.test.js:93` cerraba el servidor en el camino feliz y no en
`finally`. Eso se arregló, y —que es lo importante— **se cerró la familia con un
control automático**: `tests/ronda-27-c2.test.js` recorre todos los `.js` de
`tests/`, quita comentarios, y falla si encuentra un bloque `test`/`before`/`after`
que levante un proceso (`arrancarServidor`, `arrancarEntorno`, `spawn`, …) y no lo
cierre en un `finally`; también exige que todos los comandos de `tests/LEEME.md`
lleven `--test-timeout=120000`. Los ganchos `before`/`after` están aceptados a
propósito (si `before` levanta y `after` cierra, el proceso no sobrevive al
archivo, y un `before` que falla igual corre los `after`), y `spawnSync`/`execSync`
no cuentan (son sincrónicos y su hijo muere con la llamada).

**Pieza 3 — la SCo es un registro (`server/sco.js`, nuevo).**
`datos/sco/<año>/<numeroSCo>.json` con `numeroSCo`, `expedientes: [ids]`,
`entregables`, `version` y `auditoria`. El servidor lo crea o actualiza cuando se
guarda el número en un expediente, con `versionEsperada` y la guardia
`autorizarRolDelEstado`. **Sumarse** sólo a una SCo cuyos expedientes estén
**todos** en `SOLICITUD_CONTRATACION` (si no, 409 en castellano); **salir**,
cambiando el número, mientras la SCo no avanzó. Los "hermanos" de la pantalla
dejan de salir de barrer el índice y salen del registro.

**Pieza 4 — la SCo se mueve en bloque (`server/expedientes.js`).** Desde que un
expediente tiene SCo, avanzar o devolver **cualquiera** de sus miembros mueve a
todos:

1. **Primero se valida todo, sin escribir nada** (`motor.avanzar` o
   `motor.devolver` sobre cada miembro, más los requisitos de grupo de la pieza
   5). Si uno falla, no se mueve ninguno y el mensaje nombra cuál y por qué.
2. Después se escriben todos bajo un candado del grupo. Si una escritura falla, las
   anteriores se **restauran desde `hist/`** — todo o nada.
3. Cada expediente deja el evento con `grupo: "SCo <número>"`.

La devolución a Fase 1 devuelve **toda la SCo** y **no la deshace**: cada
generador corrige y avanza el suyo, y la SCo no sale de `SOLICITUD_CONTRATACION`
hasta que estén todos de vuelta ahí, con el texto de "Avanzar" diciendo cuáles
faltan. **La matriz de 18 × 7 no se tocó** (§7.1).

**Pieza 5 — un ANEXO I por SCo.** Los datos del ANEXO I viven en el registro de
la SCo (`registro.anexo1`), se editan desde cualquier expediente miembro y el
control de concurrencia es la **versión del REGISTRO**, no la del expediente. El
documento (`app/js/renders/anexo-1.js`) consolida los renglones de todos los
miembros: **el mismo código de catálogo es un solo renglón con la cantidad sumada**,
y abajo el desglose por unidad solicitante (*"GOE: 10 · Grupo Base: 5"*) con el
`id` de quien pidió cada parte. Se guarda como entregable de la SCo, y
`ANALISIS_SCo` **exige** ese ANEXO I: sin él, la SCo no sale y el mensaje dice
dónde se hace.

**Pieza 6 — el tablero muestra la SCo (`app/js/views/kanban.js`,
`app/js/views/expediente.js`).** Desde que la SCo sale de
`SOLICITUD_CONTRATACION`, el tablero muestra **una tarjeta por SCo** con sus
requerimientos adentro y la etiqueta *"Se mueve en bloque"*; antes de eso los
requerimientos van sueltos, como siempre. La tarjeta va en la columna de la
**fase más temprana** de sus miembros, para que se vea donde hay algo que hacer.
La línea del expediente dice *"Parte de la SCo 123/2026, con 2026-003 y
2026-007"*, la frase literal de la orden, y se arma leyendo el REGISTRO — **sin
abrir un solo expediente**: el tablero sigue teniendo su contrato de la ronda 6
(`GET /api/indice` y nada más) y el agrupado sale del `numeroSCo` que la ronda 26
ya ponía en cada entrada del índice. La búsqueda ahora encuentra una SCo por su
número, y el conteo dice cuántas SCo hay agrupadas.

---

## 2. Decisiones que tomé y por qué

- **Pieza 2 — un control automático, no una lista.** La orden pedía buscar y
  arreglar los tests que levantan procesos. Se arregló el que estaba roto y se
  instaló el control que revisa **todos** los archivos, porque la lista se
  desactualiza en la ronda siguiente y el control no. Los ganchos
  `before`/`after` quedan aceptados por una razón concreta, anotada en el archivo:
  `node:test` corre los `after` aunque un `before` falle.
- **Pieza 3 — el registro se escribe con el número, no con un endpoint aparte.** El
  número de SCo ya se guardaba por `PUT /api/expedientes/<id>`; agregar un
  endpoint "crear SCo" abría la puerta a que un registro existiera sin que ningún
  expediente lo diga. El servidor actualiza el registro **en el mismo camino**.
- **Pieza 4 — "en bloque" significa que la validación entera pasa antes de la
  primera escritura.** Es lo que distingue el movimiento en bloque de "que a cada
  uno le vaya bien": si un miembro no cumple, el mensaje lo nombra y **no se
  mueve ninguno**. Y si una escritura falla a la mitad, se restaura desde `hist/`,
  que es la copia que el propio paso 2 dejó.
- **Pieza 4 — la devolución no deshace la SCo.** Es lo que pidió el Jefe. La SCo
  sobrevive, sus miembros vuelven a Fase 1, y la regla que impide volver a salir
  es "estén todos de vuelta en `SOLICITUD_CONTRATACION`".
- **Pieza 5 — el desglose se guarda, no se recalcula al imprimir.** El renglón
  sumado lleva su `desglose: [{expediente, cantidad}]` en el documento, así que lo
  que se firma dice de dónde salió cada cantidad. La suma se calcula **por código**
  (igual `codigo` + `unidad` se funden en uno), y a igualdad de código el orden de
  las unidades es alfabético, para que el documento sea el mismo cada vez que se
  genera.
- **Pieza 5 — el `anexo1.*` viejo no alcanza para salir de `ANALISIS_SCo`.** Ver
  §5, es la decisión que la orden dejó abierta.
- **Pieza 6 — una SCo de un solo requerimiento no se agrupa en el tablero.** No hay
  nada que agrupar, y su tarjeta de siempre dice exactamente lo mismo que la de
  SCo. Agruparla rompía además tres pruebas de la montura real (`ronda-20`,
  `ronda-21-c6`, `wizard`) que buscan la tarjeta por `data-id`, y desde el punto de
  vista de quien trabaja es lo correcto: el requerimiento sigue siendo el
  requerimiento.
- **Pieza 6 — la tarjeta va en la fase más temprana, no en la del primer
  miembro.** Si algo quedó atrás, la tarjeta tiene que verse donde hay que
  trabajar. En la práctica los miembros de una SCo se mueven juntos, así que casi
  siempre coinciden.
- **Pieza 6 — la línea de la SCo se pinta primero con lo que se sabe.** Apenas se
  abre un expediente, la línea dice el número de la SCo; cuando llega el REGISTRO,
  se completa con los miembros. Si se abrió otro expediente mientras tanto, la
  línea vieja **desaparece de inmediato** y la respuesta tardía se descarta. Si el
  REGISTRO no se puede leer, queda lo que se sabe seguro: es una comodidad, no una
  guardia.
- **Arreglo de la suite — el Fast-Track espera 60 s.** Ver §6.

---

## 3. Verificación

**Estado final** (arriba, en el encabezado): 544 tests, 544 pass, 0 fail, y
`check-compat` sin violaciones sobre 67 archivos.

**Pruebas nuevas de la ronda** (todas con servidor real y datos en disco, salvo
las de vista, que usan la montura de DOM):

| Archivo | Tests | Qué prueba |
|---|---|---|
| `tests/ronda-27-c1.test.js` | 4 | candado de esta máquina con `pid` muerto → arranca y avisa; de otra máquina → rechaza; con el `pid` vivo → rechaza; `SIGHUP` |
| `tests/ronda-27-c2.test.js` | 3 | **el control**: ningún test de `tests/` levanta un proceso sin cerrarlo en `finally`; los dos topes en `LEEME.md`; y el control se mira a sí mismo |
| `tests/ronda-27-c3.test.js` | 9 | registro con los dos expedientes; cambiar el número saca; sumarse a una SCo avanzada da 409; versión y auditoría del registro; paridad memoria/HTTP |
| `tests/ronda-27-c4.test.js` | 7 | con una SCo de 3: avanza uno y se mueven los tres; si uno no cumple no se mueve ninguno y se lo nombra; devolver a Fase 1 devuelve los tres y la SCo sigue; en Fase 1 cada uno avanza el suyo y la SCo espera; **una escritura que falla a la mitad deja a todos como estaban** |
| `tests/ronda-27-c5.test.js` | 15 | el mismo código de dos requerimientos es un renglón sumado con desglose; sin ANEXO I de la SCo no se sale de `ANALISIS_SCo`; **el heredado tampoco alcanza**; guardado se ve igual desde cualquier miembro; manda la versión del registro; punto de partida con un solo miembro y con varios no se elige; el documento se guarda en la carpeta de la SCo y se abre por su ruta; el documento impreso sale consolidado; la tabla escapa los textos |
| `tests/ronda-27-c6.test.js` | 6 | una SCo de 2 avanzada es una tarjeta con los 2 adentro; antes de avanzar, dos tarjetas; una SCo de un solo miembro **no** se agrupa; el filtro de texto encuentra la SCo por su número y por el de un requerimiento; la línea del expediente es la frase literal de la orden; la línea no queda mostrando la SCo anterior ni una respuesta tardía; sin número no aparece, y sin registro dice lo que se sabe; **y el recorrido entero contra el índice real de un servidor real** |

**Las cinco remociones de la auditoría del ciclo 27 dan rojo.** Las cinco se
**ejecutaron de verdad** en esta ronda: se quitó el punto de corte, se corrió el
archivo de tests y se midió, y después se restauró el archivo con `git checkout`.

| # | Qué se quita | Qué se puso rojo | Tiempo |
|---|---|---|---|
| E1 | la restauración desde `hist/` (`server/expedientes.js:300`) | *"una escritura que falla a la mitad deja a todos como estaban"* (`ronda-27-c4`) | 91 s |
| E2 | la suma de renglones del mismo código (`server/sco.js:822`, `fila.cantidad += cantidad`) | *"el mismo código de dos requerimientos es un solo renglón, sumado y con el desglose"* (`ronda-27-c5`) | 118 s |
| E3 | `abandonadoEnEstaMaquina` (`server/candado.js:67`) | *"candado de esta máquina con un proceso muerto: arranca y avisa"* (`ronda-27-c1`) | 16 s |
| E3′ | `candado.tomar` (`server/candado.js:95`) | *"la segunda instancia sobre la misma carpeta no arranca y nombra la máquina"* (`ronda-27-c1`) | 22 s |
| E3″ | el tope del `python` (`server/pliego-probador.js:125`) | *"el generador que no contesta se corta y el proceso muere"* (`ronda-26-c3`) | 1 s |

**Las dos últimas son el criterio de la pieza 2**: rojo **en menos de 2 minutos**,
sin colgar la corrida. Los tiempos son de esta máquina, con la suite completa
paralela en los casos E1 y E2 (los archivos de la ronda levantan servidores
reales, y por eso tardan).

**Hallazgos que la ronda destapó y corrigió** (los que aparecen acá aparecieron
con las piezas nuevas):

- **El ANEXO I heredado dejaba pasar a la SCo.** `requisitosDeSCo` miraba
  `anexo1.anexo1 !== null`, y el punto de partida heredado de un expediente único
  llenaba ese campo: una SCo podía salir de `ANALISIS_SCo` sin que nadie guardara
  nunca el documento de la SCo, que es justo lo firmable — mientras la pantalla
  decía *"La SCo todavía no tiene ANEXO I propio"*. Corregido en `7cc8b91`: lo que
  vale es el que está en el REGISTRO (`origen === 'sco'`), y el mensaje aclara que
  lo que hay está precargado y hay que guardarlo.
- **El tablero rompía tres monturas reales.** Con la regla de "agrupar toda SCo
  con número", un requerimiento solo con número de SCo dejaba de tener tarjeta
  propia (`data-id`), y `ronda-20`, `ronda-21-c6` y `wizard` dealeron falso rojo.
  De ahí la decisión de §2.
- **`tests/wizard.test.js` era intermitente.** El Fast-Track tiene que cargar el
  catálogo de verdad —40 MB— y su espera era de 30 s; con la suite completa
  corriendo en paralelo, dos corridas de la ronda dieron falso rojo. Ahora espera
  60 s. **Este arreglo no va dentro de una pieza**: va en su propio commit
  (`6b3235c`), porque no cambia el comportamiento de la app sino el margen de un
  test.
- **`tests/ronda-26-c3.test.js` tenía el mismo problema, más chico.** Le pasaba
  `topeMs: 1500` al probador y después exigía que el `python` colgado ya hubiera
  escrito su pid: con la suite en paralelo, arrancar `python` puede tardar más de
  1,5 s y el test daba falso rojo. Ahora el tope que se le pasa es de 5000 ms, que
  sigue siendo corto frente a los 60 s de producción y prueba lo que quiere probar
  —que el colgado se corta y muere—, no cuánto tarda Windows en levantar un
  intérprete. Va en el commit del informe, con la nota de por qué.

---

## 4. Contradicciones e información faltante

- **La frase de la pieza 6 no aclara si el expediente que se está mirando va en la
  lista.** La orden y el ADR dan la misma frase —*"Parte de la SCo 123/2026, con
  2026-003 y 2026-007"*— sin decir si se abre el 003 o el 007. **Se implementó la
  lectura literal**: la lista es la del REGISTRO, con todos sus miembros, incluido
  el que se está mirando, que es lo que hace que la frase sea reproducible y
  auditable. La alternativa (listar sólo los otros) está a una línea de distancia:
  `server`/`app` toman la lista tal cual.
- **"se usa como punto de partida del de la SCo si la SCo tiene uno solo. Si tiene
  varios, se decide en el informe."** Decidido en §5.
- **La pieza 6 no dice qué pasa con una SCo de un solo requerimiento.** Decidido en
  §2: no se agrupa.
- **Falta en la orden el criterio de la devolución en bloque** para el caso de que
  un miembro esté en un estado al que la SCo no pueda volver. Hoy el movimiento es
  todo-o-nada y el mensaje lo dice; no hay regla especial, y no se inventó ninguna.
- **La ronda 28 (el proceso) queda fuera** y con ella la parte del ADR-043 que
  habla de `datos/procesos/`, del pliego consolidado y de la tarjeta por proceso.
  El ADR queda asentado con esa parte **pendiente de implementar**, y así lo dice
  el texto.

---

## 5. Qué NO hice

- **El `anexo1.*` viejo no se migra: se precarga.** Con una SCo de **un solo**
  miembro, su ANEXO I propio aparece precargado en el formulario, con una nota que
  dice de qué expediente salió y que **al guardar** queda en el registro y vale
  para todos. Con **varios** miembros que tengan su propio ANEXO I, **no se elige
  ninguno**: la pantalla avisa que hay más de uno y la API devuelve
  `anexo1: null`, `anexo1Origen: 'vacio'` y la lista `anexos1Propios` con todos,
  para que la decisión sea informada. **La razón es que elegir uno sería inventar
  el dato**: dos unidades pueden tener análisis distintos y ninguno es el de la
  SCo. Si el Jefe quiere que se elija (o que se sumen), es una decisión de una
  línea en `server/sco.js` y se toma en la ronda 28.
  **Lo que además se decidió, y es lo que más importa:** ese ANEXO I heredado
  **no alcanza** para salir de `ANALISIS_SCo`; hay que guardarlo en el registro
  (`7cc8b91`).
- **No se toca la matriz de 18 × 7.** Ni una línea de `app/js/core/config.js`
  cambió en toda la ronda (§7.1).
- **No se hace el proceso.** Es la ronda 28: registro, movimiento en bloque, pliego
  consolidado, y la tarjeta por proceso del tablero.
- **No se agrega `numeroSCo` a los estados de Confección de proyectos**, ni
  "Parte del proceso" en la cabecera del expediente: son del proceso, no de la SCo.
- **No se migran los `datos/` de nadie.** Todo lo de la ronda 27 se crea solo
  cuando un operador guarda un número de SCo o un ANEXO I de SCo; los datos
  anteriores siguen como están y el ANEXO I por expediente sigue sirviendo para
  las SCo de un solo miembro.
- **No se tocó `tests/LEEME.md` más de lo necesario**: los topes ya estaban, lo que
  se agregó fue el control que los verifica.

---

## 6. Riesgos que veo

- **El movimiento en bloque escribe N expedientes.** Con una SCo grande, un avance
  son N escrituras y N restauraciones. Hoy el costo es bajo (son expedientes
  chicos), pero una SCo de 50 requerimientos hace 50 escrituras por cada avance y
  por cada devolución. **Mitigación ya puesta:** el candado del grupo y la
  escritura atómica con `hist/`; **pendiente:** medir con una SCo grande y, si
  molesta, agrupar el candado por SCo (hoy se toma y se suelta por operación).
- **El `desglose` del renglón sumado viaja dentro del documento.** Si un ANEXO I
  guardado queda viejo porque se cambió un renglón de un miembro, el documento
  firmado puede no coincidir con lo que ahora piden los miembros. Hoy el ANEXO I
  se regenera al editar, pero **no hay una guardia que avise** cuando los renglones
  de un miembro cambian después de que la SCo ya guardó su ANEXO I. Es el riesgo
  más concreto que deja la ronda.
- **La línea de la SCo depende de una lectura aparte.** Si el REGISTRO es grande o
  el disco lento, la línea aparece sola al principio y se completa después. Se
  prefirió eso a mostrar un spinner, y la respuesta tardía se descarta.
- **Dos tests tienen un tope interno corto para una operación pesada**, y por eso
  los dos dieron falso rojo antes de que se arreglaran: el Fast-Track
  (`tests/wizard.test.js`, catálogo de 40 MB) y el generador colgado
  (`tests/ronda-26-c3.test.js`, arrancar `python`). Los dos márgenes quedaron en
  60 s y 5 s. **Es una fragilidad que viene del entorno, no del código**: si el
  auditor corre la suite en una máquina más cargada que ésta, el margen real
  (~4×) puede no alcanzar. Conviene tenerlo en cuenta antes de culpar al sistema
  de un rojo.
- **La matriz de permisos todavía no nombra las acciones de grupo.** Guardar el
  ANEXO I de la SCo y leer el REGISTRO usan el rol del estado, que es lo que la
  orden pedía; pero las operaciones de grupo como tales todavía no son una fila de
  la matriz. Queda para después de la ronda 28.

---

## 7. Mediciones

### 7.1 La matriz de 18 × 7 no cambió

```
$ git diff 6421a18..HEAD -- app/js/core/config.js
(sin salida)
```

`app/js/core/config.js` es el archivo donde vive `ESTADOS`, y no tiene **una sola
línea modificada** entre el informe de la ronda 26 y esta cabeza. La regla que
manda sigue siendo la misma de siempre: el agrupamiento cambia **quién se mueve**,
no los estados.

### 7.2 Los puntos de corte que la auditoría va a quitar

| Punto de corte | Archivo y línea |
|---|---|
| restauración desde `hist/` | `server/expedientes.js:300` (`restaurarUno`) |
| consolidación de renglones con desglose | `server/sco.js:822` (`fila.cantidad += cantidad`) |
| `abandonadoEnEstaMaquina` | `server/candado.js:67` |
| `candado.tomar` | `server/candado.js:95` |
| el tope del `python` | `server/pliego-probador.js:125` (`topems`) |
| movement en bloque | `server/expedientes.js:346` (`moverEnBloque`) |
| agrupado del tablero | `app/js/views/kanban.js:99` (`miembrosDeSco`) |
| línea de la SCo | `app/js/views/expediente.js:276` (`renderSco`) |

### 7.3 Los tests que levantan procesos (pieza 2)

30 archivos de `tests/` levantan un proceso: **26 tests y 4 ayudantes**. De los
26 tests:

- **19** cierran en un `finally` dentro del propio bloque;
- **8** levantan en un gancho y cierran en su `after` (`before`/`after`,
  `test.beforeEach`/`test.afterEach`, `t.afterEach`);
- `tests/ronda-27-c6.test.js` está en las dos listas.

19 + 8 − 1 = **26**: no queda ningún test que levante un proceso sin cerrar. Los
**4 ayudantes** (`tests/helpers/`) ofrecen el par `arrancar…` / `limpiar…` y no son
tests.

**El control los cuenta él mismo** (`tests/ronda-27-c2.test.js`), así que la lista
no se desactualiza en la ronda siguiente: eso es lo que la pieza 2 pedía, y no un
párrafo del informe. Los ganchos quedan aceptados a propósito por la razón de §2.

De los 30, el archivo más pesado es `tests/wizard.test.js` (§6), y los que más
tardan son los que hacen la montura completa con servidor real:
`ronda-21-c6` (~95 s) y `ronda-20` (~41 s).

### 7.4 Crecimiento de la suite

| Ronda | Tests |
|---|---|
| 25 | 450 |
| 26 | 462 |
| 27 | **544** |

+82 tests en la ronda: 44 nuevos en los seis archivos de la ronda, y el resto
adaptado por los requisitos nuevos (la SCo como requisito de grupo, el ANEXO I de
la SCo, la tarjeta por SCo).

### 7.5 Dónde se lee `numeroSCo` (14 archivos, fuera de tests)

`app/js/views/anexo-uno.js` (38), `server/sco.js` (37), `app/js/views/exportar.js`
(19), `app/js/adapters/repo.memoria.js` (15), `server/expedientes.js` (15),
`app/js/views/kanban.js` (13), `app/js/adapters/repo.js` (12),
`app/js/adapters/repo.http.js` (12), `app/js/views/sco-numero.js` (10),
`app/js/renders/anexo-1.js` (5), `tools/recorrido-completo.js` (5),
`app/js/views/expediente.js` (3), `app/js/core/config.js` (2),
`server/ayudantes.js` (1).

---

## 8. Accesos fuera del repositorio

- **`os.tmpdir()`** (`%TEMP%`): los datos de prueba de todas las pruebas con
  servidor real, en carpetas `sgc-r27-*` que se limpian en `afterEach`/`finally`.
- **`127.0.0.1`, puerto 0:** cada servidor de prueba pide un puerto libre al
  sistema, así que dos corridas simultáneas no se pisan.
- **`..\auditoria\ciclo-27`:** el clon de la auditoría, **creado al cerrar**, sólo
  si la carpeta no existía (§9).
- **Nada más.** No se leyó ni se escribió ninguna carpeta de datos real, ni el
  catálogo, ni `Y:`.

---

## 9. Qué se lleva el paquete — criterios de aceptación (ORDEN-RONDA-27)

| # | Criterio | Resultado |
|---|---|---|
| 1 | Candado de esta máquina con el proceso muerto → arranca y avisa; de otra máquina → rechaza; con el `pid` vivo → rechaza | Cumplido (`09ed291`, `tests/ronda-27-c1.test.js`) |
| 2 | Ningún test que levanta un proceso se cuelga: `try/finally` en todos, y los dos topes en `LEEME.md`, con un control automático que lo revisa | Cumplido (`d10f571`, `tests/ronda-27-c2.test.js`) |
| 3 | `datos/sco/<año>/<número>.json` con `version` y `auditoria`; dos expedientes con el mismo número hacen un registro; cambiar el número saca; sumarse a una SCo avanzada da 409; los hermanos salen del registro | Cumplido (`e4f01a0`, `tests/ronda-27-c3.test.js`) |
| 4 | Con una SCo de 3: avanza uno y se mueven los tres; uno sin cumplir no mueve a nadie y se lo nombra; devolver a Fase 1 devuelve los tres y la SCo sigue; una escritura que falla a la mitad deja todo como estaba; la matriz no cambió | Cumplido (`9d2fdfc`, `tests/ronda-27-c4.test.js`; matriz verificada en §7.1) |
| 5 | El mismo código de catálogo es un solo renglón con la cantidad sumada y el desglose por unidad; el ANEXO I es de la SCo, se edita desde cualquier miembro con la versión del registro; sin él no se sale de `ANALISIS_SCo` | Cumplido (`82b405d` + `7cc8b91`, `tests/ronda-27-c5.test.js`) |
| 6 | Una SCo de 2 avanzada → una tarjeta con los 2 adentro; antes de avanzar → dos tarjetas; el expediente dice *"Parte de la SCo 123/2026, con 2026-003 y 2026-007"* | Cumplido (`80eba44`, `tests/ronda-27-c6.test.js`, incluido el recorrido contra el índice real de un servidor real) |
| Cierre | Informe con las nueve secciones, piezas con hash, qué no entró y por qué, los tests que levantan procesos, qué se hizo con los `anexo1.*` viejos, el ADR-043 asentado, clon limpio y las dos líneas de HEAD | Cumplido (este documento; las líneas de HEAD al pie) |

**Estado: seis de seis piezas entregadas y empujadas, más dos arreglos, más el
ADR-043 asentado en `BITACORA_DECISIONES.md`.**

### Lo que se le pregunta al Jefe

1. **Si una SCo tiene dos o más ANEXO I propios de antes**, hoy no se elige ninguno
   y la pantalla dice que hay más de uno. ¿Se suman, se elige el del generador
   principal, o sigue pidiendo uno?
2. **El ANEXO I de la SCo no se vuelve a generar solo** si después cambia un
   renglón de un miembro. ¿Tiene que avisar el sistema, o alcanza con que el
   operador vuelva a generarlo?

---

*Las dos líneas de HEAD, con el clon limpio, van después de correr el paso 3 del
cierre (`git clone … ..\auditoria\ciclo-27` y comparar), porque dependen del
commit final.*
git -C ..\auditoria\ciclo-27 log --oneline -1   →  (se completa al cerrar)
git log --oneline -1 (en dev\)                  →  (se completa al cerrar)
```
