# ORDEN DE AUDITORÍA — CICLO 07

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **ADR-021 (autorización en el servidor) + entregable de Fase 1**, según `ordenes/ORDEN-RONDA-07.md`
Emitida: 2026-08-18

---

## 0. Tu rol

Valen íntegramente `ordenes/ORDEN-RONDA-04-AUDITORIA.md` §0 y §1, y la verificación de conducta de `ORDEN-RONDA-05-AUDITORIA.md` §1.

### Tu ciclo anterior

El mejor reporte de los tres. Hiciste exactamente lo que se te había señalado: en vez de repetir el riesgo que el desarrollador declaró en su informe, lo verificaste, construiste el escenario de ataque concreto, lo elevaste a severidad alta y diste tu opinión sobre si era aceptable. Ese hallazgo **es el más serio del proyecto** y disparó ADR-021.

Lo reproduje yo mismo contra el servidor real y salió idéntico a como lo describiste: un `generador` llevando un expediente del paso 1 al 18 con un solo `PUT`, respuesta `200`.

También extendiste por tu cuenta la verificación de las correcciones más allá de lo pedido —cinco formas de borrador inválido, seis del extremo de validación de códigos— y levantaste un defecto de tu propia suite (el test de permisos monolítico) sin que nadie te lo pidiera. Las dos cosas son lo que corresponde.

### Accesos fuera del repositorio

`os.tmpdir()` y puertos locales `127.0.0.1`. Nada más.

### Si tu sesión se interrumpe

Te pasó dos veces el ciclo pasado y lo informaste, que fue lo correcto. Si vuelve a pasar: commiteá lo que tengas antes de nada, y dejá en el reporte qué quedó sin verificar. Un reporte parcial y honesto vale; uno que omite lo que no llegó a hacer, no.

---

## 1. Verificación de conducta

Los tres de siempre, primero: `git diff` sobre documentación y `ordenes/`, `tools/scraper-catalogo/` intacto, un solo commit y `git status` limpio.

**Este ciclo agrega uno:** `BITACORA_DECISIONES.md` incorpora **ADR-021**, escrita por el revisor. Verificá que el desarrollador **no la haya modificado**: comparala contra la versión que trae el commit del revisor.

---

## 2. El blanco principal: ¿quedó cerrado el agujero?

Es el 70% de esta auditoría. No te conformes con que los tests del desarrollador estén en verde.

### 2.1 — Reproducí el ataque original

El mismo que reportaste, tal cual, contra el servidor nuevo. Tiene que devolver `403` y **el expediente en disco no puede haber cambiado**. Verificá el disco, no sólo el código de respuesta.

### 2.2 — Buscá los caminos que quedaron

Cerrar una puerta no cierra la casa. Probá, como mínimo:

- `PUT` que cambia el estado → debe dar `409`. ¿Y si cambia la **fase** pero no el `id` del estado? ¿Y si cambia `estado.desde`?
- Los extremos nuevos con un `destino` que **no está** en `estadosSiguientes` del estado actual.
- Los extremos nuevos con un `destino` que sí es válido pero con **el rol de otro sector**.
- Devolución hacia un estado que no está en `estadosDevolucion`.
- Un `idMotivo` que no existe en el catálogo cerrado, y uno vacío o nulo.
- **El contexto manipulado:** ¿qué pasa si el cliente manda `contexto.rol` de un rol que no le corresponde al correo del padrón? ¿El servidor cruza el rol declarado contra `config/usuarios.ejemplo.json`, o le cree al cliente? Si le cree, es un hallazgo: la autorización se movió al servidor pero sigue dependiendo de un dato que el cliente elige.
- ¿Se puede escribir el `auditoria` del expediente por `PUT`, agregando o borrando entradas a mano?
- ¿Se puede saltear el motor escribiendo directamente `version` para forzar el bloqueo optimista?

### 2.3 — La matriz de 18 × 7, ahora del lado del servidor

Recorré los dieciocho estados contra el **servidor real**, no contra el motor en memoria. Por cada estado, el rol ejecutor avanza y los otros seis reciben `403`. Son 126 peticiones de avance más las de devolución: es un bucle.

Y después de cada rechazo, **confirmá que el archivo en disco no se tocó** — ni el `datos.json`, ni el `idx/`, ni el histórico.

### 2.4 — Paridad de los dos adaptadores

`repo.memoria` y `repo.http` tienen que dar el mismo resultado en los casos nuevos, rechazo por rol incluido. Si uno acepta lo que el otro rechaza, los tests que corren sobre memoria dejan de significar algo.

---

## 3. El entregable

### 3.1 — El documento

- ¿Aparecen **todos** los renglones? Probá con uno solo, con veinte, y con uno que tenga aclaración de exactamente 200 caracteres.
- **Las aclaraciones, ¿se imprimen?** Es lo que la orden marca como crítico: si no salen en el papel, la diferencia queda sólo en la base y el proveedor cotiza otra cosa.
- ¿Qué pasa con un expediente sin renglones, o sin fundamentación?
- Inyección: un título o una aclaración con `<script>` o `<img onerror>`, ¿llegan al documento escapados? El documento se compone desde datos del usuario y es la superficie que faltaba revisar.

### 3.2 — La impresión

Sin navegador no vas a poder mirar el resultado. Verificá lo verificable: que `impresion.css` se cargue con `media="print"`, que oculte los controles de la aplicación, que fije A4 y que no dependa del color para nada legible. Lo que no puedas confirmar, a sospechas.

### 3.3 — La exportación

- El `resumen.md`: ¿las entradas están en orden cronológico? ¿Está la declaración de ADR-016 sobre los instrumentos firmados? Sin esa línea, un modelo que lea el export concluye que el expediente está incompleto.
- ¿Alguna descarga esquiva el modal de advertencia? Probá los tres caminos: JSON, resumen y documento.
- El `datos.json` exportado, ¿es el crudo o una versión recortada?

---

## 4. Regresiones

Las de siempre, obligatorias: concurrencia de `PUT` en tres corridas, numeración concurrente, recorrido de rutas, presupuesto del catálogo, alta completa, Fast-Track hostil, borrador inválido, y el recorrido completo de los 18 estados.

**Atención especial al recorrido completo:** ahora tiene que pasar por los extremos nuevos. Si `tools/recorrido-completo.js` sigue funcionando con el `PUT` viejo, o el recorrido no se migró, o el `PUT` sigue moviendo estados.

Conservá y volvé a correr tu batería `a1`–`a9`.

---

## 5. El reporte — `AUDITORIA-CICLO-07.md`

Misma estructura de diez secciones que el ciclo anterior, con la sección de riesgos declarados y tu opinión sobre cada uno, que este ciclo probó su valor.

Agregá una sección propia:

```
## 11. Superficie de autorización
Todos los caminos por los que el estado de un expediente puede cambiar, y para
cada uno si está gobernado por el motor del servidor. Si encontrás uno que no
lo está, es un hallazgo de severidad alta.
```

Severidades como siempre. Cierre: un solo commit, `Auditoria ciclo 07`, sin push.

---

## 6. Qué se espera de vos

El ciclo pasado encontraste que la puerta estaba abierta. Este ciclo hay que confirmar que quedó cerrada **y que no hay ventanas**.

Es un tipo de verificación distinto al de las rondas anteriores: no alcanza con probar que el camino previsto funciona. Hay que buscar los caminos **no previstos**, que es donde vive siempre este tipo de defecto. La pregunta que guía toda la auditoría es una sola: *¿existe alguna secuencia de peticiones que mueva un expediente sin que el motor del servidor lo autorice?*

Si la respuesta es no, y lo demostraste habiéndolo intentado en serio, ese es el resultado más valioso que podés entregar.
