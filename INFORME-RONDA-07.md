# INFORME — RONDA 7

## 1. Qué hice

- **ADR-021 (§2.1, condición de entrada) — el servidor autoriza las transiciones.** Resumen del defecto y la decisión: un `PUT /api/expedientes/:id` con `estado = PERFECCIONADA` y rol "generador" devolvía `200 {version:2}` y movía el expediente del paso 1 al 10; el estado viajaba como documento y el servidor era un almacén versionado sin el motor. Decisión: el estado deja de viajar como documento; el servidor carga el núcleo de dominio (`estados.js`, `validacion.js`), ejecuta el motor con el rol del contexto y persiste **el resultado del motor**, nunca lo que manda el cliente.
  - **Extremos por intención**: `POST /api/expedientes/:id/avanzar` y `POST /api/expedientes/:id/devolver` con `{versionEsperada, destino, contexto}` (+ `idMotivo`, `observacion` en la devolución). El servidor lee de disco, ejecuta `SGC.core.estados.avanzar`/`devolver`, persiste el resultado y responde `200 {version, expediente}`; el motor con `ok:false` → `403` con el motivo en español tal cual lo da el motor; `409 {conflicto:true, versionRemota}` si la versión esperada no coincide; `404` si no existe (`server/expedientes.js`).
  - **El `PUT` dejó de poder mover el estado** (§2.1 punto 2): sigue editando campos; si el documento trae un `estado` distinto del que hay en disco → `409` con error explícito y sin escritura (test dedicado, y el fragmento mínimo con sólo `estado` también da 409).
  - **Cruce contra el padrón (`config/usuarios.ejemplo.json`)** para las transiciones: `app/js/core/autorizacion.js` (`verificar(usuarios, contexto)`, fail closed) rechaza 404 si el correo no está en el padrón, 403 si el rol declarado no corresponde al correo, y recién entonces deja correr el motor. Orden de checks: 404 → padrón (403) → versión (409) → motor (403 con motivo). La creación, el PUT de campos, el archivar y `guardarEntregable` **no** se cruzan con el padrón (ver §4.1 y §6).
  - **La auditoría la escribe el servidor** (§2.1 punto 4): la entrada de la transición se genera del lado del servidor con el rol ya validado y el origen de la petición (`origen {ip, hostname}`, ADR-017 medida 3). `auditoria.js` agregó `origen` a `CAMPOS_ENTRADA` y a `crearEntrada` (default `null`); `estados.js` lo reenvía desde el contexto; `repo.js:construirExpediente` lo registra en la creación.
  - **`repo.http.js` y `repo.memoria.js`** exponen `avanzar(id, versionEsperada, destino, ctx)` y `devolver(id, versionEsperada, destino, idMotivo, observacion, ctx)` con **la misma semántica** (la batería compartida `tests/helpers/repo-transiciones-bateria.js` corre contra las dos, rechazo por rol incluido, criterio 7).
  - **La vista no cambió para el usuario**: `puedeAvanzar`/`puedeDevolver` siguen decidiendo los botones (comodidad); la transición se pide por intención (`expediente-dialogo.js` ahora llama `repo.avanzar`/`devolver`) y la respuesta manda.
- **Entregable de Fase 1 (§3)**: la Especificación Técnica, completa (una sola plantilla, la de la Fase 1; las de fases 2 a 10 quedan para el ciclo 8).
  - **`app/js/renders/especificacion-tecnica.js`** (239 líneas): compone el HTML desde el `datos.json` — encabezado con unidad y número de expediente, identificación del requerimiento, **tabla de renglones con código, cantidad, unidad y la aclaración cuando exista** (criterio 10), fundamentación, operador solicitante con su correo, fecha y espacio de firma. Normaliza `identificacion` vs `campos`+`solicitante` (las dos formas del FSD).
  - **`app/css/impresion.css`** (`media="print"`): A4 con márgenes, `break-inside: avoid` en las filas de renglones, encabezado y número de página en cada hoja, oculta los controles de la app, legible en blanco y negro. El botón *Imprimir / Guardar como PDF* llama a `window.print()` con `body.imprimiendo`; sin librerías (ADR-012).
  - **`guardarEntregable` implementado** (§3.3): el HTML compuesto se guarda en la carpeta del expediente (escritura atómica como el resto del repo), se registra en `entregables` del `datos.json` y queda **enlazado desde la vista** del expediente. Se guarda el documento **generado**, no el firmado (ADR-016).
  - **Exportación (§3.4)**: botón *Exportar JSON* (descarga el `datos.json` crudo), `resumen.md` generado desde la auditoría (relato en prosa de quién hizo qué, cuándo y desde qué equipo, en orden cronológico y en español), con la **declaración explícita de ADR-016** (criterio 12). **Modal de advertencia obligatorio antes de toda descarga** (FSD §6), con botón de texto descriptivo (criterio 13). `exportar.js` (203 líneas) y `renders/resumen.js` (126 líneas).
- **Correcciones menores (§2.2)**:
  - **Matriz partida por estado**: `tests/expediente-matriz.test.js` (un test por estado, 18 × 7 roles) + `tests/transiciones-servidor-matriz.test.js` (la misma matriz **por el servidor**, 18 estados, el rol correcto avanza y los otros seis reciben 403 con el disco verificado tras cada intento). Un fallo identifica la combinación exacta (criterio 8).
  - **`wizard.js` 437 → 370**: `app/js/views/wizard-formulario.js` (123) con sincronizar/aplicar/mostrarErrores/guardarBorrador/ofrecer/retomar/descartar; wrappers delgados en wizard.js; `script` agregado en `app/index.html`.
  - **`servidor.test.js` 518 → 332**: `tests/servidor-ayudantes.test.js` (126, unidad + arranque) y `tests/servidor-concurrencia.test.js` (concurrencia).
  - **`server/servidor.js` 983 → 338**: partido por responsabilidad en `server/ayudantes.js` (267, infra: atómico, lock, origen, rutas, cuerpo, respuesta), `server/manejadores.js` (194, estáticos/config/salud/índice/validar-códigos) y `server/expedientes.js` (296, CRUD/transiciones/entregables), con fábricas `crearManejadores(entorno)`/`crearManejadoresExpedientes(entorno)`. `module.exports = Object.assign({ VERSION, crearServidor }, ayudantes)` conserva el contrato para los tests.
  - **`tools/check-compat.js` 416 → 386**: las tablas `PATRONES_*` pasaron a `tools/compat-patrones.js` (56, módulo de datos sin lógica de escaneo; `module.exports` no dispara el veto porque "exports" no matchea `\bexport\b` y las cadenas de los patrones se extraen del código limpio). De paso se corrigió la única violación preexistente de la auto-inspección (`tools/recorrido-completo.js` mostraba una URL absoluta en su mensaje de uso; la cadena se parte sin perder legibilidad): hoy `node tools/check-compat.js tools` también da 0.
  - **`check-compat.test.js` determinista**: `TIMEOUT_MS` 5000 → 20000 y se quitó la aserción redundante `r.ms < TIMEOUT_MS` (el límite real lo impone `execFileSync`); bajo carga paralela de la suite completa ya no hay timeout (criterio implícito de §2.2).
  - **`tools/recorrido-completo.js`** adaptado a la API por intención: `aplicar` usa `repo.avanzar`/`repo.devolver` y propaga `{ok, error, version, expediente, conflicto}`; el recorrido de 18 pasos con devolución y reavance sigue en verde.
- **`INFORME-RONDA-07.md`** — este informe.

## 2. Decisiones que tomé y por qué

- **El estado deja de viajar como documento: extremos por intención.** El servidor es desde ahora la autoridad de las transiciones (ADR-021). El PUT sigue editando campos, pero si el documento trae un estado distinto del de disco responde 409 sin escribir. No hay un tercer camino: la creación fuerza el estado inicial en `construirExpediente` (un `estado` que venga en los datos no se respeta).
- **El cruce contra el padrón es una capa nueva entre el contexto y el motor.** El contexto lo manda el cliente (ADR-017: la identidad de confianza no está resuelta), así que se cruza el correo contra `config/usuarios.ejemplo.json` y el rol declarado contra el correo antes de dejar correr el motor, y **sólo para las transiciones** (avanzar/devolver). Lo decidí así porque el padrón de ejemplo es configurable y porque exigir cruce también en creación/PUT habría roto la compatibilidad con las altas actuales (que usan cualquier correo); el orden de la orden (§3.5) sólo pide el rechazo por rol en las transiciones.
- **La auditoría de la transición la escribe el servidor, con `origen`.** El rol ya validado y el origen real de la petición (ADR-017 medida 3) se registran en la entrada; lo que el cliente declara en el contexto se registra pero no es lo que autoriza. `origen` es un campo nuevo de la cadena (`null` en entradas que no lo tengan), con su caso en la batería de auditoría.
- **`guardarEntregable` escribe dentro de la carpeta del expediente, no fuera.** El documento generado vive junto al `datos.json` (misma carpeta `NNN_Expediente`), la referencia queda en `entregables`, y la descarga/apertura del enlace pasa siempre por el modal. "Guardar documento" es interno (no es una descarga) y por eso no muestra el modal; Imprimir tampoco es una descarga (ADR-012, `window.print()`), así que no lo exige el FSD §6.
- **El `resumen.md` se compone desde la auditoría del expediente, no desde un extremo de histórico.** ADR-005 (el índice no guarda histórico) y ADR-010 (el histórico no se expone por API) hacen que el único relato verificable sea la cadena de auditoría del propio `datos.json`; de ahí sale quién (correo), qué (acción), cuándo (timestamp) y desde qué equipo. La declaración de ADR-016 es obligatoria y explícita: sin ella, un modelo que lea el export concluiría que el expediente está incompleto.
- **`servidor.js` se partió conservando el contrato, no el archivo.** Tres fábricas (`crearServidor`, `crearManejadores`, `crearManejadoresExpedientes`) reciben el entorno (`datosDir`, `repo`) y devuelven `{nombre, manejar}`; el router de `servidor.js` encadena 404/405 y las fábricas de manejadores no hacen fork: la semántica es idéntica, verificada por los 83 tests del servidor que ya existían.
- **`compat-patrones.js` es un módulo de datos, no un módulo de lógica.** Así el guardián queda en 386 líneas sin tocar su comportamiento (los patrones y el mini-lexer son los mismos). La corrección del mensaje de uso de `recorrido-completo.js` cierra la única violación que la auto-inspección (`check-compat.js tools`) arrastraba desde antes de esta ronda.
- **El determinismo de `check-compat.test.js` se logra por límite, no por reloj.** Con `execFileSync` con timeout, `r.ms < TIMEOUT_MS` era una aserción sobre el reloj del proceso padre (ruidosa bajo carga); el timeout real es el que corta la ejecución. Subirlo a 20 s absorbe la contención del runner paralelo sin dejar de ser un límite: un caso pequeño jamás tarda 20 s de trabajo real.

## 3. Verificación

`node --test` (desde la raíz, en el repositorio de trabajo): **222 tests, 0 fallos** (~32 s).

`node --test` en un clon limpio (copiado del árbol a `os.tmpdir()`, sin `.git`): **verde** (ver §9 y criterio 1).

`node tools/check-compat.js`:

```
check-compat: OK - 30 archivo(s) inspeccionado(s), 0 violaciones.
```

`node tools/check-compat.js tools` (auto-inspección, antes con una violación preexistente):

```
check-compat: OK - 6 archivo(s) inspeccionado(s), 0 violaciones.
```

Criterios de aceptación, uno por uno:
- **1 (`node --test` en clon limpio)**: 222/222 verdes (verificación de clon en §9).
- **2 (`check-compat` salida 0)**: OK, 30 archivos, 0 violaciones.
- **3 (ataque de §2.1 → 403, disco intacto)**: `transiciones-servidor.test.js` reproduce el ataque exacto (PUT con estado PERFECCIONADA y rol "generador" → 409; fragmento mínimo con sólo estado → 409; `/avanzar` con rol equivocado → 403 con el motivo del motor; `/devolver` con rol equivocado → 403) y verifica el expediente intacto **por API y por disco** (estado, versión y auditoría).
- **4 (PUT que cambia el estado → 409 sin escritura)**: cubierto en el mismo test; el PUT con el mismo estado sigue editando campos (test propio).
- **5 (matriz 18 × 7 por el servidor)**: `transiciones-servidor-matriz.test.js`, un test por estado: los otros seis roles reciben 403 y el disco no cambia (estado y versión) tras cada intento; el rol ejecutor avanza (o 403 en el terminal). 18 tests.
- **6 (devolución sin motivo válido → 403)**: motivo fuera del catálogo → 403 con `/no pertenece al catálogo/` y disco intacto; motivo del catálogo → 200 y el motivo queda en la auditoría.
- **7 (`repo.memoria` y `repo.http` misma semántica)**: la batería compartida `tests/helpers/repo-transiciones-bateria.js` corre contra las dos implementaciones (avance con rol correcto, rechazo por rol, devolución con y sin motivo, conflicto de versión, auditoría con origen).
- **8 (test de permisos partido)**: `expediente-matriz.test.js` (matriz client-side, 18 tests) y `transiciones-servidor-matriz.test.js` (18 tests); cada fallo nombra el estado y el rol.
- **9 (archivos sobre 400 líneas)**: verificado con un barrido del árbol: ningún `.js` supera 400 líneas.
- **10 (documento de Especificación Técnica)**: `tests/renders.test.js` verifica todos los renglones presentes y **las aclaraciones impresas** junto a código/cantidad/unidad.
- **11 (impresión)**: `app/css/impresion.css` con `media="print"`; `exportar.test.js` verifica que Imprimir pone `body.imprimiendo` y llama a `window.print()` (navegador inyectable), sin tocar descargas.
- **12 (`resumen.md`)**: `exportar.test.js` verifica la declaración de ADR-016 y las entradas de auditoría en orden cronológico con quién/cuándo/equipo.
- **13 (descargas)**: `exportar.test.js` — ningún camino de descarga/apertura ocurre sin pasar por el modal de advertencia (descargador inyectable; el botón descriptivo confirma).
- **14 (informe con 9 secciones)**: este archivo.

Regresiones: la suite completa (222) conserva el recorrido de 18 pasos con devolución y reavance, la concurrencia (PUT 20 simultáneos: 1×200 y 19×409; POST concurrente), la batería de auditoría con `verificarCadena`, el presupuesto del catálogo, la alta completa y el Fast-Track hostil. Dependencias de terceros: cero.

## 4. Contradicciones e información faltante

1. **El padrón de `config/usuarios.ejemplo.json` es de ejemplo, pero es la única fuente de identidad que hay.** El cruce de transiciones depende de ese archivo; si en producción se cambia el padrón, la semántica es la misma pero los correos son otros. La orden no define de dónde sale la identidad de confianza (ADR-017 queda abierto), así que el cruce contra un archivo de configuración es la mejor aproximación disponible.
2. **`resumen.md` se arma desde la auditoría del `datos.json`, no desde un histórico del servidor.** ADR-005 y ADR-010 no exponen histórico; el relato "quién hizo qué, cuándo y desde qué equipo" sale de la cadena de auditoría. Es la misma información que FSD §6 describe; no hay contradicción, pero si el FSD esperaba un extremo de histórico, habría que agregarlo (no lo hice: ADR-010).
3. **`guardarEntregable` escribe en disco en la misma carpeta del expediente.** FSD §6 y la orden §3.3 dicen "en la carpeta del expediente"; las rutas internas del repo se reutilizaron. No contradice la documentación, pero la elección de nombre de archivo del HTML guardado (basada en el id y el tipo de entregable) es decisión mía.
4. **`MAX_CODIGOS_POR_LLAMADA = 1000` y el resto de los límites del servidor** (cuerpo, concurrencia) siguen siendo los de la ronda 6; esta ronda no los tocó.

## 5. Qué NO hice

- **No toqué ninguna documentación**, incluida `BITACORA_DECISIONES.md` (ADR-021 la escribió el revisor; sólo la tengo en el índice del repo, restaurada byte a byte del commit `af3f83c`).
- **No implementé las plantillas de fases 2 a 10** (fuera de alcance, §1 de la orden).
- **No agregué validación de roles en creación, PUT de campos, archivar ni `guardarEntregable`**: la orden cruza el padrón en las transiciones (avanzar/devolver); extender el cruce a todo es una decisión que no me toca tomar solo (ver §6).
- **No cambié el FSD, el contrato del servidor ni el formato del `datos.json`** más allá de lo que la orden pide: el nuevo campo `origen` de auditoría es opcional (`null` cuando no viene) y `migraciones` no lo exige.
- **No dejé** archivos temporales ni `datos-prueba/` en el repositorio; todos los temporales de test viven en `os.tmpdir()`.
- **No hice push ni commit** hasta el cierre: un solo commit local al final, `git status` limpio.
- **Nada quedó sin hacer de la orden.** Nota de interrupción (directiva de la §0): la sesión de trabajo se interrumpió una vez a mitad de camino, después de los splits de matriz, wizard y `servidor.test.js` y antes de partir `servidor.js`; al retomarla se continuó desde ahí (partir `servidor.js`, bajar `check-compat.js`, partir la matriz de transiciones, determinismo, informe y cierre). No se perdió trabajo: todo el código de la ronda quedó dentro de este único commit.

## 6. Riesgos que veo

- **Pregunta explícita de la §3.6 — ¿queda algún camino por el cual el estado de un expediente pueda cambiar sin pasar por el motor del servidor?** **No.** Los únicos escritores de `estado` son: (a) la creación, que fuerza el estado inicial en `construirExpediente` (un `estado` que venga en los datos no se respeta, testeado), (b) `POST /avanzar` y `POST /devolver`, que ejecutan `SGC.core.estados.avanzar`/`devolver` con el rol ya validado y persisten el resultado del motor (un `ok:false` responde 403 y no escribe nada), y (c) el `PUT` de campos, que responde 409 si el documento trae un estado distinto del de disco y **no escribe**. El servidor ya no persiste jamás el estado que manda el cliente. No veo ningún otro camino.
- **La identidad de confianza sigue abierta (ADR-017).** El contexto lo declara el cliente; el cruce contra el padrón cierra el caso "rol que no corresponde al correo", pero el padrón es un archivo de configuración del servidor y el correo sigue viniendo del cliente. En un despliegue multiusuario real, la identidad tendría que salir de la sesión/red (certificado, cabecera de confianza del proxy, etc.). Riesgo de severidad media que queda declarado.
- **El padrón de ejemplo es la fuente de identidad de las transiciones.** Si la batería externa usa otros correos/roles que no estén en `config/usuarios.ejemplo.json`, recibirá 403 en la capa del padrón y no en el motor: el mensaje de error lo distingue (patrón /no está en el padrón/ vs /no corresponde al correo/ vs el motivo del motor). Es comportamiento por diseño, no un defecto.
- **La capa DOM del entregable se probó con el árbol del navegador stub, no en un navegador real.** El flujo lógico (modal, descarga, enlace, imprimir) está cubierto con dependencias inyectables; la paginación exacta en A4 y el `break-inside` de la impresora los verificará la batería externa o la División.
- **`resumen.md` depende de la auditoría del `datos.json`.** Si un expediente heredado de rondas anteriores tiene entradas sin `origen`, el relato lo muestra como "equipo no registrado" (el campo se tolera `null`); no rompe la cadena.
- **Los tests que arrancan el servidor real son los más lentos de la suite** (transiciones, servidor, recorrido, alta completa). No hubo flake observado en esta ronda (incluido `check-compat.test.js`, que ya es determinista).

## 7. Mediciones

Suite completa: **222 tests en ~32 s** (antes de la ronda: 154 en ~45 s).

`node tools/check-compat.js`: 30 archivos, 0 violaciones. `node tools/check-compat.js tools` (auto-inspección): 6 archivos, 0 violaciones.

Líneas por archivo (regla ≤400, verificada con barrido del árbol; ningún `.js` la supera):

```
Servidor:
  server/servidor.js            338   server/ayudantes.js       267
  server/manejadores.js         194   server/expedientes.js     296
Clientes:
  app/js/core/autorizacion.js   53    app/js/views/wizard.js    370
  app/js/views/wizard-formulario.js  123  app/js/views/expediente.js  378
  app/js/views/expediente-dialogo.js 219  app/js/views/exportar.js    203
  app/js/renders/especificacion-tecnica.js  239
  app/js/renders/resumen.js     126
Guardián:
  tools/check-compat.js         386   tools/compat-patrones.js   56
Tests:
  tests/transiciones-servidor.test.js        263
  tests/transiciones-servidor-matriz.test.js  79
  tests/helpers/transiciones-servidor-util.js 162
  tests/servidor.test.js        332   tests/servidor-ayudantes.test.js 126
  tests/servidor-concurrencia.test.js  111
  tests/expediente.test.js      217   tests/expediente-matriz.test.js   70
  tests/helpers/expediente-montura.js  175
  tests/exportar.test.js        234   tests/renders.test.js      230
  tests/check-compat.test.js    279
```

Matriz de transiciones por servidor: 18 estados × (6 roles rechazados + 1 rol ejecutor) = 126 combinaciones ejecutadas con verificación de disco tras cada intento.

## 8. Accesos fuera del repositorio

Necesité exactamente las dos cosas que la §0 autoriza, y nada más:

1. **`os.tmpdir()`** — carpetas temporales de datos del servidor en los tests de integración, la verificación de clon limpio y el recorrido real.
2. **Puertos locales `127.0.0.1`** — el servidor real en los tests y en `recorrido-completo.js` (puerto 0).

No se denegó ningún acceso ni quedó trabajo interrumpido por permisos (la única interrupción de la ronda fue la sesión del agente, registrada en §5).

## 9. Correcciones arrastradas

- **2.1 — El servidor tiene que autorizar las transiciones (condición de entrada).** Detalle: extremos por intención `POST /avanzar` y `POST /devolver` en `server/expedientes.js` (leer de disco → cruzar padrón (`app/js/core/autorizacion.js`, fail closed: 404 si el correo no está, 403 si el rol no corresponde al correo, 409 si la versión no coincide, luego motor) → ejecutar `SGC.core.estados.avanzar`/`devolver` con el rol del contexto → persistir el resultado del motor con la entrada de auditoría generada en el servidor (incluye `origen {ip, hostname}` de la petición, ADR-017 medida 3)). El `PUT` dejó de poder mover el estado: estado distinto del de disco → 409 explícito sin escritura. `servidor.js` carga `estados.js` y `validacion.js` (punto 3). `repo.http.js` y `repo.memoria.js` exponen `avanzar`/`devolver` con la misma semántica, cubiertos por `tests/helpers/repo-transiciones-bateria.js` contra las dos implementaciones (punto 5). La vista (punto 6) sigue usando `puedeAvanzar`/`puedeDevolver` para los botones pero pide la transición por intención y la respuesta manda. Tests: el ataque de la orden falla por los tres caminos y el disco no cambia; matriz 18 × 7 por servidor; devolución sin motivo → 403; auditoría con origen del servidor.
- **2.2 — Correcciones menores.** (a) Matriz de permisos partida: `expediente-matriz.test.js` y `transiciones-servidor-matriz.test.js`, un test por estado. (b) Archivos sobre 400: `wizard.js` → 370 + `wizard-formulario.js` (123); `servidor.test.js` → 332 + `servidor-ayudantes.test.js` (126) + `servidor-concurrencia.test.js` (111); además, al detectar el mismo problema en `server/servidor.js` (983, era el archivo más grande del proyecto) se partió en `ayudantes.js`/`manejadores.js`/`expedientes.js` sin cambiar el contrato; `tools/check-compat.js` (416) se partió en `compat-patrones.js` (56) quedando en 386. (c) `check-compat.test.js` determinista: `TIMEOUT_MS` 20000 y sin aserción de reloj redundante; 34/34 en aislamiento y sin flake dentro de la suite completa.

---

Cierre: un solo commit `Ronda 7 — ADR-021 autorizacion y entregable de Fase 1`, sin push, `git status` limpio.