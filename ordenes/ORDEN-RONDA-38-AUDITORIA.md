# ORDEN DE AUDITORÍA — RONDA 38 · La justificación al cambiar de proceso, y la modalidad común u OCA

SGC · 2026-10-17, junto con `ORDEN-RONDA-38.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. **Sólo mecánico; no manejás el navegador.**

- **Clon:** `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-38`.
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
- ¿Hay dos commits de código? ¿Cuánto tiempo pasó entre uno y otro?
- **¿El commit de la pieza 1 deja la suite completa en verde?** Corrélo una vez en un
  `git worktree` temporal.
- ¿El informe describe, uno por uno, los tests viejos que cambiaron?
  (`git diff --stat cf5fa0d..HEAD -- tests/`)

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
| E1 | la comparación de `pac.procesoJustificado` con el proceso de ahora | el test que pasa del proceso 4 al 11 y espera el aviso |
| E2 | que la OCA exija la cantidad máxima | el test de OCA sin cantidad máxima que no exporta |
| E3 | que la modalidad sea obligatoria con la marca del generador | el test de "Siguiente" sin modalidad |

## 4 · Controles contados

- **La aplicación con servidor.** Con `aplicacion-montura.js`, componé dos requerimientos,
  en `cf5fa0d` y en el HEAD:
  - **uno sin OCA:** ¿el HTML es igual byte a byte?
  - **uno con OCA:** con `diff`, ¿la única diferencia es la línea de la causal?
- **La cita.** `git grep -n "1023/01\|Art. 111" -- app/js` tiene que dar 0 resultados.
  Pegá la línea nueva de la causal.
- **"Objetivo".** ¿Queda `sgc-objetivo` en el `generador.html` del paquete? ¿El JSON
  exportado sigue trayendo `objetivo: ""`?
- **El JSON de una OCA:** ¿trae `modalidad`, `ocaJustificacion` y, en cada renglón,
  `cantidadMaxima` y `cantidadMinima`?
- **El paquete** armado con `--ronda 38` en un temporal: ¿`config/aplicacion.js` dice
  `r38-<HEAD>`?
- **`git diff` de la ronda sobre `server/`:** tiene que estar vacío.

## 5 · Reporte

Va en `auditoria\ciclo-38\AUDITORIA-CICLO-38.md`, con **copia** en
`AppOptimizar\AUDITORIAS\`. Lleva:

- las secciones 1 a 4;
- cuánto tardaste;
- al final, una pregunta para el Jefe, si algo te parece mal pensado.

Cierre: commit `Auditoria ciclo 38`, sin push.
