# ORDEN DE TRABAJO — RONDA 17

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hitos cubiertos: **H21 — Administración del padrón desde la aplicación** · **H10 y H20 (cierre)**
Emitida: 2026-09-01 · **Reemplaza a la versión anterior de esta misma orden**

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`.

Del ciclo 16, **la mitad que habilita instalar salió bien**: sin padrón el servidor no arranca, el modo declarado dejó de activarse solo, y el mensaje del padrón ilegible dejó de filtrar el error en inglés. **368 tests en verde.** Y las trece correcciones normativas del log quedaron cargadas en la v1 de las tres plantillas, cada una con su código en la nota de cambio.

Dos cosas bien hechas: **derivaste `tipo_contrato` y `tipo_documento` del expediente** con la misma normalización en cliente y servidor, y **la tabla de reglas funciona** — la específica le gana a la general, y cuando ninguna coincide se usa la de defecto y se dice.

### Un cambio de diseño, y es el primero de esta orden

El Jefe de Contrataciones lo planteó así: *"no me sirve, desde el punto de vista de diseño, que tenga que estar subiendo un padrón"*.

Tiene razón, y **explica los tres defectos de los últimos dos ciclos de una sola vez**: el servidor que arrancaba sin padrón, el comando del manual con el formato equivocado, y la lista de roles del manual que nombraba un rol inexistente. Los tres salen de la misma regla implícita — *el administrador hace por consola lo que los demás hacen por pantalla* — y los tres pegaron en el momento de mayor exposición: la instalación.

**Administrar el padrón es una función del sistema, no una tarea de instalación.** Quedó en **ADR-037**, que leés completa antes de empezar, junto con las enmiendas a ADR-027, ADR-034 y ADR-036.

### Accesos fuera del repositorio

`os.tmpdir()`, `127.0.0.1`, y **sólo lectura** sobre `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\`, con permiso de ejecutar `scripts/generar_pliego.py` hacia una carpeta temporal. Nada más.

---

## 1. H21 — El padrón se administra desde adentro · **va primero**

### 1.1 — El servidor crea el padrón en el primer arranque

Si no hay padrón, **el servidor lo crea con un solo usuario: el administrador**, cuyos datos salen de la configuración:

```json
{ "administrador": { "nombre": "...", "apellido": "...", "email": "...@faa.mil.ar" } }
```

**Esto no afloja ADR-036 §4, lo cumple mejor.** Aquella regla existía para que el servidor nunca cayera en modo declarado por omisión; ahora **no hay un estado "sin padrón" del que salir**. Lo que no cambia: **el modo declarado sólo se activa pidiéndolo explícitamente**. Si alguien saca eso, es la misma regresión de siempre.

Y sigue valiendo la verificación de arranque de la ronda 15: si la carpeta de datos no es escribible, si el catálogo falta, si el puerto está ocupado, **no arranca y dice qué falta**.

### 1.2 — La clave del administrador se genera y se muestra una vez

**Ninguna clave por omisión.** Ni en el código, ni en el manual, ni en la configuración. Es el defecto clásico y el más caro.

- Se genera con el formato de ADR-034 §2 —cuatro palabras en castellano— **en el primer arranque**.
- Se escribe **una sola vez** en la salida del servidor, en un recuadro que no se pueda pasar por alto. En la máquina virtual eso queda en el registro del sistema; corriendo a mano, en la consola.
- **Nace provisoria**: el primer ingreso obliga a cambiarla y no deja hacer nada más.

### 1.3 — `administrador` es una marca, no un rol

```
{ nombre, apellido, email, rol, sector, activo, administrador: true, credencial: {...} }
```

**No agregues un octavo rol.** La matriz de 18 × 7 dice quién ejecuta cada paso del circuito; administrar el padrón no es un paso del circuito.

La marca gobierna tres cosas, **verificadas en el servidor**:

- administrar el padrón;
- **ver el compendio crudo de eventos y de sugerencias** con su contexto — hoy atado a `contrataciones_supervisor`, y hay **dos** personas con ese rol;
- reponer claves y levantar bloqueos.

**Editar plantillas no cambia**: sigue siendo `contrataciones_supervisor` o `juridica` (ADR-032 §5).

### 1.4 — La pantalla de administración

Sólo para el administrador. Cinco cosas:

- **Alta de a uno.** Al guardar, la clave provisoria **se muestra una vez** para anotarla.
- **Importar CSV**: `nombre;apellido;email;rol;sector;activo`, con línea de encabezado que la exportación escribe y la importación tolera. **Tolerante al BOM** —el archivo va a venir de Excel— y a la línea vacía final.
- **Exportar CSV**, **sin credenciales**, listo para editar y volver a subir.
- **Baja, cambio de rol, reposición de clave, levantar bloqueo.**
- **Listado** con nombre, correo, rol, sector, si está activo, si tiene clave provisoria pendiente y si está bloqueado.

**Los roles del desplegable salen de `config.js`**, no de una lista escrita a mano.

### 1.5 — La importación muestra el efecto antes de aplicarlo · **esto no se negocia**

- **Primero el diff**: quiénes se crean, quiénes cambian y **qué campo**, y **quiénes están en el padrón y no en el archivo**.
- **Todo o nada**: si una línea está mal, no se aplica ninguna, y el mensaje dice **cuál y por qué**.
- **La ausencia no da de baja por sí sola.** Un archivo al que se le borró una fila sin querer no puede desactivar a nadie en silencio: los ausentes se listan y **desactivarlos es una opción que el administrador marca**.
- **La importación no toca credenciales.** Un correo que ya existe conserva su clave.

### 1.6 — El administrador no puede dejarse afuera

Bloqueado **en el servidor**: si es el único administrador activo, **no puede darse de baja, ni quitarse la marca, ni cambiarse el rol** — ni desde la pantalla, ni desde la API, ni por una importación que lo omita o lo desactive.

Para pasar la administración: **primero se marca al nuevo, después se desmarca al anterior.**

### 1.7 — La herramienta de consola se queda, para lo que sirve

`tools/padron.js` **no se elimina**: es el camino de rescate cuando nadie puede entrar —el administrador perdió la clave antes del primer ingreso—. Deja de ser el camino normal.

Y **la lista de roles del `INSTRUCTIVO.md` se borra**: se reemplaza por una remisión a la pantalla. Un manual que enumera un dato que el código ya tiene es un duplicado, y ya falló dos veces.

---

## 2. Publicar una plantilla sin probarla · la corrección principal de H20

```js
// server/pliego-plantillas-api.js:112
if (cuerpo.pliegoProbado !== true) { ... }
```

`cuerpo` es lo que manda el cliente. El auditor publicó, **en un solo POST**, una plantilla que el generador real rechaza.

Es la **cuarta vez** que aparece la forma de ADR-036, con una vuelta de tuerca: el probador **corre** el generador, obtiene un resultado, **lo descarta**, y el publicador consulta un resultado que ya nadie guardó.

- **El servidor guarda que la prueba ocurrió**, atada al **contenido exacto** —un hash alcanza—.
- **Publicar verifica ese registro contra el contenido que se publica.** Si cambió, hay que probar de nuevo.
- **La bandera del cliente se ignora**, no se compara. Como el `contexto.rol` de la ronda 14: si el servidor la lee, sigue leyendo un dato que elige el cliente.
- El registro puede vivir en memoria y perderse al reiniciar. Que haya que probar de nuevo después de un reinicio **es correcto**.

Y cerrá los caminos laterales: publicar por API sin pasar por la pantalla, editar y publicar en dos pasos, y **volver a una versión vieja y editarla después**.

---

## 3. El pliego de servicios · y el probador que miente

`tipo_contrato` se deriva bien. Falta un campo más abajo: el generador exige `plazo_entrega_servicio` y `garantia_servicio` cuando el tipo es `servicios`, y **la exportación nunca los emite**.

**Y nadie lo vio porque el probador los fabrica.** `construirDatosEjemplo` los inventa, así que "Probar ahora" da OK para servicios: **el probador prueba un expediente que el sistema nunca va a poder emitir.**

1. **Emitir los dos campos** desde el ANEXO 1, y **avisar al cargar** si faltan — no cuando el pliego no sale.
2. **El probador arma su expediente de ejemplo con la misma función de exportación** que usa el flujo real. Si fabrica datos que la exportación no emite, no prueba el sistema: prueba una ficción.

El segundo punto vale para siempre.

---

## 4. La reproducibilidad, que hoy es decorativa

El expediente estampa id y versión de la plantilla, y **nada consulta ese dato**: regenerar un pliego viejo usa la versión vigente hoy.

- **Un endpoint que devuelva una versión concreta.**
- **La regeneración usa la versión estampada.**
- Si esa versión ya no existe, **decirlo**; no caer a la vigente en silencio.

---

## 5. Se cerró de más, y dos chicas

- **Lectura de plantillas**: los roles no publicadores reciben 403 al *ver* plantillas e historial. La intención de ADR-032 §5 es que **las vean**. Abrila a todos los roles autenticados; publicar, volver y editar siguen siendo de los dos. **Y que el comentario de cabecera diga lo mismo que el código.**
- **El error de la máquina**: `server/ayudantes.js:310` y `server/pliego-probador.js:188` concatenan `e.message` a un texto nuestro. Es la clase que corregiste en `arranque.js`. **Corregí la clase, no los dos casos.** Y `ejecutarPython` invoca `python` a secas: en un equipo sin `python` en el PATH, "Probar ahora" falla antes de llegar al generador — detectalo y decilo.
- **La nota del seed sobre la numeración**: `plantillas-v1.json` afirma que la plantilla numera sola las cláusulas, y **no es cierto** — los números vienen escritos a mano. O lo implementás, o corregís la nota. **Lo que no puede quedar es la afirmación falsa**: el que lea ese archivo el año que viene va a creer que el problema está resuelto y va a dejar de mirarlo.

---

## 6. Tests

Conservando en verde todo lo anterior, en un clon limpio:

1. **Primer arranque sin padrón**: el servidor lo crea con el administrador, imprime la clave **una vez**, y arranca en modo autenticado.
2. **Segundo arranque**: no vuelve a crear nada ni a imprimir otra clave.
3. La clave del administrador **nace provisoria** y no deja hacer nada hasta cambiarla.
4. **No hay ninguna clave por omisión** en el código ni en la configuración.
5. El **modo declarado sigue activándose sólo pidiéndolo**.
6. Sólo el administrador administra el padrón: probado contra el servidor con los siete roles.
7. **Alta de a uno**: la clave se muestra una vez y no queda en ningún archivo.
8. **Exportar e importar**: el CSV exportado se vuelve a importar **sin cambios** — ida y vuelta idéntica.
9. La importación **muestra el diff** antes de aplicar, y **no aplica nada** si una línea está mal.
10. Un correo ausente del archivo **no se desactiva** salvo que se marque la opción.
11. La importación **no toca credenciales** de correos existentes.
12. El único administrador activo **no puede darse de baja ni quitarse la marca**, por ningún camino: pantalla, API, o importación.
13. El CSV con **BOM** y con línea vacía final se importa bien.
14. Publicar con `pliegoProbado: true` **sin haber probado** → rechazado.
15. Probar, **cambiar el contenido**, publicar → rechazado.
16. Un expediente de **servicios** emite los dos campos y **el generador real produce el pliego**.
17. El **probador** arma su ejemplo con la función de exportación real.
18. Regenerar un expediente estampado con la versión N **usa la versión N**.
19. Todos los roles autenticados **ven** plantillas e historial; sólo dos publican.
20. Ningún mensaje al usuario concatena el mensaje de un error del sistema.
21. La suite completa termina en verde de una sola pasada.

---

## 7. `INFORME-RONDA-17.md` — las nueve secciones

En la §2, cuatro cosas explícitas:

- **cómo se genera y se muestra la clave del administrador**, y qué pasa si nadie la lee;
- **qué hace la importación** cuando un correo está en el padrón y no en el archivo;
- **cómo guardás que la prueba de la plantilla ocurrió**, y qué pasa al reiniciar;
- **qué elegiste** sobre la numeración automática, y por qué.

---

## 8. Cierre

```
node --test
node tools/check-compat.js
git add -A
git commit -m "Ronda 17 - H21 administracion del padron, cierre de H10 y H20"
git push
git log --oneline -1
git status --short
git log origin/main --oneline -1
```

---

## 9. Criterios de aceptación

| # | Verificación | Resultado exigido |
|---|---|---|
| 1 | `node --test` en clon limpio, una pasada | Verde |
| 2 | `check-compat` | Salida 0 |
| 3 | **Primer arranque sin padrón** | Lo crea con el administrador y arranca |
| 4 | Clave del administrador | Generada, mostrada **una vez**, provisoria. **Ninguna por omisión** |
| 5 | Modo declarado | Sólo pidiéndolo |
| 6 | Administración del padrón | Sólo el administrador, verificado en el servidor |
| 7 | Ida y vuelta CSV | Exportar e importar no cambia nada |
| 8 | Importación | Diff antes de aplicar; todo o nada; ausencia **no** desactiva |
| 9 | Credenciales | La importación no las toca |
| 10 | Encierro del administrador | Imposible por los tres caminos |
| 11 | `pliegoProbado` del cliente | **Ignorado**; el servidor guarda la prueba |
| 12 | Pliego de **servicios** | **El generador real lo produce** |
| 13 | El probador | Usa la exportación real |
| 14 | Regeneración | Usa la versión **estampada** |
| 15 | Lectura de plantillas | Todos los roles autenticados |
| 16 | Mensajes | Ninguno concatena el error de la máquina |
| 17 | Nota del seed | Verdadera, o corregida |
| 18 | Archivos sobre 400 líneas | Ninguno |
| 19 | Informe con las nueve secciones | Completo |

---

## 10. Qué se está evaluando

**Que instalar esto no tenga requisitos previos.** Se instala, se abre el navegador, se entra, y desde ahí se hace todo lo demás. Tres ciclos de defectos vinieron de que el administrador tenía que hacer por consola lo que los demás hacen por pantalla; esta ronda elimina esa regla, no la arregla.

**Y que ninguna validación dependa de que el cliente diga la verdad.** Es la cuarta vez que aparece la misma forma —el rol declarado, la guardia silenciosa, el padrón retratado, la prueba olvidada—, siempre con otro disfraz y la misma consecuencia: el sistema funciona, nadie ve un error, y el comportamiento es el equivocado.

Pesa, en este orden: (1) que el primer arranque cree el administrador y no haya clave por omisión, (2) que la importación no pueda desactivar a nadie en silencio, (3) que el administrador no pueda encerrarse afuera, (4) que la prueba de la plantilla no se pueda saltear, (5) que el pliego de servicios salga del generador real.

Al terminar esta ronda, **el Jefe de Contrataciones instala y prueba.**
