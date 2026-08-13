# INSTRUCCIONES ESTRICTAS PARA GENERACIÓN DE CÓDIGO Y STACK TECNOLÓGICO

Proyecto: Sistema de Gestión de Contrataciones (SGC) — División Contrataciones Moreno (VII Brigada Aérea)
Este documento es VINCULANTE. Todo código generado debe cumplirlo al pie de la letra, sin excepciones.

> ⚠️ **NOTA DE RESTAURACIÓN (2026-08-13).** Este archivo se perdió del repositorio durante el commit de base documental y fue restaurado desde el contenido original. Su estado sigue siendo el descrito en `AUDITORIA_InstruccionesCodigo.md`: **parcialmente derogado**. Las secciones marcadas como eliminadas o reescritas en la tabla §3 de la auditoría **no se aplican**. Se conserva como registro histórico y como fuente de las secciones que siguen vigentes (en particular §10.1, roles).

---

## 1. PRINCIPIOS NO NEGOCIABLES

1. **Sin servidor de base de datos.** Persistencia únicamente en sistema de archivos (carpetas de red compartidas). Prohibido SQL, servidores de backend, APIs remotas o servicios en la nube.
2. **Entorno Air-Gapped.** Prohibido el uso de CDNs, fuentes web, telemetría, analytics, o cualquier recurso que requiera conexión a Internet. TODA dependencia debe estar vendida localmente (carpeta `/lib`).
3. **Ejecución local con protocolo `file://`.** La app debe funcionar abriendo `index.html` directamente en el navegador de cada PC. Por esta razón: **PROHIBIDO usar módulos ES (`<script type="module">`)**, `fetch()` sobre archivos relativos, o `import/export` (el navegador los bloquea por CORS en `file://`). Usar **scripts clásicos** con *namespace* global (patrón IIFE) y `XMLHttpRequest` síncrono o carga diferida solo donde sea estrictamente necesario.
4. **Sin paso de compilación/build.** HTML/CSS/JS plano. Nada de TypeScript, bundlers, transpiladores ni gestores de paquetes.
5. **Compatibilidad de navegadores.** Debe funcionar en Edge y Chrome recientes (los instalados en la intranet). No usar APIs experimentales.
6. **Idioma del código.** Comentarios y nombres de variables/funciones en **inglés** salvo el contenido visible al usuario (UI) que va en **español**.

---

## 2. STACK TECNOLÓGICO RECOMENDADO (ÚNICO PERMITIDO)

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Marcado | HTML5 semántico | Un solo `index.html` como shell |
| Estilos | CSS3 (variables CSS custom properties) | CSS propio. Prohibido frameworks de UI |
| Lógica | JavaScript ES2020+ clásico (IIFE, namespace global `SGC.*`) | Cero dependencias externas |
| Persistencia local | IndexedDB (wrapper propio, sin librerías) | Para el catálogo pesado (~40MB) y cachés |
| Búsqueda pesada | Web Workers + IndexedDB | Para autocompletado sin congelar UI |
| Persistencia transaccional | Archivos `.json` + `master_index.json` | Ver esquemas en §6 |
| Única librería permitida | Ninguna (todas prohibidas) | Si se agrega una, debe justificarse por escrito y venderse en `/lib` |

**Regla de oro:** si el stack propuesto en un PR/ticket agrega una dependencia, se rechaza salvo autorización explícita.

---

## 3. ESTRUCTURA DE DIRECTORIOS DEL PROYECTO

```
/AppOptimizar
├── index.html
├── css/
│   └── main.css
├── js/
│   ├── core/
│   │   ├── namespaces.js        (definición de SGC.*)
│   │   ├── config.js            (constantes, roles, estados, SLAs por defecto)
│   │   ├── router.js            (navegación entre vistas sin dependencias)
│   │   ├── auth.js              (login lógico + enrutamiento de permisos)
│   │   ├── storage.js           (lectura/escritura de JSON en red vía file://)
│   │   ├── concurrent.js        (optimistic locking)
│   │   ├── audit.js             (log de auditoría inmutable)
│   │   ├── validation.js        (validadores de campos por estado)
│   │   └── utils.js             (helpers puros)
│   ├── catalog/
│   │   ├── db.js                (IndexedDB + seed desde catalogo_incisos.json)
│   │   ├── worker.js            (Web Worker de búsqueda)
│   │   └── search.js            (autocompletado en UI)
│   ├── views/
│   │   ├── login.js
│   │   ├── kanban.js            (tablero)
│   │   ├── expediente.js        (wizard de formularios)
│   │   ├── dashboard.js         (KPIs)
│   │   ├── settings.js          (SLAs)
│   │   └── archive.js           (Archivo Histórico)
│   ├── renders/                 (plantillas de entregables paginados)
│   └── export/
│       ├── markdown.js          (resumen AI-ready)
│       └── modal.js             (advertencia de seguridad)
├── lib/                         (carpeta reservada; quedará vacía)
└── assets/                      (íconos/logo locales únicamente)
```

---

## 4. CONVENCIONES DE CÓDIGO

1. **Namespace único global `SGC`.** Cada archivo es un IIFE que se adhiere: `SGC.core.storage`, `SGC.catalog.search`, etc. Prohibido ensuciar el `window` global.
2. **Naming:** `camelCase` para variables/funciones, `PascalCase` para constructores, `SCREAMING_SNAKE_CASE` para constantes, `kebab-case` para archivos y clases CSS.
3. **`'use strict';`** al inicio de cada IIFE.
4. **Sin dependencias circulares:** `core` no importa de `views`; las vistas consumen `core` vía `SGC.*`.
5. **Una sola responsabilidad por módulo.** Si un archivo supera ~400 líneas, dividirlo.
6. **Manejo de errores obligatorio:** toda operación de I/O sobre la red compartida debe envolverse en try/catch y mostrar mensaje legible al usuario en español.
7. **`Promise` prohibido sobre operaciones de archivos en `file://`.** Usar callbacks o flujo síncrono con bloqueo de UI (spinner) dado que XHR async con relativa puede fallar por CORS; documentar cada decisión en el código.
8. **Accesibilidad (a11y):** etiquetas `<label>`, `aria-*`, foco manejado en el wizard.
9. **No usar emojis en la UI.** Íconos solo como SVG inline o assets locales.
10. **Versionado de esquemas JSON:** cada `datos.json` incluye `schemaVersion`; el código migra versiones viejas, nunca descarta datos.

---

## 5. REGLAS DE ESTADOS Y TRANSICIONES

1. El flujo de los **18 pasos** de FSD §4 se modela como una máquina de estados **config-driven** (definida en `config.js`), jamás hardcodeada en vistas.
2. Cada estado define: `fase`, `rolEjecutor`, `estadosSiguientes`, `estadosDevolucion`, `camposRequeridos`, `entregablesObligatorios`.
3. **Prohibido drag & drop.** Solo botones "Avanzar" y "Devolver por Observación".
4. Toda devolución exige seleccionar un motivo del **Catálogo de Errores cerrado** (array en `config.js`, ampliable en settings).
5. Cada transición dispara `SGC.core.audit.log(...)` **antes** de persistir; el registro es inmutable (ver §7).
6. Alcanzar el estado 18 (Perfeccionada) dispara migración a Archivo Histórico (§8) y purga del `master_index.json`.

---

## 6. ESQUEMAS JSON OBLIGATORIOS

### 6.1 `datos.json` (por expediente, `/Año/###_Expediente/datos.json`)

```json
{
  "schemaVersion": 1,
  "expedienteId": "2026-001",
  "numero": "001",
  "anio": "2026",
  "titulo": "",
  "estadoActual": "ESPECIFICACIONES_TECNICAS",
  "version": 1,
  "ultimaModificacion": "2026-01-01T00:00:00.000Z",
  "ultimoUsuario": "generador",
  "responsables": { "generador": "", "abastecimiento": "", "contrataciones": "", "juridica": "", "contaduria": "" },
  "campos": {},
  "incisos": [],
  "entregables": [],
  "historico": [],
  "sla": { "fechaLimite": null, "asignadoA": "" },
  "auditLog": []
}
```

### 6.2 `master_index.json` (único archivo liviano para el Kanban)

```json
{
  "schemaVersion": 1,
  "generadoEn": "2026-01-01T00:00:00.000Z",
  "expedientes": [
    {
      "id": "2026-001",
      "anio": "2026",
      "titulo": "",
      "estadoActual": "ESPECIFICACIONES_TECNICAS",
      "fase": 1,
      "ultimaModificacion": "2026-01-01T00:00:00.000Z",
      "ultimoUsuario": "generador",
      "fechaLimite": null
    }
  ]
}
```

**Reglas del índice:** solo trámites activos; el Kanban lee ÚNICAMENTE este archivo; NUNCA abre los `datos.json` en masa (el FSD exige no saturar la red).

---

## 7. CONCURRENCIA Y AUDITORÍA (INTEGRIDAD DE DATOS)

1. **Optimistic Locking obligatorio:** antes de escribir `datos.json` se relee el archivo, se compara `version`. Si `version` local ≠ remota → **abortar la escritura**, avisar al usuario "El expediente fue modificado por otro operador" y ofrecer recargar.
2. La escritura de `datos.json` es **atómica por convención**: escribir a un temporal `datos.json.tmp`, luego renombrar (si el FS lo permite) o sobrescribir con confirmación.
3. **`auditLog` inmutable:** array de objetos `{ timestamp, usuario, rol, accion, de, a, detalle, hashPrevio }`. El `hashPrevio` es el hash del objeto previo (función `hash` propia, p.ej. simple checksum determinista — NO criptográfico, no es necesario para el air-gap).
4. El `historico` almacena snapshots completos del estado en cada transición para permitir comparativas y recuperación.

---

## 8. ARCHIVO HISTÓRICO (COLD STORAGE)

1. Directorio de solo lectura: `/ArchivoHistorico/###_Expediente/`.
2. Al perfeccionar: copiar todos los archivos del expediente, marcar la copia como de solo lectura (permissions de Windows), purgar del `master_index.json` y marcar el expediente local como "archivado" (no borrar sin confirmación).
3. El listado del histórico se construye leyendo el directorio, no el índice.

---

## 9. CATÁLOGO (INDEXEDDB) Y BÚSQUEDA

1. **Seed único:** al primer inicio se carga `catalogo_incisos.json` (aprox. 40MB) a IndexedDB. Mostrar barra de progreso. El archivo se ubica en la raíz de `/AppOptimizar` y NO se elimina.
2. Almacén: object store `incisos` indexado por `codigo`, `rubro`, `clase`, `item` (multi-entry).
3. La búsqueda se ejecuta en un **Web Worker** para no bloquear la UI; los resultados se muestran por autocompletado con resaltado del término.
4. Si IndexedDB no está disponible o el seed falla, degradar a búsqueda lineal sobre el JSON (con advertencia de rendimiento).

---

## 10. LOGIN LÓGICO Y SEGURIDAD

1. **Login lógico de frontend** (rol del FSD §3). Los roles: `generador`, `abastecimiento`, `abastecimiento_supervisor`, `contrataciones`, `contrataciones_supervisor`, `juridica`, `contaduria`.
2. Almacenar sesión en `sessionStorage` (nunca en `localStorage`; limpiar al cerrar pestaña).
3. El enrutador de permisos bloquea las acciones de avance/retroceso fuera del rol, **pero la vista global del tablero se mantiene para todos**.
4. Ningún secreto ni hash se persiste en disco; el login es nominal (PC custodiada = confianza en la capa de Windows).
5. Todo modal/acciones destructivas exigen confirmación explícita (botón con texto descriptivo, no solo "Aceptar").

---

## 11. UI/UX OBLIGATORIA

1. **Wizard de onboarding** para los campos de inicio: un paso por grupo de campos, validación estricta antes de permitir el entregable.
2. **Borrador local:** la Fase 1 admite guardado local (sessionStorage) con sub-estado "Borrador" antes de persistir a la red.
3. **Kanban:** columnas por estado, tarjetas desde `master_index.json`, badges de vencimiento (SLA) por color.
4. **Dashboard de KPIs:** tiempos de trámite, tasas de fracaso y estadísticas del Catálogo de Errores; todo calculado desde los índices/snapshots, nunca de un servidor.
5. **Deliverables:** los entregables (pliego, disposición, OC, etc.) se generan como HTML paginado imprimible o Markdown, dentro de la carpeta del expediente y enlazados en la tarjeta.

---

## 12. EXPORTACIÓN AI-READY

1. Botón "Exportar JSON" en cada expediente: descarga el `datos.json` crudo.
2. Automáticamente se genera un **`resumen.md`** narrativo de los hitos del expediente (quién hizo qué y cuándo) a partir del `auditLog` y el `historico`.
3. Toda exportación dispara el **Modal de Advertencia** de FSD §6 obligatorio antes de descargar (responsabilidad del manejo de datos sensibles).

---

## 13. DEFINICIÓN DE "HECHO" (DONE) PARA CADA TICKET

Un ticket de código se considera terminado SOLO si:
- Cumple los 12 principios de §1 y el stack de §2 (sin dependencias nuevas).
- Funciona abriendo `index.html` vía `file://` en Edge y Chrome sin consola de errores.
- Los esquemas JSON respetan §6 y los campos nuevos son opcionales para versiones viejas (`schemaVersion`).
- Las transiciones de estado pasan por `config.js` y quedan auditadas en `auditLog`.
- El flujo de concurrencia (§7) está cubierto al menos en la transición más crítica.
- La UI está en español y el código comentado en inglés.

---

## 14. PROHIBICIONES EXPLÍCITAS

- Frameworks de UI (React, Vue, Angular, Svelte, Bootstrap, Tailwind...).
- Librerías de terceros sin vendering local.
- `fetch`, `axios`, `WebSocket`, `Service Worker` (no funcionan de forma fiable en `file://`), Google Fonts, CDN de cualquier tipo.
- `type="module"`, `import`/`export` en scripts.
- Drag & drop libre para estados.
- Escritura directa sobre archivos sin pasar por `SGC.core.storage` + `concurrent.js`.
- Borrado de datos sin confirmación ni paso previo por Archivo Histórico.
- Cualquier dependencia del reloj del sistema para valores críticos de integridad (usar siempre timestamp en UTC + comparación de `version`).
