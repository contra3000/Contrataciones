# ORDEN DE AUDITORÍA — RONDA 28 · Generador G1

SGC · 2026-10-02, junto con `ORDEN-RONDA-28.md`
Reglas: `CICLO_DE_TRABAJO.md`, paso 4. **Sólo mecánico; no manejás el navegador.**

Clon del desarrollador en `auditoria\ciclo-28\`. Antes de empezar:

- `git fetch origin` y `main` = `origin/main`;
- `git status` limpio;
- el commit coincide con el del informe.

Copiá el catálogo grande a `datos-prueba\`, como en el ciclo 27. **La suite, con
`--test-timeout=120000`.**

---

## 1 · Control de entrega

- Paso 0 primero, un commit por pieza y el del informe. ¿Cuántas de las cinco llegaron?
- **`AppOptimizar\SGC-Generador\` existe.** Listá sus carpetas de primer nivel.

## 2 · La suite

- Completa → **0 fallas, 0 salteados, 0 cancelados**.
- `node tools/check-compat.js` → 0 violaciones. **También sobre `generador.html` y lo
  que carga**: decí si `check-compat` lo inspecciona.

## 3 · Tres experimentos de remoción

| # | Quitar | Tiene que ponerse rojo |
|---|---|---|
| E1 | en `carga.js`, la rama de `<script>` para `file:` (que use siempre `fetch`) | el test del cargador con `file:` |
| E2 | la validación al importar (que cargue cualquier JSON) | el test del JSON con un renglón de un solo valor |
| E3 | en `empaquetar-generador.js`, la exclusión de `server/` | el test del contenido del paquete |

## 4 · Controles contados

- **Ni una llamada de red en el generador:** listá, con la búsqueda entera, cada
  `fetch(`, `XMLHttpRequest` y `/api/` que pueda alcanzarse desde `generador.html`, y
  decí por qué ninguno se ejecuta.
- **El paquete:**
  - no hay ningún archivo de `server/`, `tests/` ni `datos/`;
  - la cantidad de `.js` del catálogo es igual a la de `.json` del catálogo del repo;
  - el tamaño total.
- **La aplicación con servidor sigue igual:** `git diff` de la ronda sobre `server/` y
  sobre `app/index.html`. Lo que cambió, una línea por archivo con el porqué.
- **Ida y vuelta:** con un script tuyo, exportá un requerimiento de 3 renglones por la
  montura del generador, importalo y compará. Igual, sin contar el sello. Alterá un
  byte y reimportá: tiene que dar el error de huella.
- **El formulario sigue siendo el camino principal:** decí qué test carga un
  requerimiento **sólo por el formulario**, sin importar nada, y lo exporta; y cuál
  importa, corrige en el formulario y reexporta. Archivo y línea.
- **El ADR-044** está en la bitácora.

## 5 · Reporte — `auditoria\ciclo-28\AUDITORIA-CICLO-28.md`

- Las piezas.
- La suite.
- Los experimentos.
- Los controles de §4, con archivo y línea.
- Cuánto tardaste.
- Si algo te parece mal pensado: una línea al final, como pregunta para el Jefe.

Cierre: commit `Auditoria ciclo 28`, sin push.
