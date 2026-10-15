# ORDEN DE AUDITORÍA — RONDA 36 · La justificación del PAC en Fundamentación, y el requerimiento sin "Lugar"

SGC · 2026-10-15, junto con `ORDEN-RONDA-36.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. **Sólo mecánico; no manejás el navegador.**

- **Clon:** `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-36`.
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
- **¿Cada commit de pieza deja la suite completa en verde?** Hacé checkout del commit de
  la pieza 1 en un `git worktree` temporal y corré la suite entera **una vez**. Si da rojo,
  es un incumplimiento de la orden, aunque después se arregle.
- ¿El informe describe, uno por uno, los tests viejos que cambiaron? Compará con
  `git diff --stat 135e59a..HEAD -- tests/`.

## 2 · La suite

- **Tres corridas completas**, con `node --test --test-timeout=120000 "tests/*.test.js"`.
  De cada una: `tests / pass / fail / cancelled / skipped / duration_ms`, y la ruta del log.
  **Si aparece algún rojo en "matriz por servidor"**, copiá la salida entera de ese test: es
  el ítem 13 de la cola.
- **Los números del informe:** compará cada corrida que declara con su log.
- `node tools/check-compat.js` → 0 violaciones.
- `node tools/build-config.js --verificar` → código 0.

## 3 · Tres experimentos de remoción

| # | Quitar | Tiene que ponerse rojo |
|---|---|---|
| E1 | la causa "año distinto del PAC" | el test del año 2027 con el proceso 1 |
| E2 | la causa "trimestre distinto del proceso" | el test del proceso 3 con el 2° trimestre |
| E3 | que el faltante del PAC marque "3 · Fundamentación" (que vuelva a marcar sólo "4 · Revisión") | el test que espera "3 · Fundamentación · falta" |

## 4 · Controles contados

- **La aplicación con servidor sin cambios.** Con `aplicacion-montura.js`, componé el
  requerimiento de un expediente con dos presupuestos en `135e59a` y en el HEAD. ¿El HTML
  es igual byte a byte? ¿Sigue teniendo la fila "Lugar"?
- **El generador:** con la montura del generador y el lugar de entrega "Depósito de
  Intendencia, Hangar 3", contá cuántas veces aparece "VII Brigada Aérea - Moreno" en la
  impresión. Tiene que dar 0.
- **`config/aplicacion.json`** ya no tiene `lugarEntrega`. Buscá con
  `git grep -n lugarEntrega -- app/js config` y explicá cada aparición que quede.
- **Las cuatro causas.** Con la montura del generador, ¿qué texto aparece arriba del campo
  en cada una?
  - año 2027;
  - trimestre 2 con el proceso 3;
  - proceso 4 con $ 2.000.000;
  - "No autorizado en el PAC".
- **El paquete** armado con `--ronda 36` en un temporal: ¿`config/aplicacion.js` dice
  `r36-<HEAD>`? ¿`#sgc-pac-justificacion` está dentro de `#sgc-paso-fundamentacion` en el
  `generador.html` del paquete?
- **`git diff` de la ronda sobre `server/`:** tiene que estar vacío.

## 5 · Reporte

Va en `auditoria\ciclo-36\AUDITORIA-CICLO-36.md`, con **copia** en
`AppOptimizar\AUDITORIAS\`. Lleva:

- las secciones 1 a 4;
- cuánto tardaste;
- al final, una pregunta para el Jefe, si algo te parece mal pensado.

Cierre: commit `Auditoria ciclo 36`, sin push.
