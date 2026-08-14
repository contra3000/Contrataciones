# INFORME — RONDA 5

## 1. Qué hice

- **Correcciones arrastradas (§2)**: los seis hallazgos de la auditoría. Detalle línea por línea en §9. Se hicieron primero, antes de cualquier pieza nueva, y cada una tiene su verificación dedicada.
- **`app/js/views/pasos.js`** — la lógica pura del wizard (sin DOM y sin red). Define los cuatro pasos, `validarPaso` (identificación, renglones, fundamentación, revisión), `datosParaPersistir`, `resumen`, `aclaracionesValidas` y `persistir`. No contiene reglas de validación: consulta `SGC.core.validacion` y, para la existencia del código, `SGC.catalogo.indice.codigoExiste`. `persistir` llama `repo.crearExpediente` y devuelve `{ok, id}` o `{ok:false, error}` sin lanzar nunca; el borrador se limpia sólo tras el alta exitosa (§3.3).
- **`app/js/views/borrador.js`** — borrador en `sessionStorage` (nunca localStorage), clave `sgc.borrador.v1`, con `operador`, `guardado` y `datos`. El storage es inyectable (interfaz `getItem/setItem/removeItem`) para probarlo en Node. `leer` devuelve `null` ante JSON corrupto; nunca lanza (§3.2).
- **`app/js/views/fasttrack.js`** — Fast-Track puro: `modelo()` devuelve el JSON de ejemplo descargable; `importar(texto, verificarCodigo)` trata el archivo como entrada no confiable — valida estructura y tipos campo por campo, rechaza los códigos que no existen en el catálogo vigente (listándolos), rechaza aclaraciones de más de 200 caracteres y nunca deja un formulario a medio llenar; los errores son un listado legible, no una excepción (§3.4).
- **`app/js/views/wizard.js`** (398 líneas) — la orquestación: selección de operador, cuatro pasos con validación estricta antes de avanzar, errores junto al campo (con `role="alert"`) y en un resumen con `aria-live`, retroceder sin perder lo cargado, borrador (ofrecer / retomar / descartar), Fast-Track por `FileReader`, descarga del modelo, persistencia del paso 4, foco en el primer campo de cada paso y `aria-current` en la navegación. No define reglas de validación.
- **`app/index.html` y `app/js/app.js`** — la pantalla pasó a ser la aplicación (§3.5): selección de operador con nombre, apellido, rol y correo desde `config/usuarios.ejemplo.json` (ADR-017); el buscador del ciclo 4 embebido en el paso 2; scripts en el orden de dependencias. `app.js` arranca padrón, catálogo, buscador y wizard, y conecta el auto-guardado del borrador ante cambios de renglones.
- **`app/js/catalogo/renglones.js`** — extraído de `buscador.js` (regla de ≤400 líneas): la lista de renglones con su editor, validación en vivo y `onCambio` para el auto-guardado. `buscador.js` quedó en 331 líneas y delega en él.
- **`server/servidor.js`** — el padrón vive en `config/`, fuera de `app/`, así que se sirve por `GET /config/*` con guardia de recorrido de rutas (`estaDentro`), 400/403/404 y MIME; se enruta antes de los estáticos.
- **`codigos.json` + `cargarCodigos`** — `tools/build-catalogo.js` ahora emite `app/catalogo/codigos.json` (arreglo plano y ordenado de los 159.366 códigos) y `indice.cargarCodigos(lista)` lo carga a un `Set`; `carga.cargarCodigos()` lo baja de forma perezosa, sólo cuando el usuario importa un archivo (§3.4).
- **Tests** — `tests/wizard.test.js` (5 casos, ver §3.6) con un DOM mínimo propio (`tests/helpers/dom-stub.js`), `tests/servidor.test.js` suma el caso de `/config/`, `tests/build-catalogo.test.js` y `tests/catalogo.test.js` se reescribieron para las correcciones §2.1 y §2.2.
- **`README.md`** — el arranque sigue siendo un comando; describe la selección de operador, los cuatro pasos, el Fast-Track, el borrador y qué se espera ver.
- **`INFORME-RONDA-05.md`** — este informe.

## 2. Decisiones que tomé y por qué

- **Los tramos de coincidencia se refieren a dos cadenas distintas, y el contrato quedó explícito en el código.** El buscador matchea sobre `rubro + ' ' + clase`, pero la pantalla resalta sobre `clase`. `buscarClases` devuelve ahora `coincidencias` (índices válidos de `resultado.clase`) y `coincidenciasRubro` (índices válidos de `resultado.rubro`), traducidos por `tramosPorRegion` (la clase comienza en `rubroLargo + 1`). La cabecera de `indice.js` declara contra qué cadena es válido cada tramo (§2.1).
- **El build es reproducible desde un clon.** Los tests del build corren contra `tests/fixtures/catalogo-muestra.json` (500 registros reales versionados, cinco rubros, clases con acentos y una clase grande); el test de las 159.366 filas se saltea con un aviso legible si falta el catálogo completo (§2.2). Verificado clonando el propio repo (§9, §3).
- **La validación es una sola fuente: `SGC.core.validacion`.** No escribí validadores nuevos en la vista; agregué `validarIdentificacion` y `validarFundamentacion` al módulo core (donde ya vivía `validarRenglon` desde la ronda 2) y `pasos.validarPaso` las compone. La existencia del código es la única pieza que no puede dar el core (ADR-014: valida forma) y se compone aparte con `indice.codigoExiste` (criterio igual al de la ronda 4).
- **El borrador es de `sessionStorage` y se ofrece, no se aplica.** La clave guarda el correo del operador; al entrar, la vista ofrece retomar o descartar, nunca aplica en silencio, y no ofrece el borrador ajeno. El almacenamiento es inyectable para poder probarlo en Node (§3.2).
- **La persistencia del paso 4 deja el borrador intacto ante cualquier fallo.** `pasos.persistir` devuelve `{ok:false, error}` si el servidor falla; el borrador se limpia recién cuando la alta devolvió 201 (§3.3).
- **Fast-Track: entrada hostil, cero inyección.** El JSON se valida antes de tocar el formulario; ningún valor llega por `innerHTML` (la app entera no asigna `innerHTML` en ningún lado — el test lo verifica con el contador del stub). `<script>` en un campo importado queda como valor plano de `textContent` (§3.4).
- **`codigos.json` para validar códigos sin bajar fragmentos.** El Fast-Track puede traer códigos de cualquier clase; validar contra el catálogo completo obligaría a bajar los 6.914 fragmentos. El arreglo plano de códigos (2,5 MB) se baja una sola vez, perezosamente, y se vuelve un `Set`. Es el mismo catálogo, otra vista.
- **La lógica del wizard se probó con un DOM mínimo, no con un navegador.** `tests/helpers/dom-stub.js` implementa justo lo que usan `wizard.js` y `renglones.js` (nodos por id, `classList`, eventos `emit`, un subconjunto de selectores). Esto permitió ejercitar el flujo completo —borrador, Fast-Track, alta real contra el servidor— en Node y destapó un bug real: `filaRenglon` no copiaba `unidad`/`aclaracion` a los inputs y la validación en vivo los borraba al restaurar un borrador o una importación. Se corrigió en `renglones.js`.

## 3. Verificación

`node --test` (desde la raíz, en el repositorio de trabajo): **140 tests, 0 fallos**.

`node --test` (en un clon limpio del repo, sin `datos-prueba/`): **verde, 140 tests, 0 fallos** (el test de las 159.366 filas se saltea con aviso legible). Ver §9.2 y el criterio de aceptación 1.

`node tools/check-compat.js` (desde la raíz):

```
check-compat: OK - 21 archivo(s) inspeccionado(s), 0 violaciones.
```

Además:
- **Criterio 3 (tramos)**: `buscarClases` sobre el catálogo real con 8 términos distintos; todos los tramos son índices válidos de `clase` y el fragmento resaltado contiene el término normalizado (test dedicado en `catalogo.test.js`).
- **Criterio 4 (Escape)**: `Escape` cierra el desplegable de ítems (`tecladoItems`) igual que el de clases.
- **Criterio 5 (entrada corrupta)**: el generador, con archivo vacío, truncado o no-JSON, imprime qué archivo y qué le pasa, sale con código 1 y sin stack trace (verificado a mano con archivos vacío y corrupto).
- **Criterio 6 (`grep estadoActual app/`)**: **2 ocurrencias**, ambas en la migración v1→v2 (`migraciones.js:98-99`), que son la excepción documentada en §4; todo lo demás se purgó.
- **Criterio 7 (documentación)**: cero ediciones a `BITACORA_DECISIONES.md` ni a otra documentación (verificable por `git diff`); ver §9.6.
- **Criterio 8 (wizard)**: no se avanza con el paso inválido y el motivo queda junto al campo, en español (test).
- **Criterio 9 (borrador)**: sobrevive a la recarga, no se ofrece a otro operador y se retoma o descarta (test).
- **Criterio 10 (Fast-Track hostil)**: código inexistente rechazado y nombrado; aclaración de 201 caracteres rechazada; `<script>` queda como dato plano y el contador global de `innerHTML` del stub queda en cero (test).
- **Criterio 11 (alta completa)**: contra el servidor real, `datos.json`, entrada en `idx/`, número único, auditoría con el correo y `catalogoVersion` registrada (test).
- **Criterio 12 (teclado)**: el recorrido del primer campo a la confirmación está implementado sin mouse (flechas/Enter/Escape en el buscador, foco al cambiar de paso, tabulación natural); no hay navegador automatizado en la suite (ver §6).
- **Criterio 13 (informe)**: este archivo, con sus nueve secciones.
- Determinismo del build: dos corridas del generador sobre el mismo catálogo dan bytes idénticos (test).
- Dependencias de terceros: cero. Todo es biblioteca estándar de Node y módulos propios.
- Temporales de test: todos en `os.tmpdir()`; ninguno quedó en el repositorio.

## 4. Contradicciones e información faltante

1. **Criterio 6 exige "cero ocurrencias de `estadoActual` en `app/`", pero la migración v1→v2 necesita leer `v1.estadoActual`.** Tras ADR-019 todo documento es v2, pero la migración (`migraciones.js:98-99`) convierte la forma v1 —donde el estado era `documento.estadoActual`— y los tests 2/3/5 de `migraciones.test.js` verifican exactamente esa lectura (`documento.estado.id === v1.estadoActual`). Borrarla rompe la migración que el sistema debe poder correr. Decisión: se purgó todo lo demás (la referencia muerta de `repo.js:185`, la rama v1 de `estados.js`, el atajo v1 de `utils.js`, los usos en `validacion.js`) y **se conservan las 2 ocurrencias vivas de la migración como excepción documentada** (regla R1 §0: la contradicción se anota, no se resuelve por cuenta propia). El criterio queda en 2/2, no 0.
2. **La validación de renglones necesita el catálogo, y `validarRenglon` por diseño (ADR-014) no lo ve.** La orden §3.1 manda validar con `SGC.core.validacion`; para el paso 2 se compone `validarRenglon` (forma) con `codigoExiste` (existencia). Es el mismo criterio que la ronda 4 dejó anotado en su §4.2.
3. **La orden no define el formato del archivo de códigos del Fast-Track.** Elegí `codigos.json`, un arreglo plano y ordenado emitido por el build; el contrato documentado en `carga.js`/`indice.js` es que `cargarCodigos` espera esa forma. Si la batería externa espera otra (por ejemplo una línea por código), es el primer punto a revisar.

## 5. Qué NO hice

- **No edité ninguna documentación**, incluida `BITACORA_DECISIONES.md`: ni la ADR-020 existente ni para agregar algo nuevo. La §2.6 lo prohíbe y así quedó. La única ADR nueva de esta ronda (de existir) la escribiría el revisor.
- **No escribí validadores nuevos en la vista.** La única adición de reglas es `validarIdentificacion`/`validarFundamentacion` en `SGC.core.validacion`, donde vive la validación desde la ronda 2.
- **No toqué** `tools/check-compat.js` ni su suite: las reglas ya cubren todo lo nuevo (el stub de tests no se escanea; vive en `tests/`).
- **No usé IndexedDB ni localStorage**: el borrador es `sessionStorage`, como manda la Fase 1.
- **No hice commit ni push hasta el cierre**: un solo commit local al final de la ronda, `git status` limpio.
- **No dejé** archivos temporales ni el catálogo completo en el repositorio: `datos-prueba/` sigue en `.gitignore`.

## 6. Riesgos que veo

- **La capa DOM se probó con un stub mínimo, no con un navegador.** El flujo lógico está cubierto y destapó un bug real (renglones), pero el recorrido real por teclado y el `aria-live` los verificará la batería externa en un navegador. Es el mismo límite que la ronda 4 anotó para `buscador.js`.
- **`codigos.json` pesa 2,5 MB.** Es un archivo más dentro del catálogo commiteado; se baja una sola vez y sólo al importar. Si el presupuesto de bajada inicial fuera estricto, la alternativa es servirlo por hash o validar contra las clases del fragmento; no lo veo necesario en intranet.
- **`check-compat.test.js` tiene un flake preexistente bajo carga paralela** ("js-map-groupBy (se detecta)" a veces hace timeout); pasa 34/34 en aislamiento. No es de esta ronda.
- **El patrón `page`-único de `wizard.js`** asume una pestaña por sesión de alta: el estado vive en el módulo y no en el DOM. Es correcto para el caso de uso (un jefe de división, un requerimiento por pestaña), pero dos alzas simultáneas en la misma pestaña comparten módulo.
- **Si la batería externa inspecciona `datos.json` esperando la forma v1** (`estadoActual`), fallará; la forma contractual es v2 (ADR-019) y está cubierta por las baterías de las rondas 1 y 3.

## 7. Mediciones

Salida del generador sobre el catálogo real (incluye `codigos.json`):

```
catalogo: 159366 registros en 6909 clases y 6914 fragmentos
catalogo: fragmento más grande 280 KB, total 22035 KB
catalogo: catalogoVersion 98201747, generado 2026-08-11T01:59:42.716Z
catalogo: listo en 14.82 s -> app/catalogo
```

- `app/catalogo/codigos.json`: 159.366 códigos, 2.469.740 bytes (~2,4 MB), ordenado (verificado por test).
- `tests/fixtures/catalogo-muestra.json`: 116.191 bytes, 500 registros de 5 rubros (QUIMICOS 200, "AGRIC,GANADERIA,CAZA,SILVICULT" 290, ALIMENTOS 8, ALQUILER 1, "ARTICULOS DEL HOGAR" 1), 2 clases con acentos (ALIMENTO P/NIÑO, GARRAPIÑADAS) y la clase grande REACTIVOS P/EQUIPO (200 ítems).
- Líneas por archivo nuevo/principal (regla de ≤400): `wizard.js` 398, `pasos.js` 236, `renglones.js` 236, `buscador.js` 331, `fasttrack.js` 167, `borrador.js` 67, `app.js` 57, `repo.http.js` 152.
- Suite completa: 140 tests en ~52 s; el test de alta completa contra el servidor real tarda ~2 s.

## 8. Accesos fuera del repositorio

Necesité exactamente las dos cosas que la §0 autoriza, y nada más:

1. **`os.tmpdir()`** — carpetas temporales de tests (datos de servidor, verificación del build en frío) y el clon temporal para la verificación en limpio de la §2.2.
2. **Puertos locales `127.0.0.1`** — el servidor real en los tests de integración (`wizard.test.js`, `servidor.test.js`), puerto 0.

No se denegó ningún acceso ni quedó trabajo interrumpido por permisos.

## 9. Correcciones arrastradas

- **2.1 — Tramos de coincidencia.** Nuevo contrato explícito: `coincidencias` son índices de `resultado.clase` y `coincidenciasRubro` de `resultado.rubro`; `indice.tramosPorRegion` traduce del texto combinado (`rubro + ' ' + clase`) a ambas regiones. Verificado con `buscarClases` sobre el catálogo real (8 términos) y con el test de `valvula` aseverando `[[0, 7]]` contra `clase`, no contra el texto combinado.
- **2.2 — Build reproducible.** Nuevo `tests/fixtures/catalogo-muestra.json` versionado (500 registros reales, 5 rubros, acentos, clase grande); los tests del build corren contra el fixture; el test de las 159.366 filas se saltea con aviso legible si falta `datos-prueba/`. Verificado clonando el repo a una carpeta temporal y corriendo `node --test` ahí: verde sin archivos externos.
- **2.3 — Escape.** `cerrarListaItems()` en `buscador.js` y `else if (ev.key === 'Escape') { cerrarListaItems(); }` en `tecladoItems`; ambos desplegables se comportan igual.
- **2.4 — Entrada corrupta.** `readFileSync` y `JSON.parse` de `tools/build-catalogo.js` envueltos: mensaje que nombra el archivo y el problema, `process.exit(1)`, sin stack trace. Verificado a mano con archivos vacío y corrupto.
- **2.5 — Referencia muerta al esquema v1.** Purgado `|| (expediente && expediente.estadoActual)` de `repo.js:185`, la rama v1 de `estados.js`, el atajo v1 de `utils.js` (renombrado `idEstadoActual` → `idEstado`) y sus usos en `validacion.js` y `repo.js:159`. `grep estadoActual app/` → 2/2 ocurrencias, sólo en la migración v1→v2 (excepción documentada en §4).
- **2.6 — ADR-020 y la documentación.** Cero ediciones a `BITACORA_DECISIONES.md` ni a ninguna documentación; la decisión de ADR-020 queda vigente. Verificable por `git diff`.
