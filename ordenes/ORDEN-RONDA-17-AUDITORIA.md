# ORDEN DE AUDITORÍA — CICLO 17

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **H21 — administración del padrón desde la aplicación** y **el cierre de H10 y H20**, según `ordenes/ORDEN-RONDA-17.md`
Emitida: 2026-09-01 · **Reemplaza a la versión anterior de esta misma orden**

---

## 0. Tu rol

Valen `ORDEN-RONDA-04-AUDITORIA.md` §0 y §1, la verificación de conducta de `ORDEN-RONDA-05-AUDITORIA.md` §1, el control de entrega, `MOTIVOS.md` al día, y la integridad de la bitácora sobre **37 ADRs**.

### Tu ciclo anterior

Te pedí que buscaras **"el camino que toma alguien apurado"** y lo encontraste en una línea: `pliegoProbado` es una palabra que manda el cliente. Publicaste una plantilla rota en un solo POST.

Pero lo mejor fue descubrir **por qué nadie lo había visto**:

> *El probador fabrica `plazo_entrega_servicio` y `garantia_servicio`, así que "Probar ahora" devuelve OK para servicios, enmascarando que la exportación real no los produce.*

**El probador prueba un expediente que el sistema nunca va a poder emitir.** Ese defecto no rompe nada, no aparece en ningún test, y hace que una función parezca funcionar cuando no puede. Es la clase de cosa que justifica que existas como agente separado.

Y volviste a declarar lo que no mediste —no corriste la batería completa y lo dijiste—. Esta vez **corrila entera**: el modo declarado dejó de ser el que sale por omisión y es probable que varios rojos hayan cambiado de causa.

### Lo que cambió en esta orden, y por qué

Los tres defectos de los ciclos 15 y 16 que más costaron —el servidor sin padrón, el comando del manual roto, la lista de roles inexistente— salían todos de la misma regla implícita: **el administrador hacía por consola lo que los demás hacen por pantalla.**

El Jefe de Contrataciones lo cortó de raíz: **el padrón se administra desde adentro**, y el único usuario previo es el administrador, que el servidor crea en el primer arranque. Quedó en **ADR-037**, que leés completa antes de empezar.

Eso te da **una superficie nueva y de las más delicadas del proyecto**: importar un archivo es recibir entrada hostil, y el que la recibe es el usuario con más permisos del sistema.

### Accesos fuera del repositorio

`auditoria\bateria\`; `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\` en **sólo lectura**, con permiso de ejecutar `scripts/generar_pliego.py` hacia una carpeta temporal; `os.tmpdir()` y `127.0.0.1`. Nada más.

---

## 1. Verificación de conducta

Los ocho de siempre, y **la batería completa**, con `MOTIVOS.md` actualizado: anotá cada rojo cuya causa haya cambiado.

---

## 2. El primer arranque · lo que va a hacer el Jefe de Contrataciones esta semana

Es el 25% de la auditoría y es literalmente lo que va a pasar en unos días.

- **Carpeta de datos vacía, servidor arranca.** ¿Crea el padrón? ¿Con quién? ¿Imprime la clave **una vez**, de forma que no se pueda pasar por alto?
- **Segundo arranque**: no puede crear nada de nuevo ni imprimir otra clave. Y el tercero tampoco.
- **La clave, ¿aparece en algún archivo?** Recorré la carpeta de datos entera después del primer arranque, y también el registro del servidor si escribe a disco. **Sólo el hash puede quedar.**
- **¿Hay alguna clave por omisión?** Buscala: en el código, en la configuración, en el instructivo, en los tests. Una clave por omisión es severidad **alta**, sin discusión.
- **Nace provisoria**: con la credencial del administrador recién creada, probá **todos los extremos** —como hiciste en el ciclo 14 con los catorce—. Sólo puede responder el cambio de clave.
- **¿Y si la configuración no trae administrador?** ¿O trae un correo inválido, o un rol que no existe? Tiene que **no arrancar y decir qué falta**, no arrancar a medias.
- **El modo declarado**, ¿sigue activándose sólo pidiéndolo? Es la regla de ADR-036 y el cambio de esta ronda la toca de cerca. Si aparece un camino nuevo por el que el servidor termina en declarado sin que nadie lo pida, es la regresión del ciclo.

---

## 3. La importación · entrada hostil en manos del usuario más poderoso

El 25%. **Importar un archivo es recibir entrada hostil**, y acá la recibe el administrador.

### Lo que la orden promete

- **El diff se muestra antes de aplicar**: creados, modificados con qué campo, y ausentes. Verificá que **muestre las tres cosas**.
- **Todo o nada**: una línea mala y no se aplica ninguna. Probá con la línea mala en la primera posición, en el medio y en la última.
- **La ausencia no desactiva por sí sola.** Importá un archivo al que le sacaste una fila y verificá que esa persona **siga activa**. Es la protección contra el error más probable: borrar una fila sin querer en Excel.
- **La importación no toca credenciales.** Importá un archivo con un correo existente y verificá que **su clave siga sirviendo**.

### Lo que hay que romper

- **Ida y vuelta**: exportá, importá sin tocar nada. **No puede cambiar nada.** Si cambia algo, el formato no es simétrico y alguien va a perder un dato.
- Un CSV con **BOM**, con `CRLF`, con `LF`, con línea vacía al final, con una línea de sólo punto y comas.
- Un **correo repetido** dentro del mismo archivo. Un correo con mayúsculas distintas al que ya existe — **¿son la misma persona?** Decidilo y decí qué hace.
- Un **rol inexistente**; un rol con espacios alrededor; el campo `activo` con `si`, `sí`, `SI`, `true`, `1`, vacío, y basura.
- **Inyección de fórmulas al revés**: un nombre que empiece con `=`. Y después **exportá** y mirá el CSV: es la misma superficie que cerramos en el ciclo 13, **en la otra dirección**.
- Un archivo **enorme** —diez mil líneas—, y un archivo **vacío**.
- Un archivo que **no es CSV**: un PDF renombrado, un JSON.
- Y el que importa: **¿otro rol puede importar?** Probá los siete contra el servidor.

### El encierro del administrador

Es la protección que hace todo lo demás seguro. **Intentá encerrarlo por los tres caminos:**

1. Desde la pantalla: darse de baja, quitarse la marca, cambiarse el rol.
2. Por API directa, salteando la pantalla.
3. **Por importación**: un archivo que lo omite, y otro que lo trae con `activo: no`.

Los tres tienen que fallar mientras sea el único administrador activo. Y probá el caso legítimo: **marcar a otro y después desmarcarse** tiene que funcionar.

---

## 4. La marca de administrador

- **Es una marca, no un rol.** Verificá que **no se haya agregado un octavo rol** y que la matriz 18 × 7 no haya crecido.
- **Qué gobierna**: administrar el padrón, ver el compendio crudo de eventos y de sugerencias, reponer claves. Probá los tres con un `contrataciones_supervisor` **que no sea administrador** — hasta ayer podía, y ahora no debería.
- **Qué no gobierna**: editar plantillas sigue siendo de `contrataciones_supervisor` o `juridica` (ADR-032 §5). Verificá que un administrador **sin** ninguno de esos dos roles no pueda publicar una plantilla.

---

## 5. Publicar una plantilla sin probarla

**Repetí tu ataque del ciclo 16, tal cual**, y después buscá los que quedan:

- `publicar` con `pliegoProbado: true` sin haber probado → rechazar.
- Probar, **cambiar una letra**, publicar → rechazar.
- Probar el contenido A, publicar el B → rechazar.
- Volver a una versión vieja y editarla sin probar → rechazar.
- **Después de reiniciar**: hay que probar de nuevo. Verificá que **falle cerrado**.
- **¿La bandera se ignora o se compara?** Si el servidor la lee para algo, sigue leyendo un dato que elige el cliente.

**Y buscá la quinta forma.** Vamos cuatro: el rol declarado, la guardia silenciosa, el padrón retratado, la prueba olvidada. Cada vez apareció con otro disfraz.

---

## 6. El pliego de servicios, y el probador

- **¿El probador arma su ejemplo con la función de exportación real?** Leelo. Si sigue fabricando campos a mano, la corrección no está hecha aunque los tests pasen.
- **La prueba del negativo**: sacale un campo a un expediente de servicios y verificá que **"Probar ahora" falle** — antes fallaba en la realidad y pasaba en la prueba.
- Armá un expediente de servicios **completo por la vía real**, exportá, **corré el generador real**. ¿Sale?
- **El de bienes tiene que seguir saliendo.**
- ¿Hay **otros** lugares con datos de ejemplo que la aplicación no produce? Buscá `ejemplo`, `fixture`, `dummy`, `construirDatos`.

---

## 7. Reproducibilidad y las chicas

- Estampá con la versión 1, publicá la 2, **regenerá el pliego viejo**: tiene que usar **la 1**. Si la estampada no existe, **decirlo**, no caer a la vigente.
- **Lectura de plantillas**: los siete roles autenticados ven; sólo dos publican. Y **el comentario de cabecera dice lo mismo que el código**.
- **Mensajes**: barré todo buscando dónde se concatena `e.message`. **La orden pidió la clase, no los dos casos.** Y probá sin `python` en el PATH.
- **La lista de roles del instructivo**: la orden pidió **borrarla**. Si sigue ahí, aunque esté bien, vuelve a divergir en tres meses.
- **La nota del seed sobre la numeración**: verdadera o corregida. La afirmación falsa no puede quedar.

---

## 8. Regresiones · con más cuidado que nunca

**Todo lo anterior, porque esto se instala después.** Matriz 18 × 7 con sus escenarios laterales, recorrido de los 18 estados, concurrencia de `PUT` y de numeración, adjuntos, archivado, **recuperación ante desastre con el padrón y las plantillas adentro**, ida y vuelta del YAML con los cuarenta textos, registro de eventos, guardias de ADR-029, el padrón vivo cortando sesiones, el arranque que no arranca a medias.

Batería completa, `MOTIVOS.md` al día.

---

## 9. El reporte — `AUDITORIA-CICLO-17.md`

Misma estructura. Cuatro secciones propias:

```
## El primer arranque, paso a paso
Lo que hace un servidor con la carpeta vacía. Y dónde quedó la clave.

## Cómo romper la importación
Un caso por fila: archivo, qué mostró el diff, qué aplicó.

## Los tres caminos para encerrar al administrador
Y si alguno funcionó.

## ¿Se puede instalar?
Tu recomendación, en una línea, con lo que la sostiene.
```

Esa última la va a leer el Jefe de Contrataciones antes de instalar. **Decí lo que pensás.**

Cierre: un solo commit, `Auditoria ciclo 17`, sin push.

---

## 10. Qué se espera de vos

Dos cosas.

**Que el primer arranque sea el que va a ser.** Lo que probás esta vez no es una hipótesis: es exactamente lo que va a pasar en unos días, con el Jefe de Contrataciones adelante de la pantalla y sin nadie a quien preguntarle.

**Y que la importación no pueda hacer daño en silencio.** Es la única función del sistema donde un error de un archivo de Excel puede dejar afuera a catorce personas — y la única superficie donde la entrada hostil llega directo al usuario con más permisos.

La pregunta que guía esta auditoría: **¿qué pasa si el archivo que sube el administrador está mal?**
