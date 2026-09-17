# ORDEN DE AUDITORÍA — RONDA 23

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Emitida: 2026-09-17 · junto con `ORDEN-RONDA-23.md`

---

## 0. Antes de empezar

Vale la §0 de `ordenes/ORDEN-RONDA-20-AUDITORIA.md` íntegra, y muy en particular
**las reglas de tiempo**: tope en todo lo que pueda colgarse, un reintento como
máximo, **y un tope vencido es un hallazgo, no un accidente** — va al informe con
su renglón.

**No manejás el navegador.** Desde la ronda 21 esa verificación no es tuya: la
automatizada la hace el desarrollador con la montura, y el recorrido humano lo
hace el Jefe de Contrataciones. Vos leés código y corrés tests. Te costó dos días
en el ciclo 20 y no terminó.

### Clonás de GitHub, no de la carpeta del desarrollador

`auditoria/ciclo-23/`, clon limpio. Si algo no está empujado, **para vos no
existe**, y eso es exactamente lo que hay que informar.

### Esta ronda se entrega en piezas, y eso cambia tu trabajo

La ronda 23 son **siete commits**, uno por pieza. Lo primero que hacés es
`git log --oneline` y **decir cuántas piezas llegaron**. Una ronda de cuatro
piezas de seis no es una ronda incumplida: es una ronda cortada, y cortada en el
lugar correcto si las cuatro están completas cada una.

Auditá **sólo lo que llegó**. Lo que no llegó se nombra y se pasa.

---

## 1. El control de entrega

Antes de cualquier otra cosa:

- `git log --oneline -10` — los commits de la ronda 23, con su nombre.
- **¿Cada pieza tiene commit propio?** Si vinieron todas juntas en un solo commit
  final, es un incumplimiento de §0 de la orden, y de los importantes: es
  exactamente lo que esta ronda venía a corregir.
- `INFORME-RONDA-23.md` en la raíz, con las nueve secciones.
- La suite completa, en el clon limpio, con tope de tiempo. **Cuántos pasan,
  cuántos fallan, cuánto tardó.**

---

## 2. Los tres experimentos de remoción · **tres, no más**

La regla §3.13: un test que no se pone en rojo cuando se saca la corrección no
está probando nada. Sacá la corrección, corré el test, confirmá el rojo,
restaurá.

**Los tres de esta ronda**, y ningún otro:

| # | Qué sacar | Qué test tiene que ponerse rojo |
|---|---|---|
| **E1** | La guardia de rol de `presupuestos.js apiGuardarPresupuesto` | el test de los siete roles contra presupuestos |
| **E2** | La guardia de administrador de `pliego-plantillas-api.js apiEstampar` | el test de la plantilla vigente |
| **E3** | El límite único de 20 MB, cambiándolo a otro número | los tres consumidores tienen que moverse juntos |

**E3 es el más importante de los tres** y no es una remoción: es el que prueba que
el límite está escrito una sola vez de verdad. Si hay que tocar dos archivos para
cambiar el número, el criterio no se cumplió por más que el test pase.

Si alguno de los tres no se pone rojo, **es un hallazgo alto** y va primero en tu
informe.

---

## 3. Lo que hay que leer, pieza por pieza

### Pieza 2 — las tres guardias

- ¿Usan **el patrón que ya está en `apiCrear`** (`autorizacion.verificar` contra el
  padrón vivo, rol desde la sesión), o inventaron uno nuevo? Un patrón nuevo para
  el mismo problema es deuda, aunque funcione.
- ¿El rol sale de **la sesión** o del cuerpo de la petición? Si sale del cuerpo, es
  el defecto del ciclo 14 otra vez y es alto.
- Presupuestos y entregables: ¿se atan **al rol del estado** o a un rol fijo? Un
  rol fijo pasa los tests de hoy y se rompe en el primer estado que no pensaron.
- ¿Los mensajes de 403 dicen **qué rol hace falta**, en castellano?

### Pieza 3 — el transporte binario

- ¿El servidor **escribe el cuerpo directo al archivo**, o lo junta en memoria y
  después lo escribe? Buscá específicamente que no haya quedado un
  `Buffer.concat` o un acumulador de trozos: eso es exactamente lo que la pieza
  venía a eliminar, y pasa todos los tests igual.
- ¿El tope de cuerpo general **siguió chico** para el resto de la API?
- ¿Las mediciones del informe son **medidas o estimadas**? Si dicen "aproximadamente",
  no son mediciones.

### Pieza 4 — el límite

- ¿Dónde está declarado? **Contalo vos**: `grep` del número y del nombre de la
  constante en todo el repositorio, servidor y cliente.
- ¿El aviso del cliente ocurre **antes** de leer el archivo, o después?

### Pieza 6 — la suite

- ¿La tabla de tiempos por archivo está **completa**, los 52?
- ¿La explicación de por qué no paraleliza está **comprobada o supuesta**? Esta es
  la que más fácil se responde con una hipótesis elegante y sin evidencia. Pedí el
  experimento que la sostiene.

---

## 4. La regresión de siempre

- **Los 9 caminos de persona, en verde.**
- **¿Se tocó algún test existente para que pase?** `git diff` sobre `tests/`: todo
  cambio en un test que ya existía se justifica o es un hallazgo.
- Los tests de las rondas 19, 20, 21 y 22 siguen verdes. En particular
  `ronda-22-nacimiento.test.js`, que es lo único que entregó la ronda anterior.
- `node tools/check-compat.js` — el guardián de compatibilidad, en verde.
  **Chrome 109 es el piso y el transporte binario es donde se rompe** (ADR-011):
  mirá con atención qué API usa la subida nueva.

---

## 5. Lo que quiero que mires aunque no esté en la orden

- **`sugerencias.js apiCrearSugerencia` no verifica nada, y eso está bien a
  propósito** —es el buzón del piloto—. Confirmá que nadie "lo corrigió" de paso.
  Cerrar esa puerta deja al Jefe sin el canal por donde llegan los hallazgos que
  ningún test encuentra.
- **¿Apareció una cuarta puerta sin guardia** que el barrido B1 no vio? Si el
  patrón de la pieza 2 se copió a mano tres veces, probablemente haya un cuarto
  lugar donde falta.

---

## 6. Tu informe — `auditoria/ciclo-23/AUDITORIA-CICLO-23.md`

Como siempre, y tres cosas propias de esta ronda:

- **Cuántas piezas llegaron, y si cada una tiene su commit empujado.** Es el
  criterio nuevo de la ronda y sos el único que lo puede verificar.
- **Los tres experimentos de remoción**, con el rojo que vio cada uno.
- **Cuánto tardaste vos**, y en qué se te fue el tiempo. Vengo corrigiendo el
  método de auditoría dos rondas seguidas y necesito el número para saber si
  quedó bien.

Y lo de siempre, que es lo que hace útil tu informe: **si algo del informe del
desarrollador no coincide con lo que ves en el disco, decilo con el archivo y la
línea.** No hace falta que sea grave para que valga.
