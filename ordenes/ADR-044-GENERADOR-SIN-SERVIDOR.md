# ADR-044 — Generador de documentación sin servidor, mientras se tramita el puerto

SGC · 2026-10-02 · revisor · **Estado: el qué, pedido por el Jefe el 2026-10-02; el cómo —mismo repositorio, segundo punto de entrada—, propuesto por el revisor.** El
desarrollador la asienta en `BITACORA_DECISIONES.md` en la ronda 28.

---

## Contexto

El responsable técnico del servidor informó que **usar un puerto en el servidor para
correr un proceso requiere trámites que van a demorar**. Sin ese puerto, la aplicación
con servidor (ADR-035) no puede salir de la PC del Jefe.

El Jefe quiere **capitalizar ya** lo construido: que la gente use la aplicación para
**generar los documentos de su rol**, sin login, eligiendo el rol —"Usuario",
"Abastecimiento" o "Contrataciones"—, y que el trabajo pase de un rol al siguiente
**como archivo JSON**.

## Lo que se verificó antes de decidir (revisor, 2026-10-02)

- **Abrí `app/index.html` como archivo** (`file://`) en Chromium. Todo el JavaScript
  carga. **Lo único que falla son los 3 lugares que usan `fetch`**: el catálogo
  (`catalogo/carga.js:27`), la configuración (`app.js:332`) y el padrón de ejemplo
  (`app.js:351`). Chrome no deja hacer `fetch` sobre `file://`.
- **Ya existe un repositorio en memoria**: `adapters/repo.memoria.js`, de 884 líneas,
  con el mismo contrato que el del servidor (ADR-002).
- **Ya existen el modelo JSON del Fast-Track**, con descarga e importación, y la
  exportación JSON, resumen y YAML del expediente.
- **Las reglas** (validación, renglones, valores, anexo de EETT) **y los documentos**
  (requerimiento, EETT, anexo, ANEXO 1, YAML) **ya corren en el navegador**.
- **Lo que hoy vive sólo en el servidor y hace falta mover al núcleo compartido:** la
  consolidación de renglones del ANEXO I por SCo (`server/sco.js:799`).

## Decisión

**Un segundo punto de entrada, `generador.html`, en el mismo repositorio**, que se
empaqueta como una carpeta independiente: `SGC-Generador`.

**Cómo se usa:**

- Se abre con **doble clic** desde una carpeta compartida, por ejemplo `Y:\UOC`, que
  todos leen y sólo el Jefe escribe.
- **No necesita servidor, ni puerto, ni Node, ni instalar nada**: Chrome 109 abre un
  archivo.

**Qué tiene:**

- **Sin login.** Se elige el rol y se escribe el nombre, que queda **sellado** en cada
  exportación.
- **El JSON es el expediente.** Cada rol importa el JSON del rol anterior, genera sus
  documentos, los imprime a PDF para el circuito de firmas y **exporta el JSON** para
  el rol siguiente.
- **El formulario de siempre es el camino principal.** La plantilla JSON es una
  alternativa: se descarga vacía, se completa por fuera si se quiere, y se importa. Lo
  importado se abre en el mismo formulario y se sigue editando.
- **El mismo núcleo, las mismas reglas y los mismos documentos** que la aplicación con
  servidor. Un arreglo vale para las dos.

**Quién hace qué:**

| Rol | Importa | Genera | Exporta |
|---|---|---|---|
| **Usuario** (generador) | la plantilla vacía o llena, o su propio JSON para seguir | Solicitud de Gastos (requerimiento), EETT y Anexo de EETT | el JSON del requerimiento |
| **Abastecimiento** | **uno o varios** JSON de requerimiento | carga el número de SCo y genera el **ANEXO I consolidado**, con los renglones sumados y el desglose (ADR-043) | el JSON de la SCo |
| **Contrataciones** | **uno o varios** JSON de SCo | carga el número de procedimiento de COMPR.AR y genera el **YAML del pliego consolidado** para el generador de la UOC | el JSON del proceso |

## Por qué el mismo repositorio y no un clon aparte

**Un clon duplica el núcleo.** Cada arreglo —una regla, un documento, el catálogo
mensual— habría que hacerlo dos veces, y las dos copias divergen en semanas.

Con un segundo punto de entrada:

- el generador usa **exactamente** el código que ya está probado por 544 tests;
- la aplicación con servidor queda **intacta** para cuando salga el puerto;
- el "clon" que vos ves es la carpeta `SGC-Generador` que sale del empaquetado. **Es
  una carpeta aparte, pero no es código aparte.**

## Lo que se resigna, a sabiendas

- **Sin login no hay control de quién hizo qué**, más allá del nombre que cada uno
  escribe. El control real sigue siendo la **firma** en el circuito vigente
  (ADR-016).
- **No hay un lugar central.** El JSON viaja como hoy viajan los documentos. Para
  limitar las copias que divergen:
  - cada exportación lleva **número de versión, fecha, rol, nombre y una huella** del
    contenido;
  - importar una versión **más vieja** que la última vista **avisa**.
- **Los PDF de los presupuestos no se guardan**: el JSON los cita por nombre, y viajan
  como hoy.
- **El buzón de sugerencias** no tiene dónde guardarse. Las sugerencias se exportan en
  un archivo aparte que se le manda al Jefe.

## Qué pasa con lo demás

- **La aplicación con servidor queda congelada en la ronda 27**, completa hasta la SCo
  en bloque. **El proceso —la ronda 28 vieja— se pospone**, y se retoma cuando salga
  el puerto.
- **La matriz de permisos, el entorno de prueba y el candado** son de la aplicación con
  servidor: esperan con ella.

## Rondas

- **28 (G1):**
  - el generador abre como archivo;
  - el catálogo se carga sin `fetch`;
  - selector de rol y nombre;
  - el rol **Usuario** completo, con plantilla, importación y exportación;
  - el empaquetado.
- **29 (G2):** **Abastecimiento**, con varios requerimientos, el número de SCo y el
  ANEXO I consolidado. La consolidación pasa al núcleo compartido.
- **30 (G3):** **Contrataciones**, con varias SCo, el número de procedimiento y el YAML
  del pliego consolidado.
