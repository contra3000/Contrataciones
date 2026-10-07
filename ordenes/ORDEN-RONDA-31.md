# ORDEN DE TRABAJO — RONDA 31 · Los documentos de referencia, y lo que traba o no se ve

SGC · 2026-10-07 · hito H27 · Reglas: `CICLO_DE_TRABAJO.md` · Por qué:
`EVALUACION-CICLO-30.md` y la prueba del Jefe del 2026-10-07

**Paso 0 · publicar:** `git add ordenes PLAN_DESARROLLO.md` → `git commit -m "Revisor:
ordenes y plan al dia"` → `git push`. **Ese commit no lleva nada más.**

**Dos piezas.**

- **Cada pieza:** tests en verde → commit con cuerpo (qué cambió y qué test lo prueba) →
  `git push`.
- **Si la sesión se corta**, al retomar releés esta orden entera.
- **Cada botón o campo que se toca lleva un test que lo usa por la pantalla.**

---

## Pieza 1 · Los documentos de referencia

commit: `Ronda 31 · documentos de referencia`

**El criterio nuevo del Jefe.** A veces no hay dos presupuestos. El segundo valor de un
renglón puede salir de una **orden de compra perfeccionada** (precio de plaza), que cuenta
como fuente igual que un presupuesto. Si tampoco la hay, alcanza **un valor más un PDF
que justifique** por qué no hay otro. La justificación se elige **en el renglón al que se
aplica**, y una misma justificación puede servir para varios renglones.

**Dónde:**

- `app/generador.html:210-232`, el bloque de presupuestos;
- `app/js/generador/presupuestos.js:85-100`, que es `agregar`, y `:133-146`, que es
  importar;
- `app/js/views/requerimiento-valores.js`;
- `app/js/core/validacion.js:89-120`, que es `renglonesSinValores`;
- `app/js/core/requerimiento.js:85` y `:158`, que son `validarValoresReferencia` y
  `preventivoRenglon`;
- `app/js/renders/requerimiento.js`;
- `app/js/generador/intercambio.js`, en `contenido()`.

**Cambia:**

- **Cada documento se carga eligiendo el archivo.**
  - `#sgc-presup-archivo` pasa a `type="file"` (`.pdf,image/*`). **No se sube nada.**
  - Se guardan `nombreOriginal`, `bytes` y `sha256`, este último con la misma función de
    huella del sello.
  - `#sgc-presup-fecha` pasa a `type="date"`: se guarda `aaaa-mm-dd` y se muestra
    `dd/mm/aaaa`.
  - **Un desplegable nuevo, `#sgc-presup-tipo`:**
    - `presupuesto`: "Presupuesto";
    - `precio-plaza`: "Orden de compra / precio de plaza";
    - `justificacion`: "Justificación de falta de presupuesto".
  - Un JSON viejo, sin `tipo` ni `sha256` y con fecha `"12/02/2026"`, entra igual:
    queda como `presupuesto` y la lista dice "sin huella".
- **En el bloque de valores**, el desplegable de la fuente ofrece todos los documentos.
  - Si en una fila se elige una **justificación**, la fila se guarda como
    `{ presupuestoId, justificacion: true }`, **sin base ni valor**, y esos campos se
    esconden.
  - Si se elige un presupuesto o un precio de plaza, la fila es un valor, como hoy.
- **La regla del núcleo**, en las dos aplicaciones. Un renglón está completo con:
  - **dos valores de fuentes distintas**, cualquiera de los dos tipos que aportan valores;
    **o**
  - **un valor y una fila de justificación.**

  Las filas de justificación **no entran** en `validarValoresReferencia` ni en el promedio
  de `preventivoRenglon`: con un valor más una justificación, el promedio es ese valor.

  El motivo que se muestra (`validacion.js:202`) pasa a ser *"2 valores de referencia de
  fuentes distintas, o 1 valor y una justificación, en Renglón N"*.

  En la aplicación con servidor, un presupuesto subido sin `tipo` cuenta como
  `presupuesto`.
- **La leyenda en el requerimiento**, en las dos aplicaciones: *"Se acompañan como
  adjuntos: <tipo> <nombre> (<proveedor>, <dd/mm/aaaa>); …"*.
- **La descripción del ítem:** en una plantilla manda el catálogo; en un exportado o un
  avance, la del archivo.

**Test, por la pantalla:**

1. Un renglón con presupuesto + precio de plaza, y otro con presupuesto + justificación →
   "Exportar" habilitado. El JSON trae el `tipo` de cada documento, sus `bytes` y su
   `sha256`; la huella es igual a la que calcula Node.
2. Un renglón con un solo valor y sin justificación → "Exportar" deshabilitado, con el
   texto nuevo.
3. Con un valor más una justificación, el preventivo es ese valor.
4. `2026-02-12` sale `12/02/2026`, y la leyenda trae los tres documentos con su tipo.

## Pieza 2 · Lo que traba y lo que no se ve

commit: `Ronda 31 · lo que traba y lo que no se ve`

| Qué | Dónde | Cambia |
|---|---|---|
| **a. Con un anexo de EETT, "Exportar" queda deshabilitado para siempre** | `app/js/generador/documentos.js:76-78` | Cuando "Imprimir" compone un anexo (`SGC.core.anexoEett.tieneContenido`), registrar también el entregable `anexo-eett` |
| **b. La recarga vieja** de la aplicación con servidor | `app/js/views/expediente.js:434-448` | Un contador de pedidos: si la respuesta no es la del último `abrir()`, no se aplica |
| **c. "Año" acepta letras** | `#sgc-anio` (`app/generador.html:159`) | Al escribir se borra todo lo que no sea dígito. La regla de `validacion.js:266` sigue igual |
| **d. "Siguiente" me lleva arriba y tengo que buscar el error**, dice el Jefe | `app/js/views/wizard-formulario.js:80-82` | En vez del mensaje de arriba, se lleva a la vista y se enfoca **el primer campo con error**, por ejemplo la unidad del renglón 2, y se le pone la clase `campo-con-error` (borde rojo). El mensaje de arriba queda como está |
| **e. Se puede seguir sin presupuestos, y está bien, pero tiene que quedar a la vista lo que falta** | `#sgc-pasos` (`app/generador.html:126-129`) y `requerimiento-valores.js` | **El paso con algo pendiente** para exportar (lo de `revision().items`) muestra la clase `pendiente` y el texto **"· falta"**. **Al abrir ese paso**, cada renglón al que le faltan valores tiene debajo *"Faltan valores de referencia: 2 de fuentes distintas, o 1 y una justificación."*, con la misma clase de aviso que lo de la ronda 30. Desaparece al completarse |

**Test, por la pantalla:**

- **(a)** Un renglón con 300 caracteres de aclaración → "Imprimir" → "Exportar"
  habilitado → el JSON se descarga.
- **(b)** Con un repositorio de prueba cuyo primer `leerExpediente` tarda más que el
  segundo, queda la versión del segundo.
- **(c)** Escribir `20a6` deja `206`.
- **(d)** "Siguiente" con el renglón 2 sin unidad → el `document.activeElement` es la
  unidad del renglón 2, y tiene `campo-con-error`.
- **(e)** Pasar al paso 3 sin valores → `li[data-paso="renglones"]` tiene `pendiente`.
  Al volver al paso 2, el aviso está debajo de cada renglón incompleto.
- **Además, la suite completa tres veces seguidas, con 0 fallas en las tres.**

---

## Cierre · siempre igual

1. **`INFORME-RONDA-31.md`**, con sus nueve secciones.
   - **§3 lleva todas las corridas completas** de la ronda, cada una con
     `tests / pass / fail / duration_ms`, no sólo la mejor.
   - La salida de la última va entera, o adjunta como `%TEMP%\suite31.txt` con su ruta.
2. Commit `Ronda 31 · informe` → `git push`.
3. **Clon con la ruta absoluta:** `git clone https://github.com/contra3000/Contrataciones.git
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-31`.
4. **Paquete:** `node tools/empaquetar-generador.js --destino
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
5. Después del clon no se commitea nada. Los dos HEAD van en tu mensaje final.

## Tu prueba de 10 minutos · para el Jefe

Antes de que la hagas vos, el revisor corre `PRUEBAS-JEFE\prueba-ronda-31.js`.

1. En "Año" escribí una letra: **¿no entra?**
2. Dejá un renglón sin unidad y apretá "Siguiente": **¿te lleva a ese campo, marcado en
   rojo?**
3. Seguí sin cargar valores: **¿el paso "2 · Renglones" queda marcado "falta"?** Volvé al
   paso 2: **¿cada renglón dice qué le falta?**
4. Cargá un presupuesto y una orden de compra eligiendo los PDF, con la fecha del
   calendario. En otro renglón usá un presupuesto y una **justificación**: **¿te deja
   exportar?**
5. Con una aclaración de más de 256 caracteres, imprimí y exportá: **¿se habilita
   "Exportar"?** En el requerimiento impreso, **¿está la lista de adjuntos con su tipo y la
   fecha en dd/mm/aaaa?**
