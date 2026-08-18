# ORDEN DE AUDITORÍA — CICLO 06

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **H6 — Tablero Kanban, roles y transiciones**, según `ordenes/ORDEN-RONDA-06.md`
Emitida: 2026-08-14

---

## 0. Tu rol

Valen íntegramente `ordenes/ORDEN-RONDA-04-AUDITORIA.md` §0 y §1, y la verificación de conducta de `ORDEN-RONDA-05-AUDITORIA.md` §1.

### Tu ciclo anterior

Buen trabajo. Verificación de conducta completa con los tres `git diff`, el clon limpio corrido de verdad en un temporal, la batería hostil contra el Fast-Track a fondo —`__proto__`, 100.000 niveles de anidamiento, 47 MB— y el corte real del servidor a mitad del alta. Cerraste tu propio hallazgo del ciclo 4 con medición propia en lugar de creerle al informe, que es exactamente lo que corresponde.

**Lo que se te quedó corto:** anotaste que `codigos.json` pesa 2,5 MB y lo dejaste como "riesgo declarado por el desarrollador". Un riesgo que el autor ya asumió no deja de ser un riesgo: sigue siendo tu trabajo discutir si es aceptable. Fui a mirar cómo se cargaba y el problema era real —2,5 MB sin comprimir hacia una PC con Windows 7 cada vez que alguien usa el Fast-Track— con una solución mejor disponible del lado del servidor. Es la corrección 2.2 de este ciclo.

**La lección:** cuando el informe del desarrollador declara un riesgo, no lo repitas. Medilo, mirá cómo se manifiesta en el peor caso realista, y decí si te parece aceptable o no. Un riesgo declarado y aceptado por el autor es exactamente donde nadie más va a mirar.

### Accesos fuera del repositorio

`os.tmpdir()` y puertos locales `127.0.0.1`. Nada más.

---

## 1. Verificación de conducta

Los tres puntos de siempre, primero: `git diff` de la documentación y de `ordenes/`, `tools/scraper-catalogo/` intacto, un solo commit y `git status` limpio.

---

## 2. Qué auditar

### 2.1 — Los criterios de aceptación

Los doce del §5 de la orden de trabajo, uno por uno, con evidencia.

### 2.2 — Las correcciones arrastradas

Las tres de la §2. La 2.1 (borrador inválido) es tuya: tus tests `a7` la reproducen, así que te toca cerrarla — y probá **más formas** que las dos que ya reprodujiste: `renglones` como cadena, como número, como objeto, con elementos que no son objetos, y un borrador cuyo JSON directamente no parsea.

Para la 2.2, verificá que `codigos.json` ya no se descargue en el cliente y que el extremo nuevo devuelva **exactamente** los códigos inexistentes: ni de más ni de menos. Probá con una lista donde todos existan, donde ninguno exista, con duplicados, con la lista vacía, y con más códigos que el máximo documentado.

### 2.3 — La matriz de permisos, los 18 estados

Es lo más importante del ciclo y lo más fácil de aprobar por muestreo.

**No muestrees: recorré los dieciocho.** Para cada estado, verificá que el rol ejecutor puede avanzar y que **cada uno de los otros seis roles no puede**. Son 18 × 7 combinaciones; es un bucle, no un trabajo manual. Verificá lo mismo para la devolución.

Y buscá el camino de atrás: ¿se puede provocar una transición saltando la vista y pegándole directo a la API con un rol que no corresponde? El motor de dominio valida, pero **¿valida el servidor?** Si la única defensa está en el cliente, es un hallazgo de severidad alta.

### 2.4 — El recorrido completo

Corré `tools/recorrido-completo.js` y después verificá el resultado por tu cuenta: leé el `datos.json` final, contá las entradas de auditoría, comprobá que la secuencia de estados es la del FSD §4, que la devolución y el reavance quedaron registrados, y que `verificarCadena` da íntegra.

Después rompelo: adulterá una entrada intermedia del `auditLog` en disco y confirmá que `verificarCadena` la detecta y devuelve el índice correcto.

### 2.5 — El tablero

- ¿Se arma **sólo** desde `GET /api/indice`? Instrumentá el servidor o mirá el registro de peticiones: si aparece un `GET /api/expedientes/:id` por cada tarjeta, la regla de ADR-005 se está violando y el tablero no va a escalar.
- Con 100 expedientes en el índice, ¿carga por debajo de un segundo? Medilo vos.
- ¿Todos los roles ven el tablero completo? La restricción es sobre las acciones, no sobre la vista.
- ¿Aparece algún rastro de arrastrar y soltar? Está prohibido.

### 2.6 — El conflicto de concurrencia en pantalla

Forzalo de verdad: dos guardados sobre la misma versión. ¿El segundo produce un aviso legible y una opción de recargar, o una excepción en consola? ¿Puede el usuario perder lo que escribió al recargar?

### 2.7 — Regresiones

Las de siempre, obligatorias: concurrencia de `PUT` en tres corridas, numeración concurrente, recorrido de rutas, presupuesto del catálogo, alta completa del ciclo 5, y el Fast-Track hostil. Conservá y volvé a correr tu batería `a1`–`a9`.

### 2.8 — Fidelidad a las decisiones de arquitectura

Con foco en ADR-005 (índice fragmentado, el tablero no abre los `datos.json`), ADR-010 (columnas por fase), ADR-011, ADR-017 (el correo como identidad en la auditoría) y ADR-019.

---

## 3. El reporte — `AUDITORIA-CICLO-06.md`

Misma estructura que el del ciclo 05, con las diez secciones. Mismas severidades.

Agregá al final de la §9 una subsección corta:

```
### Riesgos que el desarrollador declaró y mi opinión sobre cada uno
Por cada riesgo del informe §6 del desarrollador: si lo verificaste, cómo se
comporta en el peor caso realista, y si te parece aceptable o no. No alcanza
con repetirlo.
```

Cierre: un solo commit, `Auditoria ciclo 06`. Sin push.

---

## 4. Qué se espera de vos

Este ciclo tiene un blanco que no existía antes: **la autorización**. Hasta ahora, si algo estaba mal, se rompía. A partir de acá, si la matriz de permisos está mal, no se rompe nada: simplemente alguien avanza un expediente que no le correspondía, y nadie se entera hasta que hay un problema administrativo.

Un botón que deja pasar a quien no corresponde es invisible. Buscá esa clase de defecto con la misma energía con la que buscaste la inyección en el Fast-Track.
