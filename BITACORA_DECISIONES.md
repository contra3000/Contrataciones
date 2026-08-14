# BITÁCORA DE DECISIONES — SGC

Registro de decisiones de arquitectura (formato ADR liviano). **Append-only:** una decisión superada no se borra; se marca `Superada por ADR-NNN` y se agrega la nueva al final.

Estados posibles: `Propuesta` · `Aceptada` · `Superada` · `Rechazada`
Plantilla al final del archivo.

| ADR | Título | Estado | Fecha |
|-----|--------|--------|-------|
| 001 | Rechazo del supuesto `file://` | Aceptada | 2026-08-13 |
| 002 | Núcleo agnóstico + adaptador de persistencia intercambiable | Aceptada | 2026-08-13 |
| 003 | Servidor mínimo en Node.js sin dependencias | Propuesta | 2026-08-13 |
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
| 015 | Ningún operador escribe sobre la carpeta de datos | Propuesta | 2026-08-13 |
| 016 | La app no custodia documentos firmados | Aceptada | 2026-08-13 |
| 017 | Identidad basada en el correo institucional, no en Windows | Aceptada | 2026-08-13 |
| 018 | El scraper del catálogo es infraestructura del proyecto | Aceptada | 2026-08-13 |
| 019 | Esquema de `datos.json` v2: `estado` como objeto y `auditoria` como registro | Aceptada | 2026-08-14 |
| 020 | Índice del catálogo en formato compacto | Aceptada | 2026-08-14 |

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
3. **Riesgo a vigilar en el piloto:** 200 caracteres son suficientes para reintroducir ambigüedad si el campo se usa como cajón de sastre. Si en el UAT aparece un porcentaje alto de renglones con aclaración, el problema no es el campo: es que el catálogo no está cumpliendo su función.

---

## ADR-015 — Ningún operador escribe sobre la carpeta de datos

**Estado:** Propuesta (depende de H0-1.5 y H0-3.9) · 2026-08-13

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
