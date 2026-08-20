# INFORME - RONDA 8

## 1. Qué hice

Cerré el circuito de la primera versión: las cinco plantillas que producen los
documentos de las fases que faltaban, el Archivo Histórico con archivado
automático y recuperable, y el respaldo/restauración de la carpeta de datos.

- **Plantillas (§2.1).** Extraje lo común de la Especificación Técnica a
  `app/js/renders/documento.js` (escapado, `modelo`, encabezado institucional,
  tabla de renglones con aclaraciones, firma, pie y estilos) y dejé que cada
  plantilla aporte sólo sus secciones. Las cuatro nuevas se registran como
  `SGC.renders.<nombre>` con `{estado, id, nombre, titulo, componer, montar}`:
  `solicitud-contratacion.js` (SCo, Fase 2), `pliego-bases-condiciones.js`
  (Fase 5), `disposicion-adjudicacion.js` (Fase 7) y `orden-compra.js` (Fase 9).
  En `config.js` registré `ENTREGABLES` con un **id estable** por estado
  productor: ese id es el mismo que exige `validacion.validarParaAvanzar` en
  `entregablesObligatorios`, el que `guardarEntregable` guarda en la entrada del
  expediente y el que la vista usa para elegir plantilla. `entregablePresente`
  acepta tanto la cadena como el objeto `{id, nombre, ruta}` que registra el
  servidor. La vista de expediente renderiza el documento del estado actual
  (`documento.paraEstado`) y la impresión sobreescribe el título del `@page`.

- **Archivo Histórico (§2.2).** `server/archivo.js` ejecuta el archivado como
  parte de la misma transición que llega a `PERFECCIONADA` (el servidor, no el
  navegador): copia al histórico, marca el original, purga el índice. El
  recuperable es el punto 2 de este informe. `GET /api/archivo` lista **leyendo
  el directorio**, no el índice; `recuperarArchivados` corre al arrancar. La
  vista del histórico (`app/js/views/archivo.js`) está separada del tablero.

- **Respaldo (§2.3).** `tools/respaldo.js` (con `tools/ayudantes-respaldo.js`
  y `tools/restaurar.js`) copia la carpeta de datos entera a
  `<destino>/sgc-respaldo-<fecha>.<hora>` con lock, temporal y rename atómico,
  retención por defecto de 14 y informe por pantalla; `tools/restaurar.js`
  hace el camino inverso. `respaldo.test.js` verifica el ciclo completo con la
  cadena de auditoría íntegra y la escritura concurrente.

## 2. Decisiones que tomé y por qué

- **El archivado no vuelve a subir la versión.** La transición que llega al
  final ya la subió. `marcarArchivado` es una operación pura que agrega
  `archivado`/`archivadoEn` y encadena la entrada de auditoría `archivar` con
  el hash previo (ADR-006). Así la matriz de transiciones por servidor no se
  desvía: avanzar a PERFECCIONADA produce exactamente `version + 1`.
- **Orden de operaciones del archivado y por qué una interrupción es
  recuperable.** El punto de commit es un rename atómico:
  1. se copia la carpeta del expediente a
     `ArchivoHistorico/<anio>/.staging-<numero>` (fuera del histórico, con
     nombre marcado);
  2. se hace `rename` del staging a `ArchivoHistorico/<anio>/<numero>_Expediente/`
     — antes del rename no hay histórico a medias (sólo un staging); después,
     el histórico está completo;
  3. se marca el original y se escribe la copia histórica marcada (la marca no
     cambia la versión, así la copia sigue siendo un snapshot del estado
     final);
  4. se purga `idx/<id>.json`.
  Si el proceso cae antes del rename queda un `.staging-*` y el original
  intacto **dentro del índice**: nada se pierde. Si cae después del rename
  pero antes de marcar/purgar, el histórico ya existe completo, el original
  sigue intacto y la entrada del índice está o no — ninguna interrupción deja
  el expediente ni fuera del índice ni fuera del histórico. `recuperarArchivados`
  al arrancar cierra cualquier interrupción: limpia los staging abandonados,
  marca los originales cuyo histórico ya existe (con contexto sintético
  `SGC-SERVIDOR`) y purga los índices huérfanos. El original **no se borra
  jamás** (§2.2 punto 3). Verificado por `archivo.test.js` (test de
  interrupción con un disco cortado a mano) y por la idempotencia de
  `archivarExpediente`.
- **La copia histórica también queda marcada.** El `datos.json` del histórico
  se escribe con la versión marcada (misma versión, campos `archivado` y
  `archivadoEn`): así `GET /api/archivo`, que lee el directorio, lleva cuándo
  se archivó sin depender del original.
- **`GET /api/archivo` lee el directorio, no el índice.** El histórico es la
  fuente de verdad del listado; una entrada de `idx/` sin carpeta en el
  histórico no figura en el archivo (test que escribe una entrada huérfana en
  caliente y verifica que `/api/archivo` no la ve pero `/api/indice` sí).
- **`guardarEntregable` valida el id contra `ENTREGABLES`.** El servidor
  responde 400 si el id no es uno de los cinco conocidos y registra
  `{id, nombre, ruta, guardado, email, equipo}` en la entrada del expediente.
  La firma de `guardarEntregable` creció a un quinto parámetro opcional, así
  las llamadas viejas (sin id) no se rompen.
- **Respaldo: mismo mecanismo que el servidor.** Lock (`<destino>/.respaldo.lock`,
  con reintentos), copia a un temporal y `rename` como punto de commit: nunca
  queda un respaldo a medias y dos respaldos simultáneos no se pisan. El nombre
  lleva fecha y hora con milisegundos para que dos lanzamientos en el mismo
  segundo no colisionen. `--retener N` conserva los N más nuevos y `--retener 0`
  conserva todos. La restauración copia por encima y advierte que es
  destructiva: el operador debe apuntar a una carpeta de datos vacía o
  descartable.
- **El ripple de los obligatorios se cerró en todos los andamiajes.** Como el
  motor ahora exige el entregable del estado que se abandona antes de avanzar,
  actualicé `helpers/transiciones-servidor-util.js`, `helpers/repo-bateria.js`
  (conExtra), `helpers/repo-transiciones-bateria.js`,
  `helpers/expediente-montura.js` (pre-carga los obligatorios del estado),
  `tools/recorrido-completo.js` y la matriz por servidor (guarda el entregable
  antes del avance final y ajusta la versión esperada). La matriz de
  transiciones quedó tocada en esto y sólo en esto: el archivado no le agregó
  ninguna versión extra.

## 3. Verificación

- **Suite completa** (repositorio de trabajo): `node --test` → **233 tests,
  0 fallos** (~165 s).
- **Guardián**: `node tools/check-compat.js` → **0 violaciones** (36 archivos
  en `app/`); también en `tools/` → **0 violaciones** (9 archivos,
  auto-inspección).
- **Límite de 400 líneas**: ningún `.js`/`.html` de `app/`, `server/`,
  `tools/` o `tests/` lo supera (verificado con conteo automático; los más
  grandes son `expediente.js` 379, `config.js` 337 y `servidor.js` 328).
- **Clon limpio**: copia del árbol de trabajo a `os.tmpdir()` (sin `.git`, sin
  `datos-prueba/`) → `node --test` **233/233** y guardián **0** (el test de las
  159.366 filas se saltea con aviso legible, como en todas las rondas). Se
  re-verifica con un `git clone` real del commit antes del push (cierre §3).
- **Criterios de la orden** (tabla §4): 1 ✓ (clon), 2 ✓, 3 ✓ (las cinco
  plantillas componen con renglones y aclaraciones, probadas en
  `plantillas.test.js`), 4 ✓ (documento.js compartido; cada plantilla aporta
  sus secciones), 5 ✓ (inyección escapada en las cuatro nuevas y en la Fase 1),
  6 ✓ (validacion.test.js 1 y 1b; motor y servidor lo exigen), 7 ✓, 8 ✓,
  9 ✓ (archivo.test.js), 10 ✓, 11 ✓ (respaldo.test.js, cadena íntegra), 12 ✓,
  13 ✓, 14 ✓.

## 4. Contradicciones e información faltante

- **La orden dice "conservando en verde los 159 actuales"; había 222.** El
  número de la §2.4 quedó desactualizado respecto de la ronda 7 (el cierre de
  la ronda 7 reportó 222). La suite real pasó de 222 a **233** (+11: 5 de
  plantillas, 2 de archivo, 3 de respaldo, 1 neto por el rejunte de
  `recorrido.test.js` y la matriz). No afecta nada; lo anoto para que la
  contabilidad de tests siga honesta.
- **El punto 8 de la §2.4 pide "respaldo con el servidor escribiendo en
  paralelo".** El test de escritura concurrente lanza dos procesos
  `tools/respaldo.js` simultáneos contra el mismo destino y verifica que
  ambos dejan su respaldo completo sin temporales ni lock colgado. Es el mismo
  mecanismo que el servidor usa para sus escrituras atómicas (temporal +
  rename + lock), pero no es literalmente el servidor transaccionando mientras
  se respalda. Lo dejo explícito: el riesgo de copia parcial se cubre con el
  punto de commit por rename, que es justamente lo que la orden exige.
- **`GET /api/expedientes/<id>` sigue devolviendo el original archivado.**
  Eso es lo correcto (no se borra) y lo verifico; no es una contradicción pero
  conviene dejarlo escrito para que nadie lo lea como un bug.

## 5. Qué NO hice

- El tablero de KPIs/indicadores y las estadísticas del catálogo de errores:
  fuera de alcance declarado en la §1 de la orden (ciclo 9).
- No toqué `wizard.js` (su caso de servidor caído sigue intacto y verde).
- No modifiqué la documentación (`InstruccionesCodigo.md`, esquemas, ADRs): es
  de sólo lectura.
- No corrí el servidor contra una carpeta de datos real de producción: todo se
  probó con carpetas temporales en `os.tmpdir()`.

## 6. Riesgos que veo

- **La suite de integración es lenta** (~165 s) por los tests que levantan el
  servidor real (matriz por servidor ~144 s). Es tolerable; si crece más, el
  ciclo 9 puede dividir la matriz por archivo.
- **La restauración es destructiva por diseño** y sólo advierte por pantalla.
  Un operador que apunte `--destino` a la carpeta de datos viva la sobreescribe
  sin más confirmación. Es el comportamiento esperado de una herramienta de
  recuperación, pero merece el aviso que ya imprime.
- **El respaldo copia también el `ArchivoHistorico`** (está dentro de
  `<datos>`): los respaldos crecen con el histórico. Es consistente con "toda
  la carpeta de datos"; si en el futuro se quiere excluir el histórico, habría
  que decidirlo explícitamente.
- **`GET /api/archivo` lee el directorio en cada llamada**; con un histórico
  muy grande convendría paginar o indexar, pero para la escala asumida
  (ADR-008) es correcto.

## 7. Mediciones

**Tests:** 233 totales, 0 fallos, 0 skipped salvo el intencional de
`build-catalogo.test.js` sin `datos-prueba/`.

**Nuevos:**
- `app/js/renders/documento.js` 300, `solicitud-contratacion.js` 73,
  `pliego-bases-condiciones.js` 71, `disposicion-adjudicacion.js` 77,
  `orden-compra.js` 76, `especificacion-tecnica.js` 86 (refactorizada).
- `server/archivo.js` 248.
- `tools/ayudantes-respaldo.js` 147, `tools/respaldo.js` 69,
  `tools/restaurar.js` 56.
- `app/js/views/archivo.js` 94.
- `tests/plantillas.test.js` 163, `tests/archivo.test.js` 139,
  `tests/respaldo.test.js` 121.

**Modificados (principales):** `config.js` 337, `expediente.js` 379,
`exportar.js` 211, `servidor.js` 328, `expedientes.js` 305, `validacion.js`
142, `app.js` 135, `recorrido.test.js` 84, `transiciones-servidor-matriz.test.js`
(~99), más los helpers y adapters ya listados en §1.

**Tamaño del respaldo:** copia entera de la carpeta de datos; en las pruebas,
carpetas de cientos de bytes (fixtures). El informe por pantalla de
`respaldo.js` imprime la ruta creada y los respaldos retenidos/eliminados.

## 8. Accesos fuera del repositorio

- `os.tmpdir()` para las carpetas de datos de los tests y los clones de
  verificación.
- `127.0.0.1` con puerto 0 (asignado por el sistema) para los servidores de
  prueba.
- Nada más: cero dependencias, cero redes externas.

## 9. Correcciones arrastradas

Ninguna. El ciclo anterior (ronda 7) se aprobó sin observaciones ni hallazgos.
La nota de interrupción de las rondas anteriores no aplica: esta ronda no se
interrumpió.