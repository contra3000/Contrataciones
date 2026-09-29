# ORDEN DE AUDITORÍA — RONDA 27

SGC · 2026-09-29, junto con `ORDEN-RONDA-27.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. **Sólo mecánico; no manejás el navegador.**

El clon lo hizo el desarrollador en `auditoria\ciclo-27\`. Antes que nada:

- `git fetch origin` y `main` = `origin/main`;
- `git status` limpio;
- el commit coincide con el del informe.

Si algo falla, no auditás: lo decís y cerrás.

**Accesos:** copiá `..\..\dev\datos-prueba\catalogo_incisos.json` a `datos-prueba\` de tu
clon, como en el ciclo 26. **La suite, con `--test-timeout=120000`.**

---

## 1 · Control de entrega

Un commit por pieza, más el del informe. **¿Cuántas de las seis llegaron?** Y el
primer commit de la ronda tiene que ser el de publicar las órdenes (paso 0).

## 2 · La suite

- Completa → **0 fallas y 0 salteados**.
- `node tools/check-compat.js` → 0 violaciones.

## 3 · Tres experimentos de remoción

| # | Quitar | Tiene que ponerse rojo |
|---|---|---|
| E1 | la restauración desde `hist/` cuando una escritura del grupo falla (pieza 4) | el test de "falla a la mitad → quedan todos como estaban" |
| E2 | la suma de renglones del mismo código en el ANEXO I (pieza 5) | el test del renglón sumado con desglose |
| E3 | `abandonadoEnEstaMaquina` en `server/candado.js` (pieza 1) | el test del pid muerto en esta máquina |

**Y los dos de la ronda anterior, otra vez:** quitá `candado.tomar` y el tope del
`python`. Esta vez tienen que dar **rojo en menos de 2 minutos**, no colgar. Es el
criterio de la pieza 2.

## 4 · Controles contados, a mano

- **Una SCo de 3**, con servidor real y sesiones reales (generador y abastecimiento):
  - avanzar uno → los 3 cambian de estado **en el disco**;
  - uno sin cumplir → **ninguno** cambia, y la versión de los 3 queda igual;
  - devolver a Fase 1 → vuelven los 3 y el registro de la SCo sigue existiendo.
- **Sumarse a una SCo que ya avanzó** → 409, y el registro no cambia.
- **El ANEXO I consolidado:** dos requerimientos con un código repetido → en el
  documento hay **un** renglón con la suma, y el desglose da exactamente las cantidades
  de cada uno.
- **La matriz de 18 × 7 no cambió:** `git diff` de la ronda sobre `ESTADOS` en
  `config.js`. Decí qué cambió.
- **El ADR-043** está en `BITACORA_DECISIONES.md`.

## 5 · Reporte — `auditoria\ciclo-27\AUDITORIA-CICLO-27.md`

- Las piezas.
- La suite.
- Los experimentos, los tres más los dos repetidos.
- Los controles de §4, con archivo y línea.
- Cuánto tardaste.
- Si algo te parece mal pensado: una línea al final, como pregunta para el Jefe.

Cierre: commit `Auditoria ciclo 27`, sin push.
