# ORDEN DE AUDITORÍA — RONDA 24

SGC · emitida el 2026-09-24, junto con `ORDEN-RONDA-24.md`
Reglas: `CICLO_DE_TRABAJO.md` (lista de control). Vale la §0 de
`ORDEN-RONDA-20-AUDITORIA.md`: tope de tiempo en todo y un reintento como máximo. **No
manejás el navegador.**

**Desde esta ronda tu trabajo es sólo mecánico.** Las preguntas de criterio —si algo
"tiene sentido"— son del Jefe de Contrataciones. Vos contás, corrés, quitás y
comparás.

Clon limpio en `auditoria\ciclo-24\`, desde GitHub. Lo que no está empujado no existe.

---

## 1 · Control de entrega

- `git log --oneline`: **un commit por pieza**, con el nombre que da la orden, más el
  del informe. Decí cuántas de las nueve llegaron.
- **Pieza 1:** el commit tiene que contener los 5 archivos que dejó el revisor, **y
  además** los tests nuevos. Si trae sólo los 5 archivos, falta el test: es un hallazgo.
- `INFORME-RONDA-24.md`, en la raíz.

## 2 · La suite

- **La suite completa en el clon, sin fijar ninguna variable a mano → 0 fallas.** Es el
  criterio de la pieza 2. Si falla algo, cuál y por qué.
- `node tools/check-compat.js` → 0 violaciones.

## 3 · Tres experimentos de remoción

Quitar la corrección → correr su test → **rojo** → restaurar → diferencia cero y
`node --check`.

| # | Quitar | Tiene que ponerse rojo |
|---|---|---|
| E1 | volver a agregar `.accion-bloque button { background-color: var(--color-fondo-panel); }` en `main.css` | el test que lee `main.css` (pieza 1) |
| E2 | en `pasos.js`, dejar de guardar `item` | el test del documento con descripciones (pieza 8) |
| E3 | la restauración del scroll en `requerimiento-valores.js render()` | el test de "Agregar valor" (pieza 3) |

## 4 · Controles contados

- **Pieza 8:** `grep -rn "descripcion:" tests/` → **cero fabricaciones** de
  descripción en los tests, contado con la búsqueda entera.
- **Pieza 8:** corré `tools/completar-descripciones.js` sobre una copia de
  `tests/fixtures`, o sobre un expediente creado por la montura sin `item`. Tiene que
  completar `item` y **dejar todo lo demás byte a byte igual**, con la versión previa en
  `hist/`.
- **Pieza 5:** en `app/index.html`, la sección `expediente-acciones` está antes que las
  del requerimiento y los documentos. Dalo por línea.
- **Pieza 6:** el vencimiento por inactividad **sigue en 15 minutos** (`sesion.js`).
  Que la sesión viva no la haya alargado por la puerta de atrás.
- **Pieza 9:** con la montura, un rol que no ejecuta el estado **no puede** guardar
  renglones por PUT. Si puede, anotalo: es R53, y va a la matriz de la ronda 25.

## 5 · Tu reporte — `auditoria\ciclo-24\AUDITORIA-CICLO-24.md`

- Qué piezas llegaron y con qué commit.
- La suite: cuántos tests, cuántos pasan y cuánto tardó.
- Los tres experimentos, con el rojo que vio cada uno.
- Los controles de §4, con archivo y línea.
- **Cuánto tardaste**, en total.

**Nada más.** Sin opiniones sobre el diseño. Si ves algo que te parece mal pensado,
**anotalo en una línea al final**, como pregunta para el Jefe, sin calificarlo.

Cierre: commit `Auditoria ciclo 24`, sin push.
