# ORDEN DE TRABAJO — RONDA 41 · Los presupuestos en la plantilla, y los pasos que se clickean

SGC · 2026-10-23 · hito H27 · Reglas: `CICLO_DE_TRABAJO.md` · Por qué: los dos primeros
ítems de la cola (`PLAN_DESARROLLO.md` §0.1, 23/10):

- el **19**: el JSON trae los montos de los presupuestos;
- el **20**: los pasos se pueden clickear.

Los dos son N3 que el Jefe declaró **bloqueantes para Abastecimiento** (15/10). Después de
esta ronda, la cola llega a Abastecimiento.

**Paso 0 · publicar:** `git add ordenes PLAN_DESARROLLO.md` → `git commit -m "Revisor:
ordenes y plan al dia"` → `git push`. **Ese commit no lleva nada más.**

**Dos piezas.**

- **Cada pieza: la suite completa en verde (`node tools/suite.js`) → commit con cuerpo**
  (qué cambió y qué test lo prueba) → `git push`. Recién después empezás la siguiente.
- **El test nuevo va en el mismo commit que el código que lo hace pasar.**
- **Cada caso de esta orden va en su propio test**, y la aserción mira ese caso: no un
  conteo del catálogo (lo preguntó el auditor 40).
- **Si la sesión se corta**, al retomar releés esta orden entera.
- **Tu mensaje final trae `git status --short` vacío.**
- **Cada botón o campo que se toca lleva un test que lo usa por la pantalla.**
- **La aplicación con servidor está congelada** (ADR-044):
  - `server/` y `app/js/core/` no se tocan;
  - sus tests no se modifican;
  - su requerimiento **y su plantilla** salen iguales byte a byte.
- **El informe describe cada test viejo que cambió**, uno por uno.

---

## Pieza 1 · Los presupuestos vienen en la plantilla

commit: `Ronda 41 · los presupuestos en la plantilla`

**Lo que pidió el Jefe** (15/10), y cómo lo quiere (17/10):

- la plantilla trae cada presupuesto con proveedor, fecha, tipo y el valor unitario de cada
  renglón;
- al importar, quedan como documentos **"sin PDF"**;
- **para imprimir o exportar, hay que elegir el PDF de cada uno** (huella).

**Qué pasa hoy** (`r40-1ebf5ef`):

- la regla 6 de las instrucciones dice *"Los precios y los presupuestos no van en este JSON"*
  (`views/fasttrack.js:69`);
- la plantilla se lee sin presupuestos: `generador/intercambio.js:605-660` arma
  `presupuestos: []`;
- un documento sin nombre de archivo se descarta al cargar (`generador/presupuestos.js:216`).

**Cambia:**

**a. La plantilla, sólo en el generador.**

- `fasttrack.modelo()` (`views/fasttrack.js:40`) suma, **sólo con la marca del generador**
  (la misma que usa `exigirIdentificacionCompleta`):
  ```json
  "presupuestos": [
    { "proveedor": "Librería Sur", "fecha": "2026-02-12", "tipo": "presupuesto",
      "valores": [ { "renglon": 1, "unitario": 4500 } ] }
  ]
  ```
- La regla 6 pasa a decir que va **un presupuesto por cada presupuesto u orden de compra
  adjunta**, con:
  - proveedor;
  - fecha (`AAAA-MM-DD`);
  - tipo (`"presupuesto"` o `"precio-plaza"`);
  - en `valores`, el número de renglón y el **valor unitario sólo con números**: sin `$` ni
    puntos de miles, y con punto decimal.

  Y que si un presupuesto no cotiza un renglón, ese renglón no va en sus `valores`. **Nunca se
  inventa un precio.**
- **Sin la marca**, la aplicación con servidor baja la misma plantilla de hoy, byte a byte.

**b. Al importar una plantilla** (`intercambio.js:605`, `cuerpoDePlantilla`):

- cada presupuesto **con proveedor** entra como documento de referencia:
  - `id` `ref-N`;
  - proveedor, fecha y tipo;
  - fecha pasada por `utils.fechaAIso`, para que `02/10/2026` quede `2026-10-02`;
  - tipo: cualquier valor que no sea `precio-plaza` queda `presupuesto`;
  - **`sinPdf: true`**, sin nombre de archivo ni huella.
- Cada valor válido va a `valoresReferencia` de su renglón: `{presupuestoId, base:
  "unitario", valor}`.
- **Lo que no sirve no rechaza la plantilla.** Se saltea, y el aviso de importación lo
  nombra:
  - un presupuesto sin proveedor;
  - un renglón que no existe;
  - un valor que no es un número mayor que 0, como `"$ 5.400"`.

  El aviso dice el proveedor, el renglón y el valor.
- **`revisarValores` (`:678`, llamada en `:945`) no se aplica a una plantilla**, igual que a
  un avance. Hoy rechazaría el archivo entero si un renglón trae un solo valor. Lo que falte
  se ve en la pantalla.
- **Una plantilla sin `presupuestos`** (las de antes) entra como hoy.

**c. El documento "sin PDF"** (`presupuestos.js`):

- `cargar` (`:205`) lo conserva aunque no tenga nombre de archivo (`:216`). `listar` (`:287`)
  y el JSON (`intercambio.js:314`) llevan `sinPdf: true`;
- en la lista dice **"Proveedor · fecha · tipo · falta el PDF"** (`textoDe`, `:45`);
- cada uno tiene su `<input type="file" data-pdf-de="<id>">`, con
  `aria-label="Elegir el PDF del documento de <proveedor>"`. Al elegir el archivo:
  - se calculan nombre, tamaño y huella, como en `agregar` (`:140`);
  - **el id no cambia**, así que los valores siguen citándolo;
  - se va el "falta el PDF".
- **Un avance** guardado con documentos sin PDF los lleva así, y al importarlo vuelven igual,
  con sus valores.

**d. Imprimir y Exportar frenan** mientras quede un documento sin PDF (`documentos.js`,
`revision`, `:365`, junto al PAC, `:382`):

- motivo: *"elegir el PDF de los documentos de referencia: Matafuegos Sur, Librería Norte"*;
- "2 · Renglones" queda en "falta". `generador.js` `pasosPendientes` (`:375`) ya lo marca si
  `faltantes.renglones` no está vacío.

**e. La moneda.** Los valores se toman en la moneda del proceso del PAC, igual que cuando se
escriben a mano. La plantilla no la elige.

**Test, por la pantalla, uno por caso.** El revisor lo midió con una implementación de
prueba:

1. La plantilla del generador trae `presupuestos`, y la regla 6 nueva.
2. La plantilla del servidor (sin la marca) sale igual byte a byte que en `1ebf5ef`.
3. Pegar una plantilla con dos presupuestos (Matafuegos Sur y Librería Norte), cada uno con
   los dos renglones:
   - dos documentos "falta el PDF";
   - los cuatro valores en sus renglones.
4. Así, no imprime ni exporta, y el motivo nombra a los dos proveedores.
5. Con el PDF de cada uno:
   - exporta;
   - cada presupuesto trae `nombreOriginal` y `sha256`;
   - los valores citan a su presupuesto con `base: "unitario"`.
6. La fecha `02/10/2026` sale `2026-10-02`.
7. Un avance con documentos sin PDF vuelve sin PDF y con sus valores.
8. Un renglón cotizado una sola vez: la plantilla entra, y el renglón pide su segundo valor.
9. El renglón 9 que no existe y el valor `"$ 5.400"`: entra lo demás, y el aviso los nombra.
10. Una plantilla sin `presupuestos` entra como hoy.

## Pieza 2 · Los pasos se clickean

commit: `Ronda 41 · los pasos se clickean`

**Lo que pidió el Jefe** (15/10, de nuevo el 16/10): que *"1 · Identificación"* …
*"4 · Revisión"* se puedan clickear para ir directo. **Hoy un clic no hace nada.**

**Cambia, sólo en el generador:**

- en `generador.html:125-130`, cada `<li data-paso>` lleva adentro un
  `<button type="button" data-ir-paso="<id>">` con el mismo texto. `index.html` no se toca;
- `SGC.views.wizard` suma **`irA(idPaso)`** (`views/wizard.js:765`), que sincroniza el
  formulario y llama a `irAPaso(n, false)` (`:58`). **No valida**, igual que "Anterior":
  - lo que falta lo siguen diciendo la marca "· falta" y los frenos de Imprimir y Exportar;
  - "Siguiente" sigue validando como hoy.

  Es una función nueva: la aplicación con servidor no la llama;
- `generador.js` escucha el clic en `#sgc-pasos` y llama a `irA`;
- la marca "· falta" (`generador.js:405-437`) sigue a la vista, dentro del `<li>`;
- con Tab se llega a cada botón, y Enter va al paso.

**Test, por la pantalla, uno por caso:**

1. Desde Identificación vacía, un clic en "4 · Revisión":
   - va a Revisión, con `aria-current="step"`;
   - no exporta, y dice qué falta.
2. Desde Revisión, "2 · Renglones" vuelve a Renglones.
3. Lo escrito no se pierde: escribir el título, ir a 3 y volver a 1.
4. Con Tab y Enter.
5. "Siguiente" sigue frenando con Identificación vacía.

---

## Cierre · siempre igual

1. **`INFORME-RONDA-41.md`**, con sus nueve secciones y todas las corridas copiadas del log.
   - Si hay que corregirlo, la corrección va antes del clon, como commit propio y declarado.
2. Commit → `git push`.
3. **`git status --short` en `dev\`: vacío.** Lo pegás en tu mensaje final.
4. **Clon con la ruta absoluta:** `git clone https://github.com/contra3000/Contrataciones.git
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-41`.
5. **Paquete:** `node tools/empaquetar-generador.js --ronda 41 --destino
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
6. Después del clon no se commitea nada. Los dos HEAD van en tu mensaje final.

## Tu prueba de 10 minutos · para el Jefe

Antes, el revisor corre `PRUEBAS-JEFE\prueba-ronda-41.js` y las de las rondas 30 a 40.
**Esperá a que te diga que pasaron enteras.** Escribí tu devolución en
`PRUEBAS-JEFE\DEVOLUCION-RONDA-41.md`.

1. Bajá la plantilla y pasásela al asistente **con dos presupuestos de verdad**. Pegá la
   respuesta. **¿Entran los presupuestos, con sus valores en cada renglón?**
2. Elegí el PDF de cada uno. **¿Te deja exportar recién ahí?**
3. Apretá "4 · Revisión" desde el paso 1, y después "2 · Renglones". **¿Te lleva directo?**
