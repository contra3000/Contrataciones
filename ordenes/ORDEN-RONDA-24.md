# ORDEN DE TRABAJO — RONDA 24

SGC · emitida el 2026-09-24 · hito **H24/H9: que el Jefe termine su expediente real**
Plantilla y reglas: `CICLO_DE_TRABAJO.md` (lista de control, 2026-09-23)

**Vale** la §0 de `ORDEN-RONDA-01.md` y las reglas de tiempo de `ORDEN-RONDA-20.md`.
**Accesos:** `os.tmpdir()` y `127.0.0.1`.
**El árbol NO arranca limpio.** El revisor dejó aplicada la pieza 1 sin commit, en 5
archivos (`git status`). Revisalo con `git diff` antes de commitearlo.
**Cada pieza: sus tests en verde → `commit` y `push` en el momento.** Lo que no entre
pasa a la ronda 25.

**De dónde sale.** El 24/09 el Jefe cargó un expediente real de 29 renglones, con tres
presupuestos de hasta 19,5 MB que subieron bien. Dejó 8 sugerencias y **no pudo pasar a
Abastecimiento**. El revisor lo reprodujo con sus datos en la aplicación real. Las causas
son las de abajo, verificadas.

---

### Pieza 1 · Botones y entradas que no se veían · commit: `Ronda 24 · botones y entradas visibles`

**Dónde:** ya aplicado en `app/index.html`, `app/css/main.css`, `app/js/app.js`,
`tests/helpers/aplicacion-montura.js` y `tests/helpers/circuito-ronda-21.js`.

**Qué cambia:**

- **Botones primarios invisibles.** `.tablero-nav button` y `.accion-bloque button`
  tenían la misma especificidad que `button.primario`, estaban después y le pisaban el
  fondo con blanco. Quedaba **texto blanco sobre fondo blanco**: "Avanzar" y "Alta de
  Especificación" eran cajas vacías hasta pasar el mouse. Se borraron las dos reglas,
  que además repetían el fondo del `button` base.
- Quien no puede originar **aterriza en el Tablero** (`puedeOriginar` en `app.js`).
- La barra va **fija arriba**, y "Padrón" pasa a decir **"Usuarios"**.
- Los helpers esperan `#sgc-sesion-barra`, no `#sgc-app`, como señal de que alguien
  entró.

**Test:**

- un supervisor cae en `#sgc-kanban` y un generador en el alta;
- **un test que lea `main.css` y falle si una regla posterior a `button.primario`
  cambia `background-color` a botones sin excluir `.primario`**.

Quitá `puedeOriginar` de `operadorSeleccionado` → rojo. Volvé a poner
`.accion-bloque button { background-color: … }` → rojo.

### Pieza 2 · La suite corre igual en cualquier clon · commit: `Ronda 24 · suite reproducible`

**Dónde:** `SGC_GENERADOR_PLIEGOS` se fija en `ronda-16`, `-17` y `-18` y **falta** en
`ronda-23-c2.test.js`.

**Cambia:** un solo lugar en `tests/helpers/`, del que la toman los cuatro.

**Test:** la suite completa en el clon limpio del auditor da **0 fallas**.

### Pieza 3 · "Agregar valor" no te manda arriba · commit: `Ronda 24 · agregar valor no salta`

**Dónde:** `app/js/views/requerimiento-valores.js:186 render()`. Borra todos los
bloques y los vuelve a crear; el contenedor se achica un instante y el navegador vuelve
al principio de la página. Con 29 renglones, eso lleva al primer ítem.

**Cambia:** guardar la posición del scroll antes de reconstruir y restaurarla después.
El foco queda en el campo nuevo.

**Test:** en la montura, con 20 renglones, "Agregar valor" en el renglón 15 → el campo
nuevo existe y tiene el foco.

### Pieza 4 · Se puede abrir lo que se guardó · commit: `Ronda 24 · ver los documentos guardados`

**Dónde:** `requerimiento-formulario.js:181` avisa *"Anexo(s) de EETT generado(s) y
guardado(s): alfa."* y **no hay forma de abrirlo**. El servidor ya lo sirve:
`GET /api/expedientes/<id>/entregables/<nombre>` (`servidor.js:314`,
`expedientes.js:306`).

**Cambia:** en el expediente, **la lista de documentos guardados, cada uno con "Ver"**,
que lo abre en una pestaña nueva.

**Test:** guardar un anexo → aparece en la lista → "Ver" pide esa ruta y responde 200.

### Pieza 5 · Avanzar y Devolver, arriba · commit: `Ronda 24 · acciones arriba`

**Dónde:** `app/index.html:468`. `<section class="expediente-acciones">` está **al final
del expediente**. Con 29 renglones y los documentos, "Avanzar" queda en el píxel 16.740
de una página de 16.975.

**Cambia:** esa sección pasa **debajo de la cabecera del expediente**, antes de todo lo
demás. El "por qué no" queda al lado de cada botón.

**Test:** en el DOM, la sección de acciones precede a la del requerimiento y a la de
los documentos.

### Pieza 6 · La sesión no se corta mientras trabajás · commit: `Ronda 24 · sesión viva`

**Dónde:** `server/sesion.js:22` fija un vencimiento de **15 minutos sin pedidos**.
Cargar renglones a mano no genera pedidos; el Jefe recibió 401 con la pestaña abierta
y tuvo que reiniciar. `repo.http.js` no trata el 401.

**Cambia:**

- mientras haya teclado o mouse, el cliente **renueva la sesión cada 5 minutos**, con
  un pedido liviano;
- sin actividad, vence igual a los 15 minutos, **no cambia**;
- ante un 401, **un aviso claro** —*"Tu sesión venció. Lo que no guardaste sigue en la
  pantalla: volvé a entrar en otra pestaña y guardá"*— en lugar de un error crudo.

**Test:** con el reloj adelantado, la actividad mantiene la sesión y la inactividad la
vence. Y el 401 muestra el aviso.

### Pieza 7 · Imprimir sin páginas en blanco · commit: `Ronda 24 · impresión limpia`

**Dónde:** `app/css/impresion.css`. El PDF del requerimiento del Jefe tiene **10
páginas, de las cuales la 7, la 8, la 9 y la 10 están en blanco**.

**Cambia:** al imprimir no ocupa lugar nada que no sea el documento.

**Test:** si no se puede medir páginas en la montura, alcanza con que las secciones
ajenas al documento queden `display:none` bajo `@media print`. **Declaralo.**

### Pieza 8 · La descripción del ítem se guarda y se imprime · commit: `Ronda 24 · descripción del ítem`

**Dónde:** `app/js/views/pasos.js:152-159 datosParaPersistir` arma cada renglón con
`codigo`, `cantidad`, `unidad` y `aclaracion`, y **tira `item`**, que es la descripción
del catálogo. Todos los documentos imprimen `r.descripcion || r.item || ''`
(`renders/requerimiento.js:130`, `renders/anexo-eett.js:47`). **La columna DESCRIPCIÓN
sale vacía en los 29 renglones** del requerimiento real.

Los tests no lo ven porque `ronda-13` **fabrica `descripcion` a mano**: es la familia de
siempre.

**Cambia:**

- `pasos.js` guarda `item`;
- el servidor **no lo pierde** en ninguna escritura;
- **`tools/completar-descripciones.js`** completa `item` en expedientes existentes desde
  `app/catalogo` (clases → fragmento → código), **sin tocar nada más** y dejando la
  versión anterior en `hist/`. Es para el expediente 2026-001 del Jefe.

**Test:** un alta por la montura, con ítems buscados en el catálogo real → el documento
impreso tiene la descripción en cada renglón. **Sacá la fabricación de `descripcion` de
`ronda-13`**: el test tiene que pasar por el camino real.

### Pieza 9 · Corregir los renglones en su etapa · commit: `Ronda 24 · corregir renglones`

**Dónde:** los renglones —código, cantidad, unidad, aclaración— **sólo se editan en el
alta**. Después, ni el generador en su propia etapa puede corregir una aclaración.
Sugerencia del Jefe: *"no me permite devolverlo al estado en el que puedo cargar las
descripciones de cada renglón. Debería poder"*.

**Cambia:** en el expediente, **quien ejecuta el estado actual** y sólo en los estados
donde el requerimiento todavía no se firmó —`ESPECIFICACIONES_TECNICAS` y los que decidas,
**listados en el informe**— ve el editor de renglones. Se reusa `catalogo/renglones.js`
con su `cargar(lista)`. Se guarda por el PUT con `versionEsperada`.

**Test:** el generador corrige una aclaración en ESPECIFICACIONES_TECNICAS y se guarda.
Un abastecimiento, en la misma etapa, no ve el editor.

---

## Informe — `INFORME-RONDA-24.md`

Las nueve secciones. Además:

- qué piezas entraron, con el hash de cada una;
- para la pieza 9, los estados donde se editan renglones y por qué;
- **todos los PUT que hace la pantalla**, con vista, estado, rol y campos. Es el insumo
  de la matriz de permisos de la ronda 25.

## Tu prueba de 10 minutos · para el Jefe, al cerrar

1. Cerrá la ventana negra → `Iniciar SGC.bat` → **Ctrl+F5**.
2. Como generador, abrí el expediente 2026-001 → **"Avanzar" está arriba y es azul**.
3. Imprimí el requerimiento → **la columna DESCRIPCIÓN tiene texto en los 29
   renglones** y no hay hojas en blanco al final.
4. En un renglón, "Agregar valor" → **la pantalla no se mueve**.
5. Corregí una aclaración, guardá, cerrá y volvé a abrir → **quedó**.

## Pasa a la ronda 25

- Un servidor por carpeta de datos.
- Entorno de prueba con siete roles.
- La matriz de permisos con el PUT adentro.
- Tope de tiempo al `python`.
- Dos valores de referencia por defecto.
- "Cantidad máxima = total" fácil.
- Textos de ayuda para los campos del requerimiento.
- La bitácora al día.
- Los topes de B2.
- `estado-ciclo`.
- El logo.
