# AUDITORÍA CRÍTICA — `InstruccionesCodigo.md`

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Documento auditado: `Contrataciones/InstruccionesCodigo.md` (12.873 bytes, mtime 2026-08-12)
Fecha de auditoría: 2026-08-13
Veredicto: **NO APTO COMO DOCUMENTO VINCULANTE EN SU ESTADO ACTUAL.** Contiene decisiones de alto valor que hay que conservar, y una contradicción arquitectónica raíz (§1.3) que invalida cerca del 40% de su articulado.

---

## 1. Lo que está bien (conservar sin cambios)

| § | Regla | Por qué es correcta |
|---|-------|---------------------|
| 5.1 – 5.2 | Máquina de estados **config-driven** en `config.js`, nunca hardcodeada en vistas | Los 18 pasos son política administrativa, no lógica de software. Van a cambiar. Es la decisión de mayor valor de todo el documento. |
| 5.3 – 5.4 | Sin drag & drop libre; devolución exige motivo de catálogo cerrado | Sin esto, el KPI de "tasa de fracaso" del FSD §6 no tiene fuente de datos. La restricción de UX **es** el requisito de datos. |
| 4.10 | `schemaVersion` con migración hacia adelante, nunca descarte | Correcto para un sistema que va a evolucionar sobre expedientes ya en trámite. |
| 1.3 (parcial) | Prohibir `<script type="module">` bajo `file://` | Único punto técnicamente correcto de toda la línea argumental de `file://`. |
| 10.2 | Sesión en `sessionStorage`, no `localStorage` | Correcto en PCs compartidas por turnos. |
| 10.4 | El login es **nominal**; la seguridad real es NTFS/Windows | Honestidad poco frecuente. Evita construir seguridad de juguete y creerle. |
| 4.1 – 4.5 | Namespace único, sin dependencias circulares, ~400 líneas por archivo, `'use strict'` | Higiene estándar, bien aplicada. |
| 4.8 | Accesibilidad explícita (`<label>`, `aria-*`, foco en el wizard) | Requisito real en organismos públicos, normalmente olvidado. |
| 12.3 | Modal de advertencia obligatorio antes de exportar | Barato de implementar, alto valor de cumplimiento. |

---

## 2. Defectos bloqueantes

### A. `file://` no hace la app difícil: la hace imposible

§1.3 es el error raíz. Contamina §4.7, §9 y §14.

1. **Lectura.** Un documento con origen `file://` tiene **origen opaco (`null`)** en Chromium. `fetch` **y** `XMLHttpRequest` hacia archivos vecinos están bloqueados desde Chrome 68. El documento afirma que XHR es el workaround del bloqueo de `fetch`: es **falso**, XHR está sujeto a la misma política de origen. Sin el flag de arranque `--allow-file-access-from-files` (insostenible en PCs gestionadas por Informática), la app **no puede leer** `master_index.json`.
2. **Workers.** `new Worker('worker.js')` falla desde `file://` por la misma razón. §9.3 (búsqueda en Web Worker) es **incompatible con §1.3**: el documento se contradice a sí mismo.
3. **IndexedDB.** Bajo `file://` es, en el mejor caso, un almacén compartido por todas las páginas locales de esa PC y purgable sin aviso; Firefox lo bloquea de plano. Apostar un seed de 40 MB ahí es frágil.
4. **Escritura — el punto decisivo.** Un navegador **no puede escribir un archivo en una ruta arbitraria del disco o de un recurso de red**. No existe la API. Todo §6, §7 (optimistic locking, escribir `.tmp` y renombrar) y §8 (copiar carpeta y marcarla de solo lectura) describen operaciones de sistema de archivos que el navegador no expone. La única API que se aproxima es **File System Access** (`showDirectoryPicker`), que exige *secure context* y por lo tanto **no funciona precisamente en `file://`**.

> **Síntesis:** el documento redacta una especificación de backend y en el mismo texto prohíbe el backend. No es un detalle de implementación; es el eje del proyecto.

**Corrección:** ver ADR-001 y ADR-002 en `BITACORA_DECISIONES.md`. El núcleo de dominio se escribe agnóstico de persistencia y se accede por un adaptador intercambiable; el adaptador por defecto habla con un servidor local mínimo que corre igual en la PC de desarrollo y en el servidor de intranet.

### B. `master_index.json` es un punto único de contención de escritura

Cada avance de estado de cualquier operador reescribe el mismo archivo. Sobre SMB, sin lock, dos guardados simultáneos producen *lost update*, y lo que se pierde no es un expediente sino **el índice completo del tablero**. Agravante: es el archivo **menos** protegido del diseño, porque el optimistic locking de §7 solo cubre `datos.json`.

**Corrección:** índice fragmentado — un `idx/2026-001.json` de ~300 bytes por expediente, cuyas escrituras nunca colisionan entre operadores distintos. El Kanban arma el tablero listando ese directorio. Ver ADR-005.

### C. El "`auditLog` inmutable" con checksum no criptográfico es autoengaño

§7.3 pide un `hashPrevio` con "checksum determinista, no criptográfico, no es necesario para el air-gap". El archivo vive en una carpeta donde los propios operadores necesitan permiso de escritura; cualquiera lo abre con Notepad y un checksum determinista y público se recalcula trivialmente.

**Corrección:** llamar a las cosas por su nombre. Hash encadenado que detecta **edición casual o corrupción**, y nada más. Inmutabilidad real exige append-only del lado del servidor o ACL NTFS de solo-anexar sobre el directorio de auditoría. Ver ADR-006.

### D. `historico` con snapshots completos dentro del mismo `datos.json`

§7.4 guarda un snapshot completo del expediente por cada transición, en el mismo archivo. 18 transiciones × snapshot completo = crecimiento cuadrático, y el optimistic locking de §7.1 obliga a **releer el archivo entero en cada guardado**. Con los renglones del catálogo adentro, el costo se dispara.

**Corrección:** snapshots en archivos separados (`hist/v03.json`) o almacenados como diff. `datos.json` se mantiene chico y de lectura barata.

### E. §4.7 "`Promise` prohibido" + XHR síncrono es consejo dañino

IndexedDB, File System Access y los Workers son inherentemente asíncronos y devuelven promesas de todos modos: prohibirlas obliga a envolver en callbacks APIs que ya son promesas, agregando código y bugs. El XHR síncrono está deprecado y congela la pestaña completa, incluido el spinner que el propio documento pide mostrar.

**Corrección:** la regla correcta no es "sin Promises". Es **"sin `import`/`export` y sin `top-level await`"**, que es el problema real de compatibilidad que se estaba intentando describir.

### F. El seed de 40 MB a IndexedDB resuelve un problema que no existe

Medición real de `DataBaseITEMs/catalogo_incisos.json`:

| Métrica | Valor |
|---|---|
| Registros | 159.366 |
| Tamaño original | 40,2 MB |
| Minificado | 34,5 MB |
| **Comprimido (gzip -9)** | **2,5 MB** |
| Rubros distintos | 50 |
| Pares rubro/clase distintos | 6.908 |
| Ítems por clase (promedio) | ~23 |
| Longitud promedio del campo `item` | 104 caracteres |
| Estados distintos | 1 (`Activo` en el 100% de los registros) |

El catálogo tiene una jerarquía natural **rubro (50) → clase (6.908) → ítem (~23)**. El índice completo de rubros + clases pesa unos 200 KB. Con un selector en cascada y carga perezosa del *shard* de la clase (~25 KB), el operador **nunca descarga 40 MB**, no hace falta Web Worker y IndexedDB deja de ser requisito de arquitectura para pasar a caché opcional.

Esto elimina de un solo golpe tres de las restricciones más caras del documento (§9.1, §9.3 y la mitad de §2). Ver ADR-004.

Observación adicional: el campo `estado` es constante (`Activo`) en los 159.366 registros. O el catálogo ya viene filtrado, o el dato es inútil. Hay que confirmarlo con el origen antes de construir lógica sobre ese campo.

### G. Omisiones de un documento que se declara "VINCULANTE"

1. **Asignación del número de expediente.** Nada impide que dos usuarios tomen el `2026-047` simultáneamente. Es la operación que **más** necesita serialización y no está mencionada.
2. **Carpeta de red caída o sin permisos.** No hay comportamiento definido. §4.6 pide try/catch, pero no una política (¿trabajo offline en borrador? ¿bloqueo total?).
3. **Backup y restauración.** Ausente. Sobre archivos planos es *la* política crítica.
4. **Testing.** No hay una sola línea. §13 "Definición de Hecho" pide "sin errores en consola", que no es un criterio de aceptación verificable.
5. **Migración de expedientes en curso** al momento del despliegue.

### H. Menor — idioma del código (§1.6)

El dominio es intraducible sin pérdida: *expediente*, *pliego*, *inciso*, *renglón*, *dictamen*, *diligencia*, *afectación*. Traducirlos produce código peor y ambigüedad (`file`, `record`, `item` ya significan otra cosa).

**Corrección propuesta:** sustantivos de dominio en español (`expediente`, `renglon`, `pliego`), vocabulario técnico en inglés (`repository`, `handler`, `parse`, `cache`). Ver ADR-007.

---

## 3. Tabla de correcciones puntuales (para redactar `InstruccionesCodigo_v2.md` en H1)

| § original | Estado | Acción |
|---|---|---|
| 1.1 sin BD SQL | Conservar | Válido para la escala medida (<10 usuarios, <100 exp/año). |
| 1.2 air-gapped, sin CDN | Conservar | Regla correcta y verificable. |
| **1.3 `file://` + XHR síncrono** | **Eliminar** | Reemplazar por: la app se sirve por HTTP(S); persistencia vía adaptador (ADR-002). |
| 1.4 sin build | Ablandar | Sin bundler ni transpilador en el **runtime**; se admiten scripts Node de *build* del catálogo, que no se despliegan. |
| 1.5 Edge/Chrome | Conservar | Agregar: fijar versión mínima verificada en H0. |
| 1.6 código en inglés | Modificar | Ver ADR-007. |
| 2 stack | Conservar con nota | Agregar Node.js (solo stdlib) como runtime del servidor y de las herramientas de build/test. |
| 3 estructura de directorios | Reescribir | Debe reflejar `core/` agnóstico + `adapters/` + `server/` + `tests/` + `tools/`. |
| 4.7 sin Promises | **Eliminar** | Reemplazar por: sin `import`/`export`, sin `top-level await`, sin XHR síncrono. |
| 5 estados | Conservar | Es lo mejor del documento. |
| 6.2 `master_index.json` | Reemplazar | Índice fragmentado (ADR-005). |
| 7.1 optimistic locking en cliente | Mover | La verificación de versión se hace del lado del servidor, que es el único punto donde puede ser atómica. |
| 7.3 hash "inmutable" | Reformular | Hash encadenado anti-edición-casual, declarado como tal (ADR-006). |
| 7.4 snapshots en línea | Modificar | Snapshots en archivos aparte. |
| 8 cold storage | Conservar | La ejecución la hace el servidor, no el navegador. |
| 9 catálogo | Reescribir | Shards en cascada (ADR-004); IndexedDB opcional. |
| 10 login lógico | Conservar | Agregar: registrar usuario de Windows si el servidor puede exponerlo. |
| 11 UI/UX | Conservar | Agregar: agrupar los 18 estados en las 10 fases del FSD para el Kanban; 18 columnas es inusable. |
| 12 export AI-ready | Conservar | — |
| **13 Definición de Hecho** | **Reescribir** | Debe exigir tests que pasan (ver `PLAN_DESARROLLO.md` §Testing). |
| 14 prohibiciones | Depurar | Quitar `fetch` y Web Workers de la lista de prohibidos: con la app servida por HTTP son legítimos y necesarios. |
