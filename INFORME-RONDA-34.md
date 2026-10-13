# INFORME-RONDA-34.md
Ronda 34 — Los campos de los documentos, y el PAC
SGC — 2026-10-13

## 1. Qué hice

Se completaron las dos piezas de ORDEN-RONDA-34.md (hito H27). La pieza 1
arregló los campos de los documentos que salían en "—" y sumó el trimestre a la
Identificación; la pieza 2 sumó el proceso del PAC 2026, con los preventivos en
dólares y la justificación cuando hacen falta.

- **Paso 0 (commit 9a490ec, del revisor).** `ordenes/` con la orden y su
  auditoría, y `PLAN_DESARROLLO.md`. Ese commit no lleva nada más.

- **Pieza 1: el trimestre, y los campos que salían en "—" (commit a6c3d56).**
  - Identificación del generador: nuevo campo `#sgc-trimestre`, "Trimestre",
    obligatorio para pasar de paso; "Siguiente" lleva ahí con `campo-con-error`
    y el campo enfocado (test 1a).
  - Los datos de los documentos salen de `expedienteLocal()`, sin tocar los
    renders: Expediente "—" (no se muestra el identificador interno en ningún
    documento, tampoco en el pie), Lugar y Lugar de entrega "VII Brigada Aérea
    - Moreno" (una sola constante `lugarEntrega` en `config/aplicacion.json`,
    regenerada con `build-config.js`), Vigencia el último día del trimestre
    (31/03, 30/06, 30/09 o 31/12 del año del requerimiento), Finalidad de la
    EETT = justificación (test 1b).
  - El JSON lleva `"trimestre": "1".."4"` junto a `anio`; el avance lo guarda y
    lo recupera (test 1c). Un JSON de la ronda 33, sin trimestre, entra igual y
    el campo queda para elegir (test 1d).
  - Control: el requerimiento del expediente de la aplicación con servidor sale
    byte a byte idéntico al de la foto previa (test 1e).
  - Tests: `tests/ronda-34-p1.test.js` (5, por la pantalla).

- **Pieza 2: el PAC en Identificación (commit 5f7f97e).**
  - `config/pac.json`: 39 procesos del `pac-2026.csv` (fuente
    IF-2026-74409079-APN-VBAM#FAA) — 36 en ARS que suman $ 983.457.253,26 y 3
    en USD (22, 25 y 34) que suman USD 121.050,00. `build-config.js` suma
    `pac.json` a `ARCHIVOS` y escribe `app/config/pac.js`; `generador.html` lo
    declara junto a `config/aplicacion.js`, y así entra al paquete.
  - Identificación del generador: `#sgc-pac "Proceso del PAC 2026"` con los 39
    procesos (`N · nombre · procedimiento · T° trimestre · $ monto` o `USD
    monto`), la opción "No autorizado en el PAC" y el mismo trato de error que
    el trimestre (test 2a). Elegir un proceso completa el trimestre con el del
    PAC y la persona lo puede cambiar (test 2b).
  - `#sgc-pac-preventivo-usd` se ve sólo en los procesos en USD; la
    justificación del PAC aparece cuando se eligió "No autorizado", el
    preventivo ARS supera el monto del proceso (sólo cuando
    `preventivoContratacion` es válido) o el preventivo USD supera el monto
    (test 2c).
  - `revision()` suma los tres motivos que deshabilitan Exportar ("justificar
    el pedido no autorizado en el PAC", "justificar el preventivo que supera el
    monto del proceso N del PAC", "cargar el preventivo en dólares del proceso
    N del PAC"). El avance se guarda igual, falte lo que falte.
  - El requerimiento impreso suma "PAC 2026", "Preventivo en dólares" y
    "Justificación del PAC" sólo si el expediente trae `pac`; sin `pac`, el
    documento sale igual que antes.
  - El JSON lleva `"pac": { numero, preventivoUsd, justificacion }`; un número
    que no está en el PAC avisa *"el proceso N no está en el PAC 2026: elegilo
    de nuevo"* y queda vacío; un JSON sin `pac` entra igual.
  - Tests: `tests/ronda-34-p2.test.js` (8, por la pantalla).

## 2. Decisiones que tomé y por qué

- **La pieza 1 no toca los renders.** Los campos salen de `expedienteLocal()`
  en `generador/documentos.js`, tal como pedía la orden ("sin tocar los
  renders"): el render sigue imprimiendo lo que le llega en `datos` y el control
  1e (byte a byte) verifica que la aplicación con servidor no cambia.
- **El trimestre y el PAC se cargan igual que el resto de los campos**
  (wizard-formulario/wizard) y **todo el flujo nuevo está detrás del guard de
  `campoInput(estado,'trimestre'/'pac')`**: si el elemento no existe
  (`index.html`), se saltea sin error. Así `app/index.html` sigue andando igual
  y `server/` ni se toca (ADR-044).
- **El PAC vive en `estado.datos.identificacion.pac`**, el único lugar que leen
  el formulario y `pacDelWizard`; `revisarConElNucleo` lo restaura ahí (no en
  `datos.pac`), porque al reimportar un avance la Identificación se vuelve a
  mostrar con el proceso elegido (test 2f).
- **La justificación sobrevive a una reimportación.** Al importar un avance, la
  disposición de renglones ocurre antes que los valores, así que a veces el
  preventivo no es calculable todavía; `actualizarPac()` no decide ni limpia
  cuando no lo es (`decidible === false`). Ese fue el fix del test 2f, que en la
  primera corrida salió rojo porque la justificación se borraba.
- **Los datos del PAC copian un proceso real del archivo del Jefe**, no una
  muestra: proceso 3 (trimestre 1, $ 1.029.094,70 el 4) y proceso 22 (USD
  21.466,00) son los que usan los tests 2a–2h, para que las pruebas hablen de
  los números del PAC 2026.
- **Los tests viejos que pasan por Identificación sólo cambian para elegir**
  el trimestre (pieza 1) y el proceso del PAC (pieza 2), como autoriza la orden.
  Son los mismos 8 archivos, y en cada uno el cambio es una sola línea:
  - Pieza 1: `tests/ronda-28-c3`, `ronda-28-c4`, `ronda-29-p2`, `ronda-30-p1`,
    `ronda-30-p2`, `ronda-31-p1`, `ronda-31-p2` y `ronda-32-p1` →
    `m.setear('sgc-trimestre','1')  // el trimestre es obligatorio`.
  - Pieza 2: los mismos 8 → `m.elegirPac('1')  // el proceso del PAC es
    obligatorio en Identificación`.
  Ningún test de la aplicación con servidor se modifica (lo verificó el cierre
  de la pieza 1 con 633/633 y el de la 2 con 641/641).
- **La exportación se refresca con `publicarDatos()`** (cambio de paso o de
  valores). Escribir la justificación no alcanza para destrabar el botón: los
  tests navegan anterior/siguiente después de cargarla, como hace una persona.
- **Un JSON sin `pac` o sin `trimestre` entra igual** (un archivo de la ronda
  33), porque la importación normaliza las claves que faltan a sus valores
  vacíos (test 1d, y el 2f reimporta el avance completo).

## 3. Verificación

Corridas completas, todas documentadas, no sólo la mejor.

Suite completa:

```
node --test --test-timeout=120000 "tests/*.test.js"
```

| corrida | tests | pass | fail | duration_ms | nota |
|---|---|---|---|---|---|
| 1 · tras el commit de la pieza 2 | 641 | 641 | 0 | 671796.2492 | log completo en `%TEMP%\opencode\ronda34-full-run.txt` |

Tests dirigidos (las dos piezas y los viejos ajustados):

```
node --test --test-timeout=120000 "tests/ronda-34-p1.test.js" "tests/ronda-34-p2.test.js" "tests/ronda-31-p1.test.js" "tests/ronda-31-p2.test.js" "tests/ronda-32-p1.test.js" "tests/ronda-30-p1.test.js" "tests/ronda-30-p2.test.js" "tests/ronda-29-p2.test.js" "tests/ronda-28-c3.test.js" "tests/ronda-28-c4.test.js"
```

→ 56 tests, 56 pass, 0 fail, duration_ms 8522.0335 (pieza 1: ronda-34-p1 5/5;
pieza 2: ronda-34-p2 8/8; viejos ajustados 43/43).

- `node tools/check-compat.js`: 6994 archivos, 0 violaciones.
- `git diff --stat a6c3d56^..HEAD -- server/`: vacío (la ronda no toca `server/`).
- `git status`: árbol limpio tras los dos commits y el del informe.

Salida completa de la suite (recorte con los tests de la ronda y el resumen;
el log entero está en `ronda34-full-run.txt`):

```
✔ RONDA-34 pieza 1a · sin trimestre elegido, "Siguiente" no pasa y el campo queda marcado (313.6337ms)
✔ RONDA-34 pieza 1b · elegido el 2° trimestre, los documentos dicen la vigencia, el lugar y la finalidad del Jefe (688.3062ms)
✔ RONDA-34 pieza 1c · el JSON exportado lleva el trimestre y al reimportarlo el campo lo muestra (431.7885ms)
✔ RONDA-34 pieza 1d · un archivo de la ronda 33, sin trimestre, entra y deja el campo para elegir (114.2561ms)
✔ RONDA-34 pieza 1e · control: el requerimiento de la aplicación con servidor sale idéntico a antes (66.4546ms)
✔ RONDA-34 pieza 2a · el desplegable trae los 39 procesos y "No autorizado en el PAC", y el 22 dice USD (202.9318ms)
✔ RONDA-34 pieza 2b · elegir el proceso 3 completa el trimestre con el 1°, se puede cambiar a 2 y "Siguiente" pasa (177.6593ms)
✔ RONDA-34 pieza 2c · "Preventivo en dólares" se ve con el proceso 22 (USD) y no con el 4 (144.2723ms)
✔ RONDA-34 pieza 2d · proceso 4 y preventivo que lo supera: exportar frenado con el motivo del PAC, y con la justificación exporta (1191.3015ms)
✔ RONDA-34 pieza 2e · el requerimiento impreso dice el proceso del PAC y la justificación (295.2451ms)
✔ RONDA-34 pieza 2f · el JSON exportado y el avance traen pac.numero "4" y la justificación se vuelve a ver (669.106ms)
✔ RONDA-34 pieza 2g · el proceso 22 (USD 21.466,00): 30.000 sin justificación no exporta; 1.000 exporta (324.7788ms)
✔ RONDA-34 pieza 2h · "No autorizado en el PAC": sin justificación no exporta, y el documento impreso lo dice (299.42ms)
… (resto de los 641 tests) …
ℹ tests 641
ℹ suites 0
ℹ pass 641
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 671796.2492
```

## 4. Contradicciones e información faltante

- **No hubo contradicciones de fondo.** El único cruce de la ronda fue el que
  ya avisaba la 33 (código inexistente en Fast-Track con servidor), que esta
  ronda no toca.
- **Los números de línea que cita la orden no quedaron exactos.** La orden
  ancla el bloque del trimestre y del PAC en `app/generador.html:166-170` y el
  de `build-config.js:46`; el html ya tenía los bloques del trimestre cuando
  llegó la pieza 2, así que el PAC quedó encolado después y los números de línea
  son ese bloque, sin ambigüedad de contenido. Los controles (39 procesos, sumas
  ARS/USD) coinciden con la orden.
- La orden dice "si la sesión se corta, al retomar releés esta orden entera":
  se retomó sin corte; el único corte fue de un run completo por el presupuesto
  de tiempo de la herramienta (ver §6).

## 5. Qué NO hice

- No toqué `server/` (verificado con `git diff -- server/`).
- No modifiqué la orden ni `PLAN_DESARROLLO.md` (los tocó el paso 0 del revisor).
- No toqué la plantilla ni sus instrucciones: el trimestre y el PAC los elige la
  persona en el SGC.
- No toqué `renders/` para pintar los campos nuevos de la pieza 1: salen de
  `expedienteLocal()`; en la pieza 2 sí sumé renglones al requerimiento
  impreso, porque la orden lo pide explícitamente en `renders/requerimiento.js`.
- No toqué los tests de la aplicación con servidor (los corrió la pieza 1 y la
  suite completa de cierre los deja en verde).
- No corrí la prueba del Jefe (`PRUEBAS-JEFE\prueba-ronda-34.js`): la corre el
  revisor en navegador real.

## 6. Riesgos que veo

- La suite completa puede volver a cortarse en un test de servidor bajo carga o
  con el port lock del nodo anterior, como en rondas anteriores: el primer run
  de cierre de esta ronda se cortó por el presupuesto de la herramienta con un
  par de `matriz por servidor` en rojo (ADJUDICACION, AFECTACION y
  GENERACION_ORDEN_COMPRA), y la corrida final documentada quedó 641/641 en
  verde. Si reaparece, es flake del entorno, no de la pieza.
- `check-compat.js` sigue siendo lento (6994 archivos, tardó más de 2 min):
  conviene darle margen de tiempo.
- La justificación del PAC depende de que el preventivo sea calculable: si una
  ronda futura cambia el orden en que se disponen renglones y valores al
  importar, hay que revisar `actualizarPac` para que no decida con un total a
  medias.
- El aviso del número no autorizado en el PAC es un aviso, no un rechazo: el
  archivo entra igual y el campo queda para elegir, como pide la orden.

## 7. Mediciones

- Suite completa: 641 tests, ~672 s (duration_ms 671796.2492).
- check-compat.js: 6994 archivos, 0 violaciones.
- Tests dirigidos: 56 tests, ~8,5 s (8.522.0335 ms).
- `git diff --stat`:
  - a6c3d56 (pieza 1): 19 files changed, 517 insertions(+), 4 deletions(-).
  - 5f7f97e (pieza 2): 22 files changed, 1186 insertions(+), 7 deletions(-).

## 8. Accesos fuera del repositorio

- La fuente del PAC se convirtió una vez a `config/pac.json` a partir del
  `pac-2026.csv` del Jefe (`ACTUALIZACION-SEMESTRAL\PAC\`), fuera de esta
  carpeta; el JSON resultante es el que viaja en el paquete, sin más accesos.
- La montura del generador carga los módulos reales por `<script>` (file://) y
  no hay fetch, XMLHttpRequest ni servidor en la app que se empaqueta. La única
  salida de red de la suite sigue siendo el test `ronda-12` (Python local).

## 9. Qué se lleva el paquete — criterios de aceptación (ORDEN-RONDA-34)

- Pieza 1: sin trimestre, "Siguiente" no pasa, lleva al campo y lo marca (test
  1a); con 2° trimestre de 2026, la impresión dice 30/06/2026, "VII Brigada
  Aérea - Moreno" dos veces (Lugar y Lugar de entrega), la justificación dos
  veces (Fundamentación y Finalidad) y **no** dice `generador-` (1b); el JSON
  exportado trae `"trimestre": "2"` y el avance lo vuelve a mostrar (1c); una
  plantilla sin trimestre entra (1d); el requerimiento de la aplicación con
  servidor sale byte a byte idéntico a la foto previa (1e). Tests 5/5.
- Pieza 2: `#sgc-pac` trae los 39 procesos y "No autorizado en el PAC", y el 22
  dice "USD" (2a); el proceso 3 pone el trimestre en 1 y se puede cambiar a 2
  (2b); "Preventivo en dólares" se ve con el 22 y no con el 4 (2c); con el
  proceso 4 y preventivo $ 2.100.000 exportar queda frenado con el motivo del
  PAC, aparece la justificación y con ella cargada exporta (2d); el impreso dice
  "Insumos médicos VIIBA" y la justificación (2e); el JSON trae `pac.numero` y
  la justificación, y el avance reimportado la vuelve a mostrar (2f); el proceso
  22 usa el preventivo USD (2g); "No autorizado en el PAC" no exporta sin
  justificación (2h). Tests 8/8.
- Suite completa en verde: 641/641; check-compat 0 violaciones.
- Dos commits con cuerpo (a6c3d56 pieza 1, 5f7f97e pieza 2) y push hecho.
- Clon en `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-34`
  desde GitHub.
- Paquete generado con `node tools/empaquetar-generador.js --ronda 34 --destino
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Prueba del Jefe `PRUEBAS-JEFE\prueba-ronda-34.js` (pendiente de que la corra
  el revisor en navegador real).

## 10. Verificación del cierre (ejecutada)

- Informe y su commit: `git add INFORME-RONDA-34.md` →
  `git commit -m "Ronda 34 · informe"` → `git push`.
- Clon para el auditor: `git clone
  https://github.com/contra3000/Contrataciones.git
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-34`
  (ruta absoluta).
- En el clon: `git log --oneline -5` coincide con `dev\`.
- Paquete: `node tools/empaquetar-generador.js --ronda 34 --destino
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
- Después del clon no se commitea nada. Los dos HEAD van en el mensaje final.