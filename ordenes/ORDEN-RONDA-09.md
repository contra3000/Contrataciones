# ORDEN DE TRABAJO — RONDA 9

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hito cubierto: **H11 — Requerimiento completo y presupuestos**
Emitida: 2026-08-20

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`.

El ciclo anterior se aprobó con los catorce criterios cumplidos y sin hallazgos de severidad. **La recuperación ante desastre la verifiqué yo mismo**: creé expedientes, respaldé, destruí la carpeta de datos y restauré — volvieron los tres con la cadena de auditoría íntegra. Eso es lo que convierte al respaldo en un plan de recuperación y no en una copia decorativa.

### Contexto nuevo, y es el importante

Entraron al proyecto **los documentos reales del circuito** (`EjemplosProcesoActual/`): el requerimiento que hoy se llena en Excel, el anexo de especificaciones técnicas, el ANEXO 1 que Abastecimiento eleva a la UOC, el generador de pliegos que ya funciona, y el compendio normativo completo.

Leelos junto con `ANALISIS_ENTREGABLES_REALES.md` y **ADR-022**, que fija el modelo de datos. Esta ronda es el primero de tres hitos nuevos (H11, H12, H13) que llevan la aplicación de "produce un documento genérico" a "produce los documentos que la División realmente presenta".

### Accesos fuera del repositorio

`os.tmpdir()` y puertos locales `127.0.0.1`. Nada más. Los documentos de referencia están dentro del proyecto.

---

## 1. Alcance

El requerimiento real —una **Solicitud de Gastos**— con sus presupuestos y su valor preventivo calculado.

Hoy el usuario entrega cinco archivos o más. Al terminar H11 y H12 entregará **dos documentos generados más los presupuestos adjuntos**, y el promedio de referencia dejará de calcularse a mano en Excel.

**Fuera de alcance:** el anexo de EETT con su regla de desborde (H12, ciclo siguiente) y el ANEXO 1 (H13). **Y los estilos**: esta ronda es estructura de datos y generación funcional. Lo cosmético se hace al final del roadmap.

---

## 2. Correcciones arrastradas

Las tres son menores y salen del ciclo anterior.

### 2.1 — La suite completa no termina en verde de una sola pasada

`transiciones-servidor-matriz.test.js` tarda unos 133 segundos y el tiempo límite por defecto de `node --test` la corta cuando corre dentro de la suite completa. Sola pasa.

No es un defecto de la aplicación, pero **una suite que no se puede correr entera deja de correrse**, y con ella se pierde la red de contención. Resolvelo como corresponda —subir el límite para ese archivo, partir la matriz en varios tests, o paralelizar—, pero el criterio es: `node --test` desde la raíz termina en verde sin intervención.

### 2.2 — La restauración no avisa qué queda mezclado

`restaurar.js` ya advierte que copió por encima del destino. Falta el otro lado: **listar los archivos del destino que no estaban en el respaldo** y que quedan mezclados con lo restaurado. Un operador que restaura sobre datos activos hoy no se entera.

### 2.3 — La restauración no valida el respaldo antes de usarlo

Un respaldo truncado o corrupto se restaura tal cual y el servidor arranca con datos incompletos, en silencio. Antes de copiar, verificá lo mínimo: que exista `contador.json`, que exista `idx/`, y que los JSON que va a restaurar parseen. Si algo falla, **no restaures a medias**: abortá con un mensaje que diga qué está mal.

---

## 3. Entregables nuevos

### 3.1 — El esquema del requerimiento

Extender el expediente con los campos de la Solicitud de Gastos (`MODELO REQ..xlsx`, ver `ANALISIS_ENTREGABLES_REALES.md` §3.1):

**Encabezado:** lugar, fecha, organismo, CUIT, unidad solicitante, rubro comercial (código y descripción), modalidad de compra sugerida, fechas de inicio y fin de vigencia sugeridas, procedimiento de selección sugerido, causas de contratación directa, clase, objeto, prioridad y justificación de la necesidad.

**Imputación presupuestaria:** los dieciséis campos (`Ejerc, R, S, C, Ft, PG, Sp, Py, Ac, Ob, UG, I, Pppal, Ppcial, Spa, M`), admitiendo varias filas.

**Importante (ADR-022 §4): la imputación NO la carga el usuario generador.** Pertenece al rol `contaduria` y sólo es editable en el estado `AFECTACION` (paso 16). En la Fase 1 el bloque se imprime vacío. La restricción se aplica **en el servidor**, con la misma matriz de autorización de ADR-021: un `PUT` que intente escribir esos campos desde otro rol o en otro estado se rechaza.

### 3.2 — Presupuestos adjuntos

El usuario sube presupuestos en PDF o imagen. Se guardan en la carpeta del expediente y se registran en el `datos.json`.

- Validá tipo y tamaño; documentá el límite que elijas.
- El nombre del archivo en disco lo decide el servidor, no el cliente: un nombre de archivo que venga del usuario es una vía de recorrido de rutas, y ya cerramos esa puerta en la ronda 3.
- Cada presupuesto lleva un identificador estable, porque los valores de referencia lo citan.

### 3.3 — Valores de referencia y valor preventivo · **el corazón de la ronda**

Por cada renglón, el usuario carga **un valor por cada presupuesto**:

```
{ presupuestoId, base: 'unitario' | 'total', valor }
```

**La base es obligatoria y por eso existe.** Habitualmente el presupuesto cotiza por unidad, pero a veces viene cotizado por el total del renglón. El cálculo es, **en este orden** (ADR-022 §2):

1. **Normalizar** todo a unitario: si `base === 'total'`, entonces `valor / cantidad`.
2. **Promediar** los unitarios normalizados.
3. **Valor preventivo del renglón** = promedio unitario × cantidad.
4. **Valor preventivo de la contratación** = suma de los preventivos de todos los renglones.

> Promediar sin normalizar —mezclar un unitario con un total en la misma media— produce un número plausible y sin significado. Es invisible: no rompe nada, no avisa, y el preventivo queda mal. Este es el defecto que la ronda tiene que hacer imposible.

Si `cantidad` es cero o falta, un valor con base `total` no se puede normalizar: **rechazalo en la validación**, no dividas por cero.

El promedio se muestra en una columna calculada del requerimiento, y es lo que el usuario firma.

### 3.4 — Orden de Compra Abierta

- `cantidadMaxima` por renglón, cargada por el usuario. **Etiqueta y ayuda tienen que decir qué es**: el tope que se le puede requerir al proveedor **en una sola Solicitud de Provisión**. Llamarla "cantidad máxima" a secas invita a leerla como el techo del contrato, que en la norma es otra cosa (ADR-022 §3).
- `cantidadMinima` por renglón, **opcional y vacía por defecto**: la cantidad que la División se obliga a contratar (Art. 52 de la disposición). Se imprime sólo si tiene valor.
- **Justificación de OCA** como campo de texto libre del requerimiento, no como archivo aparte. Se imprime cuando la modalidad OCA está activada.

La causal está en el Art. 25 inc. c) del Decreto 1023/01 y en el Art. 111 del Decreto 1030/16: *cuando no se pudiere prefijar con suficiente precisión la cantidad de unidades o las fechas o plazos de entrega*. Poné ese texto como ayuda contextual del campo, para que el usuario sepa contra qué tiene que justificar.

### 3.5 — La plantilla del requerimiento

Reemplaza a la Especificación Técnica genérica del ciclo 7, reutilizando lo común de `renders/documento.js`.

- **El código se descompone en IPP / Clase / Ítem** (ADR-022 §1): `2.5.8-378.186` se imprime como `258 | 378 | 186`. Es partir la cadena, no traducir.
- Tabla de renglones con: orden, IPP, Clase, Ítem, descripción, unidad de medida, cantidad, importe unitario (el promedio) y total.
- Total general en números y **en letras** ("LA SUMA DE: PESOS ... CON 00/100.-").
- El bloque de imputación presupuestaria, vacío o completo según el estado.
- La justificación de OCA y la planilla de máximos, cuando corresponda.

### 3.6 — Tests

Conservando en verde todo lo anterior, en un clon limpio:

1. **Bases mixtas**: un renglón con un valor unitario y otro por total produce el preventivo correcto. Verificable a mano con números redondos.
2. Base `total` con cantidad cero o ausente: **rechazada**, sin división por cero.
3. El preventivo de la contratación es la suma de los preventivos de renglón.
4. La imputación presupuestaria **no se puede escribir** desde el rol `generador`, ni desde `contaduria` fuera del estado `AFECTACION`. Probado contra el servidor, no contra la vista.
5. Adjuntos: un nombre de archivo con `../` no escapa de la carpeta del expediente.
6. Adjunto que excede el límite o de tipo no permitido: rechazado con mensaje.
7. El documento imprime el código descompuesto en tres columnas.
8. El total en letras es correcto para varios montos, incluido el cero.
9. `cantidadMinima` vacía no se imprime; con valor, sí.
10. La suite completa termina en verde de una sola pasada (corrección 2.1).

### 3.7 — `INFORME-RONDA-09.md`

Las nueve secciones de siempre. En la 2, mostrá el cálculo del preventivo sobre un caso con bases mixtas, con los números a la vista.

---

## 4. Reglas de conducta y cierre

Las siete de `ORDEN-RONDA-01.md` §3. La documentación es de sólo lectura: **ADR-021 y ADR-022 las escribí yo, no las toques.**

Cierre: `node --test` y el guardián en verde en un clon limpio, informe completo, **un solo commit** con mensaje `Ronda 9 — H11 Requerimiento y presupuestos`, y `git push`.

---

## 5. Criterios de aceptación

| # | Verificación | Resultado exigido |
|---|---|---|
| 1 | `node --test` en clon limpio, **de una sola pasada** | Todo en verde, sin intervención |
| 2 | `node tools/check-compat.js` | Salida 0 |
| 3 | Preventivo con bases mixtas | Correcto, verificable a mano |
| 4 | Base `total` con cantidad cero | Rechazada |
| 5 | Imputación presupuestaria | Sólo rol `contaduria`, sólo en `AFECTACION`, validado en el servidor |
| 6 | Adjunto con `../` en el nombre | No escapa de la carpeta |
| 7 | Código descompuesto en IPP / Clase / Ítem | Impreso en tres columnas |
| 8 | Total en letras | Correcto, incluido el cero |
| 9 | `cantidadMaxima` | Etiqueta y ayuda explican que es por Solicitud de Provisión |
| 10 | `cantidadMinima` vacía | No se imprime |
| 11 | Justificación de OCA | En el requerimiento, con la causal normativa como ayuda |
| 12 | Restauración | Lista huérfanos y valida el respaldo antes de copiar |
| 13 | Archivos sobre 400 líneas | Ninguno |
| 14 | `INFORME-RONDA-09.md` con sus 9 secciones | Completo |

Se va a correr una **batería externa** que carga renglones con bases mixtas y verifica el preventivo contra un cálculo hecho aparte.

---

## 6. Qué se está evaluando

Que el número que el Jefe de Contrataciones firma sea el correcto.

Pesa, en este orden: (1) el cálculo del preventivo con bases mixtas, (2) que la imputación presupuestaria esté cerrada por rol y por estado **en el servidor**, (3) la seguridad de los adjuntos, (4) que el documento impreso sea presentable, (5) las tres correcciones arrastradas, (6) honestidad del informe.

El punto 1 va primero porque es el único de la lista que falla **en silencio**: un preventivo mal calculado no rompe nada, no avisa, y se firma igual.
