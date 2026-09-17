# ORDEN DE TRABAJO — RONDA 22

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hito cubierto: **H24 — lo que apareció cuando alguien lo usó de verdad**
Emitida: 2026-09-17

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`, y **las reglas de tiempo de `ordenes/ORDEN-RONDA-20.md` §0 siguen vigentes íntegras**.

### La ronda 21 salió completa, y una cosa la hiciste sin que te la pidieran

Verifiqué yo mismo: la corrección de la versión con el patrón que ya usaban presupuestos y anexos, los tres caminos cerrados —**9 de 9**—, y la capa de estilos de verdad: **un solo `:root` en `tokens.css`** y **cero colores escritos a mano en `main.css`**. Los conté.

Y lo que no estaba en la orden: yo había marcado que el mensaje *"fue modificado por otro operador"* mandaba a buscar a un compañero inexistente, y vos **hiciste que el servidor recuerde quién escribió la última versión** para que el 409 distinga *"lo modificó otro"* de *"lo modificaste vos en otra pestaña"*. Eso es entender el problema en vez de ejecutar la orden. Quedó en ADR-042.

### De dónde sale esta ronda

**Los tres puntos son del Jefe de Contrataciones cargando un expediente real**, en una sola sesión. Ninguno lo encontró un test, ninguno lo encontró una auditoría, y uno tiene veintiuna rondas de antigüedad.

### Accesos fuera del repositorio

`os.tmpdir()`, `127.0.0.1`, y **sólo lectura** sobre `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\`, con permiso de ejecutar `scripts/generar_pliego.py` hacia una carpeta temporal. Nada más.

---

## 1. Nadie controla quién origina un requerimiento · **va primero, es alto**

`server/expedientes.js:63` — `apiCrear` valida los renglones, los textos y el encabezado, **y nunca mira el rol**. Cualquiera autenticado puede crear un expediente.

Y los roles efectivos lo confirman: `contrataciones_supervisor` hereda **sólo** `contrataciones` (`roles.js:18-21`), no `generador`, que es el `rolEjecutor` del primer paso. **La matriz de 18 × 7 gobierna las transiciones y nadie gobierna el nacimiento.**

### Por qué importa más de lo que parece

El circuito en papel separa a quien **pide** de quien **compra**. Esa separación no es burocracia: es el control que impide que la División Contrataciones genere su propia demanda. Si el sistema deja que un `contrataciones_supervisor` origine el requerimiento, borra esa separación en silencio — y el registro de auditoría queda diciendo que la necesidad la pidió Contrataciones.

Es la misma familia del defecto del ciclo 14, con un agravante: **allá había un control equivocado; acá no hay ninguno.**

### Lo que hay que hacer

- **Crear un expediente exige el rol que ejecuta el primer paso** (`ESPECIFICACIONES_TECNICAS` → `generador`), **verificado en el servidor contra el padrón**, con los roles efectivos de ADR-033. Nunca contra lo que diga el cuerpo de la petición.
- **Y el rol sale de la sesión**, como todo lo demás desde el ciclo 14.
- El rechazo es un **403 con mensaje en castellano** que diga qué rol hace falta.
- **El cliente también**: si la persona no puede originar, el botón de crear no aparece. Pero **el control que vale es el del servidor** — el del cliente es cortesía.

### Y buscá los demás nacimientos sin dueño

`apiCrear` no es necesariamente el único. **Recorré todos los extremos del servidor que crean algo** —expedientes, presupuestos, entregables, adjuntos, plantillas, sugerencias, personas del padrón— y por cada uno, en el informe: **¿quién puede hacerlo, y quién lo verifica?** Si alguno no verifica nada, es el mismo hallazgo esperando turno.

**No cambies la matriz de 18 × 7.** Esto no agrega un paso ni un rol: agrega la guardia que faltaba en la puerta de entrada.

---

## 2. El presupuesto de 20 MB · **y el cambio no es el número**

El Jefe de Contrataciones se frenó acá con un documento de GDE — que vienen escaneados y pesan lo que pesan:

> *"No pude cargar presupuestos porque me dice que `IF-2026-54283740-APN-VBAM_FAA.pdf` supera el límite de 2 MB."*

### Lo que hay hoy

- `presupuestos.js:26` → **2 MB** por archivo.
- `ayudantes.js:15` → **4 MB** de cuerpo de petición.

Lo que **ya está bien y no se toca**: el archivo se guarda como archivo de verdad en el disco (`presupuesto-<n>.<ext>`), con nombre decidido por el servidor y escritura atómica. Eso es lo que hace viable subir el límite.

### Por qué subir el número a secas es un error

El archivo viaja **codificado en texto adentro de un JSON**: infla un 33%, así que **20 MB se vuelven 27 MB**. Y en el camino el servidor sostiene cuatro copias al mismo tiempo: el texto recibido, el texto ya interpretado, la copia limpia de `replace(/\s+/g,'')`, y el binario.

| | Hoy (2 MB) | Sólo cambiando el número | Con transporte binario |
|---|---|---|---|
| Lo que viaja | 2,7 MB | 27 MB | **20 MB** |
| Pico de memoria por subida | ~10 MB | **~100 MB** | **menos de 1 MB** |
| En la PC del operador | 2,7 MB en la página | **27 MB en la página**, en Chrome 109 sobre Windows 7 | el archivo, sin copia |

### Lo que hay que hacer

- **El archivo viaja como archivo.** Ese único extremo deja de recibir texto codificado dentro de un JSON y pasa a recibir **los bytes crudos**, con el tipo en la cabecera y el resto de los datos en la dirección o en cabeceras. El servidor **escribe el cuerpo directo al archivo temporal** y lo renombra — sin juntar todo en memoria primero.
- **El límite pasa a 20 MB**, declarado **en un solo lugar** del que salgan el control del servidor, el aviso del cliente y el texto del mensaje. Hoy el número está escrito en el servidor y el mensaje lo arma aparte: **un límite escrito dos veces se desincroniza.**
- **El cliente avisa antes de subir.** Si el archivo pesa más, se dice **antes** de leerlo, con el tamaño real y el máximo, al lado del archivo.
- **Y tiene que haber indicador de progreso.** Veinte megas desde una PC del parque tardan varios segundos; sin nada en pantalla eso se lee como "se colgó" y la persona vuelve a apretar — y ahí sí se sube dos veces.
- El tope de cuerpo general **sigue chico para todo lo demás**. Que suba sólo el extremo de archivos; el resto de la API no tiene por qué aceptar cuerpos grandes.

### Lo que tenés que medir y poner en el informe

Con un PDF de **20 MB de verdad**: cuánto tarda la subida, cuánto pico de memoria toma el servidor, y qué pasa si **dos** suben a la vez. Números, no estimaciones.

---

## 3. El texto de ayuda de la aclaración · corto, y vale más que una función

Pedido textual del Jefe de Contrataciones:

> *"Que no repitan lo que ya dice la descripción del ítem, sino aquello que debe ser aclarado por sobre esa descripción. Y que se debe evitar usar una marca para declarar la calidad, sino más bien buscar los parámetros técnicos de calidad, para poder en el futuro evaluar las ofertas de acuerdo a lo declarado en estas líneas."*

**Esto no es una mejora de interfaz: es la regla que hace evaluable una oferta**, y hoy no está escrita en ninguna parte del sistema. Vive en la cabeza del Jefe de Contrataciones y se transmite corrigiendo pliegos de a uno. Ataca directo a **R14** —la aclaración como cajón de sastre— y a buena parte de los errores típicos del log.

**Texto propuesto** para el campo de aclaración, ajustable por el Jefe de Contrataciones:

> *Qué agrega esta aclaración por sobre la descripción del ítem. No repita la descripción. Evite nombrar marcas para indicar calidad: escriba los parámetros técnicos exigibles —medidas, materiales, normas, tolerancias, garantía—, que son los que después permiten comparar y evaluar las ofertas.*

Va como texto de ayuda **visible**, no como globito que aparece al pasar el mouse: en Chrome 109 y con gente que usa teclado, un globito no existe. Y **no es obligatorio ni valida nada**: es una guía, no una traba.

---

## 4. Los barridos · **repartilos, si podés**

Esta orden te pide dos inventarios completos, y en las últimas rondas te vengo pidiendo entre tres y cinco. **Son independientes entre sí, son de sólo lectura, y no comparten nada.**

**Repartilos en sub-agentes.** Está confirmado que tu entorno lo permite. Son la parte más lenta de la ronda y la que más se hace a medias cuando aprieta el reloj.

Cada uno tiene **una pregunta y una tabla de salida**, para que se puedan hacer por separado y juntar al final:

| # | Barrido | La pregunta | La tabla |
|---|---|---|---|
| **B1** | Todos los extremos del servidor que **crean** algo | ¿Qué pasa si lo llama el rol equivocado? | extremo · quién debería poder · quién lo verifica · qué pasa hoy |
| **B2** | Todos los lugares donde está escrito un **límite** (tamaño, cantidad, caracteres) | ¿Está declarado una vez, o repetido? | límite · dónde se declara · quiénes lo consumen · ¿coinciden? |

**Lo que NO se reparte, y es importante:**

- **Escribir código y tests: un solo agente, un solo árbol.** Dos manos editando `dev/` a la vez es cómo se pierde una ronda entera, y ya perdimos una (ciclo 10). El daño no se mide en minutos: se mide en días.
- **Arrancar servidores: nunca en paralelo.** Fue la causa de la peor demora del proyecto (ciclo 20: procesos huérfanos en el 8136, dos días). N tareas en paralelo son N servidores en N puertos.
- **Redactar el informe: uno solo.** Lo que hace valioso un informe es que una sola cabeza sostenga la ronda entera y reconozca una forma que ya vio. Cinco informes parciales pegados dan cinco descripciones correctas y ninguna de esas frases.

Y si por lo que sea no podés repartirlos, hacelos igual **como tareas separadas**, una después de otra, con su tabla cada una. El problema de hoy no es sólo que tarden: es que se hacen mezcladas con el resto del trabajo y por eso salen incompletas.

### Y contame cómo te fue con esta configuración · **es la primera vez y quiero saberlo**

Es la primera ronda organizada así, y lo pide el Jefe de Contrataciones expresamente. En el informe, una sección corta y honesta:

- **Cuántos sub-agentes lanzaste** y para qué.
- **Qué te sirvió y qué te estorbó.** Si repartir costó más de lo que ahorró en alguno, decilo.
- **Si alguno volvió con algo inútil, incompleto o duplicado**, y por qué te parece que pasó.
- **Qué tarea de esta orden habrías repartido y no se podía**, o al revés: **qué repartiste y no había que repartir**.
- **Cuánto tardó la ronda**, comparado con lo que te llevó la anterior.

**No hay respuesta correcta.** Si la conclusión es que no sirvió, esa es la información que necesito — el esquema se cambia, no se defiende.

---

## 5. La suite tarda cinco minutos, y la corrés muchas veces

Medido en tu propio informe de la ronda 21: **420 tests, 294 segundos**, en **52 archivos**.

Si la corrés cuatro o cinco veces en una ronda, son **veinte o veinticinco minutos mirando pasar tests**, casi todos ajenos a lo que estás tocando. Es, hoy, el gasto de tiempo más grande y más fácil de eliminar del ciclo.

**Dos cambios, los dos de una tarde:**

- **Corré los archivos en paralelo.** Son 52 y son independientes: de a cuatro procesos, los 294 segundos bajan a poco más de uno. Dejá el comando escrito en el repositorio para que no haya que acordarse de cómo se hace, y **que el orden de la salida no dependa de quién termine primero** — un resumen que cambia de orden en cada corrida no se puede comparar entre rondas.
- **Durante el trabajo, corré lo que tocaste. La suite entera, una vez, al cerrar.** Y decilo en el informe: cuántas corridas completas hiciste.

**Cuidado con una cosa**: los tests que levantan un servidor **no pueden compartir puerto**. Si dos archivos en paralelo piden el mismo, se pisan y el rojo que aparece no tiene nada que ver con el código. Que cada uno pida **puerto libre al sistema** en lugar de un número fijo — y si alguno no puede, que quede fuera del paralelo y se diga cuál.


---

## 6. Tests

- Crear un expediente con cada uno de los siete roles: **sólo el que ejecuta el primer paso lo consigue**, y los otros seis reciben 403. Por la API **y** por la pantalla.
- El botón de crear no aparece para quien no puede — y aunque lo fabrique a mano, el servidor lo rechaza igual.
- Subir un PDF de **19 MB** (entra), de **21 MB** (rechazado con el tamaño y el máximo), y algo que no sea PDF ni imagen.
- El límite aparece **una sola vez** en el código: cambiá ese número y verificá que cambien el control, el aviso del cliente y el mensaje.
- **Los 9 caminos siguen en verde**, y ninguno se tocó para que pase.

---

## 7. `INFORME-RONDA-22.md` — en la raíz del repositorio

Las nueve secciones. Tres cosas propias:

- **B1 y B2**, los dos barridos, cada uno con su tabla.
- **Cuántas corridas completas de la suite** hiciste, y cuánto tardó con el paralelo.
- **Las mediciones del archivo de 20 MB**: tiempo, memoria, y dos subidas simultáneas.
- **Dónde quedó declarado el límite**, y qué lo consume.

---

## 8. Cierre

Un solo commit, `Ronda 22`, **y push**.

**Si el tiempo se acaba, cortá en este orden:** §1 siempre (es el hallazgo alto), después §2, y §3 es lo que puede quedar para la ronda siguiente — aunque son tres renglones de texto y sería una pena.

---

## 9. Criterios de aceptación

- Un `contrataciones_supervisor` **no puede** crear un expediente; un `generador` sí. Verificado en el servidor.
- La lista completa de extremos que crean algo, con su control.
- Un PDF de 20 MB sube, con progreso a la vista, y el servidor **no toma cien megas de memoria para hacerlo**.
- El límite está escrito **una sola vez**.
- El texto de ayuda de la aclaración, visible.
- Los 9 caminos en verde, sin tocar ningún test.
- **La suite completa en menos de dos minutos**, corriendo los archivos en paralelo, con la salida en orden estable.

---

## 10. Qué se está evaluando

**Que el sistema aguante el primer expediente real.**

Los tres puntos de esta orden salieron de una sola sesión de carga verdadera. Ninguno lo encontró un test. El de los permisos tiene veintiuna rondas de antigüedad y estaba a la vista de cualquiera que se preguntara *"¿y quién puede crear esto?"*.

Lo que se mide en esta ronda no es si las tres correcciones funcionan —son tres y ninguna es difícil—. Es si, al buscar las **otras** puertas sin guardia y los **otros** límites escritos dos veces, aparece la lista completa o sólo los casos que rompieron.
