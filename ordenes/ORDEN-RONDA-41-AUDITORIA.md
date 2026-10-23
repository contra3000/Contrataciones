# ORDEN DE AUDITORÍA — RONDA 41 · Los presupuestos en la plantilla, y los pasos que se clickean

SGC · 2026-10-23, junto con `ORDEN-RONDA-41.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. **Sólo mecánico; no manejás el navegador.**

- **Clon:** `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-41`.
- **Antes de empezar:** `git fetch origin`, `main` = `origin/main` y árbol limpio.
- Copiá el catálogo grande a `datos-prueba\`.
- No borres ni muevas nada fuera de `os.tmpdir()`.

**Las secciones 1 a 5 van todas.** Cada afirmación lleva su evidencia: el comando y la
salida, o archivo y línea. **Describir lo que pasaría no vale como evidencia.**

## 1 · Control de entrega

La tabla de commits, del paso 0 al informe, con:

- el asunto;
- si tiene cuerpo;
- la hora;
- los archivos.

Después contestá:

- ¿El paso 0 toca sólo `ordenes/` y `PLAN_DESARROLLO.md`?
- ¿Hay dos commits de código, cada uno con su test adentro?
- ¿El informe describe, uno por uno, los tests viejos que cambiaron?
  (`git diff --stat 1ebf5ef..HEAD -- tests/`)
- ¿`git status --short` está vacío en el mensaje final?

## 2 · La suite

- **Tres corridas** con `node tools/suite.js`. De cada una, la línea de totales y la ruta del
  log.
- `node tools/check-compat.js` → 0 violaciones.
- `node tools/build-config.js --verificar` → código 0.

## 3 · Tres experimentos de remoción, ejecutados

Para cada uno pegá:

1. el `git diff` del cambio;
2. **la salida del test, con el rojo**;
3. `git checkout -- <archivo>`, y `git status --short` vacío.

| # | Quitar | Tiene que ponerse rojo |
|---|---|---|
| E1 | que un documento `sinPdf` frene la exportación | el test de "sin los PDF no exporta" |
| E2 | que la plantilla no pase por `revisarValores` | el test del renglón cotizado una sola vez |
| E3 | el `irA` del clic en `#sgc-pasos` | el test de "4 · Revisión" desde Identificación |

## 4 · Controles contados

- **La aplicación con servidor:**
  - el requerimiento, compuesto con `aplicacion-montura.js` en `1ebf5ef` y en el HEAD: ¿igual
    byte a byte?
  - **la plantilla** (`fasttrack.modelo()` sin la marca del generador), en `1ebf5ef` y en el
    HEAD: ¿igual byte a byte? Pegá los dos SHA-256.
- **`git diff 1ebf5ef..HEAD -- server/ app/js/core/ app/index.html`:** vacío.
- **Una plantilla con presupuestos**, importada con un script de Node por
  `generadorIntercambio.importar`. Pegá lo que devuelve en `presupuestos` y en los
  `valoresReferencia` del renglón 1.
- **El paquete**, armado con `--ronda 41` en un temporal: ¿`config/aplicacion.js` dice
  `r41-<HEAD>`?

## 5 · Reporte

Va en `auditoria\ciclo-41\AUDITORIA-CICLO-41.md`, con **copia** en
`AppOptimizar\AUDITORIAS\`. Lleva:

- las secciones 1 a 4;
- cuánto tardaste;
- al final, una pregunta para el Jefe, si algo te parece mal pensado.

Cierre: commit `Auditoria ciclo 41`, sin push.
