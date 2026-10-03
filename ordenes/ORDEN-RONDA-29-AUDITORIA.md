# ORDEN DE AUDITORÍA — RONDA 29 · El Usuario como lo pidió el Jefe

SGC · 2026-10-03, junto con `ORDEN-RONDA-29.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. **Sólo mecánico; no manejás el navegador.**

**Clon:** `C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-29`.
Antes de empezar:

- `git fetch origin`, y `main` tiene que ser igual a `origin/main`;
- el árbol tiene que estar limpio.

Si no coincide, **no auditás** y lo decís. Copiá el catálogo grande a `datos-prueba\`,
como en el ciclo 28.

**No borres ni muevas nada fuera de `os.tmpdir()`.** Tus experimentos se restauran con
`git checkout --`.

---

## 1 · Control de entrega

- El paso 0 primero, un commit por pieza y el del informe. ¿Cuántas de las cuatro
  piezas llegaron?
- **Ningún commit posterior al informe.**
- **`AppOptimizar\auditoria\` tiene `ciclo-04` a `ciclo-29`.** Contá las carpetas y
  decí si alguna de las anteriores cambió de fecha durante la ronda.

## 2 · La suite y los finales de línea

- **`git ls-files --eol` en tu clon recién hecho:** todos los archivos de texto tienen
  que estar en `w/lf`. Contá los que no.
- **La suite completa, con el comando que dejó el informe:** 0 fallas, 0 salteados y
  0 cancelados, y **que termine sola**. Correla **dos veces**.
- **`node tools/check-compat.js`:** 0 violaciones.

## 3 · Tres experimentos de remoción

| # | Quitar | Tiene que ponerse rojo |
|---|---|---|
| E1 | en `tests/helpers/aplicacion-montura.js`, volver a tomar `previoHito` **después** del clic en `guardarRequerimiento` | `tests/ronda-20.test.js` |
| E2 | en `core/validacion.js`, volver a contar valores en vez de presupuestos distintos | el test de "dos valores del mismo presupuesto" |
| E3 | en `tests/helpers/dom-stub.js`, que `set textContent` vuelva a no vaciar los hijos | el test que afirma tres códigos distintos |

## 4 · Controles contados

- **Los documentos sin firma.** Componé el requerimiento, la EETT y el anexo de EETT
  **con la montura del generador y con la del servidor**. Contá las apariciones de
  "Operador solicitante" y "Firma y aclaración": **0 en los tres**. El ANEXO I las
  conserva.
- **El sello.** Exportá con tu script y decí si están `grado`, `nombre`, `apellido` y
  `numeroControl` (entero). Un JSON del ciclo 28, con sólo `nombre`, ¿se importa?
- **El avance, con tu script:**
  1. un renglón sin valores, guardado en el paso 2, se reimporta en el paso 2;
  2. cambiá `estado` a `para-abastecimiento` y reimportá: tiene que dar error de huella;
  3. cambiá la descripción de un ítem en el catálogo de la montura: lo que se importa
     es la descripción del archivo, y sale el aviso.
- **La huella del PDF.** Tomá un PDF cualquiera, calculá su SHA-256 con
  `Get-FileHash`, cargalo por la montura y compará con la huella del JSON: **tienen que
  ser iguales**. Compará también el tamaño en bytes.
- **La aplicación con servidor:** `git diff` de la ronda sobre `server/`. Lo que cambió
  en `app/js/core/` y en `app/js/renders/`, una línea por archivo con el porqué.
- **El paquete:** `AppOptimizar\SGC-Generador` tiene el mismo contenido que uno armado
  desde HEAD, sin contar los finales de línea. Ahora tendrían que coincidir **byte a
  byte**: decí cuántos no.

## 5 · Reporte

Va en `auditoria\ciclo-29\AUDITORIA-CICLO-29.md`, y con **una copia** en
`AppOptimizar\AUDITORIAS\AUDITORIA-CICLO-29.md`. Lleva:

- las piezas;
- la suite, las dos corridas;
- los experimentos;
- los controles de §4, con archivo y línea;
- cuánto tardaste;
- si algo te parece mal pensado, una línea al final, como pregunta para el Jefe.

Cierre: commit `Auditoria ciclo 29`, sin push.
