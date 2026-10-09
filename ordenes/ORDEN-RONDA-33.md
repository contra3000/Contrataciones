# ORDEN DE TRABAJO — RONDA 33 · La plantilla para llenar con un asistente de IA

SGC · 2026-10-09 · hito H27 · Reglas: `CICLO_DE_TRABAJO.md` · Por qué: el Jefe, el
2026-10-09, sobre cómo se va a usar la plantilla

**Paso 0 · publicar:** `git add ordenes PLAN_DESARROLLO.md` → `git commit -m "Revisor:
ordenes y plan al dia"` → `git push`. **Ese commit no lleva nada más.**

**Dos piezas.**

- **Cada pieza:** tests en verde → commit con cuerpo (qué cambió y qué test lo prueba) →
  `git push`.
- **Si la sesión se corta**, al retomar releés esta orden entera.
- **Cada botón o campo que se toca lleva un test que lo usa por la pantalla.**

**Por qué.** La ronda 32 dio a la plantilla instrucciones que piden *"usá sólo los códigos
que te pase la persona, sacados del buscador"*, y **rechaza el archivo entero si un renglón
no tiene código**. El Jefe lo corrigió: la persona no va a buscar códigos antes. Le da al
asistente **la plantilla y todos sus papeles desordenados**, y lo normal es que vengan pocos
códigos, o ninguno.

---

## Pieza 1 · La plantilla y su importación, con renglones "por buscar"

commit: `Ronda 33 · plantilla para asistentes y renglones por buscar`

**Cómo la va a usar una persona**, como lo definió el Jefe el 2026-10-09:

1. En el paso 1, "Descargar plantilla vacía".
2. En su asistente (ChatGPT, Copilot, Claude…) adjunta la **plantilla y todos sus papeles**
   (Word, Excel, PDF, correos), desordenados, y escribe *"Completá esta plantilla siguiendo
   sus instrucciones"*.
3. **Pega en el SGC lo que le devuelve**, o lo guarda como `.json` y lo importa.
4. Los renglones con un código válido entran listos. **Los que no tienen código, o tienen
   uno que no existe, entran como "por buscar"**: la persona elige el ítem en el
   buscador, uno por uno.

**Cambia:**

**a. `modelo()`** (`app/js/views/fasttrack.js:40-66`, hoy con las instrucciones de la ronda 32, que se reemplazan):

- Lleva un campo `"instrucciones"` con **este texto, tal cual**:

  > Sos un asistente que completa esta plantilla de requerimiento del SGC a partir de
  > los documentos que te adjunta la persona (Word, Excel, PDF, correos). Reglas:
  > 1) Devolvé SÓLO el JSON, con esta misma forma, sin texto antes ni después.
  > 2) titulo: qué se compra, en pocas palabras. anio: el año en cuatro dígitos.
  > dependenciaSolicitante: la dependencia que pide. justificacion: por qué se
  > necesita, con lo que digan los documentos.
  > 3) renglones: uno por cada bien o servicio distinto. "codigo": copialo SÓLO si
  > en los documentos aparece un código del catálogo ONC con la forma 2.9.6-1115.1;
  > si no aparece, dejalo vacío (""). Nunca inventes ni completes un código.
  > "buscar": el nombre del producto en dos a cuatro palabras, como se buscaría en un
  > catálogo (por ejemplo "resma papel A4"). "cantidad": un número. "unidad": corta
  > (UN, KG, M, L, CAJA); si no se sabe, vacía. "aclaracion": sólo lo que el producto
  > tiene que cumplir y no está en su nombre (medidas, normas, compatibilidades), sin
  > marcas y hasta 256 caracteres.
  > 4) No escribas descripciones de ítems: las pone el catálogo.
  > 5) Si algo no está en los documentos, dejá el campo vacío. No lo inventes.
  > 6) Los precios y los presupuestos no van en este JSON: se cargan aparte en el SGC.
- Lleva **dos renglones de ejemplo**:
  - uno con un código que exista en el catálogo `98201747` y su `buscar`;
  - uno con `"codigo": ""` y `"buscar": "resma papel A4"`.
- Reemplazan a los dos de la ronda 32.

**b. El importador de la plantilla** (`views/fasttrack.js:131-170` y
`generador/intercambio.js:497-528`):

- **Sigue ignorando `instrucciones`**, como en la ronda 32.
- **Un renglón sin código, o con uno que no existe en el catálogo, ya no rechaza el
  archivo.** Entra como **renglón por buscar**:
  `{ codigo: '', item: '', buscar, cantidad, unidad, aclaracion, porBuscar: true }`.
  - Un código que no existe se dice en el aviso de importación: *"Renglón N: el código X
    no está en el catálogo; quedó para buscar"*.
  - La cantidad y la unidad pueden venir vacías; se completan en pantalla.
- **Lo demás sigue rechazando como hoy:** un JSON roto, un formato de otra versión o una
  aclaración demasiado larga. Y sigue sin cargar nada a medias.

**c. Pegar en vez de importar** (`app/generador.html:146-148`):

- Al lado de "Importar", un botón **"Pegar texto"**. Abre un `<textarea id="sgc-pegar-json">`
  y un botón **"Cargar lo pegado"**.
- Al texto se le saca lo que quede antes del primer `{` y después del último `}`, porque
  los asistentes suelen envolverlo en ```` ```json ````. Después entra por el mismo
  `importar()` que el archivo.


**Test, por la pantalla:**

1. La plantilla bajada trae `instrucciones` con el texto de arriba, tal cual, y los dos
   renglones.
2. Pegado con ```` ```json ```` alrededor, con tres renglones (uno con código válido, uno con
   `"codigo": ""` y `"buscar": "papel"`, y uno con `"codigo": "9.9.9-0000.0"`) → entran los
   tres. El primero trae la descripción ONC y los otros dos quedan "por buscar".
3. El aviso dice *"Renglón 3: el código 9.9.9-0000.0 no está en el catálogo; quedó para
   buscar"*.
4. Un JSON roto no carga nada.

## Pieza 2 · Completar los renglones "por buscar" en pantalla

commit: `Ronda 33 · completar renglones por buscar`

**El renglón "por buscar" en pantalla** (`app/js/catalogo/renglones.js`, `filaRenglon` y
`agregar`, `:65` y `:206`):

- Se ve con el texto *"Falta elegir el ítem del catálogo — buscado como: «resma papel
  A4»"*, en rojo, y un botón **"Buscar"**.
- **"Buscar"** pone ese texto en `#sgc-campo-clases`, dispara la búsqueda, lleva la vista
  hasta el buscador y deja **ese renglón como destino**.
- **El próximo ítem que se elija reemplaza a ese renglón**, en vez de agregar uno nuevo, y
  conserva su cantidad, su unidad y su aclaración.
- **"Siguiente" no pasa** mientras haya renglones por buscar. El motivo es *"Renglón N:
  falta elegir el ítem del catálogo"*, y con lo de la ronda 31 lleva a ese renglón.
- **El avance los guarda, y la exportación final no los acepta.**

- **El `LEEME.txt` del paquete** suma una sección **"Llenar con un asistente de IA"**, con los
  cuatro pasos de arriba.

**Test, por la pantalla:**

1. Con un renglón "por buscar", "Siguiente" no pasa y lleva a ese renglón.
2. "Buscar" en el renglón 2 → `#sgc-campo-clases` vale `"papel"` → elegir un ítem → **el
   renglón 2 queda con ese código**, con la cantidad y la aclaración que traía, y siguen
   siendo dos renglones.
3. "Guardar avance" con un renglón "por buscar" → se reimporta igual, todavía por buscar.
4. "Exportar para Abastecimiento" queda deshabilitado mientras haya alguno por buscar.

---

## Cierre · siempre igual

1. **`INFORME-RONDA-33.md`**, con sus nueve secciones y todas las corridas copiadas del log.
   - Si hay que corregirlo, la corrección va antes del clon, como commit propio y declarado.
2. Commit → `git push`.
3. **Clon con la ruta absoluta:** `git clone https://github.com/contra3000/Contrataciones.git
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-33`.
4. **Paquete:** `node tools/empaquetar-generador.js --ronda 33 --destino
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
5. Después del clon no se commitea nada. Los dos HEAD van en tu mensaje final.

## Tu prueba de 10 minutos · para el Jefe

Antes, el revisor corre `PRUEBAS-JEFE\prueba-ronda-33.js`. **Escribí tu devolución en
`PRUEBAS-JEFE\DEVOLUCION-RONDA-33.md`, no en esta orden.**

1. Bajá la plantilla vacía y dásela a tu asistente con papeles reales de un requerimiento,
   desordenados. Pedile *"Completá esta plantilla siguiendo sus instrucciones"*.
2. Copiá su respuesta y usá **"Pegar texto"**: **¿entran todos los renglones? ¿Los que no
   tenían código quedan "por buscar", con la palabra sugerida?**
3. En cada uno, **"Buscar"** y elegí el ítem: **¿queda en ese mismo renglón, con su cantidad
   y su aclaración?**
4. **¿Te dejó algo que tuviste que corregir a mano?** Anotalo: es lo que hay que mejorar en
   las instrucciones.
