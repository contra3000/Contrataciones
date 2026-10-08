# ORDEN DE AUDITORÍA — RONDA 32 · Lo que pide la prueba piloto

SGC · 2026-10-08, junto con `ORDEN-RONDA-32.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. **Sólo mecánico; no manejás el navegador.**

- **Clon:** `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-32`.
- **Antes de empezar:** `git fetch origin`, `main` = `origin/main` y árbol limpio.
- Copiá el catálogo grande a `datos-prueba\`.
- No borres ni muevas nada fuera de `os.tmpdir()`.

**Las secciones 1 a 5 van todas.** Cada afirmación lleva su evidencia: el comando y la
salida, o archivo y línea.

## 1 · Control de entrega

La tabla de commits, del paso 0 al informe, con asunto, si tiene cuerpo y los archivos.
Después contestá:

- ¿El paso 0 toca sólo `ordenes/` y `PLAN_DESARROLLO.md`?
- ¿Hay dos commits de código?
- ¿Hay alguna corrección del informe **antes** del clon, declarada?

## 2 · La suite

- **Tres corridas completas**, con `node --test --test-timeout=120000 "tests/*.test.js"`.
  De cada una: `tests / pass / fail / cancelled / skipped / duration_ms`, y la ruta del log.
- **Los números del informe:** compará cada corrida que declara con el log que dejó.
- `node tools/check-compat.js` → 0 violaciones.

## 3 · Tres experimentos de remoción

| # | Quitar | Tiene que ponerse rojo |
|---|---|---|
| E1 | en `generador/intercambio.js`, volver a `item: r.item` en la plantilla | el test de la plantilla importada sin tocar: queda el código en vez de la descripción |
| E2 | en `css/tokens.css`, volver `--color-error` a `var(--ink-900)` | el test del borde del campo con error |
| E3 | en `views/fasttrack.js`, que `importar()` lea `instrucciones` como un campo más | el test que dice que `instrucciones` se ignora. Si la remoción no cambia nada, decilo |

## 4 · Controles contados

- **El paquete:** armalo con `--ronda 32` en un temporal y contestá:
  1. ¿`config/aplicacion.js` dice `r32-<commit>` y ese commit es HEAD?
  2. ¿`VERSION.txt` existe?
  3. ¿El `LEEME.txt` dice "Guardar avance" y no dice "Escribí tu nombre"?
- **La plantilla:**
  1. Bajala con tu script por la montura: ¿trae `instrucciones` y el código del primer
     renglón existe en `catalogo_incisos.json`?
  2. Importala sin tocar: ¿la descripción del renglón 1 es la del catálogo?
- **`git diff` de la ronda sobre `server/`:** tiene que estar vacío.

## 5 · Reporte

Va en `auditoria\ciclo-32\AUDITORIA-CICLO-32.md`, con **copia** en
`AppOptimizar\AUDITORIAS\`. Lleva:

- las secciones 1 a 4;
- cuánto tardaste;
- al final, una pregunta para el Jefe, si algo te parece mal pensado.

Cierre: commit `Auditoria ciclo 32`, sin push.
