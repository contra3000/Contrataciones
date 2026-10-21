# ORDEN DE TRABAJO — RONDA 40 · La suite que da siempre lo mismo, y "Buscar ítem" en todo el catálogo

SGC · 2026-10-21 · hito H27 · Reglas: `CICLO_DE_TRABAJO.md` · Por qué: los dos primeros
ítems de la cola (`PLAN_DESARROLLO.md` §0.1, 21/10):

- el **13**, que pasa a **N1** por su propia regla: la suite dio rojo en dos corridas del
  auditor 39;
- el **5**, N3 del 13/10, que el Jefe volvió a pedir el 19/10. **El 6 se le suma**: toca el
  mismo código y el mismo paso.

**Paso 0 · publicar:** `git add ordenes PLAN_DESARROLLO.md` → `git commit -m "Revisor:
ordenes y plan al dia"` → `git push`. **Ese commit no lleva nada más.**

**Dos piezas.**

- **Cada pieza: la suite completa en verde → commit con cuerpo** (qué cambió y qué test lo
  prueba) → `git push`. Recién después empezás la siguiente.
- **El test nuevo va en el mismo commit que el código que lo hace pasar.** Nunca un commit
  de tests solo, ni uno de código sin su test (lo preguntó el auditor 39).
- **Si la sesión se corta**, al retomar releés esta orden entera.
- **Tu mensaje final trae `git status --short` vacío.**
- **Cada botón o campo que se toca lleva un test que lo usa por la pantalla.**
- **La aplicación con servidor está congelada** (ADR-044):
  - `server/`, `app/js/core/` y las vistas del servidor no se tocan;
  - sus tests no se modifican;
  - su requerimiento sale igual byte a byte.
- **El informe describe cada test viejo que cambió**, uno por uno.

---

## Pieza 1 · La suite completa da siempre el mismo resultado

commit: `Ronda 40 · la suite corre los tests de servidor en serie`

**Qué pasa.** Con la suite entera en paralelo, algunos tests que levantan el servidor se
pasan de tiempo. Corridos solos, pasan. Ya pasó cuatro veces:

| Dónde | Qué dio rojo |
|---|---|
| informe 30 | `ronda-20.test.js` y `ronda-21-c6.test.js` |
| informe 34 §6 | "matriz por servidor" (ADJUDICACION, AFECTACION, GENERACION_ORDEN_COMPRA): `transiciones-servidor-matriz*.test.js` |
| informe 38 §6 | `presupuestos-servidor.test.js` y `ronda-25-c3.test.js` |
| **auditoría 39 §1** | **`ronda-21-c6.test.js:59`, en las dos corridas** (`3c7863e` y `aec716a`: 682/681/1) |

**El problema es de método, no del código.** Con un rojo que "es flake", el auditor tiene
que decidir a ojo si la suite está verde. El 13/10 quedó escrito que esto pasa a N1 si
aparece en una corrida del auditor, y apareció.

**Cambia:**

**a. `tools/suite.js`, nuevo.** Corre la suite completa en dos tandas:

- **en serie** (`--test-concurrency=1`), los archivos de test que levantan un servidor o la
  montura de la aplicación. **Se eligen solos**, mirando lo que el archivo usa, no con una
  lista a mano: un test de servidor nuevo tiene que caer en la serie sin que nadie lo
  anote. Los seis archivos de la tabla tienen que quedar ahí: `ronda-20`, `ronda-21-c6`,
  `transiciones-servidor-matriz`, `transiciones-servidor-matriz-2`, `presupuestos-servidor`
  y `ronda-25-c3`;
- **en paralelo**, como hoy, todo lo demás;
- las dos con `--test-timeout=120000`.

Al final imprime **una sola línea de totales**: `tests / pass / fail / cancelled / skipped
/ duration_ms`, sumando las dos tandas. **Sale con código distinto de 0 si algo falla.**
Con `--listar`, muestra qué archivo va a cada tanda y por qué.

**b. Nada más.** No se toca ningún test, ni `server/`, ni las vistas. La carrera que
describe el informe 30 (`views/requerimiento-formulario.js:156`, `views/exportar.js:209`,
`views/expediente.js:441-444`) es de la aplicación con servidor: queda en el ítem 11.

**Test:** `tests/suite-herramienta.test.js` prueba **la elección**, sin correr la suite:

- los seis archivos de la tabla caen en la serie;
- un archivo de test inventado que usa la montura cae en la serie;
- uno que sólo usa `generador-montura.js` cae en paralelo;
- **ningún archivo se pierde**: serie + paralelo = todos los `tests/*.test.js`.

**Medida, antes del commit:** **cinco corridas seguidas** de `node tools/suite.js`, con
**0 fail y 0 cancelled** en las cinco, y la misma cantidad de `tests` que
`node --test "tests/*.test.js"`. Las cinco líneas de totales van al informe. **Si una
corrida tarda más de 20 minutos, decilo en §4**: no frena la pieza.

**Desde este commit, "la suite completa" es `node tools/suite.js`.**

## Pieza 2 · "Buscar ítem" en todo el catálogo, y la lista que se cierra

commit: `Ronda 40 · buscar ítem en todo el catálogo`

**Lo que pidió el Jefe** (13/10, y de nuevo el 19/10):

- *"que el texto se busque en los ítems de todas las clases y muestre las coincidencias"*,
  también para la carga a mano;
- la lista de ítems **no se cierra** al elegir uno, y **cada clic de más suma otro
  renglón** (ítem 6).

**Qué pasa hoy:**

- el buscador sólo busca **clases y rubros** (`catalogo/indice.js:136`, `buscarClases`);
- exige **todas** las palabras;
- no entiende las abreviaturas del catálogo.

"mantenimiento recarga matafuego" da 0, y el ítem es "MANT. Y REPAR. MATAFUEGO"
(`3.3.3-1627.36`). Al elegir un ítem, `buscador.js:181-184` agrega el renglón y deja la
lista abierta. Medido sobre `r39-b277b93`: un triple clic suma **tres** renglones.

**Cambia, sólo en el generador:**

**a. El índice de búsqueda: `app/catalogo/busqueda.js`.**

- Lo escribe `tools/build-catalogo.js`, con los 159.366 ítems: código y texto. Sigue la
  misma forma que los demás: `SGC.catalogo.recibir("catalogo/busqueda.js", …)`.
- **Sólo `.js`, sin `.json`:** la aplicación con servidor no lo usa. El empaquetador ya
  copia todo `catalogo/*.js` (`tools/empaquetar-generador.js:225`).
- **Determinista:**
  - dos corridas dan el mismo archivo byte a byte;
  - al regenerar, `git status` muestra **sólo** `busqueda.js` nuevo: los demás archivos del
    catálogo no cambian.
- Pesa unos **20 MB**: medido por el revisor con el catálogo 98201747.
- Se carga **la primera vez que la persona escribe** en "Buscar ítem", no al abrir el
  generador. Mientras carga, el conteo dice "Cargando los ítems del catálogo…".
- Sugerencia: un `cargarBusqueda()` en `catalogo/carga.js`, con `unaSolaVez` (`:50`) y
  `peticion` (`:122`), como `cargarCodigos()` (`:198`). **Sumar una función no cambia nada
  del servidor.**

**b. El campo, arriba de todo en "2 · Renglones"** (`generador.html:233`, antes de "Buscar
clase o rubro", que queda como está):

- `<input id="sgc-buscar-item" type="search" role="combobox">`, con la etiqueta **"Buscar
  ítem"**;
- la lista: `<ul id="sgc-lista-buscar-item" role="listbox">`. Cada opción es un
  `li[role="option"]` con id `sgc-opcion-buscar-item-N`, y muestra **el código, el texto
  del ítem con lo encontrado resaltado, y la clase**;
- `#sgc-conteo-buscar-item`: *"N coincidencias"*. Si son más de 60: *"se muestran las
  primeras 60"*.

**c. Cómo busca.** Hoy no hay nada parecido en el código: va en un módulo nuevo del
generador.

- **Sin importar** mayúsculas, acentos ni las palabras de unión (de, del, la, el, los, las,
  y, p, para, con, sin, en, a, por).
- **Cada palabra busca el comienzo de una palabra del ítem, no un pedazo del medio.**
  "reparacion" no puede encontrar "PREPARACION".
- **Singular y plural:** "matafuegos" encuentra "MATAFUEGO", y "matafuego" encuentra
  "MATAFUEGOS".
- **Las abreviaturas del catálogo:** una palabra del ítem que termina en punto y tiene tres
  letras o más vale para cualquier palabra que empiece igual. Así, "MANT." vale para
  "mantenimiento", y "REPAR." para "reparación".
- **No exige todas las palabras.** Ordena:
  1. por cuántas palabras encontró;
  2. después, las que encontró en el nombre (lo que va antes del `;`);
  3. después, el texto más corto.

**Los casos, medidos por el revisor sobre el catálogo 98201747** con una implementación de
prueba que hace exactamente eso:

| Escribe | Tiene que salir |
|---|---|
| `mantenimiento recarga matafuego` | entre los 5 primeros, `3.3.3-1627.36` (MANT. Y REPAR.) y `3.3.9-8881.1` (RECARGA DE MATAFUEGO) |
| `reparacion matafuegos` | los 3 primeros, de MANT. Y REPAR. MATAFUEGO (`3.3.3-1627.*`); **ningún** "POSTRES" entre los 10 primeros |
| `válvula esférica` | el primero, VALVULAS ESFERICAS |

Con el índice cargado, cada búsqueda tardó entre 100 y 300 ms.

**d. Elegir un ítem** (con clic, o con flechas y Enter):

- **suma un solo renglón y cierra la lista**. Vuelve a abrirse cuando la persona escribe de
  nuevo;
- **registra el código**, para que el renglón no salga con *"El código no existe en el
  catálogo"*. **Ojo:** `renglones.js:72` valida con `indice.codigoExiste`, que hoy sólo
  conoce las clases que se abrieron (`indice.js:231`);
- si hay un renglón esperando por "Buscar", **lo reemplaza**, igual que hoy
  (`renglones.js:250-265`).

**e. "Buscar" de un renglón por buscar** (`renglones.js:102-106`): en el generador pone
las palabras en **"Buscar ítem"** y muestra la lista. En la aplicación con servidor sigue
como hoy.

**f. La búsqueda por clase también se cierra al elegir** (ítem 6). `buscador.js:181-184`
y `:280-283`:

- un clic o Enter en un ítem de `#sgc-lista-items` suma **un** renglón y cierra la lista;
- **sólo en el generador**: una opción en `buscador.montar()`, que pasa
  `generador.js:583`. La aplicación con servidor sigue igual, y sus tests no se tocan.

**Test, por la pantalla** (`generador-montura.js`):

1. Los tres casos de la tabla.
2. Un clic en `3.3.3-1627.36`:
   - suma **un** renglón;
   - cierra la lista;
   - **otro clic en el mismo lugar no suma nada**;
   - con unidad y cantidad, el renglón no tiene error.
3. Flechas y Enter: un renglón, y la lista cerrada.
4. Por clase: elegir una clase y un ítem con **triple clic** suma un renglón y cierra
   `#sgc-lista-items`.
5. Un renglón por buscar con `"buscar": "mantenimiento matafuego"`, cantidad 4 y una
   aclaración:
   - "Buscar" pone esas palabras en `#sgc-buscar-item`;
   - elegir `3.3.3-1627.36` lo reemplaza y conserva la cantidad y la aclaración.
6. Un requerimiento con un ítem elegido en "Buscar ítem" exporta, y el JSON trae
   `3.3.3-1627.36`.
7. `build-catalogo`: dos corridas dan `busqueda.js` igual byte a byte, con 159.366 ítems.

---

## Cierre · siempre igual

1. **`INFORME-RONDA-40.md`**, con sus nueve secciones y todas las corridas copiadas del log.
   - **Las cinco corridas de la pieza 1** van enteras.
   - Si hay que corregirlo, la corrección va antes del clon, como commit propio y declarado.
2. Commit → `git push`.
3. **`git status --short` en `dev\`: vacío.** Lo pegás en tu mensaje final.
4. **Clon con la ruta absoluta:** `git clone https://github.com/contra3000/Contrataciones.git
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-40`.
5. **Paquete:** `node tools/empaquetar-generador.js --ronda 40 --destino
   C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\SGC-Generador`.
6. Después del clon no se commitea nada. Los dos HEAD van en tu mensaje final.

## Tu prueba de 10 minutos · para el Jefe

Antes, el revisor corre `PRUEBAS-JEFE\prueba-ronda-40.js` y las de las rondas 30 a 39.
**Esperá a que te diga que pasaron enteras.** Escribí tu devolución en
`PRUEBAS-JEFE\DEVOLUCION-RONDA-40.md`.

1. En "2 · Renglones", escribí en "Buscar ítem" algo como lo pedirías: **"mantenimiento
   recarga matafuego"**. **¿Aparece el ítem? ¿Cuánto tarda la primera vez?**
2. Probá con dos o tres cosas que compran seguido. **¿Las encuentra?**
3. Elegí un ítem. **¿Se cierra la lista y suma un solo renglón?**
