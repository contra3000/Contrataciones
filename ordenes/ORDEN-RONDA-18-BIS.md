# ORDEN DE TRABAJO — RONDA 18-BIS · corrección urgente

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Alcance: **tres correcciones en `app/js/views/padron-admin.js`**. Nada más.
Emitida: 2026-09-09 · **El Jefe de Contrataciones está bloqueado en este momento con el servidor andando.**

---

## 0. Por qué esta orden existe y es urgente

El Jefe de Contrataciones intentó cargar un expediente real de punta a punta. Para eso necesitaba entrar como un operador `generador`. **No pudo, y no va a poder, porque hoy el sistema no puede darle una clave a nadie.**

No es una hipótesis. Es esto:

| Dónde | Qué devuelve el servidor | Qué hace la pantalla |
|---|---|---|
| `padron-administracion.js:184` — alta de a uno | `{ creado: {...}, clave }` | `padron-admin.js:194` informa *"Se dio de alta a X."* — **descarta `clave`** |
| `padron-csv.js:298` — importación | `creados: [{ email, clave }, …]` | `padron-admin.js:239-245` informa *"Altas: 14 · Cambios: 0 …"* — **descarta las 14 claves** |
| `padron-administracion.js:266` — reponer clave | `{ email, clave }` | `padron-admin.js:176-183` (`accion`) refresca la lista — **descarta `clave`** |

**El servidor hace lo correcto en los tres casos.** Genera la clave, guarda sólo el hash, y devuelve el único ejemplar en claro que va a existir. **La pantalla lo tira a la basura en los tres.**

Consecuencia exacta, hoy: **el administrador es el único que puede entrar al sistema. Para siempre.** Se pueden crear las catorce personas, aparecen en el listado, quedan activas — y ninguna tiene forma de recibir su clave. Reponerla tampoco sirve, porque la reposición la descarta igual.

**Esto convierte al sistema en monousuario**, que es la negación de lo que es.

### Por qué no lo vio nadie

Los tests y la auditoría verificaron que **el servidor devuelve la clave** — y la devuelve. Nadie hizo el circuito de la persona: **crear un operador, agarrar su clave, y entrar con ella.**

Es la misma falla de verificación que el recuadro del ciclo 17: se comprobó el mecanismo y no la experiencia. La responsabilidad de que la orden no lo pidiera es del revisor. La corrección del código es tuya y es de tres lugares.

---

## 1. Las tres correcciones

Todas en `app/js/views/padron-admin.js`. **No toques el servidor: hace lo correcto.**

### 1.1 — El alta muestra la clave, y de forma que se pueda copiar

Hoy:

```js
informar('Se dio de alta a ' + datos.email + '.');
```

Tiene que mostrar **el correo y la clave juntos**, en un bloque que:

- **quede en pantalla hasta que la persona lo cierre** — no un mensaje que se va con el próximo refresco;
- **se pueda seleccionar con el mouse** para copiar;
- diga en castellano que **se muestra una sola vez** y que si se pierde hay que reponerla;
- tenga un botón **"Copiar"** que la ponga en el portapapeles.

Mismo espíritu que el recuadro del arranque: **el criterio de aceptación es de percepción.** Quien da de alta a alguien tiene que salir de esa pantalla con la clave anotada, sin habérsela tenido que buscar.

### 1.2 — La importación muestra las claves de todos los creados

Hoy informa cuatro conteos y descarta el arreglo `creados`.

Tiene que mostrar **una lista de correo + clave, una línea por persona creada**, con las mismas tres propiedades de arriba (queda hasta cerrarla, se puede seleccionar, dice que es la única vez) y **un botón "Copiar todo"** que ponga la lista entera en el portapapeles, en un formato que se pueda pegar en un documento para imprimir y repartir en mano (ADR-034 §1: la entrega es en mano, nunca por correo).

Los conteos que ya muestra están bien: van **además**, no en lugar de.

### 1.3 — La reposición de clave muestra la clave repuesta

`accion()` es genérica y descarta la respuesta. **La reposición no puede pasar por `accion()`**: necesita su propio camino que muestre el mismo bloque de 1.1.

Y mientras estés ahí: **`accion()` descarta la respuesta de todas las acciones.** Revisá si alguna otra devuelve algo que la persona necesita ver. Si ninguna, dejalo dicho en el informe.

---

## 2. Dos cosas más que bloquean la prueba, y son de la misma pantalla

No son de la misma gravedad, pero el Jefe de Contrataciones se choca con las dos hoy y son baratas.

### 2.1 — El alta pide cinco datos con cinco `prompt()` encadenados

`camposDeNuevo()` abre cinco cuadros de diálogo del navegador, uno por campo, y **si se cancela el tercero se pierden los dos primeros**. En uno de ellos pide el rol escribiendo el identificador exacto a mano, con la lista de roles metida dentro del texto del cuadro.

Tiene que ser **un formulario en la pantalla**: cinco campos visibles al mismo tiempo, el rol como **lista desplegable** (los roles ya salen de `config.js`, no los escribas a mano), y un botón de guardar. Si algo está mal, el error aparece al lado del campo y **no se pierde lo tipeado**.

### 2.2 — La importación pide **pegar** el CSV en un `prompt()`

```js
var csv = prompt('Pegue el CSV del padrón (con encabezados; un operador por línea):');
```

El archivo viene de Excel, está en el disco, y hay que abrirlo con un editor de texto y pegar el contenido en un cuadro de diálogo de una línea. Además, un `prompt()` con catorce líneas es ilegible, y en algunos navegadores se corta.

Tiene que ser **un selector de archivo** (`<input type="file" accept=".csv,text/csv">`) que lea el archivo en el navegador. El resto del flujo —previsualización, confirmación con los nombres, todo o nada— **ya funciona bien y no se toca.**

Dejá **también** la opción de pegar texto, para el caso de que alguien tenga el padrón en un correo y no en un archivo.

---

## 3. Tests

- Alta de un operador → la respuesta trae `clave` → **la pantalla la muestra**. Test sobre el DOM, no sobre la respuesta.
- Importación de tres líneas nuevas → **las tres claves aparecen en pantalla**.
- Reposición → la clave repuesta aparece en pantalla.
- El bloque **no desaparece** con un refresco de la lista.
- Y el que cierra el circuito, que es el que faltaba: **dar de alta a un operador, tomar la clave que muestra la pantalla, y entrar con ella.** Si ese test hubiera existido, esta orden no existiría.

---

## 4. Cierre

Un solo commit, `Ronda 18-bis`, **y push**. Informe corto —`INFORME-RONDA-18-BIS.md`, en la raíz del repositorio, no en `ordenes/`— con las nueve secciones, aunque varias queden en una línea.

**Avisá apenas esté publicado**: hay una persona esperando con el servidor prendido.

---

## 5. Qué se está evaluando

**Que el dato que sólo existe una vez llegue a la persona.**

Una credencial recién generada es el caso extremo de un dato irrecuperable: el servidor la produce, la convierte en hash, y la manda una única vez. Si la pantalla no la muestra, no se perdió una función: **se perdió la única copia que iba a existir**, y no hay forma de recuperarla porque el sistema está bien hecho.

Es una forma nueva de un problema conocido en este proyecto: hasta ahora el defecto era que **algo se calculaba y no se mostraba** —el diff de la importación, la ronda pasada—. Acá es peor: lo que no se muestra **no se puede volver a calcular.**
