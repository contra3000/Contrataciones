# INFORME - RONDA 17

## 1. Qué hice

Cerré la **ORDEN-RONDA-17**: el hito **H21 — Administración del padrón desde
la aplicación** (§1, que también cambió el diseño de instalación en ADR-037),
y el **cierre de H10 y H20** (§2, §3, §4, §5): la prueba de la plantilla que
no se podía saltear, el pliego de servicios que salía del generador real, la
regeneración por versión estampada, y dos respuestas HTTP que filtraban el
error de la máquina.

### §1 — H21 · El padrón se administra desde adentro

#### §1.1 / §1.2 — El primer arranque crea al administrador y muestra la clave una vez

El servidor **ya no tiene un estado "sin padrón"** (ADR-037). En el primer
arranque, `server/padron-inicial.js` crea `padron.json` con un solo usuario —
el administrador—, cuyos datos salen de la configuración
(`{ administrador: { nombre, apellido, email, rol, sector } }`) con el default
`administrador@sgc.local`. La clave se genera con el formato de ADR-034 §2:
**cuatro palabras del diccionario en minúsculas, sin tildes, separadas por
guiones** (`config/palabras.json`), **provisoria** (el hash vive en
`credenciales.hash`), y se imprime **una sola vez** en la salida, en las líneas
`SGC-SERVIDOR-ADMINISTRADOR-CREADO/-CORREO/-CLAVE-PROVISORIA/-TEXTO`, **antes**
de `SGC-SERVIDOR-PUERTO`. En la VM queda en el registro del sistema; a mano, en
la consola. **Ninguna clave por omisión** —ni en el código, ni en el manual, ni
en la configuración—.

**Qué pasa si nadie la lee:** la clave provisoria se pierde con el reinicio, pero la
recuperación sigue existiendo: `tools/padron.js reponer` sin `--quien/--clave`
actúa de rescate cuando nadie puede entrar, y la pantalla permite que el
administrador reponga claves de los operadores. La cuenta de administrador no
se bloquea por sí sola.

El segundo arranque **no crea nada ni imprime otra clave**: `fuente()`
(`server/servidor.js`) y `verificarArranque` simple ven que el padrón ya existe
con credencial. El modo declarado **sólo se activa pidiéndolo** (`--declarado`),
igual que en la ronda 16 (ADR-036); la regresión "cae al modo declarado por
omisión" no volvió. Sin `--declarado` y sin padrón → bootstrap; con padrón
real → modo autenticado con ese padrón.

#### §1.3 — `administrador` es una marca, no un rol

No agregué un octavo rol. `administrador: true` es un atributo de persona que
gobierna, verificado **en el servidor** (`padron-administracion.js`
`esAdministrador` + `autorizacion.verificar`): administrar el padrón, ver el
compendio crudo de eventos/sugerencias, y reponer claves / levantar bloqueos.
**Editar plantillas no cambió**: sigue siendo `contrataciones_supervisor` o
`juridica` (ADR-032 §5).

#### §1.4 — La pantalla de administración

Sólo para el administrador: alta de a uno (la clave provisoria **se muestra una
vez** y no queda en el archivo), listado (nombre, correo, rol, sector, activo,
provisoria pendiente, bloqueado), baja, cambio de rol, reposición de clave,
levantar bloqueo, e importar/exportar CSV. Los roles del desplegable salen de
`config.js`, no de una lista a mano.

#### §1.5 — La importación muestra el efecto antes de aplicarlo (**esto no se negocia**)

`server/padron-csv.js`:

- **Primero el diff.** `creados`, `cambios` (los correos) y `detalles`
  (`[{ email, campos }]`, el **qué campo** —nombre/apellido/rol/sector/activo—),
  y `ausentes` (activos hoy que no están en el archivo).
- **Todo o nada.** Todas las validaciones corren antes de escribir; el padrón se
  escribe una sola vez. Si una línea está mal (email, rol o repetido), **no se
  aplica ninguna**, y el mensaje dice cuál y por qué.
- **La ausencia no da de baja por sí sola.** Los ausentes se listan; desactivarlos
  es una opción (`desactivarAusentes`) que el administrador marca. Sin la marca,
  un archivo al que se le borró una fila no desactiva a nadie en silencio.
- **No toca credenciales.** Un correo que ya existe conserva su clave y su hash.
- **Tolerante** al BOM y a la línea vacía final, y a la línea de encabezado que
  la exportación escribe (se corrigió que antes la importación la trataba como
  un operador y podía dar 422 al importar la propia exportación).

#### §1.6 — El administrador no puede dejarse afuera

Bloqueado **en el servidor** (`chequearAntiEncierro` en
`padron-administracion.js` y el chequeo equivalente en `padron-csv.js`): si es
el único administrador activo, **no puede darse de baja, ni quitarse la marca,
ni cambiarse el rol** — desde la pantalla, desde la API, o por una importación
que lo omita (con `desactivarAusentes`) o lo desactive. Para pasar la
administración: primero se marca al nuevo, después se desmarca al anterior.

#### §1.7 — La herramienta de consola se queda

`tools/padron.js` **no se eliminó**: sigue siendo el camino de rescate cuando
nadie puede entrar. Nada en la ronda lo elimina.

### §2 — Publicar sin probar · la corrección principal de H20

`server/pliego-plantillas.js` guarda que la prueba ocurrió **atada al contenido
exacto** por **huella SHA-256** (`marcarProbada(contenido)` / `estaProbada`
sobre un `Map` en memoria). Publicar (`apiPublicarVersion`) verifica ese
registro contra **el contenido que se publica**; el `cuerpo.pliegoProbado` del
cliente **se ignora por completo** — igual que el `contexto.rol` de la ronda 14.
Si el contenido cambió, hay que probar de nuevo. El registro vive en memoria y
se pierde al reiniciar: **está bien que después de un reinicio haya que volver a
probar**. Se cerró el camino lateral de volver a una versión vieja y editarla:
al volver, el editor vuelve a pasar por el probador.

### §3 — El pliego de servicios y el probador que miente

`views/pliego-yaml.js` ahora **emite `plazo_entrega_servicio` y
`garantia_servicio`** desde el ANEXO 1 cuando el tipo es `servicios`. Y el
probador (`pliego-probador.js`) **ya no fabrica esos datos**: arma su
expediente de ejemplo **con la misma función de exportación del flujo real**
(`views/pliego-yaml.js`), así lo que prueba es exactamente lo que el sistema
puede emitir. Si el flujo real no emitiere un campo, "Probar ahora" fallaría
para servicios en vez de dar OK sobre una ficción. La exportación avisa al
cargar si faltan los campos, no cuando el pliego no sale.

### §4 — La reproducibilidad

El expediente estampa `{ id, version, fecha, porDefecto }`, y ahora **sí se
consulta**: `GET /api/plantillas/:id/versiones/:version` devuelve **la versión
concreta**, y `GET /api/expedientes/:id/regenerar` usa **la versión estampada**
— no la vigente de hoy. Si esa versión ya no existe, se **dice** con 404 y no se
cae a la vigente en silencio (`versionDe` en `pliego-plantillas.js`).

### §5 — Se cerró de más, y dos chicas

- **Lectura de plantillas**: abierta a **todos los roles autenticados**; publicar,
  volver y editar siguen siendo de `contrataciones_supervisor`/`juridica`. El
  comentario de cabecera dice lo mismo que el código.
- **El error de la máquina**: `server/ayudantes.js` `responderErrorPeticion` y
  `server/servidor.js` (manejo del 500) **ya no concatenan `e.message`** a lo que
  llega al usuario. El único lugar donde un mensaje de error llega al usuario es
  el guard de `pliego-probador.js` (`mensajeSeguro`): sólo los motivos
  marcados explícitamente como seguros (nuestros, en castellano). El
  `console.error` del arranque sí conserva la clase/`e.message` para el registro
  del operador. Y `ejecutarPython` detecta el `ENOENT` de `python` ausente y lo
  dice en claro.
- **La nota del seed**: corregida. `config/plantillas-v1.json` ahora afirma (y es
  verdad) que **la numeración de cláusulas e incisos viene escrita a mano**; la
  carga corrige el corrimiento y los saltos de las fuentes (E01/E02/E05), pero
  **la aplicación no numera sola** — H20-17 de la planificación queda pendiente.

Además corregí un tercer detalle que quedó expuesto por el bootstrap: la validación
del puerto en `server/arranque.js` estaba **detrás** del retorno temprano "sin
padrón"; como ahora arrancar sin padrón es válido, `--puerto abc` escapaba como
un `RangeError` de node en vez de un mensaje claro en español. La moví para que
corra siempre.

## 2. Decisiones que tomé y por qué

- **Cómo se genera y se muestra la clave del administrador.** Cuatro palabras del
  diccionario, en minúsculas y sin tildes, separadas por guiones (`RE_CLAVE` en
  los tests: `^[a-záéíóúüñ]+(-[a-záéíóúüñ]+){3}$`). Se muestra una sola vez en la
  salida, antes del puerto. **Si nadie la lee:** se pierde con el reinicio, pero
  `tools/padron.js reponer` sin `--quien/--clave` actúa de rescate. **No existe
  clave por omisión**; el test 4 escanea código, config e INSTRUCTIVO con un
  patrón de valor y rechaza cualquier literal (dejé fuera el `typeof` del login y
  el centinela vacío del ternario de la clave, que no son valores).
- **Qué hace la importación cuando un correo está en el padrón y no en el archivo.**
  Lo lista en `ausentes`; sólo lo desactiva si el administrador marcó
  `desactivarAusentes`. Nunca en silencio. El diff se computa **por campo** y se
  reporta en `detalles`.
- **Cómo guardás que la prueba de la plantilla ocurrió.** Hash SHA-256 del
  contenido, en memoria. **Qué pasa al reiniciar:** el `Map` se vacía y hay que
  volver a probar. Lo elegí así porque el costo de re-probar después de un
  reinicio es un operador apretando un botón, y el costo de un `pliegoProbado`
  persistente que se des-sincrona es el defecto que esta ronda elimina.
- **Qué elegí sobre la numeración automática.** No la implementé: es una función
  que puede tocar el contenido publicado (y el generador real). Corregí la nota
  del seed para que sea verdadera y diga que la numeración viene escrita a mano
  y que H20-17 queda pendiente. Esto cumple lo que la orden pide ("lo que no
  puede quedar es la afirmación falsa").

## 3. Verificación

- `node --test`: **390 tests / 0 fallos** en una sola pasada (369 de ciclos
  anteriores + 21 de ronda-17). Ronda-16 quedó en verde tras ajustar dos tests de
  ciclo anterior que chocaban con el nuevo diseño (§5).
- `node tools/check-compat.js`: **OK — 62 archivos inspeccionados, 0
  violaciones**.
- Recuento de líneas: ningún archivo de código supera las 400 (ver §7).

## 4. Contradicciones e información faltante

- **`servidor-ayudantes.test.js` "puerto inválido"** fallaba por un ordenamiento
  real en `arranque.js` (el chequeo del puerto estaba detrás del retorno "sin
  padrón"), que el bootstrap de esta ronda dejó expuesto. Lo corregí moviendo el
  chequeo, no ablandando el test.
- **`requerimiento-servidor.test.js` (413)** esperaba el texto "achique el
  contenido" que el 413 de `responderErrorPeticion` daba concatenando `e.message`.
  Conservé la instrucción en castellano ("achique el contenido") **sin** repetir
  `e.message`, y el test pasó con esa matiz.
- **`ronda-16.test.js` test 8** publicaba con `pliegoProbado: true` del cliente y
  esperaba 200; la ronda 17 decide que esa bandera **se ignora**. Ajusté el test
  para que pruebe primero por el servidor (como hace el flujo real) y después
  publique — el propósito del test (permisos por rol) se conserva, la regla no
  se ablanda.

## 5. Qué NO hice

- **No agregué un octavo rol** (`administrador` es marca, ADR-037).
- **No eliminé `tools/padron.js`** — es el rescate para cuando nadie puede entrar.
- **No implementé la numeración automática** de cláusulas/incisos; corregí la nota
  del seed para que no mienta (§2).
- **No toqué `app/index.html`** (543 líneas, exento de la cota de 400).
- **No cambié** la documentación de sólo lectura (ADR-021 a ADR-037, órdenes,
  `referencias/`).
- **No toqué** el generador de pliegos original (sólo lectura).

## 6. Riesgos que veo

- **Generador real en la intranet:** la ruta por defecto apunta al ejemplo del
  disco; en producción hay que fijar `SGC_GENERADOR_PLIEGOS` o la ruta del
  generador. En un clon sin `python` en el PATH, "Probar ahora" lo detecta y dice
  qué falta, pero no puede correr el generador.
- **La clave provisoria y el registro:** si se arranca en la VM y nadie lee la
  clave del registro, la recuperación depende de `tools/padron.js reponer` de
  rescate — conviene que el Jefe conozca ese camino.
- **Registro de prueba en memoria:** publicar requiere probar de nuevo después de
  un reinicio. Es lo pedido, pero es un paso más en el día a día del Jefe.
- **`pliego-plantillas-api.js` y `sesion.js` en 400 líneas exactas:** cualquier
  cambio futuro debe ser neto-cero o repartirse.

## 7. Mediciones

- **Suite:** 390 tests / 0 fallos; `check-compat` 62 archivos / 0 violaciones.
  Duración de la corrida completa ≈ 4 min (los tests del generador real corren
  `python`).
- **Líneas por archivo (límite 400, archivos tocados):** `server/servidor.js` 400,
  `server/ayudantes.js` 337, `server/padron-csv.js` 254,
  `server/padron-administracion.js` 361, `server/pliego-plantillas-api.js` 400,
  `server/pliego-probador.js` 238, `server/pliego-plantillas.js` 321,
  `server/arranque.js` 131, `tools/padron.js` 399, `server/sesion.js` 400.
  Ninguno supera la cota.
- **Archivo nuevo:** `server/padron-inicial.js` (bootstrap, 76 líneas),
  `tests/ronda-17.test.js` (21 tests), `INFORME-RONDA-17.md`.
- **Modificados:** `server/servidor.js`, `server/ayudantes.js`,
  `server/padron-csv.js`, `server/arranque.js`, `server/pliego-plantillas.js`,
  `server/pliego-plantillas-api.js`, `server/pliego-probador.js`, `config/plantillas-v1.json`,
  `tests/ronda-16.test.js`, `tests/requerimiento-servidor.test.js`,
  `tests/servidor-ayudantes.test.js`, `tests/helpers/servidor-util.js`.

## 8. Accesos fuera del repositorio

`os.tmpdir()`, puertos locales `127.0.0.1`, y **sólo lectura** sobre
`AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\`, ejecutando
`scripts/generar_pliego.py` hacia una carpeta temporal. Nada más.

## 9. Correcciones arrastradas

- **De esta orden:** H21 completo (§1.1-§1.7, ADR-037), §2 (prueba atada al
  contenido), §3 (servicios + probador con la exportación real), §4
  (regeneración por versión estampada), §5 (lectura de plantillas para todos,
  sin `e.message` en respuestas, nota del seed corregida). Todo cubierto por los
  21 tests de `tests/ronda-17.test.js`.
- **De mi propio trabajo:** el orden del chequeo de puerto en `arranque.js`
  (quedó expuesto por el bootstrap) y el ajuste de dos tests de ciclo anterior
  que chocaban con el nuevo diseño.
- **Pendiente para ciclos siguientes:** la UI pragmática de edición de plantillas
  en pantalla (botón "Probar ahora"), la numeración automática (H20-17), la
  validación normativa del Jefe/Asesor sobre el texto de las plantillas, y la
  ruta de producción del generador.