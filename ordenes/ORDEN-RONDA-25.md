# ORDEN DE TRABAJO — RONDA 25

SGC · emitida el 2026-09-25 · hito **H24/H9: que el Jefe termine su expediente real**
Reglas: `CICLO_DE_TRABAJO.md` (lista de control, actualizada el 25/09)

**Antes de empezar:** `git log --oneline -3` tiene que mostrar el commit del revisor que
publica **esta** orden. Si no está, **no arranques**: la orden todavía no existe.

**Vale** la §0 de `ORDEN-RONDA-01.md` y las reglas de tiempo de `ORDEN-RONDA-20.md`.
**Accesos:** `os.tmpdir()`, `127.0.0.1`, y **crear `..\auditoria\ciclo-25`** al cerrar.
**Cada pieza: sus tests en verde → `commit` y `push` en el momento.**

**De dónde sale.** Son las piezas 4 a 9 de la ronda 24, que no llegaron. **La ronda 24
cerró sin informe**: esta vez el cierre es obligatorio aunque entre una sola pieza (ver
el final).

---

### Pieza 1 · Se puede abrir lo que se guardó · commit: `Ronda 25 · ver los documentos guardados`

**Dónde:** `requerimiento-formulario.js:181` avisa que el anexo se guardó y no ofrece
cómo abrirlo. El servidor ya lo sirve: `GET /api/expedientes/<id>/entregables/<nombre>`
(`servidor.js:314`, `expedientes.js:306`).

**Cambia:** en el expediente, **la lista de documentos guardados, cada uno con "Ver"**,
que abre una pestaña nueva.

**Test:** guardar un anexo → aparece en la lista → "Ver" pide esa ruta y recibe 200.

### Pieza 2 · Avanzar y Devolver, arriba · commit: `Ronda 25 · acciones arriba`

**Dónde:** `app/index.html:468`. La sección `expediente-acciones` está después del
requerimiento (345), del ANEXO 1 (373) y del documento (454). **Lo midió el auditor.**

**Cambia:** va **debajo de la cabecera del expediente**, antes de todo lo demás.

**Test:** en el DOM, la sección de acciones precede a las de requerimiento, ANEXO 1 y
documento.

### Pieza 3 · La sesión no se corta mientras trabajás · commit: `Ronda 25 · sesión viva`

**Dónde:** `server/sesion.js:22` fija 15 minutos sin pedidos. Cargar renglones a mano
no genera pedidos: el Jefe recibió 401 con la pestaña abierta. `repo.http.js` no trata
el 401.

**Cambia:**

- con teclado o mouse en uso, el cliente **renueva la sesión cada 5 minutos**;
- **la inactividad vence igual a los 15 minutos**, eso no se toca;
- ante un 401, un aviso claro: *"Tu sesión venció. Lo que no guardaste sigue en la
  pantalla: volvé a entrar en otra pestaña y guardá."*

**Test:** con el reloj adelantado, la actividad mantiene la sesión y la inactividad la
vence. El 401 muestra el aviso.

### Pieza 4 · Imprimir sin hojas en blanco · commit: `Ronda 25 · impresión limpia`

**Dónde:** `app/css/impresion.css`. El PDF real del Jefe tiene 10 páginas y **las
cuatro últimas están en blanco**.

**Cambia:** al imprimir no ocupa lugar nada que no sea el documento.

**Test:** las secciones ajenas al documento quedan `display:none` bajo `@media print`.
Si podés medir páginas, mejor. **Decí cuál de las dos cosas hiciste.**

### Pieza 5 · La descripción del ítem se guarda y se imprime · commit: `Ronda 25 · descripción del ítem`

**Dónde:** `app/js/views/pasos.js:152-159` arma el renglón sin `item`, que es la
descripción del catálogo. Todos los documentos imprimen `r.descripcion || r.item`
(`renders/requerimiento.js:130`, `renders/anexo-eett.js:47`). **La columna DESCRIPCIÓN
salió vacía en los 29 renglones del requerimiento real (R58).**

**Cambia:**

- `pasos.js` guarda `item`, y **ninguna escritura del servidor lo pierde**;
- **`tools/completar-descripciones.js`** completa `item` en los expedientes
  existentes desde `app/catalogo` y no toca nada más. La versión anterior queda en
  `hist/`.
- **Sacá las fabricaciones de `descripcion`** de `tests/ronda-13.test.js:219`, `:221`
  y de `tests/ronda-24-c3.test.js:46`.

**Test:**

- un alta por la montura, con ítems del catálogo real → el documento tiene la
  descripción en cada renglón;
- la herramienta sobre un expediente sin `item` → lo completa y el resto queda igual
  byte a byte;
- `git grep -n "descripcion:" -- tests` → **0**.

### Pieza 6 · Corregir renglones en su etapa, y nadie más · commit: `Ronda 25 · corregir renglones`

**Dónde:** los renglones —código, cantidad, unidad, aclaración— sólo se editan en el
alta. Y del otro lado, el auditor probó que **un `abastecimiento` cambia cantidad y
aclaración por PUT y recibe 200** (R53). `apiGuardar` (`expedientes.js:329-416`) sólo
controla la imputación.

**Cambia:**

- **Pantalla:** quien ejecuta el estado actual, en los estados donde el requerimiento
  todavía no se firmó —como mínimo `ESPECIFICACIONES_TECNICAS`; **listá en el informe
  cuáles y por qué**—, ve el editor de renglones. Se reusa `catalogo/renglones.js` con
  `cargar(lista)` y se guarda por PUT con `versionEsperada`.
- **Servidor:** si un PUT **cambia los renglones**, exige `autorizarRolDelEstado`, la
  misma guardia de presupuestos y entregables. Sin eso, 403 en castellano. **No toques
  el resto del PUT**: la matriz completa va en la ronda 26.

**Test:**

- el generador corrige una aclaración en `ESPECIFICACIONES_TECNICAS` → se guarda;
- **el caso del auditor**: un `abastecimiento` manda cantidad 99 → **403** y en el
  disco sigue la cantidad anterior.

Quitá la guardia → el segundo test da rojo.

---

## Cierre · siempre igual, aunque haya entrado una sola pieza

1. `INFORME-RONDA-25.md`, con las nueve secciones, más:
   - qué piezas entraron, con su hash;
   - **qué no entró y por qué** —tope vencido, sesión cortada, bloqueo—, en una línea
     cada una;
   - los estados de la pieza 6;
   - **todos los PUT que hace la pantalla**: vista, estado, rol y campos. Es el insumo
     de la matriz de la ronda 26.
2. Commit `Ronda 25 · informe` y `git push`.
3. `git clone https://github.com/contra3000/Contrataciones.git ..\auditoria\ciclo-25`.
   Si la carpeta ya existe, no la toques y avisalo.
4. `git -C ..\auditoria\ciclo-25 log --oneline -1` tiene que dar **el mismo commit**
   que `git log --oneline -1` en `dev\`. **Pegá las dos líneas al final del informe.**

## Tu prueba de 10 minutos · para el Jefe, al cerrar

1. Cerrá la ventana negra, abrí `Iniciar SGC.bat` y apretá **Ctrl+F5**.
2. Como generador, abrí el 2026-001: **"Avanzar" está arriba**. Corregí una aclaración,
   guardá, cerrá y volvé a abrir: **quedó**.
3. Imprimí el requerimiento: **hay DESCRIPCIÓN en los 29 renglones** y no hay hojas en
   blanco. Antes, el revisor te dice cómo correr `completar-descripciones` sobre tu
   expediente.
4. "Ver" en el anexo guardado: **se abre**.
5. Dejá la pestaña 20 minutos mientras escribís una aclaración larga y guardá: **no hay
   401**.

## Pasa a la ronda 26

- La matriz de permisos, con el resto del PUT.
- Un servidor por carpeta de datos.
- El entorno de prueba con siete roles.
- El tope de tiempo al `python`.
- Dos valores de referencia por defecto.
- "Cantidad máxima = total".
- Las ayudas de los campos del requerimiento.
- La bitácora al día.
- Los topes de B2.
- `estado-ciclo`.
- El logo.
