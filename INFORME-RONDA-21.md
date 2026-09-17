# INFORME-RONDA-21

Cierre · ORDEN-RONDA-21 (H23 + H16).
La ronda 20 cerró los cuatro silencios y reescribió los tests del asistente;
esta ronda **arregla el defecto de la versión vieja** (una persona sola se
quedaba en conflicto tras guardar el documento), **cierra los tres caminos que
faltaban** (9 de 9) y **levanta el sistema de estilos de la UOC** sobre la
aplicación y sobre los entregables impresos.

---

## 1. Resumen ejecutivo

- **§1 (el defecto).** `exportar.js` recibía la versión nueva del servidor y la
  usaba sólo para un mensaje: la vista del expediente se quedaba con la versión
  vieja y el siguiente "avanzar" respondía 409. Corrección de 3 líneas: tras
  guardar, se llama a `SGC.views.expediente.abrir(...)`, el mismo patrón que ya
  usaban presupuestos y anexos. Además, el 409 ahora distingue "lo modificó
  otro operador" de "lo modificaste vos en otra pestaña": el servidor recuerda
  quién escribió la última versión (ADR-042) y el mensaje ya no manda a buscar
  un compañero inexistente.
- **§2 (los tres caminos).** C6 (cadena de roles hasta la firma con el
  fast-track real), C7 (las catorce claves leídas de la pantalla y tres
  ingresos) y C9 (salir y volver) quedan cerrados sobre la montura real con
  test que los recorre entero por el DOM. **9 de 9 caminos de persona.**
- **§3 (H16 · sistema de estilos).** Todo el color y la tipografía de la
  aplicación pasa a una única capa de variables (`css/tokens.css`): cambiar el
  primario es una línea. `main.css` se reescribió entero consumiendo la capa.
  Los tres pedidos del Jefe se cumplen: padrón como tabla con filas alternas,
  botones agrupados que responden al ancho, y el FAB ya no es un `?` ("Sugerir").
  Los entregables impresos adoptan el sistema directo de la UOC (familia,
  filetes, márgenes, tablas, membrete).
- La suite completa termina en **420 tests, 420 pass, 0 fail** (~294 s),
  guardián de compatibilidad sin violaciones.

---

## 2. §1 — El defecto de la versión vieja

`guardarDocumento()` en `exportar.js` recibía del servidor la versión nueva
(`respuesta.version`) y la usaba para el cartelito de "Documento guardado" y
para enlazar el archivo, pero nunca se la pasaba a la vista del expediente.
El siguiente "avanzar" mandaba la versión anterior → 409 "modificado por otro
operador" con una sola persona y una sola pestaña. Se copió el patrón que ya
existía en `requerimiento-presupuestos.js:110` y en
`requerimiento-formulario.js:156`:

```
exportar.js:190  if (SGC.views.expediente && typeof SGC.views.expediente.abrir === 'function')
exportar.js:191    SGC.views.expediente.abrir(expediente.expedienteId);
```

`expediente.abrir()` vuelve a leer el expediente, refresca `estado.version` y
re-renderiza; el avance siguiente sale con la versión fresca. El test
`ronda-20.test.js` ya no pide el recargar manual y espera a que el documento se
re-monte solo tras guardar (la espera expira sin el fix).

### El mensaje, además

El conflicto distinguía mal los casos. Con el patrón de arriba el conflicto no
debería aparecer en la sesión propia, pero si pasa, el mensaje tiene que ser
cierto. Para eso el servidor ahora recuerda quién escribió la última versión
(ADR-042): `ultimoUsuario` y `ultimaModificacion` se guardan en toda mutación y
viajan en el 409. Las vistas (`expediente.js`, `anexo-uno.js`,
`requerimiento-formulario.js`) comparan contra el operador de la sesión:
misma cuenta → "después de que usted lo abrió (posiblemente en otra pestaña)";
otra cuenta → "por otro operador". El 409 del servidor repartió así:

| Qué devuelve el 409 | Antes | Ahora |
|---------------------|-------|-------|
| `versionRemota` | sí | sí |
| `ultimoUsuario` / `ultimaModificacion` | no | sí (ADR-042) |

### Lista completa de escrituras que devuelven versión

La cuenta que pedía la orden (todas: entregables, presupuestos, adjuntos,
ANEXO 1, requerimiento, avance, devolución, archivado):

| Escritura | Servidor devuelve | Qué hace la vista | ¿Toma la versión? |
|-----------|-------------------|-------------------|-------------------|
| Guardar documento (`guardarEntregable`) | `201 {ruta, version}` (`server/expedientes.js:271`) | `exportar.js:184` — mensaje con la versión + enlace; **ahora** `expediente.abrir()` | ✔ (fix §1) |
| Guardar ANEXO 1 (`guardarExpediente`) | `200 {version}` (`:389`) | `anexo-uno.js:348` — `estado.version = resp.version` + **abrir()** | ✔ |
| Guardar requerimiento (`guardarExpediente`) | `200 {version}` | `requerimiento-formulario.js:155` — mensaje + `expediente.abrir()` | ✔ |
| Avanzar (`avanzar`) | `200 {version, expediente}` (`:185`) | `expediente.js:349` — `estado.version = respuesta.version` vía `manejarResultado` | ✔ |
| Devolver (`devolver`) | `200 {version, expediente}` | ídem `manejarResultado` | ✔ |
| Guardar presupuesto adjunto | `201 {id, ruta, peso, version}` (`server/presupuestos.js:114`) | `requerimiento-presupuestos.js:109` — mensaje + `expediente.abrir()` | ✔ |
| Archivar (estado EDITADA) | `200 {version, expediente}` (archiva sin subir versión, `server/expedientes.js:170`) | `manejarResultado` → `abrir()` | ✔ |
| Crear expediente / cargar base | `201 {id, version, expediente}` (`:100`) | `wizard.js` / `usar-base` → `abrir()` | ✔ |

**Conclusión de la auditoría.** La única escritura que tiraba la versión fresca
era el guardado del documento (`exportar.js`); las otras dos que escriben
entregables ya llamaban `expediente.abrir()`. Repetido en `repo.memoria.js`,
que ahora también devuelve `ultimoUsuario`/`ultimaModificacion` en el conflicto
(paridad de contrato con el adaptador HTTP y el servidor, verificada por la
batería de repos y por `servidor.test.js`).

---

## 3. §2 — Los tres caminos que faltan · 9 de 9

Tres tests nuevos sobre la montura real, con un helper común
(`tests/helpers/circuito-ronda-21.js`) que camina el DOM de verdad
(importar padrón por el área de importación, cambiar sesión con la clave que
vio la persona, abrir el expediente desde el tablero, guardar el documento del
estado, avanzar por botón).

- **C6 · `ronda-21-c6.test.js`.** Importa el padrón (14 claves por el área de
  importación), el generador crea el expediente con el **fast-track real** (un
  JSON modelo subido por el input `#sgc-archivo-modelo`, no por API), y después
  cada rol del circuito entra desde su cuenta, abre el expediente desde el
  tablero, guarda el entregable obligatorio de su estado y avanza por botón
  hasta PERFECCIONADA (archiva en el servidor). Prueba que la matriz de 18 × 7
  funciona en la pantalla y no sólo en el núcleo: cada avance es un botón de la
  vista.
- **C7 · `ronda-21-c7.test.js`.** Importa `PADRON_INICIAL.csv` (el sintético de
  catorce operadores con la misma estructura que el real) por el área de
  importación, lee **las catorce claves de la pantalla** y entra con tres de
  ellas (generador, jurídica, contaduría) usando la clave que vió la persona.
  También cubre el cambio de clave obligatorio en el primer ingreso y la
  reentrada con la clave fija.
- **C9 · `ronda-21-c9.test.js`.** Con una sesión de operador activa, sale:
  quedan **una** pantalla de ingreso limpia (la lista del modo declarado oculta,
  el cambio de clave no expuesto, la aplicación oculta) y vuelve a entrar con
  la clave fija.

**La cuenta: 9 de 9.**

| Camino | Sostenido por |
|--------|---------------|
| C1 y C8 (ingreso/padrón y el circuito autenticado con borrador) | `ronda-19-auth`, `ronda-19-padron`, `ronda-19-borrador` |
| C2 completo · generador carga requerimiento real + presupuestos | `ronda-20` |
| C3 · guarda el documento y exporta | `ronda-20` (pliego real contra generador python, declarado) |
| C4 · avanza por el botón de su rol | `ronda-20` |
| C5 · ANEXO 1 completo | `ronda-20` + `ronda-20-anexo` |
| C6 · cadena de roles hasta la firma (fast-track real) | `ronda-21-c6` (nuevo) |
| C7 · repartir las catorce claves | `ronda-21-c7` (nuevo) |
| C9 · salir y volver | `ronda-21-c9` (nuevo) |

Cada camino es verificable quitando la corrección que lo sostiene (los fixes
no tienen código de testeo dentro de la app; toda la complejidad vive en
`aplicacion-montura.js` y `circuito-ronda-21.js`).

---

## 4. §3 — H16 · el sistema de estilos

### La capa de variables

`app/css/tokens.css` es la **única** capa de colores y tipografías de la
aplicación: la paleta de la UOC (navy `#0E2748`, dorado, papel cálido,
semáforos de estado), las tres familias IBM Plex con pila de respaldo local
(sin enlazar nada: ADR-018), las medidas de pantalla, los radios, las
sombras y las espaciadoras. `index.html` la carga antes de `main.css`.

`app/css/main.css` fue reescrito en su totalidad para **no escribir un color ni
una tipografía a mano**: todo se declara con `var(--…)`. Cambiar el color
primario de toda la aplicación es una línea:

```
tokens.css  --color-primario: #0E2748;
```

El guardián de compatibilidad se extendió al CSS nuevo (anidamiento nativo,
`text-wrap: balance`, `:user-valid/:user-invalid` vetados) y no halló
violaciones.

### Los tres pedidos del Jefe

1. **Padrón como tabla** (`index.html` → `<table class="padron-tabla">` con
   `<thead>` de cinco columnas y `<tbody id="sgc-padron-lista">`;
   `padron-admin.js` renderiza `<tr>/<td>`). Cabecera navy sobre blanco y
   **filas alternas** por zebra (criterio del sistema). Acceso por teclado con
   `scope="col"` y `aria-label` en la tabla.
2. **Botones agrupados con sentido**: las acciones de documento, expediente,
   diálogos, filtros de padrón/sugerencias/archivo/kanban y la navegación van
   en contenedores flex con espacio uniforme (`gap`), y la disposición
   responde al ancho con media queries (las herramientas quedan arriba y las
   tablas conservan sus columnas hasta pantallas chicas).
3. **El FAB deja de ser un `?`**: `sugerencias.js:210` → `textContent =
   'Sugerir'`, redondeado, con `aria-label`. Se lee como "enviar una
   sugerencia", no como "ayuda".

### Los entregables impresos adoptan el sistema directo

`app/js/renders/documento.js` (bloque `ESTILOS`) y `app/css/impresion.css`
fueron rediseñados con el sistema de la UOC: A4 vertical con márgenes
asimétricos (25 / 22 / 30 / 25 mm), cuerpo en serif 11 pt con interlínea 1.55,
etiquetas en sans versales, identificadores en mono, **membrete de tres
líneas en versales** (Fuerza Aérea Argentina / VII Brigada Aérea / División
Contrataciones Moreno), filete principal 1 pt navy bajo la cabecera y filete
secundario 0.5 pt gris regla en el pie, y **tablas con cabecera navy y filas
alternas**. El `@page` de impresión lleva el nombre del documento y la
numeración "PÁG. NN / TT". Un documento salido de la aplicación y uno del
generador de la UOC se ven de la misma familia, sin retoques.

**Qué quedó fuera del sistema de estilos y por qué** (criterio de la orden §5):

- **El escudo/membrete con imagen no se usa**: el sistema del paquete exige el
  archivo de logo que la app no puede enlazar (ADR-018, y el acceso al paquete
  es de sólo lectura). Se adoptó el bloque **textual** de tres líneas que el
  propio design-system define como obligatorio; si el Jefe quiere el escudo,
  hay que copiar el asset al repositorio (decisión institucional, no de la app).
- **Las fuentes IBM Plex no se distribuyen en el repo**: se declaran por
  nombre con pila de respaldo local (Helvetica/Arial/Georgia/Times/Courier).
  El criterio de una línea para el primario sigue intacto; la fuente tipográfica
  la provee el equipo o cae a la pila de sistema.
- **La acreditación de la impresión real en A4** (que el navegador de Chrome
  109 de la PC del parque respete `@page`, el membrete y el corte de tablas)
  **queda pendiente de verificación física**: acá se valida el CSS y el DOM,
  no el render. Se declara explícitamente (H16-6 del plan) en vez de darse
  por terminada.
- **La accesibilidad de contraste y teclado** del sistema nuevo (ratio de la
  cabecera navy/blanco, foco visible en la tabla del padrón) queda anotada
  como verificación previa al piloto (H16-7 del plan).

---

## 5. Los tests de esta ronda

| Archivo | Qué cubre |
|---------|-----------|
| `ronda-21-c6.test.js` | C6 — cadena de roles completa por el DOM, fast-track real |
| `ronda-21-c7.test.js` | C7 — catorce claves en pantalla, tres ingresos con la clave que vió la persona |
| `ronda-21-c9.test.js` | C9 — salir deja una pantalla de ingreso limpia y se vuelve a entrar |
| `tests/helpers/circuito-ronda-21.js` | utilidad común de los tres caminos (importar padrón, sesión, tablero, guardar, avanzar) |
| `expediente.test.js` | 1 test nuevo: conflicto con la MISMA cuenta avisa en neutral, no "otro operador" |
| `servidor.test.js` | contrato del 409 ampliado: `ultimoUsuario` y `ultimaModificacion` (ADR-042) |
| `helpers/repo-bateria.js` | paridad del conflicto en `repo.memoria` con el contrato nuevo |
| `ronda-20.test.js` | el guardado del documento ya no exige recargar manual: espera el re-monte automático (fix §1) |

`ronda-13.test.js` se ajustó en una línea: el FAB ya no dice `?`, dice
`Sugerir` (H16-10). Es un cambio de requisito del Jefe (el pedido es que deje
de ser un signo de interrogación), no un retoque de estilo sobre un test; como
la orden §3 exige, está **declarado** acá y no escondido.

---

## 6. Regresión de la suite

| Total | Pass | Fail | Duración |
|-------|------|------|----------|
| 420 | 420 | 0 | ~294 s |

```
check-compat ✔  config ✔  estados ✔  expediente ✔  expediente-matriz ✔
exportar ✔  imputacion-servidor ✔  kanban ✔  migraciones ✔  motor ✔
pantalla ✔  plantillas ✔  presupuestos-servidor ✔  recorrido ✔  renders ✔
repo.http ✔  repo.memoria ✔  requerimiento ✔  requerimiento-formulario ✔
requerimiento-servidor ✔  respaldo ✔  ronda-11 ✔  ronda-12 ✔
ronda-13 ✔  ronda-14 ✔  ronda-15 ✔  ronda-16 ✔  ronda-17 ✔  ronda-18 ✔
ronda-18-bis ✔  ronda-19-auth ✔  ronda-19-borrador ✔
ronda-19-estructural ✔  ronda-19-padron ✔  ronda-20 ✔  ronda-20-anexo ✔
ronda-21-c6 ✔  ronda-21-c7 ✔  ronda-21-c9 ✔  servidor ✔
servidor-ayudantes ✔  servidor-concurrencia ✔  transiciones-servidor ✔
transiciones-servidor-matriz ✔  transiciones-servidor-matriz-2 ✔
validacion ✔  wizard ✔
```

`tools/check-compat.js`: OK · **64** archivos inspeccionados · 0 violaciones.

---

## 7. Contradicciones y observaciones

- **El mensaje de ADR-042 vs. el patrón "vos en otra pestaña".** El servidor
  guarda `ultimoUsuario` en toda mutación, y el 409 lo devuelve siempre. La
  comparación `respuesta.ultimoUsuario !== estado.operador.email` asume que la
  vista conoce al operador de la sesión; en el recorrido real de una pestaña
  es cierto. En los unitarios con `repoFalso` hay que proveer ambos campos o el
  mensaje cae del lado "otro operador" — de ahí que la batería y los tests de
  conflicto se hayan actualizado al contrato nuevo.
- **El fast-track real en C6** sube el JSON por el input de archivo
  (`#sgc-archivo-modelo`) y no por API: es el mismo camino que la persona. Eso
  es lo que hace que la cadena entera (hasta FIRMA y PERFECCIONADA) corra en
  ~minutos con los timeouts del servidor, no en los más de siete minutos del
  navegador del ciclo 20.
- **C7 lee las claves de la pantalla de verdad** (`m.claveEnPantalla`), no de
  una estructura interna: si la vista deja de pintar la clave provisoria, el
  test se pone rojo sin que nada de la API haya cambiado.
- **La única escritura rota era el documento.** Los otros siete caminos de
  escritura ya refrescaban la versión (tabla de §2). La lección de la quinta
  aparición de la familia quedó, esta vez, con auditoría completa sobre el
  repositorio.
- **H16-10 tocó `ronda-13.test.js` en una línea** (el FAB dice "Sugerir").
  Declarado en §5: es cambio de requisito del Jefe, la app dejó de mostrar
  el signo `?` literal que el test aseveraba.

---

## 8. Qué se lleva el paquete

### Aplicación

- `app/css/tokens.css` — **nuevo**. La única capa de variables de color,
  tipografía y medida (H16-1).
- `app/css/main.css` — reescrito completo consumiendo tokens; padrón como
  tabla con filas alternas, botones agrupados responsive, FAB "Sugerir",
  tablas de datos con zebra (H16-2/3/8/9/10).
- `app/css/impresion.css` — reescrito con el sistema directo de la UOC
  (márgenes A4, mismas familias, filetes navy/ink, tablas con cabecera navy,
  membrete, "PÁG. NN / TT").
- `app/index.html` — `tokens.css` antes de `main.css`; padrón convertido a
  `<table>` con `<thead>` y `<tbody id="sgc-padron-lista">`.
- `app/js/views/exportar.js:190` — fix §1: tras guardar el documento,
  `expediente.abrir()` refresca la versión.
- `app/js/views/expediente.js` — `mostrarConflicto` recibe el 409 completo y
  distingue "otro operador" de "otra pestaña" (ADR-042).
- `app/js/views/anexo-uno.js:347` — `expediente.abrir()` tras guardar + aviso
  diferenciado por autor del conflicto.
- `app/js/views/requerimiento-formulario.js:156` — mismo aviso diferenciado.
- `app/js/views/expediente-dialogo.js` — propaga `ultimoUsuario`/
  `ultimaModificacion` del conflicto.
- `app/js/adapters/repo.http.js` + `repo.memoria.js` — el 409 transporta y
  respeta el contrato nuevo.
- `app/js/renders/documento.js` — `ESTILOS`, membrete y encabezado al sistema
  directo (familias, filetes, tablas navy); `fijarTituloImpresion` con la
  familia sans.
- `app/js/views/sugerencias.js:210` — FAB `textContent = 'Sugerir'`.
- `app/js/views/padron-admin.js` — render `tr/td` de la tabla del padrón.
- `server/expedientes.js` — ADR-042: `ultimoUsuario`/`ultimaModificacion` en
  toda mutación y en el 409 (avanzar/devolver/guardar).

### Tests

- `tests/ronda-21-c6.test.js`, `ronda-21-c7.test.js`, `ronda-21-c9.test.js` —
  los tres caminos nuevos, por la montura real.
- `tests/helpers/circuito-ronda-21.js` — helpers comunes de C6/C7/C9
  (importar padrón, cambiar sesión con la clave vista, tablero, guardar,
  avanzar).
- `tests/expediente.test.js` — 1 test: conflicto con la misma cuenta no acusa
  a otro operador.
- `tests/servidor.test.js`, `tests/helpers/repo-bateria.js` — contrato del 409
  ampliado.
- `tests/ronda-20.test.js` — espera el re-monte automático del documento
  (verificación del fix §1 sobre la montura real).
- `tests/ronda-13.test.js` — FAB "Sugerir" (declarado, H16-10).

---

## 9. Criterios de aceptación

### La cuenta, hecha: 9 de 9

- [x] **C1 / C8** — ingreso/padrón y el circuito autenticado con borrador
      (`ronda-19-*`, verdes).
- [x] **C2 completo** — generador carga un requerimiento real del catálogo y
      2 presupuestos por la pantalla (`ronda-20`).
- [x] **C3** — guardar el documento y exportar con modal; el pliego real
      contra el generador python queda declarado.
- [x] **C4** — el expediente avanza por el botón que ve esa persona
      (`ronda-20`).
- [x] **C5** — el ANEXO 1 se llena, guarda y persiste (`ronda-20-anexo`).
- [x] **C6** — la cadena de roles hasta la firma, con el fast-track real y la
      archivación final (`ronda-21-c6`).
- [x] **C7** — las catorce claves leídas de la pantalla y tres personas entran
      con la clave que vieron (`ronda-21-c7`).
- [x] **C9** — salir deja una pantalla de ingreso limpia y se vuelve a entrar
      (`ronda-21-c9`).

### La lista

- [x] **Fix §1** — guardar el documento y avanzar el expediente sin pasar por
      conflicto, una persona y una pestaña (`ronda-20` lo exige; el recargar
      manual desapareció del test).
- [x] **Lista completa de escrituras que devuelven versión** y qué hace la
      vista con cada una (§2 de este informe: 8 escrituras auditadas, una sola
      rota, corregida).
- [x] **El mensaje** — "otro operador" sólo se dice cuando en efecto lo
      modificó otro; con la misma cuenta avisa "otra pestaña" (ADR-042,
      tests).
- [x] **9 de 9 caminos** con test que los recorre entero.
- [x] **Cambiar el primario de toda la aplicación es una línea** — `tokens.css`
      (H16-1).
- [x] **Entregable impreso de la app y del generador se ven de la misma
      familia** — `documento.js` ESTILOS + `impresion.css` al sistema directo
      (H16-4).
- [x] **Compatible con Chrome 109** — guardián extendido al CSS nuevo, 0
      violaciones.
- [x] **Padrón como tabla con filas alternas; botones agrupados y responsive;
      FAB "Sugerir"** (H16-8/9/10).
- [x] **Suite completa en verde** — 420/420 tests, 0 fail.
- [x] **Sin tocar tests por estilo** — el único ajuste (`ronda-13`: FAB "Sugerir")
      es el requisito del Jefe y está declarado.
- [ ] **H16-6 impresión física A4** — declarada pendiente de verificación en
      la PC del parque (el CSS y el DOM están, el render no se prueba acá).
- [ ] **H16-7 accesibilidad (contraste/teclado) del sistema nuevo** — anotada
      para el pre-piloto.

---

*Generado al cierre de ORDEN-RONDA-21. Verificado: suite completa en verde
(420/420) y `tools/check-compat.js` sin violaciones.*