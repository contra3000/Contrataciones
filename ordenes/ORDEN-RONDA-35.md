# ORDEN DE TRABAJO — RONDA 35 · Identificación completa, y el PAC bien impreso

SGC · 2026-10-14 · hito H27 · Reglas: `CICLO_DE_TRABAJO.md` · Por qué: los dos primeros
ítems de la cola (`PLAN_DESARROLLO.md` §0.1, 14/10): el 12 y el 15, los dos N2. Se les
suman dos que tocan el mismo código:

- el **16**, "Lugar de entrega", que el Jefe pasó a esta ronda el 14/10;
- el **14**, "Imprimir" sin la justificación del PAC.

**El piloto usa este generador (`r34-187a184`) desde el 14/10.**

**Paso 0 · publicar:** `git add ordenes PLAN_DESARROLLO.md` → `git commit -m "Revisor:
ordenes y plan al dia"` → `git push`. **Ese commit no lleva nada más.**

**Dos piezas.**

- **Cada pieza:** tests en verde → commit con cuerpo (qué cambió y qué test lo prueba) →
  `git push`. **Recién después empezás la siguiente.**
- **Si la sesión se corta**, al retomar releés esta orden entera.
- **Cada botón o campo que se toca lleva un test que lo usa por la pantalla.**
- **La aplicación con servidor está congelada** (ADR-044):
  - `server/` no se toca;
  - sus tests no se modifican;
  - el requerimiento de un expediente suyo sale **igual byte a byte** (el control 1e de la 34
    sigue en verde).
- **El informe lista todos los archivos de `tests/` que tocó**, también los de
  `tests/helpers/`. En la 34 faltó `generador-montura.js`.

---

## Pieza 1 · Identificación completa: avances viejos y lugar de entrega

commit: `Ronda 35 · Identificación obligatoria también en archivos viejos, y lugar de entrega`

### a. Los avances viejos (ítem 12)

**Qué pasa hoy** (`AppOptimizar\PRUEBAS-JEFE\repro35-json-viejo.js`, con
`PRUEBAS-JEFE\r33-completo.json`, un requerimiento completo exportado con la 33):

1. Se importa. Los pasos llegan a la revisión sin pedir nada.
2. **"Exportar para Abastecimiento" queda habilitado.**
3. El documento sale con "Vigencia —" y sin PAC.
4. El JSON sale con `"trimestre": ""` y `"pac": null`.

**Por qué:** `core/validacion.js:291` y `:299` exigen el trimestre y el PAC **sólo si el
campo existe** en los datos (`campos.trimestre !== undefined`), y un archivo de antes de la
34 no los trae. Es también la pregunta del auditor 34.

**Cambia:**

- **La obligación depende de una marca explícita del generador**, no de que el campo
  exista. El generador la pone al montarse (`generador.js:456`), y la validación de
  Identificación la recibe. **Sin la marca**, como en la aplicación con servidor, todo
  sigue como hoy.
- **Con la marca**, falte o no el campo en el archivo:
  - "Siguiente" no pasa de Identificación sin trimestre ni PAC;
  - **"Exportar para Abastecimiento" queda deshabilitado** con *"elegir el trimestre"* y
    *"elegir el proceso del PAC"*;
  - el paso "1 · Identificación" queda marcado *"· falta"*, como en la 31.
- **El avance se guarda igual**, falte lo que falte.

### b. "Lugar de entrega" lo completa la persona (ítem 16)

**Lo que decidió el Jefe el 14/10:** el lugar de entrega de la EETT lo escribe la persona,
porque *"no me va a permitir que sea útil el exportable sin eso"*. **"Lugar" del
requerimiento sigue fijo**: es `lugarEntrega` de `config/aplicacion.json`, como en la 34.

- **En `generador.html`**, al final de Identificación, después del bloque del PAC:
  - `<input id="sgc-lugar-entrega" type="text">` "Lugar de entrega", **vacío**, con el
    ejemplo *"Ej.: Depósito de Intendencia, VII Brigada Aérea"* como `placeholder`;
  - su `<p id="sgc-error-lugar-entrega">`.
- **Es obligatorio, con la misma marca del generador** que el trimestre y el PAC. El
  mensaje es *"Escribí el lugar de entrega"*, y lleva el mismo trato de "Siguiente" y de
  Exportar que en la parte a.
- **La EETT** imprime en "Lugar de entrega" lo que escribió la persona. Hoy imprime la
  constante (`generador/documentos.js`, `expedienteLocal()`).
- **El JSON** lleva `"lugarEntrega"` junto al trimestre. El avance lo recupera. **Un
  archivo sin `lugarEntrega`** entra, y el campo queda para escribir.

**Test, por la pantalla:**

1. Importar `r33-completo.json` (copialo a `tests/fixtures/`) → Exportar deshabilitado, el
   motivo dice trimestre, PAC y lugar de entrega, y el paso 1 dice "falta".
2. Elegir el trimestre y el proceso 1, y escribir "Depósito de Intendencia, Hangar 3" →
   imprimir → **exporta**:
   - el JSON trae los tres;
   - la EETT dice "Depósito de Intendencia, Hangar 3";
   - el requerimiento sigue diciendo "Lugar: VII Brigada Aérea - Moreno".
3. Lo mismo con un avance de la 31 sin `trimestre` ni `pac`.
4. Con el lugar de entrega vacío, "Siguiente" no pasa y deja el foco en
   `#sgc-lugar-entrega` con `campo-con-error`.
5. **Sin la marca** (montura de la aplicación con servidor), `validarIdentificacion` de
   unos datos sin `trimestre`, `pac` ni `lugarEntrega` sigue siendo válida.

## Pieza 2 · El PAC bien impreso: los procesos en dólares, y "Imprimir" que también frena

commit: `Ronda 35 · procesos del PAC en dólares, e imprimir con lo que falta del PAC`

### a. Los procesos en dólares (ítem 15)

**Qué pasa hoy** (`PRUEBAS-JEFE\repro-usd.js`). Con el proceso 22 (USD) y 10 × 100 en los
valores de referencia, el requerimiento imprime **"Total general: $ 1.000,00 — LA SUMA DE:
PESOS MIL"**, y aparte un "Preventivo en dólares" cargado a mano. El documento dice pesos
de algo que es en dólares.

**Lo que decidió el Jefe el 14/10:**

- en un proceso en USD, **los valores de referencia son en dólares**;
- el preventivo **se calcula igual que en pesos**, con el promedio de los presupuestos, de
  las órdenes de compra anteriores, o de lo que haya;
- **sale el campo manual.**

**Cambia:**

- **La moneda del requerimiento** sale del proceso elegido: `USD` si el proceso es en
  dólares, y `ARS` en los demás casos, también con "No autorizado en el PAC".
- **Sale el campo manual del preventivo en dólares:** `generador.html:201-204`, y lo que
  lo maneja en `views/wizard.js:438-446` y `:545-555` y en
  `views/wizard-formulario.js:56-64` y `:83-86`.
- **El bloque de valores de referencia dice la moneda.** En un proceso en USD, los textos
  "Promedio unitario", "Preventivo del renglón" y "Valor preventivo de la contratación"
  (`views/requerimiento-valores.js:248-263`) muestran `USD` en vez de `$`. Es compartido:
  sin moneda, sale `$` como hoy.
- **El requerimiento impreso** (`renders/requerimiento.js:247-248` y `:334-335`) dice
  "Total general: USD 1.000,00" y **"LA SUMA DE: DÓLARES ESTADOUNIDENSES MIL CON
  00/100.-"**.
  - `core/requerimiento.js:373` (`totalEnLetras`) recibe la moneda; **sin moneda, dice
    PESOS como hoy**.
  - La fila "Preventivo en dólares" deja de imprimirse.
- **La comparación con el PAC** (`generador/documentos.js:120`, `itemsDelPac`) usa en USD
  el mismo preventivo calculado que en ARS, contra el monto del proceso en dólares, con el
  mismo motivo: *"justificar el preventivo que supera el monto del proceso N del PAC"*.
- **El JSON** lleva `"moneda": "ARS" | "USD"` en el expediente, y deja de llevar
  `pac.preventivoUsd`.
- **Un avance de la 34 que traiga `pac.preventivoUsd`** se importa sin error. El valor se
  ignora, con el aviso *"el preventivo en dólares ahora sale de los valores de
  referencia"*.

**Test, por la pantalla:**

1. Con el proceso 22, no existe `#sgc-pac-preventivo-usd`.
2. Con 10 × 100 en los valores, el bloque de valores dice "USD", y el requerimiento dice
   "USD 1.000,00" y "DÓLARES ESTADOUNIDENSES MIL", **y no dice "PESOS" ni "$ 1.000,00"**.
3. **Con 10 × 3.000 (USD 30.000 contra USD 21.466 del PAC):**
   - no exporta, y el motivo nombra el proceso 22;
   - con la justificación, exporta;
   - el JSON trae `"moneda": "USD"`.
4. **Con el proceso 4 (ARS)**, el requerimiento sigue diciendo "$" y "PESOS", y el JSON
   dice `"moneda": "ARS"`.
5. Un avance de la 34 con `pac.preventivoUsd: 1000` entra, con el aviso.

### b. "Imprimir" también frena con lo que falta del PAC (ítem 14)

**Qué pasa hoy.** Lo muestran el PDF del Jefe
(`AppOptimizar\SGC · Generador de documentos Prueba ronda 34.pdf`) y
`PRUEBAS-JEFE\repro-caso-jefe.js`:

- con el proceso 32 ($ 762.637,50) y un preventivo de $ 106.000.369,00, **"Exportar" queda
  frenado bien**;
- pero **"Imprimir los documentos" compone e imprime** el requerimiento sin la
  justificación del PAC y sin aviso.

La causa: `imprimir()` (`generador/documentos.js:285-292`) sólo se frena por campos y
renglones, y no mira `itemsDelPac`. El Jefe imprimió y vio salir el papel: *"no me
frenó"*.

**Cambia:**

- `imprimir()` **también se frena con lo que falta del PAC**, con el mismo motivo que
  Exportar, a la vista (`#sgc-exportar-msj`). No compone ni imprime nada.
- Con la justificación cargada, imprime como hoy.

**Test, por la pantalla:**

1. Proceso 32, preventivo de $ 106.000.000 sin justificación → "Imprimir":
   - `#sgc-generador-impresion` queda vacío;
   - el motivo dice *"justificar el preventivo que supera el monto del proceso 32 del
     PAC"*.
2. Con la justificación, "Imprimir" compone el requerimiento, y el requerimiento dice
   "Justificación del PAC".

---

## Cierre · siempre igual

1. **`INFORME-RONDA-35.md`**, con sus nueve secciones y todas las corridas copiadas del log.
   - Si hay que corregirlo, la corrección va antes del clon, como commit propio y declarado.
2. Commit → `git push`.
3. **Clon con la ruta absoluta:** `git clone https://github.com/contra3000/Contrataciones.git
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-35`.
4. **Paquete:** `node tools/empaquetar-generador.js --ronda 35 --destino
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
5. Después del clon no se commitea nada. Los dos HEAD van en tu mensaje final.

## Tu prueba de 10 minutos · para el Jefe

Antes, el revisor corre `PRUEBAS-JEFE\prueba-ronda-35.js` y las de las rondas 30, 31, 33
y 34. **Escribí tu devolución en `PRUEBAS-JEFE\DEVOLUCION-RONDA-35.md`, no en esta orden.**

1. Importá un avance que hayas guardado con la 31 o la 33. **¿Te pide el trimestre, el PAC
   y el lugar de entrega antes de exportar?**
2. Escribí el lugar de entrega e imprimí. **¿La EETT dice lo que escribiste?**
3. Repetí tu caso del PDF: el proceso 32 con un preventivo que lo supera, **sin
   justificación**. **¿"Imprimir" y "Exportar" te frenan y te dicen por qué?**
4. Elegí un proceso en dólares y cargá los presupuestos en dólares. **¿El preventivo sale
   solo, en USD, y el requerimiento dice DÓLARES y no PESOS?**
