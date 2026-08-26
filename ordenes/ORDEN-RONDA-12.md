# ORDEN DE TRABAJO — RONDA 12

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hitos cubiertos: **H13 (cierre)** · **H15 — Observabilidad y tableros de indicadores por rol**
Emitida: 2026-08-25

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`.

La ronda 11 logró lo más difícil: **el generador de pliegos de la UOC produce el pliego con el archivo que emite la aplicación, sin edición manual.** La cadena documental cierra. Y ADR-029 quedó cerrada de verdad: las tres guardias corregidas más **dos que encontraste vos** y que yo no había listado.

Dos cosas más que quiero nombrar:

- **Partir el límite del encabezado en `cotas-encabezado.js`** en vez de inflar `config.js` fue la decisión correcta, y por la razón correcta.
- **Volviste a declarar tus discrepancias** —las 15 cotas contra las 14 que decía mi orden, el `CAUSAL_OCA` dual, la copia de referencia legal en el render—. Es la cuarta ronda seguida con un informe que se puede leer como si fuera cierto, y eso es lo que hace que este sistema funcione.

**H13 no cierra todavía**, y las razones están abajo. Ninguna es rehacer nada.

### Accesos fuera del repositorio

`os.tmpdir()`, puertos locales `127.0.0.1`, y **sólo lectura** sobre `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\`, con permiso de ejecutar `scripts/generar_pliego.py` **dirigiendo la salida a una carpeta temporal**. No se escribe nada dentro de esa carpeta. Nada más.

---

## 1. Alcance

Dos cosas:

1. **Cerrar H13** — siete correcciones, dos de ellas con ADR propia.
2. **H15 — observabilidad y tableros por rol.** Va ahora y no después por una razón que no se puede recuperar: **el dato que no se registra durante el piloto no existe nunca.** El UAT es en dos ciclos.

---

## 2. Correcciones · cierre de H13

### 2.1 — El emisor de YAML entrecomilla siempre · **ADR-031**

Leé ADR-031 antes de tocar esto.

Tu emisor decide cuándo entrecomillar con una lista de patrones. El auditor encontró dos agujeros. **Al reproducirlo contra el parser de Python —el que usa el generador real— son siete de veinte:**

| Texto cargado | Llega al pliego | |
|---|---|---|
| `comment #10 is here` | `comment` | `RE_HASH = /#\s/` está al revés: en YAML el comentario empieza en un `#` **precedido** de espacio, no seguido |
| `#comentario` | *(nada)* | misma causa |
| `   ` (sólo espacios) | *(nada)* | |
| ` hola` | `hola` | pierde el espacio inicial |
| `hola ` | `hola` | pierde el espacio final |
| `Nota:` | — | **rompe el archivo entero: el pliego no se genera** |
| un tabulador dentro del texto | — | **rompe el archivo entero** |

Los dos últimos son de otra clase: no corrompen un valor, **impiden que el pliego exista**. Y un texto que termina en dos puntos —*"Observaciones:"*, *"Renglones a proveer:"*— lo escribe cualquiera sin pensarlo.

**No corrijas los siete casos.** La lista nunca va a estar completa: cada texto nuevo que rompa va a agregar un patrón y va a seguir incompleta. Se invierte la regla:

- **Todo escalar de tipo cadena se emite entre comillas dobles, siempre.**
- **`necesitaEscapar` se elimina**, no se corrige.
- El escapado queda como único punto delicado, y es corto: barra invertida, comilla doble, salto de línea, tabulador, retorno de carro. **La barra invertida primero**, o se escapan las escapadas.
- Las claves siguen sin comillas: las controlamos nosotros.

**Y la verificación no es un test unitario del emisor.** Es **ida y vuelta**: emitir, parsear con un parser de verdad, y comparar el valor que vuelve —carácter por carácter, espacios incluidos— con el que se cargó. Los veinte casos de arriba, más los que se te ocurran. **La tabla del informe tiene que ser la salida de ese programa, no una lista revisada a ojo.**

### 2.2 — Hay dos pliegos, y uno tiene que dejar de serlo · **ADR-030**

`renders/pliego-bases-condiciones.js` es una plantilla nuestra del ciclo 7, hoy **entregable obligatorio** de un estado (`config.js:138`): el sistema exige generarla para avanzar. No menciona la Orden de Compra Abierta en ninguna parte. Y el pliego real lo produce el generador de la UOC con nuestro YAML.

**Dos documentos con el mismo nombre y distinto contenido es una trampa de expediente**, y alguien va a presentar el equivocado creyendo que es el bueno.

- `pliego-bases-condiciones` **sale de `ENTREGABLES`** y de los `entregablesObligatorios` de ese estado.
- **El entregable de ese estado pasa a ser el YAML**, junto con el ANEXO 1 y el anexo de EETT.
- La plantilla se conserva como **`vista-previa-pliego`**, sin estado asignado, rotulada arriba de todo *"Vista previa — no es el Pliego de Bases y Condiciones"*, y **sin pie de firma**: un documento que no se firma no lleva pie de firma, ni la leyenda de ADR-023.

Van a saltar varios tests que dan por sentado ese entregable. Es esperable: arreglalos, no ablandes la regla.

### 2.3 — El precio de referencia se deriva, no se tipea

En `views/anexo-uno.js` el campo de precio del ANEXO 1 §2 es un input de texto libre. Mi orden decía: *"el monto es el preventivo que ya calculamos. No se vuelve a tipear."*

Retipear un número que el sistema ya calculó reintroduce el *garbage in* que este proyecto viene a resolver, y además crea la posibilidad de que el ANEXO 1 declare un precio de referencia distinto del que sale del requerimiento firmado.

- El monto sale de `requerimiento.preventivoContratacion`.
- Las **empresas consultadas** salen de los presupuestos adjuntos.
- Si tiene que poder corregirse a mano, que se pueda — **pero entonces queda registrado como corrección, con el valor calculado a la vista.**

### 2.4 — La precarga del ANEXO 1 es editable pero trazable

Hoy se guarda en `datos.anexo1` sin registrar qué cambió respecto del requerimiento. Un ANEXO 1 que contradice al requerimiento **sin que nadie se entere** es un problema de expediente, no de software.

Toda edición de un campo precargado se registra: qué campo, valor del requerimiento, valor puesto en el ANEXO 1. Esto **se alinea con el registro de eventos de §3**, así que hacelo con el mismo mecanismo y no con uno aparte.

### 2.5 — El test de integridad tiene que fallar

`tests/ronda-11.test.js` verifica que los archivos del MANIFEST existan en disco. Mi orden pedía otra cosa, con estas palabras: *"verificá que ese test falle si sacás un módulo de la lista"*.

Un test de integridad que pasa siempre es peor que ninguno, porque da confianza falsa. Sacá un módulo de `APP_CORE`, llamá a `verificarModulos`, y verificá que **lanza** con el mensaje correcto. El auditor ya escribió ese test y funciona; el tuyo tiene que hacer lo mismo.

### 2.6 — `CAUSAL_OCA`: dos textos, dos nombres

Hay dos constantes con el mismo nombre y distinto texto: la nota operativa que ve el usuario en pantalla (`core/requerimiento.js`) y la cita normativa que va al impreso (`renders/requerimiento.js`).

**Lo declaraste, y la decisión de tener dos textos es correcta**: son dos cosas distintas. Lo que está mal es que se llamen igual — es la historia de `MAX_ACLARACION` otra vez. Dos nombres distintos (`NOTA_OCA` y `CAUSAL_OCA_NORMATIVA`, o lo que prefieras), **definidos en un solo lugar**, y el render importa el que le toca.

### 2.7 — Tres campos del YAML sin mapear

`frecuencia_provision`, `plazo_entrega` y `horario` no se mapean desde el ANEXO 1 §4 y §7. El pliego sale igual, **con esas cláusulas en blanco** — y un pliego con cláusulas en blanco parece completo, que es peor que uno que no sale.

Mapealos. Y para los campos que genuinamente no tenemos —`nro_expediente_gde`— que el YAML deje ver que **falta el dato**, no que el dato es vacío. Decidí cómo y documentalo.

---

## 3. H15 — Observabilidad y tableros por rol

Leé **ADR-024** completa. Va ahora porque el UAT es en dos ciclos y **el dato que no se captura durante el piloto no se recupera después**.

### 3.1 — El registro de eventos

Un `eventos.jsonl` **append-only por expediente**, escrito por el servidor con la misma escritura atómica del resto. Una línea JSON por evento. Texto plano, se lee con cualquier cosa, y no obliga a decidir hoy qué columnas van a importar mañana.

Se registra **más de lo que los indicadores definidos necesitan** (ADR-024 §1):

- toda transición, con estado origen y destino, rol, correo, máquina y marca de tiempo;
- toda devolución, con motivo y observación;
- toda edición, por **grupo de campos** (no el contenido), con versión anterior y nueva — **incluidas las ediciones sobre la precarga del ANEXO 1 (§2.4)**;
- todo conflicto de versión (409) y todo rechazo (403, 400), con la razón;
- toda generación de entregable y toda exportación, **incluida la del YAML**;
- altas y bajas de renglones, y cada uso del campo `aclaracion` con su longitud;
- **búsquedas de catálogo sin resultado** — es el indicador más honesto de que el catálogo no alcanza;
- permanencia por paso, en granularidad gruesa;
- la `catalogoVersion` y la versión de la aplicación vigentes en el momento del evento.

Y uno que sale de ADR-028 y cuesta una columna: **`areaSolicitante` por renglón**, opcional, texto libre — quién pidió esto. Con su evento.

### 3.2 — Ningún indicador se persiste calculado

Todos se derivan del registro al mostrarlos. Un indicador nuevo sobre datos viejos tiene que ser posible; un indicador nuevo sobre datos que no se capturaron, no.

### 3.3 — Fichas declarativas, no una pantalla fija

Un **catálogo de fichas de indicador**, cada una con su definición declarativa: qué evento, qué agregación, qué corte. **Agregar una ficha no puede requerir tocar la vista.**

### 3.4 — Cada rol arma su tablero

- Qué fichas ve y en qué orden, **guardado en el padrón junto al operador**, no en el navegador. Una PC compartida no debe imponerle el tablero de un rol al siguiente que se siente.
- **Un tablero por defecto por rol**, para que nadie tenga que configurar nada el primer día.

### 3.5 — Vista de exploración

Filtrar el registro de eventos y exportarlo a CSV y JSON. Es lo que permite que dentro de seis meses aparezca un indicador que hoy no se nos ocurre, y lo que alimenta el análisis por IA, que es un objetivo declarado del proyecto.

### 3.6 — Los indicadores de arranque

Tiempo por fase, tiempo total, tasa de devolución por motivo y por sector, renglones con aclaración por rubro, **búsquedas sin resultado**, **dispersión entre presupuestos de un mismo renglón**, y **renglones por área solicitante y sin origen declarado**.

Más un aviso suave en la carga: cuando los valores de referencia de un renglón difieren más de un umbral configurable, se marca **sin bloquear**.

### 3.7 — El registro de eventos es dato sensible

Tiene contenido operativo sobre personas identificadas. Entra en la advertencia previa a toda descarga (H7-6) y se dice con todas las letras en la pantalla de exploración.

---

## 4. Tests

Conservando en verde todo lo anterior, en un clon limpio:

1. **Ida y vuelta del YAML**: los veinte textos, emitidos, parseados y comparados carácter por carácter. La tabla es la salida del programa.
2. Un valor que termina en `:` y un valor con tabulador **no rompen** el archivo.
3. Espacios al principio y al final **sobreviven**.
4. `pliego-bases-condiciones` **no es entregable obligatorio** de ningún estado, y `vista-previa-pliego` no lleva pie de firma ni leyenda de ADR-023.
5. El precio de referencia del ANEXO 1 **coincide** con `preventivoContratacion`; si se corrige a mano, queda registrado.
6. Editar un campo precargado del ANEXO 1 **produce un evento** con campo, valor del requerimiento y valor nuevo.
7. El test de integridad **falla** al quitar un módulo de `APP_CORE`.
8. `frecuencia_provision`, `plazo_entrega` y `horario` llegan al YAML desde el ANEXO 1.
9. El registro de eventos es **append-only**: dos escrituras concurrentes no pierden ninguna línea.
10. Un indicador se calcula **desde el registro**, no desde un valor persistido.
11. Agregar una ficha nueva **no requiere tocar la vista**.
12. La preferencia de tablero **vive en el padrón** y no en el navegador: dos operadores en la misma PC ven tableros distintos.
13. La suite completa termina en verde de una sola pasada.

---

## 5. `INFORME-RONDA-12.md`

Las nueve secciones. En la §2, tres cosas explícitas:

- **la tabla de ida y vuelta del YAML**, generada por el programa;
- **cómo señalás un campo que falta** contra uno que está vacío legítimamente;
- **qué eventos registrás y cuáles descartaste**, con el motivo. Lo que no se registre ahora no se recupera.

---

## 6. Reglas de conducta y cierre

Las siete de `ORDEN-RONDA-01.md` §3. Documentación de sólo lectura: **ADR-021 a ADR-031, las órdenes y `referencias/pliego/`.**

```
node --test                      # verde, una sola pasada
node tools/check-compat.js       # salida 0
git add -A
git commit -m "Ronda 12 - Cierre de H13 y H15 observabilidad"
git push
git log --oneline -1             # tu commit tiene que estar
git status --short               # tiene que volver vacío
git log origin/main --oneline -1 # tiene que ser el MISMO commit
```

**El último comando es el que dice que el trabajo llegó a GitHub.** Si no coincide con el primero, el auditor no va a ver nada.

---

## 7. Criterios de aceptación

| # | Verificación | Resultado exigido |
|---|---|---|
| 1 | `node --test` en clon limpio, una sola pasada | Verde |
| 2 | `node tools/check-compat.js` | Salida 0 |
| 3 | YAML: ida y vuelta de los 20 textos | **20 de 20**, carácter por carácter |
| 4 | `necesitaEscapar` | Eliminada, no corregida |
| 5 | Valor terminado en `:` y valor con tabulador | No rompen el archivo |
| 6 | `pliego-bases-condiciones` | No es entregable obligatorio; la vista previa está rotulada y sin pie de firma |
| 7 | El generador real sigue produciendo el pliego | Sin edición manual |
| 8 | Precio de referencia del ANEXO 1 | Derivado; corrección manual registrada |
| 9 | Trazabilidad de la precarga | Evento por cada campo editado |
| 10 | Test de integridad del núcleo | **Falla** al quitar un módulo |
| 11 | `CAUSAL_OCA` | Dos nombres distintos, un solo lugar |
| 12 | Campos del YAML | Los tres mapeados; los que faltan se ven como faltantes |
| 13 | Registro de eventos | Append-only, sin pérdida bajo concurrencia |
| 14 | Indicadores | Derivados del registro, ninguno persistido calculado |
| 15 | Fichas | Agregar una no requiere tocar la vista |
| 16 | Tablero por operador | Guardado en el padrón, no en el navegador |
| 17 | Archivos sobre 400 líneas | Ninguno |
| 18 | `INFORME-RONDA-12.md` | Completo |

---

## 8. Qué se está evaluando

Dos cosas de naturaleza distinta.

La primera es **que un texto escrito por un operador no pueda romper el pliego**. La ronda pasada lo dejó a merced de una lista de patrones; esta ronda tiene que volverlo imposible, no infrecuente. Es la misma lección de ADR-029: **lo que falla en silencio se elimina como clase, no como caso.**

La segunda es **que dentro de un año podamos contestar una pregunta que hoy no se nos ocurre**. Todo lo demás del proyecto se puede rehacer; el registro del primer año de operación real se captura una sola vez o no existe nunca.

Pesa, en este orden: (1) la ida y vuelta del YAML, (2) que el registro de eventos capture de más y no de menos, (3) la decisión del pliego, (4) el precio derivado y la trazabilidad, (5) los tableros por rol.
