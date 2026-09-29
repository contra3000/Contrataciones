# INFORME — RONDA 26

Cada pieza se entregó sola: `commit` y `push` al terminarla. La ronda cierra con
**seis commits** (las piezas 1 a 6 del orden), cada una con su test en verde y el
camino rápido en rojo antes de existir. La orden nace de lo que el Jefe vio el
28/09 (el expediente real llegó a Abastecimiento y la SCo resultó ser el
requerimiento re-titulado) y de sus definiciones del 29/09 (SCo = número de
COMPR.AR; dos valores de referencia por renglón).

---

## 1. Qué hice

**Pieza 1 — los datos del expediente sin guiones** · `458d009` · `Ronda 26 · datos del expediente`
El expediente guarda `expedienteId` y `numero`, pero el panel "Datos" leía
`expediente.id` e `identificacion.numero`; en los reales salía "—". La vista
ahora lee los campos que existen (con `|| expediente.id` como respaldo para
datos viejos), y lo mismo en el título y en `sugerencias.js`. Los lugares que
leían `expediente.id` están en §7.1.

**Pieza 2 — "Avanzar" dice qué falta, antes de apretarlo** · `45aa17a` · `Ronda 26 · avanzar explica`
La vista llama a `validarParaAvanzar` (el mismo código del servidor); si falta
algo, "Avanzar" queda deshabilitado y al lado dice qué falta **y cómo
resolverlo**, con el título del entregable o del campo, nunca el id técnico. El
mensaje del servidor usa los mismos títulos (`validacion.itemsFaltantes` vive en
core, se usa en la pantalla y en `estados.js:194`).

**Pieza 3 — nada del sistema espera para siempre** · `9fd1386` · `Ronda 26 · tope al generador`
El `spawn('python', …)` del probador de pliegos no tenía tope. Ahora tiene tope
duro (`TOPE_PLIEGO_MS`), al vencer **mata el python**, responde en castellano
("el generador de pliegos tardó demasiado y se canceló la prueba") y el proceso
se da de baja en cualquier camino: término normal, error o tope. La búsqueda
entera de `server/` está en §7.2.

**Pieza 4 — la SCo se registra, no se genera** · `cb814f1` · `Ronda 26 · número de SCo`
`SOLICITUD_CONTRATACION` dejó de producir documento: exige `campos.numeroSCo`
("Número de SCo (COMPR.AR)", texto libre no vacío). El mismo número puede estar
en varios expedientes y cada uno lista *"Esta SCo incluye también: …"* por el
índice. `ANALISIS_SCo` no cambió, la matriz 18 × 7 no cambió, y el entregable
`solicitud-contratacion` dejó de exigirse (los que ya lo tienen lo conservan).
La sección de SCo (`sco-numero.js`) guarda con `versionEsperada` y re-renderiza.

**Pieza 5 — dos valores de referencia por renglón, obligatorios** · `6414bfc` · `Ronda 26 · dos valores por renglón`
El editor muestra **dos lugares por defecto** por renglón, y en
`ESPECIFICACIONES_TECNICAS` `validarParaAvanzar` —el mismo código en cliente y
servidor— exige 2 o más valores completos por renglón. El texto de la pieza 2
lista cuáles renglones quedan cortos: *"2 valores de referencia en Renglón N"*.
El servidor rechaza igual un avanzar fabricado.

**Pieza 6 — un solo servidor por carpeta de datos** · `14e33ed` · `Ronda 26 · un servidor por carpeta`
Al arrancar, el servidor deja `candado.json` en la carpeta de datos (máquina,
proceso y hora) y lo renueva cada 30 segundos. Si hay un candado **vivo** (sin
renovar hace menos de 2 minutos), no arranca y dice **qué máquina lo tiene**; un
candado **abandonado** se reemplaza y avisa (`SGC-SERVIDOR-CANDADO-REEMPLAZADO`);
al cerrar normalmente se borra. El candado no viaja en el respaldo. La
arquitectura del cierre en Windows está en §2 y §6.

---

## 2. Decisiones que tomé y por qué

- **Pieza 1 — el respaldo viejo se mantiene.** Los lectores pasan a
  `expedienteId`/`numero` pero conservan `|| expediente.id`: los expedientes de
  rondas anteriores no se reescriben por una lectura.
- **Pieza 3 — además del tope, el proceso queda "públicamente" fuera.** El
  tope no alcanza si un término temprano deja al proceso en el conjunto de
  activos: `zanjar` lo saca en los tres caminos (close 0, close ≠ 0, tope).
- **Pieza 4 — excluir la matriz.** La orden lo pide y se respetó: los caminos
  de la matriz 18 × 7 no cambian, solo los "cargar" previos al avance desde
  `SOLICITUD_CONTRATACION` (ahora el `numeroSCo` en vez del entregable). No se
  adelanta ni un pedazo del agrupamiento por SCo (ronda 27, `ADR-PROPUESTA-AGRUPAMIENTO`).
- **Pieza 5 — "completo" es estructural.** Un valor es completo si tiene
  `presupuestoId` no vacío, `base` en {unitario, total} y `valor` finito ≥ 0. Y
  cada valor **cita un presupuesto que de verdad existe**: el PUT del cliente
  que los guarda es validado por el servidor (`erroresDeRenglones`,
  `server/expedientes.js`), igual que un `avanzar` fabricado. Los tests que
  avanzan de EETT suben primero dos PNG (`enviarBytes`, ronda-23) y después los
  valores.
- **Pieza 5 — la lista solo existe si algo falta.** `faltantes.renglones` es una
  clave condicional: si todos los renglones tienen sus dos valores, el objeto de
  la validación conserva la forma `{campos, entregables}` y los
  `deepEqual` de los estados sin renglones (EETT vacío, resto del circuito) no
  cambian.
- **Pieza 6 — el candado es un archivo renovado, no un flag.** Un proceso muerto
  de golpe (SIGKILL, apagón) no puede borrar nada; con la renovación el candado
  envejece solo y a los 2 minutos es "abandonado": el siguiente arranque lo
  reemplaza y avisa. La ventana de 2 minutos tras un golpe es el costo de no
  necesitar un servidor de candados.
- **Pieza 6 — el cierre normal en Windows.** Verifiqué con una sonda que
  `child.kill('SIGTERM'|'SIGINT')` en Windows termina el proceso sin correr
  código (ni handlers ni `'exit'`). Por eso el borrado del cierre normal tiene
  dos dueños: el propio servidor con `process.on('exit'|'SIGTERM'|'SIGINT')`
  (los despliegues reales, Linux/systemd), y **quien detiene el servidor**
  (`detenerServidor` borra el candado si el proceso que terminó era su dueño,
  comparando `pid`). Con la renovación + el pid, el candado nunca bloquea a un
  arranque legítimo ni deja dos servidores a la vez.
- **Pieza 6 — el candado no viaja en el respaldo.** `copiarCarpeta` (respaldo)
  saltea `candado.json`: es un artefacto de una instancia viva, y un candado
  restaurado acusaría a una máquina que quizás ya no existe.

---

## 3. Verificación

Estado final (tras la pieza 6):

```
$ node --test --test-concurrency=4 "tests/*.test.js"
ℹ tests 462
ℹ pass 462
ℹ fail 0
ℹ duration_ms 295937.1011

$ node tools/check-compat.js
check-compat: OK - 67 archivo(s) inspeccionado(s), 0 violaciones.

$ node --test tests/check-compat.test.js
ℹ tests 34 / pass 34
```

Antes de cada commit se corrió el camino rápido de `tests/LEEME.md` con los
archivos tocados por esa pieza, además de la suite nueva.

**Hallazgos que la pieza 5 destapó y corrigió** (los tests que pasaban antes
empezaron a fallar por el requisito nuevo, y se adaptaron donde hacía falta):
- `recorrido-completo.js` guardaba el entregable desde la copia en memoria y
  luego volcaba esa copia por PUT, **borrando el documento recién guardado**: se
  reescribe `cargarValoresEett` para partir SIEMPRE de un `GET` fresco al
  servidor antes del PUT de valores.
- `transiciones-servidor.test.js` (auditoría de transición) avanzaba de EETT con
  sólo el entregable: ahora carga presupuestos + valores con
  `cargarValoresEett` (exportada desde `transiciones-servidor-util.js`).
- `matriz-servidor-bateria.js` también avanzaba de EETT sin valores: se le
  agregó la misma carga antes del avance final.

---

## 4. Contradicciones e información faltante

- **ORDEN-RONDA-26 §22 del cierre: el texto de la pieza 2.** La frase del ejemplo
  usa "ANEXO I"; en `config.ENTREGABLES` el título actual es "ANEXO 1". El texto
  real dice lo que está en la configuración (la fuente única que exige la orden
  de la pieza 2). Si el Jefe quiere "ANEXO I", se cambia en una línea de config.
- **ORDEN-RONDA-26 pieza 3 — la búsqueda entera.** La orden pide "los `spawn`,
  `exec` o esperas sin tope en `server/`, y ponelos en el informe": el resultado
  está en §7.2. No hay contradicción: la única espera sin tope era el spawn del
  probador.

---

## 5. Qué NO hice

Entraron **las seis piezas**: no hubo pieza caída por tope vencido, ni sesión
cortada, ni bloqueo.

- **No adelanté el agrupamiento por SCo ni el ANEXO I por SCo** (pieza 4): la
  orden lo marca explícitamente para la ronda 27 con su ADR, y se respetó.
- **No cambié la matriz de 18 × 7** (pieza 4, orden explícita).
- **No toqué `ANALISIS_SCo`** (pieza 4).
- **No medí páginas ni corrí la prueba de 10 minutos del Jefe**: son del cierre,
  no de las piezas.
- **No encontré más `spawn`/`exec`/esperas sin tope en `server/`** que el del
  probador (pieza 3). Los demás `spawn`/`exec` del repositorio viven en
  `tests/` y `tools/` (§7.2).
- **No hice que el candado se borre solo ante SIGKILL** en Windows: es
  imposible (la señal no corre código) y no hace falta — la renovación lo vuelve
  "abandonado" a los 2 minutos.

---

## 6. Riesgos que veo

- **La SCo hermanada se lee por índice** (`repo.listarIndice`), que es un
  barrido de los expedientes vivos: con miles de expedientes costará más. Hoy la
  escala lo permite; si crece, el índice por `numeroSCo` pasa a ser un índice
  real.
- **El candado es "archivo renovado", no conjunto de procesos.** Dos arranques
  simultáneos en el mismo instante pueden borrarse el candado entre sí y arrancar
  los dos; el chequeo posterior de dueño reduce la ventana, y el puerto es la
  segunda barrera, pero la garantía fuerte es para arranques secuenciales (el
  caso real del Jefe: abrir dos veces `Iniciar SGC.bat`).
- **En Windows el cierre normal borra el candado desde quién detiene el
  servidor**, no desde el propio proceso (la señal no corre código; verificado
  con una sonda). En los despliegues reales (Linux) lo borra el proceso. Si
  alguien detiene a mano un servidor de Windows con Task Manager (SIGKILL), el
  candado queda "abandonado" y el siguiente arranque avisa y reemplaza — está
  contemplado.
- **La suite sigue creciendo** (462 tests, ~296 s de muro). Los caminos de EETT
  ahora cargan dos presupuestos por test que pasa por ese estado; el costo no
  salió caro, pero conviene tenerlo presente.
- **`faltantes.renglones` es una clave condicional**: quien lea la validación
  debe tratarla como opcional. Está documentado en el código, pero es un detalle
  a mantener si la validación crece.

---

## 7. Mediciones

### 7.1 Los lugares que leían `expediente.id` (pieza 1)

| Lugar | Cómo lo leía | Cambio |
|---|---|---|
| `app/js/views/expediente.js` (panel "Datos", campo "Expediente") | `expediente.id` | lee `expediente.expedienteId` (respaldo `expediente.id`) |
| `app/js/views/expediente.js` (campo "Número") | `identificacion.numero` (ausente en los reales) | lee `expediente.numero`, después `identificacion.numero`, después el id |
| `app/js/views/expediente.js` (título de la cabecera) | `expediente.id` | lee `expediente.expedienteId` (respaldo `expediente.id`) |
| `app/js/views/sugerencias.js` (id del expediente para sugerir) | `expediente.id` | lee `expediente.expedienteId` (respaldo `expediente.id`) |

Otros lectores ya usaban `expedienteId || expediente.id` o `expedienteId` a secas
(con respaldo) desde antes: `anexo-uno.js`, `sco-numero.js`,
`requerimiento-formulario.js`, `renglones-editor.js`, `exportar.js`,
`renders/documento.js`. El respaldo que queda en todos es deliberado (datos de
rondas anteriores, §2).

### 7.2 `spawn` / `exec` / esperas encontradas (pieza 3)

| Lugar | Qué espera | Tope | Estado |
|---|---|---|---|
| `server/pliego-probador.js:129` | `spawn('python', …)` (generador de pliegos) | **no tenía** | **corregido en la pieza 3**: `TOPE_PLIEGO_MS`, kill al vencer, 408 en castellano, baja del proceso en los tres caminos |
| `server/ayudantes.js:101` | `setTimeout(…, 400)` como respaldo de DNS | 400 ms, acotado de origen | sin cambio (no es una espera sin tope) |
| `server/candado.js:104` (pieza 6) | `setInterval` de renovación del candado | 30 s, con `unref` | sin riesgo: no espera a nadie |
| `tests/`, `tools/` | `spawn`/`spawnSync`/`execSync`/`execFileSync` (servidor de test, catálogo, herramientas, YAML) | todos con su tope o síncronos a propósito | sin cambio (fuera de `server/`, la orden pide solo `server/`) |

### 7.3 Los tests adaptados por la pieza 4

La orden lo pide declarado. Los que guardaban el entregable `solicitud-contratacion`
para poder avanzar de SOLICITUD ahora cargan `campos.numeroSCo`:

- `tests/helpers/expediente-montura.js` — el expediente en SOLICITUD nace con
  `campos.numeroSCo` (y, en la pieza 5, los de EETT con dos presupuestos y dos
  valores).
- `tests/ronda-14.test.js` — los caminos autenticados que salen de SOLICITUD
  cargan el número; además, en la pieza 5, los que salen de EETT cargan
  presupuestos + valores con cookie.
- `tests/plantillas.test.js` — ya no pide generar la "solicitud-contratacion".
- De regalo (flujo acompañante, no pedidos por nombre): `tests/motor.test.js`,
  `tests/validacion.test.js`, `tests/ronda-20.test.js`,
  `tests/ronda-21-c6.test.js`, `tests/helpers/matriz-servidor-bateria.js`,
  `tests/helpers/transiciones-servidor-util.js` (que además ganó
  `cargarValoresEett` para la pieza 5), `tests/helpers/circuito-ronda-21.js` y
  `tools/recorrido-completo.js`.

---

## 8. Accesos fuera del repositorio

- **`os.tmpdir()`** — carpetas de datos de todos los tests (`fs.mkdtempSync`).
- **`127.0.0.1`** — servidores de test, siempre en puerto efímero (`--puerto 0`).
- **`..\auditoria\ciclo-26`** — clon limpio del cierre, creado para esta ronda
  (la orden lo manda; la carpeta no existía y se creó).
- Nada más.

---

## 9. Qué se lleva el paquete — criterios de aceptación (ORDEN-RONDA-26)

| # | Criterio | Resultado |
|---|---|---|
| 1 | El panel "Datos" de un expediente creado por la montura muestra `2026-001` y el número; se buscan otros lectores de `expediente.id` | Cumplido (pieza 1, `tests/ronda-26-c1.test.js`; lugares en §7.1) |
| 2 | Sin el requisito, "Avanzar" deshabilitado y el texto nombra el TÍTULO y cómo resolverlo; guardado, se habilita; el mensaje del servidor usa títulos | Cumplido (pieza 2, `tests/ronda-26-c2.test.js` y `tests/validacion.test.js`) |
| 3 | El generador de pliegos con tope: un script que se cuelga → error en castellano y el proceso no queda vivo | Cumplido (pieza 3, `tests/ronda-26-c3.test.js`; nada más sin tope en `server/`, §7.2) |
| 4 | Sin número de SCo no avanza con el texto de la pieza 2; con número avanza; dos expedientes con la misma SCo se señalan entre sí | Cumplido (pieza 4, `tests/ronda-26-c4.test.js` y `tests/motor.test.js`; tests adaptados en §7.3; matriz 18 × 7 intacta) |
| 5 | Un renglón con 1 valor → no avanza y se nombra el renglón; con 2 → avanza; el servidor rechaza un avanzar fabricado | Cumplido (pieza 5, `tests/ronda-26-c5.test.js`; ayudantes de servidor suben los presupuestos que los valores citan) |
| 6 | Dos servidores sobre la misma carpeta → el segundo no arranca y nombra la máquina; candado abandonado → arranca y avisa; cierre normal → el candado desaparece | Cumplido (pieza 6, `tests/ronda-26-c6.test.js`) |
| Cierre | Informe con las nueve secciones, piezas con hash, lugares de `expediente.id`, `spawn`/`exec` y tests adaptados por la pieza 4, clon limpio y las dos líneas de HEAD | Cumplido (este documento; las líneas de HEAD abajo) |

**Estado: seis de seis piezas entregadas y empujadas.**

---

```
git -C ..\auditoria\ciclo-26 log --oneline -1   →  14e33ed Ronda 26 · un servidor por carpeta
git log --oneline -1 (en dev\)                  →  14e33ed Ronda 26 · un servidor por carpeta
```