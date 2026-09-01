# ORDEN DE TRABAJO — RONDA 17

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hitos cubiertos: **H10 (cierre)** y **H20 (cierre)** — las seis correcciones del ciclo 16
Emitida: 2026-09-01

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`.

Del ciclo 16, **la mitad que habilita instalar salió bien**: sin padrón el servidor no arranca, el modo declarado dejó de activarse solo, y el mensaje del padrón ilegible dejó de filtrar el error en inglés. **368 tests en verde.** Y las trece correcciones normativas del log están cargadas en la v1 de las tres plantillas, cada una con su código en la nota de cambio.

Dos cosas que hiciste bien y que quiero nombrar:

1. **Derivaste `tipo_contrato` y `tipo_documento` del expediente** con la misma normalización en el cliente y en el servidor. Era lo que pedía §3.7 y quedó bien.
2. **La tabla de reglas funciona**: la regla específica le gana a la general, y cuando ninguna coincide se usa la de defecto y se dice.

### Y esta ronda es corta y consecuente

Son **seis correcciones**. Al terminarlas, esto se instala en un equipo de la intranet y catorce personas empiezan a usarlo. **No hay hito nuevo**: lo que sigue es que la aplicación esté en manos de gente.

### Accesos fuera del repositorio

`os.tmpdir()`, `127.0.0.1`, y **sólo lectura** sobre `AppOptimizar\EjemplosProcesoActual\DocUOC\Generador de Pliegos\`, con permiso de ejecutar `scripts/generar_pliego.py` hacia una carpeta temporal. Nada más.

---

## 1. La corrección principal · publicar una plantilla sin probarla

```js
// server/pliego-plantillas-api.js:112
if (cuerpo.pliegoProbado !== true) { ... }
```

`cuerpo` es lo que manda el cliente. **Publicar exige haber probado… salvo que le mandes la palabra.** El auditor publicó, en un solo POST, una plantilla que el generador real rechaza.

**Es la cuarta vez que aparece la forma de ADR-036**, con una vuelta de tuerca que conviene entender antes de corregir: el probador **corre** el generador, obtiene un resultado, **lo descarta**, y después el publicador consulta un resultado que ya nadie guardó.

La corrección:

- **El servidor guarda que la prueba ocurrió**, atada al **contenido exacto** que se probó —un hash del contenido alcanza—.
- **Publicar verifica ese registro contra el contenido que se está publicando.** Si el contenido cambió después de probar, hay que probar de nuevo.
- **La bandera del cliente se ignora.** No se compara: se ignora, como el `contexto.rol` de la ronda 14. Si el servidor la lee, sigue leyendo un dato que elige el cliente.
- El registro de pruebas **no tiene por qué ser eterno**: puede vivir en memoria y perderse al reiniciar. Que haya que probar de nuevo después de un reinicio es correcto.

Y cerrá los caminos laterales que el auditor enumeró: publicar por API sin pasar por la pantalla, editar y publicar en dos pasos, y **volver a una versión vieja y editarla después**.

---

## 2. El pliego de servicios · y el probador que miente

El auditor encontró la causa completa y es más interesante que el síntoma.

`tipo_contrato` se deriva bien. Lo que falta está un campo más abajo: el generador exige `plazo_entrega_servicio` y `garantia_servicio` cuando el tipo es `servicios`, y **la exportación nunca los emite**. Lo verifiqué: no aparecen en ninguna línea de la vista de exportación.

**Y nadie lo vio porque el probador los fabrica.** `construirDatosEjemplo` inventa esos dos campos, así que "Probar ahora" devuelve OK para servicios — **el probador prueba un expediente que el sistema nunca va a poder emitir.**

Dos correcciones, y la segunda es la que importa:

1. **Emitir los dos campos** desde el ANEXO 1, y **avisar antes** si faltan: el usuario tiene que enterarse al cargar, no cuando el pliego no sale.
2. **El probador tiene que usar un expediente que la aplicación pueda producir de verdad.** Si fabrica datos que la exportación no emite, no está probando el sistema: está probando una ficción. Construí el expediente de ejemplo **con la misma función de exportación** que usa el flujo real.

Ese segundo punto vale para siempre: **un banco de pruebas que se arma con datos que el sistema no genera deja de probar el sistema.**

---

## 3. La lista de roles del instructivo

`INSTRUCTIVO.md` §7 dice que los roles válidos son `..., juridica, generador, consultor`.

**`consultor` no existe.** Y falta `contaduria`. Como el alta es todo-o-nada, quien copie esa lista el día uno **no crea ningún operador** y el servidor no arranca — con gente esperando.

Los siete reales están en `app/js/core/config.js`. Corregí la lista, corregí el §8 que arrastra el mismo error, y —esto es lo que evita que vuelva a pasar— **agregá un test que verifique que la lista del instructivo coincide con la de `config.js`**. Una lista escrita a mano en un manual es un dato duplicado, y ya sabemos cómo termina eso.

Y de paso: `tools/padron.js` ya imprime los roles válidos cuando uno no existe. **Que el mensaje diga también dónde están documentados.**

---

## 4. La reproducibilidad, que hoy es decorativa

El expediente estampa id y versión de la plantilla que lo produjo, y **nada consulta ese dato**: el único endpoint de contenido devuelve la versión vigente hoy. Regenerar el pliego de un expediente de hace un año usa la plantilla de hoy.

- **Un endpoint que devuelva una versión concreta.**
- **La regeneración usa la versión estampada**, no la vigente.
- Y si esa versión ya no existiera, **decirlo**, no caer a la vigente en silencio.

Era el criterio que la orden anterior marcó como decisivo: *"si usa la vigente, la reproducibilidad no existe"*.

---

## 5. Se cerró de más

Los roles no publicadores reciben `403` al **ver** plantillas e historial. La intención documentada —y la de ADR-032 §5— es que **las vean**: que sea auditable importa más que que sea restringido.

Abrí la lectura a todos los roles autenticados. Publicar, volver a una versión y editar siguen siendo de `contrataciones_supervisor` y `juridica`.

**Y el comentario de cabecera del archivo decía que los demás podían ver, cuando no podían.** Cuando corrijas, verificá que el comentario y el código digan lo mismo.

---

## 6. Dos cosas chicas

### 6.1 — La plantilla no numera sola, y la nota dice que sí

`config/plantillas-v1.json` afirma: *"Las cláusulas e incisos los numera la plantilla sola (imposibilita E01/E02/E05)"*. **No es cierto**: los números vienen escritos a mano en el contenido.

Elegí una de las dos, y las dos son aceptables:

- **Implementarlo**: que la plantilla marque las secciones y la numeración se genere. Hace imposibles E01, E02 y E05 del log.
- **O corregir la nota**, y anotar en el plan que la numeración automática queda pendiente.

Lo que no puede quedar es la afirmación falsa. **El que lea ese archivo el año que viene va a creer que el problema está resuelto**, y va a dejar de mirarlo.

### 6.2 — El error de la máquina, otra vez

`server/ayudantes.js:310` y `server/pliego-probador.js:188` concatenan `e.message` a un texto nuestro. Para un JSON malformado eso es el mensaje de V8 en inglés; para el probador, el error crudo del generador.

Es la misma clase que corregiste en `arranque.js`. **Barré los tres archivos y corregí la clase, no los dos casos.**

Y una del auditor que vale: `ejecutarPython` invoca `python` a secas. **En un equipo sin `python` en el PATH, "Probar ahora" falla antes de llegar al generador.** Detectalo y decilo con un mensaje que sirva.

---

## 7. Tests

Conservando en verde todo lo anterior, en un clon limpio:

1. Publicar con `pliegoProbado: true` **sin haber probado** → **rechazado**.
2. Probar, **cambiar el contenido**, publicar → rechazado: hay que probar de nuevo.
3. Probar y publicar el mismo contenido → aceptado.
4. Volver a una versión vieja y editarla sin probar → rechazado.
5. Un expediente de **servicios** emite `plazo_entrega_servicio` y `garantia_servicio`, y **el generador real produce el pliego**.
6. Si faltan esos campos, **se avisa al cargar**, no al generar.
7. El **probador** arma su expediente de ejemplo **con la función de exportación real**.
8. La lista de roles del `INSTRUCTIVO.md` **coincide con `config.js`** (test).
9. Regenerar el pliego de un expediente estampado con la versión N **usa la versión N**, aunque haya una más nueva vigente.
10. Si la versión estampada no existe, **se dice**; no cae a la vigente.
11. Todos los roles autenticados **ven** plantillas e historial; sólo dos publican.
12. Ningún mensaje al usuario concatena el mensaje de un error del sistema.
13. Sin `python` en el PATH, "Probar ahora" **dice qué falta**.
14. La suite completa termina en verde de una sola pasada.

---

## 8. `INFORME-RONDA-17.md` — las nueve secciones

En la §2, tres cosas explícitas:

- **cómo guardás que la prueba ocurrió**, y qué pasa al reiniciar;
- **cómo arma el probador su expediente de ejemplo** después de la corrección;
- **qué elegiste** sobre la numeración automática, y por qué.

---

## 9. Cierre

```
node --test
node tools/check-compat.js
git add -A
git commit -m "Ronda 17 - Cierre de H10 y H20"
git push
git log --oneline -1
git status --short
git log origin/main --oneline -1
```

---

## 10. Criterios de aceptación

| # | Verificación | Resultado exigido |
|---|---|---|
| 1 | `node --test` en clon limpio, una pasada | Verde |
| 2 | `check-compat` | Salida 0 |
| 3 | `pliegoProbado` del cliente | **Ignorado**; el servidor guarda la prueba |
| 4 | Contenido cambiado después de probar | Rechaza publicar |
| 5 | Pliego de **servicios** | **El generador real lo produce** |
| 6 | El probador | Usa la exportación real, no datos fabricados |
| 7 | Lista de roles del instructivo | Coincide con `config.js`, verificado por test |
| 8 | Regeneración | Usa la versión **estampada** |
| 9 | Lectura de plantillas | Todos los roles autenticados |
| 10 | Mensajes | Ninguno concatena el error de la máquina |
| 11 | Nota del seed sobre numeración | Verdadera, o corregida |
| 12 | Archivos sobre 400 líneas | Ninguno |
| 13 | Informe con las nueve secciones | Completo |

---

## 11. Qué se está evaluando

**Que ninguna validación dependa de que el cliente diga la verdad.**

Es la cuarta vez que aparece la misma forma —el rol declarado, la guardia silenciosa, el padrón retratado, y ahora la prueba olvidada—. Cada vez tuvo otro disfraz y la misma consecuencia: **el sistema funciona, nadie ve un error, y el comportamiento es el equivocado.**

Y una segunda, que sale del hallazgo del probador: **que probar el sistema no sea probar una ficción.** Un banco de pruebas que se arma con datos que el sistema no puede generar deja de probar el sistema.

Pesa, en este orden: (1) que la prueba no se pueda saltear, (2) que el pliego de servicios salga del generador real, (3) que el probador use la exportación real, (4) la lista de roles, (5) la reproducibilidad.

Al terminar esta ronda, **esto se instala**.
