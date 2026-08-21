# PLAN DE DESARROLLO — SGC (Sistema de Gestión de Contrataciones)

División Contrataciones Moreno · VII Brigada Aérea
Última actualización: **2026-08-20** · cierre del ciclo 9 · incorporados H14, H15, H16 y H17 por indicación del Jefe de Contrataciones
Documentos relacionados: [`FullScopeDoc.md`](Contrataciones/FullScopeDoc.md) · [`AUDITORIA_InstruccionesCodigo.md`](AUDITORIA_InstruccionesCodigo.md) · [`BITACORA_DECISIONES.md`](BITACORA_DECISIONES.md) · [`RELEVAMIENTO_ENTORNO.md`](RELEVAMIENTO_ENTORNO.md)

> **Cómo se mantiene este archivo.** Cada hito tiene casillas de verificación. Al terminar una tarea se marca `[x]` y se actualiza la línea de estado del hito y la fecha de arriba. Toda decisión de arquitectura que se tome en el camino se registra en `BITACORA_DECISIONES.md`, no acá.

---

## 0. Estado general

| Hito | Nombre | Estado | Depende de |
|------|--------|--------|-----------|
| H0 | Relevamiento de entorno | 🟡 **Casi cerrado** — sólo resta lo elevado a Informática (servidor, red, antivirus) | — |
| H1 | Fundaciones del repositorio | ✅ **Terminado** — ciclo 1 | — |
| H2 | Núcleo de dominio (sin UI) | ✅ **Terminado** — ciclo 2 | H1 |
| H3 | Persistencia + servidor local | ✅ **Terminado** — ciclos 3 y 8 (respaldo) | H1, H2 |
| H4 | Catálogo de ítems y autocompletado | ✅ **Terminado** — ciclo 4 | H1 |
| H5 | Vertical Fase 1 — Wizard del Usuario | ✅ **Terminado** — ciclo 5 | H2, H3, H4 |
| H6 | Tablero Kanban, roles y transiciones | ✅ **Terminado** — ciclos 6 y 7 (autorización) | H5 |
| H7 | Entregables y exportación AI-ready | ✅ **Terminado** — ciclos 7 y 8 | H5 |
| H8 | KPIs y Archivo Histórico | 🟡 **40%** — archivo histórico hecho (ciclo 8); faltan los KPIs | H6 |
| H9 | **Testing integral en local (UAT)** | 🟡 **40%** — auditoría independiente activa y prueba manual hecha; falta UAT con operadores | H6, H7 |
| H11 | Requerimiento completo y presupuestos | 🟡 **70%** — ciclo 9: modelo, cálculo, servidor y plantilla listos; **falta la pantalla de carga** | H7 |
| H12 | EETT con regla de desborde | ⬜ Pendiente — ciclo 10 | H11 |
| H13 | ANEXO 1 y salida hacia el pliego | ⬜ Pendiente — ciclo 11 | H11, H12 |
| H14 | Expediente adjudicado como base de uno nuevo | ⬜ Pendiente — **nuevo, 2026-08-20** | H8 |
| H15 | Observabilidad y tableros de indicadores por rol | ⬜ Pendiente — **nuevo** · **antes del UAT** | H8 |
| H16 | Sistema de estilos aplicado a toda la app | ⬜ Pendiente — **nuevo** · final del roadmap | H13 |
| H17 | Identidad de la app y documentación IA-friendly | ⬜ Pendiente — **nuevo** · lo último | H16 |
| H10 | Despliegue a intranet y piloto | ⬜ Pendiente | H0, H9 |

> ### ⚠️ Sigue pendiente
> **Rescate del scraper del catálogo** (ADR-018). Al 2026-08-20 se conserva **sólo un fragmento**: el bloque `page.evaluate()` de un script Puppeteer/Playwright, ya versionado en `Contrataciones/tools/scraper-catalogo/`. **Falta** la URL de origen, el arranque del navegador, el bucle de paginación y la escritura de salida. Ver el README de esa carpeta.

**Principio rector del orden:** H5 es el primer punto donde el sistema produce valor real (resuelve el *garbage in* del FSD §1). Todo lo anterior existe para sostenerlo. Si hubiera que cortar alcance, se corta desde H8 hacia atrás, nunca desde H2.

---

## H0 — Relevamiento de entorno

**Objetivo:** eliminar las incógnitas de infraestructura que condicionan el despliegue. **No bloquea H1–H9**, gracias al adaptador de persistencia (ADR-002), pero **sí bloquea H10**.

- [ ] H0-1 · Identificar qué servidor sirve `septibri.faa.mil.ar` (IIS / Apache / nginx) y su versión — *elevado a Informática*
- [ ] H0-2 · Confirmar si hay motor server-side disponible (ASP.NET, PHP) o si es solo estáticos — *elevado*
- [ ] H0-3 · Averiguar si se autoriza correr un proceso propio (Node.js como servicio) y en qué equipo — *elevado* · **es la decisión de mayor impacto pendiente**
- [ ] H0-4 · Confirmar si existe HTTPS para el host donde iría la app — *elevado*
- [x] H0-5 · Versión exacta de Edge/Chrome en las PCs de los operadores → **109.0.5414.120, cohort Windows 7** ⇒ ADR-011
- [ ] H0-6 · Permisos NTFS: administrador identificado y trámite ágil ✅ · **falta la ruta UNC real de `Y:`** y definir la carpeta de datos nueva ⇒ ADR-015
- [x] H0-7 · Backup: hoy no existe, se puede establecer ⇒ pasa a ser requisito del proyecto (H3-8, H10-4)
- [x] H0-8 · Catálogo: scraping propio del sitio estatal, actualización mensual manual ⇒ ADR-014
- [ ] H0-9 · **Nueva** · Sistema operativo del servidor de intranet (condiciona la versión de Node) — *elevar*
- [x] H0-10 · Sistema de firmas: **carga manual, sin retorno del firmado** ⇒ ADR-012 y ADR-016. Queda una sola verificación: probar que acepta un PDF de "Microsoft Print to PDF"
- [x] H0-11 · Script de scraping: **conservado sólo en un historial de chat** ⇒ ADR-018, rescate urgente (H4-8)
- [x] H0-12 · Excepción de catálogo: **ítem más similar + aclaración de hasta 200 caracteres** ⇒ enmienda de ADR-014
- [x] H0-14 · Cuentas de Windows: **compartidas y sin contraseña** ⇒ ADR-017
- [x] H0-15 · Cuentas de Windows: **una por PC**. La identidad del operador se basa en el **correo institucional**, no en Windows ⇒ ADR-017 Aceptada
- [ ] H0-16 · ¿Las PCs tienen IP fija o reserva DHCP? (condiciona la restricción de rol por máquina, ADR-017 medida 4) — *elevar*
- [x] H0-17 · El scraper corre **fuera de la intranet**; el archivo se traslada a mano. **La app no emite peticiones al exterior** ⇒ ADR-018
- [ ] H0-18 · **Nueva** · ¿Cuál es el procedimiento admitido para trasladar un archivo desde una PC externa a la red interna? — *elevar*
- [x] H0-13 · Validación de los 18 pasos: **cada sector confirmó su fase** ⇒ riesgo R4 baja de Alto a Bajo

**Entregable:** `RELEVAMIENTO_ENTORNO.md` completado.
**Criterio de aceptación:** ADR-003, ADR-012 y ADR-015 pasan de `Propuesta` a `Aceptada`, o son reemplazadas por la alternativa que corresponda.

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
- [ ] H3-12 · Restricción opcional de rol por máquina: sólo se aceptan acciones de un rol desde las PCs de ese sector (ADR-017, medida 4) — *depende de H0-16*
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
- [ ] H9-2 · Simulacro de carpeta de red en `datos-prueba/`, y prueba adicional **contra una carpeta compartida SMB real** (una segunda PC o una unidad mapeada). *El comportamiento de SMB no se puede simular con una carpeta local: latencia, bloqueos y permisos son distintos.*
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
- [ ] H10-2 · Preparar el paquete de despliegue (solo `app/` + `server/` si corresponde) y el instructivo para Informática
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

**Estado al 2026-08-20 (ciclo 9): 70%.** H11-1 a H11-10 terminados y auditados; el cálculo del preventivo verificado con cinco casos manuales por el auditor y otro por el revisor. Faltan H11-11 y H11-12, que van en el ciclo 10.

**Criterio de aceptación:** un requerimiento con tres renglones, dos presupuestos y bases mixtas produce el preventivo correcto, verificable a mano, **cargado desde la pantalla**.

### H12 — EETT con regla de desborde

- [ ] H12-1 · Límite de aclaración a **256 caracteres** (enmienda de ADR-014); actualizar validador, tests y contador visible. **Hallazgo H1-09 del ciclo 9**: hoy hay `MAX_ACLARACION = 200` en cuatro archivos (`core/validacion.js`, `catalogo/renglones.js`, `views/fasttrack.js`, `views/pasos.js`) y el test lo verifica
- [ ] H12-2 · Al pasarse: el requerimiento imprime `"según anexo [alfa|bravo|charly]"` y el renglón entra al anexo con el texto completo
- [ ] H12-3 · Bloque de condiciones particulares comunes a todos los renglones, opcional
- [ ] H12-4 · Nomenclatura automática de anexos
- [ ] H12-5 · Si ningún renglón desborda y no hay condiciones particulares, **el anexo no se genera**
- [ ] H12-6 · Ficha por renglón: `Renglón N° | Código SIByS | Descripción ONC | Especificaciones Técnicas`

**Criterio de aceptación:** un renglón de 250 caracteres queda en el requerimiento; uno de 300 dispara el anexo y deja la referencia correcta.

### H13 — ANEXO 1 y salida hacia el pliego

- [ ] H13-1 · Formulario de ANEXO 1 para el rol Abastecimiento, con sus 14 secciones
- [ ] H13-2 · Las secciones 9 a 12 (interadministrativas, bienes de uso, hardware/software, infraestructura) como **bloques condicionales**, no catorce secciones con "NO CORRESPONDE" repetido
- [ ] H13-3 · **Precarga** desde el requerimiento: objeto, justificación, datos de la unidad, cantidades
- [ ] H13-4 · El campo de precio de referencia se deriva de los presupuestos que cargó el usuario
- [ ] H13-5 · Planilla de OCA cuando la modalidad lo pide, con las cantidades del requerimiento
- [ ] H13-6 · **Exportación del YAML** que consume el generador de pliegos existente

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


## Riesgos abiertos

| # | Riesgo | Impacto | Mitigación |
|---|--------|---------|-----------|
| R1 | Informática no autoriza correr un proceso propio | **Crítico** — con Chrome 109 el adaptador FSA no tiene permisos persistentes ni escritura atómica (ADR-011): cada operador tendría que volver a elegir la carpeta de red en cada sesión. Deja de ser una contingencia aceptable | ADR-002 aísla el impacto en un archivo; **ADR-015 es el argumento a presentar: un servidor propio es la opción más segura, porque permite que ningún operador tenga permiso de escritura sobre los datos** |
| R2 | No hay HTTPS y tampoco backend | **Crítico** — sin *secure context* no hay File System Access y la app queda de solo lectura. No hay plan C | Detectar en H0-4. Alternativas: publicar la app en un host con HTTPS, alojarla en una PC custodiada actuando como servidor, o pedir la directiva empresarial que marca el origen como confiable |
| R8 | El sistema de firmas rechaza el PDF generado | Medio — obliga a la v2 de ADR-012 (librería PDF vendida) | Probar el circuito completo en H5-6, con un solo documento, antes de construir el resto de las plantillas |
| R9 | Un ítem necesario no está en el catálogo del mes | Medio — con catálogo cerrado, bloquea el trámite | H0-12 define el procedimiento de excepción antes de H4 |
| R10 | El parque de PCs (Windows 7) se renueva y cambia el navegador | Bajo, y sería una mejora | ADR-011 fija un piso, no un techo de funcionamiento: el código que corre en 109 corre en versiones posteriores |
| R3 | La carpeta de red tiene latencia alta o cortes frecuentes | Medio | H9-2 y H9-5 lo miden antes del despliegue; borrador local como red de contención |
| R4 | ~~Los 18 estados no reflejan el circuito real~~ | **Bajo** — cada sector confirmó su fase (ronda 2, 2026-08-13) | Se mantiene la verificación de H9-8 como control final, ya no como mitigación de un riesgo alto |
| ~~R8~~ | ~~El sistema de firmas rechaza el PDF~~ | **Cerrado** — verificado el 2026-08-13: es la mecánica diaria actual | — |
| R12 | **Atribución equivocada por sesiones compartidas sin contraseña** | Medio — contamina la auditoría y los KPIs por sector. El caso frecuente no es la suplantación deliberada sino el descuido | ADR-017: identidad por correo institucional visible en pantalla, cierre por inactividad, registro de la máquina del lado del servidor, restricción de rol por máquina. La identidad queda **declarada y corroborada**, no verificada, y así se enuncia en la UI |
| R15 | El padrón de operadores queda desactualizado (altas, bajas, traslados) | Medio — un operador dado de baja sigue figurando y la auditoría atribuye a alguien que ya no está | Campo `activo` en el padrón; revisión del padrón como paso de la rutina mensual del catálogo, que ya existe |
| R13 | **Pérdida del script de scraping** (vive en un historial de chat) | Alto e inmediato — 2 horas de corrida más el conocimiento de cómo navegar el sitio | ADR-018: rescatarlo y versionarlo esta semana, fuera de la secuencia de hitos |
| R14 | El campo de aclaración se convierte en cajón de sastre | Medio — reintroduce el *garbage in* por la puerta de atrás | Límite de 200 caracteres ya definido; medir el porcentaje de renglones con aclaración en el UAT (H8-6). Si es alto, el problema es el catálogo, no el campo |
| R11 | Se confunde la carpeta del expediente con el archivo legal | Medio — riesgo de auditoría, no técnico | ADR-016 + H7-8: leyenda explícita en UI y en el export |
| R17 | La `cantidadMaxima` alimenta el pliego con una semántica distinta a la del Art. 112 | Alto y legal — el pliego obligaría al proveedor a menos de lo necesario | ADR-022 §3: la plantilla del pliego rotula el campo con el significado real, o deriva el máximo contractual. Revisar en H13 |
| R16 | El promedio de valores de referencia mezcla bases unitarias y totales | Alto y silencioso — produce un preventivo plausible pero sin significado | ADR-022 §2: normalizar a unitario antes de promediar; test con bases mixtas verificable a mano |
| R5 | El catálogo se desactualiza y nadie lo regenera | Medio | H0-8 define responsable y frecuencia; el build es un solo comando |
| R6 | El proyecto queda sin mantenedor | Alto | Cero dependencias, código comentado en español, H10-9 |
| R7 | Adopción: los operadores siguen usando el circuito en papel | Alto | H5 primero (valor visible temprano), piloto en paralelo, capacitación por rol |
| R18 | **Se lee que la aplicación "autoriza" gasto** y se le atribuye una facultad que no tiene | Alto y reputacional — un auditor, un superior o un LLM que lea el export puede concluir que el acto se perfeccionó acá | **ADR-023**: frontera explícita, vocabulario corregido en todo texto que ve un operador, y leyenda obligatoria en pantalla, en el pie de cada entregable y en el export |
| R19 | **Se llega al UAT sin instrumentación** y el primer mes de operación real no deja datos | Alto e irreversible — el 2026 se mide una sola vez | **ADR-024** y H15 **antes** de H9. El registro de eventos captura más de lo que los indicadores definidos necesitan |
| R20 | El registro de eventos se usa para evaluar personas | Medio — dato con contenido operativo sobre operadores identificados | H15-9: entra en la advertencia de datos sensibles; su uso queda sujeto al criterio del Jefe de Contrataciones, y conviene decirlo antes de que alguien lo descubra |
| R21 | Un precio del año anterior se hereda como valor de referencia sin que nadie lo note | Alto y silencioso — es R16 por la puerta de atrás | ADR-025 regla 3: el expediente creado "como base" nace **sin presupuestos y sin valores de referencia**; copia por lista blanca, nunca por lista negra |
| R22 | La aplicación se copia y no hay forma de reconocerla | Bajo, pero irreversible si no se prepara antes | ADR-026 y H17: sello de compilación impreso en cada entregable, huella estructural del registro de auditoría, etiqueta firmada con GPG y hash publicado de la v1 |
