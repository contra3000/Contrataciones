# ORDEN DE AUDITORÍA — RONDA 25

SGC · emitida el 2026-09-25, junto con `ORDEN-RONDA-25.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. Vale la §0 de `ORDEN-RONDA-20-AUDITORIA.md`. **Sólo
mecánico. No manejás el navegador.**

**El clon ya lo hizo el desarrollador** en `auditoria\ciclo-25\`. Antes que nada:

- `git fetch origin`, y que `main` sea igual a `origin/main`;
- `git status` limpio;
- el commit coincide con el que el desarrollador pegó al final de su informe.

**Si algo de esto falla, no auditás: lo decís y cerrás.**

---

## 1 · Control de entrega

- `git log --oneline`: un commit por pieza y el del informe. ¿Cuántas de las seis
  llegaron?
- `INFORME-RONDA-25.md` existe, dice **qué no entró y por qué**, y termina con las dos
  líneas del clon.

## 2 · La suite

La suite completa → **0 fallas**. Y `node tools/check-compat.js` → 0 violaciones.

## 3 · Tres experimentos de remoción

| # | Quitar | Tiene que ponerse rojo |
|---|---|---|
| E1 | en `pasos.js`, dejar de guardar `item` | el test del documento con descripciones (pieza 5) |
| E2 | la guardia `autorizarRolDelEstado` del PUT de renglones | el test del `abastecimiento` con cantidad 99 (pieza 6) |
| E3 | la renovación de la sesión por actividad | el test de la sesión viva (pieza 3) |

Quitar → correr el test → rojo → restaurar → diferencia cero y `node --check`.

## 4 · Controles contados

- `git grep -n "descripcion:" -- tests` → **0**.
- **R53, repetido a mano** igual que en el ciclo 24: generador crea → sesión de
  `abastecimiento` → `PUT` con cantidad 99 → **tiene que dar 403** y el disco sigue con 2.
- `app/index.html`: la línea de `expediente-acciones` es **menor** que las de
  requerimiento, ANEXO 1 y documento.
- `server/sesion.js`: el vencimiento por inactividad **sigue en 15 minutos**.
- `tools/completar-descripciones.js` sobre un expediente de la montura sin `item` →
  completa `item`, el resto queda igual byte a byte, y la versión previa en `hist/`.

## 5 · Reporte — `auditoria\ciclo-25\AUDITORIA-CICLO-25.md`

- Las piezas que llegaron.
- La suite.
- Los tres experimentos.
- Los controles de §4, con archivo y línea.
- Cuánto tardaste.
- Si ves algo mal pensado: **una línea al final, como pregunta para el Jefe**.

Cierre: commit `Auditoria ciclo 25`, sin push.
