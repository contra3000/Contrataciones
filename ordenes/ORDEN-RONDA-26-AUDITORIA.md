# ORDEN DE AUDITORÍA — RONDA 26

SGC · emitida el 2026-09-29, junto con `ORDEN-RONDA-26.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. Vale la §0 de `ORDEN-RONDA-20-AUDITORIA.md`. **Sólo
mecánico; no manejás el navegador.**

**El clon lo hizo el desarrollador** en `auditoria\ciclo-26\`. Antes que nada:

- `git fetch origin` y `main` = `origin/main`;
- `git status` limpio;
- el commit coincide con el que pegó el desarrollador al final de su informe.

Si algo falla, no auditás: lo decís y cerrás.

**Acceso nuevo, de sólo lectura** (respuesta a tu pregunta del ciclo 25): copiá
`..\..\dev\datos-prueba\catalogo_incisos.json` a `datos-prueba\` **de tu clon**, que está
en `.gitignore`, así que no se commitea. Así corre la verificación de las 159.366
filas. No modifiques el original.

---

## 1 · Control de entrega

- Un commit por pieza, más el del informe. ¿Cuántas de las seis llegaron?
- El informe dice qué no entró y por qué, y termina con las dos líneas del clon.

## 2 · La suite

- Completa, con el catálogo copiado → **0 fallas y 0 salteados**. Si el de
  `build-catalogo` sigue salteado, decí por qué.
- `node tools/check-compat.js` → 0 violaciones.

## 3 · Tres experimentos de remoción

| # | Quitar | Tiene que ponerse rojo |
|---|---|---|
| E1 | `camposRequeridos: ['numeroSCo']` de `SOLICITUD_CONTRATACION` en `config.js` | el test "sin número no avanza" (pieza 4) |
| E2 | la exigencia de 2 valores en `validarParaAvanzar` | el test del renglón con 1 valor (pieza 5) |
| E3 | la comprobación del candado vivo en `arranque.js` | el test de los dos servidores (pieza 6) |

## 4 · Controles contados

- `git grep -n "solicitud-contratacion" -- app server` → **0**, salvo en código que
  sólo lea expedientes viejos. Si hay, cuál y por qué.
- `git grep -n "expediente\.id\b" -- app` → lo que quede, con archivo y línea.
- **Dos servidores, a mano:** arrancá uno sobre una carpeta temporal y después otro
  sobre la misma → el segundo no arranca y nombra al primero. Cerrá los dos y
  comprobá que **no quede ningún `node.exe`**.
- **El `python` colgado, a mano:** un script que duerme → el pedido termina dentro del
  tope y el proceso no queda vivo.
- **La matriz de 18 × 7 no cambió:** `git diff` de la ronda sobre `ESTADOS` en
  `config.js` → sólo cambian `camposRequeridos` y `entregablesObligatorios` de
  `SOLICITUD_CONTRATACION`, y nada de `rolEjecutor`, `estadosSiguientes` ni
  `estadosDevolucion`. **`ANALISIS_SCo` no se tocó.**

## 5 · Reporte — `auditoria\ciclo-26\AUDITORIA-CICLO-26.md`

- Las piezas.
- La suite, con los salteados.
- Los tres experimentos.
- Los controles de §4, con archivo y línea.
- Cuánto tardaste.
- Si algo te parece mal pensado: una línea al final, como pregunta para el Jefe.

Cierre: commit `Auditoria ciclo 26`, sin push.
