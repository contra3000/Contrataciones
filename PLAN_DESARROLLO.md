# PLAN DE DESARROLLO — SGC (Sistema de Gestión de Contrataciones)

División Contrataciones Moreno · VII Brigada Aérea
Última actualización: **2026-08-31** · ciclo 15 aprobado · **paquete de despliegue listo, la instalación espera un ciclo** · incorporada ADR-036
Documentos relacionados: [`FullScopeDoc.md`](Contrataciones/FullScopeDoc.md) · [`AUDITORIA_InstruccionesCodigo.md`](AUDITORIA_InstruccionesCodigo.md) · [`BITACORA_DECISIONES.md`](BITACORA_DECISIONES.md) · [`RELEVAMIENTO_ENTORNO.md`](RELEVAMIENTO_ENTORNO.md)

> **Cómo se mantiene este archivo.** Cada hito tiene casillas de verificación. Al terminar una tarea se marca `[x]` y se actualiza la línea de estado del hito y la fecha de arriba. Toda decisión de arquitectura que se tome en el camino se registra en `BITACORA_DECISIONES.md`, no acá.

---

## 0. Estado general

| Hito | Nombre | Estado | Depende de |
|------|--------|--------|-----------|
| H0 | Relevamiento de entorno | ✅ **Cerrado** — Informática autorizó una VM Debian 12 sobre Proxmox ⇒ ADR-035. Restan seis detalles de provisión, que no bloquean | — |
| H1 | Fundaciones del repositorio | ✅ **Terminado** — ciclo 1 | — |
| H2 | Núcleo de dominio (sin UI) | ✅ **Terminado** — ciclo 2 | H1 |
| H3 | Persistencia + servidor local | ✅ **Terminado** — ciclos 3 y 8 (respaldo) | H1, H2 |
| H4 | Catálogo de ítems y autocompletado | ✅ **Terminado** — ciclo 4 | H1 |
| H5 | Vertical Fase 1 — Wizard del Usuario | ✅ **Terminado** — ciclo 5 | H2, H3, H4 |
| H6 | Tablero Kanban, roles y transiciones | ✅ **Terminado** — ciclos 6 y 7 (autorización) | H5 |
| H7 | Entregables y exportación AI-ready | ✅ **Terminado** — ciclos 7 y 8 | H5 |
| H8 | KPIs y Archivo Histórico | ✅ **Terminado** — archivo histórico (ciclo 8) y KPIs (ciclo 12, vía H15) | H6 |
| H9 | **Testing integral en local (UAT)** | 🟡 **40%** — auditoría independiente activa y prueba manual hecha; falta UAT con operadores | H6, H7 |
| H11 | Requerimiento completo y presupuestos | ✅ **Terminado** — ciclos 9 y 10 (pantalla de carga) | H7 |
| H12 | EETT con regla de desborde | ✅ **Terminado** — ciclo 10 | H11 |
| H13 | ANEXO 1 y salida hacia el pliego | ✅ **Terminado** — ciclos 11 a 13; el tipo de contrato real pasa a H20 | H11, H12 |
| H14 | Expediente adjudicado como base de uno nuevo | ✅ **Terminado** — ciclo 13 | H8 |
| H16 | Sistema de estilos aplicado a toda la app | ⬜ Pendiente — **nuevo** · final del roadmap | H13 |
| H17 | Identidad de la app y documentación IA-friendly | ⬜ Pendiente — **nuevo** · lo último | H16 |
| H15 | Observabilidad y tableros de indicadores por rol | ✅ **Terminado** — ciclos 12 y 13 | H8 |
| H19 | Diálogo de sugerencias del piloto | ✅ **Terminado** — ciclo 13 | H6 |
| H18 | Credenciales y administración del padrón | ✅ **Terminado** — ciclo 14 | H5 |
| H20 | Plantillas del pliego, versionadas y editables | ⬜ Pendiente — **nuevo, 2026-08-26** | H13 |
| H10 | Despliegue a intranet y piloto | 🟡 **50%** — paquete, servicio, respaldo e instructivo hechos; **tres correcciones antes de instalar** | H0, H9 |

> ### ⚠️ Sigue pendiente
> **Rescate del scraper del catálogo** (ADR-018). Al 2026-08-20 se conserva **sólo un fragmento**: el bloque `page.evaluate()` de un script Puppeteer/Playwright, ya versionado en `Contrataciones/tools/scraper-catalogo/`. **Falta** la URL de origen, el arranque del navegador, el bucle de paginación y la escritura de salida. Ver el README de esa carpeta.

**Principio rector del orden:** H5 es el primer punto donde el sistema produce valor real (resuelve el *garbage in* del FSD §1). Todo lo anterior existe para sostenerlo. Si hubiera que cortar alcance, se corta desde H8 hacia atrás, nunca desde H2.

---

## H0 — Relevamiento de entorno

**Objetivo:** eliminar las incógnitas de infraestructura que condicionan el despliegue. **No bloquea H1–H9**, gracias al adaptador de persistencia (ADR-002), pero **sí bloquea H10**.

- [x] H0-1 · ~~Qué servidor sirve el portal~~ · **Irrelevante desde ADR-035**: la aplicación no se hospeda en ese servidor, corre en su propia máquina virtual. Del portal sólo se necesita un enlace
- [x] H0-2 · ~~Motor server-side del portal~~ · **Irrelevante desde ADR-035**
- [x] H0-3 · **SÍ.** Informática provisiona una **máquina virtual** sobre **Proxmox** (Ryzen 5, 16 GB de RAM con ~8 GB libres). Prefieren **Linux**; las virtualizaciones actuales usan **Debian 12** ⇒ **ADR-035**. *Era la decisión de mayor impacto del proyecto y salió bien*
- [x] H0-4 · HTTPS: **NO. Sólo HTTP.** ⇒ sin contexto seguro **no existe el adaptador de archivos del navegador**: el servidor propio pasa de preferido a **único camino posible**. R1 y R2 se fusionan; H0-3 deja de ser una decisión de conveniencia. Y la clave viaja en claro (R24, aceptado): **no puede ser la misma de ningún otro sistema** ⇒ enmienda de ADR-027
- [x] H0-5 · Versión exacta de Edge/Chrome en las PCs de los operadores → **109.0.5414.120, cohort Windows 7** ⇒ ADR-011
- [x] H0-6 · **Reformulado por ADR-035.** La carpeta de datos ya no va en `Y:`: **vive en el disco de la máquina virtual**, y el único que escribe es el servidor. La ruta UNC de `Y:` sigue haciendo falta, pero **como destino del respaldo**, no como almacenamiento primario
- [x] H0-7 · Backup: hoy no existe, se puede establecer ⇒ pasa a ser requisito del proyecto (H3-8, H10-4)
- [x] H0-8 · Catálogo: scraping propio del sitio estatal, actualización mensual manual ⇒ ADR-014
- [x] H0-9 · **Debian 12.** Trae **Node 18**, que alcanza (cero dependencias: `node:http`, `node:fs`, `node:crypto`). Node 20 LTS desde el repositorio oficial sería mejor pero **no es requisito**. *El techo de Chrome 109 es del navegador, no del servidor*
- [x] H0-10 · Sistema de firmas: **carga manual, sin retorno del firmado** ⇒ ADR-012 y ADR-016. Queda una sola verificación: probar que acepta un PDF de "Microsoft Print to PDF"
- [x] H0-11 · Script de scraping: **conservado sólo en un historial de chat** ⇒ ADR-018, rescate urgente (H4-8)
- [x] H0-12 · Excepción de catálogo: **ítem más similar + aclaración de hasta 200 caracteres** ⇒ enmienda de ADR-014
- [x] H0-14 · Cuentas de Windows: **compartidas y sin contraseña** ⇒ ADR-017
- [x] H0-15 · Cuentas de Windows: **una por PC**. La identidad del operador se basa en el **correo institucional**, no en Windows ⇒ ADR-017 Aceptada
- [x] H0-16 · **IP fija**, pero **no hay una PC por persona**: la restricción de rol por máquina **se descarta** (ADR-017 medida 4). La identidad se resuelve sólo con el ingreso por clave ⇒ **H3-12 se retira**
- [x] H0-17 · El scraper corre **fuera de la intranet**; el archivo se traslada a mano. **La app no emite peticiones al exterior** ⇒ ADR-018
- [x] H0-18 · **Sin problema**: se pueden subir archivos al servidor y actualizar la versión de la aplicación cuando haga falta. Habilita la rutina mensual del catálogo (H4-13)
- [x] H0-13 · Validación de los 18 pasos: **cada sector confirmó su fase** ⇒ riesgo R4 baja de Alto a Bajo

**Entregable:** `RELEVAMIENTO_ENTORNO.md` completado.
**Criterio de aceptación:** ✅ **Cumplido el 2026-08-29.** ADR-003, ADR-012 y ADR-015 están las tres en `Aceptada`.

### Lo único que falta de Informática, y no bloquea el desarrollo

Seis detalles de provisión de la máquina virtual. Bloquean el **despliegue**, no el trabajo:

- [ ] H0-19 · **Nombre o IP fija** de la máquina virtual, para que los operadores lo escriban en el navegador. Un nombre es mucho mejor que una IP: si algún día la máquina cambia, no hay que avisarle a catorce personas
- [ ] H0-20 · **Puerto.** El 80 en Linux exige privilegio o `setcap`; con 8080 u 8123 alcanza y evita el trámite. Definir cuál
- [ ] H0-21 · **Arranque automático como servicio de systemd**, para que levante sola al reiniciar la máquina
- [ ] H0-22 · **Recursos de la VM**: 1 vCPU y 2 GB de RAM sobran (menos de diez usuarios, menos de cien expedientes al año — ADR-008). Confirmar
- [ ] H0-23 · **Cómo se suben los archivos** a la máquina virtual: SSH/SFTP, carpeta compartida, o los sube Informática
- [ ] H0-24 · **Respaldo**: ¿la VM entra en el respaldo de Proxmox? ¿Y podemos escribir el respaldo diario de la aplicación a `Y:` o a otra ruta de red?

---

## H1 — Fundaciones del repositorio

**Objetivo:** que exista un esqueleto ejecutable y un documento de reglas que no se contradiga a sí mismo.

- [ ] H1-1 · Definir si el proyecto vive en el repo git `Contrataciones/` (recomendado) o en una carpeta nueva. Mover los documentos de planificación al repo
- [ ] H1-2 · Redactar `InstruccionesCodigo_v2.md` aplicando la tabla de correcciones de la auditoría §3
- [ ] H1-3 · Estructura de directorios (ver abajo) y `.gitignore`
- [ ] H1-4 · `config.js`: los 18 estados del FSD §4 como máquina de estados declarativa, con `fase`, `rolEjecutor`, `estadosSiguientes`, `estadosDevolucion`, `camposRequeridos`, `entregablesObligatorios`
- [ ] H1-5 · `config.js`: catálogo cerrado de motivos de devolución (versión inicial, a validar con operadores en H9)
- [ ] H1-6 · Esquemas JSON versionados + fixtures de ejemplo
- [ ] H1-7 · Arnés de tests con `node --test` (built-in, cero dependencias) y un test trivial que pase
- [ ] H1-8 · `README.md` con "cómo levantar esto en 3 comandos"
- [ ] H1-9 · **Guardián de compatibilidad y aislamiento** (ADR-011, ADR-018): verificador que recorre `app/` y falla el build si aparece (a) `toSorted`, `Object.groupBy`, `Promise.withResolvers`, anidamiento CSS nativo, `popover`, `text-wrap: balance` o cualquier ítem de la lista de veto de Chrome 109, o (b) **cualquier URL absoluta `http://` o `https://`**. Es la única forma de que ambas restricciones sobrevivan seis meses de desarrollo
- [ ] H1-10 · **Padrón de operadores** `config/usuarios.json`: `{ nombre, apellido, email, roles: [], sector, activo }`, con el correo institucional como clave única (ADR-017)

**Estructura propuesta** (reemplaza a §3 del documento original):

```
/AppOptimizar
├── PLAN_DESARROLLO.md            (este archivo)
├── BITACORA_DECISIONES.md
├── AUDITORIA_InstruccionesCodigo.md
├── RELEVAMIENTO_ENTORNO.md
├── app/                          → lo único que se despliega
│   ├── index.html
│   ├── css/main.css
│   ├── js/
│   │   ├── core/                 (dominio puro, sin DOM, sin red — testeable en Node)
│   │   │   ├── namespaces.js  config.js  estados.js  validacion.js
│   │   │   ├── auditoria.js   migraciones.js  utils.js
│   │   ├── adapters/             (persistencia intercambiable — ADR-002)
│   │   │   ├── repo.js           (interfaz + selector de implementación)
│   │   │   ├── repo.memoria.js   repo.http.js   repo.fsa.js
│   │   ├── catalogo/             (búsqueda en cascada — ADR-004)
│   │   ├── views/                (login, kanban, expediente, dashboard, archivo)
│   │   ├── renders/              (plantillas de entregables)
│   │   └── export/
│   ├── catalogo/                 (shards generados — no se editan a mano)
│   └── assets/
├── server/                       → servidor Node sin dependencias (ADR-003)
├── tools/                        → build del catálogo, generadores de datos de prueba
├── tests/                        → unit + integración + e2e
└── datos-prueba/                 → simulacro de la carpeta de red (NO se despliega)
```

**Criterio de aceptación:** `node --test` corre en verde y `config.js` describe los 18 pasos sin que ninguna vista los conozca.

---

## H2 — Núcleo de dominio (sin UI)

**Objetivo:** que las reglas del negocio existan, estén testeadas y no dependan del navegador. Es el activo más duradero del proyecto: sobrevive a cualquier cambio de UI o de infraestructura.

- [ ] H2-1 · Motor de transiciones: `puedeAvanzar(expediente, rol)`, `avanzar()`, `devolver(motivo)`, leyendo siempre de `config.js`
- [ ] H2-2 · Validadores por estado, derivados de `camposRequeridos`
- [ ] H2-3 · Auditoría con hash encadenado (ADR-006)
- [ ] H2-4 · Migraciones por `schemaVersion` (con test de un documento v1 → v2 que no pierde datos)
- [ ] H2-5 · Registro de timestamp en cada transición (insumo del futuro motor de SLA, que queda fuera de la v1 — ADR-013)
- [ ] H2-6 · **Tests unitarios de los 18 estados**: transición válida, transición prohibida por rol, transición prohibida por campos faltantes, devolución con y sin motivo

**Criterio de aceptación:** cobertura completa de la matriz estado × rol. Un cambio en `config.js` (agregar un paso) no requiere tocar código, solo agregar el caso de test.

---

## H3 — Persistencia y servidor local

**Objetivo:** que los datos se guarden de verdad, con concurrencia correcta, en algo que corra igual en tu PC y en el servidor.

- [ ] H3-1 · Interfaz `repo` (ADR-002) y `repo.memoria.js` para tests
- [ ] H3-2 · Servidor Node sin dependencias: estáticos + API de `repo`
- [ ] H3-3 · Escritura atómica `tmp + rename`
- [ ] H3-4 · Verificación de versión del lado del servidor: dos escrituras concurrentes ⇒ la segunda recibe `409 Conflicto` y la UI ofrece recargar
- [ ] H3-5 · Numeración de expedientes serializada con lock de archivo (ADR-009)
- [ ] H3-6 · Índice fragmentado `idx/<id>.json` (ADR-005)
- [ ] H3-7 · Política de carpeta de red inaccesible: mensaje claro, modo lectura, borrador local que no se pierde
- [ ] H3-8 · Script de backup de la carpeta de datos (copia diaria con retención)
- [ ] H3-9 · `repo.http.js` en el cliente, con manejo de conflicto
- [ ] H3-11 · El servidor registra **IP y nombre de equipo** de cada petición en la auditoría, junto al rol declarado (ADR-017, medida 3). Es el único dato de identidad que el operador no elige
- [~] H3-12 · ~~Restricción de rol por máquina~~ · **Retirada el 2026-08-28**: no hay una PC por persona, atar el rol a la máquina daría por buena una atribución falsa. Se mantiene el registro de IP y equipo como dato (H3-11), no como control
- [ ] H3-13 · Edición del padrón de operadores restringida a la máquina del Jefe de Contrataciones, verificado del lado del servidor (ADR-017, medida 5)
- [ ] H3-10 · **Test de concurrencia automatizado**: 20 escrituras simultáneas sobre el mismo expediente ⇒ exactamente 1 gana, 19 reciben conflicto, el archivo nunca queda corrupto ni truncado

**Criterio de aceptación:** H3-10 pasa 50 veces seguidas sin falsos positivos.

---

## H4 — Catálogo de ítems y autocompletado

**Objetivo:** que el operador encuentre el ítem correcto entre 159.366 en menos de 10 segundos, sin descargar 40 MB.

- [ ] H4-1 · `tools/build-catalogo.js`: genera rubros, clases, shards por clase e índice de tokens; **descarta el campo `estado`** y estampa `catalogoVersion` (ADR-004, ADR-014)
- [x] H4-2 · Campo `estado` verificado con el usuario: los inactivos ya vienen filtrados, la columna sobra
- [ ] H4-3 · Componente de búsqueda: texto libre sobre clases + cascada rubro → clase → ítem
- [ ] H4-4 · Selección múltiple de renglones con cantidad y unidad de medida
- [ ] H4-5 · Validación estricta: código inexistente = error, sin escape por texto libre (ADR-014). Falta definir el **procedimiento de excepción** (H0-12)
- [~] H4-8 · **En curso** · Rescate del scraper. Fragmento recuperado y versionado en `Contrataciones/tools/scraper-catalogo/`. Falta el resto del script (URL, launcher, paginación, salida) o, en su defecto, la URL del sitio para reconstruirlo
- [ ] H4-10 · Hacer el scraper **reanudable**: una corrida de 2 horas que falla al 80% sin poder retomar es una corrida que en la práctica no se hace todos los meses
- [ ] H4-13 · Documentar el **procedimiento mensual completo**: correr el scraper en la PC sin intranet → revisar el reporte de diferencias → trasladar el archivo → `build-catalogo` → publicar `catalogo/` con su `catalogoVersion` (ADR-018)
- [ ] H4-11 · **Reporte mensual de diferencias**: ítems nuevos, ítems que desaparecieron del origen (candidatos a baja) y descripciones modificadas. Es el mecanismo por el cual el usuario "se entera" de las bajas
- [ ] H4-12 · Campo `aclaracion` en el renglón: opcional, máximo 200 caracteres, **impreso en el entregable** y contabilizado como indicador (enmienda ADR-014)
- [ ] H4-9 · `datos.json` registra con qué `catalogoVersion` se cargaron sus renglones (trazabilidad para auditoría)
- [ ] H4-6 · Caché opcional en IndexedDB de los shards ya visitados
- [ ] H4-7 · **Medición de rendimiento** con el catálogo real: primera carga, tecleo, cambio de clase

**Criterio de aceptación:** primera carga de la vista de búsqueda < 1 s sobre la red de intranet; respuesta al tecleo < 100 ms; ningún archivo servido supera los 300 KB.

---

## H5 — Vertical Fase 1: Wizard del Usuario Generador

**Objetivo:** el primer corte vertical completo y usable. Un usuario crea un expediente, carga renglones del catálogo y genera su Especificación Técnica. **Este es el hito que justifica el proyecto.**

- [ ] H5-1 · Selección de operador desde el padrón, mostrando **nombre y apellido, rol y correo institucional a la vista** (ADR-017). Sin contraseña ni PIN en la v1. Operador activo siempre visible, cambio de operador a un clic y cierre por inactividad a los 15 minutos
- [ ] H5-2 · Wizard paso a paso con validación estricta antes de avanzar
- [ ] H5-3 · Borrador local que sobrevive a un cierre accidental del navegador
- [ ] H5-4 · Integración del selector de catálogo (H4)
- [ ] H5-5 · Fast-Track: descarga del JSON modelo y carga de un JSON pre-poblado, **con validación defensiva** (un JSON generado por IA externa es entrada no confiable: validar estructura, tipos y códigos de catálogo antes de aceptarlo)
- [ ] H5-6 · Generación del entregable de la Fase 1: HTML compuesto + hoja de impresión + **conversión a PDF listo para firmar** (ADR-012). Validar el PDF resultante contra el sistema de firmas real **antes** de construir las plantillas restantes
- [ ] H5-7 · Persistencia real vía `repo` y aparición del expediente en el índice

**Criterio de aceptación:** un usuario real de la División completa una Especificación Técnica de principio a fin, sin asistencia, en una sesión. Ese es el test.

---

## H6 — Tablero Kanban, roles y transiciones

- [ ] H6-1 · Tablero por fase con badge de estado (sin semáforo de vencimiento — ADR-013) (ADR-010)
- [ ] H6-2 · Vista de tarjeta con historial, entregables y responsables
- [ ] H6-3 · Botones Avanzar / Devolver por Observación, habilitados según rol
- [ ] H6-4 · Modal de devolución con catálogo cerrado de motivos
- [ ] H6-5 · Visibilidad global para todos los roles, acción restringida al rol que corresponde
- [ ] H6-6 · Manejo visible del conflicto de concurrencia (mensaje y recarga, sin pérdida de lo tipeado)
- [ ] H6-7 · Filtros y búsqueda de expedientes

**Criterio de aceptación:** recorrer los 18 pasos de punta a punta cambiando de rol, con auditoría completa y coherente al final.

---

## H7 — Entregables y exportación AI-ready

- [ ] H7-1 · Plantillas de los entregables por fase (SCo, pliego, disposición, OC)
- [ ] H7-2 · Impresión paginada correcta (`@media print`, saltos de página, encabezados, membrete)
- [ ] H7-3 · Los entregables se guardan en la carpeta del expediente y se enlazan en la tarjeta
- [ ] H7-7 · **Circuito de firma** (ADR-012, ADR-016): el PDF se genera con `Imprimir → Guardar como PDF` y el operador lo sube a mano. El firmado **no vuelve** a la app; se guarda solo una referencia (identificador, fecha, firmante)
- [ ] H7-8 · Leyenda fija en la vista del expediente y en el `resumen.md`: **los instrumentos firmados residen fuera de este sistema**. Sin esto, tanto una auditoría como un LLM que lea el export van a interpretar que el expediente está incompleto (ADR-016)
- [ ] H7-4 · Exportación del `datos.json` crudo
- [ ] H7-5 · Generación de `resumen.md` narrativo desde la auditoría y el histórico
- [ ] H7-6 · Modal de advertencia de datos sensibles, obligatorio antes de toda descarga

**Criterio de aceptación:** un entregable impreso desde la app es aceptable para firma física sin retoques.

---

## H8 — KPIs y Archivo Histórico

*(Alcance reducido: sin motor de SLA en la v1 — ADR-013)*

- [ ] H8-1 · Campo opcional de fecha límite por expediente, editable a mano, sin semáforos ni alertas
- [ ] H8-2 · Dashboard: tiempo por fase, tiempo total, tasa de devolución por motivo y por sector. **Estos números son los que después van a permitir discutir los plazos de la norma con evidencia propia**
- [ ] H8-6 · Indicador **"renglones con aclaración, por rubro"**: es la agenda de trabajo de la actualización mensual del catálogo. Cierra el círculo entre el uso real y el mantenimiento del dato (enmienda ADR-014)
- [ ] H8-3 · Migración a Archivo Histórico al llegar a "Perfeccionada" (ejecutada por el servidor, no por el navegador)
- [ ] H8-4 · Vista del histórico, con listado por directorio y no por índice
- [ ] H8-5 · Verificar que nada se borra sin confirmación explícita y sin copia previa

**Criterio de aceptación:** los KPIs se calculan sobre datos reales de H9 y los números resisten una verificación manual.

---

## H9 — Testing integral en local (etapa previa al despliegue)

**Objetivo:** agotar los errores en tu PC, con datos reales y usuarios reales, antes de que la intranet vea una sola línea.

### Niveles de prueba

| Nivel | Qué prueba | Herramienta | Cuándo corre |
|---|---|---|---|
| N1 · Unitario | Dominio puro: estados, validaciones, migraciones, hash | `node --test` (built-in) | En cada cambio |
| N2 · Integración | Servidor: escritura atómica, conflictos, numeración, backup | `node --test` contra el servidor real | En cada cambio del servidor |
| N3 · End-to-end | Flujos de navegador completos | Playwright (**solo en la PC de desarrollo**, no se despliega), fijando **Chromium 109** para que coincida con el parque real (ADR-011) | Antes de cada hito |
| N4 · Carga/estrés | Catálogo real y volumen de un año | Script generador en `tools/` | H9 |
| N5 · UAT | Operadores reales con casos reales | Guion de pruebas manual | H9 |

### Tareas

- [ ] H9-1 · Generador de datos de prueba: 100 expedientes distribuidos en los 18 estados, con historial verosímil
- [~] H9-2 · ~~Prueba contra una carpeta SMB real~~ · **Retirada el 2026-08-29 (ADR-035)**: los datos viven en el disco de la máquina virtual, no en la carpeta de red. **Se reemplaza por**: prueba contra la máquina virtual definitiva, con los operadores conectándose por la LAN
- [ ] H9-3 · Prueba multiusuario: dos perfiles de navegador abiertos simultáneamente actuando como roles distintos sobre el mismo expediente
- [ ] H9-4 · Suite E2E de los recorridos críticos: alta completa, avance de 18 pasos, devolución y recuperación, conflicto de concurrencia, archivado
- [ ] H9-5 · Pruebas de degradación: red caída a mitad de un guardado, archivo corrupto, JSON de Fast-Track malformado, catálogo faltante, navegador viejo
- [ ] H9-6 · Verificación de a11y y de navegación completa por teclado en el wizard
- [ ] H9-7 · Prueba de impresión real en la impresora de la División **y prueba del PDF generado dentro del sistema de firmas real** (ADR-012). Si el sistema de firmas rechaza el PDF, se descubre acá y no en producción
- [ ] H9-11 · **Prueba en una PC real del parque** (Windows 7 + Chrome 109), no solo en la PC de desarrollo. Es la única forma de validar rendimiento en el hardware que va a existir
- [ ] H9-8 · **UAT con 2 o 3 operadores reales** sobre un expediente histórico ya tramitado en papel, comparando el resultado
- [ ] H9-9 · Prueba de backup y **restauración** (un backup no probado no es un backup)
- [ ] H9-10 · Registrar los hallazgos del UAT y decidir cuáles bloquean el despliegue

**Criterio de aceptación de H9 (puerta de salida hacia H10):**
1. N1 a N4 en verde.
2. Cero defectos de severidad alta abiertos.
3. Al menos un expediente real recorrido de punta a punta por operadores distintos, con auditoría íntegra.
4. Restauración desde backup verificada.

---

## H10 — Despliegue a intranet y piloto

- [ ] H10-1 · Cerrar H0 y confirmar el adaptador definitivo
- [ ] H10-2 · **Paquete de despliegue** para Debian 12: `app/`, `server/`, `tools/`, `config/`, el catálogo, y un `instalar.sh` que crea el usuario del servicio, la carpeta de datos y los permisos
- [ ] H10-2b · **Servicio de systemd**: arranca al iniciar la máquina, se reinicia si se cae, escribe al registro del sistema. *Un proceso que hay que arrancar a mano es un proceso que un lunes a la mañana no está corriendo*
- [ ] H10-2c · **Verificación de arranque**: el servidor comprueba al levantar que el padrón existe, que la carpeta de datos es escribible y que la versión de Node alcanza; si algo falta, **no arranca y dice qué falta**
- [ ] H10-2d · **Instructivo de una página para Informática**: qué instalar, qué puerto abrir, cómo se actualiza, cómo se reinicia
- [ ] H10-2e · **Procedimiento de actualización de versión**: subir, parar el servicio, reemplazar, arrancar, verificar. Con vuelta atrás en un comando

**Estado al 2026-08-31 (ciclo 15): 50%.** El paquete, el servicio de systemd, la verificación de arranque, el respaldo con destino y el instructivo están entregados y auditados. **La instalación espera** por tres correcciones:

- [ ] H10-2f · **ADR-036 · la elección de padrón se resuelve al usarlo, no al arrancar.** Hoy `crearServidor` decide una sola vez: si el padrón aparece después, el proceso nunca lo ve y **todo da 403 en silencio**. Y **sin padrón real el servidor no arranca**: el modo declarado sólo se activa pidiéndolo
- [ ] H10-2g · El comando de siembra del padrón del `INSTRUCTIVO.md` **está roto**: apunta `--archivo` a un JSON que la carga masiva no sabe leer. Falla en todas las líneas. Es el comando del día uno
- [ ] H10-2h · El mensaje de arranque con el padrón ilegible **filtra el error de V8 en inglés**. Único mensaje que rompe la regla del castellano
- [ ] H10-2i · El instructivo ordena **primero el padrón, después el servicio**, y lo dice donde se lee
- [ ] H10-3 · Configurar permisos NTFS de la carpeta de datos y del Archivo Histórico
- [ ] H10-4 · Backup automatizado en producción, con restauración probada en producción
- [ ] H10-5 · Despliegue y enlace desde el portal de intranet existente
- [ ] H10-6 · **Piloto en paralelo:** los primeros expedientes se tramitan en el sistema *y* por el circuito actual, hasta que la División confíe en la herramienta
- [ ] H10-7 · Capacitación breve por rol (una página por rol, no un manual)
- [ ] H10-8 · Plan de rollback: cómo se vuelve atrás en 10 minutos y qué pasa con los expedientes ya cargados
- [ ] H10-9 · Definir quién mantiene esto y cómo se pide un cambio

**Criterio de aceptación:** un mes de operación en paralelo sin pérdida de datos y con los operadores prefiriendo el sistema al circuito anterior.

---

---

## H11 · H12 · H13 — Los entregables reales del circuito

**Agregados el 2026-08-19**, al incorporarse los documentos reales del proceso actual (`EjemplosProcesoActual/`). El análisis completo está en `ANALISIS_ENTREGABLES_REALES.md` y las decisiones de datos en **ADR-022**.

Van **después de H8** y **antes del pulido**. Alcance: estructura de datos y generación funcional. **Sin estilos**: lo cosmético se hace al final del roadmap.

Dos hallazgos que abaratan todo esto:

- **El código de catálogo ya encaja.** El "Código SIByS" de los documentos oficiales es nuestro `codigo` partido en tres (`2.5.8-378.186` → IPP `2.5.8` / Clase `378` / Ítem `186`), verificado contra el catálogo real. No hay tabla de equivalencias que construir.
- **El pliego no se rehace.** `DocUOC/Generador de Pliegos/` ya funciona con datos en YAML, y casi todo ese YAML sale de la suma del requerimiento y el ANEXO 1. La aplicación **emite el YAML**; el generador existente sigue produciendo el pliego.

### H11 — Requerimiento completo y presupuestos

- [ ] H11-1 · Extender el esquema del expediente con los campos del `MODELO REQ.` (Solicitud de Gastos): encabezado, rubro comercial, modalidad y procedimiento sugeridos, objeto, prioridad
- [ ] H11-2 · Bloque de **imputación presupuestaria** (16 campos) con propiedad del rol `contaduria`, editable sólo en el paso 16 (ADR-022 §4)
- [ ] H11-3 · **Adjuntos**: el usuario sube presupuestos en PDF o imagen, que se guardan en la carpeta del expediente
- [ ] H11-4 · **Valores de referencia** por renglón: N valores, cada uno con `{presupuestoId, base: unitario|total, valor}` (ADR-022 §2)
- [ ] H11-5 · **Normalización y promedio**: todo a unitario antes de promediar; preventivo por renglón y total de la contratación. Rechazar la base `total` si la cantidad es cero
- [ ] H11-6 · `cantidadMaxima` por renglón, cargada por el usuario, con la etiqueta y la ayuda que expliquen que es el tope **por Solicitud de Provisión** (ADR-022 §3, que diverge del Art. 112 de forma deliberada y registrada)
- [ ] H11-10 · `cantidadMinima` opcional por renglón (Art. 52 de la disposición); se imprime sólo si tiene valor
- [ ] H11-7 · Justificación de Orden de Compra Abierta como campo del requerimiento, no como archivo aparte
- [ ] H11-8 · Descomposición del código en IPP / Clase / Ítem al imprimir
- [ ] H11-9 · Plantilla del requerimiento, que reemplaza a la Especificación Técnica genérica del ciclo 7

- [ ] H11-11 · **Pantalla de carga del requerimiento** (pendiente del ciclo 9, declarado por el desarrollador): formulario de los 16 campos del encabezado, subida de presupuestos y edición de los valores de referencia por renglón. Hoy sólo se pueden cargar por API — **es la pieza que falta para que el usuario final use H11**
- [ ] H11-12 · El presupuesto se elige de una lista, no se escribe el identificador a mano (cierra R-09-1: hoy un `presupuestoId` inexistente pasa la validación de forma)

**Estado al 2026-08-21 (ciclo 10, segunda pasada): terminado.** H11-1 a H11-12 auditados. El preventivo verificado con cinco casos manuales; la pantalla de carga entregada y partida en seis módulos; el presupuesto se elige de una lista y el servidor rechaza un `presupuestoId` fantasma con 400 (R-09-1 **cerrado por los dos lados**).

**Criterio de aceptación:** un requerimiento con tres renglones, dos presupuestos y bases mixtas produce el preventivo correcto, verificable a mano, **cargado desde la pantalla**.

### H12 — EETT con regla de desborde

- [ ] H12-1 · Límite de aclaración a **256 caracteres** (enmienda de ADR-014); actualizar validador, tests y contador visible. **Hallazgo H1-09 del ciclo 9**: hoy hay `MAX_ACLARACION = 200` en cuatro archivos (`core/validacion.js`, `catalogo/renglones.js`, `views/fasttrack.js`, `views/pasos.js`) y el test lo verifica
- [ ] H12-2 · Al pasarse: el requerimiento imprime `"según anexo [alfa|bravo|charly]"` y el renglón entra al anexo con el texto completo
- [ ] H12-3 · Bloque de condiciones particulares comunes a todos los renglones, opcional
- [ ] H12-4 · Nomenclatura automática de anexos
- [ ] H12-5 · Si ningún renglón desborda y no hay condiciones particulares, **el anexo no se genera**
- [ ] H12-6 · Ficha por renglón: `Renglón N° | Código SIByS | Descripción ONC | Especificaciones Técnicas`

**Estado al 2026-08-21 (ciclo 10): terminado.** 255 y 256 se imprimen completos; 257 desborda al anexo con la referencia `"según anexo alfa"`. Techo duro de entrada **2000, aplicado también en el servidor** (2001 devuelve 400). El criterio de conteo es **puntos de código**, con **una sola definición** en `utils.contarCaracteres`, usada por los cinco lugares que antes contaban cada uno por su cuenta.

- [ ] H12-7 · **Pendiente**: cuando un renglón desborda, el anexo pasa a ser **entregable obligatorio**. Hoy se puede avanzar de estado sin generarlo, y el requerimiento impreso queda citando un anexo que nunca existió

**Criterio de aceptación:** un renglón de 250 caracteres queda en el requerimiento; uno de 300 dispara el anexo y deja la referencia correcta.

### H13 — ANEXO 1 y salida hacia el pliego

- [ ] H13-1 · Formulario de ANEXO 1 para el rol Abastecimiento, con sus 14 secciones
- [ ] H13-2 · Las secciones 9 a 12 (interadministrativas, bienes de uso, hardware/software, infraestructura) como **bloques condicionales**, no catorce secciones con "NO CORRESPONDE" repetido
- [ ] H13-3 · **Precarga** desde el requerimiento: objeto, justificación, datos de la unidad, cantidades
- [ ] H13-4 · El campo de precio de referencia se deriva de los presupuestos que cargó el usuario
- [ ] H13-5 · Planilla de OCA cuando la modalidad lo pide, con las cantidades del requerimiento
- [ ] H13-6 · **Exportación del YAML** que consume el generador de pliegos existente

- [ ] H13-7 · **ADR-029 · las guardias silenciosas** de `validacion.js:122`, `:133` y `renders/requerimiento.js:115` pasan al patrón de lanzamiento de `repo.memoria.js`, más un test que arranque el servidor y verifique que el núcleo esté completo
- [ ] H13-8 · La **causal normativa de OCA** como ayuda contextual **en la pantalla**, no sólo en el documento impreso
- [ ] H13-9 · Cota propia para los catorce campos del encabezado que hoy sólo acota el límite de 4 MB del cuerpo
- [ ] H13-10 · Comentario vencido en `fasttrack.js:9` ("más de 200 caracteres se rechazan")

**Estado al 2026-08-25 (ciclo 11): 75%.** El ANEXO 1 con sus catorce secciones y los bloques condicionales está; **el generador real produce el pliego con nuestro YAML, sin edición manual** (331 líneas). Pendientes de la ronda 12:

- [ ] H13-11 · **ADR-031** · el emisor de YAML entrecomilla siempre; se elimina `necesitaEscapar`. Verificación de ida y vuelta contra un parser real, no tabla a mano. Siete de veinte casos rompen hoy, y dos impiden que el archivo parsee
- [ ] H13-12 · **ADR-030** · `pliego-bases-condiciones` deja de ser entregable obligatorio y pasa a `vista-previa-pliego`, rotulada y sin pie de firma. El entregable de ese estado pasa a ser el YAML
- [ ] H13-13 · El **precio de referencia** del ANEXO 1 §2 se deriva de los presupuestos (preventivo ya calculado), no se retipea
- [ ] H13-14 · **Trazabilidad de la precarga**: toda edición de un campo precargado desde el requerimiento queda registrada
- [ ] H13-15 · El **test de integridad del núcleo falla** si se quita un módulo de la lista (hoy sólo verifica que los archivos existan en disco)
- [ ] H13-16 · `CAUSAL_OCA`: dos textos distintos con **dos nombres distintos**, en un solo lugar
- [ ] H13-17 · Mapear `frecuencia_provision`, `plazo_entrega` y `horario` al YAML. Hoy salen vacíos y **el pliego sale con cláusulas en blanco**, que es peor que no salir
- [ ] H13-18 · **Pendiente del Jefe de Contrataciones**: dónde va la planilla de cantidades máximas dentro del pliego (último tramo de R17)

**Criterio de aceptación:** el YAML emitido produce un pliego con el generador actual, sin edición manual.

### Pendiente de definir

- Las **Disposiciones** de Autorización y Adjudicación no tienen plantilla todavía. Cuando estén, se mapean igual que el pliego.
- La **normativa en Markdown** con las causales de Orden de Compra Abierta no aparece en el proyecto. Es necesaria para H11-7.


---

## H14 · H15 · H16 · H17 — Reuso, observabilidad, estilo e identidad

**Agregados el 2026-08-20**, por indicación del Jefe de Contrataciones al cierre del ciclo 9.

El orden importa: **H14 y H15 van antes del UAT (H9)** porque afectan lo que el sistema captura, y el dato que no se captura durante el UAT no se recupera. **H16 y H17 van al final**, después de que todo funcione: son pulido e identidad, no función.

### H14 — Un expediente adjudicado como base de uno nuevo

*(ADR-025. Es lo más barato del roadmap: el dato ya está guardado.)*

- [ ] H14-1 · Botón **"Usar como base"** en la vista del Archivo Histórico, sobre expedientes perfeccionados
- [ ] H14-2 · Copia por **lista blanca** de campos: renglones (código, descripción, unidad, cantidad, aclaración, máximos y mínimos), objeto, justificación de la necesidad, especificaciones técnicas, rubro comercial, modalidad y procedimiento sugeridos
- [ ] H14-3 · **Nunca se copian**: número, fechas, estado, auditoría, registro de eventos, entregables, **presupuestos adjuntos**, **valores de referencia**, imputación, ni referencias a firmas
- [ ] H14-4 · **Revalidación de códigos** contra la `catalogoVersion` vigente: un ítem que ya no existe se marca y se pide reemplazo, no se copia en silencio
- [ ] H14-5 · El expediente nuevo registra `basadoEn` y lo muestra en pantalla
- [ ] H14-6 · Pantalla de revisión antes de crear: el usuario ve qué se copió y qué no, y puede desmarcar renglones

**Criterio de aceptación:** un expediente del año anterior con cinco renglones produce uno nuevo en menos de un minuto, **sin un solo precio heredado** y con los códigos dados de baja marcados.

### H15 — Observabilidad y tableros de indicadores por rol

*(ADR-024. Absorbe y amplía a H8-2 y H8-6. Tiene que estar **antes** del UAT.)*

- [ ] H15-1 · **Registro de eventos** `eventos.jsonl` append-only por expediente, escrito por el servidor con la misma escritura atómica del resto
- [ ] H15-2 · Instrumentar los eventos de ADR-024 §1: transiciones, devoluciones con motivo, ediciones por grupo de campos, conflictos 409, rechazos 403 con razón, generación de entregables, exportaciones, altas y bajas de renglones, uso y longitud de `aclaracion`, **búsquedas de catálogo sin resultado**, permanencia por paso, `catalogoVersion` y versión de la app vigentes
- [ ] H15-3 · **Ningún indicador se persiste calculado**: todos se derivan del registro al mostrarlos
- [ ] H15-4 · **Catálogo de fichas de indicador**, declarativas: qué evento, qué agregación, qué corte. Agregar una ficha no debe requerir tocar la vista
- [ ] H15-5 · **Tablero configurable por operador**: qué fichas ve y en qué orden. La preferencia se guarda **en el padrón, junto al operador**, no en el navegador — una PC compartida no debe imponerle el tablero de un rol al siguiente
- [ ] H15-6 · **Tablero por defecto por rol**, para que nadie tenga que configurar nada el primer día
- [ ] H15-7 · **Vista de exploración**: filtrar el registro de eventos y exportarlo a CSV y JSON. Es lo que permite que dentro de seis meses aparezca un indicador que hoy no se nos ocurre, y lo que alimenta el análisis por LLM
- [ ] H15-8 · Indicadores de arranque: tiempo por fase, tiempo total, tasa de devolución por motivo y por sector, renglones con aclaración por rubro (H8-6), **búsquedas sin resultado**, **dispersión entre presupuestos de un mismo renglón** (R-09-3), porcentaje de expedientes creados con `basadoEn`
- [ ] H15-9 · El registro de eventos entra en la **advertencia de datos sensibles** previa a toda descarga (H7-6): tiene contenido operativo sobre personas identificadas
- [ ] H15-10 · Aviso suave en la carga: cuando los valores de referencia de un renglón difieren más de un umbral configurable, se marca sin bloquear

**Criterio de aceptación:** un indicador que nadie pidió durante el desarrollo se puede construir sobre los datos ya capturados, sin volver a instrumentar nada.

### H16 — Sistema de estilos aplicado a toda la aplicación y a los entregables

*(Fin del roadmap. Toma el paquete que ya existe en `EjemplosProcesoActual/DocUOC/Generador de Pliegos/estilos/guia_estilos/paquete/`: `tokens.json`, `styles.css`, `design-system.md`, `templates/`.)*

- [ ] H16-1 · Traducir `tokens.json` a variables CSS **compatibles con Chrome 109** (ADR-011: sin anidamiento nativo, sin `text-wrap: balance`)
- [ ] H16-2 · Hoja de estilos única de la aplicación derivada de los tokens; ningún color ni tipografía escrita a mano fuera de ese archivo
- [ ] H16-3 · Aplicar a **la aplicación entera**: wizard, kanban, expediente, catálogo, tableros, archivo
- [ ] H16-4 · Aplicar a **los entregables impresos**: requerimiento, EETT, ANEXO 1, disposiciones, con su membrete y su pie
- [ ] H16-5 · El guardián de compatibilidad se extiende al CSS nuevo
- [ ] H16-6 · Verificación de impresión real en A4 de cada plantilla, en una PC del parque
- [ ] H16-7 · Revisión de accesibilidad: contraste y navegación por teclado sobre la paleta final

**Criterio de aceptación:** un entregable impreso desde la app y uno producido por el generador de pliegos se ven de la misma familia, sin retoques.

### H17 — Identidad de la aplicación y documentación para que la mejore una IA

*(ADR-026. Lo último del roadmap.)*

**Identidad y marcado**

- [ ] H17-1 · `LICENCIA` y `AUTORES.md` en la raíz; cabecera de autoría en cada archivo fuente
- [ ] H17-2 · **Commits y etiqueta de versión firmados con GPG** con la clave del correo institucional; `git tag -s v1.0.0`
- [ ] H17-3 · **Hash SHA-256 del paquete v1** publicado por correo institucional, con fecha. Prueba de anterioridad
- [ ] H17-4 · `app/js/core/version.js` con `{nombre, version, commit, fecha, autor, unidad}` y vista **"Acerca de"**
- [ ] H17-5 · **Pie impreso en cada entregable generado**: *"Generado por SGC v1.0 · build a3f9c1 · División Contrataciones Moreno"*. Es la marca que más viaja, porque va en el PDF que circula
- [ ] H17-6 · Documentar por escrito la **huella estructural** del registro de auditoría (ADR-006): identifica a cualquier descendiente aunque le cambien la interfaz entera
- [ ] H17-7 · Elegir y registrar las **marcas silenciosas**, en un documento **fuera del repositorio**, en poder del Jefe de Contrataciones

**Documentación IA-friendly**

- [ ] H17-8 · `ARQUITECTURA.md` en la raíz: mapa de carpetas, qué hace cada módulo, por dónde entra una petición y por dónde sale un documento. Es lo primero que lee cualquiera, humano o no
- [ ] H17-9 · **Cabecera de contrato en cada módulo**: propósito, qué recibe, qué devuelve, **qué invariantes no puede romper**, y qué ADR lo gobierna
- [ ] H17-10 · **Glosario dominio ↔ código**: "renglón", "preventivo", "OCA", "imputación", "perfeccionada" con su nombre exacto en el código. Sin esto, una IA traduce mal el vocabulario administrativo
- [ ] H17-11 · `CONTRIBUIR.md` con las reglas duras que no se negocian: cero dependencias, Chrome 109, 400 líneas por archivo, español en el dominio, el guardián tiene que pasar
- [ ] H17-12 · Los **tests como ejemplos ejecutables**: cada regla de negocio con un test que la nombre en castellano. Es la documentación que no se desactualiza
- [ ] H17-13 · Índice de ADRs por tema al frente de la bitácora, para que se pueda encontrar la decisión sin leer las veintitantas
- [ ] H17-14 · **Prueba de la documentación**: darle el repositorio a un LLM sin contexto previo y pedirle un cambio acotado. Si no puede, la documentación no está lista. Es el único criterio de aceptación honesto

**Criterio de aceptación:** un desarrollador —o una IA— que nunca vio el proyecto implementa un cambio pequeño y correcto leyendo sólo el repositorio.


### H18 — Credenciales y administración del padrón

*(ADR-027. Supera parcialmente a ADR-017. Tiene que estar **antes del UAT**: si los operadores prueban sin clave, el registro del UAT no acredita quién hizo qué, que es justamente lo que el UAT viene a validar.)*

- [ ] H18-1 · Campo `credencial` en el padrón: `{algoritmo:'scrypt', sal, N, r, p, hash}`, con `node:crypto`. **Cero dependencias nuevas**
- [ ] H18-2 · Verificación en tiempo constante (`timingSafeEqual`). **Ninguna clave en texto plano, en ningún lado, nunca**
- [ ] H18-3 · **El padrón con credenciales no se sirve por HTTP.** Vive fuera de toda carpeta servida como estática, y **hay un test que lo verifica** — no una revisión visual
- [ ] H18-4 · Entrada con correo institucional + clave; sesión del lado del servidor con cookie `HttpOnly`, `SameSite=Strict`, identificador de `crypto.randomBytes`
- [ ] H18-5 · **El rol se deriva de la sesión, no del cuerpo de la petición.** El cliente deja de declarar `contexto.rol`. **Un operador tiene un solo rol** (ADR-033): no hay nada que elegir
- [ ] H18-6 · La auditoría y el registro de eventos pasan a anotar el operador **verificado**, no el declarado (cierra R12)
- [ ] H18-7 · Cierre por inactividad a los 15 minutos (H5-1) y cierre explícito con botón visible
- [ ] H18-8 · Demora fija de 1 segundo en cada intento fallido; bloqueo tras diez fallos seguidos, que sólo levanta el Jefe de Contrataciones
- [ ] H18-9 · `tools/padron.js`: alta, cambio de clave, desactivación. **Imprime el hash y no guarda la clave en ningún lado**
- [ ] H18-10 · **ADR-033 · jerarquía de roles**: el padrón pasa de `roles: []` a `rol: ''`; `rolesEfectivos(rol)` devuelve el propio más los heredados, declarado como dato en `config.js`. **La matriz 18 × 7 no se duplica**: cambia cómo se pregunta
- [ ] H18-11 · La auditoría y los eventos registran el **rol efectivo**: `contrataciones_supervisor actuando como contrataciones`
- [ ] H18-12 · Indicador: **la misma persona ejecutó un paso y su supervisión**. No bloquea; se ve
- [ ] H18-13 · **ADR-034 · la clave se genera como cuatro palabras en castellano** (`silla-mapa-trueno-verde`), para que se pueda transcribir a mano sin error. Se muestra **una sola vez** y se guarda sólo el hash
- [ ] H18-14 · **ADR-034 · la credencial nace `provisoria: true`** y el primer ingreso **obliga a cambiarla**: con esa marca el operador entra pero no puede hacer otra cosa. Es lo que hace que el registro distinga al operador del Jefe
- [ ] H18-15 · **ADR-034 · la reposición la hace el Jefe y queda como evento**: *"clave repuesta por X para Y"*. Es lo que sostiene la honestidad del sistema: no se puede reponer sin dejar rastro
- [ ] H18-16 · La baja pone `activo: false`, **nunca borra**: el nombre sigue apareciendo en los expedientes que tramitó (R15)
- [ ] H18-17 · La pantalla de cambio de clave advierte que **esta clave no puede ser la misma de ningún otro sistema** (R24: sin HTTPS viaja en claro)
- [ ] H18-18 · **Cerrar `GET /api/eventos` por rol** (declarado por el desarrollador en el ciclo 13): hoy cualquiera lee el registro crudo. El compendio completo de eventos y de sugerencias, con su contexto, es del **Jefe de Contrataciones**
- [ ] H18-11 · El padrón real vive en la carpeta de datos y entra en el respaldo (H3-8). En el repositorio queda sólo `usuarios.ejemplo.json`, **sin credenciales**
- [ ] H18-12 · Migración: los expedientes existentes conservan el operador que tengan registrado; no se reescribe historia

**Criterio de aceptación:** un operador no puede ejecutar ninguna acción con el rol de otro, verificado **contra el servidor**; y el padrón con hashes no es descargable desde el navegador.

---

## Candidatos a la V2 — fuera del alcance del piloto

Se registran acá para que no se pierdan y para que **no entren al piloto por goteo**. Nada de esta sección se construye antes del despliegue.

### V2-1 — Consolidación de pedidos por área (ADR-028)

El paso previo real que hoy no existe en ningún sistema: cada área carga sus necesidades contra un período abierto, y el usuario consolidador las ve todas y las traduce a renglones. Hoy eso pasa por relaciones personales, y **cuando falla, un área queda afuera y se entera tarde**.

**Por qué no ahora:** multiplica los usuarios de menos de diez a todas las áreas de la unidad —lo que rompe el dimensionamiento de ADR-008 y de ADR-027—, reintroduce plazos que ADR-013 dejó fuera a propósito, y **puede excluir más de lo que incluye** si el pedido formal pasa a ser "cargarlo en la aplicación" antes de que todas las áreas estén en el padrón.

**Lo que sí se hace ahora, porque es barato y produce la evidencia:**

- [ ] V2-1a · Campo **`areaSolicitante`** por renglón, opcional, texto libre. Una columna
- [ ] V2-1b · Indicador (ADR-024): renglones por área solicitante, y **renglones sin origen declarado**. Al cabo del piloto eso responde con datos qué áreas aparecen, cuáles nunca aparecen y cuánto del requerimiento no tiene origen registrado

### V2-2 — Otros

- Motor de SLA con los plazos de la norma (ADR-013), a discutir **con la evidencia de tiempos que el piloto genere**, no antes
- Validación cruzada completa de referencias entre presupuestos y valores (R-09-1, si sobrevive a H11-12)
- Aviso por dispersión alta entre presupuestos de un mismo renglón (R-09-3), si el indicador de H15 muestra que pasa seguido


### H19 — Diálogo de sugerencias del piloto

*(Pedido del Jefe de Contrataciones, 2026-08-26. **Ronda 13**, porque hace falta ahora: la evaluación ya empezó.)*

Un panel flotante donde cualquiera que ayude a evaluar el sistema anota, en texto libre, lo que ve. Un *"chat con nadie"*: nadie contesta, nadie recibe notificación, todo queda anotado.

- [ ] H19-1 · Botón flotante **siempre visible**, en cualquier pantalla, que abre un panel. No hace falta tener un expediente abierto
- [ ] H19-2 · **Guarda el contexto solo**: operador, fecha y hora, pantalla en la que estaba, expediente y paso si había uno, versión de la aplicación y del catálogo, navegador. *Una sugerencia que dice "esto es confuso" sin decir dónde no sirve dentro de dos semanas*
- [ ] H19-3 · Almacenamiento **append-only y global** (`sugerencias.jsonl` en la carpeta de datos), no por expediente. Nunca se edita ni se borra: se marca como atendida
- [ ] H19-4 · Se activa con una marca de configuración **`MODO_PILOTO`**: fuera del piloto el botón no existe. La marca no se cambia desde la interfaz
- [ ] H19-5 · Vista de lectura para el Jefe de Contrataciones: lista, filtro por pantalla y por persona, marca de atendida, y **exportación a Markdown** para trabajarla con IA
- [ ] H19-6 · Cero fricción de escritura: se abre, se escribe, se guarda. Sin categorías obligatorias, sin severidad, sin formulario
- [ ] H19-7 · Entra en el respaldo (H3-8) y en la advertencia de datos sensibles: son opiniones de personas identificadas

**Criterio de aceptación:** alguien que nunca vio el sistema anota tres observaciones en su primera sesión sin preguntarle a nadie cómo se hace, y cada una llega con el lugar exacto donde ocurrió.

### H20 — Plantillas del pliego, versionadas y editables

*(ADR-032. Amplía a ADR-030.)*

- [ ] H20-1 · Modelo de plantilla versionada: `{id, nombre, contenido, criterios, version, autor, fecha, vigente, notaDeCambio}`. **Contenido íntegro por versión**, nunca diffs: un pliego de hace un año tiene que poder reproducirse
- [ ] H20-2 · La versión vigente es **una marca, no la última fila**: se puede volver a una anterior sin borrar nada
- [ ] H20-3 · **Tabla de reglas de selección declarativa** (`tipoContrato` × `modalidad` × `procedimiento`, con comodín `*`). Agregar un criterio **no puede requerir tocar código** — los criterios se van a seguir afinando
- [ ] H20-4 · Precedencia explícita: gana la regla más específica; ante empate, la de mayor prioridad declarada. **Nunca "la primera del archivo"**
- [ ] H20-5 · **Siempre hay plantilla por defecto**, y cuando se usa por falta de coincidencia **se dice en pantalla**. Ningún expediente queda sin plantilla en silencio
- [ ] H20-6 · **Validación antes de publicar**: se extraen los marcadores de la plantilla y se contrastan contra los campos que la aplicación emite. Un marcador desconocido **impide publicar**, con su nombre en el mensaje
- [ ] H20-6b · **Botón "Probar ahora" en la misma pantalla de edición**: lo corre el que está editando, sin salir. Recién con la prueba en verde se habilita publicar (enmienda de ADR-032)
- [ ] H20-7 · Aviso —sin impedir— de los campos que la aplicación emite y la plantilla no usa
- [ ] H20-8 · **Pliego de prueba antes de publicar**: si no sale con un expediente de ejemplo, la versión no se publica
- [ ] H20-9 · Edición por `contrataciones_supervisor` o `juridica`, **cualquiera de los dos, directo**, verificado en el servidor. **Nota de cambio obligatoria.** Los demás roles ven plantillas e historial
- [ ] H20-10 · El expediente **estampa id y versión** de la plantilla que lo produjo, y queda en el registro de eventos
- [ ] H20-11 · Al exportar, la aplicación entrega **el YAML y el archivo de la plantilla vigente**
- [ ] H20-12 · `tipo_contrato` y `tipo_documento` **dejan de estar fijos**: se derivan del expediente
- [ ] H20-13 · **Campos de servicios**: `plazo_entrega_servicio` y `garantia_servicio`. El generador los exige cuando `tipo_contrato` es `servicios`, y hoy no los emitimos — **un pliego de servicios no se puede generar**
- [ ] H20-14 · Las plantillas entran en el respaldo y en la restauración: son un tipo de dato nuevo que no es un expediente
- [ ] H20-15 · La pantalla de edición avisa, antes de publicar, que **el cambio afecta todos los pliegos siguientes**

- [ ] H20-16 · **La v1 de cada plantilla incorpora las trece correcciones normativas** del `LOG_ERRORES_COMUNES.md` (N01, N03–N11, N13, M01, M02). Es el contenido, no una tarea: ver `ANALISIS_ERRORES_PLIEGOS.md`
- [ ] H20-17 · **La plantilla numera sola** cláusulas e incisos, en vez de traer los números escritos a mano: hace imposibles E01, E02 y E05 del log
- [ ] H20-18 · Muestra curada en `referencias/pliegos-ejemplo/`: 0374 (control), **0390 servicios**, 0578 (el que más errores acumuló), 0432 (desierto/fracasado), y el log completo. **No la carpeta entera**

**Criterio de aceptación:** se publica una plantilla de servicios, un expediente de servicios la selecciona solo, y el generador produce el pliego sin edición manual. Y una plantilla con un marcador mal escrito **no se puede publicar**.


## Riesgos abiertos

| # | Riesgo | Impacto | Mitigación |
|---|--------|---------|-----------|
| ~~R1~~ | ~~Informática no autoriza correr un proceso propio~~ | **Cerrado — 2026-08-29** | Lo autorizó: máquina virtual Debian 12 sobre Proxmox ⇒ **ADR-035**. Era el riesgo crítico del proyecto |
| ~~R2~~ | ~~Sin HTTPS no hay adaptador de archivos del navegador~~ | **Cerrado — 2026-08-29** | Era crítico mientras el único camino restante dependiera de H0-3. H0-3 salió que sí: el servidor propio existe y el adaptador del navegador ya no hace falta |
| R8 | El sistema de firmas rechaza el PDF generado | Medio — obliga a la v2 de ADR-012 (librería PDF vendida) | Probar el circuito completo en H5-6, con un solo documento, antes de construir el resto de las plantillas |
| R9 | Un ítem necesario no está en el catálogo del mes | Medio — con catálogo cerrado, bloquea el trámite | H0-12 define el procedimiento de excepción antes de H4 |
| R10 | El parque de PCs (Windows 7) se renueva y cambia el navegador | Bajo, y sería una mejora | ADR-011 fija un piso, no un techo de funcionamiento: el código que corre en 109 corre en versiones posteriores |
| ~~R3~~ | ~~Latencia y cortes de la carpeta de red~~ | **Cerrado — 2026-08-29** | Los datos ya no viven en la carpeta de red: **están en el disco de la máquina virtual** (ADR-035 §2). La escritura atómica y el bloqueo de numeración funcionan sobre un sistema de archivos local, que es donde son fiables. **H9-2 deja de tener sentido** |
| R39 | **Un modo degradado se elige solo y en silencio** — tercera aparición de la misma forma (ADR-029, ciclo 14, ciclo 15) | **Alto por consecuencia**: está garantizado que se dispare el día de la instalación, y el síntoma es "todo funciona pero todo da 403" | **ADR-036**: nada que dependa del disco se decide al arrancar; lo que se comprueba al arrancar sirve **sólo para negarse a arrancar**. Sin padrón real, el servidor no arranca |
| R4 | ~~Los 18 estados no reflejan el circuito real~~ | **Bajo** — cada sector confirmó su fase (ronda 2, 2026-08-13) | Se mantiene la verificación de H9-8 como control final, ya no como mitigación de un riesgo alto |
| ~~R8~~ | ~~El sistema de firmas rechaza el PDF~~ | **Cerrado** — verificado el 2026-08-13: es la mecánica diaria actual | — |
| R12 | **Atribución equivocada por sesiones compartidas sin contraseña** | Medio — contamina la auditoría y los KPIs por sector. El caso frecuente no es la suplantación deliberada sino el descuido | ADR-017: identidad por correo institucional visible en pantalla, cierre por inactividad, registro de la máquina del lado del servidor, restricción de rol por máquina. La identidad queda **declarada y corroborada**, no verificada, y así se enuncia en la UI |
| R15 | El padrón de operadores queda desactualizado (altas, bajas, traslados) | Medio — un operador dado de baja sigue figurando y la auditoría atribuye a alguien que ya no está | Campo `activo` en el padrón; revisión del padrón como paso de la rutina mensual del catálogo, que ya existe |
| R13 | **Pérdida del script de scraping** (vive en un historial de chat) | Alto e inmediato — 2 horas de corrida más el conocimiento de cómo navegar el sitio | ADR-018: rescatarlo y versionarlo esta semana, fuera de la secuencia de hitos |
| R14 | El campo de aclaración se convierte en cajón de sastre | Medio — reintroduce el *garbage in* por la puerta de atrás | Límite de 200 caracteres ya definido; medir el porcentaje de renglones con aclaración en el UAT (H8-6). Si es alto, el problema es el catálogo, no el campo |
| R11 | Se confunde la carpeta del expediente con el archivo legal | Medio — riesgo de auditoría, no técnico | ADR-016 + H7-8: leyenda explícita en UI y en el export |
| ~~R17~~ | ~~La `cantidadMaxima` alimenta el pliego con otra semántica~~ | **Cerrado — 2026-08-26** | Las especificaciones técnicas **no llevan cantidades**: van en COMPRAR. El dato nunca llega a un documento que obligue al proveedor por vía nuestra (enmienda a ADR-022 §3). **Queda una invariante con test: el anexo de EETT no imprime cantidades** |
| R16 | El promedio de valores de referencia mezcla bases unitarias y totales | Alto y silencioso — produce un preventivo plausible pero sin significado | ADR-022 §2: normalizar a unitario antes de promediar; test con bases mixtas verificable a mano |
| R5 | El catálogo se desactualiza y nadie lo regenera | Medio | H0-8 define responsable y frecuencia; el build es un solo comando |
| R6 | El proyecto queda sin mantenedor | Alto | Cero dependencias, código comentado en español, H10-9 |
| R7 | Adopción: los operadores siguen usando el circuito en papel | Alto | H5 primero (valor visible temprano), piloto en paralelo, capacitación por rol |
| R18 | **Se lee que la aplicación "autoriza" gasto** y se le atribuye una facultad que no tiene | Alto y reputacional — un auditor, un superior o un LLM que lea el export puede concluir que el acto se perfeccionó acá | **ADR-023**: frontera explícita, vocabulario corregido en todo texto que ve un operador, y leyenda obligatoria en pantalla, en el pie de cada entregable y en el export |
| R19 | **Se llega al UAT sin instrumentación** y el primer mes de operación real no deja datos | Alto e irreversible — el 2026 se mide una sola vez | **ADR-024** y H15 **antes** de H9. El registro de eventos captura más de lo que los indicadores definidos necesitan |
| R20 | El registro de eventos se usa para evaluar personas | Medio — dato con contenido operativo sobre operadores identificados | H15-9: entra en la advertencia de datos sensibles; su uso queda sujeto al criterio del Jefe de Contrataciones, y conviene decirlo antes de que alguien lo descubra |
| R21 | Un precio del año anterior se hereda como valor de referencia sin que nadie lo note | Alto y silencioso — es R16 por la puerta de atrás | ADR-025 regla 3: el expediente creado "como base" nace **sin presupuestos y sin valores de referencia**; copia por lista blanca, nunca por lista negra |
| R22 | La aplicación se copia y no hay forma de reconocerla | Bajo, pero irreversible si no se prepara antes | ADR-026 y H17: sello de compilación impreso en cada entregable, huella estructural del registro de auditoría, etiqueta firmada con GPG y hash publicado de la v1 |
| R23 | **Trabajo hecho que no se publica** (ciclo 10: ronda completa sin commit, sin push y sin informe) | Alto — se quema una auditoría entera y el avance no cuenta | **Control de entrega** antes de largar al auditor: `git log --oneline -1`, `git status --short` y existencia del informe. Si algo falla, el auditor no arranca. **Cuidado**: `git status` sobre el montaje puede cortarse por tiempo y devolver vacío — mirar el código de salida |
| R24 | Sin HTTPS, la clave del operador viaja en claro por la intranet | Medio, **y ya no es condicional**: H0-4 confirmó que sólo hay HTTP | ADR-027 enmendada: **estas claves no pueden ser la misma que la de ningún otro sistema del organismo**, y la pantalla de cambio de clave lo dice (H18-17) |
| R36 | El supervisor ejecuta un paso y después supervisa ese mismo paso | Bajo hoy — con catorce personas va a pasar, y bloquearlo detendría expedientes | ADR-033 §4: **no se bloquea, se hace visible**. Indicador de "misma persona en el paso y su supervisión". Se decide con datos después del UAT |
| R37 | **Mientras el Jefe conozca la clave, el registro no distingue al operador del Jefe** | Alto para la atribución, que es el propósito del sistema | ADR-034 §3: la clave entregada es provisoria y **el primer ingreso obliga a cambiarla**. Y toda reposición queda como evento (§4): no se puede reponer sin dejar rastro |
| R38 | El registro crudo de eventos y las sugerencias los puede leer cualquier rol | Medio — contienen texto libre y desempeño de personas identificadas | H18-18: se cierra por rol junto con las credenciales. Declarado por el desarrollador en su informe del ciclo 13 |
| R25 | El Jefe de Contrataciones es el único administrador del padrón, sin autoservicio de reposición | Bajo hoy, **alto si entra V2-1** — decenas de usuarios pidiendo claves | ADR-027 §6: correcto a esta escala. Se revisa el día que ADR-028 pase a Aceptada |
| R26 | **Una regla se apaga en silencio porque falta un módulo** (causa de H-02: dos ciclos con el servidor sin gobierno sobre el requerimiento) | Alto y silencioso — es inmune a los tests, porque la guardia existe para que los tests no rompan | **ADR-029**: la dependencia faltante lanza. Tres instancias vivas a corregir en H13-7, más un test de integridad del núcleo |
| R27 | Se imprime y se firma un requerimiento que cita un anexo que nunca se generó | Bajo — el dato no se pierde y el anexo es regenerable, pero el papel queda mal | H12-7: el anexo pasa a obligatorio cuando hay referencias pendientes |
| ~~R28~~ | ~~`MAX_JUSTIFICACION` sin confirmar~~ | **Cerrado — 2026-08-26** | El sistema oficial no tiene tope propio: sólo recibe un documento nuestro ya firmado. Se mantiene en 20.000 para casos complejos |
| R29 | **Un texto de operador rompe el YAML y el pliego no se genera** — o peor, se genera con un dato truncado en silencio | Alto — siete de veinte textos probados fallan; dos impiden que el archivo parsee | **ADR-031**: entrecomillar siempre, y verificación de ida y vuelta contra un parser real en la batería |
| R30 | **El sistema produce un documento llamado "pliego" que no es el pliego** y hoy es entregable obligatorio | Alto y documental — alguien lo va a presentar creyendo que lo es | **ADR-030**: deja de ser entregable y pasa a vista previa rotulada. El pliego lo produce la UOC |
| ~~R31~~ | ~~El pliego sale con cláusulas en blanco~~ | **Cerrado — ciclo 12** | Los tres campos se mapean y los que faltan salen con `_FALTA_` visible |
| R32 | **Un campo de texto libre se ejecuta como fórmula** al abrir el CSV exportado en una planilla | Alto — el registro de eventos está lleno de texto escrito por operadores | Neutralizar **siempre** todo campo que empiece con `=`, `+`, `-`, `@` o tabulador. Misma forma que ADR-031: no detectar casos, neutralizar todo |
| R33 | **Un pliego de servicios no se puede generar**: `tipo_contrato` está fijo en `bienes` y faltan dos campos que el generador exige | Medio — tapado hasta que alguien intente uno | H20-12 y H20-13 |
| R34 | Una plantilla con un marcador mal escrito produce **pliegos defectuosos para todos los expedientes siguientes** | Alto y silencioso — nadie lo nota hasta que lo lee un proveedor | ADR-032 §4: no se publica una versión sin validar marcadores y sin generar un pliego de prueba |
| R35 | El informe del desarrollador pierde las secciones que lo hacen verificable | Medio — es el mecanismo por el que el revisor se entera de lo que **no** salió | Criterio de aceptación explícito en cada orden, y las cuatro secciones nombradas una por una |
