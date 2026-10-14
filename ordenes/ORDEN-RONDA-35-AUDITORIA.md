# ORDEN DE AUDITORÍA — RONDA 35 · Identificación completa, y el PAC bien impreso

SGC · 2026-10-14, junto con `ORDEN-RONDA-35.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. **Sólo mecánico; no manejás el navegador.**

- **Clon:** `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-35`.
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
- ¿El informe lista **todos** los archivos de `tests/` que se tocaron, también los de
  `tests/helpers/`? Comparalo con `git diff --stat 24a2f07..HEAD -- tests/`. Esa diferencia
  incluye la 34: separá lo de esta ronda con `187a184..HEAD`.

## 2 · La suite

- **Tres corridas completas**, con `node --test --test-timeout=120000 "tests/*.test.js"`.
  De cada una: `tests / pass / fail / cancelled / skipped / duration_ms`, y la ruta del log.
  **Si aparece algún rojo en "matriz por servidor"** (ADJUDICACION, AFECTACION o
  GENERACION_ORDEN_COMPRA), copiá la salida entera de ese test: es el ítem 13 de la cola.
- **Los números del informe:** compará cada corrida que declara con su log.
- `node tools/check-compat.js` → 0 violaciones.
- `node tools/build-config.js --verificar` → código 0.

## 3 · Tres experimentos de remoción

| # | Quitar | Tiene que ponerse rojo |
|---|---|---|
| E1 | la marca del generador (que la validación vuelva a mirar sólo si el campo existe) | el test que importa `r33-completo.json` y espera Exportar deshabilitado |
| E2 | que `totalEnLetras` use la moneda (que diga siempre PESOS) | el test del proceso 22 que espera "DÓLARES ESTADOUNIDENSES" |
| E3 | en `itemsDelPac`, la comparación en USD | el test de USD 30.000 contra USD 21.466 que no exporta sin justificación |

## 4 · Controles contados

- **La aplicación con servidor sin cambios.** Con `aplicacion-montura.js`, componé el
  requerimiento de un expediente con dos presupuestos, en `187a184` y en el HEAD. ¿El HTML es
  igual byte a byte? ¿El total en letras dice "PESOS"?
- **`r33-completo.json`** (está en `AppOptimizar\PRUEBAS-JEFE\`), importado con la montura del
  generador: ¿qué dice el motivo de Exportar?
- **Las monedas.** ¿Cuántos procesos de `config/pac.json` dan `USD`? Tienen que ser 3: el 22,
  el 25 y el 34. Con el 4 y con "No autorizado en el PAC", ¿el JSON dice `"moneda": "ARS"`?
- **El paquete** armado con `--ronda 35` en un temporal: ¿`config/aplicacion.js` dice
  `r35-<HEAD>`? ¿`generador.html` ya no tiene `sgc-pac-preventivo-usd`?
- **El lugar de entrega.** Con la montura del generador:
  1. Sin `#sgc-lugar-entrega`, ¿qué dice el motivo de Exportar?
  2. Con "Depósito de Intendencia, Hangar 3", ¿la EETT lo dice y el requerimiento sigue
     diciendo "Lugar: VII Brigada Aérea - Moreno"?
  3. ¿El JSON trae `lugarEntrega`?
- **"Imprimir" con el PAC superado:** proceso 32 y un preventivo de $ 106.000.000 sin
  justificación. ¿`#sgc-generador-impresion` queda vacío? ¿Qué dice el motivo?
- **`git diff` de la ronda sobre `server/`:** tiene que estar vacío.

## 5 · Reporte

Va en `auditoria\ciclo-35\AUDITORIA-CICLO-35.md`, con **copia** en
`AppOptimizar\AUDITORIAS\`. Lleva:

- las secciones 1 a 4;
- cuánto tardaste;
- al final, una pregunta para el Jefe, si algo te parece mal pensado.

Cierre: commit `Auditoria ciclo 35`, sin push.
