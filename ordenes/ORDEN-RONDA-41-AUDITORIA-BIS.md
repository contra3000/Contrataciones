# ORDEN DE AUDITORÍA — RONDA 41 · BIS

SGC · 2026-10-28 · Reglas: `CICLO_DE_TRABAJO.md`, paso 4. **Sólo mecánico; no manejás el
navegador.**

**Por qué hay un bis.** `AUDITORIA-CICLO-41.md` no cumplió la orden de auditoría 41:

- **no corrió la suite**. Faltan las tres corridas de `node tools/suite.js`;
- **no hizo los tres experimentos de remoción**: no está la sección;
- comparó el archivo `fasttrack.js` entero, y la orden pedía **la plantilla que baja el
  servidor**: lo que devuelve `fasttrack.modelo()` sin la marca del generador. El archivo
  tiene que cambiar; esa plantilla, no;
- dice que no encontró el empaquetador, y está en `tools/empaquetar-generador.js`;
- faltan el requerimiento del servidor byte a byte y la importación de una plantilla con
  presupuestos.

**Esta auditoría reemplaza a la 41 entera.**

- **Clon nuevo:** `git clone https://github.com/contra3000/Contrataciones.git
  C:\Proyectos\DContrataciones\Automatizar\AppOptimizar\auditoria\ciclo-41b`. La carpeta
  `ciclo-41` no se toca.
- **Antes de empezar:** `git fetch origin`, `main` = `origin/main` = `1c112e5`, y árbol
  limpio.
- Copiá el catálogo grande a `datos-prueba\`.
- No borres ni muevas nada fuera de `os.tmpdir()`.
- **Cada afirmación lleva el comando y su salida copiada.** Describir lo que pasaría no vale.
- **La suite tarda unos 29 minutos por corrida.** Contá con unas dos horas y media en total.

## 1 · La suite

- **Tres corridas** de `node tools/suite.js` en el HEAD. De cada una, la línea de totales
  (`tests / pass / fail / cancelled / skipped / duration_ms`) y la ruta del log.
- **Una corrida en el commit de la pieza 1**, en un `git worktree` temporal:
  `git worktree add <tmp> 0498ea9`, con el catálogo copiado y `node tools/suite.js`.
  - El desarrollador corrió la suite una sola vez, al final, con las dos piezas juntas, y
    después las separó en dos commits con un minuto de diferencia.
  - Esta corrida dice si la pieza 1 sola deja la suite en verde.
- `node tools/check-compat.js` y `node tools/build-config.js --verificar`.

## 2 · Tres experimentos de remoción, ejecutados

Para cada uno pegá:

1. el `git diff` del cambio;
2. **la salida del test corrido, con el rojo**;
3. `git checkout -- <archivo>`, y `git status --short` vacío.

| # | Quitar | Correr | Tiene que ponerse rojo |
|---|---|---|---|
| E1 | en `app/js/generador/documentos.js`, el bloque que frena por documentos `sinPdf` | `tests/ronda-41-p1.test.js` | el caso 1d-4 (sin los PDF no imprime ni exporta) |
| E2 | en `app/js/generador/intercambio.js`, que la plantilla no pase por `revisarValores` (hacé que pase) | `tests/ronda-41-p1.test.js` | el caso 1b-8 (el renglón cotizado una sola vez) |
| E3 | en `app/js/generador.js`, la llamada a `irA` del clic en `#sgc-pasos` | `tests/ronda-41-p2.test.js` | el caso 2-1 ("4 · Revisión" desde Identificación) |

## 3 · Controles contados

- **La plantilla del servidor, no el archivo.** Con un script de Node que cargue
  `namespaces.js`, `core/config.js`, `core/validacion.js` y `views/fasttrack.js` **sin**
  llamar a `exigirIdentificacionCompleta(true)`:
  - `JSON.stringify(SGC.views.fasttrack.modelo())` en `1ebf5ef` y en el HEAD;
  - pegá los dos SHA-256. **Tienen que ser iguales.**
  - Después, con `exigirIdentificacionCompleta(true)` en el HEAD: ¿trae `presupuestos`?
- **El requerimiento del servidor:** con `tests/helpers/aplicacion-montura.js`, componé el
  mismo requerimiento en `1ebf5ef` y en el HEAD. ¿El HTML es igual byte a byte? Pegá los dos
  SHA-256.
- **Una plantilla con presupuestos**, importada por `SGC.generadorIntercambio.importar` (con
  `tests/helpers/generador-montura.js`). Usá la plantilla del caso 1b-3 de
  `tests/ronda-41-p1.test.js`. Pegá:
  - lo que devuelve en `presupuestos`;
  - los `valoresReferencia` del renglón 1.
- **`git diff 1ebf5ef..HEAD -- server/ app/js/core/ app/index.html`:** vacío.
- **El paquete:** `node tools/empaquetar-generador.js --ronda 41 --destino <tmp>`. ¿El
  `VERSION.txt` y `config/aplicacion.js` del paquete dicen `r41-1c112e5`?

## 4 · Reporte

Va en `auditoria\ciclo-41b\AUDITORIA-CICLO-41b.md`, con **copia** en
`AppOptimizar\AUDITORIAS\`. Lleva:

- las secciones 1 a 3;
- cuánto tardaste;
- al final, una pregunta para el Jefe, si algo te parece mal pensado.

Cierre: commit `Auditoria ciclo 41b`, sin push.
