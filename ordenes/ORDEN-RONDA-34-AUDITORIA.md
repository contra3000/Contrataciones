# ORDEN DE AUDITORÍA — RONDA 34 · Los campos de los documentos, y el PAC

SGC · 2026-10-13, junto con `ORDEN-RONDA-34.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. **Sólo mecánico; no manejás el navegador.**

- **Clon:** `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-34`.
- **Antes de empezar:** `git fetch origin`, `main` = `origin/main` y árbol limpio.
- Copiá el catálogo grande a `datos-prueba\`.
- No borres ni muevas nada fuera de `os.tmpdir()`.

**Las secciones 1 a 5 van todas.** Cada afirmación lleva su evidencia: el comando y la
salida, o archivo y línea.

## 1 · Control de entrega

La tabla de commits, del paso 0 al informe, con:

- el asunto;
- si tiene cuerpo;
- **la hora**;
- los archivos.

Después contestá:

- ¿El paso 0 toca sólo `ordenes/` y `PLAN_DESARROLLO.md`?
- ¿Hay dos commits de código? **¿Cuánto tiempo pasó entre uno y otro?**
- ¿Hay alguna corrección del informe **antes** del clon, declarada?

## 2 · La suite

- **Tres corridas completas**, con `node --test --test-timeout=120000 "tests/*.test.js"`.
  De cada una: `tests / pass / fail / cancelled / skipped / duration_ms`, y la ruta del log.
- **Los números del informe:** compará cada corrida que declara con su log.
- `node tools/check-compat.js` → 0 violaciones.
- `node tools/build-config.js --verificar` → sale con código 0.
- **Los tests viejos que la ronda tocó:** `git diff --stat 24a2f07..HEAD -- tests/`, sin
  contar los archivos nuevos. Para cada uno, decí:
  - si es de la aplicación con servidor (no tendría que estar);
  - o del generador. Sólo puede haber cambiado para elegir el trimestre y el proceso del
    PAC, y el informe lo tiene que declarar.

## 3 · Tres experimentos de remoción

| # | Quitar | Tiene que ponerse rojo |
|---|---|---|
| E1 | que el trimestre sea obligatorio para pasar de Identificación | el test de "Siguiente" sin trimestre |
| E2 | la comparación del preventivo contra el monto del proceso del PAC (en ARS) | el test del proceso 4 con preventivo de $ 2.100.000 que no exporta sin justificación |
| E3 | en `expedienteLocal()`, el `lugar` | el test que cuenta "VII Brigada Aérea - Moreno" en la impresión |

## 4 · Controles contados

- **`config/pac.json` contra el CSV** de
  `AppOptimizar\ACTUALIZACION-SEMESTRAL\PAC\pac-2026.csv`, con tu script:
  - ¿39 procesos, con número, nombre, procedimiento, trimestre, monto y moneda iguales
    fila por fila?
  - ¿Los ARS suman $ 983.457.253,26 y los USD (22, 25 y 34) suman USD 121.050,00?
- **La aplicación con servidor sin cambios.** Con `aplicacion-montura.js`, componé el
  requerimiento de un expediente con dos presupuestos, una vez en `24a2f07` y otra en el
  HEAD. ¿El HTML es igual byte a byte? **Decí qué montura usaste.**
- **La vigencia.** Con la montura del generador, ¿qué dice la Vigencia en cada trimestre
  de 2026? Tiene que dar 31/03, 30/06, 30/09 y 31/12.
- **El paquete** armado con `--ronda 34` en un temporal:
  1. ¿Trae `config/pac.js`?
  2. ¿`config/aplicacion.js` dice `r34-<HEAD>` y trae `lugarEntrega`?
- **Un JSON de la ronda 33** (sin `trimestre` ni `pac`): ¿se importa sin errores?
- **`git diff` de la ronda sobre `server/`:** tiene que estar vacío.

## 5 · Reporte

Va en `auditoria\ciclo-34\AUDITORIA-CICLO-34.md`, con **copia** en
`AppOptimizar\AUDITORIAS\`. Lleva:

- las secciones 1 a 4;
- cuánto tardaste;
- al final, una pregunta para el Jefe, si algo te parece mal pensado.

Cierre: commit `Auditoria ciclo 34`, sin push.
