# ORDEN DE AUDITORÍA — CICLO 05

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **H5 — Wizard de Fase 1**, según `ordenes/ORDEN-RONDA-05.md`
Emitida: 2026-08-14

---

## 0. Tu rol

Sos el auditor. Trabajás sobre un clon del repositorio del desarrollador y tu único entregable es un reporte. Valen íntegramente las reglas de `ordenes/ORDEN-RONDA-04-AUDITORIA.md` §0 y §1: no modificás la aplicación, sin reproducción no hay hallazgo, no completás lo que falte, y ni un hallazgo inventado ni uno callado.

### Tu ciclo anterior

Tu reporte del ciclo 04 fue bueno: cuatro hallazgos, todos con reproducción, todos verdaderos. El segundo —los tramos de coincidencia calculados sobre un texto y aplicados a otro— fue verificado de forma independiente y es un defecto real que la suite del propio desarrollador dejaba pasar porque validaba contra el mismo supuesto que lo causó. Ese es exactamente el hueco que existís para cubrir. Rehacer las mediciones en vez de creerle al informe, y separar lo confirmado de lo sospechado, fue lo correcto.

**Lo que se te pasó, y por eso esta orden lo agrega explícitamente:** el desarrollador había editado `BITACORA_DECISIONES.md`, que es de sólo lectura por la regla 1 de conducta, agregando una ADR de su autoría. Vos la citaste con aprobación sin notar quién la había escrito. Estaba a un `git diff` de distancia.

La lección es general: **auditás el producto y también la conducta.** Un trabajo puede ser correcto y aun así haberse hecho fuera de las reglas, y las reglas existen porque en este proyecto hay una sola persona que decide la arquitectura.

### Accesos fuera del repositorio

`os.tmpdir()` y puertos locales `127.0.0.1`. Nada más.

---

## 1. Verificación de conducta (nueva, va primero)

Antes de auditar el producto, tres comprobaciones mecánicas sobre el historial:

1. **`git diff` del commit del ciclo contra el anterior, filtrado por documentación.** ¿Se tocó `BITACORA_DECISIONES.md`, `PLAN_DESARROLLO.md`, `FullScopeDoc.md`, `InstruccionesCodigo.md`, `AUDITORIA_InstruccionesCodigo.md`, `RELEVAMIENTO_ENTORNO.md` o cualquier archivo de `ordenes/`? **Cualquier cambio ahí es un hallazgo de severidad media**, aunque el contenido sea correcto.
2. **¿`tools/scraper-catalogo/` quedó intacto?**
3. **¿Hay un solo commit del ciclo, y `git status` limpio?** Trabajo sin registrar es trabajo no entregado.

Reportalas en una sección propia, con el resultado de cada `git diff`.

---

## 2. Qué auditar en el producto

### 2.1 — Los criterios de aceptación

Los trece del §5 de la orden de trabajo, uno por uno: cumple o no cumple, con evidencia al lado.

### 2.2 — Las correcciones arrastradas

La §2 de la orden de trabajo tiene seis correcciones. Verificá cada una y decí si quedó resuelta. Con particular atención a dos:

- **Los tramos de coincidencia.** No te alcance con que el test nuevo esté en verde: **rehacé la comprobación vos**, sobre el catálogo real, muestreando al menos veinte términos distintos, y verificando que cada índice sea válido dentro del texto que la pantalla muestra y que el fragmento resaltado contenga efectivamente el término. Fue tu hallazgo; te toca cerrarlo.
- **El clon limpio.** Cloná el repositorio a un directorio temporal y corré `node --test` **ahí**, sin ningún archivo externo. Ese es el criterio 1 y el ciclo pasado no se cumplía.

### 2.3 — El wizard

Es lo nuevo y es lo que va a tocar una persona.

- **Validación:** ¿se puede avanzar de paso con datos inválidos por algún camino? Probá el Enter en un campo, el botón de siguiente con el formulario vacío, y saltar al paso 4 manipulando el estado desde la consola.
- **El borrador:** ¿sobrevive de verdad a la recarga? ¿Se le ofrece a un operador distinto del que lo escribió? ¿Se limpia al persistir con éxito? ¿Qué pasa si el borrador guardado está corrupto o es de una versión vieja del formulario?
- **Retroceso:** volver un paso y avanzar de nuevo, ¿pierde datos?

### 2.4 — Fast-Track: es el punto de entrada hostil

Es la superficie más peligrosa de todo el sistema: un archivo JSON de origen externo, posiblemente generado por una IA, que pre-puebla un formulario.

Atacalo en serio: JSON malformado; JSON válido con tipos equivocados (`cantidad` como cadena, `renglones` como objeto); códigos de catálogo inexistentes; aclaración de 201 y de 10.000 caracteres; `<script>` y `<img src=x onerror=...>` en cada campo de texto; claves inesperadas; anidamiento profundo; un archivo de 50 MB.

En todos los casos: mensaje legible, sin excepción sin capturar, sin formulario a medio llenar, y **sin que nada llegue al DOM sin escapar**.

### 2.5 — El alta completa

Levantá el servidor y dá de alta un expediente de punta a punta. Después mirá el disco: ¿está el `datos.json`? ¿Está su entrada en `idx/`? ¿El número es único? ¿La auditoría tiene la entrada de creación con el correo del operador y no con un nombre de usuario? ¿Quedó estampada la `catalogoVersion`?

Y el caso feo: **cortá el servidor a mitad del alta**. ¿Se pierde el borrador? ¿Qué ve el usuario?

### 2.6 — Teclado y accesibilidad

El criterio 12 pide el recorrido completo sin mouse, del primer campo a la confirmación. Verificalo hasta donde puedas sin navegador y decí explícitamente qué quedó sin verificar. El ciclo pasado hiciste bien en mandar eso a sospechas en vez de afirmarlo.

### 2.7 — Regresiones

Todo lo de las rondas 1 a 4 sigue en pie. Obligatorio de nuevo, porque es lo más caro de romper sin darse cuenta:

- Concurrencia de `PUT`: **tres corridas**, 1×200 y 19×409 cada una.
- Numeración concurrente: 20 identificadores distintos.
- Recorrido de rutas con `../`.
- El presupuesto de rendimiento del catálogo: índice ≤ 300 KB, fragmento mayor ≤ 300 KB, `buscarClases` < 100 ms.

### 2.8 — Fidelidad a las decisiones de arquitectura

Contra `BITACORA_DECISIONES.md`, con foco en ADR-011 (techo Chrome 109), ADR-014 (`aclaracion` de 200, `catalogoVersion`), ADR-017 (el correo es la identidad, no un nombre de usuario), ADR-018 (ninguna petición al exterior) y ADR-019 (esquema v2: `estado` objeto, `auditoria`).

---

## 3. Tus tests adversarios

En `auditoria/tests-adversarios/`, con `node --test`. Un test en rojo por cada hallazgo confirmado, que se ponga en verde cuando el defecto se corrija.

Conservá y volvé a correr los del ciclo 04: son tu propia batería de regresión.

---

## 4. El reporte — `AUDITORIA-CICLO-05.md`

Misma estructura que el del ciclo 04, con una sección nueva al principio:

```
# AUDITORÍA — CICLO 05

## 1. Veredicto en una línea
## 2. Verificación de conducta          <- NUEVA: los tres puntos de §1
## 3. Criterios de aceptación           <- los trece
## 4. Correcciones arrastradas          <- NUEVA: las seis de la orden §2
## 5. Hallazgos confirmados             <- con reproducción, ordenados por severidad
## 6. Sospechas sin confirmar
## 7. Mediciones propias
## 8. Regresiones
## 9. Lo que está bien
## 10. Accesos fuera del repositorio
```

Severidades, igual que antes: **crítico** (pérdida de datos o no arranca), **alto** (criterio incumplido o falla de seguridad), **medio** (se desvía de una ADR o de una regla de conducta), **bajo** (prolijidad).

Cierre: un solo commit, `Auditoria ciclo 05`. Sin push. No toques el repositorio del desarrollador.

---

## 5. Qué se espera de vos

Lo mismo que la vez pasada, y funcionó: encontrar lo que la suite del autor no podía encontrar, con la reproducción al lado.

Este ciclo agrega un blanco nuevo y más fácil de errar: **el Fast-Track es la única puerta por la que entra un archivo de origen externo a un sistema aislado**. Si algo va a lastimar a este proyecto en producción, es más probable que entre por ahí que por cualquier otro lado. Dedicale el tiempo que haga falta.

Tres hallazgos reproducibles valen más que quince plausibles.
