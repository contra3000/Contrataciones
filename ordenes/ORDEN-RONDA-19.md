# ORDEN DE TRABAJO — RONDA 19

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hito cubierto: **H22 (cierre) — el circuito de la persona funciona de punta a punta**
Emitida: 2026-09-09

> **Sustituye por completo al borrador «ORDEN-RONDA-18-BIS», que queda anulado y retirado.** Aquel documento se emitió y después se modificó con el mismo nombre, lo cual está mal: **una orden se emite una sola vez, con un nombre único**. Si cambia antes de largarse, cambia de número. Quedó como regla §3.12 del ciclo de trabajo.
>
> **El Jefe de Contrataciones está bloqueado en este momento**, con el servidor andando y sin poder crear un expediente.

---

## 0. Lo primero, porque es lo más grave: **en modo autenticado no se puede crear ningún expediente**

Después de emitida la primera redacción de esta orden, el Jefe de Contrataciones intentó cargar el requerimiento con su propio usuario. La aplicación se lo rechazó con:

> **El operador es obligatorio**

Y no hay ningún campo en pantalla donde poner eso, porque el operador nunca se tipeó: sale de quién entró.

**Esto no es un problema de su usuario ni de su rol. En modo autenticado no puede crear un expediente nadie, con ningún rol.** Es la función central del sistema, y no funciona en el único modo que se va a usar en producción.

### La causa, exacta

`app/js/app.js`, `operadorSeleccionado()` — avisa a **siete** vistas de quién entró:

```js
SGC.views.expediente.seleccionarOperador(operador);
SGC.views.exportar.seleccionarOperador(operador);
SGC.views.requerimientoFormulario.seleccionarOperador(operador);
SGC.views.anexoUno.seleccionarOperador(operador);
SGC.views.usarBase.fijarOperador(operador);
SGC.views.sugerencias.fijarOperador(operador);
SGC.views.sugerenciasJefe.fijarOperador(operador);
SGC.views.padronAdmin.fijarOperador(operador);
```

**Falta `SGC.views.wizard.seleccionarOperador(operador, repo)`.**

Y esa función (`wizard.js:168-174`) es el **único** lugar donde se inicializa el estado del asistente:

```js
estado.operador = operador;
estado.datos = { identificacion: { operador: operador.email }, ... };
```

Sin ella, en modo autenticado:

- `identificacion.operador` queda vacío → `validarIdentificacion` (`core/validacion.js:167`) rechaza → **no se puede crear ningún requerimiento**;
- `estado.operador` queda en `null` → `guardarBorrador` (`wizard-formulario.js:69`) **retorna sin hacer nada** → **no se guarda ningún borrador**. Ese es, además, el motivo por el que la prueba de "apagá el servidor a mitad de camino" no iba a dar nunca lo esperado.

### Por qué ningún test lo detectó · **esto es lo que hay que leer dos veces**

Los únicos que llaman a `wizard.seleccionarOperador` son:

1. **`tests/wizard.test.js`** — nueve veces, a mano, antes de cada prueba.
2. **Los botones de la lista de operadores del modo declarado** (`wizard.js:352`).

**La aplicación autenticada no la llama nunca.**

Es decir: los tests del asistente **arman a mano el estado que la aplicación real no produce**, y por eso pasan todos mientras la función no funciona. Es **exactamente la misma forma** que R41 —el probador de plantillas que fabricaba dos campos que la exportación real nunca emitía— que dimos por cerrada en el ciclo 17. Volvió, en el cliente, y esta vez bloquea la función principal.

Y explica algo más grande: **el modo declarado y el modo autenticado divergieron en silencio.** Los tests recorren el declarado, que tiene botones de operador; la producción usa el autenticado, que no los tiene. Todo lo que se probó, se probó entrando por la puerta de los tests, no por la puerta de la persona.

### La corrección

Agregar la llamada que falta en `operadorSeleccionado()`, con el `repo` que la vista necesita.

**Y después buscá las que faltan además de ésta.** El síntoma es un patrón, no un renglón: recorré **todas** las vistas que guardan un operador o una sesión y verificá, una por una, que el modo autenticado las alcance. Si alguna sólo se inicializa desde los botones del modo declarado, es el mismo defecto esperando turno. La lista completa, con lo que encontraste y lo que descartaste, va en el informe.

---

## 1. Y lo que ya venía de la redacción anterior: **el sistema no puede darle una clave a nadie**

El Jefe de Contrataciones necesitaba entrar como un operador `generador`. **Tampoco va a poder, por una segunda razón independiente.**

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

## 2. Las tres correcciones de las claves

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

## 3. Dos cosas más que bloquean la prueba, y son de la misma pantalla

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

## 4. Los nueve tests del asistente · **decisión del Jefe de Contrataciones**

Su instrucción, textual:

> *"Entonces esos tests deben ser eliminados, porque no cumplen su función de testear."*

Tiene razón en el fondo, y la regla que sale de ahí es ésta:

**Un test que construye a mano un estado que la aplicación no produce no está probando la aplicación: está probando una ficción.** Y es peor que no tener el test, porque da verde sobre una función rota — que es exactamente lo que pasó.

### Qué hacer con los nueve, concretamente

**No los borres a ciegas: hacelos entrar por la puerta.** Cada uno de los nueve empieza con `SGC.views.wizard.seleccionarOperador(MARIA, repoFalso)`, que la aplicación autenticada nunca ejecuta. Ese arranque se reemplaza por el arranque real —la sesión autenticada llegando a la vista por el mismo camino que en producción—, y el resto del test se conserva: lo que verifican después (validaciones, pasos, borradores, persistencia) sigue siendo válido y hay que conservarlo.

**El que no se pueda reescribir así, se elimina.** Si un test sólo existe porque alguien le puso el estado a mano y no hay forma de que la aplicación llegue ahí, ese estado no existe y el test no prueba nada.

En el informe, **uno por uno**: cuál se reescribió, cuál se eliminó y por qué.

### Y la regla general, que va más allá de estos nueve

Recorré **toda** la suite buscando la misma forma: tests que inicializan una vista llamando a una función que la aplicación no llama sola.

El criterio para separar los legítimos de los que no lo son:

- **Legítimo:** un test unitario que le pasa una entrada a una función y verifica su salida. Ahí el estado armado a mano es el objeto de la prueba.
- **No legítimo:** un test que arma el estado de una vista a mano y después afirma que **el circuito funciona**. Eso no lo prueba, y es lo que hicieron los nueve.

La diferencia práctica: **por cada camino que una persona recorre, tiene que existir al menos un test que lo recorra entero sin ayuda.** Los unitarios se quedan; lo que no puede quedarse es que sean los únicos.

---

## 5. Tests · y acá está el cambio de fondo

Los tests de siempre para cada punto, **más uno que no existe y es el que faltaba en los tres defectos de esta orden**:

### 5.1 — El recorrido de la persona, entrando por donde entra la persona

Un test que arranque **desde el ingreso**, con un padrón real, y que **no llame a ninguna función de vista a mano**:

1. Entrar con el administrador.
2. **Dar de alta a un operador `generador` desde la pantalla**, y **leer su clave de la pantalla** (del DOM, no de la respuesta HTTP).
3. **Salir, y entrar con ese operador y esa clave.**
4. Cambiar la clave provisoria.
5. **Crear un requerimiento completo** —título, año, dependencia, justificación, un renglón— **y guardarlo**.

Si cualquiera de los cinco pasos necesita que el test invoque a mano una función que la aplicación no invoca sola, **el test está mal escrito y el defecto sigue vivo**. Es la regla nueva y la más importante de esta orden.

### 5.2 — Los específicos

- Alta de un operador → la respuesta trae `clave` → **la pantalla la muestra**. Sobre el DOM, no sobre la respuesta.
- Importación de tres líneas nuevas → **las tres claves aparecen en pantalla**.
- Reposición → la clave repuesta aparece en pantalla.
- El bloque de la clave **no desaparece** con un refresco de la lista.
- **Un borrador se guarda** en modo autenticado: cargar medio requerimiento, recargar la página, y que el borrador se ofrezca. Hoy no se guarda ninguno.
- Y **la comprobación estructural**: ninguna vista puede quedar sin inicializar en modo autenticado. Escribila como test, no como comentario (regla §3.10 del ciclo de trabajo).

---

## 6. Cierre

Un solo commit, `Ronda 19`, **y push**. Informe —`INFORME-RONDA-19.md`, **en la raíz del repositorio**, no en `ordenes/` (la ronda 18 lo dejó en el lugar equivocado)— con las nueve secciones, aunque varias queden en una línea.

**Avisá apenas esté publicado**: hay una persona esperando con el servidor prendido.

---

## 7. Qué se está evaluando

**Que la aplicación funcione entrando por donde entra una persona.**

Los tres defectos de esta orden tienen la misma raíz y no es de código: **todo lo verificado hasta hoy se verificó entrando por la puerta de los tests.** Los tests del asistente construyen a mano el estado que la aplicación real nunca produce. La auditoría comprobó que el servidor devuelve la clave, sin comprobar que alguien pudiera usarla. El modo declarado —el que tiene botones de operador— y el modo autenticado —el único que se va a usar— divergieron sin que nada avisara, porque nada recorre el segundo de punta a punta.

Dos cosas que conviene tener presentes mientras corregís:

**Un dato que sólo existe una vez es distinto de todos los demás.** Una credencial recién generada es el caso extremo: el servidor la produce, la convierte en hash, y la manda una única vez. Si la pantalla no la muestra, no se perdió una función, **se perdió la única copia que iba a existir** — y es irrecuperable justamente porque el sistema está bien hecho. Es un grado peor que el diff no mostrado de la ronda 18: aquello se podía volver a calcular.

**Y una llamada que falta no se ve.** El defecto del asistente no es una línea equivocada que se pueda leer y corregir: es una línea que no está. No hay nada que revisar, ningún comentario que contradiga al código, ningún test en rojo. Sólo se descubre **usando el sistema como lo usa una persona** — que es lo que hizo el Jefe de Contrataciones esta mañana, y por eso esta orden existe.
