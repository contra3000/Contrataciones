# INFORME-RONDA-31.md
Ronda 31 — Los documentos de referencia, y lo que traba o no se ve
SGC — 2026-10-07

## 1. Qué hice

Se completaron las dos piezas de ORDEN-RONDA-31.md, más un arreglo previo que
bloqueaba el arranque de la ronda.

- **Arreglo previo (commit bc9ddc7).** El c6 de la ronda 21 apretaba "Avanzar"
  todavía deshabilitado. `tests/helpers/circuito-ronda-21.js` ahora espera la
  condición antes de seguir, y `tests/ronda-21-c6.test.js` gana `timeout: 300000`.

- **Pieza 1: los documentos de referencia (commit 1a996db).**
  - Cada documento se elige como **archivo** (`#sgc-presup-archivo` `type="file"`):
    se guardan `nombreOriginal`, `bytes` y `sha256` (misma huella del sello). La
    fecha es `type="date"` y se muestra `dd/mm/aaaa`.
  - Desplegable nuevo `#sgc-presup-tipo`: `presupuesto`, `precio-plaza`
    ("Orden de compra / precio de plaza") y `justificacion`. Un JSON viejo entra
    igual: queda como `presupuesto` y la lista dice "sin huella".
  - En el bloque de valores, elegir una **justificación** guarda la fila como
    `{ presupuestoId, justificacion: true }`, sin base ni valor, y esos campos se
    esconden.
  - Regla del núcleo (core/requerimiento.js `fuentesDeRenglon` + core/validacion.js
    `renglonesSinValores`): un renglón está completo con **dos valores de fuentes
    distintas** (presupuesto o precio de plaza), **o un valor y una fila de
    justificación**. Las justificaciones no entran en el promedio.
  - La leyenda del requerimiento: "Se acompañan como adjuntos: <tipo> <nombre>
    (<proveedor>, <dd/mm/aaaa>); …".
  - Tests nuevos: `tests/ronda-31-p1.test.js` (3 pruebas por la pantalla).

- **Pieza 2: lo que traba o no se ve (commit a26928a).**
  - **a)** `documentos.js`: "Imprimir" registra también el entregable `anexo-eett`
    cuando compone el anexo de EETT (`anexoEett.tieneContenido`). Sin el registro,
    "Exportar" quedaba deshabilitado para siempre aunque el anexo se viera.
  - **b)** `expediente.js`: `abrir()` lleva un contador de pedidos; la respuesta
    que no es del último `abrir()` no se aplica. La recarga vieja ya no pisa a la
    nueva.
  - **c)** `#sgc-anio` descarta lo que no sea dígito mientras se escribe
    (`replace(/\D/g,'')` en el listener de `input`); la regla de validación no
    cambia.
  - **d)** `wizard-formulario.js`: el motivo de no avanzar se muestra en el
    **primer campo con error** —foco, clase `campo-con-error` y
    `scrollIntoView({block:'center'})`— en vez de traer a la vista el mensaje de
    arriba. El mensaje de `#sgc-paso-msj` queda como estaba.
  - **e)** `generador.js` + `main.css`: el paso de `#sgc-pasos` con algo pendiente
    para exportar muestra la clase `pendiente` y la marca **"· falta"**, y se borra
    solo al completarse. `requerimiento-valores.js`: al abrir el paso, cada renglón
    incompleto dice debajo "Faltan valores de referencia: 2 de fuentes distintas,
    o 1 y una justificación." (misma clase `req-aviso-valores`).
  - Tests nuevos: `tests/ronda-31-p2.test.js` (5 pruebas por la pantalla);
    `tests/ronda-30-p1.test.js` actualizado (los avisos de la pieza 1c ahora
    conviven con el aviso de la pieza 2e, y el test 1d espía el campo en vez del
    mensaje).

## 2. Decisiones que tomé y por qué

- **El criterio nuevo vive en un solo lugar** (core/requerimiento.js
  `fuentesDeRenglon`): el botón de exportar, la lista de faltantes, la vista del
  generador y el servidor cuentan lo mismo.
- **El entregable del anexo va CON el documento impreso** (2a): es la lectura de
  ADR-029 —exigir, no saltear—. Si el papel incluye el anexo, la validación tiene
  que admitirlo; de lo contrario "Exportar" queda trabado sin que nada lo explique.
- **Contador de aperturas, sin reset** (2b): la orden pedía "si no es la del
  último abrir(), no se aplica". El contador es monótono y sirve también si se
  vuelve a abrir el mismo expediente más tarde.
- **Foco y borde en el primer campo con error** (2d): el mensaje de arriba no se
  trae a la vista; se evita generar un `scrollIntoView` del mensaje cuando ya hay
  un campo que lo dice. Al avanzar, la clase `campo-con-error` se limpia sola.
- **El aviso de "Faltan valores…" es consecuencia, no reglas**: reutiliza el nodo
  de la ronda 30 para que no haya dos lugares donde mirar, y la marca "· falta"
  se pinta con `revision()` (el mismo cómputo que habilita "Exportar").
- **Se mantuvo `node tools/check-compat.js`** como gate: nada de `innerHTML` con
  datos, `import`/`export`, o APIs fuera del Chrome de referencia. 0 violaciones.

## 3. Verificación

Corridas completas de la suite (`node --test --test-timeout=120000
--test-force-exit "tests/*.test.js"`), todas documentadas, no sólo la mejor:

| corrida | tests | pass | fail | duration_ms | nota |
|---|---|---|---|---|---|
| 1 · tras el commit de pieza 1 | 607 | 607 | 0 | ~794000 | gate de pieza 1 |
| 2 · tras el commit de pieza 2 | 612 | 612 | 0 | 634295 | gate de pieza 2 |
| 3 | 612 | 610 | 2 | 734137 | infra: ronda-12 (spawn PyYAML ETIMEDOUT) y presupuestos-servidor (proceso cortado); ambos pasan en aislamiento |
| 4 | 612 | 612 | 0 | 687657 | |
| 5 | 612 | 612 | 0 | 638432 | |

- Fallas de la corrida 3 en aislamiento:
  - `node --test "tests/ronda-12.test.js"` → fail 0 (22 s). El error fue
    `spawnSync cmd.exe ETIMEDOUT` corriendo el helper `yaml_roundtrip.py` bajo
    carga, no una diferencia de YAML.
  - `node --test "tests/presupuestos-servidor.test.js"` → fail 0 (13 s). El
    proceso se cortó bajo carga; sin ella pasa como siempre.
- Tests dirigidos de las piezas:
  - Pieza 1: `tests/ronda-31-p1.test.js` → 3/3.
  - Pieza 2: `tests/ronda-31-p2.test.js` → 5/5 (2c · "Año" sin letras; 2d · foco y
    `campo-con-error`; 2e · paso marcado y aviso por renglón; 2a · Exportar se
    habilita al registrar el anexo; 2b · la lectura vieja no pisa a la nueva).
  - `tests/ronda-30-p1.test.js` actualizado → 3/3.
- `node tools/check-compat.js`: 6993 archivos, 0 violaciones.
- `git diff --check`: limpio (solo warnings de CRLF preexistentes).

Salida completa de la última corrida:
`%TEMP%\opencode\suite31-p2-run5.txt` (ruta local), y las anteriores en
`suite31-p2-run2.txt` / `suite31-p2-run4.txt`.

## 4. Contradicciones e información faltante

- La carrera preexistente de `expediente.js` documentada en la ronda 30 sigue
  abierta (fuera de alcance; la orden no la pide). En esta ronda se la tocó para
  la pieza 2b (contador de aperturas), que es justamente la mitigación general de
  ese patrón para el generador; el caso del servidor `ronda-20/21` queda igual.
- No encontré otra ambigüedad que valiera la pena anotar: el resto de la orden era
  explícito y quedaba cubierto por los textos y los tests.

## 5. Qué NO hice

- No modifiqué `server/` ni la orden.
- No toqué `app/js/views/expediente-dialogo.js` (la transición SCo) — nada de esta
  ronda lo requería.
- No cambié la regla de validación del "Año" (4 dígitos): sólo se descartan las
  letras al escribir (pieza 2c).
- No escribí CSS nuevo para el foco: reaproveché `campo-con-error` (borde con
  `var(--color-error)`) y las clases `.pendiente`/`.paso-falta` van después de
  `li[aria-current]` en el mismo bloque.

## 6. Riesgos que veo

- Bajo carga la suite puede volver a cortarse en `ronda-12` (spawn de Python) o en
  un test de servidor, como pasó en la corrida 3. No es una regresión de la ronda
  31: pasan en aislamiento y las corridas 2/4/5 están 612/612 en verde.
- El requisito de la pieza 2a (registrar el anexo) depende de que
  `anexoEett.tieneContenido` y el render sigan tomados del mismo SGC: si en el
  futuro el anexo se compone en otro lado de la vista, hay que volver a registrar
  el entregable ahí. El test 2a vigila que "Exportar" se habilite después de
  imprimir con aclaración larga.
- La marca "· falta" usa el mismo cómputo que habilita "Exportar", así que es tan
  buena como esa validación: si la regla cambia, la marca cambia sola.

## 7. Mediciones

- Suite completa: 612 tests, ~10,5–12,3 min por corrida.
- check-compat.js: ~3 s, 6993 archivos, 0 violaciones.
- Tests Pieza 1 (dirigidos): 3 tests, ~1 s.
- Tests Pieza 2 (dirigidos): 5 tests, ~2 s.
- `git diff --stat`:
  - bc9ddc7: 2 files changed, 12 insertions(+), 1 deletion(-).
  - 1a996db: 16 files changed, 826 insertions(+), 171 deletions(-).
  - a26928a: 10 files changed, 672 insertions(+), 32 deletions(-).

## 8. Accesos fuera del repositorio

- Ninguno. La montura del generador carga los módulos reales por `<script>`
  (file://), y el catálogo se sirve como archivos .js estáticos generados por
  tools/build-catalogo.js. La única excepción de red de la suite es el test
  ronda-12, que llama a Python local con PyYAML instalado en la máquina de pruebas.
  No hay fetch, XMLHttpRequest ni servidor en la app que se empaqueta.

## 9. Qué se lleva el paquete — criterios de aceptación (ORDEN-RONDA-31)

- Pieza 1: documento elegido como archivo con huella, tipos (presupuesto /
  precio de plaza / justificación), regla del núcleo en las dos aplicaciones,
  leyenda de adjuntos. Tests 3/3.
- Pieza 2: registro del anexo de EETT, contador de aperturas, "Año" sin letras,
  foco al primer campo con error, marcas "· falta" y aviso por renglón. Tests 5/5.
- Suite completa en verde (612/612 en las corridas 2, 4 y 5; la 3 con dos fallas
  de infraestructura que pasan en aislamiento). check-compat 0 violaciones.
- Tres commits con cuerpo (arreglo previo, pieza 1, pieza 2), push hecho.
- Clon en `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-31`
  desde GitHub.
- Paquete generado con `node tools/empaquetar-generador.js --destino
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Prueba del Jefe `PRUEBAS-JEFE\prueba-ronda-31.js` (pendiente de que el revisor
  la corra en navegador real; los checks 1, 2, 3 y 5 están cubiertos por los tests
  por la pantalla, y el 4 por la pieza 1).

---

### Salida completa de la corrida 5 (última, tras el commit de código a26928a)

```
node --test --test-timeout=120000 --test-force-exit "tests/*.test.js"
```
```
✔ RONDA-31 pieza 2c · "Año" no acepta letras mientras se escribe (248.3945ms)
✔ RONDA-31 pieza 2d · "Siguiente" lleva el foco al primer campo con error, marcado y a la vista (308.3182ms)
✔ RONDA-31 pieza 2e · sin valores, el paso queda marcado "falta" y cada renglón dice qué le falta (323.8254ms)
✔ RONDA-31 pieza 2a · sin registrar el anexo de EETT, "Exportar" sigue deshabilitado aunque se imprima (286.7851ms)
✔ RONDA-31 pieza 2b · la lectura vieja de un expediente no pisa a la nueva: gana la última apertura (99.4761ms)
✔ RONDA-31 pieza 1a · el documento de referencia se elige como archivo y su huella es la de sus bytes
✔ RONDA-31 pieza 1b · una justificación es un documento de referencia, y un renglón con un valor y esa justificación está completo
✔ RONDA-31 pieza 1c · lo impreso acompaña los documentos: la leyenda dice qué se adjunta, con su tipo y su fecha
… (resto de los 612 tests) …
✔ alta completa: datos.json, entrada en idx/, número único, auditoría con el correo (7776.9849ms)
ℹ tests 612
ℹ suites 0
ℹ pass 612
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

## 10. Verificación del cierre (ejecutada)

- Informe y su commit: `git add INFORME-RONDA-31.md` → `git commit -m "Ronda 31 · informe"` → `git push`.
- Clon para el auditor: `git clone https://github.com/contra3000/Contrataciones.git C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-31` (ruta absoluta).
- En el clon: `git log --oneline -3` coincide con `dev\`.
- Paquete: `node tools/empaquetar-generador.js --destino C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Después del clon no se commitea nada. Los dos HEAD van en el mensaje final.