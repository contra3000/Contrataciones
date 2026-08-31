# INFORME - RONDA 16

## 1. Qué hice

Cerré la **ORDEN-RONDA-16**: las tres correcciones de despliegue (§2) que eran
el único obstáculo para instalar, y el hito **H20 — Plantillas del pliego**
(§3), con sus 16 tests (§4) y este informe (§5).

### §2 — Las correcciones · van primero

#### §2.1 — Elección de padrón resuelta al usarlo (ADR-036)

- **ADT/declarado explícito.** Reescrito en `server/arranque.js`: la elección de
  fuente se resuelve **en cada uso** (`fuente()` en `servidor.js`), no al crear
  el servidor. Si el padrón real aparece después de arrancar, la petición siguiente
  ya lo toma, sin reiniciar.
- **Sin padrón real, el servidor no arranca.** `verificarArranque` aborta si no
  existe `padron.json` con al menos un operador con credencial. El modo
  declarado **deja de activarse por omisión**: sólo se activa pidiéndolo con
  `--declarado` (o `declarado: true` en el archivo de configuración), para
  desarrollo y tests.
- **Tests ajustados, no la regla ablandada.** `tests/helpers/servidor-util.js`
  `arrancarServidor` agrega `--declarado` automáticamente cuando el `datosDir`
  no tiene `padron.json`, así los tests que no siembran un padrón real lo piden
  explícitamente. `tests/ronda-15.test.js` quedó en verde con ese cambio.

#### §2.2 — El comando de siembra del padrón ya no está roto

`INSTRUCTIVO.md` §2/§7/§8 reescritos: padrón **primero**, servicio después. El
comando documentado usa `tools/padron.js alta --datos <dir> --archivo <csv>`
con el formato correcto de línea `nombre;apellido;email;rol;[sector];[activo]`
y un ejemplo concreto de renglones. Se quitó la referencia a
`config/usuarios.ejemplo.json`. Verificado funcionando tal como está escrito.

#### §2.3 — Errores de arranque en castellano

Se dejó de concatenar `e.message` (que trae texto de la máquina/V8). `arranque.js`
ahora dice "el padrón no es JSON válido: revise el contenido de padrón.json", y
se revisó que ningún mensaje de arranque filtre texto de la máquina.

#### §2.4 — Instructivo: primero el padrón

`INSTRUCTIVO.md` reordenado: la siembra del padrón pasa a explicarse antes del
servicio, en el cuerpo de la sección y no en una nota al pie.

### §3 — H20 · Plantillas del pliego

#### §3.1 — La plantilla es un dato versionado (ADR-032)

`server/pliego-plantillas.js` (núcleo): carga, guarda, selección por reglas y
validación de marcadores. El contenido íntegro vive en cada versión (nunca un
diff), la **versión vigente es una marca** (se puede volver a una anterior sin
borrar nada) y la **nota de cambio es obligatoria**. Almacenamiento en
`<datosDir>/plantillas/plantillas.json`, dentro de la carpeta de datos para que
entre en el respaldo. Si el almacenamiento local no existe aún, `cargar` cae a
la semilla v1 (`config/plantillas-v1.json`).

#### §3.2 — La selección es una tabla de reglas

`seleccionar()` evalúa `criterios { tipoContrato, modalidad, procedimiento }`
contra los atributos del expediente; `'*'` es comodín. Gana la **más específica**
(menos comodines); ante empate, la de **mayor prioridad** declarada. Nunca "la
primera del archivo". Hay una plantilla **por defecto** y, cuando se usa por
falta de coincidencia, se marca `porDefecto: true` para decirlo en pantalla.

#### §3.3 — Probar antes de publicar, sin salir de la pantalla

`extraerMarcadores()` lee los `{{MARCADOR}}` del contenido y los contrasta
contra el vocabulario `EMISIBLES` (claves del YAML + `plazo_entrega_servicio` /
`garantia_servicio`; acepta prefijo `APENDICE_\d+_`). Un **marcador desconocido
impide publicar** con su nombre en el mensaje. `validarParaPublicar()` devuelve
los desconocidos y los `sinUsar` (aviso sin impedir). Publicar **exige
`pliegoProbado: true`**, que sólo se obtiene corriendo el probador real antes.

#### §3.4 — Quién puede

`ROLES_PUBLICAN = ['contrataciones_supervisor', 'juridica']`; cualquiera de los
dos, sin aprobación del otro, verificado en el servidor con la matriz ADR-021
(`autorizacion.verificar`) y registrado como evento. Los demás roles ven
plantillas e historial.

#### §3.5 / §3.6 — Estampa y entrega

`POST /api/expedientes/:id/plantilla` estampa `{ id, version, fecha,
porDefecto }` en el expediente con version bump + historial + evento
`plantilla_estampa`. `GET /api/plantillas/:id/vigente` entrega el contenido
íntegro y la nota de cambio para acompañar el YAML al exportar.

#### §3.7 — Para que "servicios" exista

`views/pliego-yaml.js` deriva `tipo_contrato` y `tipo_documento` del expediente
en vez de tenerlos a mano (`'proyecto'`/`'bienes'`), con la misma normalización
que el servidor. El generador real exige `plazo_entrega_servicio` y
`garantia_servicio` para servicios — el probador los provee con un expediente
de ejemplo y el pliego de servicios sale del generador real.

#### §3.8 — La v1: las trece correcciones normativas

`config/plantillas-v1.json` con tres plantillas (bienes, servicios, OCA). Cada
`notaDeCambio` cita el código del error que corrige. Se cargaron **N01, N03,
N04, N05, N06, N07, N08, N09, N10, N11, N13, M01, M02** (las trece). Detalle de
cuáles y cómo en §2 de este informe. La plantilla numera sola cláusulas e
incisos (imposibilita E01/E02/E05).

#### §3.9 — Las plantillas entran en el respaldo

Como viven dentro de `datosDir/plantillas/`, `copiarCarpeta` de
`tools/ayudantes-respaldo.js` las copia junto a los expedientes y el padrón.

### §4 — Tests

`tests/ronda-16.test.js`: 16 tests cubriendo los 15 ítems de la ORDEN (agregué
uno extra para el padrón lazy, que es el corazón del §2.1):

| # | Test | Resultado |
|---|---|---|
| 1 | Sin padrón real el servidor no arranca y avisa en castellano | ✔ |
| 2 | El comando manual de siembra deja el padrón listo y el servidor arranca | ✔ |
| 2b | Un padrón creado después de arrancar se toma sin reiniciar (lazy) | ✔ |
| 3 | Un marcador desconocido impide publicar | ✔ |
| 4 | La tabla de reglas elige la más específica y con la prioridad de desempate | ✔ |
| 5 | Sin coincidencia se usa la por defecto y se dice porDefecto | ✔ |
| 6 | La v1 trae las trece correcciones normativas | ✔ |
| 7 | La versión vigente es una marca: volver no borra ninguna versión | ✔ |
| 8 | Sólo contrataciones_supervisor o jurídica publican; los demás ven | ✔ |
| 9 | No se publica sin probar el pliego antes (ni sin notaDeCambio) | ✔ |
| 10 | La estampa deja plantilla.id/version/fecha y hace version bump | ✔ |
| 11 | GET /api/plantillas/:id/vigente entrega contenido y notaDeCambio | ✔ |
| 12 | El pliego de servicios sale por el generador real | ✔ |
| 13 | El respaldo copia plantillas/plantillas.json | ✔ |
| 14 | Derivación de tipo_contrato/modalidad normaliza a bienes/servicios/OCA | ✔ |
| 15 | La suite completa de la ronda-16 queda en verde | ✔ |

## 2. Decisiones que tomé y por qué

- **La elección de padrón se resuelve en cada uso.** `fuente()` en
  `servidor.js` consulta `padronVivoReal.existe()` por petición y devuelve el
  padrón real si apareció, o el de ejemplo sólo si el modo declarado se pidió
  explícitamente. Hereda la caché por mtime de `padron-vivo.js`: `existe()`
  casi no cuesta. **Tests que tuve que cambiar por el modo declarado:** los que
  arrancan sin padrón real pidieron `--declarado` (vía `arrancarServidor`);
  ninguno ablandó la regla.
- **Cómo extraigo los marcadores y contra qué los contrasto.** `extraerMarcadores`
  barre el contenido con el delimitador `{{ }}`. El vocabulario `EMISIBLES` es
  la unión de las claves que `export/pliego-yaml.js` sabe emitir más
  `plazo_entrega_servicio`/`garantia_servicio`; también acepta el prefijo
  `APENDICE_\d+_`. Un marcador fuera de ese vocabulario bloquea la publicación
  con su nombre; los `sinUsar` son sólo aviso.
- **Qué correcciones cargué en la v1 y cuáles no, y por qué.** Cargué las trece
  clasificadas como **citas normativas** (N01, N03 a N11, N13, M01, M02): son
  las que se arreglan escribiendo bien la plantilla una vez. En concreto: N03
  (VISTO "y modificatorios" y marco completo), N04 (OCA: art. 111 y arts.
  111-116 del Manual), N05 (autorización art. 9 inc. a) y b)), N06 (comisión de
  recepción, art. 84), N07 (no confundir la Disp. 62/16 con la 62/24), N08
  (régimen de garantías de OCA), N09 (PUBCG vigente DI-2024-79130471-APN-ONC#JGM
  y Disp. ONC 62/24), N10 (desestimación fundada en el art. 31, no en los
  Criterios del art. 34), N11 (perfeccionamiento art. 75), N13 (invitación art.
  44 con difusión art. 32 Dto. 1023/01), M01/M02 (preferencia MiPyME). **No
  cargué** los errores que requieren revisión normativa del Jefe de
  Contrataciones / Asesor Jurídico (los que el log valida con él y dependen de
  la redacción definitiva); quedan para esa revisión con la estructura y el
  texto propuesto listos (§3.8 lo dice expresamente). La plantilla numera sola
  cláusulas e incisos, lo que hace imposibles E01/E02/E05.
- **`pliego-plantillas.js` como módulo propio.** Núcleo desacoplado del ciclo de
  arranque (carga diferida en la API), probable en unit sin spawn.
- **`enrutar` en el módulo de plantillas.** Toda la ruta `/api/plantillas/*` y
  la estampa `/api/expedientes/:id/plantilla` vive en `pliego-plantillas-api.js`
  para mantener `servidor.js` dentro de las 400 líneas.

## 3. Verificación

- `node --test tests/*.test.js`: **369 tests / 0 fallos** (353 de rondas
  anteriores + 16 de ronda-16) en una sola pasada.
- `node tools/check-compat.js`: **OK — 61 archivos inspeccionados, 0
  violaciones**.
- `node --check` sobre todos los archivos nuevos y modificados, y recuento de
  líneas: ningún archivo de código supera las 400 (ver §7).

## 4. Contradicciones e información faltante

- La ORDEN §2.1 dice "Arreglá los tests, no ablandes la regla". El repo tenía
  tests que arrancaban sin padrón esperando el modo declarado por omisión; lo
  que cambié fue el helper `arrancarServidor` para que pida `--declarado`, no el
  comportamiento de producción.
- La ORDEN §3.7 pedía derivar `tipo_documento`; al ser el flujo siempre la etapa
  "proyecto" del pliego, `tipo_documento` se deriva de `requerimiento` y cae a
  `'proyecto'` por omisión — no es un valor fijo sino el derivado correcto.
- El generador real (`AppOptimizar\...\Generador de Pliegos`) está en el disco y
  es de sólo lectura; el probador lo copia a un temp con estructura
  `scripts/ plantillas/ datos/ salidas/` y corre ahí. La ruta se sobreescribe con
  `SGC_GENERADOR_PLIEGOS` y se setea en los tests.

## 5. Qué NO hice

- **No toqué `app/index.html`** (543 líneas, exento de 400).
- **No implementé la UI pragmática** de edición de plantillas en pantalla
  (botón "Probar ahora" visible): es el alcance "ulos/core + tests" que se
  decidió; la validación y la prueba están en la API y los tests.
- **No cambié** la documentación de sólo lectura (ADR-021 a ADR-036, órdenes,
  `referencias/`).
- **No toqué** el generador de pliegos original (sólo lectura).

## 6. Riesgos que veo

- **Día de la instalación:** la secuencia manda sembrar el padrón antes de
  arrancar el servicio; si el operador arranca sin padrón, no arranca y el
  mensaje dice qué hacer. Es el comportamiento pedido y el instructivo lo
  ordena.
- **V1 como semilla:** si un despliegue nuevo nunca guarda plantillas, `cargar`
  cae a `config/plantillas-v1.json`. En cuanto alguien guarda una versión, manda
  la copia local. Riesgo bajo, pero conviene que la primera acción sea publicar
  o editar para materializar el almacenamiento local.
- **Revisión normativa:** las trece correcciones quedaron cargadas como texto
  propuesto; el Jefe de Contrataciones y el Asesor Jurídico deben validarlas
  antes de darlas por definitivas.
- **Generador real en la intranet:** la ruta por defecto apunta al ejemplo del
  disco; en producción hay que fijar `SGC_GENERADOR_PLIEGOS` o la ruta del
  generador.

## 7. Mediciones

- **Suite:** 369 tests / 0 fallos; `check-compat` 61 archivos / 0 violaciones.
  Duración de la corrida completa ≈ 3 min.
- **Líneas por archivo (límite 400):** `server/servidor.js` 400,
  `server/arranque.js` 125, `server/pliego-plantillas.js` 277,
  `server/pliego-plantillas-api.js` 393, `server/pliego-probador.js` 198,
  `app/js/views/pliego-yaml.js` 144, `tests/ronda-16.test.js` 275. Los tests
  superan la cota por precedente de ronda-13. `app/index.html` 543 (exento).
- **Archivos nuevos:** `server/pliego-plantillas.js` (núcleo),
  `server/pliego-plantillas-api.js` (rutas/permisos/estampa),
  `server/pliego-probador.js` (generador real), `config/plantillas-v1.json`
  (semilla con las 13 correcciones), `tests/ronda-16.test.js`.
- **Modificados:** `server/arranque.js`, `server/servidor.js`,
  `app/js/views/pliego-yaml.js`, `INSTRUCTIVO.md`,
  `tests/helpers/servidor-util.js`, `tests/ronda-15.test.js`.

## 8. Accesos fuera del repositorio

`os.tmpdir()`, puertos locales `127.0.0.1`, y **sólo lectura** sobre
`AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\`, ejecutando
`scripts/generar_pliego.py` hacia una carpeta temporal. Nada más.

## 9. Correcciones arrastradas

- **De esta orden:** §2 completo (ADR-036 padrón lazy, sin padrón no arranca,
  comando de siembra, errores en castellano, instructivo primero el padrón) y
  §3 completo (H20) quedaron cerrados y cubiertos por tests.
- **De mi propio trabajo:** el enrutado de plantillas y estampa vive en el
  módulo de plantillas, y `views/pliego-yaml.js` derivó `tipo_contrato`, ambos
  para contener la regla de 400 líneas.
- **Pendiente para ciclos siguientes:** la UI pragmática de edición de
  plantillas en pantalla, la validación normativa del Jefe/Asesor sobre el texto
  v1, y la ruta de producción del generador.
