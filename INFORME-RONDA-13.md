# INFORME - RONDA 13

## 1. Qué hice

Cerré la **ORDEN-RONDA-13**: las cuatro correcciones del ciclo 12, **H14 —
reuso de un expediente perfeccionado como base** (ADR-025) y **H19 — diálogo
de sugerencias del piloto**, más la corrección de los dos informes. Todo el
trabajo estuvo en el árbol sobre `3ba0b2c`; esta sesión lo terminó, verificó
y publica.

- **§2.1 — Neutralización de fórmulas en el CSV (ADR-031).**
  `views/exploracion.js` gana `neutralizarFormulas` y `lineasCSV`
  (exportadas puras para testear byte a byte): todo texto que empiece con
  `=`, `+`, `-`, `@` o tabulador lleva un apóstrofo delante, sin excepción y
  ANTES del escapado de coma/comilla. Misma forma que el YAML (ADR-031):
  neutralizar siempre, no detectar.
- **§2.2 — Eliminado `renders/pliego-bases-condiciones.js`.** Ningún estado lo
  exige y el entregable real de esa fase es `yaml-pliego`; el archivo quedó
  fuera del árbol con verificación (`node --check`, tests y check-compat).
- **§2.3 — Byte nulo en el YAML.** `pliego-yaml.js` escapa `\x00` como
  `\u0000` (ya estaba del trabajo previo); el test nuevo asegura que el
  emisor nunca produce un byte 0 literal y que el roundtrip contra PyYAML lo
  devuelve igual.
- **H14 — `server/base.js` (ADR-025).** Reuso por LISTA BLANCA: de un
  perfeccionado archivado viajan los 7 campos del renglón (código,
  descripción con fallback a `item`, cantidad, unidad, aclaración,
  cantidadMaxima, cantidadMinima) y 7 campos del expediente (objeto =
  `requerimiento.objeto || titulo`, justificación, condiciones particulares,
  rubro código/descripción, modalidad y procedimiento sugeridos). No viaja
  nada del hecho consumado: número, fechas, estado, auditoría, entregables,
  presupuestos, valores de referencia, imputación, precios. Los códigos se
  revalidan contra el catálogo vigente dentro del servidor; un ítem dado de
  baja se marca en la propuesta y bloquea el POST. El origen no se toca.
  Rutas: `GET /api/archivo/<id>/base` y `POST /api/expedientes/base`. El
  nuevo expediente persiste `basadoEn` y registra `registrarReuso`.
  Vistas: botón "Usar como base" en `views/archivo.js` (sólo cuando
  `entrada.estado === PERFECCIONADA`) y `views/usar-base.js` para revisar la
  propuesta y crear.
- **H19 — `server/sugerencias.js`.** Diálogo del piloto, no canal de
  asistencia: JSONL append-only `datosDir/sugerencias.jsonl`; "marcar como
  atendida" agrega una línea de cruce sin tocar la original; tope defensivo
  de 4000 sucesos (la 4001 se rechaza con aviso); contenido hasta 4000
  caracteres; email del operador obligatorio. Solamente los campos declarados
  entran (el resto se ignora). En el cliente, `views/sugerencias.js` sólo
  existe cuando `config/aplicacion.json` tiene `modoPiloto: true`: con el
  modo apagado el FAB ni siquiera se crea en el DOM (cero rastro, no un botón
  escondido). `views/sugerencias-jefe.js` lista, filtra, marca y exporta un
  Markdown con cada línea citada (`> `). `app.js` lee la config al iniciar.
- **Bug grave encontrado al cablear H19:** `sugerenciaDeRuta` devuelve
  `{id, accion}` y `servidor.js` lo pasaba como id a `apiAtenderSugerencia`
  (que compara contra strings) → marcar era 404 siempre. Corregido con el
  mismo patrón de expedientes (`desglose.id`); el test de "marcar agrega una
  línea" lo cubre.
- **Informes.** `INFORME-RONDA-12.md` recuperó las cuatro secciones que
  faltaban (§4 contradictás e información faltante, §5 qué NO hice, §6
  riesgos, §8 accesos fuera del repositorio) y se escribió `INFORME-RONDA-13.md`
  con las nueve.

## 2. Decisiones que tomé y por qué

- **La lista blanca es el contrato (ADR-025 §1): se copia lo que la orden
  enumera, nada más.** La propuesta se arma campo por campo desde
  `requerimiento` y los renglones; el expediente nuevo nace con `titulo` y
  `requerimiento` (los 7 campos), no duplica en `campos` porque los nombres
  del dominio difieren (`claseModalidad` vs `modalidadCompra`). El test
  afirma incluso el conjunto exacto de claves del renglón copiado
  (`['cantidad','codigo','unidad']`).
- **La revalidación corre en el servidor, no sólo en la vista.** El catálogo
  era cliente; `cargarCatalogo` se expuso en `entorno` y el servidor vuelve a
  consultar el catálogo vigente al leer la base y al crear. Un código dado de
  baja se marca (`dadoDeBaja`) en la propuesta y el POST completo se rechaza:
  nunca se copia en silencio (ADR-025 §4).
- **Elegibilidad: PERFECCIONADA y `archivado: true`.** La orden decía "un
  expediente perfeccionado"; el cierre real deja la marca de archivo en la
  misma transición, así que exigir ambas cosas es leer el sistema, no
  complicarlo. Un expediente en trámite da 400 con el estado a la vista.
- **El JSONL de sugerencias es append-only por diseño, y la vista del Jefe no
  tiene bóton de borrado.** Nada se edita ni se borra retroactivamente; la
  "atención" es un cruce de líneas al leer. Es el mismo criterio del registro
  de eventos (ADR-024) y hace que el tope de 4000 sea el único freno.
- **Modo piloto apagado = el elemento no existe.** No un `display:none`: si
  `modoPiloto` no es `true` `montar()` no ejecuta nada y el DOM queda sin
  botón ni panel (paneles() = 0). Menos superficie para un operador común que
  nunca debió ver el diálogo, y menos camino de fuga de contexto.
- **La neutralización CSV es preventiva (ADR-031) y va antes de escapar
  comas.** Si se escapara primero, el apóstrofo entraría dentro de las
  comillas y Excel igual lo vería como cadena; la forma `'=...` es la que la
  planilla muestra sin ejecutar. El test lo verifica byte a byte.
- **El byte nulo del YAML se escapa y nunca se emite literal** (`\u0000`):
  un `\x00` en un `.yaml` puede romper parsers externos o herramientas de
  tránsito; el dato se conserva en el roundtrip.

## 3. Verificación

- **Suite completa**: `node --test` desde la raíz → **330 tests, 0 fallos,
  una sola pasada** (~184 s). Ronda 12 cerró en 315: +15 (ronda-13.test.js).
- **Guardián**: `node tools/check-compat.js` → **57 archivos, 0 violaciones**.
- **Límite de 400 líneas en `app/` y `server/`**: ninguna supera (mayores:
  `views/expediente.js` 399, `adapters/repo.http.js` 395, `servidor.js` 380).
- **Lo que prueba el archivo nuevo (15 tests):**
  | Tema | Casos |
  |---|---|---|
  | §2.1 CSV | 5 prefijos neutralizados byte a byte; el dato se conserva; la coma se escapa |
  | §2.2 eliminado | `pliego-bases-condiciones.js` no existe; ningún estado lo exige |
  | §2.3 YAML nulo | sin byte literal; `\u0000` en la salida; roundtrip devuelve el byte |
  | EETT | ficha del anexo sin "Cantidad" |
  | H19 vista | modo piloto off = sin nada en el DOM; on = FAB+panel con cero innerHTML (ADR-011); `pantallaActual` y `recogerContexto` |
  | H19 Jefe | `aMarkdown` cita cada línea con `> ` |
  | H14 vista | botón "Usar como base" sólo en el perfeccionado, con `onUsarBase` |
  | config | `aplicacion.json` con `modoPiloto: false` |
  | H19 servidor | validación (email, contenido vacío/4001); append-only con 20 concurrentes; marcar = +1 línea y cruce; 404/400; tope 4000 |
  | H14 servidor | GET base con código dado de baja marcado y POST bloqueado; creación 201 con `basadoEn` y `reuso_base`; whitelist exacta; 400/404 de controles negativos |

## 4. Contradicciones e información faltante

- **La orden no definía el tope del diálogo de sugerencias** (sólo que "hay
  un tope defensivo"). Tomé 4000 sucesos, en la misma línea del espíritu del
  registro de eventos; la vista del Jefe avisa cuando `completo` es falsa. Si
  el tope oficial fuera otro, es una constante en `server/sugerencias.js`.
- **"El catálogo vigente" quedó definido como la versión que el servidor
  tiene cargada** (`cargarCatalogo()`), la misma de `GET /api/catalogo`. La
  orden presumía ese cableado; estaba sólo del lado cliente y hubo que
  exponerlo (un cambio de forma, no de comportamiento: misma carga local).
- **El árbol traía un commit anterior marcado "Ciclo 13-ADR-032 plantillas,
  R17 cerrado, H19 y H20"** (rama main). Esta ronda trabaja únicamente la
  ORDEN-RONDA-13 (H18/H20 explícitamente fuera de alcance); ese trabajo
  previo no se toca ni se mezcla.
- **Dónde se lee la base**: `GET /api/archivo/<id>/base` lee el `datos.json`
  del original marcado archivado (misma forma que el Archivo Histórico, que
  es un snapshot de ese mismo archivo). Es una decisión mía razonable; la
  orden no la especificaba. El forma histórica queda intacta y sin escritura.
- **Informe-12 §2 línea 25 dice que `pliego-bases-condiciones.js` era "código
  muerto" que ya no se cargaba**; la orden 13 lo mandó borrar y quedó fuera
  del árbol: la línea histórica se conserva y sólo se corrigió el §7-§10 del
  propio informe (qué NO hice, riesgos, accesos).

## 5. Qué NO hice

- **No toqué la documentación de sólo lectura**: ADR-021 a ADR-031 y las
  órdenes; sólo leí.
- **No restringí por rol el acceso a los eventos crudos** (arrastra de la
  ronda 12): `GET /api/eventos` sigue sirviendo sin diferenciar Jefe de
  operador; la frontera es la advertencia de la vista (ADR-024 §3.7).
- **No subí ningún límite**: tope de sugerencias 4000, contenido 4000,
  tamaño de cuerpo 4 MB. Quedan como están.
- **No agregué un canal real de asistencia**: la sugerencia es un registro en
  pantalla para el Jefe; no hay correo, impresión ni base de datos.
- **No generé el Pliego de Bases y Condiciones real**: la vista previa sigue
  siendo vista previa (ADR-030), y `pliego-bases-condiciones.js` se borró en
  vez de migrarlo a algo nuevo.
- **No corrí contra producción**: carpetas temporales y `127.0.0.1` puerto 0,
  siempre.
- **No toqué estilos del dominio**: las vistas reutilizan clases existentes
  (`fab-sugerencia`, `sugerencia-*`, `archivo-base`, `doc-renglones`).

## 6. Riesgos que veo

- **La suite sigue creciendo y ya cuesta ~3 minutos** (levanta el servidor
  real varias veces por ronda). Una pasada verde hoy, pero cada agregado la
  hace más lenta; el H14 camina el circuito completo dos veces y es el más
  pesado (~50 s).
- **El conteo de `innerHTML` del dom de prueba es transparente**: si una
  vista nueva inyectara HTML y no hubiera test que la monte, el cero no se
  rompe solo. El patrón queda en manos del código de cada ronda.
- **Las sugerencias llevan fragmentos de los expedientes en uso** (contexto
  automático + contenido del operador) y quedan en el archivo plano del
  servidor; el export del Jefe lo advierte antes de descargar. No hay
  cifrado en reposo (igual que el resto del ciclo).
- **La revalidación depende del catálogo que el servidor tenga al momento**:
  si el catálogo cambiara entre la lectura y el POST no cambia el resultado
  (se revalida en ambos), pero sí depende de la carga local, no de un
  servicio externo.
- **El FAB es un botón "?" flotante**: es de ayuda, pero si el piloto
  termina y alguien prende `modoPiloto` con datos reales, el diálogo aparece
  de inmediato. La config es local y se define por despliegue.

## 7. Mediciones

**Tests:** 330 totales, 0 fallos, una sola pasada (~184 s). Sin skipped salvo
el intencional de `build-catalogo.test.js` sin `datos-prueba/`.

**Nuevos en esta ronda (líneas con blancos incluidos):** `server/base.js` 239,
`server/sugerencias.js` 193, `app/js/views/sugerencias.js` 235,
`app/js/views/sugerencias-jefe.js` 230, `app/js/views/usar-base.js` 203,
`config/aplicacion.json` 6, `tests/ronda-13.test.js` 612 (sin límite para
tests).

**Modificados (principales):** `server/servidor.js` 380 (rutas base y
sugerencias, `conCuerpo`, fix del desglose), `server/ayudantes.js` 336
(`archivoBaseDeRuta`, `sugerenciaDeRuta`), `server/eventos.js` 266
(+`registrarReuso`), `server/manejadores.js` 195 (exporta `cargarCatalogo`),
`app/js/adapters/repo.http.js` 395 (+`errorDelServidor` y 5 métodos),
`app/js/views/expediente.js` 399 (+`basadoEn`), `app/js/views/archivo.js` 124
(+botón base), `app/js/views/wizard.js` 373 (+`pasoActual`),
`app/js/views/exploracion.js` 270 (+CSV neutralizado), `app/js/export/pliego-yaml.js`
107 (escape `\x00`), `app/js/app.js` 234 (modo piloto y navegación del Jefe),
`app/index.html` (secciones y scripts nuevos).

**Tiempos:** suite completa ~184 s; check-compat < 1 s.

## 8. Accesos fuera del repositorio

- `os.tmpdir()` para las carpetas de datos de los tests y de los informes de
  verificación (creadas y eliminadas por corrida).
- `127.0.0.1` con puerto 0 (asignado por el sistema) para los servidores de
  prueba.
- `yaml_roundtrip.py` (tests/helpers) invoca el `python` del sistema con
  PyYAML para el roundtrip del emisor YAML (ADR-031); no instala nada.
- Nada más: cero dependencias de npm, cero redes externas.

## 9. Correcciones arrastradas

- **§2.1 — CSV neutralizado.** La inyección de fórmulas que la orden detectó
  quedó corregida con apóstrofo preventivo, byte a byte en el test.
- **§2.2 — Archivo huérfano eliminado.** `pliego-bases-condiciones.js` fuera
  del árbol; verificaciones en verde.
- **§2.3 — Byte nulo del YAML.** Escapado y verificado con roundtrip real.
- **Informe-12 completo.** Las cuatro secciones faltantes (§4, §5, §6 y §8)
  están escritas y con contenido honesto del cierre de esa ronda.
- **Informe-13 con las nueve secciones.** Éste.