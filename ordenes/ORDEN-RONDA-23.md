# ORDEN DE TRABAJO — RONDA 23

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hito cubierto: **H24 — lo que apareció cuando alguien lo usó de verdad** (continuación)
Emitida: 2026-09-17

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`, y **las reglas de tiempo de
`ordenes/ORDEN-RONDA-20.md` §0 siguen vigentes íntegras**.

### Esta ronda está partida en piezas, y cada pieza se entrega sola

La ronda 22 tuvo §1 terminado y verde durante horas y estuvo a un corte de
distancia de perderse, porque esperaba el final de la ronda para commitear. El
corte llegó —una falla del proveedor de modelos, ajena al proyecto— y la ronda no
se pudo cerrar. La cerré yo a mano.

**No vuelve a pasar.** Esta orden son **seis piezas independientes**, en orden de
menor a mayor. La regla, que es nueva y es la más importante de esta orden:

> ### Terminada una pieza y sus tests en verde: `commit` y `push`. En el momento.
>
> Un commit por pieza, con el nombre que dice cada una. No se espera al final.
> No se juntan dos. Si la sesión se corta después de la pieza 3, las piezas 1, 2
> y 3 ya están entregadas y la ronda 24 arranca en la 4.

Y al final, además, el commit del informe. Son siete commits, y está bien que
sean siete.

### Sobre los sub-agentes: **se ofrecen, no se exigen**

La orden 22 te los pedía. Se cayeron dos veces por una falla del proveedor —no
tuya— y arrastraron la ronda. A partir de acá:

- Repartí en sub-agentes **sólo los barridos de sólo lectura**, si te sirve.
- **Si la llamada falla, un reintento y se acabó.** Después hacés el barrido en
  serie, como tarea separada con su tabla, y **lo decís en el informe**.
- Un tope vencido o un sub-agente caído **es un hallazgo, no un accidente**: va
  al informe con su renglón.

Nunca escribir código, nunca levantar servidores, nunca redactar el informe en
sub-agentes. Eso no cambió y no va a cambiar.

### Accesos fuera del repositorio

`os.tmpdir()`, `127.0.0.1`. Nada más.

---

## 1. Pieza 1 · El texto de ayuda de la aclaración · **primero porque es la más chica**

Viene entera de la orden 22 §3. Pedido textual del Jefe de Contrataciones:

> *"Que no repitan lo que ya dice la descripción del ítem, sino aquello que debe
> ser aclarado por sobre esa descripción. Y que se debe evitar usar una marca para
> declarar la calidad, sino más bien buscar los parámetros técnicos de calidad,
> para poder en el futuro evaluar las ofertas de acuerdo a lo declarado en estas
> líneas."*

**Esto no es una mejora de interfaz: es la regla que hace evaluable una oferta**, y
hoy no está escrita en ninguna parte del sistema. Vive en la cabeza del Jefe de
Contrataciones y se transmite corrigiendo pliegos de a uno. Ataca directo a **R14**
—la aclaración como cajón de sastre.

**Texto**, ajustable por el Jefe de Contrataciones:

> *Qué agrega esta aclaración por sobre la descripción del ítem. No repita la
> descripción. Evite nombrar marcas para indicar calidad: escriba los parámetros
> técnicos exigibles —medidas, materiales, normas, tolerancias, garantía—, que son
> los que después permiten comparar y evaluar las ofertas.*

Va como texto de ayuda **visible**, no como globito que aparece al pasar el mouse:
en Chrome 109 y con gente que usa teclado, un globito no existe. Y **no es
obligatorio ni valida nada**: es una guía, no una traba.

**Commit: `Ronda 23 · ayuda de la aclaración`** — y push.

---

## 2. Pieza 2 · Las tres puertas que encontró el barrido B1

El barrido de la ronda 22 hizo exactamente lo que tenía que hacer: encontró que
`apiCrear` no era la única puerta sin guardia. Lo recontrasté yo sobre el disco.

| Extremo | Quién debería poder | Quién lo verifica hoy |
|---|---|---|
| `presupuestos.js:38 apiGuardarPresupuesto` | el rol del estado del expediente | **nadie** |
| `expedientes.js:224 apiGuardarEntregable` | el rol del estado del expediente | **nadie** |
| `pliego-plantillas-api.js` — `apiPublicarVersion`, `apiEstampar`, `apiVolver`, `apiSeleccionar` | administrador | **nadie** |

La tercera es la más grave de las tres: **cualquiera autenticado puede cambiar la
plantilla vigente de pliegos**, que es el documento que después firma el Jefe.

### Lo que hay que hacer

- Las tres con **el mismo patrón que quedó en `apiCrear`**: `autorizacion.verificar`
  contra el padrón vivo, rol desde la sesión, 403 en castellano diciendo qué rol
  hace falta. **No inventes un patrón nuevo.**
- Presupuestos y entregables se atan **al rol del estado en que está el
  expediente**, no a un rol fijo: la matriz de 18 × 7 ya dice cuál es.
- Las plantillas de pliego se atan a **la marca `administrador`**, con el mismo
  `esAdministrador` que ya usa `padron-administracion.js`.
- **No cambies la matriz de 18 × 7.**

**Commit: `Ronda 23 · guardias de presupuestos, entregables y plantillas`** — y push.

---

## 3. Pieza 3 · El presupuesto viaja como archivo

Viene de la orden 22 §2, y ahora va sola, **sin el cambio de número**, porque son
dos cosas distintas y se rompen distinto.

### Por qué el transporte, y no el número

El archivo viaja **codificado en texto adentro de un JSON**: infla un 33%, así que
20 MB se vuelven 27 MB. Y en el camino el servidor sostiene cuatro copias al mismo
tiempo: el texto recibido, el texto ya interpretado, la copia limpia de
`replace(/\s+/g,'')` que está en `presupuestos.js:50`, y el binario.

| | Hoy (2 MB) | Sólo cambiando el número | Con transporte binario |
|---|---|---|---|
| Lo que viaja | 2,7 MB | 27 MB | **20 MB** |
| Pico de memoria por subida | ~10 MB | **~100 MB** | **menos de 1 MB** |
| En la PC del operador | 2,7 MB en la página | **27 MB en la página**, en Chrome 109 | el archivo, sin copia |

Lo que **ya está bien y no se toca**: el archivo se guarda como archivo de verdad
en el disco (`presupuesto-<n>.<ext>`), con nombre decidido por el servidor y
escritura atómica. Eso es lo que hace viable todo esto.

### Lo que hay que hacer

- Ese **único extremo** deja de recibir texto codificado dentro de un JSON y pasa a
  recibir **los bytes crudos**, con el tipo en la cabecera y el resto de los datos
  en la dirección o en cabeceras.
- El servidor **escribe el cuerpo directo al archivo temporal** y lo renombra —
  sin juntar todo en memoria primero.
- **El tope de cuerpo general sigue chico para todo lo demás.** Que suba sólo este
  extremo; el resto de la API no tiene por qué aceptar cuerpos grandes.
- El límite **sigue en 2 MB en esta pieza**. Se sube en la pieza 4, y así, si algo
  sale mal, se sabe cuál de los dos cambios fue.

### Lo que tenés que medir

Con un PDF de **20 MB de verdad**, aunque el límite todavía lo rechace —medí el
transporte, no la aceptación—: cuánto tarda, cuánto pico de memoria toma el
servidor, y qué pasa si **dos** suben a la vez. **Números, no estimaciones.**

**Commit: `Ronda 23 · el presupuesto viaja como archivo`** — y push.

---

## 4. Pieza 4 · El límite a 20 MB, escrito una sola vez

Hoy el número está en tres lugares: `presupuestos.js:26`, `ayudantes.js:15` y
`app/js/views/requerimiento-presupuestos.js:24`. **Un límite escrito tres veces se
desincroniza**, y cuando se desincroniza el usuario recibe un mensaje que dice un
número y un rechazo que usa otro.

### Lo que hay que hacer

- **El límite pasa a 20 MB**, declarado **en un solo lugar** del que salgan el
  control del servidor, el aviso del cliente y el texto del mensaje.
- **El cliente avisa antes de subir.** Si el archivo pesa más, se dice **antes** de
  leerlo, con el tamaño real y el máximo, al lado del archivo.
- **Indicador de progreso.** Veinte megas desde una PC del parque tardan varios
  segundos; sin nada en pantalla eso se lee como "se colgó", la persona vuelve a
  apretar, y ahí sí se sube dos veces.

### Test que lo prueba de verdad

**Cambiá ese número a otro valor y verificá que cambien los tres**: el control, el
aviso del cliente y el mensaje. Si hay que tocar más de un archivo para cambiar el
límite, la pieza no está hecha.

**Commit: `Ronda 23 · límite de 20 MB en un solo lugar`** — y push.

---

## 5. Pieza 5 · B2 · el barrido de los límites

El que no se pudo hacer en la ronda 22. Es de sólo lectura y **se puede repartir**,
con la regla de §0.

**La pregunta:** ¿está declarado una vez, o repetido?

**La tabla:** límite · dónde se declara · quiénes lo consumen · ¿coinciden?

Todos: tamaños de archivo, cantidades máximas, topes de caracteres —el corte de 256
de la aclaración, los 4000 de la sugerencia, el `TOPE_SUCESOS`—, tiempos de espera,
tamaños de cuerpo. Servidor y cliente.

**No los corrijas en esta ronda.** Basta la lista. Lo que se corrige sale de la
lista y entra en la ronda 24, priorizado por el daño que hace que estén
desincronizados.

**Commit: `Ronda 23 · barrido de límites`** — y push (el informe parcial va en
`INFORME-RONDA-23.md`, sección propia).

---

## 6. Pieza 6 · La suite: **medir dónde se va el tiempo, no prometer un número**

En la ronda 22 te pedí la suite completa en menos de dos minutos con paralelismo
por archivo. **El criterio estaba mal escrito y no era alcanzable**: medido en tu
propia sesión, `node --test` da **304 s** y `--test-concurrency=4` da **278 s**.
`os.availableParallelism()` devuelve 4 y aun así el tiempo de pared es casi la
suma. Pedirlo más fuerte no lo va a arreglar. Es un error mío y lo corrijo acá.

Lo que quiero ahora es **entender por qué**, que vale más que el número:

- **La tabla de tiempos por archivo**, los 52, ordenada de mayor a menor. Con eso
  solo ya se sabe si el problema es el reparto o si hay un archivo que dura solo
  más que el objetivo entero.
- **Una respuesta a: ¿por qué no paraleliza?** Las candidatas, para descartarlas de
  a una: archivos que se serializan entre sí por un recurso compartido —**el puerto
  fijo** o **la carpeta de datos**—; un archivo dominante que fija el piso; o que la
  bandera no esté haciendo lo que suponemos. **Comprobá, no supongas.**
- **El camino rápido, escrito en el repositorio**: el comando para correr sólo los
  archivos que tocaste, que es lo que se hace quince veces por ronda. La suite
  entera, una vez, al cerrar.
- Si aparece que el freno son los **puertos fijos**, hacé el cambio: que cada test
  que levanta servidor pida **puerto libre al sistema**. Ese sí es un cambio de esta
  pieza. Y el que no pueda, que quede fuera del paralelo y se diga cuál.

**El criterio de aceptación es la tabla y la explicación, no un tiempo.**

**Commit: `Ronda 23 · medición de la suite`** — y push.

---

## 7. Tests

- Cada una de las tres guardias de la pieza 2: el rol que corresponde lo consigue,
  los otros seis reciben 403. Por la API **y** por la pantalla donde haya pantalla.
- Subir un PDF de **19 MB** (entra), de **21 MB** (rechazado, con el tamaño y el
  máximo en el mensaje), y algo que no sea PDF ni imagen.
- El límite aparece **una sola vez**: cambiá el número y verificá que cambien los
  tres consumidores.
- El texto de ayuda de la aclaración está **en el documento, visible**, no en un
  atributo que sólo ve el mouse.
- **Los 9 caminos siguen en verde**, y ninguno se tocó para que pase.

---

## 8. `INFORME-RONDA-23.md` — en la raíz del repositorio

Las nueve secciones de siempre. Cinco cosas propias:

- **Qué piezas entraron y cuáles no**, con el hash de cada commit. Si quedaron
  cuatro de seis, cuatro de seis.
- **Las mediciones del archivo de 20 MB**: tiempo, pico de memoria, y dos subidas
  simultáneas. Antes y después del transporte binario.
- **La tabla de B2**.
- **La tabla de tiempos por archivo de la suite**, y la explicación de por qué no
  paraleliza.
- **Cómo te fue con los sub-agentes**, ahora que son opcionales: cuántos lanzaste,
  cuántos se cayeron, qué hiciste cuando se cayeron, y si repartir ahorró o costó.
  **No hay respuesta correcta**; si la conclusión es que no sirven, esa es la
  información que necesito.

**Commit: `Ronda 23 · informe`** — y push.

---

## 9. Cierre

**Siete commits, uno por pieza más el informe, cada uno con su push en el momento.**

**Si el tiempo se acaba**, no cortés scope: cortá donde estés. Las piezas ya
entregadas quedan entregadas y la ronda 24 arranca en la siguiente. Eso es todo lo
que esta orden pide que cambie respecto de la anterior.

---

## 10. Criterios de aceptación

- El texto de ayuda de la aclaración, **visible**, en la pantalla del renglón.
- Las tres puertas de la pieza 2 con guardia, verificada en el servidor, con el
  patrón de `apiCrear`.
- El presupuesto viaja como bytes crudos y el servidor **no junta el archivo en
  memoria**. Con la medición que lo demuestre.
- El límite es 20 MB y está escrito **una sola vez**, probado cambiándolo.
- El cliente avisa antes de subir, y hay progreso a la vista.
- La tabla de B2, completa.
- La tabla de tiempos por archivo de la suite, con la explicación de por qué no
  paraleliza.
- Los 9 caminos en verde, sin tocar ningún test.
- **Cada pieza tiene su propio commit empujado**, no un commit final con todo.

---

## 11. Qué se está evaluando

**Si el trabajo sobrevive a que lo interrumpan.**

Las seis piezas ya estaban decididas antes de esta orden: cinco vienen de la 22 y
una de su barrido. Lo que se mide esta vez no es el contenido, que es conocido. Es
si al terminar cada pieza queda entregada —empujada, visible para el auditor, a
salvo— o si al final de la sesión hay otra vez tres horas de trabajo verde en un
árbol que nadie más puede ver.
