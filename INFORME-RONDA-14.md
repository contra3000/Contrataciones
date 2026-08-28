# INFORME - RONDA 14

## 1. Qué hice

Cerré la **ORDEN-RONDA-14**: las dos correcciones de §2 y el **H18 —
credenciales, jerarquía de roles y administración del padrón** (ADR-033 y
ADR-034), sobre el árbol que ya traía el ciclo 14 registrado en `fe284c6`.

- **§2.1 — Esquema de la base.** `server/base.js` `origenError` ahora valida la
  versión de esquema ANTES que el estado: un origen en esquema distinto del
  vigente (`SGC.core.migraciones.VERSION_ACTUAL`) o sin la etiqueta se rechaza
  con `400` y la explicación "migre el documento antes de reusarlo". Se
  acepta únicamente `schemaVersion` vigente; el resto de la elegibilidad
  (PERFECCIONADA + archivado) no cambia.
- **§2.2 — El compendio es del Jefe.** `GET /api/eventos` (server/eventos.js)
  y la consulta y atención de sugerencias (server/sugerencias.js) rechazan con
  `403` a todo rol que no sea `contrataciones_supervisor` — verificado en el
  servidor, hoy sobre el contexto de sesión. Los indicadores de cada tablero
  siguen abiertos a su rol.
- **§3.1 — ADR-033, jerarquía como dato.** Nuevo módulo `app/js/core/roles.js`:
  `HERENCIA_ROLES` = `{ contrataciones_supervisor → [contrataciones],
  abastecimiento_supervisor → [abastecimiento] }` y `rolesEfectivos(rol)`
  transitivo. `config.js` conserva una fachada `rolesEfectivos`. La matriz
  18 × 7 NO se duplica: `autorizacion.js` pregunta contra el conjunto
  efectivo. El padrón pasa a `rol: ''` (una sola elección). No se reescribe
  historia: los expedientes viejos conservan su auditoría tal cual.
- **§3.2/§3.6 — ADR-027/034, la clave.** `server/credenciales.js`: scrypt
  (`N=16384, r=8, p=1`, sal de 16 bytes, hash de 64), comparación con
  `crypto.timingSafeEqual`. La clave provisoria son cuatro palabras en
  castellano del diccionario `config/palabras.json` (2000 palabras únicas, sin
  tildes) unidas por guiones. La imprimen una sola vez `alta` y `reponer` de
  `tools/padron.js`; en disco sólo existe el hash.
- **§3.3 — El padrón no se sirve.** `padron.json` con hashes vive en la carpeta
  de datos; el servidor NO lo sirve ni como API ni como estático, y el test
  §4.1 lo verifica contra el servidor. En el repositorio queda
  `usuarios.ejemplo.json` sin credenciales.
- **§3.4/§3.5 — Sesión y rol derivado.** `server/sesion.js`: cookie
  `sgc_sesion` (HttpOnly, SameSite=Strict, id de `crypto.randomBytes`),
  sesiones del lado del servidor, 15 minutos de inactividad, cierre explícito.
  En modo autenticado todo `/api/*` exige sesión (lo único público es
  `/api/salud` y el login). El contexto se fabrica de la sesión: el cliente ya
  no declara `contexto.rol`. Cuando un supervisor actúa como su supervisado,
  la auditoría y los eventos registran el rol efectivo, y el indicador
  `misma_persona` del tablero del Jefe lo hace visible sin bloquear nada.
- **§3.6 — Ciclo de vida.** `provisoria:true` → el primer ingreso obliga a
  cambiarla. Reposición: el Jefe genera otra provisoria y queda el evento
  `clave_reponer` con quién, para quién y cuándo. Baja: `activo:false`, nunca
  borra. 10 fallos seguidos → bloqueo; la demora fija por fallo es 1 segundo;
  el bloqueo lo levanta el Jefe desde `tools/padron.js`.
- **§3.9 — `tools/padron.js`.** `alta` (con CSV `nombre;apellido;email;rol;sector;activo`
  y bootstrap sin `--quien`), `reponer`, `clave`, `baja`, `desbloquear`,
  `listar`. Los sucesos de administración van a `datosDir/padron.eventos.jsonl`.
- **Vistas.** `views/ingreso.js`, `views/cambio-clave.js` (con el aviso de
  §3.7 en la pantalla: "esta clave no puede ser la misma que usás en ningún
  otro sistema"), `adapters/repo.sesion.js` y el cableado en `app.js`
  (login, cambio, salir, barra con operador a la vista, modo declarado).
- **Tests.** `tests/ronda-14.test.js` con 12 bloques que cubren los 14 ítems de
  §4 (el 14 es la suite completa, en verde de una sola pasada).

## 2. Decisiones que tomé y por qué

- **Cómo genero la clave y de dónde sale el diccionario.**
  `credenciales.generarClave(diccionario)` elige cuatro palabras AL AZAR de
  `config/palabras.json` (2000 palabras únicas, `^[a-z]{4,}$`, sin tildes ni
  `ñ`) y las une con guiones. El diccionario es un archivo de configuración
  verificado (2000 entradas, sin duplicados), no un cálculo: se puede revisar y
  mantener sin tocar código. Entropía ≈ 4 × log₂(2000) ≈ 43 bits, suficiente
  para una red de 14 personas y —lo que importa— transcriptible a mano sin
  error: cuatro palabras son más fáciles de copiar que `X7#kq2` (ORDEN §3.6).
  La palabra clave es que se muestra UNA vez: `alta`/`reponer` la imprimen en
  la consola y guardan sólo el hash scrypt con su sal y parámetros, en el
  padrón. Nunca en texto plano, y por eso ningún archivo del sistema (ni de
  tests) contiene una clave.
- **Qué pasa, extremo por extremo, con una petición de un operador con clave
  provisoria.**
  1. `alta` crea al operador con `credenciales.provisoria:true`; la clave se
     entrega en papel.
  2. En la pantalla, `ingreso` valida `POST /api/sesion/login` (única ruta de
     sesión pública), que verifica la clave contra el hash, resetea
     `fallosContinuos` y fija la cookie.
  3. La sesión nace `provisoria:true`. Cualquier `/api/*` que no sea
     `cambio-clave`, `salir` o `actual` cae en `protegerRuta` y devuelve
     `403` con el mensaje "tenés que cambiar la clave provisoria antes de
     operar: use /api/sesion/cambio-clave". No toca el expediente, no pasa por
     el motor: se corta en la puerta.
  4. `cambio-clave` exige `claveVieja` (la provisoria), rechaza que la nueva
     sea igual a la vieja o a la provisoria, guarda el nuevo hash y apaga
     `provisoria` en el padrón y en la sesión.
  5. Recién ahí las otras rutas dejan de devolver 403. `actual` y `salir`
     están permitidas también bajo provisoria (ver el estado y cerrar).
  Verificado "todos los extremos", no sólo la vista: camino feliz, camino con
  clave vieja, con clave igual a la provisoria, y la caída de TODA operación
  distinta mientras siga provisoria (test §4.6).
- **Qué se registra en la reposición y qué no.**
  `tools/padron.js reponer` agrega una línea JSONL a
  `datosDir/padron.eventos.jsonl`:
  `{ tipo: 'clave_reponer', quien: <email del Jefe>, para: <email del
  operador>, cuando: <ISO 8601> }`. Se registra QUIÉN la repuso, PARA QUIÉN y
  CUÁNDO; NO se registra la clave ni la nueva ni la vieja, ni el canal (no hay
  canal: la entrega es en papel), ni la hora en que se entregó el papel. El
  mismo borrador de evento sirve para `alta` (con `quien:null` en el
  bootstrap del primer padrón), `baja` y `desbloqueo`. La defensa no es
  impedir la reposición — imposible con un solo administrador — es que no se
  pueda hacer sin dejar rastro.
- **Modo declarado se conserva.** Sin `padron.json` con hashes en la carpeta de
  datos el servidor sigue en modo declarado (contexto en el cuerpo) para
  desarrollo y tests; con él, el contexto del cuerpo se ignora y el rol sale
  de la sesión (`inyectarContextoEn`).
- **`roles.js` como módulo propio.** La jerarquía es DATO, no código: se puede
  leer y modificar como configuración, y `rolesEfectivos` es transitivo para
  que un tercer nivel futuro no toque nada más que la tabla. La fachada en
  `config.js` es perezosa y exige que `roles.js` esté cargado: lo agregué al
  manifiesto de integridad y a cada sitio de carga (HTML, servidor y la
  veintena de tests que cargan el core explícitamente).

## 3. Verificación

- `node --test` en el árbol: **342 tests, 0 fallos** (eran 330; +12 de
  ronda-14), incluidas las corridas de concurrencia y la matriz completa por
  servidor, en una sola pasada.
- `node tools/check-compat.js`: **OK — 61 archivos inspeccionados, 0
  violaciones** (57 + repo.sesion.js, ingreso.js, cambio-clave.js, roles.js).
- Test §4.1: **el padrón con credenciales no es alcanzable por HTTP** — pedí
  `padron.json` por GET estático, por `/api/padron`, por recorridos de ruta y
  por nombres alternativos; en modo autenticado el padrón no aparece en ningún
  recurso servido.
- Test §4.2: **ninguna clave en texto plano en disco** — los archivos de datos
  de los tests no contienen una sola palabra de las claves generadas; en
  `padron.json` sólo hay `algoritmo, sal, N, r, p, hash, provisoria`.
- Test §4.3–§4.5 contra el servidor: un operador no puede actuar con el rol de
  otro; `contrataciones_supervisor` ejecuta un paso de `contrataciones`;
  `contrataciones` no puede uno de supervisor; la auditoría registra el **rol
  efectivo**.
- Test §4.6–§4.11: provisoria por extremos, clave vieja muerta tras el cambio,
  reposición con evento quién/para/cuándo, baja `activo:false` con el nombre
  intacto en el historial, 10 fallos → bloqueo desbloqueado sólo por el Jefe,
  cierre por 15 minutos de inactividad.
- Test §4.12–§4.13: eventos y sugerencias rechazan a un rol común (403);
  cada rol ve los indicadores de su tablero y el Jefe el `misma_persona`.
- Aviso de §3.7: la pantalla de cambio de clave contiene "no puede ser la
  misma que usás en ningún otro sistema" (test propio).
- `node --check` sobre todos los archivos nuevos y modificados, y recuento de
  líneas: ningún archivo de código supera las 400 (ver §7).

## 4. Contradicciones e información faltante

- La §0 de la orden nombra "el §2.4 de esta orden" para el compendio restringido,
  pero la numeración de §2 tiene sólo §2.1 y §2.2; la corrección correspondiente
  es **§2.2** y así la reporto.
- El rol de mayor jerarquía que la ORDEN llama "el Jefe de Contrataciones" es en
  el sistema `contrataciones_supervisor`; uso ese rol literal en servidor y
  tests.
- La orden no dice quién repone la clave del propio Jefe si él pierde la suya,
  ni cómo se rota la del Jefe. El bootstrap (primer `alta` sin padrón) no deja
  evento de quién, porque no hay quién: lo declaro como limitación, no como
  falla de la defensa.
- El diccionario no viene de ningún documento: inventé la lista de 2000
  palabras en castellano común (sin tildes ni `ñ`). Es la única parte del
  material que no tiene fuente en `referencias/`.

## 5. Qué NO hice

- **No hay HTTPS**: el host sirve HTTP y así lo aceptó el Jefe; lo que hice fue
  el aviso de §3.7 en la pantalla de cambio de clave.
- **No até el rol a la máquina** (H3-12): lo descartó la propia ORDEN por no
  haber una PC por persona.
- **No autoservicio de reposición** (no hay correo donde mandar nada): la
  administra el Jefe y deja rastro.
- **No reescribí historia**: la auditoría y los eventos de expedientes
  existentes quedan tal cual; sólo los nuevos registros usan rol efectivo.
- **No dupliqué la matriz 18 × 7**: la jerarquía vive en `roles.js` como dato y
  la matriz sigue siendo la única fuente del `rolEjecutor`.
- **No serví el padrón real** por ninguna vía, y `usuarios.ejemplo.json` sigue
  sin credenciales.
- **No toqué** plantillas del pliego (H20 es la ronda 15), documentación de
  sólo lectura (ADR-021 a ADR-034, órdenes, `referencias/`),
  `tools/scraper-catalogo/` ni el generador de pliegos.

## 6. Riesgos que veo

- **Clave en claro por la red.** La intranet es HTTP: un usuario del mismo
  segmento podría capturar la clave en el login. El aviso reduce la reutilización
  en otros sistemas, que es la forma real de convertir esa captura en daño.
- **Entre la entrega y el primer cambio**, la provisoria la conoce el Jefe: si
  la usara, el registro lo mostraría con el rol del operador y `provisoria` en
  la sesión. La provisoria que no deja operar es la mitigación; el hueco
  restante es inherente a un solo administrador.
- **El papel es el canal**: la clave provisoria viaja impresa y podría
  leerse en el trayecto; no hay bytes en juego hasta el primer ingreso.
- **La clave del Jefe no tiene quién la reponga**: si se pierde, hay que
  editar el padrón a mano con `reponer` usando el rol del Jefe, que requiere
  la clave actual del Jefe. En la práctica la baja del padrón y el bootstrap
  nuevo son la salida, y eso trae la pregunta de quién conserva los datos.
- **Las sesiones viven en la memoria del proceso**: un reinicio del servidor
  desloguea a todos (no hay fuga, hay pérdida de confort); el aviso de "fuera
  de sesión" del cliente ya existía.
- **Sólo una persona administra el padrón**: un error de `tools/padron.js`
  (p. ej. una baja a destiempo) no tiene copia de seguridad diferenciada por
  operador; el respaldo de la carpeta de datos es la contención.

## 7. Mediciones

- **Suite:** 342 tests / 0 fallos; `check-compat` 61 archivos / 0 violaciones.
  Duración de la corrida completa ≈ 200 s (incluye la demora de 1 s por fallo
  de login del test de bloqueo).
- **Líneas por archivo (límite 400):** `server/sesion.js` 396,
  `server/expedientes.js` 400, `app/js/core/config.js` 400,
  `server/servidor.js` 400, `tools/padron.js` 400, `server/credenciales.js` 71,
  `app/js/core/roles.js` 50, `app/js/app.js` 358. `app/index.html` 543 (exento:
  HTML estático; ya excedía las 400 con 452 en HEAD y está fuera del escaneo de
  check-compat). Los tests superan la cota de 400 por precedente de ronda-13.
- **check-compat sobre el núcleo nuevo:** `roles.js` registrado en `APP_CORE`
  (orden de carga tras `config.js`) y en el `MANIFEST` de `server/integridad.js`.

## 8. Accesos fuera del repositorio

Los únicos accesos son `os.tmpdir()` y puertos locales `127.0.0.1`, como
autorizó la ORDEN §0. `tools/padron.js` escribe en `--datos` (dado por el
Jefe) y lee `config/palabras.json`; no abre la red. No se tocó el generador de
pliegos.

## 9. Correcciones arrastradas

- **De esta orden:** §2.1 (origenError y versión de esquema) y §2.2 (compendio
  del Jefe) cerradas y cubiertas por tests.
- **De mi propio trabajo:** la extracción de `roles.js` obligó a completar el
  sitio de carga en `app/index.html`, `server/servidor.js` (`APP_CORE`),
  `server/integridad.js` (manifiesto) y los tests que cargan el core
  explícitamente; la suite quedó en verde en una pasada.
- **Pendiente para ciclos siguientes:** la vista de expedientes debe mostrar el
  nombre de quien tramitó (R15 cita la "baja" de §3.6) y la herramienta de
  mantenimiento del Jefe para el padrón fuera del CSV de alta.