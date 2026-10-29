# ORDEN DE TRABAJO — RONDA 42 · Abastecimiento: juntar los requerimientos y el ANEXO I consolidado

SGC · 2026-10-29 · hito H27 · Reglas: `CICLO_DE_TRABAJO.md` · Por qué: los dos primeros
ítems de la cola (`PLAN_DESARROLLO.md` §0.1, 29/10), los primeros N4:

- el **7a**: el rol Abastecimiento en el generador, que importa varios requerimientos y los
  lista;
- el **7b**: la consolidación en el núcleo, y el ANEXO I con los renglones sumados y el
  desglose. **Se le suma el 36** (N2, 29/10): el ANEXO 1 dice `undefined` en el encabezado y
  en el pie.

Lo que dice el circuito (ADR-043, aceptado por el Jefe el 29/09):

- **la SCo junta varios requerimientos**;
- **el mismo código de catálogo es un solo renglón con la cantidad sumada**, y debajo, el
  desglose: *"GOE: 10 · Grupo Base 7: 5"*.

**Paso 0 · publicar:** `git add ordenes PLAN_DESARROLLO.md` → `git commit -m "Revisor:
ordenes y plan al dia"` → `git push`. **Ese commit no lleva nada más.**

**Dos piezas.**

- **Cada pieza, por separado: la suite completa en verde (`node tools/suite.js`) → commit
  con cuerpo → `git push`. Recién después empezás la siguiente.**
  - En la 41 las dos piezas se hicieron juntas, con una sola corrida al final, y se separaron
    en dos commits con un minuto de diferencia. **Eso no cumple.**
  - El informe pega **una línea de totales por pieza**, con la hora.
- **El test nuevo va en el mismo commit que el código que lo hace pasar.**
- **Cada caso de esta orden va en su propio test**, y la aserción mira ese caso.
- **Si la sesión se corta**, al retomar releés esta orden entera.
- **Tu mensaje final trae `git status --short` vacío.**
- **Cada botón o campo nuevo lleva un test que lo usa por la pantalla.**
- **La aplicación con servidor está congelada** (ADR-044):
  - `server/` no se toca, ni sus tests;
  - de `app/js/core/` sólo se **agrega** un archivo nuevo (pieza 2). Ninguno de los que existen
    cambia;
  - de lo compartido, sólo cambia `modelo()` de `renders/anexo-1.js`, para que el ANEXO 1 deje
    de decir `undefined` (pieza 2c);
  - `app/index.html` no se toca;
  - su requerimiento sale igual byte a byte.
- **El informe describe cada test viejo que cambió**, uno por uno.

**Lo que decidió el revisor por la cola, y el Jefe puede cambiar:**

- **el desglose dice la dependencia solicitante** de cada requerimiento ("GOE: 10"). Si dos
  requerimientos son de la misma dependencia, se agrega el título entre paréntesis;
- **no se juntan requerimientos en pesos con requerimientos en dólares.** La cola lo anota
  desde el 02/10: *"requerimientos en USD y en ARS no se suman entre sí"*.

**Fixtures:** `PRUEBAS-JEFE\r42-req-goe.json`, `r42-req-gb7.json`, `r42-req-usd.json` y
`r42-avance-goe.json`.

- Los exportó el revisor con el generador `r41-1c112e5`.
- Copialos a `tests/fixtures/`. No se editan: cambiarles un byte rompe la huella.
- `r42-req-goe` y `r42-req-gb7` piden los dos el `3.3.3-1627.36` (10 y 5).
- `r42-req-gb7` pide además el `2.3.1-6563.129` en **CAJA**, y `r42-req-goe` lo pide en **UN**.
- `r42-req-usd` es del proceso 22, en dólares.

---

## Pieza 1 · El rol Abastecimiento: entrar y juntar los requerimientos

commit: `Ronda 42 · Abastecimiento junta los requerimientos`

**Qué pasa hoy:** el botón "Abastecimiento" de la pantalla de identidad dice *"está
disponible en la próxima versión"* (`generador.js:66-69`, `:473`).

**Cambia:**

**a. Entrar.** Con la identidad completa (la misma validación que el rol Usuario,
`generador.js:477-480`), "Abastecimiento" abre una sección nueva de `generador.html`:
`<section id="sgc-abastecimiento" aria-label="Abastecimiento">`. Contrataciones sigue con su
aviso.

**b. Leer un requerimiento sin tocar el asistente.** `SGC.generadorIntercambio` suma
**`leerRequerimiento(texto)`**: una promesa de `{ok, requerimiento}` o `{ok:false, errores}`.

- Usa lo que ya existe, sin cargar nada en el asistente:
  - `formaDeArchivo` (`intercambio.js:515`);
  - `cuerpoDeExportado` (`:527`);
  - `verificarHuella` (`:1075`).
- **Sólo acepta un requerimiento exportado para Abastecimiento** (`estado:
  "para-abastecimiento"`, `:83`). Rechaza, con el motivo:
  - **un avance**: *"es un avance: lo tiene que terminar y exportar quien lo pidió"*;
  - una plantilla;
  - otro formato;
  - **una huella que no calza**: *"el archivo se modificó fuera del generador"*.
- `requerimiento` trae: huella, versión, título, año, dependencia solicitante, moneda, lugar
  de entrega, PAC, renglones (con `item`) y presupuestos.

**c. La pantalla:**

- `<input type="file" id="sgc-abast-archivos" multiple accept=".json">`, con la etiqueta
  **"Requerimientos exportados"**;
- `<ul id="sgc-abast-lista">`. Cada requerimiento es un `li[data-huella]` que dice:
  - **dependencia · título · año · moneda · N renglones**;
  - un botón "Quitar" `[data-quitar-req]`, con `aria-label="Quitar el requerimiento
    <título>"`;
- `#sgc-abast-msj` (`role="alert"`): los rechazos, **cada uno con el nombre del archivo**;
- **el mismo archivo dos veces** (misma huella) no se suma: *"ya está en la lista"*;
- **no se guarda nada entre sesiones.** El JSON de la SCo es el 7c.

**Test, por la pantalla, uno por caso:**

1. "Abastecimiento" con la identidad completa abre `#sgc-abastecimiento`. Sin identidad,
   avisa como el rol Usuario.
2. Elegir `r42-req-goe` y `r42-req-gb7` juntos: dos filas, con la dependencia, el título, el
   año, ARS y la cantidad de renglones.
3. `r42-avance-goe`: no entra, y el aviso nombra el archivo y dice que es un avance.
4. Una copia de `r42-req-goe` con una cantidad cambiada (el test la arma en memoria): no
   entra, por la huella.
5. `r42-req-goe` dos veces: una sola fila, y el aviso dice que ya estaba.
6. "Quitar" saca la fila.

## Pieza 2 · El consolidado en el núcleo, y el ANEXO I con los renglones sumados

commit: `Ronda 42 · ANEXO I consolidado`

**Qué hay hoy.** La regla está **dos veces**: en `server/sco.js:799` y en
`adapters/repo.memoria.js:122`.

- Junta por `codigo|unidad`, suma las cantidades, arma el desglose y ordena por código y
  unidad.
- **Las dos ponen la descripción desde `r.descripcion`**, y los renglones que se guardan
  tienen `item`, no `descripcion`. Así, el ANEXO I sale con la descripción vacía.

**Cambia:**

**a. `app/js/core/consolidacion.js`, nuevo.** Lo carga sólo `generador.html`.

- `SGC.core.consolidacion.renglones(requerimientos)` recibe `[{etiqueta, renglones}]`.
- Devuelve `[{codigo, descripcion, unidad, cantidad, desglose:[{expediente, cantidad}]}]`,
  con **la misma clave, la misma suma y el mismo orden que `server/sco.js:799`**.
  - `expediente` es la etiqueta, porque es lo que imprime `renders/anexo-1.js:173`.
- **Una diferencia, a propósito:** la descripción es `descripcion` y, si viene vacía, `item`.
- `server/sco.js` y `repo.memoria.js` **no cambian**. Las tres se unifican cuando se haga el
  puerto.
- **La etiqueta** es la dependencia solicitante. Si dos requerimientos son de la misma
  dependencia: *"GOE (Matafuegos y papel GOE)"*.

**b. En la pantalla de Abastecimiento:**

- `<table id="sgc-abast-consolidado">`, con estas columnas:
  - código;
  - descripción;
  - cantidad;
  - unidad;
  - desglose ("GOE: 10 · Grupo Base 7: 5").

  Se actualiza al sumar o quitar un requerimiento.
- **Un mismo código con unidades distintas** va en dos renglones, como en el servidor, con
  un aviso: *"el 2.3.1-6563.129 viene en UN y en CAJA: van en renglones separados"*.
- **Monedas distintas:** si la lista tiene requerimientos en ARS y en USD:
  - no se muestra el consolidado;
  - `#sgc-abast-msj` dice *"No se juntan requerimientos en pesos y en dólares en una misma
    SCo"*, con los que están en cada moneda;
  - "Imprimir" queda deshabilitado.

**c. "Imprimir ANEXO I"** (`#sgc-abast-imprimir`):

- **Lo que encontró el revisor (29/10, ítem 36, N2, sumado al 7b):** el ANEXO 1 que se arma
  con nodos DOM (`renders/anexo-1.js`, `montar`, `:249`) dice *"Unidad solicitante:
  undefined — Expediente Nº undefined"*. El pie también sale con `undefined`.
  - Pasa porque `modelo()` (`:200`) no parte del modelo común de los documentos
    (`renders/documento.js:40`, `d.modelo`), como sí hace `anexo-eett.js:97`.
  - Por el mismo código, tendría que pasar también en la aplicación con servidor. El test 5b lo
    comprueba.
- **El arreglo, mínimo:** `modelo()` parte de `d.modelo(expediente)` y le pone encima sus
  campos. Lo que el ANEXO 1 ya define no cambia.
  - **Es lo único que cambia en lo que imprime el servidor:** su ANEXO 1 deja de decir
    `undefined`.
  - El requerimiento del servidor sigue igual byte a byte.
  - Medido por el revisor: con ese cambio, `ronda-11`, `ronda-20-anexo`, `ronda-27-c5` y
    `ronda-27-c5-vista` dan 38/38.
- `montar` no imprime el bloque de la SCo: eso sólo lo hace `componer` (`:28-52`), que arma
  HTML en texto (ADR-011). En `#sgc-generador-impresion`, el módulo del generador:
  - llama a `SGC.renders.anexoUno.montar`, con:
    - la unidad solicitante: las etiquetas de los requerimientos, separadas por " · ";
    - el número: "SCo a asignar";
  - **después del encabezado**, agrega con nodos DOM el dato **"SCo: a asignar"** (el número
    es el 7c) y la tabla **"Renglones de la SCo"**, con las mismas columnas que `componer`;
- `generador.html` suma el `<script>` de `js/renders/anexo-1.js`, que hoy no carga;
- **las secciones del análisis de Abastecimiento** (§1 a §14) salen como hoy salen sin datos.
  Cargarlas es el ítem **7b2**, que se agrega a la cola;
- sin requerimientos en la lista, el botón está deshabilitado.

**Test, uno por caso:**

1. `consolidacion.renglones`, contra `server/sco.js` `renglonesConsolidados`, con los
   renglones de los dos fixtures ARS: **mismas filas, mismas cantidades, mismo desglose y
   mismo orden**. La única diferencia es la descripción.
2. Por la pantalla, con `r42-req-goe` y `r42-req-gb7`:
   - el `3.3.3-1627.36` es **un solo renglón, con 15**, y el desglose dice "GOE: 10" y
     "Grupo Base 7: 5";
   - la descripción no está vacía.
3. El `2.3.1-6563.129`: dos renglones (UN 5 y CAJA 3), y el aviso de unidades.
4. Sumar `r42-req-usd`: el consolidado se va, el aviso de monedas aparece e "Imprimir" se
   deshabilita. Quitarlo vuelve todo.
5. "Imprimir ANEXO I": el documento trae "ANEXO 1", "SCo: a asignar" y el renglón con 15 y su
   desglose.
5b. **El ANEXO 1 no dice `undefined`**: ni el del generador, ni el que arma `montar` con un
    expediente del servidor.
6. Quitar `r42-req-gb7`: el `3.3.3-1627.36` queda con 10.

---

## Cierre · siempre igual

1. **`INFORME-RONDA-42.md`**, con sus nueve secciones y **las dos corridas de la suite, una
   por pieza**, copiadas del log con su hora.
   - Si hay que corregirlo, la corrección va antes del clon, como commit propio y declarado.
2. Commit → `git push`.
3. **`git status --short` en `dev\`: vacío.** Lo pegás en tu mensaje final.
4. **Clon con la ruta absoluta:** `git clone https://github.com/contra3000/Contrataciones.git
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-42`.
5. **Paquete:** `node tools/empaquetar-generador.js --ronda 42 --destino
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
6. Después del clon no se commitea nada. Los dos HEAD van en tu mensaje final.

## Tu prueba de 10 minutos · para el Jefe

Antes, el revisor corre `PRUEBAS-JEFE\prueba-ronda-42.js` y las de las rondas 30 a 41.
**Esperá a que te diga que pasaron enteras.** Escribí tu devolución en
`PRUEBAS-JEFE\DEVOLUCION-RONDA-42.md`.

1. Entrá como **Abastecimiento** y elegí dos o tres requerimientos exportados de verdad.
   **¿Aparecen en la lista con su dependencia?**
2. **¿El mismo ítem pedido por dos dependencias sale en un solo renglón, con la cantidad
   sumada y el desglose?**
3. Imprimí el ANEXO I. **¿La tabla es la que esperabas?** Anotá qué secciones del análisis
   querés cargar primero (son el 7b2).
