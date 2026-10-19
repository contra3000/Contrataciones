# ORDEN DE AUDITORÍA — RONDA 39 · Corrección de la 38, las cantidades de la OCA y los códigos con separadores raros

SGC · 2026-10-17, junto con `ORDEN-RONDA-39.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. **Sólo mecánico; no manejás el navegador.**

- **Clon:** `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-39`.
- **Antes de empezar:** `git fetch origin`, `main` = `origin/main` y árbol limpio.
- Copiá el catálogo grande a `datos-prueba\`.
- No borres ni muevas nada fuera de `os.tmpdir()`.

**Las secciones 1 a 5 van todas.** Cada afirmación lleva su evidencia: el comando y la
salida, o archivo y línea.

## 1 · Control de entrega

La tabla de commits, del paso 0 al informe, con:

- el asunto;
- si tiene cuerpo;
- la hora;
- los archivos.

Después contestá:

- ¿El paso 0 toca sólo `ordenes/` y `PLAN_DESARROLLO.md`?
- **¿Hay tres commits de código** (la corrección de la 38 y las dos piezas)? ¿Cuánto pasó
  entre uno y otro?
- **¿El commit de la corrección y el de la pieza 1 dejan la suite completa en verde?** Corré
  cada uno una vez en un `git worktree` temporal.
- ¿El informe describe, uno por uno, los tests viejos que cambiaron?
  (`git diff --stat fa1817c..HEAD -- tests/`)

## 2 · La suite

- **Tres corridas completas**, con `node --test --test-timeout=120000 "tests/*.test.js"`.
  De cada una: `tests / pass / fail / cancelled / skipped / duration_ms`, y la ruta del log.
  **Si aparece algún rojo en "matriz por servidor"**, copiá la salida entera de ese test
  (ítem 13 de la cola).
- **Los números del informe:** compará cada corrida que declara con su log.
- `node tools/check-compat.js` → 0 violaciones.
- `node tools/build-config.js --verificar` → código 0.

## 3 · Tres experimentos de remoción

| # | Quitar | Tiene que ponerse rojo |
|---|---|---|
| E1 | que "Sigue valiendo" oculte `#sgc-error-pac-justificacion` | el test de la corrección que aprieta "Siguiente" antes |
| E2 | la regla "máxima por Solicitud de Provisión ≤ cantidad del renglón" | el test de cantidad 10 con máxima 12 |
| E3 | la normalización del código en el importador | el test que pega `3.3.3   1627  36` |

## 4 · Controles contados

- **La aplicación con servidor.** Con `aplicacion-montura.js`, componé dos requerimientos,
  en `fa1817c` y en el HEAD:
  - **uno sin OCA:** ¿el HTML es igual byte a byte?
  - **uno con OCA:** con `diff`, ¿la única diferencia es la línea de la causal?
- **`core/requerimiento.js`:** `git diff fa1817c..HEAD -- app/js/core/requerimiento.js` tiene
  que estar vacío. La regla nueva va en el generador.
- **La normalización.** Con un script, pasá estos códigos por la función nueva y pegá lo
  que devuelve:
  - `3.3.3   1627  36`
  - `3.3.3\t\t1627\t\t36`
  - `3.3.3-1627-36`
  - `3.3.3.1627.36`
  - `2.9.6-1115.1`
  - `9.9.9-0000.0`
  - `abc`
- **La cita.** `git grep -n "arts. 25 inc. c) y 111" -- app` → ¿en cuántos lugares aparece?
- **El paquete** armado con `--ronda 39` en un temporal: ¿`config/aplicacion.js` dice
  `r39-<HEAD>`?
- **`git diff` de la ronda sobre `server/`:** tiene que estar vacío.

## 5 · Reporte

Va en `auditoria\ciclo-39\AUDITORIA-CICLO-39.md`, con **copia** en
`AppOptimizar\AUDITORIAS\`. Lleva:

- las secciones 1 a 4;
- cuánto tardaste;
- al final, una pregunta para el Jefe, si algo te parece mal pensado.

Cierre: commit `Auditoria ciclo 39`, sin push.
