# ORDEN DE AUDITORÍA — RONDA 33 · La plantilla para llenar con un asistente de IA

SGC · 2026-10-09, junto con `ORDEN-RONDA-33.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. **Sólo mecánico; no manejás el navegador.**

- **Clon:** `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-33`.
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
- **Los números del informe:** compará cada corrida que declara con su log.
- `node tools/check-compat.js` → 0 violaciones.

## 3 · Tres experimentos de remoción

| # | Quitar | Tiene que ponerse rojo |
|---|---|---|
| E1 | en el importador, que un renglón sin código vuelva a rechazar el archivo | el test del pegado con un renglón "por buscar" |
| E2 | en `catalogo/renglones.js`, que el ítem elegido después de "Buscar" se **agregue** en vez de reemplazar | el test de "Buscar" que espera dos renglones |
| E3 | que "Siguiente" deje pasar con renglones por buscar | el test de "Siguiente" con un renglón por buscar |

## 4 · Controles contados

- **Las instrucciones.** Bajá la plantilla con tu script por la montura y compará con `diff`
  el campo `instrucciones` contra el texto de la orden: tienen que ser **iguales**. ¿El
  código del primer renglón existe en `catalogo_incisos.json`?
- **El pegado.** Usá un texto con ```` ```json ```` alrededor y dos renglones, uno de ellos
  con `"codigo": ""`: ¿entra, y el segundo queda "por buscar" con su `buscar`?
- **El avance.** Exportá como avance un requerimiento con un renglón "por buscar" y
  reimportalo: ¿sigue por buscar? ¿"Exportar para Abastecimiento" queda deshabilitado?
- **El `LEEME.txt` del paquete** armado con `--ronda 33`: ¿tiene la sección "Llenar con un
  asistente de IA"? ¿`config/aplicacion.js` dice `r33-<HEAD>`?
- **`git diff` de la ronda sobre `server/`:** tiene que estar vacío.

## 5 · Reporte

Va en `auditoria\ciclo-33\AUDITORIA-CICLO-33.md`, con **copia** en
`AppOptimizar\AUDITORIAS\`. Lleva:

- las secciones 1 a 4;
- cuánto tardaste;
- al final, una pregunta para el Jefe, si algo te parece mal pensado.

Cierre: commit `Auditoria ciclo 33`, sin push.
