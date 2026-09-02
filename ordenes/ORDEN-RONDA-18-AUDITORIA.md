# ORDEN DE AUDITORÍA — CICLO 18

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **el cierre de H21** y **la revisión de valores por omisión (ADR-038)**, según `ordenes/ORDEN-RONDA-18.md`
Emitida: 2026-09-02

---

## 0. Tu rol

Valen `ORDEN-RONDA-04-AUDITORIA.md` §0 y §1, la verificación de conducta de `ORDEN-RONDA-05-AUDITORIA.md` §1, el control de entrega, `MOTIVOS.md` al día, y la integridad de la bitácora sobre **38 ADRs**.

### Tu ciclo anterior

Fue el mejor que hiciste. Corriste la batería entera como se te pidió, encontraste **los cuatro** hallazgos altos con reproducción exacta, barriste la carpeta de datos entera buscando la clave provisoria, probaste los tres caminos de encierro del administrador, y mediste la importación con archivos de verdad hasta que dejó de terminar. Y dijiste lo que pensabas en la última línea, que era lo que se te había pedido.

Los cuatro altos eran, además, **las cuatro cosas que la orden había nombrado con nombre propio**. Eso es exactamente lo que se busca: que la auditoría mida lo que la orden prometió, y no lo que resulte más fácil de medir.

**Y ahora lo que se te pasó**, porque es lo que va a organizar esta ronda.

En tu tabla del primer arranque escribiste, sobre la clave provisoria: *"Se muestra una sola vez en stdout ✔"*. La pregunta que te hice era: *"¿imprime la clave una vez, **de forma que no se pueda pasar por alto**?"* — y lo que hay son cuatro líneas con prefijo de máquina (`SGC-SERVIDOR-ADMINISTRADOR-CLAVE-PROVISORIA ...`) en medio de la salida de arranque.

Verificaste **una vez**. El requisito era **imposible de pasar por alto**. Son dos cosas distintas, y la segunda no se contesta con un programa: se contesta mirando.

La culpa del formato de la pregunta es mía y ya la corregí. Lo que te toca a vos es la regla: **cuando un requisito tiene dos condiciones, se verifican las dos, y la que es de percepción se verifica como persona.**

### Lo que vos no levantaste y sí importa · y es el eje de esta ronda

En tres lugares distintos de la misma ronda, **el comentario del código enunciaba la regla correcta y el código hacía otra cosa**:

| Archivo | El comentario dice | El código hace |
|---|---|---|
| `padron-inicial.js:56-58` | *"…o null si …falta la configuración del administrador"* | Nunca devuelve null: completa con defaults |
| `eventos.js:276` / `sugerencias.js:53` | *"la marca de administrador **también** ve el compendio"* | La marca es inalcanzable: devuelve `true` por rol antes |
| `padron-csv.js:169-171` | *"el anti-encierro se chequea **SIEMPRE** respecto de lo que la importación dejaría al final"* | Se chequea sólo si queda exactamente un administrador |

Vos encontraste los tres defectos **ejecutando**. Ninguno lo encontraste leyendo, y no podías: los comentarios decían lo correcto. El informe del desarrollador repetía la versión del comentario.

Eso es, en estado puro, **la razón por la que existís como agente separado**. Y también te da la tarea nueva de esta ronda: además de romper, **contrastar lo que el código dice de sí mismo contra lo que hace**.

### Accesos fuera del repositorio

`auditoria\bateria\`; `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\` en **sólo lectura**, con permiso de ejecutar `scripts/generar_pliego.py` hacia una carpeta temporal; `os.tmpdir()` y `127.0.0.1`. Nada más.

---

## 1. Verificación de conducta

Los ocho de siempre, y **la batería completa**, con `MOTIVOS.md` actualizado.

---

## 2. El arranque · y la verificación que hacés como persona

- **Sin bloque `administrador` en la configuración** → tiene que **no arrancar**, y el mensaje tiene que nombrar el campo que falta y el archivo donde ponerlo. Probá también: bloque incompleto (falta `nombre`, falta `apellido`, falta `email`, falta `rol`, uno por vez), `email` inválido, `rol` inexistente, `rol` con espacios, campos vacíos, campos con espacios, campos que no son texto.
- **El caso que no puede romperse**: configuración **sin** bloque `administrador` **sobre una carpeta de datos que ya tiene padrón** → **tiene que arrancar normal**. Si esto falla, la corrección rompió todas las instalaciones existentes, y es hallazgo alto.
- **Nada se escribe antes de fallar.** Si el arranque rechaza la configuración, la carpeta de datos tiene que quedar **exactamente como estaba**. Barrela y comparala.
- **`instalar.sh`**: corrélo sin los datos del administrador y verificá que **falle pidiéndolos** en vez de escribir un `servidor.json` incompleto. Y corrélo con los datos, y verificá que el archivo que escribe **arranca**. Leé también `INSTRUCTIVO.md`: si el ejemplo trae un correo que alguien podría copiar tal cual, decilo.
- **¿Sigue habiendo alguna clave por omisión?** Buscala otra vez: en el código, en la configuración, en el instalador, en el instructivo, en los tests. Alta, sin discusión.

### El recuadro · esto lo verificás mirando, no midiendo

Arrancá el servidor sobre una carpeta vacía **en una terminal**, y **pegá en tu informe la salida completa del arranque, tal como sale**, sin recortar.

Después contestá dos preguntas separadas:

1. **¿La clave aparece una sola vez?** (medible)
2. **¿Alguien que mira esa consola por primera vez, sin saber qué busca, la ve sin buscarla?** (de percepción)

Para la segunda, el criterio: el recuadro tiene que estar **enmarcado**, con líneas en blanco antes y después, **en castellano**, y ser **el último bloque de la salida** — después del puerto, no antes. Si está pero quedó tapado por veinte líneas de arranque posteriores, **es un no**, aunque técnicamente esté.

Y verificá que **la clave sigue sin quedar en ningún archivo**: barré la carpeta de datos entera y el registro, como hiciste el ciclo pasado. Sólo el hash.

---

## 3. La marca de administrador · el `return true` que tenía que salir

- **`contrataciones_supervisor` sin marca**: `403` en el compendio de eventos **y** en el de sugerencias. Probalo con los dos supervisores del padrón.
- **Administrador que no es supervisor**: ve los dos compendios, administra el padrón, repone claves — **y no publica plantillas** (ADR-032 §5).
- **Desde la pantalla, con sesión real.** El auditor del ciclo pasado anotó que `GET` sin cuerpo daba `403` hasta para el administrador, y que por eso la aplicación real nunca llegaba al compendio. La orden pide arreglar el picaporte junto con la puerta: **entrá como administrador, abrí la pantalla, y mirá si el compendio aparece.** Si sólo funciona con una petición armada a mano, la corrección está a medias.
- **Una sola función.** La orden pide unificar la lógica duplicada en `eventos.js` y `sugerencias.js`. Si quedaron dos, verificá que digan lo mismo — y si dicen lo mismo, decí que sobra una.

---

## 4. La importación · el mismo ataque del ciclo pasado, más los casos nuevos

**Repetí todo lo que hiciste el ciclo 17**, sin recortar: el diff con sus tres partes, todo o nada con la línea mala en las tres posiciones, la ausencia que no desactiva, la importación que no toca credenciales, BOM, `CRLF`, `LF`, línea vacía final, línea de sólo punto y comas, PDF renombrado, JSON, archivo vacío, y los siete roles contra el servidor.

Y los de esta ronda:

### 4.1 — El campo `activo`

Uno por fila, con lo que salió: `si`, `sí`, `SÍ`, `Sí`, ` si `, `s`, `S`, `true`, `TRUE`, `1`, `x`, `verdadero`, `no`, `NO`, `n`, `false`, `0`, `falso`, vacío, ausente (línea de cinco campos), `tal vez`, `-`, `null`, `sí ` con espacio final, y `si` con un carácter invisible pegado.

**El que importa**: cualquier valor fuera del vocabulario tiene que ser **error de línea** y no aplicar nada. Si alguno cae en `false` en silencio, es el mismo defecto con otra cara — y **el valor por omisión de un booleano de identidad que desactiva a una persona es hallazgo alto**, no medio.

### 4.2 — El anti-encierro sobre el estado final

- **Dos administradores activos**, importación con `desactivarAusentes` que omite a los dos → `422`, y el padrón **intacto** (verificalo en el archivo, no en la respuesta).
- Lo mismo con los dos traídos como `activo: no`.
- Lo mismo con **uno omitido y el otro desactivado** — el caso mixto, que es el que se escapa de las guardias escritas a mano.
- **Tres administradores**, importación que desactiva a dos → tiene que **aplicarse**.
- Dos administradores, importación que desactiva a **uno** → tiene que aplicarse.
- Y por API directa, no sólo por pantalla.
- **Una sola guardia**: la orden pide que `padron-csv.js` y `padron-administracion.js` usen la misma función sobre el padrón resultante. Si quedaron dos implementaciones, buscá el caso donde difieren — porque va a existir.

### 4.3 — La ida y vuelta, campo por campo

Exportá el padrón real de catorce personas, importalo sin tocar nada, y **compará el archivo `padron.json` antes y después, byte a byte si hace falta**. No puede cambiar nada: ni `activo`, ni `sector` vacío, ni la marca de administrador, ni las credenciales.

Después meté en el padrón, por la pantalla, personas con: un nombre que empieza con `=`, otro con `+`, otro con `-`, otro con `@`, un apellido con `;`, uno con comillas dobles, uno con tilde y eñe, uno con un salto de línea si el formulario lo deja. **Exportá, mirá el CSV crudo** —¿están neutralizados?—, **abrilo en una planilla si podés**, y **volvé a importarlo**: el padrón tiene que quedar idéntico al original.

Neutralizar rompiendo el dato no sirve. Es el punto: la ida y vuelta tiene que ser **exacta**, no aproximada.

### 4.4 — El correo y las mayúsculas

- `Juan@faa.mil.ar` importado sobre un padrón con `juan@faa.mil.ar` → **la misma persona**, no un alta.
- Dos capitalizaciones del mismo correo **dentro del mismo archivo** → error de línea.
- Y la parte que importa de verdad: **¿se puede entrar con el correo en mayúsculas?** Probá el ingreso, la sesión, la atribución en el registro de auditoría y la reposición de clave. Si el padrón normaliza pero el ingreso no, la persona no puede entrar y el sistema no se lo va a explicar.

### 4.5 — El tope

- 501 líneas → rechazo, con mensaje que diga el número y el máximo.
- 500 líneas → **tiene que entrar**, y **cronometralo**. Si tarda más de lo razonable, decilo con el número.
- Y volvé a medir las 2.000 líneas que el ciclo pasado tardaban 154 segundos: ahora tienen que rebotar en el tope, no tardar.

---

## 5. La revisión de ADR-038 · leé lo que dice el código de sí mismo

Esta sección es nueva y es la que distingue esta auditoría.

### 5.1 — Los comentarios contra el código

**Recorré `server/` buscando comentarios que enuncien una regla** — los que dicen *siempre*, *nunca*, *sólo*, *en todos los casos*, *antes de*, *no se puede*. Por cada uno, **una pregunta**: ¿el código de abajo hace eso?

Los tres del ciclo pasado están arriba. **Buscá los que quedan.** Y por cada regla enunciada en un comentario, la orden pide un test que falle al quitarla: **verificá que exista**, y si existe, **quitá la regla y mirá si el test falla de verdad**. Un test que pasa igual con la regla quitada no sostiene nada.

Esto vale también para los **nombres de función** y para el **informe del desarrollador**: `esJefe` prometía una cosa y hacía otra; el §1.6 del informe del ciclo 17 describía una guardia que no existía como estaba descripta. **Si el informe de esta ronda afirma algo que el código no hace, es hallazgo, y de los que más pesan.**

### 5.2 — Los valores por omisión

La orden pide recorrer `server/` entero contra las tres familias de ADR-038 —identidad, facultad, guardia— y escribir la lista en el informe, **incluidos los que se dejaron y por qué**.

**Hacé tu propia lista, sin mirar la de él primero**, y después compará. Lo que aparezca en la tuya y no en la suya es lo que buscamos. Por cada uno, la pregunta de la ADR: *si este valor por omisión estuviera mal, ¿alguien se daría cuenta?*

---

## 6. Regresiones · con más cuidado que nunca, porque esta vez sí se instala

**Todo lo anterior.** Matriz 18 × 7 con sus escenarios laterales, recorrido de los 18 estados, concurrencia de `PUT` y de numeración, adjuntos, archivado, recuperación ante desastre **con el padrón y las plantillas adentro**, ida y vuelta del YAML con los cuarenta textos, registro de eventos, guardias de ADR-029, el padrón vivo cortando sesiones.

Y lo que se cerró el ciclo pasado, **porque es lo que más caro sale que se rompa ahora**:

- **Publicar sin probar**: repetí las cinco variantes del ciclo 17, incluido el reinicio. Si volvió, es la quinta vía y es alto.
- **El pliego de servicios**: armalo por la vía real, exportá, **corré el generador de verdad**. Y el de bienes también.
- **El probador**: ¿sigue armando su ejemplo con la función de exportación real, o alguien volvió a fabricar campos?

---

## 7. El reporte — `AUDITORIA-CICLO-18.md`

Misma estructura. Cinco secciones propias:

```
## La salida del primer arranque, pegada entera
Y las dos respuestas: ¿aparece una vez? ¿se ve sin buscarla?

## Lo que el código dice de sí mismo
Comentarios, nombres e informe contra el comportamiento. Una fila por caso.

## Los valores por omisión que encontré yo
Mi lista contra la suya. Lo que falta en la suya.

## La ida y vuelta del padrón
Antes y después, campo por campo, con los textos raros adentro.

## ¿Se puede instalar?
Tu recomendación, en una línea, con lo que la sostiene.
```

**Sobre la última**: el Jefe de Contrataciones ya está probando la aplicación en su propia máquina, esquivando a mano los cuatro defectos del ciclo pasado. Tu recomendación de esta ronda es sobre **instalarla para las catorce personas de la División**. Decilo pensando en eso, y decí lo que pensás.

Cierre: un solo commit, `Auditoria ciclo 18`, sin push.

---

## 8. Qué se espera de vos

Dos cosas.

**Que verifiques como persona lo que se percibe como persona.** El recuadro de la clave es el caso testigo, y no es el único: un mensaje de error que no dice dónde poner el dato que falta, un rechazo que no nombra el campo, un diff que técnicamente muestra todo pero no se entiende. Todo eso es funcionalidad, y ningún test lo mide.

**Y que leas el código contra sí mismo.** La ronda pasada te dio tres casos en los que el comentario decía lo correcto y el código hacía otra cosa, y los tres los encontraste ejecutando, de casualidad. Esta vez andá a buscarlos derecho.

La pregunta que guía esta auditoría: **¿queda algún lugar donde el sistema prometa una garantía que no da?**
