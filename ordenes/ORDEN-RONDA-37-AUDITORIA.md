# ORDEN DE AUDITORÍA — RONDA 37 · El lugar de entrega en el requerimiento, y la justificación del PAC que se revisa

SGC · 2026-10-16, junto con `ORDEN-RONDA-37.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. **Sólo mecánico; no manejás el navegador.**

- **Clon:** `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-37`.
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
  (`git diff --stat bf3ba2d..HEAD -- tests/`)

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
| E1 | la fila "Lugar de entrega" del requerimiento | el test que la espera con "Depósito de Intendencia, Hangar 3" |
| E2 | la comparación de `pac.causas` con las causas de ahora | el test que pasa de monto a "No autorizado en el PAC" y espera el aviso |
| E3 | que un archivo sin `pac.causas` pida la revisión | el test que importa `r36-avance-justificado.json` |

## 4 · Controles contados

- **La aplicación con servidor sin cambios.** Con `aplicacion-montura.js`, componé el
  requerimiento de un expediente con dos presupuestos en `bf3ba2d` y en el HEAD. ¿El HTML
  es igual byte a byte?
- **Las claves de las causas.** Con la montura del generador, ¿qué devuelve
  `causasDelPac(...).claves` en cada uno de estos casos?
  - año 2027;
  - trimestre 2 con el proceso 3;
  - proceso 4 con $ 2.000.000;
  - "No autorizado en el PAC";
  - el proceso 1 sin causas.
- **El JSON.** ¿Trae `pac.causas` con las claves que había cuando se escribió o confirmó
  la justificación?
- **El paquete** armado con `--ronda 37` en un temporal: ¿`config/aplicacion.js` dice
  `r37-<HEAD>`? ¿Está `#sgc-pac-justificacion-confirmar`?
- **`git diff` de la ronda sobre `server/`:** tiene que estar vacío.

## 5 · Reporte

Va en `auditoria\ciclo-37\AUDITORIA-CICLO-37.md`, con **copia** en
`AppOptimizar\AUDITORIAS\`. Lleva:

- las secciones 1 a 4;
- cuánto tardaste;
- al final, una pregunta para el Jefe, si algo te parece mal pensado.

Cierre: commit `Auditoria ciclo 37`, sin push.
