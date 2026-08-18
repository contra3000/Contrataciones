# SGC — Sistema de Gestión de Contrataciones

Sistema web estático para la División Contrataciones Moreno (VII Brigada Aérea).
Gestiona el circuito de los 18 pasos de contrataciones sobre una intranet
air-gapped, con persistencia en archivos JSON sobre carpeta de red. Sin base
de datos, sin dependencias externas y con una línea base permanente de
compatibilidad: Chrome/Edge 109 (ADR-011).

## Cómo arrancar la app

Un solo comando levanta el servidor (Node incluido, sin instalar nada):

```
node server/servidor.js --datos datos
```

Después abrí en el navegador:

```
http://localhost:8123
```

Verás la **aplicación completa de la Fase 1**: primero la selección de operador
desde el padrón `config/usuarios.ejemplo.json` (ADR-017) y después el asistente
de la **Especificación Técnica** en cuatro pasos — identificación, renglones,
fundamentación y revisión. En el paso 2 vive la búsqueda del catálogo de ítems:
escribí una clase o rubro (por ejemplo `valvula` o `termostato`), elegí una
clase, filtrá los ítems y armá la lista de renglones. La búsqueda no distingue
mayúsculas ni acentos.

Desde el paso 1 podés **descargar un modelo JSON** y **subirlo** (Fast-Track):
el archivo se valida campo por campo y código por código contra el catálogo
vigente antes de tocar el formulario; un error lista exactamente qué está mal.
Todo el trabajo se guarda como **borrador en `sessionStorage`** de la pestaña:
si la cerrás por accidente y volvés a entrar con el mismo operador, la
aplicación te ofrece retomarlo o descartarlo (nunca lo aplica en silencio, y no
se ofrece a otro operador). Al confirmar el paso 4, el expediente queda en el
servidor con su número, su entrada en el índice fragmentado y su auditoría con
el correo del operador; el borrador se limpia.

El catálogo son fragmentos estáticos de menos de 300 KB cada uno; nunca se
descarga el archivo completo de ~40 MB. La validez de los códigos importados por
el Fast-Track se consulta al servidor (`POST /api/catalogo/validar-codigos`),
que responde sólo cuáles no existen, sin bajar el universo de códigos al
cliente. La carpeta `datos/` es donde el
servidor guarda los expedientes y el registro (ya viene creada; se puede apuntar
a otra carpeta con `--datos`).

## Comandos

Correr los tests (runner incorporado de Node, sin dependencias):

```
node --test
```

Correr el guardián de compatibilidad y aislamiento (recorre `app/`):

```
node tools/check-compat.js
```

Regenerar los fragmentos del catálogo (se corre a mano, una vez por
actualización mensual del catálogo):

```
node tools/build-catalogo.js --entrada datos-prueba/catalogo_incisos.json --salida app/catalogo
```

Medir el índice y la búsqueda contra el presupuesto de rendimiento:

```
node tools/medir-catalogo.js
```

## Estructura de directorios

```
app/                 → lo único que se despliega
  index.html
  css/main.css
  catalogo/          → fragmentos del catálogo generados (manifiesto, rubros,
                       clases, items/) — se regeneran con
                       tools/build-catalogo.js
  js/
    core/            → núcleo declarativo (namespaces, config, utils, validacion)
    adapters/        → persistencia intercambiable (ADR-002)
    catalogo/        → búsqueda en cascada (ADR-004) y composición de renglones
    views/           → lógica del wizard (pasos, borrador, fasttrack, wizard)
    renders/         → plantillas de entregables
    export/
  assets/
config/              → padrón de operadores (ADR-017)
datos/               → carpeta de datos del servidor (expedientes, registro)
esquemas/            → esquemas y ejemplos de datos
server/              → servidor Node sin dependencias (ADR-003)
tools/               → guardián y build del catálogo
tests/               → tests con node --test
datos-prueba/        → simulacro de la carpeta de red
```

## Documentación

- `FullScopeDoc.md` — alcance funcional
- `BITACORA_DECISIONES.md` — decisiones de arquitectura (ADR-001 a ADR-018)
- `PLAN_DESARROLLO.md` — hitos y criterios de aceptación
- `AUDITORIA_InstruccionesCodigo.md` — auditoría crítica
- `RELEVAMIENTO_ENTORNO.md` — relevamiento de infraestructura
- `ordenes/` — órdenes de trabajo por ronda
