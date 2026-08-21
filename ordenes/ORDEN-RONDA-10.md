# ORDEN DE TRABAJO — RONDA 10

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hitos cubiertos: **H11 (cierre) — pantalla de carga del requerimiento** · **H12 — EETT con regla de desborde**
Emitida: 2026-08-20

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`.

El ciclo anterior se aprobó. El cálculo del preventivo quedó verificado dos veces por caminos independientes —cinco casos manuales del auditor, otro conjunto tuyo— y **no se encontró ninguna combinación de presupuestos y bases que produzca un número incorrecto sin que algo avise**. Las tres correcciones arrastradas están cerradas y la suite entera termina en verde de una sola pasada. Partir la matriz en dos archivos en vez de subir tiempos límite a mano fue la decisión correcta.

Dos cosas de tu informe que quiero nombrar, porque de las dos sale esta ronda:

1. **Tu §5 abrió esta orden.** Escribiste que no habías tocado el wizard y que la pantalla de carga *"es la pieza que falta para que el usuario final cargue los datos"*. Es exacto: hoy el modelo, el cálculo y el servidor están terminados, y un operador no puede cargar un requerimiento. Por eso H11 quedó en 70% y por eso la pantalla es el primer entregable de esta ronda. Declararlo en "Qué NO hice" vale más que haberlo tapado detrás de un criterio cumplido.
2. **La validación estricta del base64** —porque `Buffer.from` decodifica basura en silencio— es el tipo de detalle que nadie te pidió y que cierra una puerta real.

### Un hallazgo del auditor, y no es culpa tuya

`MAX_ACLARACION` sigue en **200** en cuatro archivos, contra la enmienda de ADR-014 que dice **256**. El auditor lo marcó como severidad media y tiene razón: un operador que transcribe una aclaración de 230 caracteres del sistema oficial recibe hoy un error injustificado.

**No lo pediste ni lo rompiste**: el cambio a 256 estaba planificado en H12-1, que es esta ronda. Lo señalo para que quede claro que el hallazgo es real y la conducta también. Se corrige acá, junto con la regla de desborde, que vive en el mismo campo.

### Una corrección de vocabulario que sí te toca

Se incorporó **ADR-023**. Lee su §4 y §5 antes de escribir un solo texto de interfaz. En síntesis: **esta aplicación no autoriza, no imputa y no adjudica**. Genera documentos, registra tiempos y sigue procesos. Lo que hace el servidor es **validar y registrar**, no conceder facultades. El código está bien; los textos que ve un operador, no.

### Accesos fuera del repositorio

`os.tmpdir()` y puertos locales `127.0.0.1`. Nada más.

---

## 1. Alcance

Tres cosas, y las tres tocan el mismo campo y la misma pantalla:

1. **La pantalla de carga del requerimiento** — cerrar H11.
2. **El anexo de Especificaciones Técnicas con la regla de desborde** — H12.
3. **La leyenda y el vocabulario de ADR-023** — en interfaz y en entregables.

**Fuera de alcance:** el ANEXO 1 y la emisión del YAML (H13, ciclo siguiente). **Y los estilos**: siguen al final del roadmap. Esta ronda es función, no cosmética — pero la pantalla tiene que ser *usable*, que no es lo mismo que linda.

---

## 2. Corrección arrastrada

### 2.1 — `MAX_ACLARACION` a 256

En los cuatro archivos donde vive (`app/js/core/validacion.js`, `app/js/catalogo/renglones.js`, `app/js/views/fasttrack.js`, `app/js/views/pasos.js`) y en los tests que verifican el 200.

**Y de paso, arreglá la causa:** que una constante de negocio esté escrita cuatro veces es lo que hizo posible el desfasaje. Debe existir **en un solo lugar** y los demás importarla. Si el orden de carga lo impide, decilo en el informe y dejá el porqué — pero primero intentalo.

---

## 3. Entregables

### 3.1 — La pantalla de carga del requerimiento · **cierra H11**

Es lo primero, porque es lo que convierte tres ciclos de trabajo en algo que alguien puede usar.

**Encabezado.** Los campos de la Solicitud de Gastos (ADR-022 §1, `ANALISIS_ENTREGABLES_REALES.md` §3.1): lugar, fecha, organismo, CUIT, unidad solicitante, rubro comercial, modalidad de compra sugerida, vigencia, procedimiento de selección sugerido, causas de contratación directa, clase, objeto, prioridad y justificación de la necesidad.

Lo que ya se pueda derivar —organismo, CUIT, unidad, lugar, fecha— **viene prellenado y editable**, no en blanco. Un formulario de dieciséis campos en blanco es un formulario que nadie completa.

**Presupuestos.** Subida desde la pantalla, con el nombre del archivo original a la vista, el tamaño, y el identificador que le asignó el servidor. Que se pueda ver cuál es cuál sin abrirlos: es el dato que después hay que citar.

- Los errores del servidor (tipo no permitido, más de 2 MB, base64 inválido) se muestran **en castellano y al lado del archivo**, no en una consola.
- Un archivo rechazado no deja la pantalla en un estado ambiguo.

**Valores de referencia por renglón.** Es la parte delicada. Por cada renglón, una fila por presupuesto con:

- el **presupuesto elegido de una lista** —no un identificador escrito a mano—. Esto cierra R-09-1: hoy un `presupuestoId` inexistente pasa la validación de forma;
- la **base**, `unitario` o `total`, como elección explícita **sin valor por defecto**. Si hay un valor por defecto, se acepta sin mirar, y ese es el defecto silencioso que la ronda anterior existió para evitar. Que el usuario tenga que decir cuál es;
- el **valor**.

Y a la vista, actualizándose: el **promedio unitario del renglón**, el **preventivo del renglón** y el **preventivo de la contratación**. El usuario firma ese número; tiene que verlo mientras lo arma, no recién en el PDF.

**Ayuda contextual donde hace falta**, no en un manual aparte: qué es la base `total`, qué es la `cantidadMaxima` (el tope **por Solicitud de Provisión**, ADR-022 §3), y la causal normativa de OCA (Art. 25 inc. c) Dec. 1023/01 y Art. 111 Dec. 1030/16) junto al campo de justificación.

**El bloque de imputación presupuestaria se muestra siempre, y en Fase 1 se muestra deshabilitado**, con la leyenda de que lo completa Contaduría en la fase de Afectación. Vacío y sin explicación parece un error del sistema.

**Reglas duras de esta pantalla:**

- El **borrador local** tiene que seguir funcionando: nadie pierde media hora de carga por cerrar el navegador (H5-3).
- La validación del cliente es **una comodidad**; el servidor sigue siendo el que gobierna. No muevas ni una regla del servidor a la vista.
- **Ningún archivo supera las 400 líneas.** Si la pantalla no entra, partila por bloque (encabezado, presupuestos, valores, OCA).

### 3.2 — El anexo de EETT con regla de desborde · **H12**

- **256 caracteres** es el límite de la aclaración que va impresa en el requerimiento (corrección 2.1).
- Cuando el texto de un renglón **supera el límite**, el requerimiento imprime `"según anexo [alfa|bravo|charly]"` y el renglón entra al anexo con **el texto completo**.
- **Bloque de condiciones particulares** comunes a todos los renglones, opcional.
- **Nomenclatura automática** de anexos: alfa, bravo, charly, y lo que siga. Decidí y documentá qué pasa cuando se acaba el alfabeto convenido.
- **Si ningún renglón desborda y no hay condiciones particulares, el anexo no se genera.** Un anexo vacío es un papel más para firmar.
- **Ficha por renglón** en el anexo: `Renglón N° | Código SIByS | Descripción ONC | Especificaciones Técnicas`.
- `renders/especificacion-tecnica.js` —que dejaste con `estado: null` justamente para esto— es la base.

**Los bordes importan y los quiero probados:** 255, 256 y 257 caracteres. Y decidí explícitamente qué es un "carácter" cuando hay acentos y eñes: la longitud de la cadena en JavaScript no es la cantidad de caracteres que ve el usuario en todos los casos. Documentá el criterio.

### 3.3 — La leyenda y el vocabulario de ADR-023

- **Leyenda obligatoria**, junto a la de ADR-016, en la pantalla del expediente, **en el pie de cada entregable generado** y en el `resumen.md` del export:

  > *Este sistema genera documentos, registra tiempos y sigue el estado del trámite. No autoriza, no imputa y no adjudica: esos actos se perfeccionan con la firma de la autoridad competente, fuera de este sistema.*

- **Barrido de textos de interfaz.** Todo mensaje que ve un operador —botones, errores 403, títulos, ayudas— que diga "autorizar", "aprobar" o "no está autorizado" pasa a decir lo que realmente ocurre: *"su rol no puede registrar esta acción en este paso"*, *"registrar la aprobación"*. La lista de reemplazos está en ADR-023 §4.
- **Los nombres internos del código no se renombran.** En jerga técnica el término es correcto y el ripple no se justifica. Lo que se corrige es lo que se lee desde afuera.

---

## 4. Tests

Conservando en verde todo lo anterior, en un clon limpio:

1. `MAX_ACLARACION` vale **256** y no queda ningún **200** en el código ni en los tests.
2. Aclaración de **255** caracteres: se imprime en el requerimiento, no genera anexo.
3. Aclaración de **257** caracteres: el requerimiento imprime `"según anexo alfa"` y el anexo lleva el texto completo.
4. Dos renglones que desbordan: entran los dos, con la nomenclatura correcta.
5. Ningún desborde y sin condiciones particulares: **el anexo no se genera**.
6. Condiciones particulares sin ningún desborde: el anexo **sí** se genera.
7. La pantalla calcula el mismo promedio y el mismo preventivo que el núcleo, sobre un caso de bases mixtas verificable a mano.
8. La base **no tiene valor por defecto**: un valor de referencia sin base declarada no se puede guardar.
9. El presupuesto se elige de la lista: no hay forma de guardar un `presupuestoId` que no exista en el expediente.
10. El borrador local sobrevive a un cierre y recupera los campos nuevos, incluidos los valores de referencia.
11. La leyenda de ADR-023 aparece en el expediente, en el pie del entregable y en el `resumen.md`.
12. Inyección en los campos nuevos del encabezado y en las condiciones particulares del anexo.
13. La suite completa sigue terminando en verde de una sola pasada.

---

## 5. `INFORME-RONDA-10.md`

Las nueve secciones de siempre. En la §2, dos cosas explícitas:

- **dónde quedó la única definición de `MAX_ACLARACION`** y, si no pudo ser una sola, por qué;
- **qué contás como "carácter"** para la regla de desborde, y qué pasa con acentos y eñes.

---

## 6. Reglas de conducta y cierre

Las siete de `ORDEN-RONDA-01.md` §3. La documentación es de sólo lectura: **ADR-021, ADR-022 y las ADR-023 a ADR-026 las escribí yo, no las toques.**

Cierre: `node --test` y el guardián en verde en un clon limpio, informe completo, **un solo commit** con mensaje `Ronda 10 — H11 pantalla de carga y H12 anexo de EETT`, y `git push`.

---

## 7. Criterios de aceptación

| # | Verificación | Resultado exigido |
|---|---|---|
| 1 | `node --test` en clon limpio, de una sola pasada | Todo en verde, sin intervención |
| 2 | `node tools/check-compat.js` | Salida 0 |
| 3 | `MAX_ACLARACION` | 256, definido en **un solo lugar**; ningún 200 residual |
| 4 | Aclaración de 255 / 257 caracteres | 255 en el requerimiento; 257 dispara el anexo con la referencia correcta |
| 5 | Anexo sin desbordes ni condiciones particulares | No se genera |
| 6 | Carga del requerimiento desde la pantalla | Los 16 campos del encabezado, con lo derivable prellenado |
| 7 | Subida de presupuestos desde la pantalla | Con nombre, tamaño e identificador a la vista, y errores en castellano |
| 8 | Base del valor de referencia | Elección explícita, **sin valor por defecto** |
| 9 | Presupuesto del valor de referencia | Elegido de una lista; imposible citar uno inexistente |
| 10 | Promedio y preventivo en pantalla | Visibles mientras se carga, iguales a los del núcleo |
| 11 | Borrador local | Sobrevive al cierre con los campos nuevos |
| 12 | Leyenda de ADR-023 | En pantalla, en el pie del entregable y en el export |
| 13 | Textos de interfaz | Ningún mensaje al operador dice que el sistema "autoriza" |
| 14 | Archivos sobre 400 líneas | Ninguno |
| 15 | `INFORME-RONDA-10.md` con sus 9 secciones | Completo |

Se va a correr una **batería externa** que carga un requerimiento completo desde la API con aclaraciones en los tres bordes (255, 256, 257) y verifica el requerimiento y el anexo resultantes.

---

## 8. Qué se está evaluando

Que un operador de la División pueda cargar un requerimiento real de principio a fin, sin ayuda, y que el papel que salga sea el que hoy arma a mano en Excel.

Las tres rondas anteriores construyeron el motor. Esta le pone el tablero de mandos. Un motor perfecto al que nadie puede subirse no sirve de nada — y hasta ayer, eso era exactamente lo que teníamos.

Pesa, en este orden: (1) que la pantalla permita cargar todo sin pasar por la API, (2) la regla de desborde en sus bordes exactos, (3) que la base del valor de referencia no tenga default, (4) la leyenda y el vocabulario, (5) que no quede ningún 200.

El punto 3 parece menor y no lo es: es la única defensa que le queda al usuario contra el defecto silencioso de la ronda anterior. Un `select` que ya viene en "unitario" se acepta sin mirar.
