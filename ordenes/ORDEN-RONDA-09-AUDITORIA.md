# ORDEN DE AUDITORÍA — CICLO 09

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **H11 — Requerimiento completo y presupuestos**, según `ordenes/ORDEN-RONDA-09.md`
Emitida: 2026-08-20

---

## 0. Tu rol

Valen íntegramente `ordenes/ORDEN-RONDA-04-AUDITORIA.md` §0 y §1, y la verificación de conducta de `ORDEN-RONDA-05-AUDITORIA.md` §1.

### Tu ciclo anterior

Bien hecho, y en el orden correcto: pusiste el respaldo primero porque era lo único que, si fallaba, no se arreglaba después. Destruiste la carpeta de datos de verdad e interrumpiste el archivado en cada punto posible. Tu conclusión sobre el *staging + rename como punto de confirmación, más `recuperarArchivados()` al arranque* es la arquitectura correcta para una operación que mueve archivos.

Reproduje la recuperación ante desastre por mi cuenta y coincidimos: tres expedientes, tres cadenas de auditoría íntegras.

Tus dos sospechas eran legítimas y las dos entraron como correcciones de este ciclo.

### Una comprobación nueva, por algo que se nos escapó a los dos

Al preparar este ciclo descubrí que **el cuerpo de ADR-021 había desaparecido de `BITACORA_DECISIONES.md`**. Se perdió en la resolución de un conflicto de rebase. La decisión que gobierna toda la autorización del servidor no estaba en el registro, y tu verificación de conducta no lo detectó porque **comprobás que la documentación no se modifique, no que no se pierda**.

Desde este ciclo la §1 incluye esa comprobación. Es un caso interesante: el diff contra el commit anterior daba limpio, porque la pérdida había ocurrido antes.

### Accesos fuera del repositorio

`os.tmpdir()` y puertos locales `127.0.0.1`. Nada más.

---

## 1. Verificación de conducta

Los tres de siempre, más una:

4. **Integridad de la bitácora.** Verificá que `BITACORA_DECISIONES.md` contenga el **cuerpo completo** de las ADR 001 a 022, no sólo las filas del índice. Una ADR listada en la tabla cuya sección no existe en el documento es un hallazgo de severidad media, sin importar quién la haya perdido ni cuándo.

---

## 2. El blanco principal: el cálculo del preventivo

Es el 40% de esta auditoría, y va primero por una razón: **es el único defecto de este ciclo que falla en silencio.** Un preventivo mal calculado no rompe nada, no lanza excepciones, y se firma igual.

### 2.1 — Calculalo vos, a mano, y comparalo

No mires el test del desarrollador: armá tus propios casos con números redondos y verificá el resultado con una cuenta hecha aparte.

Como mínimo:

- Un renglón, dos presupuestos, **los dos unitarios**.
- Un renglón, dos presupuestos, **uno unitario y uno por total** — el caso que la ronda existe para resolver.
- Un renglón, tres presupuestos, **todos por total**.
- Cantidades que no dividan exacto (7 unidades, 3 presupuestos), para ver qué pasa con los redondeos: ¿redondea al final o en cada paso? ¿Se acumula el error?
- Varios renglones, para verificar que el preventivo de la contratación es la suma y no un promedio de promedios.

### 2.2 — Los casos que rompen

- `base: 'total'` con `cantidad` **cero**, **ausente**, **negativa** o **no numérica**.
- Un `presupuestoId` que **no corresponde a ningún presupuesto adjunto**.
- **Dos valores del mismo presupuesto** para el mismo renglón: ¿se promedian los dos, se toma el último, o se rechaza?
- **Ningún valor de referencia** en un renglón: ¿el preventivo es cero, o el renglón queda sin preventivo? ¿Se puede avanzar así?
- Un valor **negativo** o **cero**.
- Valores con muchos decimales, y montos muy grandes: ¿hay pérdida de precisión en punto flotante?
- Una `base` con un valor que no es ni `unitario` ni `total`.

Por cada uno: qué hace el sistema, y si lo que hace es defendible.

---

## 3. La imputación presupuestaria: es autorización, no formulario

ADR-022 §4 dice que esos dieciséis campos los carga **sólo el rol `contaduria`** y **sólo en el estado `AFECTACION`**.

Eso es una regla de autorización, así que auditala como tal — con lo que aprendiste en los ciclos 6 y 7:

- Pegale **directo al servidor**, no a la vista. ¿Un `generador` puede escribir la imputación con un `PUT`?
- ¿Puede `contaduria` escribirla en un estado que no es `AFECTACION`?
- ¿Se puede escribir **parcialmente**, un campo suelto?
- Después de cada rechazo, **verificá el disco**: el `datos.json` no puede haber cambiado.
- ¿Y por los extremos de transición? ¿Se cuela la imputación en el cuerpo de un `avanzar`?

Si la restricción vive sólo en la vista, es el defecto del ciclo 6 con otra ropa, y es de severidad alta.

---

## 4. Los adjuntos: superficie nueva

Es la primera vez que el sistema recibe **archivos binarios** del usuario. Es una superficie que no existía.

- Nombre de archivo con `../`, con barras, con caracteres nulos, con nombres reservados de Windows (`CON`, `PRN`, `NUL`, `LPT1`): ¿escapa alguno de la carpeta del expediente?
- Un archivo que **excede el límite**: ¿se rechaza antes de escribirlo, o después de haberlo escrito entero?
- Un archivo con extensión `.pdf` **cuyo contenido no es un PDF**: ¿se valida el contenido o sólo el nombre?
- Un archivo **vacío**, de cero bytes.
- **Muchos adjuntos** en el mismo expediente: ¿hay tope?
- ¿El nombre en disco lo decide el servidor, o se usa el que mandó el cliente?
- ¿Se puede leer un adjunto de **otro expediente** cambiando el identificador en la URL?

---

## 5. El documento

- **El código descompuesto**: `2.5.8-378.186` tiene que imprimirse como `258 | 378 | 186`. Probá con códigos reales del catálogo, incluidos los de ítem largo.
- **El total en letras**: cero, un peso, montos con centavos, montos de millones. Es el tipo de función que se escribe rápido y falla en los bordes.
- El promedio que se imprime, ¿coincide con el que calculaste vos en §2?
- Inyección en los campos nuevos: justificación de OCA, observaciones, rubro comercial.
- Un requerimiento **sin presupuestos**: ¿qué imprime en la columna del promedio?

---

## 6. Regresiones

Las de siempre, obligatorias: concurrencia de `PUT` y de numeración, recorrido de rutas, presupuesto del catálogo, alta completa, Fast-Track hostil, borrador inválido, recorrido de los 18 estados, **la matriz de autorización 18 × 7 con sus 13 escenarios laterales**, archivado y **recuperación ante desastre**.

Y verificá la corrección 2.1: **`node --test` tiene que terminar en verde de una sola pasada**, sin subir tiempos límite a mano ni correr archivos por separado.

Conservá y volvé a correr tu batería completa.

---

## 7. El reporte — `AUDITORIA-CICLO-09.md`

Misma estructura del ciclo anterior, con la sección de recuperación ante desastre y la de riesgos declarados con tu opinión.

Agregá una sección propia:

```
## Verificación del valor preventivo
Tus casos de cálculo, con los números a la vista y la cuenta hecha aparte.
Por cada caso: entrada, resultado del sistema, resultado tuyo, y si coinciden.
Si alguno no coincide, es un hallazgo de severidad alta.
```

Cierre: un solo commit, `Auditoria ciclo 09`, sin push.

---

## 8. Qué se espera de vos

Los ciclos anteriores buscaron defectos que **rompen**: autorización ausente, entrada hostil, pérdida de datos. Este ciclo el blanco es distinto y más incómodo: un defecto que **no rompe nada**.

Si el promedio mezcla un precio unitario con un total, el sistema devuelve un número. Nadie ve un error. El Jefe de Contrataciones lo firma, el expediente sigue, y el valor preventivo de la contratación —que es el número con el que se pide autorización de gasto— está mal.

La pregunta que guía esta auditoría: **¿existe alguna combinación de presupuestos y bases que produzca un preventivo incorrecto sin que nada avise?**
