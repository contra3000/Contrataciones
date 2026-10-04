# ORDEN DE AUDITORÍA — RONDA 30 · Terminar lo que la 29 dejó a medias

SGC · 2026-10-04, junto con `ORDEN-RONDA-30.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. **Sólo mecánico; no manejás el navegador.**

**Clon:** `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-30`.

- Antes de empezar: `git fetch origin`, `main` = `origin/main` y árbol limpio.
- Copiá el catálogo grande a `datos-prueba\`.
- No borres ni muevas nada fuera de `os.tmpdir()`.

## 1 · Control de entrega

- El paso 0, **dos commits de código** y el del informe.
- **Cada commit con cuerpo** (qué cambió y qué test lo prueba). Contá los que no lo
  tienen.
- Ningún commit `tmp:`.
- Ningún commit posterior al informe.

## 2 · La suite

- **La suite completa, dos veces:** `node --test --test-timeout=120000 "tests/*.test.js"`.
  Tiene que dar 0 fallas, 0 salteados y 0 cancelados.
- **Los números del informe:** compará tests, pass y fail con los que pegó el informe. Si
  no coinciden, decilo en la primera línea de tu reporte.
- `node tools/check-compat.js` → 0 violaciones.

## 3 · Tres experimentos de remoción

| # | Quitar | Tiene que ponerse rojo |
|---|---|---|
| E1 | en `core/validacion.js`, volver a contar valores en vez de presupuestos distintos | el test nuevo de "mismo presupuesto" |
| E2 | en `wizard-formulario.js`, el `scrollIntoView` del mensaje del paso | el test de "Siguiente" con un renglón sin unidad |
| E3 | en `generador.js`, el manejador de `#sgc-guardar-avance` | el test que aprieta "Guardar avance" y espera la descarga |

## 4 · Controles contados

- **Ya no hay avance en el navegador.** Buscá en todo `app/` estas tres cosas: `localStorage`
  con `avance`, `sgc-btn-importar-avance` y `sgc-generador-avance`. Contá cuántas
  aparecen: tienen que ser **0**.
- **El archivo de avance, con tu script.** Apretá el botón por la montura:
  1. tiene `sello.estado === "avance"`, `sello.paso` y la huella;
  2. importado, abre en ese paso;
  3. cambiá `estado` a mano: error de huella.
- **El aviso de presupuesto repetido** aparece **en la vista de valores de la aplicación
  con servidor** también, porque es la misma vista. Probalo con la montura de la
  aplicación.
- **La aplicación con servidor:** `git diff` de la ronda sobre `server/`. Tiene que estar
  vacío.

## 5 · Reporte

Va en `auditoria\ciclo-30\AUDITORIA-CICLO-30.md`, con una **copia** en
`AppOptimizar\AUDITORIAS\`. Lleva:

- las piezas;
- la suite;
- los experimentos;
- los controles, con archivo y línea;
- cuánto tardaste;
- al final, una línea con una pregunta para el Jefe, si algo te parece mal pensado.

Cierre: commit `Auditoria ciclo 30`, sin push.
