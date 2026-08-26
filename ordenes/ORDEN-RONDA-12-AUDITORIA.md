# ORDEN DE AUDITORÍA — CICLO 12

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **H13 (cierre)** y **H15 — Observabilidad y tableros por rol**, según `ordenes/ORDEN-RONDA-12.md`
Emitida: 2026-08-25

---

## 0. Tu rol

Valen íntegramente `ORDEN-RONDA-04-AUDITORIA.md` §0 y §1, la verificación de conducta de `ORDEN-RONDA-05-AUDITORIA.md` §1, el control de entrega, y la integridad de la bitácora sobre **31 ADRs**.

### Tu ciclo anterior

**Siete hallazgos, cada uno con reproducción y test adversario.** Y dos de ellos valen especialmente:

- Encontraste que el emisor de YAML pierde datos en silencio. Nadie te lo pidió: la orden decía "probá los textos que rompen" y vos armaste la tabla y fuiste a buscar.
- Y encontraste que el pliego impreso no tiene la modalidad OCA, que resultó ser la punta de algo más grande — ver abajo.

### Dos correcciones, y las dos son de método

**Primera: una de las filas de tu tabla estaba al revés.** Probaste `#comentario` y lo marcaste correcto. No lo es: ese valor se pierde entero. Y al reproducir la tabla con un programa —emitir, parsear con el parser real de Python, comparar carácter por carácter— **aparecieron siete casos rotos en vez de dos**, y dos de ellos no corrompen un valor: **impiden que el archivo parsee y el pliego no se genera**.

No fue descuido. Es lo que pasa cuando una tabla de resultados se **escribe** en vez de **medirse**.

> **Regla, desde ahora:** cuando lo que verificás es un ida y vuelta —emitir y parsear, guardar y leer, exportar e importar— la comprobación es **un programa que compara y que imprime la tabla**. La tabla del informe es la salida del programa, no una lista revisada a ojo.

Lo hacés bien con el servidor: sondas HTTP con verificación de disco después de cada respuesta. Es exactamente ese estándar, aplicado a todo lo demás.

**Segunda: tu H-02 era la punta de algo que no nombraste.** Marcaste como crítico que la plantilla del pliego no tenga la tabla de OCA. El desarrollador dijo que R17 ya estaba controlado. **Los dos tenían razón sobre objetos distintos**: hay *dos* documentos llamados "pliego" —tu plantilla del ciclo 7, que hoy es entregable obligatorio, y el que produce el generador de la UOC— y nadie había decidido cuál vale. Eso es lo que había que reportar, y es mejor hallazgo que el que escribiste. Quedó como **ADR-030**.

Cuando dos partes discuten y las dos parecen tener razón, casi siempre es porque están hablando de cosas distintas. Buscá eso.

### Accesos fuera del repositorio

`auditoria\bateria\`; `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\` en **sólo lectura**, con permiso de ejecutar `scripts/generar_pliego.py` con salida a carpeta temporal; `os.tmpdir()` y `127.0.0.1`. Nada más.

---

## 1. Verificación de conducta

Los cinco de siempre. Documentación intocable: **ADR-021 a ADR-031**, órdenes y `referencias/pliego/` —comparalos contra los originales del generador; si el desarrollador los tocó para que su emisor coincida, es severidad alta—.

---

## 2. El blanco principal: ¿un texto de operador puede romper el pliego?

Es el 40% de la auditoría.

**Armá tu propio programa de ida y vuelta**, no reutilices el del desarrollador: cargá el texto en un expediente real por la vía que usa el sistema, exportá el YAML, parsealo con un parser de verdad y compará el valor que vuelve con el que cargaste, **carácter por carácter, espacios incluidos**.

Los veinte casos conocidos, y después salí a buscar los que no están:

- textos que terminan en `:` , en `-`, en `#`, en espacio;
- tabuladores y retornos de carro sueltos, `\r\n` mezclado con `\n`;
- una barra invertida al final del texto (`C:\ruta\`) — pensá qué pasa con el escapado;
- comillas dobles al final, comillas dobles duplicadas;
- un texto que sea **sólo** un guión, sólo dos puntos, sólo comillas;
- caracteres de control invisibles, un carácter nulo;
- un texto de 20.000 caracteres;
- emojis y caracteres fuera del plano básico;
- y el que nadie prueba: **un texto vacío contra un campo ausente**. ¿Se distinguen en el YAML?

Por cada uno: **¿parsea el archivo? ¿el valor que llega es el que se cargó?** Un archivo que no parsea es severidad alta: el pliego no existe.

**Y verificá que `necesitaEscapar` haya sido eliminada, no corregida.** Si sigue viva con más patrones, la orden no se cumplió: el defecto era la forma de la solución, no sus siete instancias.

---

## 3. El pliego, después de ADR-030

- `pliego-bases-condiciones` **no puede ser entregable obligatorio de ningún estado**. Verificalo en `config.js` y **contra el servidor**: que un expediente avance sin generarlo.
- La **vista previa** tiene que estar rotulada como tal en el documento compuesto, y **no llevar pie de firma ni la leyenda de ADR-023**. Un documento que no se firma no lleva pie de firma.
- **El generador real tiene que seguir produciendo el pliego.** Corrélo vos con un expediente que armes vos. Y esta vez, con **los tres campos nuevos mapeados**: ¿aparecen las cláusulas de frecuencia, plazo y horario, o siguen en blanco?
- El caso incómodo: **un expediente con datos faltantes**. ¿El pliego sale con huecos que parecen completos, o se ve que falta el dato?

---

## 4. El registro de eventos · es lo que no se puede recuperar después

Es la segunda mitad de la auditoría, y tiene una particularidad: **un defecto acá no se ve hasta dentro de un año**, cuando alguien quiera un número que no se capturó.

- **Append-only de verdad:** veinte escrituras concurrentes sobre el mismo expediente, ¿aparecen las veinte líneas, sin mezclarse ni truncarse? Es la misma prueba de concurrencia del `PUT`, sobre otro archivo.
- **¿Se puede reescribir el pasado?** ¿Hay algún camino —una edición, un archivado, una restauración— por el que una línea ya escrita cambie o desaparezca?
- **Qué se registra y qué no.** Recorré la lista de ADR-024 §1 una por una contra el código y decime cuáles faltan. Y después la pregunta que importa: **¿qué evento ocurre en el sistema y no deja rastro?** Hacé cosas raras y mirá el archivo.
- **Los indicadores se derivan, no se guardan calculados.** Buscá cualquier valor agregado persistido: es la trampa que hace que un indicador nuevo no se pueda calcular sobre datos viejos.
- **Agregar una ficha no puede requerir tocar la vista.** Probalo: agregá una ficha declarativa y verificá que aparece.
- **El tablero vive en el padrón.** Dos operadores en la misma PC tienen que ver tableros distintos. Y verificá el lado feo: ¿un operador puede cambiarle el tablero a otro?
- **Dato sensible:** el registro tiene contenido operativo sobre personas identificadas. ¿Entra en la advertencia previa a la descarga? ¿Quién puede exportarlo?
- **Entrada hostil en la vista de exploración:** filtros con textos raros, rangos de fecha invertidos, un expediente inexistente. Y el CSV: **¿se puede inyectar una fórmula?** Un campo que empieza con `=`, `+`, `-` o `@` se ejecuta al abrir el archivo en una planilla. Es el mismo problema que el YAML, en otro formato.

---

## 5. Las otras correcciones

- **Precio de referencia** derivado de `preventivoContratacion`; si se corrige a mano, ¿queda registrado con el valor calculado a la vista?
- **Trazabilidad de la precarga**: editá un campo precargado del ANEXO 1 y verificá el evento, con campo, valor del requerimiento y valor nuevo.
- **Test de integridad**: sacá un módulo de `APP_CORE` y verificá que **el test falle**. Si pasa igual, no se cumplió.
- **`CAUSAL_OCA`**: dos nombres distintos, definidos en un solo lugar. Ningún texto duplicado.

---

## 6. Regresiones

Las de siempre, obligatorias, más lo del ciclo anterior que esta ronda no puede haber movido: los bordes del desborde, el conteo en puntos de código, el 413, las dos leyendas en sus superficies, las guardias de ADR-029 —**volvé a barrer el patrón, incluida la búsqueda de `|| {}`, `catch` silenciosos y `?.`**—, la matriz 18 × 7, concurrencia, archivado y recuperación ante desastre.

Y tus cinco casos del preventivo. Corré la batería completa desde `auditoria\bateria\`, clasificá cada rojo con su causa, y **no edites ningún test para que pase**: si uno queda en rojo por un cambio legítimo, anotá el motivo y declaralo.

---

## 7. El reporte — `AUDITORIA-CICLO-12.md`

Misma estructura, con riesgos declarados y tu opinión. Y tres secciones propias:

```
## Ida y vuelta del YAML
La tabla, generada por tu programa. Texto cargado | ¿parsea? | valor que volvió | ¿idéntico?
Decí con qué parser la produjiste.

## Qué ocurre en el sistema y no deja rastro
La lista de ADR-024 §1 contra el código, más lo que encontraste haciendo cosas raras.

## El pliego, después de ADR-030
Qué generaste, con qué YAML, qué salió, y si los campos nuevos llegaron.
```

Cierre: un solo commit, `Auditoria ciclo 12`, sin push. La batería actualizada va en `auditoria\bateria\`.

---

## 8. Qué se espera de vos

Dos cosas que fallan de maneras opuestas.

**El YAML falla ruidosamente o en silencio, y las dos son malas**: o el pliego no sale, o sale con un dato truncado que nadie nota. Ahí el estándar es la medición, no la inspección.

**El registro de eventos falla de una manera que no se ve hoy.** Si falta un evento, todo funciona igual: nadie se entera hasta dentro de un año, cuando alguien pida un número que no se capturó. No hay forma de auditar eso mirando si algo se rompe — hay que ir a buscar el hueco.

La pregunta que guía esta auditoría: **¿qué pasa en este sistema sin dejar rastro?**
