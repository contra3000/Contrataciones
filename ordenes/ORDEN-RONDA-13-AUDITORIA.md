# ORDEN DE AUDITORÍA — CICLO 13

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **correcciones del ciclo 12**, **H19 — diálogo de sugerencias** y **H14 — proceso adjudicado como base**, según `ordenes/ORDEN-RONDA-13.md`
Emitida: 2026-08-26

---

## 0. Tu rol

Valen `ORDEN-RONDA-04-AUDITORIA.md` §0 y §1, la verificación de conducta de `ORDEN-RONDA-05-AUDITORIA.md` §1, el control de entrega, y la integridad de la bitácora sobre **32 ADRs**.

### Tu ciclo anterior

**La inyección de fórmulas en el CSV es el hallazgo del ciclo**, y lo verifiqué: `exportarCSV` sólo entrecomilla por coma, comilla y salto de línea. Un campo que empieza con `=` o `@` se ejecuta al abrir el archivo en una planilla, y el registro de eventos está lleno de texto libre de operadores. Bien encontrado.

Tu recorrido de cuarenta textos contra el parser real de Python, con la tabla generada por programa, es exactamente lo que pedía la regla nueva. **Ese es el estándar y lo cumpliste.**

### Y algo que hay que arreglar, que no es un hallazgo sino tu propio archivo

En tu clasificación de rojos de la batería anotaste:

> *"Defecto conocido no resuelto del r10 — el servidor acepta aclaración >256 — **El servidor no aplica `validarRenglon` en el PUT**."*

**Las dos mitades son falsas, y lo verifiqué:**

- El servidor **sí** aplica `validarRenglon` en el `PUT`: `server/expedientes.js:322` llama a `erroresDeRenglones`, que lo hace renglón por renglón. Se cerró en el ciclo 10-bis **y lo verificaste vos** con sondas HTTP.
- Que acepte una aclaración de más de 256 **no es un defecto: es la regla de H12**. Un texto que pasa los 256 no se rechaza — se imprime cortado con un *"según anexo alfa"* y va entero al anexo. El tope duro es 2000 y el servidor lo aplica.

Y el otro: el "caso 4 del preventivo" figura ahora como *"precisión decimal, redondeo flotante"*. En el ciclo 10-bis vos mismo habías establecido que **el test estaba mal escrito** —dividía por 3 cuando la cantidad era 2— y lo comprobaste contra el clon viejo antes de acusar al código.

**No es descuido: es que la clasificación se rehace de memoria cada ciclo y las causas derivan.** Con catorce rojos acumulados de tres rondas, eso convierte la batería en ruido — y la batería es el mejor activo que producís.

### La corrección, y es tu primera tarea de este ciclo

Creá **`auditoria\bateria\MOTIVOS.md`**: una línea por test en rojo, con **qué test**, **cuál es la causa establecida** y **en qué ciclo se estableció**. Categorías: *desvío endosado*, *defecto abierto*, *test propio mal escrito*, *apunta a código ya reemplazado*.

- Si un rojo cambia de causa, cambia ese archivo **y se dice en el informe**.
- Un rojo sin línea en `MOTIVOS.md` es un hallazgo de conducta — tuyo.
- Sigue valiendo: **un test adversario no se borra ni se edita para que pase.**

Empezá por los catorce que hay. Los dos de arriba ya tienen su causa establecida acá.

### Accesos fuera del repositorio

`auditoria\bateria\`; `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\` en sólo lectura, con permiso de ejecutar `scripts/generar_pliego.py` hacia una carpeta temporal; `os.tmpdir()` y `127.0.0.1`. Nada más.

---

## 1. Verificación de conducta

Los cinco de siempre, más dos de este ciclo:

6. **`MOTIVOS.md` existe y cubre todos los rojos.**
7. **El informe del desarrollador tiene las nueve secciones.** El del ciclo 12 tenía cinco: faltaban §4 (contradicciones), §5 (qué NO hice), §6 (riesgos) y §8 (accesos). **Verificá las cuatro por nombre.** Si falta alguna, es hallazgo de conducta de severidad media — no es una formalidad: son las secciones por las que el revisor se entera de lo que *no* salió.

---

## 2. El blanco principal: ¿queda algún texto que se ejecute?

Es la tercera vez que aparece la misma forma de defecto —el HTML, el YAML, ahora el CSV— así que esta vez auditá **la clase**, no el caso.

- **Neutralización siempre, no por detección.** Verificá que no haya una lista de "caracteres peligrosos": lo que se pidió es que **todo** campo que empiece con `=`, `+`, `-`, `@` o tabulador lleve el apóstrofo, sin excepción. Si hay una lista de casos, es el mismo defecto de la ronda 11 con otro traje.
- **Buscá otras exportaciones.** ¿La vista de exploración es la única que produce CSV? ¿Y el export de sugerencias de H19? ¿Y el `resumen.md`? Cada salida a un formato que otro programa interpreta es una superficie.
- **El caso al revés:** un campo que legítimamente empieza con `-` (un número negativo, una viñeta), ¿queda ilegible? El apóstrofo tiene que neutralizar sin destruir el dato.
- Y probá **abriendo el archivo de verdad**, no leyendo el código: generá el CSV y verificá el contenido byte a byte.

---

## 3. H19 — el diálogo de sugerencias

Tiene una particularidad: **es lo único del sistema que va a usar gente que no conoce el sistema.**

- **Con `MODO_PILOTO` apagado, el botón no existe en el DOM** — no oculto por CSS: ausente. Y la marca **no se puede cambiar desde la interfaz**: buscá si hay algún camino.
- **El contexto se captura solo.** Escribí una sugerencia desde tres pantallas distintas y verificá que cada una guarde dónde estaba, qué expediente y qué paso, sin que el usuario lo tipee.
- **Append-only de verdad:** veinte escrituras concurrentes, veinte líneas. ¿Hay algún camino —marcar como atendida, exportar, respaldar— por el que una línea cambie o desaparezca?
- **Marcar atendida no puede editar el texto.** Probá si se puede.
- **Entrada hostil:** un texto de 100.000 caracteres, inyección HTML, caracteres de control. Y la exportación a Markdown: **¿se puede romper el documento resultante desde el texto de una sugerencia?**
- **La fricción, que es el criterio real:** contá los clics y los campos obligatorios desde que se abre el panel hasta que la sugerencia queda guardada. Si hay que elegir algo antes de escribir, decilo — nadie va a usarla.
- ¿Entra en el respaldo? Destruí la carpeta de datos, restaurá, y verificá que las sugerencias vuelvan.

---

## 4. H14 — usar un proceso como base

**El blanco es lo que NO se copia**, no lo que se copia.

- Armá un expediente **con presupuestos, valores de referencia, imputación y auditoría**, archivalo, y usalo como base. Después revisá el `datos.json` del expediente nuevo **campo por campo**: ¿quedó algo del viejo que no debía?
- **Ningún precio, por ningún camino.** Ni presupuestos, ni valores de referencia, ni preventivos calculados. Es el riesgo central (R21) y es silencioso: un precio del año pasado que reaparece produce un número plausible.
- **La lista es blanca, no negra.** Leé el código: si copia todo y después borra, es lista negra y es un hallazgo — una lista negra olvida un campo y ese campo es el que hace daño.
- **Códigos dados de baja:** armá un expediente con un ítem que ya no esté en el catálogo vigente y verificá que **se marque**, no que se copie en silencio.
- `basadoEn` registrado, visible y con su evento.
- El expediente origen **no se toca**: verificalo en disco después de la operación.
- ¿Se puede usar como base un expediente **no perfeccionado**? ¿Y uno de otro año con un esquema viejo?

---

## 5. Las otras correcciones

- `renders/pliego-bases-condiciones.js` **borrado**, sin referencias en ningún lado —incluidos tests, `index.html` y `recorrido-completo.js`—.
- **Byte nulo** escapado; el YAML parsea. Volvé a correr tus cuarenta casos: ahora tienen que pasar los cuarenta.
- **El anexo de EETT no imprime cantidades.** Es la invariante que cierra R17: las especificaciones técnicas no llevan cantidades, van en COMPRAR. Verificá el documento compuesto —no el código— con un renglón que tenga cantidad, máxima y mínima cargadas. **Ninguna de las tres puede aparecer.**

---

## 6. Regresiones

Las de siempre, más lo del ciclo 12 que esta ronda no puede haber movido: la ida y vuelta del YAML, el registro de eventos append-only, los indicadores derivados, la vista previa del pliego sin firma, las guardias de ADR-029, la matriz 18 × 7, concurrencia, archivado y recuperación ante desastre.

Batería completa desde `auditoria\bateria\`, con **`MOTIVOS.md` al día**.

---

## 7. El reporte — `AUDITORIA-CICLO-13.md`

Misma estructura. Tres secciones propias:

```
## Qué se puede ejecutar todavía
Toda salida a un formato que otro programa interpreta, y qué le pasa a un texto hostil.

## Qué quedó del expediente viejo
El datos.json del expediente creado "como base", campo por campo.

## La fricción de anotar una sugerencia
Clics y campos obligatorios desde abrir el panel hasta guardar.
```

Cierre: un solo commit, `Auditoria ciclo 13`, sin push.

---

## 8. Qué se espera de vos

Tres blancos de naturaleza distinta.

**El CSV falla en la máquina de otro**, cuando alguien abre el archivo en una planilla, lejos de acá. No se ve probando el sistema: hay que ir al archivo.

**H14 falla en silencio y con un número plausible.** Un precio heredado no rompe nada.

**Y H19 falla por desuso.** Puede estar perfectamente implementado y no servir para nada si escribir una observación cuesta cuatro clics. Es la primera vez que te pido auditar la fricción de algo, y es un criterio tan real como los otros dos.

La pregunta que guía esta auditoría: **¿qué se lleva el expediente nuevo que no le corresponde?**
