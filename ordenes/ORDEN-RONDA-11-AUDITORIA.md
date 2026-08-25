# ORDEN DE AUDITORÍA — CICLO 11

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **H13 — ANEXO 1 y salida hacia el pliego**, según `ordenes/ORDEN-RONDA-11.md`
Emitida: 2026-08-21

---

## 0. Tu rol

Valen íntegramente `ORDEN-RONDA-04-AUDITORIA.md` §0 y §1, y la verificación de conducta de `ORDEN-RONDA-05-AUDITORIA.md` §1, con la integridad de la bitácora sobre **29 ADRs**.

### Tu ciclo anterior

Dos cosas, y las dos importan.

**Fuiste a cazar el patrón, no la instancia.** El defecto grave del ciclo 10 era una guardia defensiva que apagaba una validación en silencio; cualquiera hubiera verificado que esa guardia estuviera corregida y habría cerrado el hallazgo. Vos buscaste el patrón en todo el repositorio y encontraste **tres instancias vivas**, incluida una nueva en `renders/requerimiento.js`. Y señalaste que la forma correcta **ya existía** en `repo.memoria.js`, así que no había que inventar nada. De ahí salió **ADR-029**, que es la mejor decisión de arquitectura que produjo el proyecto desde ADR-021.

**Y auditaste tu propia auditoría.** Publicaste que tu informe anterior había afirmado en falso un *"todos en verde"*, encontraste que el error era de tu propio test —dividía por 3 cuando la cantidad era 2— y **lo comprobaste contra el clon viejo antes de acusar al código**. También corregiste, en tus términos, el error de razonamiento del ciclo 10: extender una conclusión más allá de lo verificable.

Un auditor que audita sus propias auditorías es lo más difícil de conseguir de todo este montaje. No lo pierdas.

### Una falla del ciclo que era mía

Declaraste que copiaste la batería adversaria del clon anterior porque tu commit no se publica. La conducta fue impecable —sin editar, en sólo lectura, declarado— pero **el pedido era imposible**: te digo "commit sin push" y después te pido correr esa misma batería desde un clon nuevo donde no está.

**Desde ahora la batería tiene domicilio propio, fuera de los clones:**

```
C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\bateria\
```

Leela, corrila, extendela y dejala ahí. Queda **declarada como acceso autorizado** en ésta y en todas las órdenes siguientes.

Con una regla que la acompaña: **un test adversario no se borra ni se edita para que pase.** Si queda en rojo porque el código cambió legítimamente, anotá el motivo al lado y actualizalo **declarándolo en el informe**. Un test adversario ajustado en silencio deja de ser adversario. Tu clasificación de los ocho rojos del ciclo pasado —uno por uno, con su causa— es exactamente el método.

### Accesos fuera del repositorio

Tres, y sólo tres:

1. `auditoria\bateria\` — tu batería acumulada.
2. `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\` — **sólo lectura**, y podés **ejecutar** `scripts/generar_pliego.py` con la **salida dirigida a una carpeta temporal**. No escribas nada dentro de esa carpeta: es documentación real de la División.
3. `os.tmpdir()` y puertos locales `127.0.0.1`.

---

## 1. Verificación de conducta

Los cinco: accesos fuera del repositorio, documentación intocable (**ADR-021 a ADR-029**, órdenes y **`referencias/pliego/`**), integridad de la bitácora, honestidad del informe contra el código, y el **control de entrega** antes de arrancar.

Sobre `referencias/pliego/`: son los YAML de ejemplo del generador real, copiados al repositorio como contrato. **Si el desarrollador los modificó para que su emisor coincida, es un hallazgo de severidad alta** — sería adaptar el contrato al producto en vez de al revés. Compará contra los originales de la carpeta del generador.

---

## 2. El blanco principal: ¿el pliego sale?

Es el 40% de esta auditoría y va primero porque **es el único punto de la ronda que no se puede aprobar por inspección**: o el generador produce el pliego, o no lo produce.

- **Generá un expediente completo de prueba vos mismo** —requerimiento con varios renglones, al menos uno desbordado, presupuestos, ANEXO 1 lleno— y exportá el YAML por la vía que use el sistema, no por un fixture del desarrollador.
- **Corré el generador real** con ese YAML, con la salida en una carpeta temporal. ¿Sale el pliego? ¿Sale completo? ¿Hay que editar algo a mano?
- Repetilo con **uno, dos y tres organismos requirentes**, y con `tipo_contrato: "bienes"` y `"servicios"`.
- Y con el caso incómodo: **un expediente al que le faltan datos**. ¿El YAML sale con campos vacíos, o el generador se cae?

### El emisor de YAML, que es donde va a fallar

No hay librería: el emisor está escrito a mano. Ahí es donde se rompen estas cosas, y **un YAML mal escapado falla en silencio o produce un documento plausible y mal**.

Probá los textos que rompen:

- un `: ` en el medio de una descripción (el clásico);
- un `#` a mitad de línea;
- un `-` al comienzo de un valor;
- comillas simples y dobles, mezcladas — mirá `rubros` en el ejemplo: comillas dobles adentro de simples;
- acentos, eñes, `%`, paréntesis;
- un salto de línea en un campo de texto largo;
- un campo vacío, y un campo con sólo espacios;
- un texto que empiece con `>` o con `|`;
- algo que YAML interprete como otro tipo: `si`, `no`, `on`, `off`, `null`, `2026-08-21`, `007`.

Por cada uno: ¿el YAML parsea? ¿el valor que llega al pliego es el que se cargó, o se transformó por el camino? **Un `007` que llega como `7` o un `no` que llega como `false` es un hallazgo.**

---

## 3. ADR-029: ¿se cerró el patrón, o sólo las tres instancias?

- Verificá que las tres guardias **lanzan** cuando falta la dependencia, y que el mensaje diga qué falta y quién lo pedía.
- **Buscá instancias nuevas.** Cualquier condición que, al no cumplirse, haga que una regla, una validación o una decisión de impresión **desaparezca sin avisar**. No sólo `if (SGC.core.X)`: también un `try/catch` que se traga el error, un `|| {}` que devuelve un objeto vacío en vez de fallar, un `?.` que convierte una ausencia en `undefined` silencioso.
- **El test de integridad del núcleo: probá el test.** Sacá un módulo de la lista de carga y verificá que el test **falle**. Un test de integridad que pasa siempre es peor que ninguno, porque da confianza falsa.
- Y la pregunta de fondo: **¿algún test seguía dependiendo de la conveniencia que se eliminó?** Si el desarrollador tuvo que tocar tests para que ADR-029 pasara, mirá qué tocó: ahí es donde se puede haber colado una regla debilitada.

---

## 4. El ANEXO 1

- **La precarga es editable pero trazable.** Cambiá el objeto que escribió el usuario y verificá que quede registrado como cambio respecto del requerimiento. Un ANEXO 1 que contradice al requerimiento sin que nadie se entere es un problema de expediente.
- **Los bloques condicionales 9 a 12:** que no aparezcan en el documento cuando no corresponden, verificado en el HTML compuesto y no en la pantalla. Y el caso inverso: si corresponden dos a la vez, ¿qué pasa?
- **El precio de referencia (§2)** sale de los presupuestos cargados. ¿Se puede pisar a mano? Si se puede, ¿queda registrado?
- **Entrada hostil** en las secciones de texto libre: comisión de recepción, personal técnico, requisitos mínimos, criterio de evaluación. Inyección y textos larguísimos.
- ¿Qué pasa si Abastecimiento completa el ANEXO 1 y **después** el usuario modifica el requerimiento tras una devolución? ¿La precarga queda desactualizada en silencio?

---

## 5. La planilla de OCA · el punto de consecuencia legal

ADR-022 §3 registra una divergencia deliberada con el Art. 112 del Decreto 1030/16: en la División, `cantidadMaxima` es el tope **por Solicitud de Provisión**; en la norma, es el máximo **durante la vigencia del contrato**, y obliga al proveedor.

**El pliego es un documento legal.** Verificá que la columna esté rotulada con el significado que realmente tiene, y no como "Cantidad máxima" a secas, **en los tres lugares donde ese número puede aparecer**: la pantalla, el ANEXO 1 impreso y lo que llegue al pliego.

Si en alguno de los tres el rótulo es ambiguo, es hallazgo de **severidad media** — no por el código, sino porque ese papel obliga a un proveedor.

---

## 6. Regresiones

Las de siempre, obligatorias: concurrencia de `PUT` y de numeración, recorrido de rutas, alta completa, Fast-Track hostil, borrador inválido, recorrido de los 18 estados, la matriz 18 × 7 con sus 13 escenarios laterales, adjuntos, archivado y recuperación ante desastre.

Y lo del ciclo pasado, que la ronda nueva no puede haber movido: **tus cinco casos del preventivo**, los bordes del desborde (255/256/257 y 1999/2000/2001), el conteo en puntos de código, el 413, y las dos leyendas en las tres superficies.

Más: **el anexo obligatorio** — un renglón desbordado sin anexo generado no debe dejar avanzar de estado, verificado contra el servidor y con el disco intacto tras el rechazo.

`node --test` en verde de una sola pasada, `check-compat` con salida 0, ningún archivo sobre 400 líneas.

---

## 7. El reporte — `AUDITORIA-CICLO-11.md`

Misma estructura, con la sección de riesgos declarados y tu opinión. Y tres propias:

```
## El pliego sale, o no sale
Qué generaste, con qué YAML, qué salió. Si hubo que editar algo a mano, qué.

## El emisor de YAML contra los textos que rompen
Un caso por fila: texto cargado, YAML emitido, valor que llegó al pliego.

## ADR-029: el patrón, no las instancias
Las tres corregidas, más lo que hayas encontrado buscando el patrón.
Y el resultado de sacar un módulo de la lista de carga.
```

Cierre: un solo commit, `Auditoria ciclo 11`, sin push. **La batería actualizada va en `auditoria\bateria\`**, que ahora es su casa.

---

## 8. Qué se espera de vos

Que verifiques que la cadena documental cierra de verdad — no que los campos estén, sino que **el pliego salga**.

Los ciclos anteriores auditaron reglas, cálculos y pantallas: cosas que viven dentro de nuestro sistema. Este ciclo el producto tiene que atravesar una frontera y ser consumido por un programa que no escribimos nosotros, escrito en otro lenguaje, que no sabe nada de nuestras convenciones. **Ahí no hay lugar para el "debería andar".**

La pregunta que guía esta auditoría: **¿qué texto que un operador puede escribir hoy rompe el pliego mañana?**
