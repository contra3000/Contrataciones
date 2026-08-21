# ORDEN DE AUDITORÍA — CICLO 10

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **H11 (cierre) — pantalla de carga del requerimiento** y **H12 — EETT con regla de desborde**, según `ordenes/ORDEN-RONDA-10.md`
Emitida: 2026-08-20

---

## 0. Tu rol

Valen íntegramente `ordenes/ORDEN-RONDA-04-AUDITORIA.md` §0 y §1, y la verificación de conducta de `ORDEN-RONDA-05-AUDITORIA.md` §1, más la integridad de la bitácora que se agregó en el ciclo 09.

### Tu ciclo anterior

Encontraste el único hallazgo real del ciclo y **es una clase de defecto que ningún test podía detectar**: la suite estaba en verde precisamente porque el test verificaba el 200. Una contradicción entre la bitácora y el código no la agarra la suite, la agarra alguien que lee las dos cosas. Verifiqué el hallazgo yo mismo en el código antes de escribir esta orden y es cierto en los cuatro archivos.

Tus cinco casos manuales del preventivo, con la cuenta hecha aparte, son el trabajo mejor hecho de este ciclo. Yo llegué al mismo comportamiento por otro camino y con otros números. Y tu respuesta a la pregunta que guiaba la auditoría —*"¿existe alguna combinación que produzca un preventivo incorrecto sin que nada avise?"*— fue **no**, con once casos que rompen enumerados para sostenerla. Eso es una conclusión, no una impresión.

La comprobación nueva de integridad de la bitácora la corriste ADR por ADR. La red de contención que se agrega después de un incidente sólo sirve si alguien la corre.

Tus dos observaciones sobre el cálculo entraron como riesgos bajos y **la primera se corrige este ciclo**: el `presupuestoId` fantasma deja de ser posible cuando el presupuesto se elige de una lista.

### Una cosa que corregí yo, y te toca verificar

Se incorporó **ADR-023**. La orden que te di el ciclo pasado decía *"la imputación presupuestaria: es autorización, no formulario"*, y esa frase describe un sistema que no es el nuestro. **Esta aplicación no autoriza, no imputa y no adjudica.** El control de acceso del servidor existe para que el registro de tiempos sea cierto, no para conceder facultades. El error de redacción fue mío. Leé ADR-023 completa antes de empezar: parte de tu trabajo este ciclo es verificar que el vocabulario quedó corregido donde se lee.

### Accesos fuera del repositorio

`os.tmpdir()` y puertos locales `127.0.0.1`. Nada más.

---

## 1. Verificación de conducta

Los cuatro de siempre: accesos fuera del repositorio, documentación intocable (**ADR-021 a ADR-026**), integridad de la bitácora (cuerpo completo de las **26** ADRs, no sólo las filas del índice), y honestidad del informe contra lo que hay en el código.

---

## 2. El blanco principal: la pantalla, como superficie hostil

Es la primera vez que existe una pantalla que carga datos complejos, y **el 40% de esta auditoría**. Va primero por una razón distinta a la del ciclo pasado: no es que falle en silencio, es que **es la primera vez que un usuario real toca el sistema**.

### 2.1 — La regla que no se puede haber roto

El servidor sigue siendo el que gobierna. Verificá que **no se haya mudado ni una regla a la vista**:

- Desactivá la validación del cliente —o pegale directo al servidor— y probá todo lo que la pantalla impide: base ausente, valor negativo, base `total` con cantidad cero, `presupuestoId` inexistente, aclaración de 300 caracteres. **El servidor tiene que rechazar lo mismo, por su cuenta.**
- Si algo que la pantalla bloquea el servidor lo acepta, es el defecto del ciclo 6 con otra ropa y es **severidad alta**.

### 2.2 — La base sin valor por defecto

La orden lo pide explícito y es la única defensa que le queda al usuario contra el defecto silencioso del ciclo anterior. Verificá que:

- el control **no viene preseleccionado** en `unitario` ni en nada;
- un valor de referencia **sin base declarada no se puede guardar**, ni desde la pantalla ni desde la API;
- lo que la pantalla calcula y muestra —promedio, preventivo del renglón, preventivo de la contratación— **coincide con lo que calcula el núcleo**. Si la vista tiene su propia cuenta, aunque hoy dé igual, es un hallazgo: dos implementaciones del mismo cálculo divergen tarde o temprano, y ésta es la que el usuario mira.

### 2.3 — El borrador local

Cargá medio requerimiento, cerrá el navegador de golpe, volvé. ¿Está todo, incluidos los valores de referencia y los presupuestos ya subidos? ¿Qué pasa si el borrador es de una versión anterior del esquema? ¿Y si está corrupto — la pantalla arranca, o queda inutilizable?

### 2.4 — Entrada hostil en los campos nuevos

Los dieciséis del encabezado y las condiciones particulares del anexo: inyección, textos larguísimos, caracteres de control, cadenas vacías con espacios. Y el clásico que siempre falta: **¿qué pasa si el usuario pega un texto de 50.000 caracteres en la justificación?**

---

## 3. La regla de desborde, en sus bordes exactos

- **255, 256, 257.** Los tres, y decime cuál queda de cada lado.
- **¿Qué cuenta como carácter?** Una aclaración de 256 caracteres **con acentos y eñes** y otra con emojis o caracteres fuera del plano básico. `String.length` en JavaScript cuenta unidades UTF-16, no caracteres percibidos: una cadena de 256 caracteres que el usuario ve puede medir más de 256. Si el desarrollador no lo tuvo en cuenta, el corte se produce en un lugar que el usuario no puede predecir. Verificá qué criterio adoptó y si lo documentó.
- **Dos, tres y cuatro renglones que desbordan**: nomenclatura correcta y sin colisiones.
- **Ningún desborde y sin condiciones particulares:** el anexo **no se genera**. Verificalo mirando el disco y la lista de entregables, no la pantalla.
- **Condiciones particulares sin ningún desborde:** el anexo sí se genera.
- **La referencia cruzada:** `"según anexo alfa"` en el requerimiento tiene que apuntar al anexo que efectivamente contiene ese renglón. Probá con varios renglones desbordados en distinto orden, y con un renglón que se borra después de haber desbordado.
- ¿Se puede avanzar de estado con un renglón desbordado y **sin** el anexo generado?

---

## 4. El 200 residual

`grep` a fondo. `MAX_ACLARACION`, el literal `200`, los mensajes de error, los contadores de la interfaz, los `maxLength` del HTML, los tests, los datos de prueba y los esquemas JSON.

Y verificá lo otro que pidió la orden: **que la constante viva en un solo lugar**. Si sigue escrita en cuatro archivos aunque los cuatro digan 256, la causa del defecto sigue ahí y es una observación.

---

## 5. La leyenda y el vocabulario (ADR-023)

- La leyenda tiene que aparecer en **los tres lugares**: pantalla del expediente, **pie de cada entregable generado** —todos, no sólo el requerimiento— y `resumen.md` del export.
- **Barrido de textos.** Buscá en todo lo que ve un operador —incluidos los mensajes de error 403— las palabras "autoriza", "autorizado", "aprueba", "aprobado". Cada aparición que le atribuya la acción **al sistema** en lugar de a una persona es un hallazgo de severidad baja, y en el pie de un entregable impreso es de severidad media: ese papel sale de la División.
- El código interno **no se renombra**: si el desarrollador renombró `autorizacion.js` o la matriz, eso es exceso de alcance, no cumplimiento.

---

## 6. Regresiones

Las de siempre, obligatorias: concurrencia de `PUT` y de numeración, recorrido de rutas, presupuesto del catálogo, alta completa, Fast-Track hostil, borrador inválido, recorrido de los 18 estados, **la matriz 18 × 7 con sus 13 escenarios laterales**, adjuntos, **el cálculo del preventivo con bases mixtas** (volvé a correr tus cinco casos del ciclo pasado: la pantalla nueva no puede haberlos movido), archivado y recuperación ante desastre.

Y que `node --test` siga terminando **en verde de una sola pasada**.

Conservá y volvé a correr tu batería completa.

---

## 7. El reporte — `AUDITORIA-CICLO-10.md`

Misma estructura, con la sección de riesgos declarados y tu opinión sobre cada uno.

Agregá dos secciones propias:

```
## La pantalla contra el servidor
Por cada regla que la pantalla impone: qué hace el servidor cuando se la saltea.
Una regla que sólo vive en la vista es severidad alta.

## Los bordes del desborde
255, 256, 257, y el caso con acentos. Qué queda de cada lado y por qué.
```

Cierre: un solo commit, `Auditoria ciclo 10`, sin push.

---

## 8. Qué se espera de vos

Los ciclos 6 y 7 buscaron reglas que faltaban. El 9 buscó un número mal calculado. **Este ciclo el blanco es la distancia entre lo que la pantalla promete y lo que el servidor cumple.**

Una interfaz que valida bien crea una ilusión peligrosa: todo el mundo empieza a asumir que los datos llegan limpios, y la validación del servidor se vuelve decorativa hasta que alguien la esquiva. La pregunta que guía esta auditoría:

**¿Hay alguna regla que sólo exista en la pantalla?**
