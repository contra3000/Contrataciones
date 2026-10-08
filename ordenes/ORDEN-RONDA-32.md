# ORDEN DE TRABAJO — RONDA 32 · Lo que pide la prueba piloto

SGC · 2026-10-08 · hito H27 · Reglas: `CICLO_DE_TRABAJO.md` · Por qué:
`AppOptimizar\PRUEBAS-JEFE\DEVOLUCION-RONDA-31.md` y `EVALUACION-CICLO-31.md`

**Paso 0 · publicar:** `git add ordenes PLAN_DESARROLLO.md` → `git commit -m "Revisor:
ordenes y plan al dia"` → `git push`. **Ese commit no lleva nada más.**

**Dos piezas.**

- **Cada pieza:** tests en verde → commit con cuerpo (qué cambió y qué test lo prueba) →
  `git push`.
- **Si la sesión se corta**, al retomar releés esta orden entera.
- **Cada botón o campo que se toca lleva un test que lo usa por la pantalla.**

**Contexto.** El generador **ya está en prueba piloto en otros nodos**, con el paquete de
la ronda 31 más un arreglo urgente "h1" que hizo el revisor. Esta ronda mete el arreglo en
el repositorio con sus tests, y deja el paquete listo para salir sin retoques a mano.

---

## Pieza 1 · El arreglo h1, y la versión en el paquete

commit: `Ronda 32 · arreglo h1 y versión del paquete`

**a. El parche h1:** aplicar `ordenes/PARCHE-H1-plantilla-y-rojo.patch` (`git apply`; si no
entra por los finales de línea, son dos líneas a mano).

- **`app/js/generador/intercambio.js:518`.** Al importar una **plantilla**, la descripción
  del ítem salía como **el código**, por ejemplo `"2.9.6-1115.1"`, en vez de la
  descripción ONC.
  - **La causa:** `views/fasttrack.js:143` pone `item: r.codigo` como relleno, y
    `resolverItems` (`intercambio.js:841-853`) lo toma como "la descripción del archivo",
    que manda.
  - **El arreglo:** en la plantilla, `item: ''`, para que la ponga el catálogo. Así se
    cumple lo que pedía la orden 31: *"en una plantilla manda el catálogo"*.
- **`app/css/tokens.css:74`.** `--color-error` valía `var(--ink-900)`, casi negro, por la
  regla de "un solo acento" de la ronda 21. Por eso el Jefe no veía el error *"en rojo"*.
  Ahora vale `#b3261e`, a pedido del Jefe. Vale para las dos aplicaciones.

**b. Lo que el arreglo no hizo:** en los pasos, `"2 · Renglones· falta"` sale pegado. Tiene
que decir `"2 · Renglones · falta"`.

**c. La versión.** `tools/empaquetar-generador.js` escribe en el paquete:

- en `config/aplicacion.js`, la `version` como `"r<NN>-<commit corto>"`, por ejemplo
  `"r32-1a2b3c4"`. La ronda sale del último `INFORME-RONDA-NN.md` o de un argumento
  `--ronda`;
- un `VERSION.txt` con la ronda, el commit, la fecha y la versión del catálogo.

Así **cada JSON exportado dice de qué paquete salió** (`sello.versionGenerador`).

**d. El `LEEME.txt` del paquete,** que arma `leerLeeme()`, pasa a ser el de la prueba piloto:
`AppOptimizar\SGC-Generador\LEEME-PILOTO.txt`, con la versión. El `LEEME-PILOTO.txt`
aparte deja de hacer falta.

**Test:**

- **plantilla por la pantalla.** Bajá la plantilla vacía e importala sin tocarla: la
  descripción del renglón es la del catálogo, no el código. Lo mismo con un `item`
  inventado en la plantilla: manda el catálogo, y sin aviso;
- `getComputedStyle` del campo con `campo-con-error` tiene el borde `rgb(179, 38, 30)`;
- el paso pendiente dice `"· falta"` con espacio;
- el paquete armado en un temporal: `config/aplicacion.js` trae `r32-…`, existe
  `VERSION.txt`, y el `LEEME.txt` menciona "Guardar avance".

## Pieza 2 · Una plantilla que sirva para llenarla con un asistente de IA

commit: `Ronda 32 · plantilla con instrucciones`

**La pregunta del Jefe.** Importó un JSON que armó con un LLM, y los renglones salieron sin
la descripción. **La causa era el defecto de la pieza 1, no el LLM.** Pero hay dos cosas
que ayudan a que un asistente la llene bien.

**Cambia:** `modelo()` (`app/js/views/fasttrack.js:40-52`):

- **Un campo `"instrucciones"`**, un texto que se le pega al asistente junto con la
  plantilla. Le dice:
  - que **no invente códigos**: que use sólo los que le pase la persona, sacados del
    buscador del generador o de un requerimiento anterior, y que si no tiene el código lo
    deje vacío;
  - que **no escriba descripciones del ítem**, porque las pone el catálogo ONC;
  - que la aclaración no repita la descripción ni nombre marcas, y que tenga hasta 256
    caracteres;
  - que la cantidad sea un número y la unidad, un texto corto, como "UN" o "KG";
  - que devuelva **sólo el JSON**, con la misma forma.

  `importar()` ignora ese campo, **y lo ignora explícitamente, con un test**.
- **Un renglón modelo creíble.** El de hoy es un termostato DeLonghi. Va uno de papelería,
  con un código que exista en el catálogo de la versión `98201747`, y otro renglón con
  `"codigo": ""` que muestre cómo se deja un código que no se sabe.
- **Un renglón con código vacío no entra.** Sale *"Renglón N: falta el código del
  catálogo"*, como hoy (`fasttrack.js:117`). Así la persona sabe cuál le falta buscar.

**Test:**

- la plantilla bajada trae `instrucciones` y dos renglones;
- importada con el código del segundo completado, entra sin errores;
- con el segundo vacío, sale el mensaje del renglón 2 y no se carga nada.

---

## Cierre · siempre igual

1. **`INFORME-RONDA-32.md`**, con sus nueve secciones y todas las corridas copiadas **del
   log**, no de memoria.
   - Si hay que corregirlo, la corrección va **antes del clon**, como commit propio y
     declarado.
2. Commit → `git push`.
3. **Clon con la ruta absoluta:** `git clone https://github.com/contra3000/Contrataciones.git
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-32`.
4. **Paquete:** `node tools/empaquetar-generador.js --ronda 32 --destino
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
5. Después del clon no se commitea nada. Los dos HEAD van en tu mensaje final.

## Tu prueba de 10 minutos · para el Jefe

Antes, el revisor corre `PRUEBAS-JEFE\prueba-ronda-32.js`. **Escribí tu devolución en
`PRUEBAS-JEFE\DEVOLUCION-RONDA-32.md`, no en esta orden.**

1. Bajá la plantilla vacía. ¿Trae las instrucciones? Pasásela a tu asistente con dos
   códigos que saques del buscador, e importá lo que te devuelva: **¿los renglones salen
   con la descripción ONC?**
2. Dejá un renglón sin unidad y apretá "Siguiente": **¿el campo se ve en rojo?**
3. Exportá: **¿el JSON dice `"versionGenerador": "r32-…"`?**
