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

Verás la pantalla de búsqueda del catálogo de ítems: escribí una clase o rubro
(por ejemplo `valvula` o `termostato`), elegí una clase de las sugerencias,
filtrá los ítems de esa clase y armá la lista de renglones del pedido. La
búsqueda no distingue mayúsculas ni acentos. El catálogo son fragmentos
estáticos de menos de 300 KB cada uno; nunca se descarga el archivo completo
de ~40 MB. La carpeta `datos/` es donde el servidor guarda los expedientes y
el registro (ya viene creada; se puede apuntar a otra carpeta con `--datos`).

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
                       clases, items/) — se regeneran con tools/build-catalogo.js
  js/
    core/            → núcleo declarativo (namespaces, config, utils)
    adapters/        → persistencia intercambiable (ADR-002)
    catalogo/        → búsqueda en cascada (ADR-004)
    views/           → vistas
    renders/         → plantillas de entregables
    export/
  assets/
config/              → padrón de operadores
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
