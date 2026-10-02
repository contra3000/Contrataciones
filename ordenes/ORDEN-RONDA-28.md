# ORDEN DE TRABAJO — RONDA 28 · Generador G1

SGC · 2026-10-02 · hito **H27: el Generador de documentación, sin servidor**
Reglas: `CICLO_DE_TRABAJO.md` · Decisión: `ordenes/ADR-044-GENERADOR-SIN-SERVIDOR.md`

**Paso 0 · publicar:** `git add ordenes PLAN_DESARROLLO.md` → `git commit -m "Revisor:
ordenes y plan al dia"` → `git push`.

**Vale** la §0 de `ORDEN-RONDA-01.md` y las reglas de tiempo de `ORDEN-RONDA-20.md`.
**Accesos:** `os.tmpdir()`, `127.0.0.1`, y crear `..\auditoria\ciclo-28` al cerrar.
**Cada pieza: tests en verde → commit y push en el momento. La suite, con
`--test-timeout=120000`.**

**De dónde sale.** Correr la aplicación con servidor en el servidor de la Brigada
requiere un trámite largo. El Jefe quiere usar ya lo construido: un **generador de
documentos que se abre con doble clic**, sin login, que pasa el trabajo de un rol al
siguiente **como archivo JSON**.

**No toques la aplicación con servidor** (`index.html`, `server/`), salvo para
compartir código del núcleo. **Las dos tienen que seguir andando.**

---

### Pieza 1 · El catálogo carga sin red · commit: `Ronda 28 · catálogo sin servidor`

**Dónde:** `app/js/catalogo/carga.js:27`, la función `peticion(ruta)`, hace `fetch`.
Chrome no permite `fetch` sobre `file://`. El revisor lo midió abriendo
`app/index.html` como archivo: fallan el manifiesto, los rubros, las clases y la
configuración, y **nada más**.

**Cambia:**

- `tools/build-catalogo.js` genera, **además** de cada `.json`, un `.js` hermano que
  llama a `SGC.catalogo.recibir('<ruta>', <datos>)`.
- `peticion` usa **`<script>`** cuando `location.protocol === 'file:'`, y `fetch` en
  cualquier otro caso. **La aplicación con servidor no cambia de comportamiento.**

**Test:**

- con `protocol` simulado en `file:`, se inyecta un `<script>` con la ruta `.js` y
  resuelve con los datos;
- con `http:`, usa `fetch` como hoy;
- el build genera la misma cantidad de `.js` que de `.json`.

### Pieza 2 · `generador.html`: rol, nombre y nada de red · commit: `Ronda 28 · entrada del generador`

**Cambia:**

- **`app/generador.html`**, otro punto de entrada, con el mismo núcleo, los mismos
  renders y las mismas vistas. Usa **`repo.memoria`**, **nunca** `repo.http` ni
  `repo.sesion`.
- **Al abrir:** *"¿Quién sos?"* (nombre libre) y *"¿Qué rol?"*: **Usuario**,
  **Abastecimiento** o **Contrataciones**. Sin login ni padrón.
  - Este rol tiene **una sola vista habilitada**. **Abastecimiento** y
    **Contrataciones** muestran *"disponible en la próxima versión"* (rondas 29 y 30).
- **La configuración va como `.js`**, no por `fetch`.
- **Una franja visible** dice *"Generador de documentos — sin servidor. Lo que hagas
  queda en el archivo que exportes."*

**Test:**

- la montura carga `generador.html` **sin servidor** y verifica que **no se hizo
  ningún pedido de red**: ni `fetch` ni `XMLHttpRequest`;
- elegir **Usuario** muestra el alta.

### Pieza 3 · El rol Usuario completo · commit: `Ronda 28 · rol Usuario`

**Los dos caminos conviven, y el principal es el de siempre.** El Usuario puede:

- **llenar el formulario en pantalla**, con el mismo asistente de Fase 1 que ya existe;
- **o importar un JSON** (pieza 4).

Lo importado **se abre en ese mismo formulario** y se sigue editando ahí. Exportar
funciona igual venga de donde venga. **El JSON no reemplaza al formulario.**

**Cambia:** con el generador, el Usuario hace todo lo que hoy hace el generador en
Fase 1:

- el alta con renglones del catálogo;
- el formulario del requerimiento;
- los **dos valores de referencia por renglón**: la regla de la ronda 26 sigue igual;
- el EETT y el anexo de EETT;
- imprimir.

**Lo que cambia respecto de la aplicación con servidor:**

- **Presupuestos:** no se suben. Se cargan **como referencia**: nombre del archivo,
  proveedor y fecha. Los valores los citan igual que hoy citan `presupuestoId`. Los
  PDF viajan por el circuito de siempre.
- **No hay "Avanzar":** en su lugar, **"Exportar para Abastecimiento"** (pieza 4).
  Sólo se habilita si `validarParaAvanzar` de `ESPECIFICACIONES_TECNICAS` da válido,
  con el texto de qué falta de la ronda 26.

**Test:** un requerimiento de 3 renglones del catálogo real, con dos valores cada uno
→ se imprimen la Solicitud de Gastos y el EETT **con la descripción del ítem**, y se
habilita "Exportar".

### Pieza 4 · Plantilla, importar y exportar · commit: `Ronda 28 · plantilla e intercambio`

**Cambia:**

- **"Descargar plantilla vacía"**: el JSON del Fast-Track (`fasttrack.js`) con un campo
  `formato`, por ejemplo `"sgc-requerimiento/1"`.
- **"Importar"** acepta:
  - **la plantilla completada** por fuera;
  - **un requerimiento exportado antes**, para seguir trabajando.

  Valida con las **mismas reglas del núcleo**. Si algo no cumple, lo dice en
  castellano y con el renglón, y **no carga nada a medias**.
- **"Exportar"** descarga **`requerimiento-<año>-<título corto>-v<N>.json`**, con:
  - el expediente completo, incluido `item` en cada renglón;
  - y **el sello**: `formato`, versión del generador, versión del catálogo, rol,
    nombre, fecha, **número de versión** (sube en cada exportación) y **huella**
    SHA-256 del contenido.
- **Importar una versión más vieja** que otra ya importada en la sesión → **aviso**.

**Test:**

- exportar → importar → el contenido es **igual**, sin contar el sello;
- importar → **corregir un campo y un renglón en el formulario** → exportar → el JSON
  trae la corrección;
- una plantilla llena de un fixture se importa;
- un JSON con un código inexistente o con un renglón con un solo valor → error claro
  y nada cargado;
- una huella alterada → *"el archivo fue modificado fuera del generador"*.

### Pieza 5 · La carpeta para copiar · commit: `Ronda 28 · empaquetado del generador`

**Cambia:** `tools/empaquetar-generador.js` arma `dist/SGC-Generador/` con:

- `generador.html`, `js/`, `css/` y el catálogo en `.js`;
- **nada de `server/`, ni `tests/`, ni `datos/`**;
- `LEEME.txt` en castellano: *"Abrí generador.html con Chrome. No hace falta
  instalar nada."*

`dist/` va al `.gitignore`.

**Test:**

- el paquete existe y tiene `generador.html`;
- no contiene `server/` ni `.json` de datos;
- el informe dice su tamaño total.

---

## Cierre · siempre igual

1. **`INFORME-RONDA-28.md`**, con las nueve secciones, y además:
   - las piezas con su hash;
   - qué no entró y por qué;
   - **qué vistas de la aplicación con servidor se reusaron tal cual y cuáles
     necesitaron adaptarse**;
   - el tamaño del paquete;
   - el **ADR-044** asentado en la bitácora.
2. Commit `Ronda 28 · informe` → `git push`.
3. `git clone https://github.com/contra3000/Contrataciones.git ..\auditoria\ciclo-28`.
   Si la carpeta existe, no se toca y se avisa.
4. El mismo commit en el clon y en `dev\`, con las dos líneas al final del informe.
5. **Además: `node tools/empaquetar-generador.js`** y dejá la carpeta en
   **`..\SGC-Generador`**, es decir `AppOptimizar\SGC-Generador`, para la prueba del
   Jefe.

## Tu prueba de 10 minutos · para el Jefe

1. Abrí **`AppOptimizar\SGC-Generador\generador.html`** con doble clic. **No abras
   `Iniciar SGC.bat`.**
2. Nombre y rol **Usuario**.
3. Cargá **en el formulario, como siempre,** un requerimiento chico de verdad: 3
   renglones del catálogo y dos valores de referencia cada uno.
4. Imprimí la Solicitud de Gastos: **¿tiene la descripción del ítem y la firmarías?**
5. **"Exportar para Abastecimiento"** → se descarga el JSON. Cerrá todo, volvé a abrir
   y **importalo**: tiene que estar todo, **y tiene que poder seguir editándose en el
   formulario**.
6. Copiá la carpeta a **`Y:\UOC`** y abrila desde otra PC: **¿abre igual?**

## Pasa a las rondas 29 y 30

- **29:** el rol **Abastecimiento**. Importa varios requerimientos, carga el número de
  SCo y genera el ANEXO I consolidado. La consolidación de `server/sco.js:799` pasa al
  núcleo, compartida con el servidor.
- **30:** el rol **Contrataciones**. Importa varias SCo, carga el número de
  procedimiento de COMPR.AR y genera el YAML del pliego consolidado.
