# ORDEN DE TRABAJO — RONDA 1

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hito cubierto: **H1 — Fundaciones del repositorio**
Emitida: 2026-08-13

---

## 0. Cómo se lee esta orden

Sos el agente de desarrollo de este proyecto. Trabajás sobre este repositorio, que ya contiene toda la documentación de arquitectura. **No hay código todavía: lo vas a crear vos en esta ronda.**

Esta orden es la única fuente de instrucciones. No hay un humano disponible para responder preguntas durante la ejecución: cuando algo te falte o te resulte contradictorio, **no lo resuelvas por tu cuenta** — anotalo en `INFORME.md` (sección 4) y seguí con el resto.

### Orden de precedencia documental (crítico)

Si dos documentos se contradicen, **gana el que está más arriba**:

1. **Esta orden** (`ordenes/ORDEN-RONDA-01.md`)
2. **`BITACORA_DECISIONES.md`** — decisiones de arquitectura vigentes (ADR-001 a ADR-018)
3. **`PLAN_DESARROLLO.md`** — hitos y criterios de aceptación
4. **`FullScopeDoc.md`** — alcance funcional del negocio
5. **`AUDITORIA_InstruccionesCodigo.md`** — auditoría crítica del documento siguiente
6. **`InstruccionesCodigo.md`** — ⚠️ **PARCIALMENTE OBSOLETO.** Fue redactado antes del relevamiento de infraestructura y contiene errores técnicos graves ya identificados. Las secciones que la auditoría marca como eliminadas o reescritas **no se aplican**. Se conserva en el repositorio como registro histórico, no como especificación.

**Lo más importante de todo:** `InstruccionesCodigo.md` §1.3 exige que la aplicación funcione con protocolo `file://`. **Eso está derogado por ADR-001.** Cualquier entregable que asuma `file://`, o que justifique una decisión citando esa sección, se considera fallido.

---

## 1. Alcance de esta ronda

Construir el esqueleto del proyecto y el núcleo declarativo. **Nada más.**

**Prohibido adelantarse.** No escribas el servidor, ni la interfaz, ni el catálogo, ni las vistas, ni los entregables. Están planificados para rondas siguientes y hacerlos ahora es un incumplimiento, no una iniciativa. Si te sobra capacidad, usala en la calidad de lo pedido y en la profundidad del `INFORME.md`.

---

## 2. Entregables

### 2.1 — Estructura de directorios

Creá exactamente esta estructura (los directorios que en esta ronda quedan vacíos llevan un `.gitkeep`):

```
app/
  index.html                  (sólo un stub mínimo, sin lógica)
  css/main.css                (sólo variables CSS y reset, sin componentes)
  js/
    core/
      namespaces.js
      config.js
      utils.js
    adapters/                 (vacío en esta ronda)
    catalogo/                 (vacío)
    views/                    (vacío)
    renders/                  (vacío)
    export/                   (vacío)
  assets/                     (vacío)
config/
  usuarios.ejemplo.json
esquemas/
  datos.ejemplo.json
  idx.ejemplo.json
server/                       (vacío en esta ronda)
tools/
  check-compat.js
  scraper-catalogo/           (YA EXISTE — no tocar)
tests/
  config.test.js
  estados.test.js
datos-prueba/                 (vacío)
```

### 2.2 — `app/js/core/namespaces.js`

Define el namespace global único `SGC` con sus sub-espacios (`SGC.core`, `SGC.adapters`, `SGC.catalogo`, `SGC.views`, `SGC.renders`, `SGC.export`). Patrón IIFE, `'use strict';`. No debe ensuciar `window` con nada más que `SGC`.

### 2.3 — `app/js/core/config.js` — **el entregable central**

La máquina de estados de los **18 pasos**, declarativa y completa. Es el corazón del sistema: las vistas jamás deben conocer los estados, sólo leer de acá.

El contenido de los 18 pasos, sus fases y qué sector ejecuta cada uno está en **`FullScopeDoc.md` §4**. Los roles están en `InstruccionesCodigo.md` §10.1 (esa sección **sí** sigue vigente). Leelos y modelalos; no inventes pasos ni los reordenes.

Cada estado debe declarar, como mínimo:

```js
{
  id: 'ESPECIFICACIONES_TECNICAS',   // SCREAMING_SNAKE_CASE, único
  numero: 1,                          // 1..18, según FSD §4
  titulo: 'Especificaciones Técnicas',// texto visible al usuario, en español
  fase: 1,                            // 1..10, según FSD §4
  rolEjecutor: 'generador',           // debe existir en la lista de roles
  estadosSiguientes: ['...'],         // ids válidos
  estadosDevolucion: ['...'],         // ids válidos; vacío si no admite devolución
  camposRequeridos: [],               // nombres de campo exigidos para poder avanzar
  entregablesObligatorios: []         // documentos que deben existir para avanzar
}
```

El archivo debe exponer además:

- `SGC.core.config.ROLES` — los 7 roles.
- `SGC.core.config.ESTADOS` — los 18 estados.
- `SGC.core.config.MOTIVOS_DEVOLUCION` — catálogo **cerrado** de motivos de devolución, con `id`, `texto` y `sector`. Proponé una primera versión razonable a partir del dominio (mínimo 8 motivos); será validada con los operadores más adelante.
- `SGC.core.config.ESTADO_INICIAL` y `SGC.core.config.ESTADO_FINAL`.

`camposRequeridos` y `entregablesObligatorios` pueden quedar como arreglos vacíos donde la documentación no especifique el detalle — **pero la clave debe existir en los 18 estados**. Si dejás uno vacío por falta de información, listalo en el `INFORME.md`.

### 2.4 — `tools/check-compat.js` — **el guardián**

Script de Node (sin dependencias) que recorre `app/` y **falla con código de salida 1** si encuentra alguna violación, imprimiendo `archivo:línea` y el motivo de cada una.

Debe detectar:

**(a) APIs posteriores a Chrome 109** — la línea base es permanente, ver ADR-011:

| Construcción | Disponible desde |
|---|---|
| `.toSorted(` `.toSpliced(` `.with(` sobre arreglos | Chrome 110 |
| `Object.groupBy` / `Map.groupBy` | Chrome 117 |
| `Promise.withResolvers` | Chrome 119 |
| flag `v` en expresiones regulares | Chrome 112 |
| anidamiento CSS nativo (selector con `&`) | Chrome 112 |
| `text-wrap: balance` | Chrome 114 |
| `:user-valid` / `:user-invalid` | Chrome 119 |
| atributo HTML `popover` | Chrome 114 |
| `.move(` / `.remove(` sobre handles de File System Access | Chrome 111 / 110 |

**(b) Cualquier URL absoluta `http://` o `https://` dentro de `app/`** — la aplicación no emite peticiones al exterior ni carga recursos remotos, nunca (ADR-018).

**(c) `import` / `export` / `<script type="module">`** — no se usan módulos ES.

**(d) Dependencias externas** — si existe `package.json`, su campo `dependencies` debe estar vacío o ausente; si existe `node_modules/` dentro de `app/`, es violación.

Requisitos del propio guardián: sin dependencias, un solo archivo, y **debe pasar su propia inspección** si se lo apunta a sí mismo. Evitá falsos positivos obvios: no marques coincidencias dentro de comentarios de bloque ni dentro de cadenas de texto destinadas a mensajes de error (documentá en el código cómo lo resolviste).

### 2.5 — `tests/` con `node --test`

Sin dependencias: usá el runner incorporado de Node (`node --test`). Verificá como mínimo estos invariantes sobre `config.js`:

1. Hay exactamente **18** estados.
2. Los `id` son únicos; los `numero` son 1..18 sin huecos ni repeticiones.
3. Todo id citado en `estadosSiguientes` y `estadosDevolucion` existe en `ESTADOS`.
4. Todo `rolEjecutor` existe en `ROLES`.
5. Las `fase` cubren 1..10.
6. Los 18 estados tienen **todas** las claves obligatorias de §2.3.
7. `ESTADO_FINAL` es terminal: no tiene `estadosSiguientes`.
8. **Alcanzabilidad:** partiendo de `ESTADO_INICIAL` y siguiendo `estadosSiguientes` se llega a `ESTADO_FINAL`.
9. **Sin estados huérfanos:** todo estado distinto del inicial es citado por al menos otro estado.
10. Todo motivo de devolución tiene `id` único.

### 2.6 — Esquemas y padrón de ejemplo

- `esquemas/datos.ejemplo.json` — un expediente de ejemplo completo y coherente, siguiendo `InstruccionesCodigo.md` §6.1 **con estas correcciones obligatorias**: los renglones llevan `{ codigo, cantidad, unidad, aclaracion }` con `aclaracion` de máximo 200 caracteres (enmienda de ADR-014); se agrega `catalogoVersion`; el `historico` **no** guarda snapshots completos en línea (ADR, defecto D de la auditoría).
- `esquemas/idx.ejemplo.json` — la entrada liviana de índice por expediente (ADR-005), de unos pocos cientos de bytes.
- `config/usuarios.ejemplo.json` — padrón de operadores con `{ nombre, apellido, email, roles: [], sector, activo }`, con el correo institucional como clave única (ADR-017). Usá datos ficticios.

### 2.7 — `README.md` y `.gitignore`

`README.md`: qué es el proyecto en cinco líneas, cómo correr los tests, cómo correr el guardián, y la estructura de directorios. Nada de marketing.

`.gitignore`: al menos `node_modules/`, `datos-prueba/`, `app/catalogo/`, `*.log`, `Thumbs.db`.

### 2.8 — `INFORME.md` (raíz del repositorio) — **se evalúa tanto como el código**

Formato obligatorio, exactamente estas secciones numeradas:

```
# INFORME — RONDA 1

## 1. Qué hice
Lista de archivos creados y qué resuelve cada uno. Breve.

## 2. Decisiones que tomé y por qué
Cada decisión no trivial que la orden dejaba abierta, con su fundamento en una línea.

## 3. Verificación
Salida literal de `node --test` y de `node tools/check-compat.js`.

## 4. Contradicciones e información faltante
Toda contradicción entre documentos que hayas detectado, y todo dato que
necesitaste y no estaba. NO las resuelvas: reportalas, citando documento y sección.

## 5. Qué NO hice
Lo que la orden pedía y no pudiste completar, con el motivo.

## 6. Riesgos que veo
Lo que te preocupa del diseño de cara a las rondas siguientes.
```

La sección 4 es la más importante del informe. Este repositorio contiene documentos que se contradicen entre sí de forma deliberada: uno de ellos está parcialmente derogado. Detectar esas contradicciones **es parte del trabajo**.

---

## 3. Reglas de conducta (no negociables)

1. **Bajo radio de impacto.** No reescribas ni reformatees archivos existentes. La documentación (`FullScopeDoc.md`, `BITACORA_DECISIONES.md`, `PLAN_DESARROLLO.md`, `AUDITORIA_*`, `RELEVAMIENTO_*`, `InstruccionesCodigo.md`) es **de sólo lectura** en esta ronda. Tampoco toques `tools/scraper-catalogo/`.
2. **Prohibido alucinar.** Si necesitás un dato que no está en los documentos, no lo inventes: dejá el campo vacío o el arreglo vacío y reportalo en `INFORME.md` §4.
3. **Cero dependencias.** Ni una sola librería de terceros, ni de runtime ni de desarrollo. Node y su biblioteca estándar, nada más.
4. **Idioma** (ADR-007): sustantivos de dominio en español (`expediente`, `renglon`, `pliego`, `dictamen`), vocabulario técnico en inglés (`handler`, `parse`, `cache`), comentarios en español, interfaz en español.
5. **Convenciones:** `camelCase` para variables y funciones, `SCREAMING_SNAKE_CASE` para constantes, `kebab-case` para archivos y clases CSS. `'use strict';` al inicio de cada IIFE. Ningún archivo supera las 400 líneas.
6. **Sin emojis** en el código ni en la interfaz.
7. **Commit local, sin push.** Al terminar, `git add -A` y un solo commit con mensaje `Ronda 1 — H1 Fundaciones`. **No hagas `git push`.**

---

## 4. Criterios de aceptación

Objetivos y verificables. Se ejecutan tal cual:

| # | Comando / verificación | Resultado exigido |
|---|---|---|
| 1 | `node --test` desde la raíz | Todos los tests en verde |
| 2 | `node tools/check-compat.js` | Código de salida 0, sin violaciones |
| 3 | Búsqueda de `import ` / `export ` / `type="module"` en `app/` | Cero coincidencias |
| 4 | `node -e "..."` cargando `config.js` | 18 estados, 7 roles, ≥8 motivos |
| 5 | Existencia de `INFORME.md` con las 6 secciones | Completo |
| 6 | `git status` | Limpio, un solo commit nuevo |
| 7 | Archivos de documentación | Sin modificar (se compara contra el commit anterior) |

Un entregable que no compila, que no pasa su propio guardián, o que modificó la documentación, se descarta sin más análisis.

---

## 5. Qué se está evaluando

Con transparencia, porque no es un examen sorpresa: se evalúa **adherencia a restricciones bajo una lista larga**, no habilidad de codificación. El proyecto tiene un techo de plataforma permanente (Chrome 109), cero dependencias y prohibición de red externa. Un modelo brillante que introduce `Object.groupBy` en el mes cuatro cuesta más de lo que aporta.

Pesa, en este orden: (1) violaciones de restricción, (2) calidad y honestidad del `INFORME.md`, en particular la sección 4, (3) corrección del modelo de estados contra el FSD, (4) calidad del guardián, (5) prolijidad del código.

Trabajo inventado fuera de alcance **resta**, no suma.
