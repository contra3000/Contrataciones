# BITÁCORA DE DECISIONES — SGC

Registro de decisiones de arquitectura (formato ADR liviano). **Append-only:** una decisión superada no se borra; se marca `Superada por ADR-NNN` y se agrega la nueva al final.

Estados posibles: `Propuesta` · `Aceptada` · `Superada` · `Rechazada`
Plantilla al final del archivo.

| ADR | Título | Estado | Fecha |
|-----|--------|--------|-------|
| 001 | Rechazo del supuesto `file://` | Aceptada | 2026-08-13 |
| 002 | Núcleo agnóstico + adaptador de persistencia intercambiable | Aceptada | 2026-08-13 |
| 003 | Servidor mínimo en Node.js sin dependencias | **Aceptada** (por ADR-035) | 2026-08-13 |
| 004 | Catálogo servido en shards jerárquicos, no seed de 40 MB | Aceptada | 2026-08-13 |
| 005 | Índice fragmentado en lugar de `master_index.json` | Aceptada | 2026-08-13 |
| 006 | Auditoría con hash encadenado declarado como anti-manipulación casual | Aceptada | 2026-08-13 |
| 007 | Idioma del código: dominio en español, técnico en inglés | Aceptada | 2026-08-13 |
| 008 | Escala asumida del sistema | Aceptada | 2026-08-13 |
| 009 | Numeración de expedientes serializada por el servidor | Aceptada | 2026-08-13 |
| 010 | Kanban agrupado por fase, no por estado | Propuesta | 2026-08-13 |
| 011 | Línea base permanente: Chrome/Edge 109 (Windows 7) | Aceptada | 2026-08-13 |
| 012 | Entregables en PDF para el sistema de firmas | Aceptada (verificada) | 2026-08-13 |
| 013 | SLA fuera del alcance de la v1 | Aceptada | 2026-08-13 |
| 014 | Catálogo cerrado; se descarta el campo `estado` | Aceptada | 2026-08-13 |
| 015 | Ningún operador escribe sobre la carpeta de datos | **Aceptada** (por ADR-035) | 2026-08-13 |
| 016 | La app no custodia documentos firmados | Aceptada | 2026-08-13 |
| 017 | Identidad basada en el correo institucional, no en Windows | Aceptada | 2026-08-13 |
| 018 | El scraper del catálogo es infraestructura del proyecto | Aceptada | 2026-08-13 |
| 019 | Esquema de `datos.json` v2: `estado` como objeto y `auditoria` como registro | Aceptada | 2026-08-14 |
| 020 | Índice del catálogo en formato compacto | Aceptada | 2026-08-14 |
| 021 | El servidor autoriza las transiciones; el cliente sólo declara la intención | Aceptada | 2026-08-18 |
| 022 | Modelo de datos del requerimiento real (Solicitud de Gastos) | Aceptada | 2026-08-19 |
| 023 | Frontera: la aplicación no autoriza nada; el servidor sólo controla el acceso | Aceptada | 2026-08-20 |
| 024 | Registro de eventos amplio; los indicadores se eligen después | Aceptada | 2026-08-20 |
| 025 | Un expediente perfeccionado puede usarse como plantilla de uno nuevo | Aceptada | 2026-08-20 |
| 026 | Identidad y marcado de autoría de la aplicación | Propuesta | 2026-08-20 |
| 027 | Credenciales artesanales: una clave por operador, definida por el Jefe | Aceptada | 2026-08-21 |
| 028 | Consolidación de pedidos por área, como paso previo al requerimiento | Propuesta (V2) | 2026-08-21 |
| 029 | Una dependencia que falta falla ruidosamente; nunca apaga una regla en silencio | Aceptada | 2026-08-21 |
| 030 | Hay un solo pliego, y no lo produce esta aplicación | Aceptada | 2026-08-25 |
| 031 | El emisor de YAML entrecomilla por defecto | Aceptada | 2026-08-25 |
| 032 | Las plantillas del pliego viven en la aplicación, versionadas, con selección declarativa | Aceptada | 2026-08-26 |
| 033 | Los supervisores heredan lo que pueden hacer sus supervisados | Aceptada | 2026-08-28 |
| 034 | Entrega, primer ingreso y reposición de claves | Aceptada | 2026-08-28 |
| 035 | Destino de despliegue: máquina virtual Debian con el proceso propio y los datos en su disco | Aceptada | 2026-08-29 |
| 036 | Nada se decide en el arranque: lo que se puede resolver al usarlo, se resuelve al usarlo | Aceptada | 2026-08-31 |

*(ADR-012 pasó a Aceptada en la ronda 2; el circuito de firma es manual y sin retorno.)*

---

## ADR-001 — Rechazo del supuesto `file://`

**Estado:** Aceptada · 2026-08-13

**Contexto.** `InstruccionesCodigo.md` §1.3 exige que la app funcione abriendo `index.html` con doble clic (protocolo `file://`), y al mismo tiempo §6/§7/§8 exigen leer y escribir archivos JSON en una carpeta de red, con escritura atómica, renombrado de temporales y cambio de permisos.

**Decisión.** Se descarta `file://` como modo de ejecución. La app se sirve siempre por HTTP(S), en desarrollo desde `localhost` y en producción desde el servidor de intranet.

**Fundamento.**
- Bajo `file://` el origen es opaco (`null`): `fetch` y `XMLHttpRequest` hacia archivos vecinos están bloqueados en Chromium desde la versión 68; `new Worker()` falla; IndexedDB es un almacén compartido y purgable.
- Ningún navegador puede escribir en una ruta arbitraria del filesystem. La única API que se aproxima (File System Access) requiere *secure context*, que `file://` no provee.
- En consecuencia, §1.3 y §6/§7/§8 son mutuamente excluyentes: no existe implementación que satisfaga ambas.

**Consecuencias.** Se agrega una dependencia de despliegue (un servidor que sirva estáticos). Se habilitan, a cambio, `fetch`, Web Workers, compresión gzip en tránsito y control de concurrencia real. Quedan sin efecto las prohibiciones de §14 sobre `fetch` y Service Workers.

---

## ADR-002 — Núcleo agnóstico + adaptador de persistencia intercambiable

**Estado:** Aceptada · 2026-08-13

**Contexto.** Al 2026-08-13 no está confirmado qué puede alojar el servidor de intranet (IIS/Apache/estáticos puros, con o sin autorización para correr un proceso propio). El desarrollo no puede quedar bloqueado esperando esa respuesta.

**Decisión.** Todo acceso a datos pasa por una única interfaz `SGC.core.repo`, con implementaciones intercambiables sin tocar el dominio ni las vistas:

```
listarIndice()                      → [{id, titulo, estado, fase, fechaLimite, ...}]
leerExpediente(id)                  → {doc, version}
guardarExpediente(id, doc, version) → {ok, version} | {conflicto, versionRemota}
crearExpediente(datosIniciales)     → {id, version}   // numeración serializada, ver ADR-009
listarArchivoHistorico(filtros)     → [...]
archivar(id)                        → {ok}
guardarEntregable(id, nombre, blob) → {ruta}
```

Adaptadores previstos:

| Adaptador | Escenario de destino | Estado |
|---|---|---|
| `repo.memoria.js` | Tests unitarios y fixtures | Obligatorio |
| `repo.http.js` | Servidor propio (ADR-003) — **default** | Obligatorio |
| `repo.fsa.js` | Servidor estático puro + File System Access API sobre carpeta de red mapeada. Requiere HTTPS y Edge/Chrome | Contingencia |
| `repo.iis.js` / `repo.php.js` | El servidor ya expone scripting server-side | Contingencia |

**Fundamento.** La incógnita de infraestructura se aísla detrás de una frontera de ~8 funciones. Cambiar de escenario cuesta un archivo, no un rediseño.

**Consecuencias.** El dominio no puede asumir escritura síncrona ni acceso a rutas. Toda la interfaz es asincrónica (Promises), lo que refuerza la eliminación de §4.7 del documento original.

---

## ADR-003 — Servidor mínimo en Node.js sin dependencias

**Estado:** Propuesta (se confirma al cerrar H0) · 2026-08-13

> **Aceptada el 2026-08-29 por ADR-035.** Informática autorizó una **máquina virtual Debian 12** sobre el Proxmox de la unidad. El servidor propio deja de ser una propuesta: es el destino de despliegue confirmado.

**Contexto.** Se necesita algo que corra idéntico en la PC de desarrollo y en el servidor de intranet, y que sea el único punto capaz de garantizar atomicidad y serialización.

**Decisión propuesta.** Un servidor de ~300 líneas sobre `node:http` y `node:fs`, **sin una sola dependencia de npm**, que: sirve los estáticos de la app, expone la API de `repo`, escribe con patrón `tmp + rename` (atómico en NTFS), valida la versión del documento antes de sobrescribir y serializa la asignación de números de expediente.

**Fundamento.**
- Node sin dependencias = un solo ejecutable y una carpeta de archivos `.js` legibles. Es lo más auditable que se le puede presentar a Informática en un organismo, y elimina la superficie de riesgo de npm.
- Es el único lugar donde el control de concurrencia puede ser correcto: en el cliente siempre es una carrera TOCTOU.
- Ejecutable como servicio de Windows, como tarea programada o a mano con un `.bat`, según lo que se autorice.

**Alternativas consideradas.** (a) Solo estáticos + File System Access API: viable, pero exige HTTPS, un gesto de usuario para conceder la carpeta en cada PC, y no puede serializar la numeración. Queda como contingencia. (b) PHP/ASP: mejor si ya existe el motor; el adaptador es equivalente en esfuerzo.

**Pendiente de validación.** H0-3: ¿se autoriza correr un proceso propio y en qué equipo?

---

## ADR-004 — Catálogo servido en shards jerárquicos

**Estado:** Aceptada · 2026-08-13

**Contexto.** `InstruccionesCodigo.md` §9 ordenaba cargar los 40 MB del catálogo en IndexedDB en el primer inicio, con Web Worker para no congelar la UI.

**Decisión.** Un script de build (`tools/build-catalogo.js`, se ejecuta una vez por actualización del catálogo, no en runtime) transforma `catalogo_incisos.json` en:

- `catalogo/rubros.json` — 50 entradas, ~2 KB
- `catalogo/clases.json` — 6.908 entradas (rubro, clase, cantidad, id de shard), ~200 KB
- `catalogo/items/<idClase>.json` — ~23 ítems por archivo, ~25 KB promedio
- `catalogo/tokens.json` — índice invertido de términos sobre `clase` para la búsqueda libre

La UI hace: buscar/elegir clase (sobre ~200 KB ya en memoria) → cargar el shard de esa clase → elegir ítem.

**Fundamento.** Medición sobre el archivo real: 159.366 registros, 34,5 MB minificado, **2,5 MB en gzip**, jerarquía rubro (50) → clase (6.908) → ítem (~23). El operador nunca necesita el catálogo entero: necesita los 23 ítems de la clase que está buscando. IndexedDB y Web Workers dejan de ser requisitos de arquitectura.

**Consecuencias.** IndexedDB queda como caché opcional de los shards ya visitados (optimización de H4, no requisito). El catálogo pasa a ser contenido estático versionado, actualizable reemplazando una carpeta.

---

## ADR-005 — Índice fragmentado en lugar de `master_index.json`

**Estado:** Aceptada · 2026-08-13

**Contexto.** §6.2 definía un único `master_index.json` que el Kanban lee y que se reescribe en cada transición de cualquier operador.

**Decisión.** Un archivo liviano por expediente en `idx/<id>.json` (~300 bytes). El tablero se arma listando ese directorio. Se admite un `master_index.json` **derivado y cacheado** que el servidor regenera, nunca como fuente de verdad.

**Fundamento.** Escritura concurrente sobre un archivo único = *lost update* garantizado a mediano plazo, y la pérdida no es de un expediente sino del índice completo. Con la escala estimada (<100 expedientes/año, ADR-008), listar 100 archivos de 300 bytes es instantáneo y las escrituras de operadores distintos jamás colisionan.

---

## ADR-006 — Auditoría con hash encadenado, declarado como anti-manipulación casual

**Estado:** Aceptada · 2026-08-13

**Contexto.** §7.3 hablaba de un `auditLog` "inmutable" protegido por un checksum determinista no criptográfico.

**Decisión.** Se implementa hash encadenado (cada entrada incluye el hash de la anterior) y se documenta explícitamente su alcance: **detecta edición casual y corrupción; no resiste manipulación deliberada**. Si más adelante se requiere no repudio, se agrega escritura append-only del lado del servidor y ACL NTFS de solo-anexar sobre `audit/`.

**Fundamento.** Los operadores necesitan permiso de escritura sobre la carpeta; cualquiera puede abrir el JSON con Notepad y un checksum público se recalcula trivialmente. Documentar una garantía que no existe es peor que no tenerla, porque induce a confiar en ella en una discusión disciplinaria.

**Actualización 2026-08-13 (ronda 3).** Con ADR-015 aplicada (ningún operador escribe la carpeta), la parte de *integridad del archivo* mejora sustancialmente: ya nadie puede editar el JSON a mano. Pero H0-2.5 introduce el límite del otro lado: con cuentas de Windows compartidas y sin contraseña, **el sistema no puede probar quién ejecutó una acción**, sólo qué rol se declaró y desde qué máquina (ADR-017). La formulación honesta de la garantía queda: *el registro no puede ser alterado después de escrito, pero la identidad de quien lo originó es declarada, no verificada.* Esa frase, o una equivalente, debe aparecer en la interfaz y en el `resumen.md` exportado.

---

## ADR-007 — Idioma del código

**Estado:** Aceptada · 2026-08-13 · *Reemplaza §1.6 del documento original*

**Decisión.** Sustantivos y verbos de dominio en español (`expediente`, `renglon`, `pliego`, `dictamen`, `avanzarEstado`, `devolverPorObservacion`); vocabulario técnico y de infraestructura en inglés (`repository`, `handler`, `parse`, `cache`, `retry`). Comentarios en español. UI en español.

**Fundamento.** El dominio es intraducible sin pérdida y sin colisiones (`file`, `record`, `item` ya significan otra cosa en el código). Un glosario mixto consistente es más legible que una traducción forzada, y sobre todo es más legible para quien mantenga esto en la División después.

---

## ADR-008 — Escala asumida

**Estado:** Aceptada · 2026-08-13

**Decisión.** Se dimensiona para **menos de 10 usuarios concurrentes y menos de 100 expedientes por año** (dato aportado por el usuario el 2026-08-13).

**Consecuencias.** Los archivos JSON planos sobre carpeta de red son adecuados; no se justifica una base de datos. Si la escala superara los 500 expedientes/año o los 30 usuarios, esta decisión debe revisarse — el disparador se registra aquí para que el hallazgo futuro no se discuta desde cero.

---

## ADR-009 — Numeración de expedientes serializada por el servidor

**Estado:** Aceptada · 2026-08-13

**Contexto.** Omisión del documento original: nada impide que dos usuarios tomen el número `2026-047` simultáneamente.

**Decisión.** El número lo asigna exclusivamente el backend (`crearExpediente`), bajo un lock de archivo (`contador.lock` + `contador.json`), nunca el cliente. Con el adaptador de contingencia `repo.fsa.js`, que no puede serializar, se degrada a números provisorios `TMP-<usuario>-<timestamp>` con reconciliación manual, y se documenta como limitación conocida de ese escenario.

---

## ADR-010 — Kanban agrupado por fase

**Estado:** Propuesta · 2026-08-13

**Contexto.** El FSD §4 define 18 estados. §11.3 pide "columnas por estado".

**Decisión propuesta.** El tablero muestra las **10 fases** del FSD como columnas, con el estado puntual como badge dentro de la tarjeta y un filtro por estado. 18 columnas exigen scroll horizontal permanente y destruyen la "conciencia situacional" que el FSD §1 pone como objetivo.

**Pendiente.** Validar con los operadores durante el UAT de H9.

---

## ADR-011 — Línea base permanente: Chrome/Edge 109 sobre Windows 7

**Estado:** Aceptada · 2026-08-13

**Contexto.** Relevamiento H0-2.1: las PCs de los operadores corren **109.0.5414.120, cohort Windows 7**. La 109 es la última versión que Chrome y Edge publicaron para Windows 7/8.1 (enero de 2023). Los usuarios no pueden instalar software ni cambiar flags (H0-2.2). Esas máquinas **no van a recibir otra actualización de navegador**, salvo recambio de parque.

**Decisión.** Chrome/Edge **109** es la línea base de compatibilidad, y se trata como techo permanente, no como un mínimo transitorio. Se prohíbe toda API posterior. La verificación se automatiza: un test de H1 falla el build si aparece alguna de las construcciones vetadas.

**Lista de veto (posteriores a 109, no usar):**

| Área | Prohibido | Disponible desde | Reemplazo |
|---|---|---|---|
| JS | `Array.prototype.toSorted` / `toSpliced` / `with` | Chrome 110 | `[...arr].sort()` |
| JS | `Object.groupBy` / `Map.groupBy` | Chrome 117 | `reduce` propio |
| JS | `Promise.withResolvers` | Chrome 119 | constructor clásico |
| JS | `RegExp` flag `v` | Chrome 112 | flag `u` |
| CSS | Anidamiento nativo (`&`) | Chrome 112 | selectores planos |
| CSS | `text-wrap: balance` | Chrome 114 | — |
| CSS | `:user-valid` / `:user-invalid` | Chrome 119 | clases propias |
| HTML | Atributo `popover` | Chrome 114 | `<dialog>` (disponible) |
| FS Access | `FileSystemHandle.move()` / `.remove()` | Chrome 111 / 110 | no hay |
| FS Access | Permisos persistentes entre sesiones | Chrome 122 | no hay |

**Sí disponible en 109 y utilizable:** `fetch`, Web Workers, IndexedDB, `<dialog>`, `:has()`, `@container`, `structuredClone`, `Array.at` / `findLast`, `Object.hasOwn`, `CompressionStream`, File System Access básico (`showDirectoryPicker`, `createWritable`).

**Consecuencias.**
1. Descarta en la práctica el adaptador de contingencia `repo.fsa.js` como solución de producción: sin permisos persistentes (Chrome 122), **cada operador tendría que volver a elegir la carpeta de red a mano en cada sesión**, y sin `move()` no hay escritura atómica por renombrado. Queda sólo como último recurso degradado. Refuerza ADR-003.
2. Las PCs son de la época de Windows 7: hay que asumir hardware modesto. Refuerza ADR-004 (nunca cargar el catálogo entero en memoria).
3. Windows 7 llegó a fin de soporte extendido en enero de 2020. Es un dato para elevar por separado; no bloquea este proyecto, pero conviene que quede escrito.

---

## ADR-012 — Entregables en PDF para el sistema de firmas

**Estado:** **Aceptada** · 2026-08-13 (confirmada en la ronda 2: la carga al sistema de firmas es manual)

**Contexto.** H0-5.3 corrigió el alcance: la app no se integra con COMPR.AR ni SIU. Su salida son (a) **documentos listos para firmar, en PDF o imagen**, para un sistema de firmas existente, y (b) JSON para ingesta por LLMs. `InstruccionesCodigo.md` §11.5 asumía "HTML paginado imprimible", que no es lo mismo que un PDF.

**Decisión propuesta — dos etapas.**
- **v1:** el documento se compone en HTML con hoja de estilos de impresión y se convierte con **Imprimir → Guardar como PDF** del propio navegador. Cero dependencias, tipografía y paginación fieles, funciona en Chrome 109, y el resultado es un PDF real con texto seleccionable.
- **v2 (sólo si hace falta):** librería PDF vendida localmente en `/lib`, para generar el archivo sin intervención del usuario y depositarlo en la carpeta del expediente. Se evalúa recién si 5.6 demuestra que el sistema de firmas exige ingesta automática desde una carpeta.

**Fundamento.** La conversión por navegador no agrega dependencias, no agrega superficie de auditoría y produce mejor tipografía que cualquier librería JS con el mismo esfuerzo. Su costo es un clic del usuario y que el archivo cae en Descargas, no en la carpeta del expediente. Si el flujo real es "el operador sube el PDF al sistema de firmas", ese costo es cero, porque lo va a subir a mano de todas formas.

**Confirmado (ronda 2).** El operador sube el PDF a mano al sistema de firmas, y el documento **firmado no vuelve** a la app: queda en el sistema de firmas. En consecuencia:
- La v2 (librería PDF vendida) **queda descartada del alcance**. `Imprimir → Guardar como PDF` es suficiente y definitivo.
- La app guarda el documento **generado** (previo a la firma) en la carpeta del expediente, más una referencia al documento firmado (identificador o fecha), nunca el archivo firmado en sí.
- **Consecuencia a asumir explícitamente:** la carpeta del expediente **no** es el archivo legal completo. Es el registro del proceso, no el repositorio de instrumentos firmados. Conviene decirlo en la UI, para que nadie confunda una cosa con la otra en una auditoría.

**Verificado el 2026-08-13:** el sistema de firmas acepta PDF generado por el navegador — **es la mecánica que la División ya usa a diario**. La ADR queda cerrada, sin pendientes, y con la ventaja de que el circuito de firma no le cambia el hábito a nadie: sólo cambia de dónde sale el documento.

---

## ADR-013 — SLA fuera del alcance de la v1

**Estado:** Aceptada · 2026-08-13

**Contexto.** El FSD §6 pide gestión de vencimientos. H0-5.2: la norma con los plazos existe, pero el usuario decide no incorporarla ahora — "si funciona esto, tal vez en el futuro; este sistema tiene que ser rápido, ágil y práctico".

**Decisión.** La v1 no implementa motor de SLA, ni semáforos de vencimiento, ni alertas. Se conserva **un solo campo opcional de fecha límite** por expediente, editable a mano, y se **registra desde el día uno el timestamp de cada transición** en la auditoría.

**Fundamento.** Los timestamps son el insumo del futuro motor de SLA y cuestan cero (la auditoría ya los guarda). Si no se registran ahora, cuando se quiera activar SLA no habrá historia con la cual calibrar los plazos. Se difiere la funcionalidad, no el dato.

**Consecuencias.** Se simplifican H6 (sin badges de vencimiento) y H8 (sin tablero de cumplimiento). El dashboard de la v1 mide tiempos reales por fase, que es lo que después va a permitir discutir la norma con evidencia.

---

## ADR-014 — Catálogo cerrado; se descarta el campo `estado`

**Estado:** Aceptada · 2026-08-13

**Contexto.** H0-4.3: los ítems inactivos ya vienen filtrados en el origen y no se necesitan; la columna `estado` vale `Activo` en los 159.366 registros. H0-4.4: los códigos son los oficiales del expediente. H0-4.5: no se admiten ítems fuera del catálogo. H0-4.2: actualización mensual, manual, a cargo del Jefe de Contrataciones, contra un origen que cambia a diario.

**Decisión.**
1. `tools/build-catalogo.js` **descarta el campo `estado`** al generar los shards (ahorra ~4 MB y una decisión ambigua).
2. La validación de renglones es **estricta**: un código que no existe en el catálogo vigente es un error de validación, sin texto libre como escape.
3. El catálogo es un **artefacto versionado**: cada build estampa `catalogoVersion` (fecha de la corrida), y cada `datos.json` guarda con qué versión se cargaron sus renglones.
4. El script de scraping se incorpora al repositorio en `tools/`, como parte del proyecto y no como herramienta personal.

**Fundamento.** El punto 3 es el que importa: con actualización mensual y origen diario, un mismo código puede significar cosas distintas en el tiempo. Estampar la versión permite reconstruir después qué vio el operador cuando cargó el renglón — que es exactamente lo que un auditor va a preguntar.

### Enmienda 2026-08-13 (ronda 3) — procedimiento de excepción

Respondido H0-4.7: cuando el ítem exacto no está en el catálogo, **se usa el más similar y se aclara la diferencia en un campo de texto libre de hasta 200 caracteres**.

En consecuencia, el renglón queda definido así:

```
{ codigo, cantidad, unidad, aclaracion }   // codigo: obligatorio y validado contra el catálogo
                                           // aclaracion: opcional, máximo 200 caracteres
```

El punto 2 de esta ADR se corrige: la validación sigue siendo estricta **sobre el código** (no hay renglón sin código de catálogo válido), pero existe una vía de escape acotada para la descripción. Es un buen diseño: preserva la trazabilidad oficial del código (H0-4.4) sin bloquear el trámite.

Tres consecuencias que hay que implementar:

1. **La aclaración se imprime en el entregable.** Si no aparece en el documento que se firma, la diferencia queda solo en la base y el proveedor cotiza otra cosa. Es exactamente el *garbage out* que el FSD quiere evitar.
2. **La aclaración es un indicador, no solo un campo.** Un renglón con aclaración es un ítem que el catálogo no cubrió. El dashboard debe medir "renglones con aclaración, por rubro": esa lista es la agenda de trabajo de la actualización mensual del catálogo, y cierra el círculo entre el uso y el mantenimiento del dato.
### Enmienda 2026-08-19 — el límite es 256, no 200

El límite de la aclaración pasa de **200 a 256 caracteres**: 256 es el límite del sistema oficial, y el nuestro tiene que coincidir con el del formulario que finalmente se carga. El 200 fue una elección nuestra sin respaldo normativo.

Alcance del cambio: `validarRenglon`, sus tests, el contador visible del wizard, y la regla de desborde hacia el anexo de EETT (ADR-022). Todo lo demás queda igual.

3. **Riesgo a vigilar en el piloto:** 256 caracteres son suficientes para reintroducir ambigüedad si el campo se usa como cajón de sastre. Si en el UAT aparece un porcentaje alto de renglones con aclaración, el problema no es el campo: es que el catálogo no está cumpliendo su función.

---

## ADR-015 — Ningún operador escribe sobre la carpeta de datos

**Estado:** Propuesta (depende de H0-1.5 y H0-3.9) · 2026-08-13

> **Aceptada el 2026-08-29 por ADR-035, y mejor de lo previsto.** Con el proceso corriendo en su propia máquina virtual, **la carpeta de datos vive en el disco de esa máquina**: el único que escribe es el servidor, y eso se cumple por construcción y no por una configuración de permisos NTFS que alguien podría aflojar. La carpeta de red `Y:` pasa a ser **destino del respaldo**, que es donde sirve de verdad.

**Contexto.** H0-3.1: hoy el único lugar escribible es `Y:\UOC`, y sólo por el Jefe de Contrataciones desde su oficina. H0-3.3: se pueden otorgar permisos por grupo. H0-3.2: el trámite con Informática es ágil.

**Decisión propuesta.** No pedir permisos de escritura para los grupos de operadores. En su lugar: **la única cuenta con permiso de escritura sobre la carpeta de datos es la cuenta de servicio del servidor** (ADR-003). Los operadores obtienen permiso de **lectura** y toda escritura pasa por la aplicación.

**Fundamento.**
- Ningún operador puede corromper, borrar ni editar a mano un `datos.json` con Notepad. Eso convierte la auditoría de ADR-006 de "detecta edición casual" en algo cercano a una garantía real, sin criptografía.
- Las reglas de rol dejan de ser sólo cosméticas del frontend: el sistema operativo las respalda.
- Es **menos** trámite con Informática, no más: una cuenta con permiso en lugar de cinco grupos.

**Consecuencias.** Depende enteramente de que se apruebe correr un proceso propio (H0-1.5). Si se rechaza, hay que volver al esquema de escritura por grupo, con todas sus debilidades, y esta ADR queda superada. Es el argumento más fuerte para defender ADR-003 ante Informática: **es la opción más segura, no la más invasiva**.

**Actualización 2026-08-13 (ronda 3).** H0-3.9 respondido: **se puede crear una carpeta de datos nueva**, distinta de `Y:\UOC`. El obstáculo de infraestructura queda despejado; sigue pendiente sólo la autorización del proceso servidor.

Además, H0-2.5 (cuentas de Windows compartidas y sin contraseña) **refuerza** esta ADR y le cambia el argumento principal. Con cuentas compartidas, dar permiso de escritura a "los grupos de operadores" equivale a dárselo a cualquiera que se siente en cualquier PC: los permisos NTFS por grupo no distinguen personas porque las personas no tienen cuenta propia. Que escriba únicamente la cuenta de servicio deja de ser una buena práctica y pasa a ser **el único control de integridad disponible sobre los datos**. Ver ADR-017.

---

## ADR-017 — Identidad basada en el correo institucional, no en Windows

> **Superada parcialmente por ADR-027 (2026-08-21).** Donde esta ADR dice *"sin contraseña ni PIN en la v1"*, ahora hay **una clave por operador** definida a mano por el Jefe de Contrataciones. Todo lo demás —correo institucional como identidad, visible en pantalla, registro de la máquina de origen— se mantiene. La atribución pasa de *declarada y corroborada* a **verificada**.
>
> **Enmienda del 2026-08-28.** La **medida 4 —restringir el rol por máquina— se descarta.** Las PCs tienen IP fija, pero el Jefe de Contrataciones confirmó que **no hay una PC por persona**: atar el rol a la máquina daría por buena una atribución falsa. La identidad se resuelve **sólo con el ingreso por clave** (ADR-027 y ADR-034). H0-16 queda cerrado y H3-12 se retira del plan. Se mantiene la medida 3: el servidor sigue registrando IP y nombre de equipo de cada petición, como dato, no como control.

**Estado:** Aceptada · 2026-08-13

**Contexto.** H0-2.5: existe **un solo usuario administrador, en poder de Informática**, y **el resto de las cuentas son compartidas y sin contraseña**. No hay identidad individual de Windows en la que apoyarse.

Esto derriba dos supuestos que veníamos arrastrando:

- El "login lógico" del FSD §3 no es una capa de conveniencia sobre una identidad real: **es la única identidad que va a existir**. Cualquiera puede seleccionar cualquier rol.
- Los permisos NTFS por grupo (H0-3.3, disponibles) pierden casi todo su valor como control de roles: si todos los operadores comparten cuenta, el sistema operativo no puede distinguirlos. Sólo conservan sentido si las cuentas compartidas son **una por oficina o sector** — pendiente de confirmar.

Y agrava un problema que no es de seguridad sino de calidad del dato: el riesgo dominante acá **no es la suplantación maliciosa, es la atribución equivocada por descuido** — alguien se sienta en una PC donde quedó abierta la sesión lógica de un compañero y avanza un expediente a nombre de otro. Eso contamina la auditoría y los KPIs por sector, que son dos de los tres objetivos del FSD.

**Decisión propuesta — cuatro medidas, en orden de relación valor/costo:**

1. **Operador siempre visible y cambio de operador a un clic.** El nombre del operador activo se muestra de forma permanente y prominente en la interfaz. La mayoría de los errores de atribución se evitan simplemente haciendo imposible no darse cuenta de con quién se está trabajando.
2. **Cierre por inactividad.** Pasados N minutos sin actividad (arrancar con 15), la sesión lógica se cierra y hay que volver a identificarse. `sessionStorage` ya cubre el cierre de pestaña; esto cubre el escritorio abandonado.
3. **Registro del origen de la petición del lado del servidor.** El servidor conoce la IP y el nombre del equipo que hace cada llamada, y los guarda en la auditoría junto al rol declarado. Es un dato que el operador **no elige**, y por lo tanto corrobora o desmiente el rol declarado. Costo: casi nulo. Valor: convierte la auditoría de "lo que alguien dijo ser" en "lo que alguien dijo ser, desde tal máquina".
4. **Restricción de rol por origen.** El servidor sólo acepta acciones del rol *Contaduría* desde las máquinas de Contaduría, y así con cada sector. Esto es lo que devuelve enforcement real a la separación de roles sin identidad de Windows. Requiere que las PCs tengan IP fija o reserva por DHCP: hay que preguntarlo.

**Explícitamente NO se hace:** contraseñas por operador guardadas en la carpeta de red. Sin identidad del sistema operativo detrás, sería un mecanismo de seguridad de juguete que induce a confiar en él. Si más adelante hiciera falta no repudio real, el camino es autenticación integrada de Windows en el servidor, no contraseñas propias.

**Fundamento.** El control efectivo sigue siendo el que el FSD ya nombraba: **la custodia física de las oficinas**. Las medidas 1 y 2 atacan el error honesto, que es el caso frecuente; la 3 y la 4 elevan el costo del caso deliberado. Ninguna pretende ser más de lo que es, y eso debe quedar escrito también en la interfaz: la app no puede afirmar que un acto fue realizado por una persona determinada.

### Resolución 2026-08-13 (ronda 4)

**(a) Las cuentas de Windows son una por PC**, agrupadas por oficina o sector según el caso. **(b) Decisión del usuario: la identidad del operador NO se apoya en el usuario de Windows, sino en el correo institucional `@faa.mil.ar`.**

Es la decisión correcta, y por una razón que va más allá de lo técnico: el correo institucional es la identidad que la persona **ya tiene** frente a la organización. Aparece en los expedientes, en las comunicaciones y en cualquier reclamo posterior. Una cuenta de Windows compartida por PC no identifica a nadie; el correo sí, y además es portable — el mismo operador es el mismo operador desde cualquier máquina.

**Modelo de identidad definitivo:**

1. **Padrón de operadores** (`config/usuarios.json`), mantenido por el Jefe de Contrataciones:
   ```
   { nombre, apellido, email, roles: [], sector, activo }
   ```
   El `email` es la clave única y estable. `roles` es un arreglo, porque una persona puede acumular funciones (gestor y supervisor).
2. **Selección de operador**, sin contraseña: la lista muestra **nombre y apellido, rol y correo a la vista** (formato pedido por el usuario). El correo visible no es decoración: es la señal que hace evidente de un vistazo si uno está operando bajo la identidad equivocada, que es el error frecuente en PCs compartidas.
3. **Sin PIN en la v1.** Se evaluará en el UAT. Sin identidad del sistema operativo detrás, un PIN es fricción con beneficio marginal; si el piloto muestra confusiones reales de identidad, se agrega, y es un cambio barato.
4. **Corroboración por origen de la petición.** El servidor sigue registrando IP y nombre de equipo (medida 3) y puede restringir roles por máquina (medida 4). Conviene subrayar que esto **no contradice** la decisión del usuario: no se usa la *cuenta* de Windows como credencial, se usa la *máquina* como dato corroborante que el operador no elige. Como las cuentas son una por PC, la correspondencia máquina → oficina es estable y utilizable.
5. **Edición del padrón restringida:** sólo desde la máquina del Jefe de Contrataciones, verificado del lado del servidor. Es el único control de administración disponible sin identidad real.

**Límite que hay que enunciar en la interfaz.** El correo institucional funciona acá como **identificador declarado, no como credencial verificada**: la app no valida contra el servidor de correo (eso implicaría una dependencia externa que el usuario expresamente no quiere, ver ADR-018). La formulación honesta para la UI y para el `resumen.md` exportado es: *el registro no puede alterarse después de escrito; la identidad de quien lo originó es declarada por el propio operador y corroborada por la máquina desde la que actuó.*

Si en el futuro se necesitara verificación real, el camino es autenticación integrada de Windows contra el directorio del organismo, del lado del servidor — no contraseñas propias guardadas en una carpeta de red.

---

## ADR-018 — El scraper del catálogo es infraestructura del proyecto

**Estado:** Aceptada · 2026-08-13

**Contexto.** H0-4.1 y H0-4.6: el catálogo se obtuvo con un script propio que recorre el sitio estatal página por página, con más de dos horas de corrida. El script **está guardado dentro de una conversación con un LLM** y se ejecutó desde el equipo del Jefe de Contrataciones. La actualización es mensual (H0-4.2) contra un origen que cambia a diario.

**Decisión.**
1. **Rescatar el script y versionarlo en `tools/scraper-catalogo/` esta semana**, antes de cualquier otra tarea de H4. Un historial de chat no es un sistema de control de versiones: puede perderse, y si se pierde son dos horas de corrida más el trabajo de volver a deducir cómo se navega el sitio.
2. Hacerlo **reanudable**: una corrida de dos horas que falla al 80% sin poder retomar es una corrida que en la práctica no se hace todos los meses.
3. Producir en cada corrida un **reporte de diferencias** contra el catálogo vigente: ítems nuevos, ítems que desaparecieron del origen (candidatos a baja, según H0-4.3) y descripciones modificadas.
4. Documentar desde qué equipo se corre y cómo entra el archivo resultante a la red interna.

**Fundamento.** El punto 3 es el que convierte una tarea mensual tediosa en información útil: el usuario dijo que borra los ítems inactivos "al enterarse que están inactivos" — el reporte de diferencias **es** cómo se entera. Y cruzado con el indicador de renglones con aclaración (enmienda de ADR-014), el mantenimiento del catálogo deja de ser a ciegas y pasa a estar dirigido por el uso real.

**Circuito confirmado (ronda 4).** El scraper se corrió **desde una PC que no está conectada a la intranet**. Las PCs de la intranet sí tienen salida a internet con restricciones casi nulas, pero **el usuario decidió expresamente que la aplicación no dependa de peticiones a internet**.

Esa distinción es importante y hay que sostenerla en el código: el **scraper** es una herramienta offline que vive en el repositorio pero **no forma parte de la aplicación desplegada**; corre fuera de la intranet y su producto —el JSON del catálogo— se traslada a mano. La **aplicación** no emite una sola petición al exterior, nunca, aunque la red se lo permita.

**Decisiones que se agregan:**
5. `tools/` no se despliega. Sólo se despliegan `app/` y `server/`.
6. El verificador de H1-9 se amplía: **falla el build si aparece cualquier URL absoluta `http://` o `https://` dentro de `app/`**. Es la forma de que "sin dependencias externas" siga siendo cierto dentro de seis meses y no sólo el día que se escribió.
7. Documentar el procedimiento mensual completo: correr el scraper en la PC sin intranet → revisar el reporte de diferencias → trasladar el archivo → correr `build-catalogo` → publicar la carpeta `catalogo/` con su `catalogoVersion`.

**Consecuencia a asumir.** El traslado del archivo entre una PC externa y la red interna es el único punto de contacto con el exterior de todo el sistema. Conviene que esté escrito y sea un acto consciente y mensual, no una práctica incidental — sobre todo en un organismo donde el traslado por medios extraíbles suele tener normativa propia. Vale la pena confirmar con Informática cuál es el procedimiento admitido.

---

## ADR-016 — La app no custodia documentos firmados

**Estado:** Aceptada · 2026-08-13

**Contexto.** Ronda 2 del relevamiento: el operador sube el PDF generado al sistema de firmas a mano, y el documento firmado **permanece en ese sistema**; no vuelve a la carpeta del expediente.

**Decisión.** El SGC guarda el documento **generado** y una **referencia** al firmado (identificador, fecha, quién firmó), nunca el instrumento firmado. La app es sistema de registro **del proceso**, no repositorio documental.

**Fundamento.** Es la decisión del usuario y es defendible: duplicar el instrumento firmado en una carpeta de red crea dos copias con distinto valor probatorio y la pregunta inevitable de cuál vale. Una referencia no tiene ese problema.

**Consecuencias.**
1. Se elimina del alcance la carga de archivos firmados y su versionado (simplifica H7).
2. **La carpeta del expediente no es el archivo legal completo.** Hay que enunciarlo en la interfaz — un texto fijo en la vista del expediente y en el `resumen.md` exportado — para que nadie lo tome por tal en una auditoría. Es la contrapartida honesta de esta simplificación.
3. El `resumen.md` para ingesta por LLM debe declarar explícitamente que los instrumentos firmados están fuera del sistema; de lo contrario, un modelo que lo lea va a concluir que el expediente está incompleto o adulterado.

---

## ADR-019 — Esquema de `datos.json` v2

**Estado:** Aceptada · 2026-08-14 · *Cierra la tensión abierta en `ORDEN-RONDA-03.md` §2.4*

**Contexto.** `InstruccionesCodigo.md` §6.1 definía `estadoActual` como cadena y `auditLog` como arreglo de auditoría. Durante la ronda 2 la implementación que quedó en producción reestructuró ambos: `estado` pasó a ser un objeto `{id, fase, desde}` y el registro de auditoría a llamarse `auditoria`. La desviación fue documentada por su autor y excede las correcciones que la orden autorizaba.

**Decisión.** Se **acepta** el esquema v2 y se lo declara contrato vigente, reemplazando a §6.1 en esos dos campos. La forma canónica queda:

```
estado:    { id, fase, desde }        // no una cadena suelta
auditoria: [ { timestamp, email, rol, equipo, accion, de, a, motivo, observacion, hashPrevio } ]
```

**Fundamento.** Tres razones, en orden de peso.

1. **`estado` como objeto es mejor diseño.** La fase se deriva del estado y tenerla al lado evita que cada consumidor la recalcule contra `config.js`; `desde` da el instante de entrada al estado, que es el insumo exacto del futuro motor de SLA (ADR-013) y hoy se perdería.
2. **Revertir cuesta más de lo que corrige.** El motor de transiciones, las migraciones, el adaptador de persistencia y el servidor ya están escritos y probados contra esta forma. Cambiarla ahora es tocar cuatro módulos en verde para volver a un nombre.
3. **La migración ya contempla el paso.** La ruta v1 → v2 preserva todos los campos originales y deriva los nuevos, verificado por batería externa.

**Lo que esta ADR no perdona.** Se acepta el resultado, no el procedimiento: la desviación debió proponerse antes de implementarse. La regla sigue en pie — quien se aparte de un contrato dictado lo justifica **antes**, o lo revierte.

**Consecuencias.** `InstruccionesCodigo.md` §6.1 queda derogado en lo referido a `estadoActual` y `auditLog`; el resto de §6.1 sigue vigente. Toda orden futura que hable del esquema cita esta ADR y no §6.1.

---

## ADR-020 — Índice del catálogo en formato compacto

**Estado:** Aceptada · 2026-08-14

**Contexto.** La ORDEN-RONDA-04 §3.5 fija el presupuesto de rendimiento: el índice inicial (rubros + clases) debe pesar **menos de 300 KB**. La primera versión de `tools/build-catalogo.js` generaba `clases.json` con entradas objeto `{idClase, rubro, clase, cantidad, partes}`: pesó 681 KB, muy por encima del presupuesto. El rubro repetido por entrada costaba 121 KB de los 681; el resto eran las claves del objeto y los nombres de clase. ADR-004 estimaba ~200 KB.

**Decisión.** El índice se genera en formato compacto de arreglos:

- `rubros.json` — `[{idRubro, rubro}]` (50 entradas, ~2 KB).
- `clases.json` — `[[idClase, idRubro, clase, cantidad, partes], …]` (6909 entradas, ~250 KB). El rubro va por índice (`idRubro`) y `idClase` identifica al fragmento `items/<idClase>.json` (`partes` indica en cuántos archivos se partió la clase).

`SGC.catalogo.indice.montar` es la única capa que interpreta este formato y expone la API documentada en la orden §3.2 (`buscarClases` → `{idClase, rubro, clase, cantidad, coincidencias}`, etc.). Los fragmentos de ítems mantienen el formato simple `[{codigo, item}, …]`.

**Fundamento.** Medición real: 2 KB + 250 KB = 252 KB < 300 KB, contra 683 KB del formato objeto. La búsqueda sigue siendo la misma (la normalización y los tramos no cambian); sólo cambia el byte-format del índice.

**Consecuencias.** El consumidor del índice (batería externa incluida) debe pasar por `indice.montar`; no hay contrato de lectura directa sobre las claves internas. El catálogo generado se versiona completo en el repositorio (contenido estático versionado, ADR-004).

---

## ADR-021 — El servidor autoriza las transiciones; el cliente sólo declara la intención

**Estado:** Aceptada · 2026-08-18 · *Implementada y verificada en el ciclo 07* · **Acotada por ADR-023**

> **Nota de vocabulario (2026-08-20).** El título de esta ADR induce a error. Lo que el servidor hace es **validar** peticiones y **registrar** hechos: control de acceso técnico. **Esta aplicación no autoriza gasto, no imputa y no adjudica**; esos actos se perfeccionan con la firma de la autoridad competente, fuera del sistema. Léase junto con **ADR-023**, que fija la frontera. La decisión técnica de abajo no cambia en una sola línea.

**Contexto.** La auditoría del ciclo 06 detectó, y el revisor reprodujo en vivo, que el servidor no validaba ni el rol ni la transición. `apiGuardar` comprobaba que el cuerpo estuviera bien formado y que la versión coincidiera, y después escribía el expediente recibido tal cual. `estados.js` ni siquiera se cargaba del lado del servidor: el motor corría en el navegador, el cliente mandaba el expediente con el estado ya cambiado, y el servidor lo guardaba.

Reproducción, contra el servidor real:

```
GET  /api/expedientes/2026-001   -> ESPECIFICACIONES_TECNICAS (fase 1, version 1)
PUT  /api/expedientes/2026-001   con estado = PERFECCIONADA y rol "generador"
     -> 200 OK  {"version":2}
GET  /api/expedientes/2026-001   -> PERFECCIONADA (fase 10)
```

Un rol `generador` llevó un expediente del paso 1 al 18 con una sola petición. El único control era el bloqueo optimista, que **no es un control de autorización**: es un mecanismo de concurrencia, y la versión actual se obtiene con un `GET` previo.

**El origen del defecto fue del revisor, no del desarrollador.** ADR-002 definió el adaptador de persistencia como almacén, la orden de la ronda 3 describió al servidor como "almacén versionado" sin motor de dominio, y `estados.js` quedó ubicado en `app/js/core/`, del lado del cliente. El desarrollador construyó lo que se le pidió y declaró el riesgo en su informe.

**Decisión.** El servidor es la autoridad de las transiciones.

1. **Extremos por intención.** El cambio de estado se declara, no viaja como documento:

```
POST /api/expedientes/:id/avanzar
     {versionEsperada, destino, contexto}
POST /api/expedientes/:id/devolver
     {versionEsperada, destino, idMotivo, observacion, contexto}
```

   El servidor lee el expediente, ejecuta `SGC.core.estados.avanzar` / `devolver` con el rol del contexto, y persiste **el resultado del motor**, no lo que mandó el cliente. Si el motor rechaza, responde `403` con el motivo en español.

2. **`PUT` no puede cambiar el estado.** Sigue existiendo para editar campos; si el documento recibido trae un `estado` distinto del que hay en disco, responde `409`.

3. **El servidor carga el núcleo de dominio.** `estados.js`, `validacion.js` y `config.js` se cargan del lado del servidor. El motor es puro y no toca el DOM: fue diseñado así desde la ronda 2 justamente para esto.

4. **La auditoría la escribe el servidor**, con el rol validado y el origen de la petición (ADR-017 medida 3).

5. **El rol declarado se cruza contra el padrón.** Añadido durante la implementación, no estaba en la decisión original: el servidor verifica que el rol del contexto le corresponda al correo en `config/usuarios.ejemplo.json`. Sin eso, la autorización se muda al servidor pero sigue dependiendo de un dato que el cliente elige.

**Fundamento.** *La validación que corre en el cliente es una comodidad para el usuario; la que corre en el servidor es la que gobierna.* Los extremos por intención eliminan la clase entera de problema: el cliente no puede mandar un estado arbitrario si el estado no viaja.

**Sobre el modelo de amenaza.** Con menos de diez usuarios en una intranet cerrada y cuentas de Windows compartidas (ADR-017), un ataque deliberado es improbable. Lo plenamente plausible es el error honesto: alguien operando con la sesión lógica de otro, o una herramienta que reintente una petición guardada. La defensa no se construye para el atacante: se construye para que el circuito administrativo sea el que decide, siempre.

**Verificación (ciclo 07).** Auditor: 13 escenarios laterales cerrados y matriz de 18 × 7 con 119 peticiones contra el servidor real, con verificación de disco tras cada rechazo. Revisor: los tres vectores principales reproducidos de forma independiente, con el expediente intacto en disco.

---

## ADR-022 — Modelo de datos del requerimiento real (Solicitud de Gastos)

> **Enmienda del 2026-08-26 — R17 cerrado.** El Jefe de Contrataciones aclaró cómo funciona el circuito real, y con eso el riesgo desaparece: **las especificaciones técnicas no llevan cantidades.** El anexo de EETT sólo describe qué es cada renglón; las cantidades —ciertas, o máximas cuando no se conocen con precisión— **se cargan en el sistema COMPRAR**, no en un documento que produzca esta aplicación.
>
> En consecuencia: la `cantidadMaxima` de §3 es un dato **interno** del requerimiento y del ANEXO 1, y **nunca llega a un documento que obligue al proveedor por vía de este sistema**. La divergencia con el Art. 112 del Decreto 1030/16 se mantiene registrada como diferencia de vocabulario dentro de la División, pero **deja de ser un riesgo legal**: R17 se cierra.
>
> Queda una invariante que hay que sostener con un test: **el anexo de EETT no imprime cantidades, ni solicitadas ni máximas ni mínimas.** Si algún día las imprimiera, R17 vuelve a abrirse.


**Estado:** Aceptada · 2026-08-19

**Contexto.** Se incorporaron al proyecto los entregables reales del circuito actual (`EjemplosProcesoActual/`): el requerimiento (`MODELO REQ..xlsx`, una *Solicitud de Gastos*), el anexo de especificaciones técnicas, y el ANEXO 1 que Abastecimiento eleva a la UOC. Su análisis está en `ANALISIS_ENTREGABLES_REALES.md`.

**Decisión.** Cinco definiciones que fijan el modelo de datos del requerimiento.

### 1. El código de catálogo se descompone, no se traduce

El "Código SIByS" de los documentos oficiales es exactamente nuestro `codigo`, partido en tres:

| Nuestro código | IPP | Clase | Ítem |
|---|---|---|---|
| `2.5.8-378.186` | `2.5.8` (se imprime `258`) | `378` | `186` |

Verificado contra el catálogo: los tres renglones del EETT de ejemplo existen con el texto idéntico, y la "Descripción ONC" del documento **es** el campo `item`. No hace falta tabla de equivalencias: es partir la cadena al imprimir.

### 2. Los valores de referencia son mixtos y se normalizan antes de promediar

El usuario carga, por renglón, un valor por cada presupuesto adjunto. **Habitualmente es un precio unitario, pero puede ser el total del renglón** cuando el presupuesto viene cotizado así.

Por lo tanto cada valor lleva su **base**:

```
{ presupuestoId, base: 'unitario' | 'total', valor }
```

Y el cálculo es, en este orden:

1. **Normalizar** todo a unitario: `base === 'total'` ⇒ `valor / cantidad`.
2. **Promediar** los unitarios normalizados.
3. **Valor preventivo del renglón** = promedio unitario × cantidad.
4. **Valor preventivo de la contratación** = suma de los preventivos de todos los renglones.

Promediar sin normalizar —mezclar un unitario con un total en la misma media— produce un número sin significado. Es el error que esta ADR existe para impedir, y es invisible: da un número plausible.

Si `cantidad` es cero o falta, el valor con base `total` no se puede normalizar: se rechaza en la validación en vez de dividir por cero.

### 3. `CANT. MÁXIMA`: se adopta el uso de la División, que difiere de la norma

En la planilla de Orden de Compra Abierta, la cantidad máxima **la carga el usuario generador junto con la cantidad solicitada**, y en el uso de la División significa: **cuánto del renglón se le puede requerir al proveedor en una sola Solicitud de Provisión.**

**La norma dice otra cosa, y hay que dejarlo escrito.** El Art. 112 del Decreto 1030/16:

> *"La jurisdicción o entidad contratante determinará, para cada renglón del pliego de bases y condiciones particulares, el número máximo de unidades que podrán requerirse **durante el lapso de vigencia del contrato** y la frecuencia aproximada con que se realizarán las solicitudes de provisión. El cocontratante estará obligado a proveer hasta el máximo de unidades determinadas en dicho pliego."*

Es decir: para la norma el máximo es **acumulado sobre toda la vigencia** y **obliga al proveedor**; lo que varía por entrega es la *frecuencia aproximada*, que es un campo separado y ya existe en el ANEXO 1 §7.

**Decisión: se implementa el uso de la División**, por indicación expresa del Jefe de Contrataciones. La divergencia queda registrada acá para que, si alguien la cuestiona más adelante, el registro muestre que se conocía la norma y se eligió deliberadamente.

**Riesgo a vigilar (R17).** Este campo alimenta el pliego, que es un documento con efectos legales. Si el pliego lo rotula con la semántica del Art. 112 —"máximo durante la vigencia del contrato"— pero se completa con un valor por entrega, el documento dice algo distinto de lo que se quiso decir, y en contra del organismo: obligaría al proveedor a mucho menos de lo necesario. **Mitigación:** la plantilla del pliego tiene que rotular el campo con el significado que realmente tiene, o derivar el máximo contractual de la cantidad solicitada. Revisar al construir H13.

### 3.1. Cantidad mínima (opcional)

El Art. 52 de la disposición reglamentaria exige que, en modalidad OCA, el pliego indique por renglón cuatro datos: el máximo de unidades, el plazo de vigencia del contrato, la frecuencia aproximada de solicitudes de provisión, y **opcionalmente la cantidad mínima que la jurisdicción se obliga a contratar**.

Se agrega `cantidadMinima` al renglón, **opcional y vacía por defecto**. Sólo se imprime cuando tiene valor: es un compromiso que la División asume, no un dato de relleno.

### 4. La imputación presupuestaria no es del requerimiento inicial

Los dieciséis campos (`Ejerc, R, S, C, Ft, PG, Sp, Py, Ac, Ob, UG, I, Pppal, Ppcial, Spa, M`) **los carga Contaduría en la fase de Afectación (paso 16)**, no el usuario generador.

El documento del requerimiento imprime ese bloque vacío en la Fase 1 y completo después de la afectación. Los campos pertenecen al rol `contaduria` y sólo son editables en ese estado, con la misma matriz de autorización del servidor que gobierna todo lo demás (ADR-021).

### 5. La justificación de Orden de Compra Abierta vive dentro del requerimiento

Hoy se arma como archivo separado. Pasa a ser un campo de texto libre del requerimiento, que se imprime cuando la modalidad OCA está activada. Un entregable menos, sin perder información.

**Consecuencias.** El usuario pasa de presentar cinco archivos o más a presentar **dos documentos generados más los presupuestos adjuntos**. El promedio de referencia y el valor preventivo dejan de calcularse a mano.

---

## ADR-023 — Frontera: la aplicación no autoriza nada; el servidor sólo controla el acceso

**Estado:** Aceptada · 2026-08-20 · *Aclara y acota a ADR-021*

**Contexto.** El título de ADR-021 dice *"El servidor autoriza las transiciones"*, y la orden de auditoría del ciclo 09 §3 dice *"la imputación presupuestaria: es autorización, no formulario"*. Leído desde afuera —y con razón— eso suena a que la aplicación **autoriza gasto**, o a que hay alguien operando del lado del servidor. No es así, y la ambigüedad es del vocabulario, no del código: en castellano administrativo *autorizar* significa **conceder una facultad mediante un acto administrativo firmado**, y en jerga informática *authorization* significa **decidir si una petición se ejecuta**. Son dos cosas distintas y en este proyecto sólo existe la segunda.

**Decisión.** Se fija la frontera y se adopta un vocabulario que no la borre.

### 1. Qué es esta aplicación

Un **generador documental, un registro de tiempos y un seguimiento de procesos**. Produce documentos listos para imprimir y firmar, registra cuándo pasó cada cosa y quién la declaró, y exporta datos. Nada más.

### 2. Qué NO hace, y no va a hacer

- **No autoriza gasto.** La autorización del gasto es un acto administrativo que se materializa en una Disposición firmada, fuera de esta aplicación, por la autoridad competente. La app imprime el proyecto de esa Disposición; no la emite.
- **No imputa presupuesto.** Contaduría imputa en el sistema presupuestario oficial. Lo que la app guarda son los **dieciséis campos transcriptos** para que salgan impresos en el documento. Si la app dijera lo contrario, sería falso.
- **No adjudica, no perfecciona, no compromete.** Registra que eso ocurrió y cuándo.
- **No custodia documentos firmados** (ADR-016).
- **Nadie opera del lado del servidor.** El proceso de Node no tiene interfaz, ni consola de administración, ni usuario que entre a él. Recibe peticiones HTTP de los navegadores de la intranet, valida, escribe archivos y responde. Es un archivador con reglas, no un puesto de trabajo.

### 3. Qué sí hace el servidor, y por qué no es "autorizar"

El servidor **decide si acepta o rechaza una petición**. Eso es control de acceso, y es lo que ADR-021 implementa. Existe por una razón que no es de seguridad:

> **Sin control de acceso, el registro de tiempos y el seguimiento serían mentira.**

Si cualquier navegador puede escribir cualquier estado, entonces la fecha en que un expediente "pasó a Adjudicación" no significa nada, la traza de auditoría no acredita nada y los KPIs miden ruido. El control de acceso no está para impedir un ataque —con menos de diez usuarios en una intranet cerrada, el ataque es improbable (ADR-021, *Sobre el modelo de amenaza*)—: está para que **el dato registrado sea el dato real**. Es un requisito de la función de registro, no una función de autoridad.

Lo mismo vale para la imputación: la restricción "sólo `contaduria`, sólo en `AFECTACION`" no le concede a Contaduría una facultad que no tenga. Refleja en el archivador una facultad que Contaduría ya tiene por la norma, para que el archivador no atribuya a otro un dato que no cargó.

### 4. El vocabulario, corregido

Para que la confusión no vuelva:

| Se decía | Se dice | Por qué |
|---|---|---|
| "el servidor autoriza las transiciones" | **"el servidor valida las transiciones"** / "el control de acceso vive en el servidor" | *Autorizar* es un acto administrativo; el servidor valida y registra |
| "autorización server-side de la imputación" | **"la imputación sólo la registra el rol Contaduría, y sólo en la fase de Afectación"** | Describe lo que hace: registrar, no habilitar |
| "matriz de autorización 18 × 7" | **"matriz de permisos de registro"** (se admite el nombre viejo en los tests, por costo de cambio) | Es una matriz de quién puede registrar qué |
| "aprobar el expediente" | **"registrar la aprobación"** | La aprobación la hace una persona firmando |

Los nombres internos de código (`autorizacion.js`, `verificar`) **no se renombran**: el ripple no se justifica y en jerga técnica el término es correcto. Lo que se corrige es **todo texto que ve un operador o un auditor externo**: pantallas, mensajes de error, documentos generados, informes y órdenes.

### 5. La leyenda obligatoria

En la pantalla del expediente, en el pie de cada entregable generado y en el `resumen.md` del export, junto a la leyenda de ADR-016:

> *Este sistema genera documentos, registra tiempos y sigue el estado del trámite. **No autoriza, no imputa y no adjudica**: esos actos se perfeccionan con la firma de la autoridad competente, fuera de este sistema.*

Sin esto, tanto una auditoría externa como un LLM que lea el export van a interpretar que el expediente se resolvió acá adentro.

**Fundamento.** El riesgo no es técnico: es que alguien —un auditor, un superior, un juez— lea "la aplicación autorizó" y le atribuya al sistema una facultad que no tiene, o que un operador crea que porque el sistema lo dejó avanzar, el acto está autorizado. Un sistema que se describe con más autoridad de la que tiene es un pasivo.

**Alternativas consideradas.** *(a)* No hacer nada, porque el código ya es correcto: descartada, porque el problema está en el texto y el texto es lo que se lee. *(b)* Renombrar todo, incluido el código: descartada por costo y porque en el dominio técnico el término es el correcto.

**Consecuencias.** Ninguna línea de lógica cambia. Cambian textos de interfaz, la leyenda del pie de los entregables, y el vocabulario de las órdenes y los informes. Queda pendiente de validar en el UAT (H9-8) que la leyenda se entienda sin explicación.

---

## ADR-024 — Registro de eventos amplio; los indicadores se eligen después

**Estado:** Aceptada · 2026-08-20

**Contexto.** H8 define un puñado de indicadores: tiempo por fase, tiempo total, tasa de devolución por motivo y por sector, renglones con aclaración. Elegirlos ahora, antes de tener un solo mes de operación real, es adivinar. Y el dato que no se registra **no se puede recuperar después**: el 2026 se mide una sola vez.

**Decisión.** Se separa la **captura** del **análisis**.

### 1. Se registra todo evento, no sólo los que alimentan un indicador

Además de la cadena de auditoría de las transiciones (ADR-006), que se conserva tal cual, el servidor escribe un **registro de eventos** append-only por expediente con, como mínimo:

- toda transición, con estado origen, destino, rol, correo, máquina y marca de tiempo;
- toda **devolución**, con motivo y observación;
- toda **edición** de campos (qué grupo de campos, no el contenido), con versión anterior y nueva;
- todo **conflicto de concurrencia** (409) y todo **rechazo** (403), con la razón;
- toda **generación de entregable** y toda exportación;
- **altas y bajas de renglones**, y cada uso del campo `aclaracion` con su longitud;
- **búsquedas de catálogo sin resultado** (es el indicador más honesto de que el catálogo no alcanza);
- **tiempo de permanencia con la pantalla abierta** por paso, en granularidad gruesa;
- la `catalogoVersion` y la versión de la aplicación vigentes en el momento del evento.

Formato: una línea JSON por evento (`eventos.jsonl`), append-only, con la misma escritura atómica del resto. Es texto plano, se lee con cualquier cosa, y no obliga a decidir hoy qué columnas van a importar mañana.

### 2. Los indicadores son una vista, no un dato

Ningún indicador se persiste calculado. Todos se derivan del registro de eventos en el momento de mostrarlos. Un indicador nuevo sobre datos viejos es entonces posible; un indicador nuevo sobre datos que no se capturaron, no.

### 3. Cada rol arma su propio tablero

El tablero no es una pantalla fija. Es un **catálogo de fichas de indicador** —cada una con su definición declarativa (qué evento, qué agregación, qué corte)— y una preferencia por operador que dice cuáles ve y en qué orden. La preferencia se guarda en el padrón, junto al operador, no en el navegador: una PC compartida no debe imponerle el tablero de un rol al siguiente que se siente.

Se entrega un **tablero por defecto por rol** para que nadie tenga que configurar nada el primer día, y se permite agregar, quitar y reordenar fichas.

### 4. Un tablero de exploración

Además de las fichas, una vista cruda: filtrar el registro de eventos y exportarlo a CSV/JSON. Es lo que permite que dentro de seis meses aparezca un indicador que hoy no se nos ocurre — y también lo que alimenta el análisis por LLM, que es un objetivo declarado del proyecto (FSD).

**Fundamento.** El costo de escribir una línea más en un `.jsonl` es despreciable —menos de cien expedientes por año (ADR-008)—. El costo de no haberla escrito es que el dato no existe. La asimetría decide.

**Alternativas consideradas.** *(a)* Registrar sólo lo que alimenta los KPIs definidos: descartada, es la que garantiza el arrepentimiento. *(b)* Base de datos: descartada, contradice ADR-003 (cero dependencias) sin necesidad a esta escala.

**Consecuencias.** Crece el volumen en disco (estimado: unos pocos MB por año, despreciable). Aparece un dato con contenido operativo sobre el desempeño de personas identificadas: **el registro de eventos se trata como dato sensible**, entra en la advertencia previa a toda descarga (H7-6) y su uso queda sujeto al criterio del Jefe de Contrataciones. Conviene decirlo antes de que alguien lo descubra.

---

## ADR-025 — Un expediente perfeccionado puede usarse como plantilla de uno nuevo

**Estado:** Aceptada · 2026-08-20

**Contexto.** Buena parte de lo que se contrata se repite todos los años con los mismos renglones y casi el mismo texto. Hoy eso se resuelve copiando y pegando un Excel del año pasado. La pregunta era si reproducirlo dentro del sistema es barato.

**Decisión.** Sí, y es de las cosas más baratas del roadmap, **porque el dato ya está guardado**. El expediente perfeccionado conserva su `datos.json` íntegro en el Archivo Histórico (H8-3). "Usar como base" es leer ese JSON, quedarse con los campos reutilizables y crear un expediente nuevo.

Reglas:

1. **Se copian** los renglones (código, descripción, unidad, cantidad, aclaración, máximos y mínimos de OCA), el objeto, la justificación de la necesidad, las especificaciones técnicas, el rubro comercial, la modalidad y el procedimiento sugeridos.
2. **No se copia nada** que sea un hecho del expediente viejo: número, fechas, estado, auditoría, registro de eventos, entregables generados, **presupuestos adjuntos**, **valores de referencia**, imputación presupuestaria, ni ninguna referencia a firmas.
3. **Los precios nunca se heredan.** Un precio del año pasado que reaparece como valor de referencia sin que nadie lo note es exactamente el defecto silencioso que ADR-022 §2 existe para evitar. El expediente nuevo nace sin presupuestos.
4. **Los códigos de catálogo se revalidan** contra la `catalogoVersion` vigente. Un ítem que ya no existe se marca y se le pide al usuario que lo reemplace; no se copia en silencio.
5. **El expediente nuevo declara su origen**: `basadoEn: "<número del expediente origen>"`, visible en la pantalla y registrado en el evento de creación. Es trazabilidad, y además es un indicador (ADR-024): cuánto de lo que se contrata es repetición.
6. **El expediente origen no se toca.** Es de sólo lectura por estar archivado, y así queda.

**Fundamento.** El costo es una función de copia con lista blanca de campos, un botón en la vista del Archivo Histórico y la revalidación de códigos, que ya existe. El beneficio es la carga inicial de un expediente recurrente, que es donde el usuario abandona hoy.

**Alternativas consideradas.** *(a)* Plantillas propias, mantenidas aparte: descartada, agrega un artefacto que hay que mantener y desactualizar. *(b)* Copiar el expediente entero y limpiarlo después: descartada, una lista negra olvida un campo y ese campo es el que hace daño. **Lista blanca, siempre.**

**Consecuencias.** Un camino nuevo para que entren datos viejos al sistema; se mitiga con las reglas 3 y 4. Requiere que el Archivo Histórico conserve el `datos.json` completo, que es lo que ya hace.

---

## ADR-026 — Identidad y marcado de autoría de la aplicación

**Estado:** Propuesta · 2026-08-20 · *se resuelve al final del roadmap (H17)*

**Contexto.** La aplicación va a circular: es probable que se copie a otras unidades, y deseable que se mejore. La pregunta es cómo reconocerla más adelante, cuando vuelva copiada o evolucionada.

**Decisión propuesta.** Distinguir tres cosas que suelen confundirse bajo la palabra "firmar":

### 1. Firma criptográfica del ejecutable (Authenticode, GPG de binario)

**No aplica y no sirve para este objetivo.** Certifica que un binario salió de quien tiene el certificado y que no fue alterado en tránsito. Es para que el sistema operativo no muestre una advertencia. Requiere un certificado pago, y sobre todo: **el que copia el código simplemente no lo firma, o lo firma con lo suyo**. No sobrevive a la copia. Aquí además no hay binario: son archivos de texto servidos por HTTP.

### 2. Prueba de paternidad (lo que sí protege legalmente)

- **Commits y etiquetas firmados con GPG** (`git commit -S`, `git tag -s v1.0.0`) con la clave asociada al correo institucional. Acredita quién escribió qué y cuándo, con fecha cierta y verificable por terceros.
- **Cabecera de autoría y licencia** en cada archivo fuente, `LICENCIA` y `AUTORES.md` en la raíz. Es lo primero que borra quien copia — y borrarlo es prueba de dolo, no de propiedad.
- **Hash publicado de la versión 1**: el SHA-256 del paquete, comunicado por correo institucional con fecha. Prueba de anterioridad, cuesta cinco minutos.

### 3. Huella identificatoria (lo que permite reconocerla en la calle)

Lo que sobrevive a la copia y a la evolución no es una firma: son **rasgos idiosincráticos que nadie reproduciría por casualidad** y que un copista apurado no borra porque no los ve. Los cartógrafos ponían calles inexistentes en sus mapas para detectar plagio; el equivalente aquí:

- **Sello de compilación visible en el producto, no en el código.** Un módulo `version.js` con `{nombre, version, commit, fecha, autor, unidad}` y una vista "Acerca de" — pero sobre todo **un pie impreso en cada entregable generado**: *"Generado por SGC v1.0 · build a3f9c1 · División Contrataciones Moreno"*. Es la marca más eficaz de todas, porque viaja en el PDF que circula por toda la Fuerza, no en un repositorio que nadie mira.
- **Huella estructural en los datos.** El formato exacto del registro de auditoría y el algoritmo de encadenado (ADR-006) ya son idiosincráticos: **cualquier `datos.json` producido por esta aplicación o por un descendiente suyo lo delata**, aunque le hayan cambiado el nombre, los colores y la pantalla entera. Se documenta el rasgo por escrito, y no se toca.
- **Marcas silenciosas deliberadas**: un puñado de identificadores, constantes y textos de comentario arbitrarios, elegidos de antemano, registrados en un documento **fuera del repositorio**. Inocuos, sin efecto en el funcionamiento, y estadísticamente imposibles por coincidencia.
- **El orden del catálogo declarado.** Los fragmentos del catálogo y la `catalogoVersion` (hash FNV-1a del contenido normalizado, ADR-004) son reproducibles sólo con este build exacto. Dos aplicaciones que emitan el mismo `catalogoVersion` comparten linaje.

**Lo que no se hace:** ninguna marca que altere datos del organismo, ningún ítem ficticio en el catálogo, ninguna telemetría, ningún mecanismo que degrade el funcionamiento de una copia. La marca identifica; no sabotea.

**Fundamento.** El objetivo declarado no es impedir la copia —es deseable que la aplicación se difunda— sino **poder reconocerla**. Eso se logra con rasgos, no con criptografía.

**Consecuencias.** El documento de marcas silenciosas queda fuera del repositorio y en poder del Jefe de Contrataciones: una marca publicada deja de ser marca. Pendiente de decidir en H17: la licencia exacta y si el pie de los entregables lleva también el número de versión del catálogo.

---

## ADR-027 — Credenciales artesanales: una clave por operador, definida por el Jefe de Contrataciones

**Estado:** Aceptada · 2026-08-21 · *Supera parcialmente a ADR-017 ("sin contraseña ni PIN en la v1")*

> **Enmienda del 2026-08-28 — no hay HTTPS.** H0-4 quedó respondido: **el host sirve sólo HTTP.** Con eso, lo que en esta ADR era un riesgo condicional pasa a ser un hecho: **la clave viaja en claro por la intranet** (R24). El Jefe de Contrataciones lo acepta —red cerrada, sin datos personales— y de ahí se sigue la regla que ya estaba escrita y que ahora **no es negociable**: estas claves **no pueden ser la misma que la de ningún otro sistema del organismo**, y la pantalla de cambio de clave (ADR-034 §3) tiene que decirlo.
>
> Hay una segunda consecuencia, y es mayor: **sin HTTPS no hay contexto seguro, y sin contexto seguro no existe el adaptador de archivos del navegador.** El servidor propio deja de ser la opción preferida y pasa a ser **la única**: H0-3 ya no es una decisión de conveniencia, es la condición de existencia del sistema. Ver R1 y R2 en el plan.

**Contexto.** ADR-017 resolvió la identidad con el correo institucional **declarado y corroborado**, sin contraseña: el operador se elige de una lista, el servidor cruza el rol contra el padrón y registra la máquina de origen. Era suficiente para desarrollar, pero deja la atribución en "declarada": cualquiera puede elegir el nombre de cualquiera, y eso contamina la auditoría y los indicadores (R12).

La alternativa habitual —enviar un código de un solo uso al correo del usuario— exige que la aplicación mande correo. **Eso está descartado**: la app no emite peticiones al exterior (ADR-018), no hay servidor de correo disponible desde la intranet y sería una dependencia nueva en un sistema que tiene cero.

**Decisión.** El Jefe de Contrataciones define **una clave por operador** y el rol que le corresponde, a mano, en el padrón. El operador entra con **correo institucional + clave**.

### 1. La clave nunca se guarda en texto plano

Aunque la red sea cerrada y los datos poco sensibles. El padrón guarda, por usuario:

```
{ email, nombre, apellido, roles: [], sector, activo,
  credencial: { algoritmo: 'scrypt', sal, N, r, p, hash } }
```

Se usa `node:crypto` (`scrypt`), que ya viene con Node: **cero dependencias nuevas**. La verificación es una comparación en tiempo constante (`timingSafeEqual`).

Guardar contraseñas en claro es la clase de decisión que no tiene defensa cuando alguien la mira de afuera, cuesta veinte líneas evitarla, y protege contra el caso realista: que el archivo del padrón termine en un respaldo, en un correo o en una carpeta compartida.

### 2. El padrón con credenciales **no se sirve por HTTP**

Vive del lado del servidor, fuera de cualquier carpeta servida como estática. Un padrón con hashes descargable desde el navegador convierte el esfuerzo del punto 1 en decorado. **Esto se verifica con un test**, no con una revisión visual.

### 3. El rol deja de ser declarado por el cliente

Es la ganancia grande, y no es sobre seguridad: es sobre la calidad del registro.

Hoy el cliente manda un `contexto` con el rol y el servidor lo cruza contra el padrón (ADR-021 §5). Con sesión autenticada, **el rol se deriva del operador autenticado** y el cliente deja de declarar nada. Si un operador tiene más de un rol (el padrón lo admite), elige cuál ejerce, y sólo entre los suyos.

Consecuencia directa: el "quién hizo qué" del registro de auditoría y de los indicadores pasa de **declarado** a **verificado**. Los KPIs empiezan a medir personas, no elecciones de una lista.

### 4. Sesión

- Cookie de sesión `HttpOnly`, `SameSite=Strict`, con identificador aleatorio de `crypto.randomBytes`. La sesión vive **del lado del servidor**, no en el navegador.
- **Cierre por inactividad a los 15 minutos**, que ya estaba decidido (H5-1), y cierre explícito con un botón visible.
- El operador activo, su rol y su correo siguen **siempre a la vista en pantalla** (ADR-017): la clave agrega certeza, no reemplaza la visibilidad.

### 5. Contra el tanteo, lo mínimo y barato

Demora fija de un segundo en cada intento fallido, y bloqueo del usuario tras diez fallos seguidos —que sólo levanta el Jefe de Contrataciones—. A esta escala no hace falta más, y cualquier cosa más elaborada estorba.

### 6. Sin autoservicio: el Jefe de Contrataciones es el administrador

No hay "olvidé mi contraseña". Si un operador la pierde, el Jefe genera otra y se la entrega. **A menos de diez usuarios es la respuesta correcta**: cero infraestructura, cero correo, cero superficie. Se vuelve insostenible si el padrón crece a decenas de usuarios — ver ADR-028, que es exactamente el escenario donde eso pasaría.

Se entrega una herramienta `tools/padron.js` para dar de alta, cambiar clave y desactivar, que **imprime el hash y nunca guarda la clave en ningún lado**.

### 7. El operador puede cambiar su clave

Opcional pero recomendado, y tiene una ventaja que no es obvia: después del cambio, **ni siquiera el Jefe de Contrataciones conoce la clave del operador**. Eso mejora la atribución, que es el objetivo de todo esto.

**Fundamento.** El modelo de amenaza no cambió (ADR-021): red cerrada, menos de diez usuarios, nada de información personal circulando. Lo que se compra con la clave no es defensa contra un atacante: es que **el registro de tiempos y el tablero de indicadores dejen de basarse en una elección de lista**. Un sistema cuyo propósito declarado es registrar quién hizo qué y cuándo (ADR-023) necesita saber quién es quién.

**Alternativas consideradas.** *(a)* Código de un solo uso por correo: descartada, exige que la app mande correo y contradice ADR-018. *(b)* Sin clave, como hasta ahora: descartada, deja R12 abierto justo cuando los indicadores empiezan a importar. *(c)* Integración con el directorio de Windows: descartada, las cuentas son compartidas y sin contraseña (ADR-017), así que autenticaría a la PC, no a la persona.

**Consecuencias y riesgos que se asumen.**

- **Sin HTTPS, la clave viaja en claro por la intranet** (depende de H0-4). Con la red cerrada y sin datos personales, el Jefe de Contrataciones acepta el riesgo — **pero de ahí se sigue una regla que no es negociable: estas claves no pueden ser la misma que la de ningún otro sistema del organismo.** Si H0-4 confirma HTTPS, el punto desaparece.
- El Jefe de Contrataciones pasa a ser el administrador de altas, bajas y reposiciones. Con el padrón actual es un trámite de minutos.
- El padrón con credenciales **no va al repositorio**. En el repo queda `usuarios.ejemplo.json` sin credenciales, como hasta ahora; el real vive en la carpeta de datos y entra en el respaldo (H3-8).
- ADR-017 se mantiene en todo lo demás: identidad por correo institucional, visible en pantalla, con registro de máquina de origen.

---

## ADR-028 — Consolidación de pedidos por área, como paso previo al requerimiento

**Estado:** Propuesta · 2026-08-21 · **Fuera del alcance de la v1. Candidata a V2.**

**Contexto.** Hoy el circuito empieza cuando un usuario designado carga un requerimiento —por ejemplo, de ferretería—. Pero antes de eso, informalmente, ese usuario junta las necesidades de las áreas de la unidad: trabajos, repuestos, reemplazos, reparaciones. **Ese paso existe en la realidad y no existe en ningún sistema.** Cuando funciona, funciona por relaciones personales; cuando no, **un área queda afuera y se entera cuando ya no puede pedir**.

Es, literalmente, el eslabón anterior al *garbage in* que el FSD §1 identifica como el problema a resolver: si el insumo del requerimiento es un conjunto de mensajes sueltos y memoria, el requerimiento nace incompleto por diseño.

**Decisión propuesta.** Un módulo de **pedidos de área** anterior al paso 1: cada área carga sus necesidades contra un período abierto; el usuario consolidador las ve todas, las agrupa, las traduce a renglones de catálogo y arma el requerimiento. El pedido de cada área queda trazado hasta el renglón que lo satisfizo — o hasta el motivo por el que no se incluyó, que es el dato que hoy nadie tiene.

**Por qué no ahora.** No por el costo de construirlo, sino por tres cosas que cambia:

1. **Multiplica los usuarios.** Se pasa de menos de diez operadores identificados a, potencialmente, todas las áreas de la unidad. ADR-008 (escala asumida) y ADR-027 (claves artesanales, sin autoservicio de reposición) están dimensionadas para el primer número, no para el segundo. **La decisión de credenciales que se toma hoy funciona para la v1 y hay que volver a mirarla el día que esto entre.**
2. **Reintroduce plazos por la puerta de atrás.** Un período de recepción con fecha de cierre es un SLA, y el Jefe de Contrataciones descartó explícitamente meter ese ruido en la v1: *"este sistema tiene que ser RÁPIDO, ÁGIL Y PRÁCTICO"* (ADR-013). El módulo no tiene sentido sin fechas.
3. **Puede excluir más de lo que incluye.** Hoy un área sin acceso al sistema igual pide por teléfono. Si el pedido formal pasa a ser "cargarlo en la aplicación", **un área sin acceso queda más afuera que antes**, y con una excusa formal. Es el riesgo central y no es técnico: el módulo sólo mejora las cosas si primero todas las áreas están en el padrón y saben usarlo.

**Lo que sí se hace ahora, porque es barato y produce la evidencia.**

- **Campo `areaSolicitante` por renglón**, opcional, texto libre: quién pidió esto. Una columna. El consolidador puede registrar el origen de cada renglón desde la v1.
- **El indicador correspondiente** (ADR-024): renglones por área solicitante, y renglones sin origen declarado. **Al cabo del piloto eso responde con datos la pregunta que hoy se responde de memoria: qué áreas aparecen, cuáles nunca aparecen, y cuánto del requerimiento no tiene origen registrado.** Si el problema es tan grande como parece, los números lo van a mostrar, y V2 se va a diseñar sobre evidencia en vez de sobre una intuición — aunque la intuición sea correcta.

**Fundamento.** La idea es buena y ataca una falla real que el resto del sistema no ve. La objeción no es al qué sino al cuándo: **es exactamente el tipo de alcance que hunde un piloto**, porque triplica los usuarios y agrega un problema organizativo —quién tiene acceso, quién avisa, con cuánta anticipación— justo cuando lo que hay que demostrar es que el circuito principal funciona.

**Consecuencias.** Ninguna en la v1, salvo una columna opcional y un indicador. Queda anotado que **ADR-008 y ADR-027 se revisan cuando esta ADR pase a Aceptada**, y que la condición previa no es de software: es que todas las áreas estén en el padrón.

---

## ADR-029 — Una dependencia que falta falla ruidosamente; nunca apaga una regla en silencio

**Estado:** Aceptada · 2026-08-21 · *Nace del hallazgo H-02 del ciclo 10*

**Contexto.** El defecto de severidad alta del ciclo 10 no fue una validación olvidada. Era peor y más difícil de ver: la validación existía, y **una guardia defensiva la desactivaba sin decir nada**.

```js
// app/js/core/validacion.js
if (SGC.core.requerimiento) {
  errores = errores.concat(SGC.core.requerimiento.validarValoresReferencia(renglon));
  errores = errores.concat(SGC.core.requerimiento.validarCantidades(renglon));
}
```

El comentario justificaba el `if` por conveniencia: *"si el módulo no está cargado (tests de configuración), no se agregan errores"*. Y el servidor cargaba el núcleo **sin** `requerimiento.js`. Resultado: siete peticiones que debían rechazarse devolvían `200`, durante dos ciclos, sin un solo error en ningún log y con la suite entera en verde.

La forma del defecto es la que importa: **código escrito para que los tests no rompan, que en producción apaga un control**. Es indetectable por tests —porque los tests son la razón por la que existe— y sólo se encuentra pegándole al servidor desde afuera, que es lo que hizo el auditor.

Tras la corrección, el auditor verificó que **el patrón sobrevive en tres lugares**: `validacion.js:122` y `:133`, y una instancia nueva en `renders/requerimiento.js:115`, donde si falta `anexo-eett.js` el documento imprime el texto completo en vez de la referencia al anexo. Hoy ninguna se dispara, porque los dos puntos de entrada garantizan el orden de carga. Pero **nada avisaría si ese orden se rompiera mañana**.

**Decisión.** En este proyecto, un módulo que necesita a otro **exige** que esté cargado. Si no está, lanza.

1. **Prohibido el `if (SGC.core.X)` que saltea una regla.** Si `X` es necesario para validar, componer o decidir, su ausencia es un error de programa, no un caso a contemplar.
2. **La forma correcta ya existe en el repositorio**, en `repo.memoria.js`: exigir la dependencia y lanzar con un mensaje que diga qué falta y quién lo pedía. Ese es el patrón; se copia, no se inventa otro.
3. **El punto de entrada declara sus dependencias.** `server/servidor.js` y `app/index.html` cargan el núcleo en un orden que no puede quedar implícito: se declara en una lista con un comentario que diga por qué ese orden, y **hay un test que arranca el servidor y verifica que todos los módulos del núcleo estén presentes**.
4. **Si un test necesita el módulo ausente, el test carga el módulo.** La conveniencia del test nunca se paga con un agujero en producción. Un test que no puede cargar una dependencia real está describiendo mal lo que prueba.
5. **Excepción única y explícita: la degradación deliberada.** Si algún día se decide que una funcionalidad debe degradarse en vez de fallar —por ejemplo, seguir sirviendo la aplicación sin el catálogo—, se escribe **como decisión, con su ADR, su mensaje visible al operador y su registro de evento**. Una degradación que nadie ve no es una degradación: es un defecto con buena presentación.

**Fundamento.** *Una regla que puede desaparecer sin que nadie se entere no es una regla.* A esta escala el costo de fallar ruidosamente es nulo: el sistema arranca o no arranca, y si no arranca se ve en el primer segundo. El costo de fallar en silencio ya lo pagamos: dos ciclos con el servidor sin gobierno sobre el requerimiento, y una auditoría entera para encontrarlo.

**Alternativas consideradas.** *(a)* Dejar las guardias y confiar en el orden de carga: descartada, es exactamente el estado que produjo H-02, y "hoy funciona" no es una propiedad que se pueda verificar en el futuro. *(b)* Registrar una advertencia en vez de lanzar: descartada, en esta aplicación no hay nadie mirando un log — una advertencia que nadie lee es silencio con más pasos.

**Consecuencias.** Hay que corregir las tres instancias vivas y agregar el test de dependencias del punto 3. Un error de orden de carga pasa de ser una regla apagada a ser una aplicación que no levanta, que es lo que corresponde. Queda pendiente de validar que ningún test dependa hoy de la conveniencia que se elimina.

---

## ADR-030 — Hay un solo pliego, y no lo produce esta aplicación

**Estado:** Aceptada · 2026-08-25

**Contexto.** Al cerrar la ronda 11 quedaron **dos documentos distintos llamados "pliego"**, y nadie había decidido cuál vale:

1. `app/js/renders/pliego-bases-condiciones.js` — plantilla propia, escrita en el ciclo 7 como una de las cinco plantillas genéricas de H7. Está declarada como **entregable obligatorio** de un estado (`config.js:138`), así que hoy el sistema **exige generarla para poder avanzar**. Imprime objeto, dependencia, finalidad, lugar, vigencia y una tabla genérica de renglones. **No menciona la modalidad de Orden de Compra Abierta en ninguna parte.**
2. El **generador de pliegos de la UOC** (`EjemplosProcesoActual/DocUOC/Generador de Pliegos/`), que ya funciona, produce el documento real y desde la ronda 11 se alimenta con el YAML que emite esta aplicación.

La confusión no fue de nadie en particular: el auditor leyó la plantilla propia como el documento legal y calificó su falta de OCA como hallazgo crítico; el desarrollador leyó el generador externo como el documento real y dio R17 por controlado. **Los dos razonaron bien sobre objetos distintos.**

**Decisión.** El pliego es **uno solo y lo produce el generador de la UOC**. Esta aplicación no lo genera: le entrega los datos.

1. **`pliego-bases-condiciones` deja de ser un entregable.** Se retira de `ENTREGABLES` y de los `entregablesObligatorios` del estado que hoy lo exige. Un documento que se imprime, se puede firmar y no es el pliego, es un pasivo: alguien lo va a presentar creyendo que lo es.
2. **En su lugar, el entregable de ese estado es el YAML** (más el ANEXO 1 y el anexo de EETT, que ya existen). Lo que el sistema produce en esa fase es el **insumo verificable** del pliego, no una imitación del pliego.
3. **La plantilla no se borra: se convierte en `vista-previa-pliego`**, sin estado asignado, claramente rotulada *"Vista previa — no es el Pliego de Bases y Condiciones"*, y sin pie de firma. Sirve para que la UOC vea qué va a salir antes de correr el generador. Si al construirla se comprueba que no la usa nadie, se elimina.
4. **La leyenda de ADR-023 y el pie de firma no van en un documento que no se firma.** Un documento sin destino de firma no lleva pie de firma.

**Fundamento.** El análisis de los entregables reales ya había decidido esto —*"la aplicación no rehace el generador de pliegos; emite el YAML que ese generador ya consume"*— pero la plantilla del ciclo 7 quedó viva y nadie la retiró. **Dos documentos con el mismo nombre y distinto contenido es una trampa de expediente**, y la mitad de los desacuerdos de la auditoría del ciclo 11 salen de ahí.

**Sobre R17, que es la razón por la que esto importa.** La `cantidadMaxima` por renglón —el número que, mal rotulado, obliga al proveedor a menos de lo necesario— hoy aparece correctamente rotulada *"Cantidad máxima (por Solicitud de Provisión)"* en la pantalla y en el requerimiento impreso. Al pliego real llega la **modalidad** (`tipo_oc` viaja en el YAML), pero **las cantidades máximas por renglón no viajan**: llegarían sólo por el apéndice de EETT, que hoy no las contiene. Eso queda como tarea explícita de la ronda 12 y **es una pregunta de dominio antes que de código**: hay que confirmar con la UOC en qué documento del pliego debe figurar la planilla de máximos.

**Alternativas consideradas.** *(a)* Completar la plantilla propia con la sección de OCA: descartada, arregla el síntoma y deja los dos pliegos en pie. *(b)* Borrarla sin más: descartada, la vista previa tiene valor real y borrarla pierde trabajo hecho.

**Consecuencias.** Cambia un `entregablesObligatorios` en `config.js` y varios tests que lo dan por sentado. El sistema deja de producir un documento firmable que no es el que dice ser. Queda pendiente de confirmar con la UOC dónde va la planilla de máximos dentro del pliego.

---

## ADR-031 — El emisor de YAML entrecomilla por defecto

**Estado:** Aceptada · 2026-08-25

**Contexto.** La ronda 11 entregó un emisor de YAML sin dependencias (ADR-003) que decide **cuándo entrecomillar** con una lista de patrones: dos puntos seguidos de espacio, número al inicio, guión al inicio, ciertos símbolos, palabras reservadas. Todo lo que no coincide con ningún patrón sale **sin comillas**.

El auditor encontró dos agujeros en esa lista. Al reproducirlo contra el parser real —el de Python, que es el que usa el generador— aparecieron **siete**, de veinte casos probados:

| Texto cargado | Llega al pliego | Qué pasa |
|---|---|---|
| `comment #10 is here` | `comment` | Se trunca en silencio |
| `#comentario` | *(nada)* | Se pierde entero |
| `   ` (sólo espacios) | *(nada)* | Se pierde entero |
| ` hola` | `hola` | Pierde el espacio inicial |
| `hola ` | `hola` | Pierde el espacio final |
| `Nota:` | — | **Rompe el archivo entero: el pliego no se genera** |
| un tabulador en el texto | — | **Rompe el archivo entero** |

Los dos últimos son peores que los otros cinco: no corrompen un dato, **impiden que el pliego exista**.

Y el patrón de fondo importa más que los siete casos: **la lista de "cuándo entrecomillar" nunca va a estar completa.** Cada vez que aparezca un texto nuevo que rompa, se va a agregar un patrón más, y la lista va a seguir estando incompleta. Es una lista de peligros conocidos frente a un universo de textos que escriben personas.

**Decisión.** Se invierte la regla: **todo escalar de tipo cadena se emite entre comillas dobles, siempre.**

```
clave: "valor, siempre entre comillas"
```

Con dos consecuencias:

1. **El escapado se vuelve el único punto delicado**, y es corto y verificable: barra invertida, comilla doble, salto de línea, tabulador, retorno de carro. Cinco reemplazos en un orden fijo, con la barra invertida primero.
2. **Desaparece la lista de patrones.** `necesitaEscapar` se elimina; no se corrige.

Un YAML con todo entrecomillado es YAML válido, lo lee cualquier parser, y es exactamente igual de legible para una persona.

**Verificación exigida.** La prueba no es un test unitario del emisor: es **ida y vuelta contra un parser de verdad**. Se emite, se parsea, y el valor que vuelve tiene que ser idéntico —carácter por carácter, espacios incluidos— al que se cargó. Los veinte casos de arriba entran a la batería, y cualquier caso nuevo se agrega ahí.

**Fundamento.** *Cuando un formato tiene reglas de escape complejas, la única política segura es la más conservadora aplicada siempre.* El costo es cosmético; el beneficio es que se elimina la clase entera de defecto, en vez de sus instancias conocidas. Es la misma lección de ADR-029 con otro disfraz: **lo que falla en silencio hay que hacerlo imposible, no infrecuente.**

**Alternativas consideradas.** *(a)* Corregir los siete casos: descartada, deja la lista incompleta y el próximo texto raro vuelve a romper. *(b)* Usar una librería de YAML: descartada, contradice ADR-003 y para esta forma de datos no hace falta.

**Consecuencias.** El YAML emitido queda más verboso. Los tests que comparaban salida literal sin comillas hay que actualizarlos. Las claves siguen sin entrecomillar: las controlamos nosotros y son identificadores simples.

---

## ADR-032 — Las plantillas del pliego viven en la aplicación, versionadas, con selección declarativa

**Estado:** Aceptada · 2026-08-26 · *Amplía a ADR-030*

> **Enmienda del 2026-08-28 — dos precisiones del Jefe de Contrataciones.**
>
> **1. La validación es en el momento, y la corre el que edita.** La §4 decía que una versión no pasa a vigente sin validarse; faltaba decir *cuándo*. El que modifica la plantilla —que la mayoría de las veces va a ser el propio Jefe de Contrataciones— tiene un botón **"Probar ahora"** en la misma pantalla: extrae los marcadores, los contrasta, genera el pliego de prueba y muestra el resultado **sin salir de la edición**. Recién con esa prueba en verde se habilita publicar. Nada de un paso aparte ni de esperar a otro.
>
> **2. Las plantillas nacen del log de errores comunes, no de cero.** Existe `Revisor de documentación\LOG_ERRORES_COMUNES.md`, con **24 errores tipificados** detectados en procesos reales. **Trece de ellos son citas normativas equivocadas que se arreglan escribiéndolas bien una sola vez en la plantilla** (N01, N03–N11, N13, M01, M02). Ese es el contenido de la v1 de cada plantilla y la razón por la que este hito existe. El análisis completo está en `ANALISIS_ERRORES_PLIEGOS.md`.
>
> Y de ahí sale lo que hace obligatoria la nota de cambio: cuando la ONC modifique otro artículo, alguien va a tener que saber **cuándo y por qué** se cambió cada cita.

**Contexto.** ADR-030 resolvió que el pliego lo produce el generador de la UOC y que esta aplicación le entrega los datos. Faltaba la otra mitad: **las plantillas**.

El generador tiene hoy dos (`TEMPLATE_ANEXO_I_BIENES.md` y `TEMPLATE_ANEXO_I_SERVICIOS.md`) y elige entre ellas con el campo `tipo_contrato`. Nuestra aplicación **no elige nada**: emite `tipo_contrato: 'bienes'` y `tipo_documento: 'proyecto'` fijos, así que hoy sólo puede producir pliegos de bienes y siempre como proyecto.

El Jefe de Contrataciones definió el alcance real: **hacen falta varias plantillas según bienes o servicios, la modalidad de contratación y el procedimiento de selección** —y el conjunto de criterios *"iremos testeando y afinando"*—, y **tienen que poder modificarlas el Jefe de Contrataciones o el Asesor Jurídico**, cualquiera de los dos, directamente.

**Decisión.** La aplicación **custodia las plantillas** y las entrega junto con el YAML. Pasa a ser la fuente de verdad.

### 1. La plantilla es un dato versionado, no un archivo suelto

```
{ id, nombre, contenido, criterios: {...}, version, autor, fecha, vigente, notaDeCambio }
```

- **El contenido se guarda íntegro en cada versión.** No hay diffs, no hay "la última pisa a la anterior": una versión nueva es un registro nuevo. Un pliego producido hace un año tiene que poder reproducirse igual.
- **La versión vigente es una marca, no la última fila.** Se puede volver a una anterior sin borrar nada.

### 2. El expediente estampa qué plantilla lo produjo

Al exportar, el expediente registra **id y versión** de la plantilla usada, y queda en el registro de eventos. Sin esto, dentro de dos años nadie puede explicar por qué dos pliegos del mismo tipo salieron distintos.

### 3. La selección es una tabla de reglas, no una cadena de condiciones

Los criterios van a cambiar —el Jefe de Contrataciones lo dijo con todas las letras—, así que **agregar un criterio no puede requerir tocar código**:

```
criterios: { tipoContrato: 'servicios', modalidad: 'OCA', procedimiento: '*' }
```

- Se evalúa contra los atributos del expediente. `'*'` es comodín.
- **Precedencia explícita:** gana la regla más específica —la que tiene menos comodines—; ante empate, la de mayor prioridad declarada. Nunca "la primera que aparezca en el archivo".
- **Siempre hay una plantilla por defecto.** Un expediente que no encaja en ninguna regla **no puede quedar sin plantilla en silencio**: usa la de defecto y **lo dice en pantalla**.
- La tabla de reglas se edita con los mismos permisos que las plantillas.

### 4. Una plantilla no pasa a vigente sin validarse

Es la regla que hace que todo esto sea seguro, y no se negocia:

- **Se extraen los marcadores** que la plantilla usa y **se contrastan contra los campos que la aplicación sabe emitir**. Un marcador desconocido **impide publicar la versión**, con el nombre del marcador en el mensaje.
- **Se avisa —sin impedir— de los campos que la aplicación emite y la plantilla no usa.** Puede ser deliberado; puede ser un olvido que deja una cláusula afuera.
- **Se genera un pliego de prueba** con un expediente de ejemplo antes de publicar. Si no sale, no se publica.

Sin esto, una plantilla con un marcador mal escrito produce pliegos defectuosos **para todos los expedientes siguientes**, y nadie lo nota hasta que un proveedor lo lee.

### 5. Quién puede

`contrataciones_supervisor` (Jefe de Contrataciones) y `juridica` (Asesor Jurídico). **Cualquiera de los dos, sin aprobación del otro**, por decisión del Jefe de Contrataciones. Verificado **en el servidor**, con la matriz de ADR-021, y registrado como evento: quién, cuándo, qué versión y la nota de cambio, que es obligatoria.

Todos los demás roles **ven** las plantillas y su historial. Que sea auditable importa más que que sea restringido.

### 6. Cómo llega al generador

Al exportar, la aplicación entrega **el YAML y el archivo de la plantilla vigente**. El generador usa esa, no la de su carpeta. Las de su carpeta quedan como respaldo histórico.

### 7. Lo que falta para que "servicios" funcione de verdad

El generador **exige dos campos más cuando `tipo_contrato` es `servicios`**: `plazo_entrega_servicio` y `garantia_servicio`. La aplicación no los emite. Mientras no los emita, **un pliego de servicios no se puede generar**, y hoy eso está tapado porque `tipo_contrato` está fijo en `bienes`.

**Fundamento.** Custodiar las plantillas es más caro que sólo elegirlas, y es lo correcto por tres razones que el modo actual no da: **historial** —quién cambió qué y cuándo, en un documento que después se firma—, **reproducibilidad** —un pliego viejo se puede volver a generar— y **control de rol**, que hoy es el permiso de escritura de una carpeta compartida.

**Alternativas consideradas.** *(a)* Que la app sólo emita `tipo_contrato` y las plantillas se editen con un editor de texto en la carpeta del generador: descartada por el Jefe de Contrataciones; es gratis pero no deja rastro de quién cambió un documento legal. *(b)* Que un rol proponga y el otro apruebe: descartada por el Jefe de Contrataciones — a esta escala el ida y vuelta cuesta más de lo que protege.

**Consecuencias.** Entra un tipo de dato nuevo que **no es un expediente** y necesita su propio almacenamiento, su respaldo y su restauración. La validación de marcadores acopla la aplicación al formato del generador: si el generador cambia de sintaxis, hay que actualizarla — se documenta y se acepta. Y aparece una responsabilidad nueva y real: **el que edita una plantilla afecta todos los pliegos siguientes**, así que la pantalla tiene que decírselo antes de publicar.

---

## ADR-033 — Los supervisores heredan lo que pueden hacer sus supervisados

**Estado:** Aceptada · 2026-08-28 · *Modifica la matriz de ADR-021*

**Contexto.** El padrón admite que una persona tenga varios roles (`roles: []`). Al armar el padrón real, el Jefe de Contrataciones lo descartó: *"prefiero que los supervisores simplemente puedan hacer todo lo que pueden hacer sus supervisados en vez de sumarle roles"*.

Tiene razón, y por un motivo que va más allá de la comodidad: **un padrón con roles acumulados miente sobre la organización.** Decir que Marisa Díaz es *"contrataciones y contrataciones_supervisor"* sugiere dos funciones; lo que hay es una sola función que incluye a la otra. Y una lista de roles se desactualiza sola: alguien asciende, se le agrega el rol nuevo, nadie le saca el viejo.

**Decisión.** Cada operador tiene **un solo rol**, y los roles forman una jerarquía.

### 1. La jerarquía

```
abastecimiento_supervisor  ⊃  abastecimiento
contrataciones_supervisor  ⊃  contrataciones
generador                     (sin supervisado)
juridica                      (sin supervisado)
contaduria                    (sin supervisado)
```

Se declara en `config.js` como un dato —`{ rol: 'contrataciones_supervisor', incluye: ['contrataciones'] }`— **no como una cadena de condiciones**. Es transitiva: si mañana hay tres niveles, el de arriba incluye a los dos de abajo sin tocar código.

### 2. Cómo se aplica

`rolesEfectivos(rol)` devuelve el conjunto —el propio más los heredados— y **la matriz de autorización consulta el conjunto**. La matriz de 18 × 7 **no se duplica**: sigue diciendo qué rol ejecuta cada paso, y lo que cambia es cómo se pregunta.

El padrón pasa de `roles: []` a `rol: ''`. Los expedientes ya registrados conservan lo que tengan; no se reescribe historia.

### 3. La auditoría registra el rol efectivo, no sólo el propio

Cuando un supervisor ejecuta un paso que le corresponde a su supervisado, el registro dice **`contrataciones_supervisor actuando como contrataciones`**. No alcanza con anotar el rol de la persona: lo que hay que poder reconstruir es **con qué facultad se hizo cada cosa**.

### 4. Lo que esto debilita, y por qué se acepta igual

Un supervisor puede ahora **ejecutar un paso y después supervisar ese mismo paso**. En una división de catorce personas eso va a pasar, y bloquearlo tendría un costo peor: un expediente detenido porque el único que estaba era el supervisor.

Así que **no se bloquea, se hace visible**:

- La máquina de estados **no se toca**: los pasos siguen siendo distintos y en orden. Lo que cambia es quién puede ejecutarlos, no que se fusionen.
- Cuando **la misma persona** ejecuta un paso y su supervisión, queda **marcado en el registro de eventos** y aparece como indicador (ADR-024). No es una alarma: es un número que el Jefe de Contrataciones puede mirar de vez en cuando.

Si con el uso real ese número resulta alto, se decide entonces con datos y no ahora con suposiciones.

**Fundamento.** *La jerarquía es un dato de la organización, no una lista que alguien mantiene.* Modelarla explícitamente evita que el padrón se desactualice y hace que la auditoría diga con qué facultad se actuó, que es más informativo que decir quién actuó.

**Alternativas consideradas.** *(a)* Roles acumulados en una lista: descartada por el Jefe de Contrataciones; se desactualiza sola. *(b)* Duplicar filas en la matriz de autorización: descartada, la matriz pasaría de 18 × 7 a un enredo que hay que mantener a mano.

**Consecuencias.** Cambia el esquema del padrón y la forma de consultar la matriz, no la matriz. Aparece un indicador nuevo. Y aparece una pregunta que hoy no tiene respuesta y que el UAT va a contestar: **cuán seguido el supervisor termina haciendo el trabajo del supervisado.**

---

## ADR-034 — Entrega, primer ingreso y reposición de claves

**Estado:** Aceptada · 2026-08-28 · *Completa a ADR-027*

**Contexto.** ADR-027 resolvió que hay una clave por operador, generada por el Jefe de Contrataciones, guardada como hash con `scrypt`. Quedaron sin resolver las tres preguntas que hizo el Jefe de Contrataciones: **cómo se las entrega, si el operador la obtiene en el primer ingreso, y cuál es el sistema de recuperación.**

No es un detalle: de esto depende que la atribución del registro signifique algo.

**Decisión.**

### 1. La entrega es en mano, y no por correo

La herramienta `tools/padron.js` genera la clave, la **muestra una sola vez en pantalla** y guarda únicamente el hash. El Jefe de Contrataciones la entrega **en persona o por nota interna**.

Nunca por correo electrónico. La aplicación no manda correo (ADR-018) y, sobre todo, **el correo institucional es el nombre de usuario**: mandar la clave por ahí es dejar las dos mitades en el mismo lugar. Con catorce personas en la misma unidad, la entrega en mano es el canal natural y el más seguro.

### 2. La clave generada se puede transcribir a mano

Se genera como **cuatro palabras en castellano separadas por guiones** —`silla-mapa-trueno-verde`— y no como una cadena de símbolos.

No es una concesión: una clave que se entrega en un papel y se tipea a mano **tiene que poder copiarse sin error**. Cuatro palabras de un diccionario de dos mil son más difíciles de adivinar que `X7#kq2` y muchísimo más fáciles de transcribir. Que no haya que dictar *"equis mayúscula, siete, numeral"* es lo que evita la llamada telefónica y el papel pegado al monitor.

### 3. La clave entregada es provisoria y **el primer ingreso obliga a cambiarla**

La credencial nace con `provisoria: true`. Con esa marca, el operador entra pero **la aplicación no lo deja hacer nada más que cambiar su clave**.

Es el punto que hace que todo esto valga: **mientras la clave la conozca el Jefe de Contrataciones, el registro no puede distinguir entre el operador y él.** Después del cambio, sólo la conoce el operador, y recién ahí *"lo hizo Fulano"* significa algo.

### 4. Reposición: la repone el Jefe, y queda registrada

No hay autoservicio: no hay correo por donde mandar un enlace. Si alguien pierde la clave, el Jefe de Contrataciones genera otra provisoria y la entrega de nuevo. El ciclo vuelve a empezar por el punto 3.

**Y la reposición se registra como evento**: *"clave repuesta por &lt;jefe&gt; para &lt;operador&gt;, tal fecha y hora"*.

Ese registro es lo que sostiene la honestidad del sistema. **Es cierto que quien administra siempre puede reponer una clave y entrar como otro** —es inevitable cuando administra una sola persona— pero si una clave se repuso a las 10:04 y el expediente avanzó a las 10:06, la traza lo muestra. **La defensa no es impedirlo: es que no se pueda hacer sin dejar rastro.**

### 5. Bajas

Dar de baja a un operador **no borra nada**: pone `activo: false`. La persona deja de poder entrar; su nombre sigue apareciendo en los expedientes que tramitó. Un padrón que borra gente rompe la auditoría hacia atrás (R15).

**Fundamento.** A esta escala, la administración manual por una sola persona es la respuesta correcta: cero infraestructura, cero correo, cero superficie. Lo que la vuelve aceptable no es que sea segura frente a un atacante —no lo es, ni pretende serlo— sino que **cada acto de administración deja rastro**, y que después del primer ingreso la clave la conoce sólo el operador.

**Alternativas consideradas.** *(a)* Enviar la clave por correo institucional: descartada, deja usuario y clave en el mismo canal y exige que la app mande correo. *(b)* Preguntas de recuperación: descartada, es más superficie para peor seguridad. *(c)* Que la clave del Jefe no sea provisoria: descartada, el Jefe también cambia la suya en el primer ingreso.

**Consecuencias.** El Jefe de Contrataciones es el punto único de administración —correcto con catorce personas, insostenible si entra ADR-028 y el padrón crece a decenas—. Hay que construir la pantalla de cambio de clave obligatorio, que es la única pantalla del sistema que un operador ve antes de estar autenticado del todo. Y queda pendiente de validar en el UAT algo que no se puede saber antes: **cuántas reposiciones hacen falta el primer mes.** Si son muchas, el problema no es la clave: es el papel.

---

## ADR-035 — Destino de despliegue: una máquina virtual Debian con el proceso propio y los datos en su disco

**Estado:** Aceptada · 2026-08-29 · *Cierra H0-3, H0-9 y H0-18. Convierte a ADR-003 y ADR-015 en Aceptadas. Cierra R1, R2 y R3.*

**Contexto.** Durante quince ciclos, la pregunta más importante del proyecto estuvo sin respuesta: **si se autorizaba correr un proceso propio, y en qué equipo.** Todo el diseño se construyó alrededor de esa incógnita —el adaptador de persistencia intercambiable de ADR-002 existe por eso— y la respuesta de H0-4 (no hay HTTPS) había dejado un solo camino posible, sin plan B.

Informática respondió, y la respuesta es mejor que el mejor escenario que habíamos previsto:

- El servidor de intranet corre **Proxmox** como virtualizador y **puede provisionar una máquina virtual de cualquier sistema operativo**.
- El equipo es un **Ryzen 5** con **16 GB de RAM**, de los cuales quedan **unos 8 GB libres** con lo que corre hoy.
- Las virtualizaciones actuales usan **Debian 12**, y prefieren mantenerse en Linux.
- **La intranet funciona como una única LAN**, así que el proceso puede correr en cualquier máquina de la red para empezar.
- **No hay problema en subir archivos al servidor ni en actualizar la versión de la aplicación** cuando haga falta.

**Decisión.** La aplicación se despliega en una **máquina virtual Debian 12** sobre el Proxmox de la unidad, corriendo el servidor de Node como servicio del sistema, con **la carpeta de datos en el disco de esa máquina**.

### 1. El proceso propio deja de ser una hipótesis

**ADR-003** (servidor mínimo en Node sin dependencias) pasa de `Propuesta` a **Aceptada**. Era la premisa de todo lo construido desde la ronda 3 y ahora tiene respaldo.

### 2. Los datos viven en el disco de la máquina virtual, no en la carpeta de red

Esto es lo que más cambia, y para mejor.

Todo el diseño asumía que los datos irían a `Y:`, una carpeta compartida por SMB, con la latencia, los bloqueos y los permisos que eso arrastra. **Ya no hace falta**: la carpeta de datos es local al proceso que la escribe.

- **El único que escribe es el servidor.** **ADR-015** —*"ningún operador escribe sobre la carpeta de datos"*— pasa de `Propuesta` a **Aceptada**, y se cumple por construcción, no por una configuración de permisos que alguien podría aflojar.
- La escritura atómica (`tmp` + `rename`) y el bloqueo de numeración **funcionan como fueron diseñados**: sobre un sistema de archivos local, que es donde esas primitivas son fiables. Sobre SMB nunca lo habrían sido del todo.
- **R3 (latencia y cortes de la carpeta de red) se cierra.** Deja de existir el problema.
- **H9-2** —la prueba contra una carpeta SMB real— **deja de tener sentido** y se reemplaza por la prueba contra la máquina virtual definitiva.

La carpeta de red `Y:` sigue siendo útil, pero para otra cosa: **destino del respaldo diario**. Que la copia viva en un disco distinto del original es exactamente lo que hace que un respaldo sirva.

### 3. La versión de Node

Debian 12 trae **Node 18** en sus repositorios. La aplicación no usa nada que lo exceda —cero dependencias, sólo `node:http`, `node:fs` y `node:crypto`— así que **funciona con el Node del sistema**, y ésa es la opción por defecto: menos piezas, actualizaciones por el mismo canal que el resto del sistema.

Si Informática admite instalar **Node 20 LTS** desde el repositorio oficial, mejor —soporte más largo—, pero **no es un requisito**. El paquete de despliegue declara la versión mínima y el arranque la verifica.

**El techo de Chrome 109 (ADR-011) no tiene nada que ver con esto.** Es una restricción del navegador de los operadores, no del servidor. El código de `server/` puede usar lo que el Node instalado soporte; el de `app/` no.

### 4. Arranca solo

El servidor corre como **servicio de systemd**: levanta al iniciar la máquina, se reinicia si se cae, y escribe su salida al registro del sistema. Un proceso que hay que arrancar a mano es un proceso que un lunes a la mañana no está corriendo.

### 5. Se puede empezar hoy, en cualquier máquina

Como la intranet es una sola LAN, **el proceso puede correr en cualquier equipo de la red** mientras se provisiona la máquina virtual. Eso adelanta la prueba con operadores reales: ya no hay que esperar a nada de Informática para empezar a usarlo.

Es un arranque, no el despliegue: los datos de esa etapa son de prueba y se descartan al pasar a la máquina definitiva.

### 6. Actualizar la aplicación es un procedimiento, no un trámite

Informática confirmó que subir archivos y actualizar la versión no es problema. **H0-18 queda cerrado**, y con él la rutina mensual del catálogo (H4-13): el archivo se genera fuera de la intranet, se traslada, y se publica en la máquina virtual.

**Fundamento.** Un proceso propio sobre un sistema de archivos local es el escenario para el que este sistema fue diseñado desde ADR-002, y el único en el que sus garantías —escritura atómica, numeración serializada, bloqueo optimista, índice fragmentado— son ciertas y no aproximadas. La alternativa que quedaba viva hasta la respuesta de H0-4 no era peor: **no existía**.

**Alternativas consideradas.** *(a)* Datos en la carpeta de red `Y:` con el proceso en la VM: descartada, agrega la latencia y los bloqueos de SMB a cambio de nada — el respaldo cubre el motivo por el que se quería. *(b)* Una máquina virtual Windows: descartada; Informática prefiere Linux, la aplicación es indiferente, y mantenerse en línea con lo que ya administran reduce el riesgo de que nadie sepa mantenerla.

**Consecuencias.** El proyecto deja de estar bloqueado por infraestructura: **R1 y R2 se cierran**. Aparece una dependencia operativa nueva y real: **alguien de la unidad tiene que poder administrar esa máquina virtual** —arrancarla, actualizarla, verificar el respaldo—, y eso es H10-9. Y quedan seis detalles de provisión sin definir —nombre o IP, puerto, arranque automático, recursos, cómo se suben los archivos, destino del respaldo— que no bloquean el desarrollo pero sí el despliegue.

---

## ADR-036 — Nada se decide en el arranque: lo que se puede resolver al usarlo, se resuelve al usarlo

**Estado:** Aceptada · 2026-08-31 · *Amplía a ADR-029*

**Contexto.** Es la **tercera vez** que el mismo defecto aparece con otra ropa, y ya no se puede tratar como una coincidencia:

| Ciclo | Cómo apareció | Qué pasaba |
|---|---|---|
| 12 | `if (SGC.core.requerimiento)` | Una guardia defensiva **apagaba una validación en silencio** ⇒ ADR-029 |
| 14 | El padrón leído una vez al arrancar | Una **baja no cortaba** una sesión ya abierta |
| 15 | La elección de padrón hecha una vez al arrancar | Si el padrón se crea **después** del arranque, el proceso **nunca lo ve**: todo da 403 sin un solo mensaje |

En el ciclo 15 el desarrollador corrigió la parte difícil —la sesión se revalida contra el padrón vivo en cada operación, y la baja, el bloqueo, la degradación y la elevación se reflejan al instante sin reingresar— pero quedó una línea antes:

```js
function crearServidor(datosDir) {
  const tienePadronReal = padronVivoReal.existe();   // ← se decide UNA vez
  if (tienePadronReal) { padronVivo = padronVivoReal; }
  else { padronVivo = crearPadronVivo(usuariosEjemplo); }
}
```

Ese `existe()` corre al crear el servidor. Si el padrón real aparece un minuto después, **el proceso sigue atado al padrón de ejemplo hasta que alguien lo reinicie** — y nadie va a saber que hay que reiniciarlo, porque no hay ningún error: los operadores ingresan, y cada transición devuelve 403.

**Y es alcanzable el día de la instalación**, porque el instructivo instala y arranca el servicio antes de sembrar el padrón.

**Decisión.** **Ninguna decisión que dependa del estado del disco se toma en el arranque.** Se toma en el momento en que se usa.

1. **La elección del padrón se resuelve en cada uso**, no al crear el servidor. El módulo de padrón vivo ya cachea por fecha de modificación: la elección de *cuál archivo* tiene que estar del mismo lado de esa caché.
2. **La regla general**, que es lo que esta ADR agrega a ADR-029: si un dato puede cambiar mientras el proceso corre —un archivo, un permiso, una carpeta— **no se retrata al arrancar y se consulta del retrato**. Se lee cuando hace falta, con la caché que convenga.
3. **Lo que sí se comprueba al arrancar, se comprueba para negarse a arrancar**, no para elegir un camino. La verificación de arranque de la ronda 15 —carpeta de datos escribible, catálogo presente, puerto libre, versión de Node— es correcta justamente porque **su única salida es no arrancar**.
4. **Un modo degradado no se elige solo.** Si el sistema puede funcionar de dos maneras y una es peor, la peor **no puede activarse por omisión y en silencio**. O se pide explícitamente —una opción en la línea de comandos, un valor en la configuración— o no existe. En este caso: **sin padrón real, el servidor no arranca**; el modo declarado sólo se activa pidiéndolo, y es para desarrollo y tests.

### Cómo reconocer la forma

Las tres instancias comparten una firma que conviene tener a mano al leer código:

> **Algo se evalúa una vez, el resultado se guarda, y después todo el mundo consulta el resultado en vez de la fuente.**

No importa si es un `if` que apaga una regla, un retrato de un archivo, o la elección de una ruta. **El síntoma siempre es el mismo: el sistema funciona, nadie ve un error, y el comportamiento es el equivocado.**

**Fundamento.** *Un modo degradado que se elige solo y no avisa es indistinguible de un defecto.* Y a esta escala no hay ninguna ganancia en decidir temprano: leer un archivo cuando hace falta cuesta microsegundos y elimina una clase entera de problema que ya nos costó tres ciclos encontrarla.

**Alternativas consideradas.** *(a)* Documentar que hay que reiniciar el servicio después de crear el padrón: descartada — es exactamente la clase de instrucción que alguien no lee, y el precio de no leerla es una tarde entera. *(b)* Que el servidor detecte el padrón nuevo y se reinicie solo: descartada, un proceso que se reinicia solo por un archivo que apareció es más difícil de razonar que uno que lee cuando necesita.

**Consecuencias.** El modo declarado deja de activarse por omisión, así que **hay que pedirlo explícitamente en los tests y en el desarrollo**. Es un cambio de superficie amplia pero mecánico. Y aparece un requisito de orden en la instalación que ahora el sistema hace cumplir en vez de pedirlo por escrito: **primero el padrón, después el servicio.**

---

## Plantilla

```
## ADR-NNN — Título

**Estado:** Propuesta | Aceptada | Superada por ADR-XXX | Rechazada · AAAA-MM-DD

**Contexto.** Qué situación obliga a decidir.
**Decisión.** Qué se resolvió, en una oración.
**Fundamento.** Por qué, con datos si los hay.
**Alternativas consideradas.** Qué se descartó y por qué.
**Consecuencias.** Qué se gana, qué se pierde, qué queda pendiente de validar.
```
