# SGC — Sistema de Gestión de Contrataciones

Sistema web estático para la División Contrataciones Moreno (VII Brigada Aérea).
Gestiona el circuito de los 18 pasos de contrataciones sobre una intranet
air-gapped, con persistencia en archivos JSON sobre carpeta de red. Sin base
de datos, sin dependencias externas y con una línea base permanente de
compatibilidad: Chrome/Edge 109 (ADR-011).

## Comandos

Correr los tests (runner incorporado de Node, sin dependencias):

```
node --test
```

Correr el guardián de compatibilidad y aislamiento (recorre `app/`):

```
node tools/check-compat.js
```

## Estructura de directorios

```
app/                 → lo único que se despliega
  index.html
  css/main.css
  js/
    core/            → núcleo declarativo (namespaces, config, utils)
    adapters/        → persistencia intercambiable (ADR-002)
    catalogo/        → búsqueda en cascada (ADR-004)
    views/           → vistas
    renders/         → plantillas de entregables
    export/
  assets/
config/              → padrón de operadores
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
