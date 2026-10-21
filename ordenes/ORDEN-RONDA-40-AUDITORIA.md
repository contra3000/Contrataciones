# ORDEN DE AUDITORÍA — RONDA 40 · La suite que da siempre lo mismo, y "Buscar ítem" en todo el catálogo

SGC · 2026-10-21, junto con `ORDEN-RONDA-40.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. **Sólo mecánico; no manejás el navegador.**

- **Clon:** `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-40`.
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
- ¿Hay dos commits de código? **¿Cada uno trae su test junto con el código?**
- ¿El informe trae las cinco corridas de la pieza 1, y `git status --short` vacío?

## 2 · La suite

- **Tres corridas con la herramienta nueva:** `node tools/suite.js`. De cada una, la línea
  de totales y la ruta del log.
- **Una corrida con el comando viejo:** `node --test --test-timeout=120000
  "tests/*.test.js"`. Anotá lo que dé, aunque tenga rojos: es la comparación.
- **¿Las dos dan la misma cantidad de `tests`?** Si no, ningún test puede haber quedado
  afuera.
- `node tools/suite.js --listar`: pegá la lista de la serie. **¿Están los seis archivos de
  la tabla de la pieza 1?**
- `node tools/check-compat.js` → 0 violaciones.
- `node tools/build-config.js --verificar` → código 0.

## 3 · Tres experimentos de remoción, ejecutados

**Cada experimento se hace de verdad.** En la auditoría 39b se describieron sin hacerlos, y
así no prueban nada. Para cada uno pegá:

1. el cambio, con `git diff`;
2. **la salida del test corrido, con el rojo**;
3. `git checkout -- <archivo>`, y `git status --short` vacío.

| # | Quitar | Tiene que ponerse rojo |
|---|---|---|
| E1 | en `tools/suite.js`, que un archivo con la montura vaya a la serie | `tests/suite-herramienta.test.js` |
| E2 | que la palabra busque el comienzo de la palabra del ítem (dejala buscar en cualquier parte) | el test de "reparacion matafuegos" sin "POSTRES" |
| E3 | que elegir un ítem cierre la lista | el test del clic de más |

## 4 · Controles contados

- **El índice.** Corré `build-catalogo` dos veces en un temporal:
  - ¿`busqueda.js` sale igual byte a byte? Pegá los dos SHA-256;
  - ¿cuántos ítems trae? Tienen que ser 159.366;
  - ¿cuánto pesa?
  - ¿cambió algún otro archivo del catálogo?
- **Los casos.** Con un script de Node que cargue el módulo nuevo y el índice, pegá los 5
  primeros de cada búsqueda:
  - `mantenimiento recarga matafuego`;
  - `reparacion matafuegos`;
  - `válvula esférica`.
- **La aplicación con servidor.** Con `aplicacion-montura.js`, componé un requerimiento en
  `b277b93` y en el HEAD: ¿el HTML es igual byte a byte?
- **`git diff b277b93..HEAD -- server/ app/js/core/`:** vacío.
- **`git diff b277b93..HEAD -- tests/`:** ¿se tocó algún test que ya existía? Si sí, ¿el
  informe lo describe?
- **El paquete**, armado con `--ronda 40` en un temporal:
  - ¿trae `catalogo/busqueda.js`?
  - ¿`config/aplicacion.js` dice `r40-<HEAD>`?

## 5 · Reporte

Va en `auditoria\ciclo-40\AUDITORIA-CICLO-40.md`, con **copia** en
`AppOptimizar\AUDITORIAS\`. Lleva:

- las secciones 1 a 4;
- cuánto tardaste;
- al final, una pregunta para el Jefe, si algo te parece mal pensado.

Cierre: commit `Auditoria ciclo 40`, sin push.
