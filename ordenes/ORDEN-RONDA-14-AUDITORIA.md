# ORDEN DE AUDITORÍA — CICLO 14

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **H18 — Credenciales, jerarquía de roles y administración del padrón**, según `ordenes/ORDEN-RONDA-14.md`
Emitida: 2026-08-28

---

## 0. Tu rol

Valen `ORDEN-RONDA-04-AUDITORIA.md` §0 y §1, la verificación de conducta de `ORDEN-RONDA-05-AUDITORIA.md` §1, el control de entrega, y la integridad de la bitácora sobre **34 ADRs**.

### Tu ciclo anterior

**Fue el mejor trabajo de auditoría del proyecto**, y no porque no encontraras nada.

Para H14 elegiste el blanco correcto sin que nadie te lo explicara: **auditaste lo que no se copió, no lo que se copió**. Armaste un origen cargado —presupuestos, valores de referencia, imputación, preventivos, orden de compra, entregables, eventos, renglones con precio— y después revisaste el `datos.json` del nuevo **campo por campo**. Hasta te fijaste en que la auditoría del nuevo fuera su propia creación y no la del origen. Y verificaste que la copia fuera lista blanca **leyendo cómo se construye**, no confiando en el resultado.

Después hiciste algo que nadie te había pedido antes: **mediste fricción**. Dos clics y un campo. Es un criterio incómodo de auditar porque no es una falla técnica, y lo resolviste contando.

Y verificaste el anexo de EETT **componiendo el documento**, no leyendo el código. Esa distinción es la diferencia entre una auditoría y una revisión.

**El `MOTIVOS.md` quedó creado, con los diecinueve rojos y sus causas correctas** — y declaraste que no existía y que era tuyo mantenerlo. Nadie te lo estaba reclamando.

### Este ciclo es distinto a todos los anteriores

Hasta ahora auditaste **si el sistema hace lo que dice**. Este ciclo tenés que auditar **si el sistema puede probar quién hizo cada cosa** — que es otra pregunta, y más difícil, porque un sistema de identidad roto **funciona perfectamente**: todos entran, todo anda, y los registros son ficción.

### Accesos fuera del repositorio

`auditoria\bateria\`, `os.tmpdir()` y `127.0.0.1`. Nada más.

---

## 1. Verificación de conducta

Los siete: accesos, documentación intocable (**ADR-021 a ADR-034**, órdenes y `referencias/`), integridad de la bitácora, honestidad del informe, control de entrega, `MOTIVOS.md` al día, y **las nueve secciones del informe del desarrollador, por nombre**.

---

## 2. El blanco principal: ¿se puede actuar como otro?

Es el 50% de esta auditoría. Y la regla que la gobierna: **pegale al servidor, siempre**. Una identidad que sólo existe en la pantalla no es una identidad.

- **El rol tiene que venir de la sesión, no del cuerpo.** Mandá un `contexto.rol` distinto del que te corresponde y verificá que **se ignore**, no que se rechace: si el servidor lo lee y lo compara, sigue leyendo un dato que elige el cliente.
- **Sin cookie de sesión**, ¿qué hace cada extremo? Probá los de siempre —`PUT`, `/avanzar`, `/devolver`, presupuestos, imputación, eventos— y también los nuevos.
- **Cookie de otro operador**: ¿se puede reusar? ¿Se puede adivinar? Mirá cómo se genera el identificador.
- **La sesión, ¿vive del lado del servidor?** Si el navegador guarda algo que el servidor cree sin verificar, es lo mismo que antes con más pasos.
- **Cierre por inactividad**: ¿a los 15 minutos de verdad? ¿Y qué pasa con una petición que llega justo después?
- **Cerrar sesión**, ¿invalida la sesión del lado del servidor, o sólo borra la cookie?

### La jerarquía

- Un `contrataciones_supervisor` **puede** ejecutar un paso de `contrataciones`. Un `contrataciones` **no puede** ejecutar uno de supervisor. Los dos, contra el servidor.
- **¿La herencia se filtró para el otro lado?** Un `abastecimiento_supervisor` no puede ejecutar nada de `contrataciones`. Probá la matriz cruzada completa.
- **La matriz 18 × 7 no puede haberse duplicado.** Si el desarrollador agregó filas en vez de consultar el conjunto, es exceso de alcance y una fuente de errores futuros.
- **El rol efectivo en la auditoría**: cuando el supervisor actúa como supervisado, ¿queda `supervisor actuando como X`, o queda sólo el rol de la persona? Lo segundo es un hallazgo: se pierde con qué facultad se actuó.

---

## 3. La clave provisoria · el punto que sostiene todo

Mientras la clave la conozca el Jefe de Contrataciones, **el registro no puede distinguir entre el operador y él**. Todo depende de que el primer ingreso obligue a cambiarla, y de que esa obligación no se pueda esquivar.

Con una credencial provisoria, probá **todos los extremos del sistema, uno por uno** — no la pantalla:

- `PUT` de un expediente, `POST` de creación, `/avanzar`, `/devolver`, subida de presupuestos, imputación, exportaciones, eventos, sugerencias, archivo histórico, usar como base.
- **Todos tienen que rechazar.** El único que responde es el de cambio de clave.
- ¿Y si el operador cambia la clave **por una igual a la provisoria**? ¿Y por una vacía?
- Después del cambio: **la clave vieja no sirve**, y `provisoria` quedó en falso.

### La reposición

- Deja un evento con **quién la repuso, para quién y cuándo**. Verificalo en el archivo, no en la pantalla.
- ¿Puede reponer una clave alguien que no sea el Jefe? Probalo con los otros seis roles.
- ¿La credencial repuesta vuelve a nacer **provisoria**? Si no, el ciclo se rompe y el Jefe queda conociendo una clave definitiva.
- Y el caso incómodo: **¿el propio Jefe puede reponerse la suya?** Decí qué pasa; no es obvio cuál es la respuesta correcta.

---

## 4. El padrón

- **No alcanzable por HTTP.** Buscalo activamente: probá rutas directas, recorrido de rutas, y fijate si algún extremo lo devuelve entero por accidente —un `GET /api/usuarios` que sirva la lista con hashes cuenta—.
- **Ninguna clave en texto plano en disco.** Recorré la carpeta de datos entera después de dar de alta a alguien: padrón, respaldos, temporales, logs, `eventos.jsonl`. Y fijate que **la clave no aparezca en ningún evento**.
- **La baja no borra**: `activo: false`, y el nombre sigue en los expedientes viejos. Probá que un operador dado de baja **no pueda entrar** y que su nombre **siga apareciendo**.
- **`tools/padron.js`**: ¿imprime la clave una sola vez? ¿La deja en algún archivo, en un temporal, en un historial? Miralo.
- **Alta masiva desde archivo**: probá con un archivo con una línea mal formada, un correo repetido, un rol inexistente y un campo faltante. ¿Rechaza la línea o el archivo entero? Cualquiera de las dos está bien si **avisa cuál**; lo que no puede es aceptar a medias en silencio.

---

## 5. Lo que queda cerrado por rol

`GET /api/eventos` y el compendio de sugerencias eran accesibles para cualquiera. Verificá **contra el servidor** que ahora no lo sean, y el otro lado: **que cada rol siga viendo los indicadores de su propio tablero.** Cerrar de más también es un defecto.

---

## 6. Regresiones

Las de siempre, y prestá atención a una cosa: **esta ronda toca el punto por donde pasa todo lo demás.** La matriz 18 × 7 con sus 13 escenarios laterales, el recorrido completo de los 18 estados, la concurrencia, los adjuntos, el archivado y la recuperación ante desastre **tienen que seguir pasando con sesión autenticada**. Si algún test viejo sigue verde porque saltea la autenticación, eso es un hallazgo.

Batería completa desde `auditoria\bateria\`, con `MOTIVOS.md` al día. Es probable que varios rojos cambien de causa este ciclo: **anotalo**.

---

## 7. El reporte — `AUDITORIA-CICLO-14.md`

Misma estructura. Tres secciones propias:

```
## ¿Se puede actuar como otro?
Cada intento, con el extremo, la petición y la respuesta del servidor.

## La clave provisoria contra todos los extremos
Uno por uno. Cualquiera que responda algo distinto de un rechazo es severidad alta.

## Dónde aparece una clave
Todo lugar del disco que revisaste después de dar de alta a alguien.
```

Cierre: un solo commit, `Auditoria ciclo 14`, sin push.

---

## 8. Qué se espera de vos

Un sistema de identidad roto **no se rompe**. Todos entran, todo funciona, nadie se queja — y los registros de tiempos, la traza de auditoría y los catorce tipos de evento pasan a describir a alguien que no necesariamente hizo nada de eso.

No hay síntoma que buscar. Hay que ir a probar si se puede.

La pregunta que guía esta auditoría: **¿puedo hacer que el sistema registre a otra persona haciendo lo que hago yo?**
