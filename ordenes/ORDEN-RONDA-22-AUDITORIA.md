# ORDEN DE AUDITORÍA — CICLO 22

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **H24 — lo que apareció cuando alguien lo usó de verdad**, según `ordenes/ORDEN-RONDA-22.md`
Emitida: 2026-09-17

---

## 0. Tu rol

Valen `ORDEN-RONDA-04-AUDITORIA.md` §0 y §1, la verificación de conducta de `ORDEN-RONDA-05-AUDITORIA.md` §1, el control de entrega, `MOTIVOS.md` al día, y la integridad de la bitácora.

**Las reglas de tiempo de `ORDEN-RONDA-20-AUDITORIA.md` §0 siguen vigentes íntegras. Y seguís sin manejar el navegador** — el ciclo 21 volvió a durar lo que tiene que durar, y eso fue por esto.

### Tu ciclo anterior

El experimento central lo hiciste impecable: quitaste las tres líneas de `exportar.js:190-192`, corriste el test de C6 sobre la montura real, **rojo**, restauraste, diff cero, `node --check` OK. Así se verifica una corrección y no hay otra forma.

**Y una corrección de mi parte, no tuya.** Te pedí ese experimento en los nueve caminos y en la misma orden te puse topes de tiempo estrictos. Cada experimento cuesta cerca de setenta segundos más el arranque: nueve no entran. Hiciste uno, leíste los otros ocho, y **lo declaraste** — que es exactamente lo correcto.

**Desde esta ronda lo pido bien: tres experimentos, no nueve.** Los elegís vos entre los caminos que la ronda tocó, y **van rotando**, de modo que en tres rondas los nueve queden verificados a mano alguna vez. Anotá cuáles hiciste y cuáles te tocan la próxima, para que la rotación no se pierda.

### Una cosa que cambió y que tenés que tener presente todo el tiempo

**El código que vas a auditar lo escribiste vos**, en otra sesión, contra la orden de trabajo de esta misma ronda. Hasta hace unas rondas el desarrollador era otro modelo; ya no.

No compartís contexto con esa sesión —no sabés qué pensó ni qué descartó, sólo ves el resultado— y eso conserva buena parte del valor del control. Pero **hay algo que sí compartís: las inclinaciones**. Si al escribirlo te pareció razonable, al leerlo te va a volver a parecer razonable, y no hay nadie adentro del ciclo que lo contrapese.

**Ya pasó, y hace una ronda.** Encontraste que guardar un documento impedía avanzar el expediente y lo clasificaste como *"control de concurrencia legítimo, no un defecto del servidor"*. Era un defecto que frenaba a una persona sola y le echaba la culpa a un compañero inexistente. La descripción técnica era impecable; la conclusión, equivocada.

Por eso, en esta ronda:

- **Ante la duda, elegí lo mecánico sobre lo opinable.** Quitá la corrección y mostrá el test en rojo; compará dos archivos byte a byte; contá. Eso da el mismo resultado sin importar quién lo mire.
- **Cuando algo te parezca razonable, preguntate si te parece razonable porque lo es o porque lo escribiste vos.**
- Y ante cualquier comportamiento que frene a una persona: la pregunta no es *"¿cada componente actuó bien?"* sino **"¿esto tiene sentido para quien está adelante de la pantalla?"**.

### Accesos fuera del repositorio

`auditoria\bateria\`; `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\` en **sólo lectura**, con permiso de ejecutar `scripts/generar_pliego.py` hacia una carpeta temporal; `os.tmpdir()` y `127.0.0.1`. Nada más.

---

## 1. Verificación de conducta

Los ocho de siempre, la **batería completa** con `MOTIVOS.md` al día, y el informe en la raíz.

---

## 2. Las puertas sin guardia · **el 40%, y es lo más importante de esta ronda**

El hallazgo que originó la ronda es que **`apiCrear` no mira el rol**: cualquiera autenticado podía originar un requerimiento. Veintiuna rondas, a la vista, y lo encontró el Jefe de Contrataciones de casualidad.

### 2.1 — La corrección

- Los **siete roles** contra el extremo de creación: sólo el que ejecuta el primer paso pasa, los otros seis reciben **403**. Por la API directa, no sólo por la pantalla.
- El rol **sale de la sesión**: mandá un cuerpo que diga `rol: 'generador'` con una sesión de `contrataciones` y verificá que **no sirva de nada**. Es el ataque del ciclo 14 y hay que repetirlo cada vez que aparece una guardia nueva.
- Los **roles efectivos** de ADR-033: un `abastecimiento_supervisor` puede lo que puede un `abastecimiento`. Verificá que la herencia se aplique y que **no se haya inventado herencia nueva** — `contrataciones_supervisor` **no** hereda `generador`.
- El botón escondido en el cliente **no es el control**. Fabricá la petición a mano y comprobá que el servidor la rechace igual.

### 2.2 — Y las demás, que es lo que de verdad quiero saber

La orden le pide al desarrollador **la lista de todos los extremos que crean algo** —expedientes, presupuestos, entregables, adjuntos, plantillas, sugerencias, personas del padrón— con quién puede y quién lo verifica.

**Hacé tu propia lista leyendo el código, antes de mirar la suya.** Después compará. **Lo que esté en la tuya y no en la suya es el hallazgo de la ronda.**

Por cada extremo, una sola pregunta: **¿qué pasa si lo llama el rol equivocado?** Si la respuesta es "funciona", es alto.

---

## 3. El archivo de 20 MB

- **Un PDF de 19 MB entra. Uno de 21 MB se rechaza**, con el tamaño real y el máximo en el mensaje, en castellano.
- **El límite está escrito una sola vez.** Buscalo: si aparece el número en el servidor y otra vez en el cliente o en un texto, es un límite que se va a desincronizar. Cambialo en su lugar único y verificá que cambien los tres usos.
- **Medí de verdad**, y con archivos de verdad: cuánto tarda, cuánta memoria toma el servidor durante la subida, y **qué pasa con dos subidas simultáneas**. La orden le pide esos números al desarrollador: sacá los tuyos y compará.
- **El archivo que queda en disco es idéntico al original.** Comparalo byte a byte — si el transporte cambió, es lo primero que puede haberse roto.
- Y lo de siempre: **algo que no es PDF ni imagen**, un PDF renombrado, y un archivo vacío.
- **El resto de la API sigue con el cuerpo chico.** Verificá que subir el límite de archivos no haya abierto la puerta a cuerpos enormes en todos lados.

---

## 4. Los tres experimentos de quitar-la-corrección

Elegí **tres** caminos entre los que esta ronda tocó, y por cada uno:

1. Identificá la corrección que lo sostiene.
2. Quitala.
3. Corré el test que dice cubrirlo, **con la montura real**.
4. **Tiene que ponerse en rojo.** Si pasa igual, ese camino no está sostenido.
5. Restaurá, verificá diff cero y `node --check`.

Anotá **cuáles hiciste y cuáles quedan para la próxima**, para que la rotación se sostenga entre rondas.

---

## 5. Los barridos · **repartilos, si podés**

Esta orden te pide **dos listas propias**, y en las últimas rondas te vengo pidiendo entre tres y cinco. **Son independientes, de sólo lectura, y no comparten nada.**

**Repartilas en sub-agentes.** Está confirmado que tu entorno lo permite. Es la parte más lenta y la primera que se recorta cuando aprieta el reloj — el ciclo 21 entregó un experimento de nueve por eso.

| # | Barrido | La pregunta | La tabla |
|---|---|---|---|
| **B1** | Todos los extremos del servidor que **crean** algo | ¿Qué pasa si lo llama el rol equivocado? | extremo · quién debería poder · quién lo verifica · qué pasa hoy |
| **B2** | Todos los lugares donde vive un **límite** | ¿Está declarado una vez o repetido? | límite · dónde se declara · quiénes lo consumen · ¿coinciden? |

**Y lo que NO se reparte, que es más importante que lo que sí:**

- **Los experimentos de quitar la corrección, nunca en paralelo.** Modifican un archivo y tienen que restaurarlo. Dos a la vez sobre el mismo árbol se pisan, y el peor caso no es que fallen: es que **uno restaure el respaldo del otro** y el código quede con una corrección ausente que nadie nota. Un defecto introducido por la herramienta de verificación es el peor defecto posible.
- **Arrancar servidores, nunca en paralelo.** Fue la causa de los dos días del ciclo 20: huérfanos en el 8136 y esperas a procesos que no terminaban. N tareas paralelas son N servidores en N puertos.
- **Redactar el reporte, uno solo.** Tus mejores hallazgos no fueron defectos sueltos sino **formas que cruzan rondas**: *"es la misma forma que el probador del ciclo 16, del otro lado"*, *"los tests arman a mano el estado que la aplicación no produce"*. Eso sale de que una sola cabeza sostenga la ronda entera. Cinco informes parciales pegados dan cinco descripciones correctas y **ninguna** de esas frases — y esas frases son las que corrigieron el rumbo del proyecto.

Si por lo que sea no podés repartirlos, hacelos igual **como tareas separadas** con su tabla cada una.

### Y contame cómo te fue · **es la primera vez y lo pide el Jefe de Contrataciones**

Sección corta en el reporte: cuántos sub-agentes lanzaste y para qué, qué te sirvió y qué te estorbó, si alguno volvió con algo inútil o duplicado, qué habrías repartido y no se podía, y cuánto tardó la ronda comparada con la anterior.

**No hay respuesta correcta.** Si la conclusión es que no sirvió, esa es la información que hace falta.

---

## 6. Regresiones

Todo lo anterior, con la batería completa. Con atención especial a lo del ciclo 21, porque esta ronda toca la creación y el transporte de archivos:

- Los **9 caminos** en verde, y **ningún test tocado** para que pasen. Mirá el diff de `tests/`.
- La versión que devuelve una escritura llega a la vista; el 409 distingue *"otro operador"* de *"vos en otra pestaña"* (ADR-042).
- Una sola capa de variables: **un `:root`**, cero colores a mano fuera de ella.
- El arranque honesto, la marca de administrador, el anti-encierro, la clave provisoria en pantalla.
- Bienes y servicios contra el generador real.

---

## 7. El reporte — `AUDITORIA-CICLO-22.md`

Misma estructura. Cuatro secciones propias:

```
## Los siete roles contra la puerta de creación
Uno por fila: qué mandé, qué contestó.

## Mi lista de puertas contra la suya
Cada extremo que crea algo: quién puede, quién lo verifica.

## El archivo de 20 MB, medido
Tiempo, memoria, dos simultáneas, y el byte a byte del archivo guardado.

## Los tres experimentos, y cuáles quedan
Qué quité, qué test corrí, rojo o verde. Y la rotación para la próxima.
```

Cierre: un solo commit, `Auditoria ciclo 22`, sin push.

---

## 8. Qué se espera de vos

**Encontrar las puertas que nadie cerró, antes de que las encuentre una persona usando el sistema.**

El agujero de esta ronda —cualquiera podía originar un requerimiento— llevaba veintiuna rondas ahí, se veía leyendo cuarenta líneas de `expedientes.js`, y no lo encontró ni un test ni una auditoría. Lo encontró el Jefe de Contrataciones porque **se preguntó si tenía que poder hacer lo que acababa de hacer**.

Esa es la pregunta que quiero que le hagas a cada extremo del servidor: **no "¿anda?", sino "¿quién debería poder, y quién lo comprueba?"**.

Y sos el indicado: tus mejores hallazgos de este proyecto salieron de leer con desconfianza, no de ejecutar.
