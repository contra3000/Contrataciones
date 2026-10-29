# ORDEN DE AUDITORÍA — RONDA 42 · Abastecimiento: juntar los requerimientos y el ANEXO I consolidado

SGC · 2026-10-29, junto con `ORDEN-RONDA-42.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. **Sólo mecánico; no manejás el navegador.**

**Antes de leer el resto, tres reglas que en las auditorías 41 y 41b no se cumplieron:**

1. **Cada sección se entrega completa, con el comando y su salida copiada.** Una sección
   vacía, o "se agregará después", es una auditoría sin hacer.
2. **No se modifica ningún archivo del repositorio**, salvo el cambio de un experimento, que
   se restaura en el momento.
   - En la 41b un test se "corrigió en esta copia". **Eso no se hace.** Si un test falla, se
     copia la falla y se informa.
3. **Los archivos se editan con un editor que respete UTF-8.** En la 41b el experimento E1
   reescribió todo `documentos.js` con los acentos rotos.

**Esta auditoría también cubre la 41.** El Jefe aprobó la 41 sin que se corriera su suite
(29/10). El HEAD de la 42 contiene la 41, así que **las tres corridas de esta auditoría son
también las de la 41.**

- **Clon:** `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-42`.
- **Antes de empezar:** `git fetch origin`, `main` = `origin/main` y árbol limpio.
- Copiá el catálogo grande a `datos-prueba\`.
- No borres ni muevas nada fuera de `os.tmpdir()`.
- **La suite tarda unos 29 minutos por corrida.** Contá con unas dos horas y media.

## 1 · Control de entrega

La tabla de commits, del paso 0 al informe, con:

- el asunto;
- si tiene cuerpo;
- **la hora**;
- los archivos.

Después contestá:

- ¿El paso 0 toca sólo `ordenes/` y `PLAN_DESARROLLO.md`?
- ¿Hay dos commits de código, cada uno con su test?
- **¿Entre los dos commits pasó, por lo menos, lo que tarda una suite** (unos 25 minutos)?
  ¿El informe trae una línea de totales por pieza, con su hora?
- ¿El informe describe, uno por uno, los tests viejos que cambiaron?
  (`git diff --stat 1c112e5..HEAD -- tests/`)

## 2 · La suite

- **Tres corridas** de `node tools/suite.js` en el HEAD. De cada una, la línea de totales y la
  ruta del log. **Las tres, completas, antes de escribir el reporte.**
- **Una corrida en el commit de la pieza 1**, en un `git worktree` temporal.
- `node tools/check-compat.js` y `node tools/build-config.js --verificar`.

## 3 · Tres experimentos de remoción, ejecutados

Para cada uno pegá:

1. el `git diff` del cambio, **de pocas líneas**;
2. **la salida del test, con el rojo**;
3. `git checkout -- <archivo>`, y `git status --short` vacío.

| # | Quitar | Tiene que ponerse rojo |
|---|---|---|
| E1 | en `leerRequerimiento`, el rechazo de un avance | el test del avance que no entra |
| E2 | en `core/consolidacion.js`, que la clave lleve la unidad (dejá sólo el código) | el test del 2.3.1-6563.129 en UN y en CAJA |
| E3 | en `renders/anexo-1.js`, que `modelo()` parta de `d.modelo` | el test de "el ANEXO 1 no dice undefined" |

## 4 · Controles contados

- **El consolidado contra el servidor:** con un script de Node, pasá los renglones de
  `tests/fixtures/r42-req-goe.json` y `r42-req-gb7.json`:
  - por `SGC.core.consolidacion.renglones`;
  - y por `renglonesConsolidados` de `server/sco.js` (con un `datosDir` temporal).

  Pegá las dos salidas. **Tienen que ser iguales en código, unidad, cantidad, desglose y
  orden.** La única diferencia permitida es la descripción.
- **El requerimiento del servidor**, con `tests/helpers/aplicacion-montura.js`, en `1c112e5` y
  en el HEAD: pegá los dos SHA-256. Tienen que ser iguales.
- **`git diff 1c112e5..HEAD -- server/ app/index.html`:** vacío.
- **`git diff --stat 1c112e5..HEAD -- app/js/core/`:** sólo `consolidacion.js`, nuevo.
- **El paquete:** `node tools/empaquetar-generador.js --ronda 42 --destino <tmp>`. ¿El
  `VERSION.txt` dice `r42-<HEAD>`? ¿Trae `js/core/consolidacion.js` y
  `js/renders/anexo-1.js`?

## 5 · Reporte

Va en `auditoria\ciclo-42\AUDITORIA-CICLO-42.md`, con **copia** en
`AppOptimizar\AUDITORIAS\`. Lleva:

- las secciones 1 a 4, completas;
- cuánto tardaste;
- al final, una pregunta para el Jefe, si algo te parece mal pensado.

Cierre: commit `Auditoria ciclo 42`, sin push.
