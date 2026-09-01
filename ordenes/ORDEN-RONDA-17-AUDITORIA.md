# ORDEN DE AUDITORÍA — CICLO 17

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **las seis correcciones del ciclo 16 — cierre de H10 y H20**, según `ordenes/ORDEN-RONDA-17.md`
Emitida: 2026-09-01

---

## 0. Tu rol

Valen `ORDEN-RONDA-04-AUDITORIA.md` §0 y §1, la verificación de conducta de `ORDEN-RONDA-05-AUDITORIA.md` §1, el control de entrega, `MOTIVOS.md` al día, y la integridad de la bitácora sobre **36 ADRs**.

### Tu ciclo anterior

Te pedí que buscaras **"el camino que toma alguien apurado"** y lo encontraste en una línea: `pliegoProbado` es una palabra que manda el cliente, así que se publica una plantilla rota en un solo POST. Lo verifiqué en el código.

Pero lo mejor no fue eso. Fue que **encontraste por qué nadie lo había visto**:

> *El probador fabrica `plazo_entrega_servicio` y `garantia_servicio` en su expediente de ejemplo, así que "Probar ahora" devuelve OK para servicios, enmascarando que la exportación real no los produce.*

**El probador prueba un expediente que el sistema nunca va a poder emitir.** Ese defecto no rompe nada, no aparece en ningún test, y hace que una función parezca funcionar cuando no puede. Es exactamente la clase de cosa que justifica que existas como agente separado.

Y volviste a hacer lo que te pedí desde el ciclo 12: **declaraste lo que no mediste**. No re-ejecutaste la batería completa y lo dijiste, en vez de afirmar sobre un dato que no tenías. Eso, en la ronda siguiente, hacelo igual — pero **sí correla completa esta vez**, porque el modo declarado dejó de ser el que sale por omisión y es probable que varios rojos hayan cambiado de causa.

### Este ciclo es la puerta

Si aprobás, **esto se instala** en un equipo de la intranet y catorce personas empiezan a usarlo. No hay hito nuevo: sólo seis correcciones y la puerta.

Lo que se te escape a partir de acá **lo encuentra un operador** — y en el caso de las plantillas, un proveedor leyendo un pliego.

### Accesos fuera del repositorio

`auditoria\bateria\`; `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\` en **sólo lectura**, con permiso de ejecutar `scripts/generar_pliego.py` hacia una carpeta temporal; `os.tmpdir()` y `127.0.0.1`. Nada más.

---

## 1. Verificación de conducta

Los ocho de siempre, y **la batería completa esta vez**, con `MOTIVOS.md` actualizado: anotá cada rojo cuya causa haya cambiado con el modo declarado fuera de la omisión.

---

## 2. El blanco principal: ¿sigue habiendo un camino?

Es el 40%. **Repetí tu propio ataque del ciclo 16, tal cual**, y después buscá los que quedan:

- `POST .../publicar` con `pliegoProbado: true` sin haber probado → tiene que **rechazar**.
- **Probar, cambiar una letra del contenido, publicar** → rechazar.
- Probar el contenido A, publicar el contenido B → rechazar.
- Volver a una versión vieja y editarla sin probar → rechazar.
- Publicar dos veces el mismo contenido probado una vez → decidí vos si está bien; **decilo en el informe**.
- **Después de reiniciar el servidor**: ¿hay que probar de nuevo? La orden dice que sí es correcto. Verificá que **falle cerrado**, no que publique.
- Y el que importa: **¿la bandera del cliente se ignora o se compara?** Si el servidor la lee para algo, sigue leyendo un dato que elige el cliente. Es la misma distinción de la ronda 14 con el `contexto.rol`.

**Y buscá el camino nuevo.** Cada vez que cerramos uno, aparece otro con otro disfraz. Vamos cuatro: el rol declarado, la guardia silenciosa, el padrón retratado, la prueba olvidada. **Buscá la quinta.**

---

## 3. El probador, que era el que mentía

- **¿Arma su expediente de ejemplo con la función de exportación real?** Leelo. Si sigue fabricando campos a mano, la corrección no está hecha, aunque los tests pasen.
- **La prueba del negativo**: sacale a un expediente de servicios uno de los dos campos y verificá que **"Probar ahora" falle** — antes fallaba en la realidad y pasaba en la prueba.
- ¿Hay **otros** lugares donde se fabriquen datos de ejemplo que la aplicación no produce? Buscá `ejemplo`, `fixture`, `dummy`, `construirDatos`. Es la misma clase.

---

## 4. El pliego de servicios, de punta a punta

- Armá un expediente de servicios **completo, por la interfaz o por la API real**, exportá, y **corré el generador real**. ¿Sale?
- Sin `plazo_entrega_servicio`: ¿**se avisa al cargar**, o se descubre cuando el pliego no sale?
- **El de bienes tiene que seguir saliendo.** Es la regresión que importa.
- Y el caso incómodo: un expediente que **cambia** de bienes a servicios a mitad de camino.

---

## 5. La reproducibilidad

Es el criterio que la orden anterior marcó como decisivo y quedó abierto.

- Estampá un expediente con la versión 1, publicá una versión 2, **regenerá el pliego del expediente viejo**. Tiene que usar **la versión 1**.
- Si la versión estampada **no existe** —borrada, o el archivo corrupto—: tiene que **decirlo**, no caer a la vigente en silencio.
- ¿Se puede pedir cualquier versión por el endpoint nuevo, o sólo las vigentes alguna vez?

---

## 6. Las tres chicas

- **La lista de roles del instructivo**: ¿coincide con `config.js`? **¿Y hay un test que lo verifique?** Si la coincidencia es de casualidad y no hay test, vuelve a divergir en tres meses.
- **Lectura de plantillas**: los siete roles autenticados **ven** plantillas e historial; sólo dos publican. Probá los siete. Y verificá que **el comentario de cabecera diga lo mismo que el código** — el ciclo pasado no coincidían.
- **Mensajes**: barré `ayudantes.js`, `pliego-probador.js` y todo lo demás buscando dónde se concatena `e.message` a un texto nuestro. **La orden pidió corregir la clase, no los dos casos.** Y probá el arranque sin `python` en el PATH.
- **La nota del seed sobre la numeración**: o la plantilla numera sola de verdad, o la nota se corrigió. **Lo que no puede quedar es la afirmación falsa** — el que lea ese archivo el año que viene va a creer que el problema está resuelto.

---

## 7. Regresiones · y esta vez con más cuidado que nunca

**Todo lo anterior, porque esto se instala después.** La matriz 18 × 7 con sus escenarios laterales, el recorrido de los 18 estados, concurrencia de `PUT` y de numeración, adjuntos, archivado, **recuperación ante desastre con el padrón y las plantillas adentro**, la ida y vuelta del YAML con los cuarenta textos, el registro de eventos, las guardias de ADR-029, el padrón vivo cortando sesiones, el arranque que no arranca a medias.

Y **la batería completa**, con `MOTIVOS.md` al día.

---

## 8. El reporte — `AUDITORIA-CICLO-17.md`

Misma estructura. Tres secciones propias:

```
## ¿Queda algún camino?
Cada intento de publicar sin probar, con la petición y la respuesta. Y la quinta forma, si la encontraste.

## El pliego de servicios, de punta a punta
Qué armaste, qué exportaste, qué salió del generador real.

## ¿Se puede instalar?
Tu recomendación, en una línea, con lo que la sostiene.
```

Esa última sección es nueva y es la que va a leer el Jefe de Contrataciones antes de poner esto en un equipo con gente. **Decí lo que pensás.**

Cierre: un solo commit, `Auditoria ciclo 17`, sin push.

---

## 9. Qué se espera de vos

Que **ninguna validación dependa de que el cliente diga la verdad**, y que **probar el sistema no sea probar una ficción**.

Las dos lecciones salieron de tu propio informe del ciclo 16, y son las dos que más lejos llegan: la primera porque es la cuarta vez que aparece, y la segunda porque es la única forma de defecto que **hace que un test pase cuando el sistema no funciona**.

La pregunta que guía esta auditoría: **¿qué le estamos probando al sistema que el sistema no puede hacer?**
