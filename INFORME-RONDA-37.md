# INFORME-RONDA-37.md
Ronda 37 — El lugar de entrega en el requerimiento, y la justificación del PAC que se revisa
SGC — 2026-10-16

## 1. Qué hice

Se completaron las dos piezas de `ordenes/ORDEN-RONDA-37.md` (hito H27). La pieza 1
hizo que el requerimiento repita el lugar de entrega que escribió la persona (el
mismo texto que la EETT, porque sale del mismo campo). La pieza 2 hizo que la
justificación del PAC se revise cuando las causas cambian después de haberla
escrito: avisa, marca el campo, ofrece darla por buena y frena "Siguiente",
"Imprimir" y "Exportar" hasta que se edite o se confirme.

Cada pieza corrió la **suite completa en verde antes de su commit**, como pide la
orden desde la 36. No hubo deuda.

- **Paso 0 (commit `63bf616`, ya publicado).** `ordenes/` con la orden y su
  auditoría, y `PLAN_DESARROLLO.md`. Sin cuerpo y sin nada más.

- **Pieza 1: el requerimiento dice el lugar de entrega (commit `5b54f98`, 2 files,
  201 insertions).**
  - `renders/requerimiento.js`, `paresEncabezado()`: suma la fila **"Lugar de
    entrega"** con `m.base.lugarEntrega`, **sólo si el expediente lo trae**, igual
    que las filas del PAC (y que la fila "Lugar" que salió en la 36). No vuelve
    "Lugar" con la constante "VII Brigada Aérea - Moreno".
  - El texto es el mismo campo que usa la EETT (`m.lugarEntrega || m.lugar`), así
    que no pueden contradecirse.
  - En la aplicación con servidor, cuyo expediente no trae `lugarEntrega`, la fila
    no aparece y el requerimiento sale **igual byte a byte**.
  - Tests: `tests/ronda-37-p1.test.js` (2, por la pantalla del generador).

- **Pieza 2: la justificación del PAC se revisa cuando cambian las causas (commit
  `447fabc`, 9 files, 728 insertions, 16 deletions).**
  - **a. Las causas con nombre.** `core/validacion.js` `causasDelPac()` devuelve
    también `claves`: la lista de las que se cumplen, entre `fuera-del-pac`,
    `anio`, `trimestre` y `monto`, en ese orden. Se sumaron dos auxiliares:
    `mismasClaves(guardadas, actuales)` (comparación por conjunto, sin importar el
    orden) y `cerrarCausas(causas, justificacion, pac)`, que agrega `revisar`.
  - **b. La justificación recuerda para qué causas se escribió.** `pac.causas`
    guarda las `claves` **cuando la persona escribe la justificación o la confirma**
    (`views/wizard.js`: `guardarCausasPac()` desde `escribirJustificacionDelPac()`,
    disparado por `input` del textarea y por `click` del botón confirmar). No se
    guardan al sincronizar ni al importar: son el momento en que la persona tenía
    las causas a la vista. `views/wizard-formulario.js` `sincronizar()` las
    conserva al reconstruir el `pac`.
  - **c. Si las claves de ahora no son las guardadas.** `revisar = requerida &&
    justificacion !== '' && !mismasClaves(pac.causas, claves)` (una justificación
    escrita sin claves guardadas también pide revisar: nadie sabe qué cubría). Se
    pone en práctica en:
    - `views/wizard.js` `actualizarPac()`: el aviso *"Cambiaron las causas desde
      que escribiste la justificación: revisala."* arriba del campo, el campo con
      `campo-con-error` y el botón `#sgc-pac-justificacion-confirmar`
      ("La justificación sigue valiendo").
    - `views/pasos.js` `validarFundamentacion()`: con `revisar`, "Siguiente" no
      pasa de Fundamentación y deja el error *"Revisá la justificación del PAC:
      cambiaron las causas."* junto al campo; el paso 3 queda "· falta".
    - `generador/documentos.js` `itemsDelPac()`: empuja *"revisar la justificación
      del PAC: cambiaron las causas"*, que es lo que frena "Imprimir" y "Exportar"
      y lo que dice `#sgc-exportar-msj`. Con la revisión pendiente, `actualizar()`
      **descarta el documento compuesto** (`revisionPacPendiente()` +
      `renders.documento.limpiar(estado.dom.impresion)`): el que se había impreso
      mostraba la justificación vieja.
  - **d. Viaja en el JSON.** `generador/intercambio.js` `pacExportado()` agrega
    `causas` cuando es un array, y `revisarConElNucleo()` la copia en el `pac` al
    importar (en las dos ramas, con y sin proceso). Un archivo de la 34/35/36 con
    justificación y sin `pac.causas` entra pidiendo la revisión; un clic en el
    botón alcanza.
  - **La aplicación con servidor no se toca** (control byte a byte incluido).
  - Tests: `tests/ronda-37-p2.test.js` (8, por la pantalla del generador), con el
    fixture `tests/fixtures/r36-avance-justificado.json`.

### Tests viejos que cambié, uno por uno

**Ninguno.** `git diff --stat bf3ba2d..HEAD -- tests/` muestra sólo archivos
nuevos (719 insertions, 0 deletions):

```
 tests/fixtures/r36-avance-justificado.json |  77 +++++
 tests/ronda-37-p1.test.js                  | 193 +++++++++++++
 tests/ronda-37-p2.test.js                  | 449 +++++++++++++++++++++++++++++
 3 files changed, 719 insertions(+)
```

Los 662 tests que existían antes de la ronda siguen pasando **sin tocarse**. En
particular, los tests de la 34/35/36 que escriben la justificación del PAC
(`ronda-34-p2` 2d/2e/2f/2h, `ronda-36-p1` 1b/1c/1f) siguen verdes tal cual: la
montura escribe el campo con `input`, así que en el momento de escribir se
guardan las claves de esas causas, y `revisar` queda en falso.

## 2. Decisiones que tomé y por qué

- **La cuenta de las causas, una sola vez en el núcleo.** `causasDelPac()` ya
  alimentaba pantalla y documento desde la 36; ahora devuelve además `claves` y
  `revisar`. La pantalla (`wizard.js`, `pasos.js`) y la exportación
  (`documentos.js`) miran la misma función, así que el aviso y el freno no pueden
  divergir.
- **`pac.causas` se guarda sólo cuando la persona escribe o confirma.** No en
  `sincronizar` ni al importar: las claves representan *qué causas tenía a la
  vista* al escribir la justificación. Guardarlas al sincronizar borraría el
  pedido de revisión en el primer `change` de cualquier otro campo.
- **La comparación es por conjunto, no por orden.** `mismasClaves` ordena y
  compara; el orden de `claves` es estable, pero comparar por conjunto es lo que
  quiere decir "las mismas causas".
- **Un archivo sin `pac.causas` pide revisar.** No hay forma de saber qué cubría
  la justificación que trae; lo más barato (un clic) es pedir la confirmación. Es
  lo que pidió la orden (§d).
- **Confirmar reusa el mismo camino que escribir.** El botón dispara
  `escribirJustificacionDelPac()`, que sincroniza, guarda las claves de ahora
  (sin tocar el texto) y recalcula. Editar el texto hace lo mismo, así que las dos
  salidas de la orden comparten un solo mecanismo.
- **El documento compuesto se descarta con la revisión pendiente.** Si no, quedaría
  a la vista un requerimiento con la justificación vieja mientras Imprimir y
  Exportar están frenados (era el síntoma que describe la orden). `estado.generados`
  no se toca; el documento se recompone al apretar "Imprimir" con la justificación
  revisada.
- **Pieza 1 desde `m.base.lugarEntrega`, sólo si viene.** Es la misma forma que las
  filas del PAC; sin el dato, la fila no se agrega y la aplicación con servidor
  sale byte a byte igual.
- **No toqué la aplicación con servidor ni sus tests.**

## 3. Verificación

Corridas completas, todas documentadas, no sólo la mejor.

Suite completa:

```
node --test --test-timeout=120000 --test-force-exit "tests/*.test.js"
```

| corrida | tests | pass | fail | cancelled | skipped | duration_ms | log / nota |
|---|---|---|---|---|---|---|---|
| pieza 1 · sesión | 662 | 662 | 0 | 0 | 0 | — | declarada en el cuerpo de `5b54f98` (log de la sesión no conservado) |
| pieza 2 · sesión | 670 | 670 | 0 | 0 | 0 | 642565.87 | primera corrida completa con los 8 tests nuevos |
| final del informe (HEAD `447fabc`) | 670 | 670 | 0 | 0 | 0 | 797629.8854 | `%TEMP%\opencode\r37-suite-final.txt` |

Cola de la corrida final (copiada del log):

```
ℹ tests 670
ℹ suites 0
ℹ pass 670
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 797629.8854
```

Los tests de la ronda, en esa corrida (copiados del log):

```
✔ RONDA-37 pieza 1a · el requerimiento dice el lugar de entrega que escribió la persona, igual que la EETT (916.7852ms)
✔ RONDA-37 pieza 1b · control: el requerimiento de la aplicación con servidor sale idéntico a antes (19.5775ms)
✔ RONDA-37 pieza 2a · sin causa y sin justificación nada pide revisar, exporta, y el PAC no lleva claves (894.5707ms)
✔ RONDA-37 pieza 2b · escribir con una causa deja la justificación al día y las claves viajan en el JSON (227.6984ms)
✔ RONDA-37 pieza 2c · si la causa cambia después de imprimir: avisa, marca, frena y descarta el documento (252.4688ms)
✔ RONDA-37 pieza 2d · confirmar que la justificación sigue valiendo la pone al día y exporta con las claves de ahora (258.9352ms)
✔ RONDA-37 pieza 2e · reescribir la justificación también la pone al día (199.4443ms)
✔ RONDA-37 pieza 2f · un avance de la 36 con justificación y sin claves pide revisar, frena y, al confirmar, exporta (236.2287ms)
✔ RONDA-37 pieza 2g · ida y vuelta: el JSON exportado lleva las claves y, reimportado, no pide revisar (404.5417ms)
✔ RONDA-37 pieza 2h · control: el requerimiento de la aplicación con servidor sale idéntico a antes (17.9587ms)
```

Tests dirigidos de la ronda (camino rápido):

```
node --test --test-timeout=120000 --test-force-exit tests/ronda-37-p1.test.js tests/ronda-37-p2.test.js
```
→ 10 tests, 10 pass, 0 fail, duration_ms 5923.2568
(`%TEMP%\opencode\r37-dirigidos.txt`).

Controles:

- `node tools/check-compat.js` → **OK — 6994 archivo(s) inspeccionado(s), 0
  violaciones** (código 0).
- `node tools/build-config.js --verificar` → **OK — 2 archivo(s) al día** (código 0).
- `git diff --stat bf3ba2d..HEAD -- server/` → **vacío** (la ronda no toca
  `server/`).
- `git status` → árbol limpio tras los commits.

## 4. Contradicciones e información faltante

- **Ninguna contradicción de la orden.** Las dos piezas corrieron la suite completa
  antes de commitear y quedaron en verde.
- **El asunto del commit de la pieza 2 difiere del que nombra la orden.** La orden
  propone `Ronda 37 · revisar la justificación del PAC cuando cambian las causas`;
  el commit salió como `Ronda 37 · la justificación del PAC se revisa cuando
  cambian las causas` (mismo sentido, redacción distinta, ya publicado). Lo dejo
  declarado; no lo reescribí para no reescribir historia publicada.
- **Los números de línea que cita la orden** (`core/validacion.js:113`,
  `requerimiento.js:90`) quedaron aproximados; los bloques se ubicaron por su
  contenido, sin ambigüedad.
- **La prueba del Jefe (`PRUEBAS-JEFE\prueba-ronda-37.js`) no la corrí:** la corre
  el revisor en navegador real. La prueba está escrita
  (`PRUEBAS-JEFE\DEVOLUCION-RONDA-37.md`).

## 5. Qué NO hice

- No toqué `server/` (verificado: `git diff --stat bf3ba2d..HEAD -- server/`
  vacío).
- No modifiqué los tests de la aplicación con servidor.
- No modifiqué la orden, la auditoría ni `PLAN_DESARROLLO.md` (los tocó el paso 0).
- No toqué la plantilla ni sus instrucciones.
- **No toqué `tests/helpers/`**: la montura del generador ya ofrecía todo lo que
  hizo falta (`escribir`, `elegirPac`, `elegirArchivo`, `limpiarDescargas`,
  `msjArchivo`, `descargas`).
- No corrí la prueba del Jefe en navegador (no hay Playwright en este entorno).

## 6. Riesgos que veo

- **La suite completa es larga:** la corrida final del informe tardó 797,6 s
  (≈ 13,3 min), por encima del presupuesto de una sola llamada corta; conviene
  correrla con margen. No hubo flakes.
- **`tools/check-compat.js` contra `app/` es lento:** camina 13 918 archivos,
  entre ellos `app/catalogo/codigos.js` (3,3 MB) y decenas de `items/*.js` de
  ~286 KB, y el lexer lo hace tardar ≈ 10 min. Da 0 violaciones, pero no es un
  control para correr seguido; el mismo control dentro de la suite
  (`tests/check-compat.test.js`) es el que se usa por defecto.
- **`pac.causas` depende del momento de escribir.** Si en el futuro otra parte
  empieza a sembrar la justificación por código (sin pasar por el `input` del
  textarea), habría que guardar las claves ahí también; hoy el único camino es
  escribir o confirmar, como pide la orden.
- **La comparación por claves no distingue matices dentro de una misma causa:** un
  cambio de monto con la misma causa `monto` no pide revisar (la orden lo dijo
  explícito: §c "un cambio de monto con la misma causa no cuenta").

## 7. Medidas (métricas)

- Suite completa final (log): **670/670** en 797629.8854 ms (≈ 13,3 min).
- Suite completa de la sesión: pieza 1 **662/662**; pieza 2 **670/670** en
  642565.87 ms.
- Dirigidos de la ronda: 10/10 en 5923.2568 ms.
- `check-compat.js`: 6994 archivos, 0 violaciones.
- `build-config.js --verificar`: 2 archivos al día.
- `git show --stat`:
  - `5b54f98` (pieza 1): 2 files changed, 201 insertions(+).
  - `447fabc` (pieza 2): 9 files changed, 728 insertions(+), 16 deletions(-).

## 8. Accesos fuera del repositorio

- Ninguno nuevo de red. La montura del generador carga los módulos reales por
  `<script>` (file://); la app que se empaqueta no hace fetch ni usa servidor. La
  única salida de red de la suite sigue siendo el test `ronda-12` (Python local).
- El fixture `tests/fixtures/r36-avance-justificado.json` se copió de
  `..\PRUEBAS-JEFE\` (misma carpeta del punto 2 de la orden).
- `tools/build-config.js` regenera `app/config/*.js` a partir de `config/`;
  `--verificar` controla que estén al día (en verde).

## 9. Qué se lleva el paquete — criterios de aceptación (ORDEN-RONDA-37)

- **Pieza 1.** Con el lugar "Depósito de Intendencia, Hangar 3", el requerimiento
  impreso tiene la fila "Lugar de entrega" con ese texto y la EETT también, y
  ningún documento dice "VII Brigada Aérea - Moreno" (test 1a). El requerimiento
  de la aplicación con servidor sale byte a byte igual que en `bf3ba2d`
  (test 1b). Tests 2/2.
- **Pieza 2.** Proceso 4 con el monto superado: se justifica, exporta y el JSON
  trae `pac.causas = ["monto"]` (test 2b). Pasar a "No autorizado en el PAC":
  aparece el aviso, el campo queda marcado, "Siguiente" no pasa, el paso 3 dice
  "falta", no imprime ni exporta y el motivo dice "cambiaron las causas" (test
  2c). "Sigue valiendo": se va el aviso, exporta con `pac.causas =
  ["fuera-del-pac"]` (test 2d). Volver al proceso 4 y editar el texto quita el
  aviso sin apretar el botón (test 2e). Importar `r36-avance-justificado.json`
  pide la revisión y, al confirmar, exporta con `["monto"]` (test 2f). Sin causas:
  sin campo, sin aviso, exporta y sin claves (test 2a). Tests 8/8.
- Suite completa en verde: **670/670**; `check-compat` 0 violaciones.
- Commits con cuerpo: `5b54f98` (pieza 1) y `447fabc` (pieza 2) — y push hecho.
- Clon en
  `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-37` desde
  GitHub.
- Paquete generado con
  `node tools/empaquetar-generador.js --ronda 37 --destino C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Prueba del Jefe `PRUEBAS-JEFE\prueba-ronda-37.js` (pendiente de que la corra el
  revisor en navegador real).

## 10. Verificación del cierre (ejecutada)

- Informe y su commit: `git add INFORME-RONDA-37.md` →
  `git commit -m "Ronda 37 · informe"` → `git push`.
- Clon para el auditor: `git clone
  https://github.com/contra3000/Contrataciones.git
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-37`
  (ruta absoluta).
- En el clon: `git log --oneline -6` coincide con `dev\`.
- Paquete: `node tools/empaquetar-generador.js --ronda 37 --destino
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Después del clon no se commitea nada. Los dos HEAD van en el mensaje final.
