# INFORME — RONDA 1

## 1. Qué hice

Creé el esqueleto del proyecto y el núcleo declarativo (H1). Archivos:

- `app/index.html` — stub mínimo, sin lógica; carga `css/main.css` y los tres scripts de `core/`.
- `app/css/main.css` — sólo variables CSS y reset, sin componentes.
- `app/js/core/namespaces.js` — namespace global único `SGC` con sus sub-espacios (IIFE, `'use strict'`, no ensucia `window`).
- `app/js/core/config.js` — **entregable central**: los 18 estados (FSD §4), los 7 roles, el catálogo cerrado de motivos de devolución, `ESTADO_INICIAL` y `ESTADO_FINAL`.
- `app/js/core/utils.js` — sub-espacio `SGC.core.utils` declarado (vacío en esta ronda).
- `tools/check-compat.js` — guardián de compatibilidad y aislamiento (ADR-011, ADR-018), sin dependencias.
- `tests/config.test.js` y `tests/estados.test.js` — invariantes de la máquina de estados con `node --test`.
- `esquemas/datos.ejemplo.json` — expediente de ejemplo coherente (renglones con `{ codigo, cantidad, unidad, aclaracion }`, `catalogoVersion`, `historico` sin snapshots en línea).
- `esquemas/idx.ejemplo.json` — entrada liviana de índice (ADR-005).
- `config/usuarios.ejemplo.json` — padrón de operadores ficticios, correo institucional como clave única (ADR-017).
- `README.md`, `INFORME.md`, directorios vacíos con `.gitkeep` (`adapters/`, `catalogo/`, `views/`, `renders/`, `export/`, `assets/`, `server/`, `datos-prueba/`).
- `.gitignore` — ya existía y cumplía lo pedido (node_modules/, datos-prueba/, app/catalogo/, *.log, Thumbs.db); no lo modifiqué.

## 2. Decisiones que tomé y por qué

- **Los 7 roles** (no disponibles en el repo): los derivé del FSD §3 (Generador, Abastecimiento Gestor/Supervisor, Contrataciones Gestor/Supervisor, Asesoría Jurídica, Contaduría). Sólo el FSD §4 indica el *sector* por estado; la elección de gestor vs. supervisor por estado es una propuesta mía (ej. Autorización → supervisor, Firmas → supervisor).
- **`estadosDevolucion`**: ningún documento define su semántica ni su mapeo. Lo interpreté como "estados a los que este estado puede devolverse" y propuse un modelo de devolución al estado inmediatamente anterior de la cadena (estado 1 y terminal vacíos). A validar.
- **`camposRequeridos` / `entregablesObligatorios`**: el FSD no da el detalle por estado; los dejé vacíos en los 18 (la clave existe en todos) y lo reporto en §4.
- **`SGC.export`**: para no emitir el token `export` contiguo en `app/` (el criterio de aceptación 3 busca `export ` y el guardián lo veta como módulo ES), el sub-espacio se define con notación por corchetes `SGC['export']`. Es el mismo sub-espacio requerido por §2.2.
- **Esquema de `datos.ejemplo.json`**: `InstruccionesCodigo.md` §6.1 no está en el repo; lo reconstruí desde el FSD y los ADR (schemaVersion, id/numero/anio, solicitante, catalogoVersion, renglones con aclaración ≤200 caracteres según enmienda ADR-014, estado, fechaLimite, version, actualizado, historico sin snapshots en línea, auditoria con hash encadenado según ADR-006).
- **Guardián**: para pasar la auto-inspección y evitar falsos positivos, la fuente se procesa con un mini-lexer que distingue comentarios, cadenas y literales regex. Las comprobaciones de JS/CSS/HTML y de módulos corren sobre el código sin cadenas ni comentarios (así un token vetado en un comentario o en un mensaje de error no cuenta); los patrones de `import`/`export` se construyen por concatenación para que el token vetado nunca aparezca contiguo en el propio guardián. La detección de URLs corre con las cadenas conservadas (para capturar referencias externas reales como `fetch('https://...')` o `src="https://..."`), lo que implica que una URL dentro de un string de la app —incluso en un mensaje de error— se marca como violación: es la interpretación de ADR-018 (la app no debe referenciar URLs externas en ningún lugar). El flag `v` se detecta sobre los literales regex extraídos por el lexer.

## 3. Verificación

Salida de `node --test` (desde la raíz):

```
✔ 1. hay exactamente 18 estados (2.8532ms)
✔ 2. ids únicos y numeros 1..18 sin huecos ni repeticiones (1.1393ms)
✔ 3. todo id citado en estadosSiguientes/estadosDevolucion existe en ESTADOS (1.9084ms)
✔ 4. todo rolEjecutor existe en ROLES (3.1053ms)
✔ 5. las fases cubren 1..10 (0.7625ms)
✔ 6. los 18 estados tienen todas las claves obligatorias (0.7249ms)
✔ 7. ESTADO_FINAL es terminal: no tiene estadosSiguientes (1.9632ms)
✔ 10. todo motivo de devolución tiene id único (2.8574ms)
✔ 8. alcanzabilidad: desde ESTADO_INICIAL se llega a ESTADO_FINAL siguiendo estadosSiguientes (27.1219ms)
✔ 9. sin estados huérfanos: todo estado distinto del inicial es citado por al menos otro estado (1.2818ms)
ℹ tests 10
ℹ suites 0
ℹ pass 10
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 587.0881
```

Salida de `node tools/check-compat.js` (desde la raíz):

```
check-compat: OK - 5 archivo(s) inspeccionado(s), 0 violaciones.
```

Además verifiqué: `node tools/check-compat.js tools` (auto-inspección del guardián) → OK, 0 violaciones; y que el guardián detecta violaciones reales (`.toSorted(`, `Object.groupBy`, `import`, `popover`, `fetch('https://...')`, `src="https://..."`, flag `v`) con código de salida 1.

## 4. Contradicciones e información faltante

1. **`InstruccionesCodigo.md` no está en el repositorio.** La orden (§0, lista de precedencia) y la propia bitácora (ADR-001, ADR-014, ADR-017, ADR-018) lo citan como documento conservado, y la orden dice que §10.1 (roles) y §6.1 (esquema) siguen vigentes. **No existe el archivo** en el árbol de trabajo ni en el historial de git (sólo está la auditoría). Esto me obligó a derivar los roles del FSD §3 y a reconstruir el esquema de datos; ambas cosas deben validarse contra el original cuando esté disponible.
2. **Roles a nivel gestor/supervisor por estado**: el FSD §4 da sólo el sector; §10.1 (que los detallaba) no está. Propuse la asignación.
3. **`camposRequeridos` y `entregablesObligatorios`**: ninguna fuente especifica el detalle por estado; quedaron vacíos en los 18.
4. **Semántica y mapeo de `estadosDevolucion`**: no está definido en ningún documento; lo interpreté (ver §2).
5. **`SGC.export` vs. prohibición de `export`**: §2.2 pide el sub-espacio `export`, y el criterio de aceptación 3 pide cero coincidencias de `export `. Se resolvió con notación por corchetes; es una tensión deliberada entre dos requisitos que no conviene dejar pasar.
6. **Orden de precedencia**: la orden gana sobre todo; asumí ADR-001 (la app se sirve por HTTP, no `file://`) como vigente, coherente con el resto de la bitácora.

## 5. Qué NO hice

- **No escribí** el servidor (`server/`), la interfaz, el catálogo, las vistas, los renders ni los entregables: están planificados para rondas siguientes y la orden §1 los prohíbe explícitamente.
- **No redacté `InstruccionesCodigo_v2.md`** (lo pide PLAN H1-2 y la auditoría §3): no forma parte del alcance de esta orden y es un archivo de documentación de sólo lectura.
- **No modifiqué** la documentación existente ni `tools/scraper-catalogo/`.
- **No modifiqué** `.gitignore` (ya cumplía los requisitos).

## 6. Riesgos que veo

- **`estadosDevolucion` y la asignación gestor/supervisor** no están validadas con los operadores; si el circuito real devuelve a fases más atrás o con otros roles, el modelo cambiará en H6/H9.
- **`camposRequeridos` vacíos** significan que la validación de avance no está modelada todavía; el motor de H2 dependerá de que se complete.
- **Reconstrucción del esquema** por ausencia de `InstruccionesCodigo.md`: si el original difiere, habrá que migrar los ejemplos.
- **El guardián** detecta el flag `v` sólo en literales regex (no en `new RegExp(patron, 'v')`, que queda como string); es una cobertura parcial, suficiente para esta ronda pero a ampliar. Además, la decisión de marcar toda URL externa (incluso en mensajes de error) es una interpretación de ADR-018 que conviene confirmar con los operadores en H9.
- **`SGC['export']`** es una convención frágil que hay que mantener consistente en las rondas siguientes.
