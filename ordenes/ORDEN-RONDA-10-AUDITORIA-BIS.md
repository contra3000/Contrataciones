# ORDEN DE AUDITORÍA — CICLO 10 (segunda pasada)

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **la ronda 10, ahora sí publicada**, según `ordenes/ORDEN-RONDA-10.md` y `ordenes/ORDEN-RONDA-10-CIERRE.md`
Emitida: 2026-08-21

> Clon nuevo. **No reutilices el del ciclo 10**: fue tomado antes de la publicación.

---

## 0. Qué pasó, y qué acertaste

Tu auditoría del ciclo 10 fue correcta en el método y produjo el mejor hallazgo del ciclo. Corresponde decirte las dos cosas.

**Lo que acertaste.** En un ciclo donde el objeto de la auditoría no existía, en vez de entregar dos páginas diciendo "no hay nada que auditar", auditaste lo que había — y salió **H-02**: el servidor no validaba ninguna regla del requerimiento. `apiGuardar` nunca invocaba `validarRenglon`, y aunque lo hubiera hecho, `servidor.js` cargaba el núcleo sin `requerimiento.js`, de modo que la guardia `if (SGC.core.requerimiento)` de `validacion.js:111` salteaba las reglas **en silencio**. Siete peticiones que debían rechazarse devolvían 200.

Es de la familia del defecto del ciclo 6 y llevaba **dos ciclos** escondido. No lo encontró la auditoría del ciclo 9 porque mi orden dirigió el fuego a otro lado: eso es mío, no tuyo. Vos fuiste a mirar donde nadie te mandó.

Y los 25 tests adversarios con 13 en rojo esperando a los entregables son la forma correcta de dejar un hallazgo: un listón, no una queja.

**Lo que hay que corregir.** Escribiste: *"El trabajo de la ronda 10 es trabajo sin registrar: no existe ni commiteado ni sin commitear."*

La primera mitad la verificaste. La segunda es una afirmación sobre el árbol de trabajo del desarrollador, que **no podés ver** — trabajás sobre tu propio clon del remoto, y así debe ser. El trabajo **existía**: cuatro archivos nuevos, tres archivos de tests y once modificados, escritos ese mismo día. Lo que faltaba era el commit, el push y el informe.

La frase correcta era **"no está publicado"**. La diferencia parece de matiz y no lo es: tu veredicto decía que no se había hecho el trabajo, y sí se había hecho.

**Regla, desde ahora:** cuando informes sobre algo que está fuera de tu alcance de verificación, decí qué comprobaste y con qué comando, y no extiendas la conclusión más allá. *Ausencia de evidencia no es evidencia de ausencia.* Me pasó a mí también esta semana: corrí `git status` sobre la carpeta del desarrollador, volvió vacío, y estuve a punto de escribir que el árbol estaba limpio — el comando se había cortado por tiempo de espera y el código de salida era `124`, no `0`.

### Accesos fuera del repositorio

`os.tmpdir()` y puertos locales `127.0.0.1`. Nada más.

---

## 1. Verificación de conducta

Los cuatro de siempre, con la documentación de sólo lectura ampliada a **ADR-021 a ADR-028**, y la integridad de la bitácora sobre **28 ADRs** con cuerpo completo.

Y una comprobación nueva, que es la lección del ciclo:

5. **Control de entrega.** Antes de auditar nada: ¿hay un commit del desarrollador posterior al mío (`56c4ff5`)? ¿Existe `INFORME-RONDA-10.md`? ¿El árbol del clon queda limpio? Si algo falta, decilo primero y en esos términos — *no está publicado* —, y auditá lo que haya.

---

## 2. El blanco principal: ¿H-02 quedó realmente cerrado?

Es el 40% de esta auditoría y va primero porque es el defecto de severidad alta.

**Volvé a correr tu batería `r10-servidor-reglas.test.js` tal cual**, sin adaptarla al código nuevo. Los siete casos tienen que rechazarse ahora **contra el servidor real**, no contra la vista:

| Caso | Antes | Ahora debe |
|---|---|---|
| Base ausente | 200 | rechazar |
| Valor negativo | 200 | rechazar |
| Base `total` con cantidad 0 | 200 | rechazar |
| `presupuestoId` inexistente | 200 | rechazar |
| Aclaración de 300 caracteres | 200 | rechazar |
| Justificación de 50.000 caracteres | 200 | rechazar |
| Creación con renglón inválido | 201 | rechazar |

Y después, lo que tu propia tabla del §6 dejó anotado como lista de verificación pendiente: **por cada regla que la pantalla impone, qué hace el servidor cuando se la saltea.** Esa era la pregunta del ciclo y ahora por fin hay pantalla para preguntársela.

**Cuidado con la guardia.** El defecto no fue que faltara una validación: fue que existía una guardia defensiva (`if (SGC.core.requerimiento)`) que la salteaba **sin avisar** cuando el módulo no estaba cargado. Verificá que no queden guardias del mismo tipo: una condición que, si no se cumple, hace que una regla desaparezca en silencio en vez de fallar ruidosamente. Buscalas.

---

## 3. Los bordes del desborde

Ahora sí existe la regla, así que las preguntas del ciclo pasado tienen respuesta:

- **255, 256, 257**, y decime cuál queda de cada lado.
- **El techo del anexo.** El desarrollador partió el límite en dos: 256 impreso y **2000 como tope duro de entrada**. Probá 1999, 2000 y 2001, y verificá que el tope de 2000 se aplique **también en el servidor**, no sólo en la pantalla.
- **Qué cuenta como carácter.** `String.length` cuenta unidades UTF-16: para acentos y eñes coincide con lo que ve el usuario, para emojis no. Verificá que el criterio esté documentado en el informe y que sea **el mismo en los tres lugares** donde hoy vive un `length`: el validador, el contador visible del wizard y la regla de desborde. Tres cortes distintos sobre el mismo texto es un hallazgo.
- **Nomenclatura, referencia cruzada y anexo condicional:** dos, tres y cuatro renglones desbordados; que `"según anexo alfa"` apunte al anexo que efectivamente contiene ese renglón; un renglón que se borra después de haber desbordado; ningún desborde y sin condiciones particulares ⇒ el anexo **no se genera**, verificado en disco y no en pantalla; condiciones particulares sin desbordes ⇒ sí se genera.
- ¿Se puede avanzar de estado con un renglón desbordado y **sin** el anexo generado?

---

## 4. La pantalla

Todo lo de `ORDEN-RONDA-10-AUDITORIA.md` §2, que quedó sin poder ejecutarse: la base sin valor por defecto, el presupuesto elegido de una lista (R-09-1 tiene que quedar cerrado **por los dos lados**), el promedio y el preventivo visibles y **calculados por el núcleo y no por la vista**, el borrador local sobreviviendo a un cierre con los campos nuevos, y entrada hostil en los dieciséis campos del encabezado y en las condiciones particulares.

Y lo que no se pudo verificar sin pantalla: **`check-compat` sobre los archivos nuevos** y navegación completa por teclado.

---

## 5. La leyenda y el vocabulario (ADR-023)

En el ciclo pasado no aparecía en ningún lado; ahora debería estar en **los tres**: pantalla del expediente, pie de **cada** entregable generado y `resumen.md` del export. Verificá los tres, y de paso la leyenda de **ADR-016**, que comparte los mismos lugares y sobre la que dejaste una sospecha bien ubicada.

El barrido de vocabulario ya salía limpio: confirmá que los textos nuevos de la pantalla no lo ensuciaron.

---

## 6. Correcciones y regresiones

- **H-03:** `MAX_ACLARACION` en 256, **en un solo lugar**, sin ningún 200 residual en código, tests, esquemas ni datos de prueba.
- **H-04:** un cuerpo sobre 4 MB debe responder **413** con mensaje, no cortar el socket.
- Las regresiones de siempre, incluidas **tus cinco casos manuales del preventivo**: la pantalla nueva no puede haberlos movido.
- `node --test` en verde de una sola pasada; ningún archivo sobre 400 líneas.

---

## 7. El reporte — `AUDITORIA-CICLO-10-BIS.md`

Misma estructura, con las secciones **"La pantalla contra el servidor"** y **"Los bordes del desborde"**, que esta vez sí se pueden completar.

Agregá una sección corta:

```
## Estado de los hallazgos del ciclo 10
H-01, H-02, H-03, H-04: cerrado / abierto / parcial, con la evidencia al lado.
Y cuáles de tus 13 tests adversarios en rojo pasaron a verde.
```

Cierre: un solo commit, `Auditoria ciclo 10 bis`, sin push.

---

## 8. Qué se espera de vos

Que verifiques que el agujero que encontraste está tapado **y que no quedó otro de la misma forma**.

El defecto de H-02 no fue una regla olvidada: fue una regla que existía y que **una guardia defensiva desactivaba en silencio**. Ese patrón —código escrito para que los tests no rompan, que en producción apaga un control— es el que hay que cazar esta vez.

La pregunta que guía esta auditoría: **¿qué otra regla se apaga sola cuando algo no está cargado?**
