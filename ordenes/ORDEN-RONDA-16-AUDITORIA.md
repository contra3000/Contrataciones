# ORDEN DE AUDITORÍA — CICLO 16

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **las tres correcciones de despliegue** y **H20 — plantillas del pliego**, según `ordenes/ORDEN-RONDA-16.md`
Emitida: 2026-08-31

---

## 0. Tu rol

Valen `ORDEN-RONDA-04-AUDITORIA.md` §0 y §1, la verificación de conducta de `ORDEN-RONDA-05-AUDITORIA.md` §1, el control de entrega, `MOTIVOS.md` al día, y la integridad de la bitácora sobre **36 ADRs**.

### Tu ciclo anterior

Hiciste dos cosas que valen más que un hallazgo.

**Volviste a buscar algo que vos mismo habías anunciado.** En el ciclo 14 escribiste que si el servidor arrancaba antes de que existiera el padrón, todo daría 403. En el 15 fuiste a probar **ese caso exacto** en vez de darlo por corregido porque la orden lo pedía — y seguía ahí. Lo verifiqué yo en el código y tenías razón. **Subí ese hallazgo de media a alta**, no por lo técnico sino por la consecuencia: está garantizado que se dispare, el día de la instalación, sin dejar rastro.

**Y dedicaste una sección entera a lo que no pudiste verificar.** Cinco puntos concretos: la ejecución real del instalador, que el servicio arranque en el boot, los permisos tal como los impone un sistema de archivos Linux, la compatibilidad real con Node 18 —probaste con Node 24—. Te había prohibido tocar el sistema y te dije que prefería una verificación incompleta y declarada. Hiciste exactamente eso. **Un auditor que dice con precisión lo que no sabe vale más que uno que llena los huecos.**

También encontraste el comando roto del instructivo **ejecutándolo**, que es la única forma de saberlo.

### Este ciclo tiene dos mitades de naturaleza distinta

La primera es corta y urgente: **tres correcciones, y después esto se instala.** La segunda es un hito entero.

Y hay algo nuevo: **por primera vez, lo que audites va a estar corriendo con gente adentro pocos días después.** Lo que se te escape no lo va a encontrar otro ciclo — lo va a encontrar un operador.

### Accesos fuera del repositorio

`auditoria\bateria\`; `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\` en **sólo lectura**, con permiso de ejecutar `scripts/generar_pliego.py` hacia una carpeta temporal; `os.tmpdir()` y `127.0.0.1`. Nada más.

Y sigue en pie la advertencia del ciclo anterior: **no ejecutes el instalador fuera de un directorio temporal.** Si algo no se puede verificar sin tocar el sistema real, declaralo.

---

## 1. Verificación de conducta

Los ocho de siempre. Documentación intocable: **ADR-021 a ADR-036**, órdenes y `referencias/` —incluidos los YAML de ejemplo del generador: si el desarrollador los tocó para que su emisor coincida, es severidad alta—.

---

## 2. Las tres correcciones · van primero y son las que habilitan instalar

### 2.1 — El padrón, otra vez

**Reproducí tu propio caso del ciclo 15, tal cual:**

- Arrancá el servidor **sin padrón**. Tiene que **no arrancar**, y decir qué falta en castellano.
- Creá el padrón, arrancá de nuevo: tiene que arrancar en modo autenticado.
- Y el caso nuevo: con el servidor **ya corriendo**, tocá el padrón —agregá un operador, cambiá un rol— y verificá que **lo tome sin reiniciar**.
- **El modo declarado, ¿sigue activándose solo?** Buscá cualquier camino por el que el servidor termine en modo declarado sin que alguien lo haya pedido. Si existe, la corrección no está hecha.
- **Y mirá los tests.** La orden le pidió arreglarlos, no ablandar la regla. Si algún test quedó verde porque el modo declarado sigue siendo el que sale por defecto en alguna ruta, es un hallazgo.

**Buscá la forma una cuarta vez.** Cualquier cosa que se evalúe una vez y después se consulte del resultado: rutas, permisos, versiones, la existencia de un archivo, una capacidad del sistema. Vamos tres; la cuarta la encontrás vos o la encuentra un operador.

### 2.2 — El comando del manual

**Ejecutalo tal como está escrito**, con el archivo que el manual indique. Tiene que funcionar. Y probá los bordes que el día uno va a tener: una línea vacía al final, un archivo con BOM, acentos en los nombres, un correo repetido.

Y leé de nuevo el §8 del manual —el de "si las transiciones dan 403"—: recomendaba el mismo comando roto.

### 2.3 — Los mensajes

Ningún mensaje de arranque puede tener texto en inglés ni de la máquina. **Barré todos**, no sólo el del padrón ilegible: buscá dónde se concatena el mensaje de un error del sistema a un texto nuestro.

---

## 3. Las plantillas · ¿se puede publicar una plantilla rota?

Es el 40% de la auditoría, y la pregunta es una sola porque es la que importa: **las plantillas son el único lugar del sistema donde el error de una persona se multiplica por todos los expedientes siguientes.**

- **Marcador desconocido**: escribí una plantilla con `{{campo_que_no_existe}}` e intentá publicarla. Tiene que impedirlo y **decir cuál**. Probá variantes: un marcador con un espacio de más, uno mal cerrado, uno con mayúsculas distintas, uno dentro de un comentario.
- **La plantilla que no genera**: una sintácticamente válida pero que hace fallar al generador. ¿Se publica igual?
- **¿Se puede saltear la prueba?** Publicar por API sin haber probado, editar y publicar en dos pasos, publicar una versión vieja que ya estaba probada y después editarla. **Buscá el camino que evita la validación**, que es lo que alguien apurado va a encontrar.
- **El aviso de campos sin usar** no puede impedir publicar: es aviso. Verificá que no bloquee.

### La tabla de reglas

- **Precedencia**: dos reglas que coinciden, una con más comodines. Tiene que ganar la más específica.
- **Empate exacto**: dos con la misma especificidad. ¿Gana la de mayor prioridad declarada, o la primera del archivo? Lo segundo es un hallazgo.
- **Ninguna coincide**: usa la de defecto **y lo dice en pantalla**. Verificá que lo diga, no sólo que la use.
- **Ninguna coincide y no hay defecto**: ¿qué pasa? No puede quedar sin plantilla en silencio.
- **Una regla que se borra** mientras un expediente la estaba usando.

### Las versiones

- Publicar una versión **no borra la anterior**. Verificalo en disco.
- **Volver a una anterior** funciona, y la que estaba vigente no se pierde.
- **La nota de cambio es obligatoria**: probá publicar sin ella.
- **El expediente estampa id y versión**, con su evento. Y el caso que importa: **regenerá el pliego de un expediente viejo** y verificá que use **la versión con la que se hizo**, no la vigente. Si usa la vigente, la reproducibilidad no existe.

### Quién publica

Sólo `contrataciones_supervisor` y `juridica`, **contra el servidor**. Probá los otros cinco roles. Y el otro lado: que los demás **puedan ver** plantillas e historial — cerrar de más también es un defecto.

---

## 4. El pliego de servicios · el que nunca se pudo generar

Hasta ayer `tipo_contrato` estaba escrito a mano en `bienes`, y el generador exige dos campos más cuando es `servicios`. **Nadie generó nunca un pliego de servicios con este sistema.**

- Armá un expediente de servicios completo, exportá, y **corré el generador real**. ¿Sale?
- ¿`tipo_contrato` y `tipo_documento` se derivan del expediente, o siguen fijos en otro lado?
- ¿Qué pasa si falta `plazo_entrega_servicio` o `garantia_servicio`? El generador los exige: ¿avisamos antes, o descubre el usuario que el pliego no sale?
- Y el de bienes tiene que **seguir saliendo**.

---

## 5. Las trece correcciones normativas

`ANALISIS_ERRORES_PLIEGOS.md` clasificó los errores del log de la División. Trece son citas normativas que se arreglan escribiendo bien la plantilla una vez.

**No audites si el texto jurídico es correcto** — eso lo revisan el Jefe de Contrataciones y el Asesor Jurídico, y no es tu trabajo. Auditá lo verificable:

- ¿Están las trece, cada una con su nota de cambio citando el código del error?
- **¿La plantilla numera sola** las cláusulas e incisos, o trae los números escritos a mano? Si los trae escritos, E01, E02 y E05 del log siguen siendo posibles.
- Y el pliego generado, ¿tiene la numeración corrida correcta con secciones condicionales que no aparecen?

---

## 6. Regresiones

Las de siempre, **todas con sesión autenticada y sin modo declarado por omisión**: matriz 18 × 7 con sus escenarios laterales, recorrido de los 18 estados, concurrencia, adjuntos, archivado, recuperación ante desastre, ida y vuelta del YAML, registro de eventos, guardias de ADR-029, el padrón vivo cortando sesiones.

Y **el respaldo con las plantillas adentro**: destruí, restaurá, y verificá que vuelvan las plantillas *y* sus versiones anteriores.

Batería completa desde `auditoria\bateria\` con `MOTIVOS.md`. Es muy probable que varios rojos cambien de causa con el modo declarado: **anotalo**.

---

## 7. El reporte — `AUDITORIA-CICLO-16.md`

Misma estructura. Cuatro secciones propias:

```
## ¿Se puede instalar?
Las tres correcciones, una por fila, con el comando y lo que respondió.

## Cómo publicar una plantilla rota
Cada camino que intentaste para saltear la validación, y qué pasó.

## El pliego de servicios
Qué generaste, si salió, y qué falta si no.

## La cuarta vez
Qué encontraste buscando "algo que se evalúa una vez y después se consulta del resultado".
```

Cierre: un solo commit, `Auditoria ciclo 16`, sin push.

---

## 8. Qué se espera de vos

**Que lo que se instale la semana que viene no tenga la tarde mala adentro**, y que una plantilla mal escrita no pueda llegar a un pliego.

Hay una diferencia con todos los ciclos anteriores y conviene que la tengas presente: **esto va a estar corriendo con catorce personas adentro en unos días.** Hasta ahora, lo que se te escapaba lo encontraba el ciclo siguiente. Desde este, lo encuentra un operador — y en el caso de las plantillas, un proveedor leyendo un pliego.

La pregunta que guía esta auditoría: **¿qué camino toma alguien apurado?**
