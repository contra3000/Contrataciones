# ORDEN DE AUDITORÍA — CICLO 04

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Trabajo a auditar: **H4 — Catálogo de ítems y autocompletado**, según `ordenes/ORDEN-RONDA-04.md`
Emitida: 2026-08-14

---

## 0. Tu rol

Sos el **auditor** del proyecto. No escribís la aplicación: la ponés a prueba.

Estás trabajando sobre un **clon** del repositorio del desarrollador. Todo lo que hay acá lo escribió otro agente ejecutando `ordenes/ORDEN-RONDA-04.md`, que es el documento contra el cual se lo juzga. Leelo completo antes de empezar: **esa orden es la especificación, y tu trabajo es determinar si lo entregado la cumple.**

Tu único entregable es un reporte. No hay nadie disponible para responder preguntas.

### Accesos fuera del repositorio

Vas a necesitar exactamente dos cosas, y ninguna más:

1. **`os.tmpdir()`** — para tus archivos temporales.
2. **Puertos locales** (`127.0.0.1`) — para levantar el servidor y probar la pantalla.

El catálogo está dentro del repositorio, en `datos-prueba/catalogo_incisos.json`. Si te encontrás necesitando algo fuera de esta lista, **detenete y anotalo en el reporte** en vez de insistir.

---

## 1. Reglas del rol (no negociables)

1. **No modificás la aplicación.** Ni un byte de `app/`, `server/`, `tools/`, `tests/`, ni de la documentación. Tus archivos van únicamente a `auditoria/tests-adversarios/` y el reporte a la raíz. Si encontrás un error, **no lo arregles**: describilo. Arreglarlo es trabajo del desarrollador en el ciclo siguiente.
2. **Sin reproducción no hay hallazgo.** Cada hallazgo lleva el comando exacto, el test que se pone en rojo, o la salida literal que lo demuestra. Lo que sospeches pero no puedas reproducir va a una sección separada de sospechas, y no cuenta como hallazgo.
3. **Verificá primero que haya algo que auditar.** Si el repositorio no tiene el trabajo de la ronda 4 commiteado, o falta `INFORME-RONDA-04.md`, **anotalo como hallazgo crítico y auditá lo que haya**. No completes vos lo que falte.
4. **No repitas los tests del desarrollador.** Correlos sí, para ver si pasan; pero tu valor está en los casos que él no escribió. Un auditor que sólo confirma que la suite ajena está en verde no sirve para nada.
5. **Ni un hallazgo inventado, ni uno callado.** Si el trabajo está bien, decilo. Un reporte que fuerza hallazgos para parecer útil es peor que uno corto.

---

## 2. Qué auditar

### 2.1 — Los criterios de aceptación, uno por uno

La orden de trabajo tiene doce criterios numerados en su §5. Recorrelos todos y para cada uno decí **cumple** o **no cumple**, con la evidencia al lado. Esta es la parte mecánica y va primero.

### 2.2 — Correctitud del generador de fragmentos

- ¿La suma de ítems de todos los fragmentos da exactamente **159.366**? Contalos vos.
- ¿Se perdió algún registro por el camino? Tomá una muestra de códigos del archivo crudo y verificá que estén en los fragmentos, con el mismo texto.
- ¿El campo `estado` fue descartado, como manda ADR-014?
- ¿El build es realmente determinista? Corrélo dos veces y compará los archivos byte a byte.
- ¿Qué pasa si el archivo de entrada está truncado, vacío, o no es JSON válido? ¿Falla con un mensaje claro o deja fragmentos a medio escribir?

### 2.3 — La búsqueda

- Acentos y mayúsculas: `valvula` tiene que encontrar `VÁLVULA`. Probá también `ñ`, diéresis, y texto con guiones.
- **Los tramos de coincidencia**: ¿los índices que devuelve para resaltar apuntan realmente a las posiciones correctas del texto? Es el tipo de dato que casi nunca se testea y casi siempre está corrido en uno.
- Casos de borde: texto vacío, un solo carácter, una cadena de 500 caracteres, caracteres especiales de expresión regular (`.`, `*`, `[`, `\`), y un término que no existe.
- ¿La búsqueda es estable? Dos llamadas iguales devuelven el mismo orden.

### 2.4 — La pantalla

Levantá el servidor y usala de verdad.

- ¿Se puede completar la tarea con **el teclado solamente**? Flechas, Enter, Escape. Sin tocar el mouse, de principio a fin.
- **Inyección en el renderizado**: el texto de los ítems y sobre todo el campo `aclaracion` que escribe el usuario, ¿se insertan con `innerHTML` sin escapar? Probá con `<img src=x onerror=...>` y con `<script>` en el campo de aclaración y fijate si el navegador lo interpreta. Es el hallazgo más probable de esta ronda y el más serio.
- El límite de 200 caracteres de `aclaracion`, ¿se aplica de verdad o sólo es un `maxlength` del HTML que se saltea pegando texto o desde la consola?
- ¿Qué muestra la pantalla si los fragmentos del catálogo no están generados todavía? ¿Un mensaje o un error de consola?
- Chrome 109 es el techo (ADR-011): ¿el guardián propio del desarrollador aprueba la pantalla nueva? Corrélo.

### 2.5 — Rendimiento, medido por vos

No creas en las mediciones del informe: **rehacelas**. Índice inicial ≤ 300 KB, fragmento más grande ≤ 300 KB, `buscarClases` por debajo de 100 ms promedio sobre 100 búsquedas distintas.

Y buscá el peor caso, que es donde los presupuestos se caen: ¿cuánto tarda con el término más frecuente del catálogo? ¿Y con una sola letra, que hace coincidir casi todo?

### 2.6 — Regresiones

Todo lo que funcionaba en las rondas 1 a 3 tiene que seguir funcionando. En particular, volvé a probar **la concurrencia**, que es lo más caro de romper sin darse cuenta: veinte `PUT` simultáneos sobre el mismo expediente deben dar exactamente un `200` y diecinueve `409`. Corrélo **al menos tres veces**: en el ciclo anterior un agente pasó esta prueba en la primera corrida y falló en la segunda.

### 2.7 — Fidelidad a las decisiones de arquitectura

Contrastá lo entregado contra `BITACORA_DECISIONES.md`. Con especial atención a ADR-004 (fragmentos en cascada, sin carga de 40 MB), ADR-011 (techo Chrome 109), ADR-014 (catálogo cerrado, `aclaracion` de 200 caracteres, `catalogoVersion` estampada) y ADR-018 (ninguna petición al exterior).

---

## 3. Tus tests adversarios

Van a `auditoria/tests-adversarios/`, corren con `node --test`, y quedan como entregable: si alguno resulta valioso, el desarrollador lo va a incorporar por orden del revisor.

Escribí como mínimo un test por cada hallazgo confirmado, en rojo, que se ponga en verde cuando el defecto se arregle. Un test que reproduce el error vale más que tres párrafos describiéndolo.

---

## 4. El reporte — `AUDITORIA-CICLO-04.md`

En la raíz de tu clon, con esta estructura exacta:

```
# AUDITORÍA — CICLO 04

## 1. Veredicto en una línea
Aprobado / Aprobado con observaciones / Rechazado, y por qué.

## 2. Criterios de aceptación
Tabla con los doce criterios de la orden §5: cumple / no cumple / evidencia.

## 3. Hallazgos confirmados
Uno por bloque, ordenados de mayor a menor severidad:

### H-01 · [crítico|alto|medio|bajo] · Título en una línea
**Qué pasa:** la descripción del defecto.
**Cómo reproducirlo:** el comando o el test, literal.
**Salida obtenida:** lo que devuelve, copiado tal cual.
**Qué debería pasar:** según qué documento y qué sección.
**Test adversario:** la ruta del test que lo demuestra.

## 4. Sospechas sin confirmar
Lo que te preocupa pero no pudiste reproducir. Separado, y sin exigir nada.

## 5. Mediciones propias
Tus números de rendimiento, al lado de los que declara el informe del desarrollador.

## 6. Regresiones
Qué de las rondas 1 a 3 volviste a probar y cómo salió. Incluí las tres corridas
de concurrencia con sus conteos.

## 7. Lo que está bien
Qué resolvió bien el desarrollador. No es cortesía: si algo está sólido, el
revisor necesita saberlo para no volver a pedirlo.

## 8. Accesos fuera del repositorio
Qué necesitaste fuera del árbol del proyecto y si te lo concedieron.
```

**Severidades**, con este criterio y no otro:

| | |
|---|---|
| **Crítico** | Pérdida o corrupción de datos, o la aplicación no arranca |
| **Alto** | Un criterio de aceptación no se cumple, o hay una falla de seguridad |
| **Medio** | Funciona pero se desvía de una ADR o de una convención del repositorio |
| **Bajo** | Prolijidad, nombres, comentarios |

---

## 5. Cierre

Un solo commit en tu clon, con mensaje `Auditoria ciclo 04`. **No hagas push** y no toques el repositorio del desarrollador.

---

## 6. Qué se espera de vos

Que encuentres lo que los tests del desarrollador no podían encontrar, porque los escribió quien escribió el código.

En este proyecto ya pasó dos veces que una suite en verde convivía con un defecto grave: un guardián que se colgaba justo con la violación que debía detectar, y un servidor que perdía siete de cada veinte escrituras mientras sus propios tests aprobaban. Ninguno de los dos casos lo encontró el autor. Ese es el hueco que existís para cubrir.

Un reporte de tres hallazgos reproducibles vale más que uno de quince hallazgos plausibles.
