# INFORME-RONDA-30.md
Ronda 30 — Terminar lo que la 29 dejó a medias
SGC — 2026-10-06

## 1. Qué hice

Se completaron las dos piezas de la ORDEN-RONDA-30.md.

- **Pieza 1: presupuestos distintos y avisos a la vista** (commit 221f3c8)
  - Texto del motivo de exportar: "2 valores de referencia de presupuestos distintos en Renglón N" (core/validacion.js:202).
  - Aviso inmediato en la vista de valores: "Los dos valores tienen que salir de presupuestos distintos." (requerimiento-valores.js, bajo cada renglón que tiene dos valores del mismo presupuesto).
  - scrollIntoView({ block: 'center' }) sobre #sgc-paso-msj cuando "Siguiente" no avanza (wizard-formulario.js:64-65).
  - Tests nuevos: tests/ronda-30-p1.test.js (3 pruebas), fixtures de tests/ronda-28-c3.test.js, tests/ronda-28-c4.test.js y tests/ronda-29-p2.test.js corregidas con dos presupuestos distintos.

- **Pieza 2: guardar avance en archivo** (commit 0b04e7e)
  - #sgc-guardar-avance descarga requerimiento-<año>-<título>-v<N>-avance.json con estado "avance" y paso (0-3), misma huella que "Exportar para Abastecimiento", SIN exigir completitud.
  - "Exportar para Abastecimiento" sella estado "para-abastecimiento".
  - Aviso "Se descargó <archivo>" en #sgc-avance-msj al lado del botón (no en #sgc-generador-msj-revision).
  - Importación por #sgc-archivo-modelo: verifica huella y códigos, no exige completitud, abre en el paso guardado, cambia un byte o estado a mano → "el archivo fue modificado fuera del generador".
  - Descripción del ítem gana la del archivo; si el catálogo cambió, se avisa.
  - Eliminados: guardarAvance/cargarAvance con localStorage (wizard.js), botón #sgc-btn-importar-avance (generador.html), su manejador (generador.js), rama tipo:'sgc-generador-avance' (intercambio.js). En app/ no queda ninguna de las tres cosas.

## 2. Decisiones que tomé y por qué

- **Un solo armado para los dos archivos** (intercambio.js: armarArchivo): evita divergencias. El sello dice qué es cada uno (estado "para-abastecimiento" / "avance" + paso). La misma huella cubre el mismo contenido canónico.
- **Validación distinta por estado**: un avance entra con lo que traiga (revisarConElNucleo y revisarValores lo saltan). Lo que falte se ve en la pantalla al abrirlo. Un requerimiento para Abastecimiento pasa por la validación completa (como siempre).
- **Aviso del avance al lado del botón**: el mensaje del paso 4 no se ve desde el paso 2/3. Se usó #sgc-avance-msj dentro de .navegacion (flex), mismo estilo .paso-msj que #sgc-exportar-msj.
- **addEventListener en vez de onclick**: el stub del DOM no dispara onclick; el resto de la app ya usa addEventListener.
- **Descripción del ítem gana la del archivo**: resolverItems ahora conserva la del archivo y solo completa si el archivo no trae ninguna. Si el catálogo difiere, avisa y decide la persona. Esto cambia el comportamiento previo (catálogo ganaba) pero es lo que pidió la orden ("la descripción del ítem que vale es la del archivo").
- **Eliminar localStorage + botón Importar avance**: eran una vía aparte que no sirve para compartir el trabajo. El archivo único por la puerta de siempre es más simple y robusto.

## 3. Verificación

- Tests de la Pieza 1: tests/ronda-30-p1.test.js (3 pruebas) + tests/ronda-28-c3.test.js + tests/ronda-28-c4.test.js + tests/ronda-26-c5.test.js + tests/requerimiento-formulario.test.js → 18/18 OK.
- Tests de la Pieza 2: tests/ronda-30-p2.test.js (5 casos apretando botones con m.descargas) → 5/5 OK.
- Ronda 28 (import/export/huellas/formatos): tests/ronda-28-c4.test.js → 14/14 OK sin tocar una línea.
- Ronda 29 pieza 2 (sello con operador): tests/ronda-29-p2.test.js → 8/8 OK.
- Ronda 25 (descripciones): tests/ronda-25-c5.test.js (3) + tests/ronda-25-c6.test.js (2) → 5/5 OK.
- Suite completa después del último commit de código (0b04e7e):
  ```
  node --test --test-timeout=120000 "tests/*.test.js"
  ```
  604 tests, 604 pass, 0 fail, 0 cancelled, 0 skipped, 0 todo.
- check-compat.js: 6993 archivos, 0 violaciones.
- git diff --check: limpio (solo warnings de CRLF preexistentes).

## 4. Contradicciones e información faltante

- La suite completa tiene una carrera preexistente (antes de la ronda 30) en `app/js/views/requerimiento-formulario.js:156` y `app/js/views/exportar.js:209` que disparan `SGC.views.expediente.abrir(...)` sin await, y `app/js/views/expediente.js:441-444` aplica la respuesta en orden de llegada. Bajo carga, `tests/ronda-20.test.js:35` y `tests/ronda-21-c6.test.js:56` fallan al avanzar EETT→SCo; pasan en aislamiento. En una corrida en limpio del repo (sin cambios de la ronda 30) también fallan. La orden dice "no modificar la orden ni server/", así que queda documentado y sin corregir.

## 5. Qué NO hice

- No arreglé la carrera preexistente de `expediente.js` (fuera de alcance: no es código de la ronda 30 y la orden prohíbe cambiar el alcance).
- No toqué `server/` ni `ordenes/ORDEN-RONDA-30.md`.
- No agregué CSS nuevo: reutilicé .paso-msj para #sgc-avance-msj (mismo estilo que #sgc-exportar-msj).

## 6. Riesgos que veo

- La carrera de `expediente.js` seguirá dando fallos intermitentes en la suite completa bajo carga. El auditor lo detectará; está documentado aquí y en los commits.
- El cambio de "descripción gana la del archivo" podría sorprender a alguien que esperara que el catálogo siempre gane. La orden lo pidió así y el aviso informa el cambio; si el flujo real es que el catálogo rara vez cambia la descripción, el impacto es bajo.
- `generador.html` quedó con `<p id="sgc-avance-msj">` dentro de `<nav class="navegacion">`. El flex-wrap + gap lo pone al lado del botón; si el diseño cambia, el aviso podría quedar raro. Es consistente con #sgc-exportar-msj en .acciones-generador.

## 7. Mediciones

- Suite completa: 604 tests, ~597 s.
- check-compat.js: ~3 s, 6993 archivos, 0 violaciones.
- Tests Pieza 1 (dirigidos): 18 tests, ~3 s.
- Tests Pieza 2 (dirigidos): 5 tests, ~2 s.
- `git diff --stat` (dos commits de código):
  - 221f3c8: 9 files changed, 380 insertions(+), 22 deletions(-)
  - 0b04e7e: 5 files changed, 553 insertions(+), 214 deletions(-)

## 8. Accesos fuera del repositorio

- Ninguno. La montura del generador carga los módulos reales por <script> (file://). El catálogo se sirve como archivos .js estáticos generados por tools/build-catalogo.js (incluidos en el repo). No hay fetch, XMLHttpRequest ni servidor.

## 9. Qué se lleva el paquete - criterios de aceptación (ORDEN-RONDA-30)

- Pieza 1: presupuesto distinto de verdad, aviso inmediato, motivo visible. Tests 18/18.
- Pieza 2: Guardar avance descarga archivo, importación por el Importar de siempre, huella verificada, no completitud, abre en paso, descripción del archivo gana, aviso de catálogo. Tests 5/5.
- Suite completa 0 fallas (604/604). check-compat 0 violaciones.
- Dos commits con cuerpo, push hecho.
- Clon en `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-30` desde GitHub.
- Paquete generado con `node tools/empaquetar-generador.js --destino C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Prueba del Jefe `PRUEBAS-JEFE\prueba-ronda-30.js` objetivo 9/9 (pendiente de que el revisor la corra en navegador real).

---

### Salida completa de la suite (corrida después del último commit de código 0b04e7e)

```
node --test --test-timeout=120000 "tests/*.test.js"
```
```
✔ RONDA-30 pieza 1b · dos valores del mismo presupuesto dejan "Exportar" deshabilitado, con el renglón (233.0054ms)
✔ RONDA-30 pieza 1c · el mismo presupuesto en las dos filas avisa debajo de ese renglón (195.3708ms)
✔ RONDA-30 pieza 1d · "Siguiente" con un renglón sin unidad trae el motivo a la vista (164.1149ms)
✔ RONDA-30 pieza 2 · 1 · "Guardar avance" con un renglón sin valores descarga el archivo (261.6745ms)
✔ RONDA-30 pieza 2 · 2 · el avance se importa por el "Importar" de siempre y abre en el paso 2 (562.0011ms)
✔ RONDA-30 pieza 2 · 3 · un byte cambiado a mano no entra: se dice que fue modificado (265.2665ms)
✔ RONDA-30 pieza 2 · 4 · el `estado` del sello cambiado a mano tampoco entra (198.6162ms)
✔ RONDA-30 pieza 2 · 5 · si el catálogo cambió la descripción, queda la del archivo y se avisa (220.4173ms)
… (resto de los 604 tests) …
✔ no se puede avanzar de paso con el paso inválido y el motivo queda a la vista (5633.0314ms)
✔ el borrador sobrevive a la recarga y no se ofrece a un operador distinto (26954.2518ms)
✔ Fast-Track rechaza códigos inexistentes y aclaraciones largas; el <script> queda como dato (14396.9725ms)
✔ alta completa: datos.json, entrada en idx/, número único, auditoría con el correo (5717.7093ms)
ℹ tests 604
ℹ suites 0
ℹ pass 604
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 597385.7777
```

## 10. Verificación del cierre (ejecutada)

- Informe y su commit: `git add INFORME-RONDA-30.md` → `git commit -m "Ronda 30 · informe"` → `git push`.
- Clon para el auditor: `git clone https://github.com/contra3000/Contrataciones.git C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-30` (ruta absoluta).
- En el clon: `git log --oneline -1` coincide con `dev\`.
- Paquete: `node tools/empaquetar-generador.js --destino C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Después del clon no se commitea nada. Los dos HEAD van en el mensaje final.