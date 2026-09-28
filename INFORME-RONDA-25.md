# INFORME — RONDA 25

Cada pieza se entregó sola: `commit` y `push` al terminarla. La ronda cierra con
**seis commits** (las piezas 1 a 6 del orden), los seis con su test en verde
antes de commitear. El cierre se hace ahora, como lo pide la orden (§0: la
ronda 24 cerró sin informe; esta vez el cierre es obligatorio).

---

## 1. Qué hice

**Pieza 1 — se puede abrir lo que se guardó** · `0a5b6b2` · `Ronda 25 · ver los documentos guardados`
La lista de entregables del expediente, cada uno con su "Ver" que abre una
pestaña nueva contra `GET /api/expedientes/<id>/entregables/<nombre>`.

**Pieza 2 — Avanzar y Devolver, arriba** · `f51ccf2` · `Ronda 25 · acciones arriba`
La sección de acciones quedó debajo de la cabecera del expediente, antes del
requerimiento, del ANEXO 1 y del documento.

**Pieza 3 — la sesión no se corta mientras trabajás** · `83b3ce5` · `Ronda 25 · sesión viva`
Con teclado o mouse en uso el cliente renueva la sesión cada 5 minutos; la
inactividad vence igual a los 15 minutos; el 401 muestra el aviso *"Tu sesión
venció…"*.

**Pieza 4 — imprimir sin hojas en blanco** · `bfeb232` · `Ronda 25 · impresión limpia`
Bajo `@media print` quedan `display:none` las secciones ajenas al documento, por
niveles. **Hice la prueba de DOM, no la de páginas** (la orden lo permite; ver
§4).

**Pieza 5 — la descripción del ítem se guarda y se imprime** · `97efe81` · `Ronda 25 · descripción del ítem`
`pasos.js` guarda `item` en cada renglón y ninguna escritura del servidor lo
pierde; `tools/completar-descripciones.js` completa `item` en los expedientes
existentes y no toca nada más (su versión anterior queda en `hist/`); se sacaron
las fabricaciones de `descripcion` de `tests/ronda-13.test.js` y
`tests/ronda-24-c3.test.js`.

**Pieza 6 — corregir renglones en su etapa, y nadie más** · `a7cdcab` · `Ronda 25 · corregir renglones`
Editor de renglones para quien ejecuta el estado actual y guardia en el
servidor: si un PUT cambia los renglones, exige `autorizarRolDelEstado`, la
misma guardia de presupuestos y entregables; sin eso, 403 en castellano. El
resto del PUT no se tocó. Los estados donde aparece el editor y los PUT que hace
la pantalla están en §7.

---

## 2. Decisiones que tomé y por qué

- **Pieza 3 — renovar sin llegar al borde.** La actividad renueva la sesión
  cada 5 minutos (sin esperar a los 15 para no arriesgar el 401 entre
  renovaciones) y el vencimiento por inactividad sigue siendo 15 minutos desde
  el último pedido. La renovación no extiende la ventana: solo la mantiene
  viva mientras hay uso.
- **Pieza 4 — el test de DOM, no las páginas.** La orden permite elegir.
  Medir páginas requiere el navegador del Jefe; el DOM bajo `@media print` se
  prueba en la suite y es la garantía repetible.
- **Pieza 5 — centralizar en un script de herramientas.** `completar
  descripciones` vive en `tools/` como las demás herramientas puntuales; la
  versión anterior quedó en `hist/` para poder comparar qué tocó. No toca
  versión, ni auditoría, ni ningún otro campo del renglón.
- **Pieza 6 — un solo estado y la comparación por `JSON.stringify`.** Ver §7.1
  (estados) y §7.2. La guardia compara la serialización de `actual.renglones`
  con la del PUT; como el cliente siempre redondea el objeto que le devolvió el
  `GET`, el orden de las claves es el del propio servidor y la comparación es
  estable (ver el riesgo en §6). Se colocó después de `validarEncabezado` y
  antes del bloque de imputación, y solo actúa cuando los renglones cambiaron.
- **Pieza 6 — el editor es una vista nueva que reusea `catalogo/renglones.js`.**
  No se tocó el alta: la pantalla del expediente monta `renglonesEditor` con su
  propia sección, que llama a `renglones.montar` con `onCambio` noop (para no
  disparar el `guardarBorrador` del wizard). `cargar()` ahora preserva los
  campos del renglón que el requerimiento ya escribió (`valoresReferencia`,
  `cantidadMaxima`, `cantidadMinima`): una corrección de cantidad o aclaración
  no los borra de la escritura.
- **La versión anterior de la herramienta de P5 quedó guardada** y el cierre
  cumplió el clon limpio (§8, fin del informe).

---

## 3. Verificación

```
$ node --test --test-concurrency=4 "tests/*.test.js"
ℹ tests 452
ℹ pass 452
ℹ fail 0
ℹ duration_ms 324279.9056

$ node tools/check-compat.js
check-compat: OK - 67 archivo(s) inspeccionado(s), 0 violaciones.

$ node --test tests/check-compat.test.js
ℹ tests 34 / pass 34
```

Antes de cada commit se corrió el camino rápido de `tests/LEEME.md` con los
archivos tocados por esa pieza (servidor y montura), además de la suite nueva.

**Auditoría E2 de la pieza 6** (la orden pide "quitá la guardia → el segundo
test da rojo"): se sacó la guardia con `git stash` sobre
`server/expedientes.js` y el test del abastecimiento quedó rojo
(`200 !== 403`, `tests/ronda-25-c6.test.js:176`); se restauró con `git stash
pop` y la suite quedó verde. El caso del auditor está cubierto por
`tests/ronda-25-c6.test.js` (test 2).

---

## 4. Contradicciones e información faltante

- **ORDEN-RONDA-25 §6, los estados.** La orden dice "en los estados donde el
  requerimiento todavía no se firmó —como mínimo `ESPECIFICACIONES_TECNICAS`;
  listá cuáles y por qué—". No define la lista: la elegí yo y está en §7.1.
- **ORDEN-RONDA-25 §4, las hojas en blanco.** "Si podés medir páginas, mejor.
  Decí cuál de las dos cosas hiciste." Hice el test de DOM, no la medición de
  páginas (la razón está en §2).
- **ORDEN-RONDA-25 §5, la herramienta sobre el expediente real.** El test usa
  un expediente sintético; correr `completar-descripciones` sobre el R58 real
  depende de los datos del Jefe (la orden lo apunta como prueba de 10 minutos,
  no como pieza).

---

## 5. Qué NO hice

Entraron **las seis piezas**: no hubo pieza caída por tope vencido, ni sesión
cortada, ni bloqueo.

- **No toqué el resto del PUT** de la pieza 6: solo la guardia de renglones.
  La matriz de permisos del PUT completo queda para la ronda 26 (el insumo, en
  §7.2).
- **No medí las páginas reales** de la impresión (pieza 4): se eligió el test
  de DOM.
- **No corrí la herramienta de la pieza 5 sobre el expediente real del Jefe**:
  queda para la prueba de 10 minutos.
- **No usé sub-agentes**: la orden los hace opcionales y ninguna pieza los
  necesitó.
- **No agregué editor fuera de `ESPECIFICACIONES_TECNICAS`** (ver §7.1).

---

## 6. Riesgos que veo

- **La comparación por `JSON.stringify` depende del orden de las claves.** Hoy
  es estable porque el cliente redondea el mismo objeto que le devolvió el
  `GET`, cuyo orden lo fija el propio servidor. Pero la guardia es
  estructuralmente sensible al orden; si en el futuro el cliente reescribe las
  claves en otro orden, la guardia dispararía falsos 403. La matriz de la ronda
  26 puede redefinir esto sin dolor.
- **Quien ejecuta el estado puede cambiar la cantidad a lo que quiera**: es la
  prerrogativa que la orden pide (corregir en su etapa); la guardia solo corta
  al rol equivocado.
- **El singleton de renglones lo comparten el wizard y el editor.** Cada
  `render` del expediente re-monta el editor sobre su sección y el alta
  re-monta el wizard sobre la suya: ambos sobreesciben `estado.dom` del
  módulo. Funciona (los tests lo recorren), pero es un acoplamiento que conviene
  tener presente si el editor o el alta cambian su estructura interna.
- **La suite sigue creciendo** (452 tests, ~324 s de muro). El piso son las
  matrices de transiciones; cada ronda suma encima.
- **El 403 de la guardia no distingue "rol que no ejecuta el estado" de "rol
  que no existe"**: el mensaje es el mismo y en castellano, como pidió la orden.

---

## 7. Mediciones

### 7.1 Los estados de la pieza 6, cuáles y por qué

El editor de renglones aparece **solo en `ESPECIFICACIONES_TECNICAS`**
(`ESTADOS_EDITABLES` en `app/js/views/renglones-editor.js`).

- Quien lo ve es **el generador**, que es el rol que ejecuta el estado actual
  (estado 1). Fuera de ese estado, un generador tampoco lo ve.
- Por qué él y no otro: los renglones —código, cantidad, unidad, aclaración—
  son la base del **documento de EETT**, que se firma al salir del estado. En
  cuanto el estado avanza, esos números ya forman parte de lo firmado y de lo
  que citan el SCo y el ANEXO 1. El lugar natural para corregir la tabla que se
  va a imprimir es **antes** de que se firme, o sea dentro del propio estado 1.
- Las otras fases quedan fuera a propósito: en `SOLICITUD_CONTRATACION` y
  siguientes el requerimiento ya se firmó y el ANEXO 1 (que el abastecimiento
  completa en `ANALISIS_SCo`) se construye sobre esas cantidades. Cambiarlos
  después de la firma obligaría a reconstruir documentación ya firmada.
- El servidor no fija la lista: la guardia vale para **cualquier** estado (si
  un PUT cambia renglones, quien lo hace debe ejecutar el estado actual). La
  pantalla elige mostrar el editor en el único estado donde la orden lo pide.

### 7.2 Todos los PUT que hace la pantalla — insumo de la matriz de la ronda 26

| Vista | Estado | Rol | PUT | Campos |
|---|---|---|---|---|
| Requerimiento (`requerimiento-formulario.js`) | `ESPECIFICACIONES_TECNICAS` | generador | `guardarExpediente` → `PUT /api/expedientes/<id>` | `requerimiento.*` (los campos del formulario, más `condicionesParticulares`) y, por renglón, `valoresReferencia`, `cantidadMaxima`, `cantidadMinima` |
| Editor de renglones (`renglones-editor.js`, nueva) | `ESPECIFICACIONES_TECNICAS` | generador | `guardarExpediente` → `PUT /api/expedientes/<id>` | `renglones` (código, cantidad, unidad, aclaración); los demás campos del renglón se conservan de disco |
| ANEXO 1 (`anexo-uno.js`) | `ANALISIS_SCo` | abastecimiento | `guardarExpediente` → `PUT /api/expedientes/<id>` | `anexo1.*` (las secciones del análisis: objeto, justificación, plazo, moneda, precios de referencia, empresas, personal técnico, requisitos mínimos, visita/muestra, interadministrativa, bienes de uso, hardware/software, reparaciones/infraestructura, documentación obligatoria, criterio de evaluación) |
| Presupuestos (`requerimiento-presupuestos.js`) | estado actual del expediente | el que ejecuta el estado actual (el servidor exige `autorizarRolDelEstado`) | `guardarPresupuesto` → `PUT /api/expedientes/<id>/presupuesto` | el archivo del presupuesto (binario, con progreso) |
| Generar/exportar documento (`exportar.js` y el guardado automático de `requerimiento-formulario.js`) | estado actual del expediente | el que ejecuta el estado actual (el servidor exige `autorizarRolDelEstado`) | `guardarEntregable` → `PUT /api/expedientes/<id>/entregables/<nombre>` | el HTML del documento del estado |

Nota: la guardia nueva de la pieza 6 solo toca el PUT de expediente cuando
cambian los renglones; los otros dos bloqueos de escritura (presupuesto y
entregable) ya existían de la ronda 23.

---

## 8. Accesos fuera del repositorio

- **`os.tmpdir()`** — carpetas de datos de todos los tests (`fs.mkdtempSync`).
- **`127.0.0.1`** — servidores de test, siempre en puerto efímero (`--puerto 0`).
- **`..\auditoria\ciclo-25`** — clon limpio del cierre, creado para esta ronda
  (la orden lo manda; la carpeta no existía y se creó).
- Nada más.

---

## 9. Qué se lleva el paquete — criterios de aceptación (ORDEN-RONDA-25)

| # | Criterio | Resultado |
|---|---|---|
| 1 | Guardar un anexo → aparece en la lista → "Ver" pide la ruta y recibe 200 | Cumplido (pieza 1, `tests/ronda-25-c1.test.js`) |
| 2 | La sección de acciones precede a requerimiento, ANEXO 1 y documento | Cumplido (pieza 2, `tests/ronda-25-c2.test.js`) |
| 3 | La actividad mantiene la sesión y la inactividad la vence; el 401 muestra el aviso | Cumplido (pieza 3, `tests/ronda-25-c3.test.js`) |
| 4 | Al imprimir las secciones ajenas quedan `display:none` bajo `@media print` | Cumplido (pieza 4, `tests/ronda-25-c4.test.js`; se eligió el test de DOM, no la medición de páginas) |
| 5 | El alta por la montura guarda la descripción en cada renglón; la herramienta completa `item` sin tocar el resto; `git grep "descripcion:" -- tests` → 0 | Cumplido (pieza 5, `tests/ronda-25-c5.test.js`) |
| 6 | El generador corrige una aclaración en EETT y se guarda; el caso del auditor (abastecimiento, cantidad 99) da **403** y el disco sigue intacto; quitando la guardia el segundo test da rojo | Cumplido (pieza 6, `tests/ronda-25-c6.test.js`; E2 verificado en §3) |
| Cierre | Informe con las nueve secciones, estados de la pieza 6, todos los PUT, clon limpio y las dos líneas de HEAD pegadas | Cumplido (este documento; las líneas de HEAD abajo) |

**Estado: seis de seis piezas entregadas y empujadas.**

---

```
git -C ..\auditoria\ciclo-25 log --oneline -1   →  a7cdcab Ronda 25 · corregir renglones
git log --oneline -1 (en dev\)                  →  a7cdcab Ronda 25 · corregir renglones
```