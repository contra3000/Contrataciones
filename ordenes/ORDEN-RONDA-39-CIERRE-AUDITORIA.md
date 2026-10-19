# ORDEN DE AUDITORÍA — CIERRE DE LA RONDA 39

SGC · 2026-10-19, junto con `ORDEN-RONDA-39-CIERRE.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. **Sólo mecánico; no manejás el navegador.**

- **Clon:** `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-39b`. La
  carpeta `ciclo-39` es tu primera auditoría: no se toca.
- **Antes de empezar:** `git fetch origin`, `main` = `origin/main` y árbol limpio.
- Copiá el catálogo grande a `datos-prueba\`.
- No borres ni muevas nada fuera de `os.tmpdir()`.

## 1 · Control de entrega

- La tabla de commits **desde `d7863a6`**, con el asunto, si tiene cuerpo, la hora y los
  archivos.
- ¿El commit de cierre toca sólo:
  - `fasttrack.js`, `intercambio.js` y `documentos.js`;
  - `tests/ronda-39-p1.test.js`;
  - lo que el informe declare?
- ¿El mensaje final del desarrollador trae `git status --short` vacío?

## 2 · La suite

- **Tres corridas completas** (`tests / pass / fail / cancelled / skipped / duration_ms` y
  la ruta del log). **Tienen que dar 0 fallas.** Si aparece un rojo en "matriz por
  servidor", copialo entero (ítem 13).
- ¿Los números coinciden con el informe?
- `node tools/check-compat.js` → 0. `node tools/build-config.js --verificar` → 0.

## 3 · Tres experimentos de remoción (repetidos, ahora válidos)

| # | Quitar | Tiene que ponerse rojo |
|---|---|---|
| E1 | que "Sigue valiendo" oculte `#sgc-error-pac-justificacion` | el test de la corrección que aprieta "Siguiente" antes. **Si no hay test, decilo**: es un faltante |
| E2 | la regla "máxima por Solicitud de Provisión ≤ cantidad del renglón" | el test de cantidad 10 con máxima 12 |
| E3 | la normalización del código en el importador | el test que pega `3.3.3   1627  36` |

## 4 · Controles contados

- **La normalización.** Pasá por la función estos siete códigos y pegá lo que devuelve.
  Los cuatro primeros tienen que dar `3.3.3-1627.36`:
  - `3.3.3   1627  36`
  - `3.3.3\t\t1627\t\t36`
  - `3.3.3-1627-36`
  - `3.3.3.1627.36`
  - `2.9.6-1115.1`
  - `9.9.9-0000.0`
  - `abc`
- **El servidor:** el requerimiento sin OCA, igual byte a byte que en `fa1817c`; con OCA,
  sólo cambia la línea de la causal.
- **`git diff fa1817c..HEAD -- app/js/core/ server/`:** vacío.
- **El paquete** con `--ronda 39` en un temporal: ¿`config/aplicacion.js` dice
  `r39-<HEAD>`?

## 5 · Reporte

Va en `auditoria\ciclo-39b\AUDITORIA-CICLO-39b.md`, con **copia** en
`AppOptimizar\AUDITORIAS\`. Lleva las secciones 1 a 4, cuánto tardaste y, si querés, una
pregunta para el Jefe.

Cierre: commit `Auditoria cierre ciclo 39`, sin push.
