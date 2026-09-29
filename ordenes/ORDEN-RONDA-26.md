# ORDEN DE TRABAJO — RONDA 26

SGC · emitida el 2026-09-29 · hito **H24/H9: el expediente real pasa por Abastecimiento**
Reglas: `CICLO_DE_TRABAJO.md` (lista de control)

**Antes de empezar:** `git log --oneline -3` tiene que mostrar el commit del revisor que
publica **esta** orden. Si no está, no arranques.
**Vale** la §0 de `ORDEN-RONDA-01.md` y las reglas de tiempo de `ORDEN-RONDA-20.md`.
**Accesos:** `os.tmpdir()`, `127.0.0.1`, y **crear `..\auditoria\ciclo-26`** al cerrar.
**Cada pieza: tests en verde → `commit` y `push` en el momento.**

**De dónde sale.** El 28/09 el Jefe llevó su expediente real hasta Abastecimiento. Ahí
"Avanzar" pareció no hacer nada, y el documento de la SCo resultó ser el
requerimiento con otro título. El revisor lo reprodujo con sus datos. Y el 29/09 el
Jefe definió cómo es la SCo en la realidad (pieza 4).

---

### Pieza 1 · Los datos del expediente sin guiones · commit: `Ronda 26 · datos del expediente`

**Dónde:** `app/js/views/expediente.js:158-159` lee `expediente.id` e
`identificacion.numero`. El expediente guarda **`expedienteId`** y **`numero`**. En el
panel "Datos", "Expediente" y "Número" salen **"—"** en los expedientes reales.

**Cambia:** leer los campos que existen.

**Test:** con un expediente **creado por la montura**, no fabricado, el panel muestra
`2026-001` y el número. Buscá si otro lugar lee `expediente.id` y ponelo en el informe.

### Pieza 2 · "Avanzar" dice qué falta, antes de apretarlo · commit: `Ronda 26 · avanzar explica`

**Dónde:** `expediente.js:279-283` habilita "Avanzar" sólo por el rol. El requisito
del estado recién aparece al apretar, con el id técnico: *"Faltan requisitos para
avanzar (entregables: solicitud-contratacion)"*.

**Cambia:**

- la vista llama a `SGC.core.validacion.validarParaAvanzar(expediente)`, la misma que
  usa el servidor;
- si falta algo, "Avanzar" queda **deshabilitado** y al lado dice qué falta **y cómo
  resolverlo**, con el **título** del entregable (`config.ENTREGABLES[].titulo`) o del
  campo, nunca el id. Por ejemplo: *"Falta: guardar el ANEXO I (botón 'Guardar
  documento generado', más abajo)"*;
- el mensaje del servidor también usa títulos.

**Test:** un expediente sin su entregable → "Avanzar" deshabilitado y el texto nombra
el título. Guardado el entregable → se habilita.

### Pieza 3 · Nada del sistema espera para siempre · commit: `Ronda 26 · tope al generador`

**Dónde:** `server/pliego-probador.js:115`, un `spawn('python', …)` sin tope.

**Cambia:** tope de tiempo, **matar el proceso** al vencer, y respuesta en castellano.
Buscá con la búsqueda entera otros `spawn`, `exec` o esperas sin tope en `server/`, y
ponelos en el informe.

**Test:** un script que se cuelga a propósito → el pedido termina con el error y el
proceso no queda vivo.

### Pieza 4 · La SCo se registra, no se genera · commit: `Ronda 26 · número de SCo`

**Definición del Jefe (29/09):** la SCo se arma en **COMPR.AR**. En la aplicación,
Abastecimiento **sólo carga el número de SCo**, que puede juntar varios requerimientos.
Lo firmable es el **ANEXO I**, **uno por SCo**. Desde ahí, los requerimientos de una
misma SCo **corren juntos**.

**Esta ronda hace sólo la primera parte:** el número. Juntar los requerimientos y el
ANEXO I por SCo es la ronda 27, con su ADR (`ADR-PROPUESTA-AGRUPAMIENTO.md`). **No lo
adelantes**, pero no hagas nada que lo impida.

**Dónde:** `config.js`. `SOLICITUD_CONTRATACION` exige el entregable
`solicitud-contratacion`, que es el requerimiento re-titulado.

**Cambia:**

- `SOLICITUD_CONTRATACION`: `camposRequeridos: ['numeroSCo']` y **ningún
  entregable**.
- En el expediente, quien ejecuta el estado ve **"Número de SCo (COMPR.AR)"**, en
  texto libre y no vacío, que se guarda en `campos.numeroSCo`. **El mismo número puede
  estar en varios expedientes**, y el expediente muestra *"Esta SCo incluye también:
  2026-00X, …"*.
- La sección de documento de ese estado **no genera nada**. El entregable
  `solicitud-contratacion` deja de existir; los expedientes que ya lo tengan lo
  conservan en el disco.
- `ANALISIS_SCo` **no cambia en esta ronda**.
- **No cambies la matriz de 18 × 7.**

**Test:**

- sin número → no avanza, con el texto de la pieza 2;
- con número → avanza;
- dos expedientes con la misma SCo → cada uno lista al otro.

Los tests que hoy guardan `solicitud-contratacion` para avanzar (`expediente-montura`,
`ronda-14`, `plantillas`) se adaptan, **y va declarado en el informe**.

### Pieza 5 · Dos valores de referencia por renglón, obligatorios · commit: `Ronda 26 · dos valores por renglón`

**Decisión del Jefe (29/09):** cada renglón tiene al menos **dos** valores de
referencia, y **si no, no se avanza**.

**Dónde:** `requerimiento-valores.js` ofrece uno por defecto, y
`validarParaAvanzar` no mira los valores.

**Cambia:**

- el editor muestra **dos lugares por defecto** en cada renglón;
- en `ESPECIFICACIONES_TECNICAS`, `validarParaAvanzar` —el mismo código en cliente y
  servidor— exige 2 o más en cada renglón, y el texto de la pieza 2 lista **cuáles
  renglones** tienen menos.

**Test:** un renglón con 1 valor → no avanza y se nombra el renglón. Con 2 → avanza.
El servidor rechaza igual un avanzar fabricado.

### Pieza 6 · Un solo servidor por carpeta de datos · commit: `Ronda 26 · un servidor por carpeta`

**Dónde:** `server/arranque.js`. Hoy no hay ninguna traba (R57). La próxima etapa del
Jefe es la carpeta compartida.

**Cambia:**

- al arrancar, el servidor deja un candado en la carpeta de datos, con la máquina, el
  proceso y la hora, y lo renueva cada 30 segundos;
- si el candado está vivo, **no arranca** y dice qué máquina lo tiene;
- si no se renovó hace más de 2 minutos, se considera abandonado: se reemplaza y se
  avisa;
- al cerrar, se borra.

**Test:**

- dos servidores sobre la misma carpeta → el segundo no arranca y nombra al primero;
- un candado abandonado → arranca y avisa;
- un cierre normal → el candado desaparece.

---

## Cierre · siempre igual

1. **`INFORME-RONDA-26.md`**, con las nueve secciones. Más:
   - las piezas con su hash;
   - qué no entró y por qué;
   - los lugares que leían `expediente.id` (pieza 1);
   - los `spawn`/`exec` encontrados (pieza 3);
   - los tests adaptados por la pieza 4.
2. Commit `Ronda 26 · informe` y `git push`.
3. `git clone https://github.com/contra3000/Contrataciones.git ..\auditoria\ciclo-26`.
   Si la carpeta existe, no la toques y avisalo.
4. `git -C ..\auditoria\ciclo-26 log --oneline -1` y `git log --oneline -1` en `dev\`
   tienen que dar **el mismo commit**. Pegá las dos líneas al final del informe, **ya
   con el commit final**.

## Tu prueba de 10 minutos · para el Jefe, al cerrar

1. Cerrá la ventana negra, abrí `Iniciar SGC.bat` y apretá **Ctrl+F5**.
2. Como abastecimiento, abrí el 2026-001: el panel "Datos" dice **2026-001**, y
   "Avanzar" está **deshabilitado** con *"Falta: número de SCo"*.
3. Cargá un número de SCo → "Avanzar" se habilita → avanzá.
4. Avanzá hasta Análisis de SCo. Generá el ANEXO I, guardalo e imprimilo: ¿es lo que
   firmarías? (Todavía es por requerimiento; por SCo, en la 27.)
5. Abrí dos veces `Iniciar SGC.bat`: **la segunda ventana dice que la carpeta está en
   uso**.

## Pasa a la ronda 27

- **El agrupamiento por SCo**: avanzan y retroceden juntos, con un ANEXO I por SCo y los renglones sumados (`ADR-PROPUESTA-AGRUPAMIENTO.md`). **Es la prioridad.**

- La matriz de permisos, con el resto del PUT.
- El entorno de prueba con siete roles.
- "Cantidad máxima = total".
- **Las ayudas de los campos, cuando el Jefe corrija el borrador.**
- La bitácora al día.
- Los topes de B2.
- `estado-ciclo`.
- El logo.
