# ORDEN DE AUDITORÍA — CICLO 15

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **H10 (parcial) — paquete de despliegue y arranque como servicio**, más la corrección del padrón, según `ordenes/ORDEN-RONDA-15.md`
Emitida: 2026-08-29

---

## 0. Tu rol

Valen `ORDEN-RONDA-04-AUDITORIA.md` §0 y §1, la verificación de conducta de `ORDEN-RONDA-05-AUDITORIA.md` §1, el control de entrega, y la integridad de la bitácora sobre **35 ADRs**.

### Tu ciclo anterior

Auditaste lo más difícil de auditar: **un sistema de identidad roto no se rompe.** Todos entran, todo funciona, nadie se queja, y los registros pasan a describir a alguien que no hizo nada de eso. No había síntoma que buscar.

Fuiste a probar si se podía, **nueve veces**, con la petición y la respuesta del servidor en cada fila. Y entendiste por qué la orden decía *"que se ignore, no que se rechace"*: comprobaste que el contexto forjado **se reemplaza**, no se compara — si el servidor lo leyera para compararlo, seguiría leyendo un dato que elige el cliente.

Después probaste la clave provisoria contra **catorce extremos**, no contra la pantalla. Y recorriste **toda la carpeta de datos** buscando una clave en claro: padrón, eventos, índices, históricos, registros, temporales, respaldos.

Y encontraste la observación del ciclo, con su causa exacta: **el padrón se lee una sola vez al arrancar**, así que una baja no corta una sesión abierta. Más el corolario que nadie te pidió: si el servidor arranca antes de que exista el padrón real, todo da 403. Eso iba a pasar **el primer día de instalación**, que es esta semana.

Es la tercera vez que aparece la misma forma: **un dato que existe en dos lugares y puede divergir.** Como ADR-029 y como el emisor de YAML.

### Este ciclo cambia de naturaleza

Hasta ahora auditaste **software**. Este ciclo tenés que auditar **una instalación**: lo que el desarrollador entrega es lo que va a estar corriendo en un equipo de la intranet la semana que viene, con operadores reales y sin nadie mirando.

Eso te da un blanco distinto y bastante más incómodo: **no alcanza con que funcione cuando todo está en su lugar.** Tenés que probar qué pasa cuando algo falta, cuando la máquina se reinicia, cuando alguien actualiza mal, y cuando el disco se llena.

### Accesos fuera del repositorio

`auditoria\bateria\`, `os.tmpdir()` y `127.0.0.1`. Nada más.

**Y una advertencia explícita:** esta ronda produce un instalador que crea usuarios, carpetas y servicios del sistema. **No lo ejecutes fuera de un directorio temporal.** Si para probarlo hiciera falta tocar algo del sistema real, no lo hagas: describí en el informe qué no pudiste verificar y por qué. Es preferible una verificación incompleta y declarada a un sistema modificado.

---

## 1. Verificación de conducta

Los siete de siempre. Documentación intocable: **ADR-021 a ADR-035**, órdenes y `referencias/`.

Y una octava, propia de esta ronda: **el paquete no puede llevar lo que no se despliega.** Verificá que `tests/`, `datos-prueba/`, `ordenes/`, `auditoria/` y la documentación de trabajo **no estén** en lo que se instala. Un paquete que arrastra los tests arrastra también los datos de prueba, y eso termina en un servidor de producción.

---

## 2. El blanco principal: ¿el padrón tiene una sola fuente de verdad?

Es el 30% de la auditoría y es la corrección que traías vos.

- **Reproducí tu propio caso del ciclo 14**, tal cual: operador ingresa, opera, se le da de baja, y **con la misma cookie** intenta operar de nuevo. Tiene que cortarse o degradarse.
- **Cambio de rol**: un `contrataciones_supervisor` con sesión abierta al que se le baja a `contrataciones`, ¿pierde el paso de supervisor **sin volver a ingresar**?
- **Bloqueo por fallos**: si se bloquea a alguien con sesión abierta, ¿sigue operando?
- **Y al revés, que también importa:** un alta o un cambio de rol **hacia arriba**, ¿toma efecto? Cerrar de más también es un defecto.
- **El caso del primer día:** arrancá el servidor **sin padrón**, creá el padrón después, e intentá operar. Con la corrección, o el servidor no arrancó (§3), o toma el padrón nuevo. Lo que no puede pasar es que arranque y todo dé 403 en silencio.
- **Buscá la misma forma en otro lado.** Cualquier dato que se lea una vez al arrancar y después se consulte del retrato: la configuración, el catálogo, la lista de estados, las plantillas de entregables. Si hay otro, es el hallazgo del ciclo.

---

## 3. El arranque: ¿se niega a arrancar a medias?

Es lo que va a evitar la peor tarde posible — instalarlo, ver que "anda", y descubrir a las dos horas que todo daba 403.

Probá **cada caso por separado**, y en cada uno mirá dos cosas: **que no escuche en el puerto** y **que el mensaje diga qué falta y qué hacer**, en castellano y sin rastro de pila:

- carpeta de datos inexistente;
- carpeta de datos existente pero **sin permiso de escritura** — y verificá que lo compruebe **escribiendo**, no consultando permisos: sobre un montaje de red los permisos mienten;
- padrón ausente;
- padrón presente pero **sin ningún operador con credencial**;
- catálogo ausente, y catálogo con el manifiesto ilegible;
- puerto ya ocupado;
- versión de Node por debajo del mínimo.

Y el que nadie prueba: **el disco lleno.** ¿Qué hace el servidor cuando no puede escribir un expediente a mitad de camino? No es del arranque, pero es del mismo día.

---

## 4. La instalación y la actualización

Todo dentro de un directorio temporal.

- **`instalar.sh` sobre una carpeta de datos que ya existe**: ¿la respeta? Poné tres expedientes, instalá encima, y verificá que sigan ahí. **Si los borra, es severidad crítica** — es la única cosa de esta ronda que destruye trabajo real.
- **Instalar dos veces seguidas**: ¿es idempotente, o duplica algo?
- **Permisos resultantes**: ¿los datos son escribibles sólo por el usuario del servicio? ¿Los archivos de la aplicación son de sólo lectura para él? Un proceso que puede reescribir su propio código es un proceso que puede ser reescrito.
- **¿El servicio corre como root?** Si sí, es hallazgo alto.
- **Actualización**: hacé el procedimiento completo con datos cargados y verificá **expedientes, padrón, eventos y sugerencias intactos**, byte a byte, antes y después.
- **Vuelta atrás**: ¿restaura la versión anterior? ¿Deja los datos como estaban? ¿Y si se vuelve atrás **después** de que un expediente avanzó con la versión nueva?
- **El puerto y la carpeta de datos**, ¿salen de configuración o están escritos en la unidad de systemd? Cambiar el puerto no puede exigir editar el servicio.

---

## 5. El respaldo, que ahora tiene destino

- **Destino no disponible** —ruta inexistente, sin permiso, disco lleno—: ¿avisa? ¿**Conserva el respaldo anterior**? Un respaldo que borra el bueno antes de fallar es peor que ninguno.
- ¿Corre solo? ¿Y qué pasa si dos corridas se superponen?
- **El ciclo completo, otra vez**: respaldá, destruí la carpeta de datos, restaurá. Con el padrón adentro esta vez — **¿vuelven las credenciales?** Si no vuelven, nadie puede entrar después de una restauración.

---

## 6. El instructivo

No es cosmético: es lo que va a leer alguien dentro de dos años cuando esto se rompa un viernes.

Leelo **como si no conocieras el proyecto** y decime, concretamente: ¿podrías instalarlo, arrancarlo, actualizarlo y restaurarlo siguiéndolo? ¿Da por sabido algo que no está escrito? ¿Menciona un archivo o un comando que no existe?

Es la única sección de esta auditoría donde tu opinión vale más que una prueba.

---

## 7. Regresiones

Las de siempre, **todas con sesión autenticada**: la matriz 18 × 7 con sus 13 escenarios laterales, el recorrido de los 18 estados, concurrencia de `PUT` y de numeración, adjuntos, archivado, recuperación ante desastre, la ida y vuelta del YAML, el registro de eventos, las guardias de ADR-029.

Batería completa desde `auditoria\bateria\` con `MOTIVOS.md` al día. Es probable que algún rojo cambie de causa con el padrón vivo: **anotalo**.

---

## 8. El reporte — `AUDITORIA-CICLO-15.md`

Misma estructura. Tres secciones propias:

```
## El padrón, en un solo lugar
Baja, cambio de rol y bloqueo contra una sesión abierta. Y qué otro dato encontraste con la misma forma.

## Los siete arranques que no arrancan
Un caso por fila: qué falta, si escuchó en el puerto, y qué dijo.

## Qué no pude verificar sin tocar el sistema
Explícito. Es información, no una falla.
```

Cierre: un solo commit, `Auditoria ciclo 15`, sin push.

---

## 9. Qué se espera de vos

Que encuentres lo que va a fallar **el día de la instalación**, no lo que falla en un test.

Todo lo que auditaste hasta acá se probaba corriendo el sistema con todo en su lugar. Esta ronda tenés que probarlo **con las cosas faltando**: sin padrón, sin catálogo, sin permisos, con el puerto ocupado, después de un reinicio, después de una actualización mal hecha.

La pregunta que guía esta auditoría: **¿qué pasa cuando algo no está donde tenía que estar?**
