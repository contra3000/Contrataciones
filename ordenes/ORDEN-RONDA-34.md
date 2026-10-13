# ORDEN DE TRABAJO — RONDA 34 · Los campos de los documentos, y el PAC

SGC · 2026-10-13 · hito H27 · Reglas: `CICLO_DE_TRABAJO.md` · Por qué: los dos primeros
ítems de la cola (`PLAN_DESARROLLO.md` §0.1, 13/10), con las decisiones del Jefe en
`AppOptimizar\PRUEBAS-JEFE\DEVOLUCION-RONDA-33.md`

**Paso 0 · publicar:** `git add ordenes PLAN_DESARROLLO.md` → `git commit -m "Revisor:
ordenes y plan al dia"` → `git push`. **Ese commit no lleva nada más.**

**Dos piezas.**

- **Cada pieza:** tests en verde → commit con cuerpo (qué cambió y qué test lo prueba) →
  `git push`. **Recién después empezás la siguiente.** En la 33, las dos piezas se
  commitearon con 41 segundos de diferencia.
- **Si la sesión se corta**, al retomar releés esta orden entera.
- **Cada botón o campo que se toca lleva un test que lo usa por la pantalla.**
- **La aplicación con servidor está congelada** (ADR-044):
  - `server/` no se toca;
  - lo compartido (`views/`, `renders/`, `core/`) puede cambiar sólo si `app/index.html`
    sigue andando igual, sin `#sgc-trimestre` ni `#sgc-pac`;
  - sus tests no se modifican;
  - **un test viejo del generador** que pase por Identificación puede cambiar **sólo para
    elegir el trimestre y el proceso del PAC**, y el informe lo declara, test por test.
- **La plantilla y sus instrucciones no cambian.** El trimestre y el PAC los elige la
  persona en el SGC, no el asistente.

---

## Pieza 1 · El trimestre, y los campos que salían en "—"

commit: `Ronda 34 · trimestre y campos de los documentos`

**Lo que decidió el Jefe el 13/10:**

| Documento | Campo | Hoy | Tiene que decir |
|---|---|---|---|
| Requerimiento | Expediente | `generador-J C · 1` | **—** (no se muestra el identificador interno en ningún documento, tampoco en el pie) |
| Requerimiento | Expediente Nº | — | — (queda así) |
| Requerimiento | Lugar | — | **VII Brigada Aérea - Moreno** |
| Requerimiento y EETT | Vigencia | — | **El último día del trimestre** para el que se pide: 31/03, 30/06, 30/09 o 31/12 del año del requerimiento, en `dd/mm/aaaa` |
| EETT | Finalidad | — | **La justificación del requerimiento**, el mismo texto |
| EETT | Lugar de entrega | — | **VII Brigada Aérea - Moreno** |

**Cambia:**

**a. "Trimestre" en Identificación,** sólo en `app/generador.html`, después de "Año"
(`:166-170`):

- `<select id="sgc-trimestre">` con una opción vacía y `1` a `4` ("1° trimestre"…), más su
  `<p id="sgc-error-trimestre">`.
- **Es obligatorio para pasar de Identificación.** El mensaje es *"Elegí el trimestre para
  el que se pide"*. "Siguiente" lleva a ese campo con `campo-con-error`, como en la 31
  (`generador.js:356`).
- Se lee y se escribe donde se leen los otros campos (`views/wizard-formulario.js:28-41`
  y `views/wizard.js:408-416`). **Si el elemento no existe** (`index.html`), se saltea sin
  error.

**b. Los datos de los documentos** salen de `expedienteLocal()`
(`generador/documentos.js:57-79`), **sin tocar los renders**:

- `datos.identificacion.lugar`;
- `datos.identificacion.vigencia`;
- `datos.identificacion.finalidad`;
- el `expedienteId` deja de llegar a los documentos.

El lugar es **una sola constante**: `lugarEntrega` en `config/aplicacion.json`, y después
`node tools/build-config.js`.

**c. El JSON** (`generador/intercambio.js`: `contenido()` `:295-305`, la importación
`:480-500` y `revisarConElNucleo` `:608`):

- lleva `"trimestre": "1".."4"` junto a `anio`;
- el avance lo guarda y lo recupera;
- **un JSON sin `trimestre`** (de la 33 o una plantilla) entra igual, y el campo queda
  para elegir.

**Test, por la pantalla:**

1. Sin trimestre, "Siguiente" no pasa y deja el foco en `#sgc-trimestre` con
   `campo-con-error`.
2. Con año 2026 y 2° trimestre, la impresión dice:
   - `30/06/2026`;
   - "VII Brigada Aérea - Moreno" dos veces (Lugar y Lugar de entrega);
   - la justificación dos veces (Fundamentación y Finalidad);
   - y **no** dice `generador-`.
3. El JSON exportado trae `"trimestre": "2"`. El avance reimportado lo vuelve a mostrar.
4. Una plantilla sin `trimestre` entra.
5. **La aplicación con servidor:** el requerimiento de un expediente suyo sale **igual
   byte a byte** que antes de la ronda.

## Pieza 2 · El PAC en Identificación

commit: `Ronda 34 · PAC en Identificación`

**Lo que decidió el Jefe** (02/10, confirmado el 13/10):

- cada requerimiento dice **a qué proceso del PAC corresponde**, o que **no está
  autorizado en el PAC**;
- si el preventivo **supera el monto del proceso**, o si no está en el PAC, **se pide una
  justificación**;
- **los procesos en dólares piden el preventivo en USD**, y se compara contra el monto
  del PAC.

**Cambia:**

**a. Los datos del PAC.**

- Convertís **una vez**
  `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\ACTUALIZACION-SEMESTRAL\PAC\pac-2026.csv`
  (separado por `;`, con las columnas `numero;nombre;procedimiento;trimestre;monto;moneda`)
  en **`config/pac.json`**:

  ```json
  { "anio": 2026, "fuente": "IF-2026-74409079-APN-VBAM#FAA",
    "procesos": [ { "numero": 1, "nombre": "Calibración VII BA",
      "procedimiento": "Licitación Privada", "trimestre": 1,
      "monto": 63617500.00, "moneda": "ARS" }, … ] }
  ```

- `tools/build-config.js` suma `'pac.json'` a `ARCHIVOS` (`:46`), y escribe
  `app/config/pac.js`.
- `generador.html` lo declara junto a `config/aplicacion.js` (`:383`), y así entra en el paquete.
- **Controles:** son **39 procesos**:
  - 36 en ARS, que suman **$ 983.457.253,26**;
  - 3 en USD, el 22, el 25 y el 34, que suman **USD 121.050,00**.

**b. En Identificación**, sólo en `generador.html`, después de "Trimestre":

- **`<select id="sgc-pac">` "Proceso del PAC 2026":**
  - una opción vacía;
  - los 39 procesos. El **value** es el número, y el texto dice `N · nombre ·
    procedimiento · T° trimestre · $ monto`, o `USD monto` en los de dólares;
  - al final, la opción `no-autorizado`, con el texto **"No autorizado en el PAC"**.

  **Es obligatorio** para pasar de Identificación, con el mismo trato de error que el
  trimestre.
- **Elegir un proceso completa `#sgc-trimestre` con el trimestre del PAC**, y la persona lo
  puede cambiar.
- **`#sgc-pac-preventivo-usd`** ("Preventivo en dólares", numérico) se ve **sólo** si el
  proceso es en USD.
- **`#sgc-pac-justificacion`** ("Justificación del PAC") se ve cuando:
  - se eligió "No autorizado en el PAC";
  - en ARS, el preventivo total supera el monto del proceso. Se usa
    `SGC.core.requerimiento.preventivoContratacion`, y sólo cuando ese total es válido;
  - en USD, el preventivo en dólares supera el monto del proceso.

**c. Lo que falta para exportar**, en `revision()` (`generador/documentos.js:103-122`).
Exportar queda deshabilitado, con su motivo, cuando:

- *"justificar el pedido no autorizado en el PAC"*;
- *"justificar el preventivo que supera el monto del proceso N del PAC"*;
- *"cargar el preventivo en dólares del proceso N del PAC"*.

**El avance se guarda igual**, falte lo que falte.

**d. El requerimiento impreso** (`renders/requerimiento.js`, `paresEncabezado` `:84-110`)
suma estos renglones **sólo si el expediente trae `pac`**:

- *"PAC 2026"*: `Proceso N · nombre · procedimiento · T° trimestre · $ monto`, o *"No
  autorizado en el PAC"*;
- *"Preventivo en dólares"*, si es un proceso en USD;
- *"Justificación del PAC"*, si hay justificación.

Sin `pac`, el documento sale igual que hoy. Es el control 5 de la pieza 1, que se repite
acá.

**e. El JSON:**

- lleva `"pac": { "numero": "4" | "no-autorizado", "preventivoUsd": número o null,
  "justificacion": "" }`;
- el avance lo guarda y lo recupera;
- **un número que no está en el PAC** avisa *"el proceso N no está en el PAC 2026: elegilo
  de nuevo"* y queda vacío;
- un JSON sin `pac` entra igual.

**Test, por la pantalla:**

1. `#sgc-pac` trae los 39 procesos y "No autorizado en el PAC", y el 22 dice "USD".
2. El proceso 3 pone el trimestre en 1, y se puede cambiar a 2.
3. "Preventivo en dólares" se ve con el 22 y no con el 4.
4. **Con el proceso 4 ($ 1.029.094,70) y un preventivo de $ 2.100.000:**
   - Exportar está deshabilitado y el motivo nombra el PAC;
   - aparece la justificación;
   - con la justificación cargada, exporta.
5. **El requerimiento impreso** dice "Insumos médicos VIIBA" y la justificación del PAC.
6. **El JSON** trae `pac.numero` `"4"` y la justificación. El avance reimportado la vuelve
   a mostrar.
7. **El proceso 22 (USD 21.466):**
   - con 30.000 USD no exporta sin justificación;
   - con 1.000 USD exporta.
8. **"No autorizado en el PAC":** no exporta sin justificación, y el documento lo dice.

---

## Cierre · siempre igual

1. **`INFORME-RONDA-34.md`**, con sus nueve secciones y todas las corridas copiadas del log.
   - Si hay que corregirlo, la corrección va antes del clon, como commit propio y declarado.
2. Commit → `git push`.
3. **Clon con la ruta absoluta:** `git clone https://github.com/contra3000/Contrataciones.git
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-34`.
4. **Paquete:** `node tools/empaquetar-generador.js --ronda 34 --destino
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
5. Después del clon no se commitea nada. Los dos HEAD van en tu mensaje final.

## Tu prueba de 10 minutos · para el Jefe

Antes, el revisor corre `PRUEBAS-JEFE\prueba-ronda-34.js` y las de las rondas 30, 31 y 33.
**Escribí tu devolución en `PRUEBAS-JEFE\DEVOLUCION-RONDA-34.md`, no en esta orden.**

1. En Identificación, elegí el proceso del PAC de un requerimiento real. **¿La lista es la
   del PAC 2026? ¿El trimestre se completa solo?**
2. Cargá valores que superen el monto del proceso. **¿Te frena al exportar y te pide la
   justificación del PAC?**
3. Imprimí. **¿Lugar, Lugar de entrega, Vigencia y Finalidad dicen lo que pediste? ¿El
   requerimiento dice el proceso del PAC?**
4. Elegí un proceso en dólares. **¿Te pide el preventivo en USD?**
