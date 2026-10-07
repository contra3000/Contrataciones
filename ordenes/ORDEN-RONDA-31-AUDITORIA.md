# ORDEN DE AUDITORÍA — RONDA 31 · Los documentos de referencia, y lo que traba o no se ve

SGC · 2026-10-07, junto con `ORDEN-RONDA-31.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. **Sólo mecánico; no manejás el navegador.**

- **Clon:** `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-31`.
- **Antes de empezar:** `git fetch origin`, `main` = `origin/main` y árbol limpio.
- Copiá el catálogo grande a `datos-prueba\`.
- No borres ni muevas nada fuera de `os.tmpdir()`.

**Las secciones 1 a 5 van todas.** Una sección que falta es una auditoría incompleta. Cada
afirmación lleva su evidencia: el comando y la salida, o archivo y línea.

## 1 · Control de entrega

| Commit | Asunto | ¿Tiene cuerpo? | Archivos |
|---|---|---|---|

Llená la tabla, del paso 0 al informe, y después contestá:

- **El paso 0 sólo toca `ordenes/` y `PLAN_DESARROLLO.md`.** ¿Sí o no?
- **Hay dos commits de código, sin ninguno `tmp:`**, y ninguno después del informe. ¿Sí o
  no?

## 2 · La suite

- **La suite completa, tres veces:** `node --test --test-timeout=120000 "tests/*.test.js"`.
  De cada corrida, `tests / pass / fail / cancelled / skipped / duration_ms`. Guardá los tres
  logs y dejá su ruta en el reporte.
- **Contra el informe:** ¿coinciden los números de cada corrida que declara? Si el informe
  o algún cuerpo de commit menciona corridas con fallas, decilo.
- `node tools/check-compat.js` → 0 violaciones.

## 3 · Tres experimentos de remoción

| # | Quitar | Tiene que ponerse rojo |
|---|---|---|
| E1 | en `generador/documentos.js`, el registro del entregable `anexo-eett` | el test de la aclaración de 300 caracteres que exporta |
| E2 | en `views/expediente.js`, la comparación del contador de pedidos | el test de la recarga vieja |
| E3 | en `core/validacion.js`, la rama "1 valor + justificación" (que sólo valgan dos valores) | el test del renglón con presupuesto + justificación que exporta |

## 4 · Controles contados

- **La huella del PDF.** Elegí un PDF cualquiera por la montura del generador y exportá.
  Calculá aparte su SHA-256 con `Get-FileHash` y su tamaño con `(Get-Item).Length`. Los dos
  tienen que ser **iguales** a los del JSON.
- **Un JSON del ciclo 30, sin `tipo` ni `sha256` y con fecha `"12/02/2026"`**, se importa: los
  documentos quedan como `presupuesto` y la lista dice "sin huella".
- **El preventivo con justificación:** un renglón de cantidad 10 con un valor unitario de 100 más una
  justificación da preventivo 1000. Decí con qué script lo mediste.
- **La leyenda, con la montura de la aplicación con servidor** (`aplicacion-montura.js`),
  no la del generador: componé el requerimiento de un expediente con dos presupuestos
  subidos y contá cuántas veces aparece *"Se acompañan como adjuntos"*. Tiene que dar 1.
  **Decí qué montura usaste.**
- **`git diff` de la ronda sobre `server/`:** vacío.

## 5 · Reporte

Va en `auditoria\ciclo-31\AUDITORIA-CICLO-31.md`, con **copia** en `AppOptimizar\AUDITORIAS\`.
Lleva:

- las secciones 1 a 4, completas;
- cuánto tardaste;
- al final, una línea con una pregunta para el Jefe, si algo te parece mal pensado.

Cierre: commit `Auditoria ciclo 31`, sin push.
