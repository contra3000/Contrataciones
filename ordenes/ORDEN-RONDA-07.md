# ORDEN DE TRABAJO — RONDA 7

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hito cubierto: **ADR-021 (autorización en el servidor) + H7 parcial — Entregable de Fase 1 y exportación**
Emitida: 2026-08-18

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`.

El ciclo anterior se aprobó con **una condición de entrada**, que es la §2.1 de esta orden y va antes que todo lo demás.

### Accesos fuera del repositorio

`os.tmpdir()` y puertos locales `127.0.0.1`. Nada más.

### Sobre las interrupciones

Cuatro de las últimas sesiones de agente en este proyecto se cortaron a mitad de camino. Si te pasa: **commiteá lo que tengas antes que nada**, y dejá en el informe una línea diciendo qué quedó sin hacer. Lo que no está commiteado, para el auditor no existe.

---

## 1. Alcance

Dos cosas, en este orden.

**Primero, cerrar el agujero de autorización.** Hoy el circuito de dieciocho pasos —la razón de existir del sistema— se puede saltear con una sola petición HTTP. Está reproducido y documentado en ADR-021.

**Después, el entregable.** Que un expediente produzca el documento que se lleva a la firma, y el JSON con su resumen narrativo para auditoría por IA.

**Fuera de alcance:** las plantillas de los entregables de las fases 2 a 10 (SCo, pliego, disposición, orden de compra) quedan para el ciclo 8. Acá se hace **una sola**: la Especificación Técnica de la Fase 1, completa y bien terminada. Una plantilla impecable enseña el patrón para las nueve restantes; nueve plantillas a medias no enseñan nada.

---

## 2. Correcciones arrastradas

### 2.1 — El servidor tiene que autorizar las transiciones · **condición de entrada**

Leé **ADR-021** en `BITACORA_DECISIONES.md` antes de escribir una línea. Resume el defecto, su reproducción y la decisión. Lo que sigue es la especificación.

**El defecto, reproducido contra tu propio servidor:**

```
GET  /api/expedientes/2026-001   ->  ESPECIFICACIONES_TECNICAS (fase 1, version 1)
PUT  /api/expedientes/2026-001   con estado = PERFECCIONADA y rol "generador"
     ->  200 OK  {"version":2}
GET  /api/expedientes/2026-001   ->  PERFECCIONADA (fase 10)
```

Lo declaraste como riesgo en tu informe §6 y tenías razón. El origen es de diseño mío, no tuyo: la orden de la ronda 3 describió al servidor como almacén versionado y ubiqué `estados.js` del lado del cliente. Ahora se corrige.

**Qué construir:**

1. **Extremos por intención.** El estado deja de viajar como documento y pasa a declararse:

```
POST /api/expedientes/:id/avanzar
     {versionEsperada, destino, contexto}
     -> 200 {version, expediente}
     -> 403 {error}          si el motor rechaza (rol, destino o validación)
     -> 409 {conflicto:true, versionRemota}
     -> 404

POST /api/expedientes/:id/devolver
     {versionEsperada, destino, idMotivo, observacion, contexto}
     -> mismos códigos
```

El servidor lee el expediente de disco, ejecuta `SGC.core.estados.avanzar` / `devolver` con **el rol del contexto**, y persiste **el resultado del motor** — nunca lo que mandó el cliente. Si el motor devuelve `ok:false`, responde `403` con el motivo en español, tal cual lo da el motor.

2. **El `PUT` deja de poder mover el estado.** Sigue existiendo para editar campos. Si el documento recibido trae un `estado` distinto del que hay en disco, responde **`409` con un error explícito** y no escribe nada.

3. **El servidor carga el núcleo de dominio.** Sumá `estados.js` y `validacion.js` a los módulos que `servidor.js` ya carga (`namespaces`, `config`, `auditoria`, `migraciones`, `utils`, `repo`). El motor es puro y no toca el DOM: se diseñó así en la ronda 2 justamente para esto.

4. **La auditoría la escribe el servidor.** La entrada de la transición se genera del lado del servidor, con el rol ya validado y el origen de la petición (ADR-017 medida 3). Lo que el cliente declare en el contexto se registra, pero no es lo que autoriza.

5. **`repo.http.js` y `repo.memoria.js`** exponen `avanzar(id, versionEsperada, destino, ctx)` y `devolver(id, versionEsperada, destino, idMotivo, observacion, ctx)`, con **la misma semántica en las dos implementaciones**, rechazo por rol incluido. La batería que ya corre contra ambas tiene que cubrir los casos nuevos.

6. **La vista sigue igual para el usuario.** El cliente puede seguir usando `puedeAvanzar` para habilitar o deshabilitar botones —eso es comodidad—, pero el cambio de estado se pide por intención y la respuesta manda.

**Prueba que tenés que dejar escrita:** el ataque de arriba, como test. Un rol equivocado pidiendo una transición que no le corresponde recibe `403`, y el expediente en disco **no cambia**. Con `PUT` y con los extremos nuevos.

### 2.2 — Correcciones menores del auditor

- **Test de matriz de permisos monolítico.** Las 252 combinaciones viven dentro de un solo `test()`, así que un fallo en la número 50 oculta las 202 siguientes. Partilo en subtests por estado, o generá un test por estado con `for`. Un fallo tiene que decir exactamente qué combinación falló.
- **Archivos sobre el límite de 400 líneas:** `wizard.js` (437) y `servidor.test.js` (518). Dividilos por responsabilidad, sin reescribirlos.
- **`check-compat.test.js` con inestabilidad bajo carga paralela** (el caso `js-map-groupBy` a veces excede el tiempo). Es preexistente; hacelo determinista.

---

## 3. Entregables nuevos

### 3.1 — `app/js/renders/especificacion-tecnica.js`

Compone el documento de la Especificación Técnica desde el `datos.json` del expediente. HTML, no PDF: el PDF lo produce el navegador (ADR-012, verificado — es la mecánica que la División ya usa a diario).

El documento tiene que incluir: encabezado con la unidad y el número de expediente, identificación del requerimiento, la tabla de renglones con código, cantidad, unidad y **la aclaración cuando exista** —si la aclaración no se imprime, la diferencia queda sólo en la base y el proveedor cotiza otra cosa—, la fundamentación, el operador solicitante con su correo, la fecha, y el espacio de firma.

### 3.2 — Hoja de impresión

`app/css/impresion.css`, cargada con `media="print"`:

- Tamaño A4 con márgenes razonables, sin cortar filas de la tabla de renglones por la mitad.
- Encabezado y número de página en cada hoja.
- Se ocultan los controles de la aplicación: sólo se imprime el documento.
- El resultado tiene que ser legible en blanco y negro: la impresora de la División no es a color.

El botón *Imprimir / Guardar como PDF* llama a `window.print()`. Nada de librerías (ADR-012).

### 3.3 — El documento generado se guarda en la carpeta del expediente

`SGC.adapters.repo.guardarEntregable` existe en la interfaz desde la ronda 3 y nunca se implementó. Implementalo: el HTML compuesto se guarda en la carpeta del expediente, se registra en `entregables` del `datos.json`, y queda enlazado desde la vista.

Recordá **ADR-016**: la app guarda el documento **generado**, no el firmado. El firmado vive en el sistema de firmas y acá sólo se referencia.

### 3.4 — Exportación para auditoría por IA

Del FSD §6 y de `InstruccionesCodigo.md` §12:

- **Botón "Exportar JSON"**: descarga el `datos.json` crudo del expediente.
- **`resumen.md` generado automáticamente**: un relato en prosa de los hitos del expediente, armado desde la auditoría y el histórico — quién hizo qué, cuándo y desde qué equipo, en orden cronológico y en español legible.
- El `resumen.md` **declara explícitamente** que los instrumentos firmados están fuera del sistema (ADR-016). Sin esa línea, un modelo que lea el export va a concluir que el expediente está incompleto o adulterado.
- **Modal de advertencia obligatorio antes de toda descarga** (FSD §6): recuerda que se está sacando información de un sistema aislado y que el manejo queda bajo responsabilidad del operador. Con confirmación explícita, botón con texto descriptivo, no un "Aceptar" pelado.

### 3.5 — Tests

Conservando en verde todo lo anterior, en un clon limpio:

1. **El ataque de §2.1 falla**: transición pedida por un rol que no corresponde → `403`, y el expediente en disco intacto. Probado por los extremos nuevos y por `PUT`.
2. `PUT` que intenta cambiar el estado → `409`, sin escritura.
3. Los 18 estados: por cada uno, el rol correcto avanza por el extremo nuevo y **los otros seis reciben `403`**. Un subtest por estado, no un test monolítico.
4. Devolución por el extremo nuevo: sin motivo válido → `403`.
5. `repo.memoria` y `repo.http` dan el mismo resultado en los casos nuevos, rechazo por rol incluido.
6. La auditoría de una transición la escribe el servidor y registra el origen de la petición.
7. El documento generado contiene todos los renglones, y **las aclaraciones aparecen**.
8. El `resumen.md` contiene la declaración de ADR-016 y las entradas de auditoría en orden.
9. Ninguna descarga ocurre sin pasar por el modal de advertencia.

### 3.6 — `INFORME-RONDA-07.md`

Las nueve secciones de siempre. En la 6 (riesgos), decí explícitamente si queda algún camino por el cual el estado de un expediente pueda cambiar sin pasar por el motor del servidor.

---

## 4. Reglas de conducta y cierre

Las siete de `ORDEN-RONDA-01.md` §3. La documentación sigue siendo de sólo lectura — **ADR-021 la escribí yo; no la toques**.

Cierre: `node --test` y el guardián en verde en un clon limpio, informe completo, **un solo commit** con mensaje `Ronda 7 — ADR-021 autorizacion y entregable de Fase 1`, sin push, `git status` limpio.

---

## 5. Criterios de aceptación

| # | Verificación | Resultado exigido |
|---|---|---|
| 1 | `node --test` en un clon recién hecho | Todo en verde |
| 2 | `node tools/check-compat.js` | Salida 0 |
| 3 | **El ataque de §2.1** | `403`, expediente intacto en disco |
| 4 | `PUT` que cambia el estado | `409`, sin escritura |
| 5 | Matriz 18 × 7 **por el servidor** | El rol correcto avanza; los otros seis reciben `403` |
| 6 | Devolución sin motivo válido por el extremo nuevo | `403` |
| 7 | `repo.memoria` y `repo.http` | Misma semántica en los casos nuevos |
| 8 | Test de permisos partido | Un fallo identifica la combinación exacta |
| 9 | Archivos sobre 400 líneas | Ninguno |
| 10 | Documento de Especificación Técnica | Renglones completos, aclaraciones impresas |
| 11 | Impresión | A4, legible en blanco y negro, sin controles de la app |
| 12 | `resumen.md` | Hitos en orden y la declaración de ADR-016 |
| 13 | Descargas | Ninguna sin el modal de advertencia |
| 14 | `INFORME-RONDA-07.md` con sus 9 secciones | Completo |

Se va a correr una **batería externa** que ataca los extremos de transición con roles equivocados y verifica el disco después de cada intento.

---

## 6. Qué se está evaluando

Que el circuito administrativo sea el que decide, siempre — no la interfaz, que es sólo la puerta de entrada más cómoda.

Pesa, en este orden: (1) que el agujero de autorización quede cerrado por los dos caminos, el nuevo y el viejo, (2) que la matriz de 18 × 7 se cumpla **en el servidor**, (3) que el documento impreso sea presentable para firma sin retoques, (4) la exportación y su advertencia, (5) las correcciones menores, (6) honestidad del informe.

La validación del cliente es una comodidad para el usuario. La del servidor es la que gobierna.
