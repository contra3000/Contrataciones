# RELEVAMIENTO DE ENTORNO — H0

Estado: **🟡 Parcial** · Iniciado 2026-08-13 · Última actualización 2026-08-13
Bloquea: H10 (despliegue). No bloquea H1–H9.
Leyenda: ✅ respondida · ⏳ elevada a Informática · ❓ nueva, pendiente

> Nota: en la ronda del 2026-08-13 las respuestas 2.1 y 3.1 vinieron cruzadas. Se transcriben en el ítem que corresponde.

---

## 1. Servidor de intranet — ⏳ elevado a Informática

| # | Pregunta | Respuesta | Estado |
|---|----------|-----------|--------|
| 1.1 | Software que sirve `septibri.faa.mil.ar` y versión | | ⏳ |
| 1.2 | ¿Motor server-side habilitado? (ASP.NET, ASP clásico, PHP) | | ⏳ |
| 1.3 | ¿Se puede publicar una carpeta nueva de la app y quién lo hace? | | ⏳ |
| 1.4 | ¿Existe HTTPS para ese host? | | ⏳ |
| 1.5 | ¿Se autoriza correr un proceso propio (Node.js como servicio)? ¿En qué equipo? | | ⏳ |
| 1.6 | Si no: ¿WebDAV o verbo PUT sobre una carpeta? | | ⏳ |
| 1.7 | ¿Proxy o filtro que altere las respuestas HTTP en la intranet? | | ⏳ |
| **1.8** | **¿Qué sistema operativo y versión corre el servidor?** | | ❓ **nueva** |

**1.8 — por qué se agrega:** condiciona qué runtime puede instalarse. Si el servidor fuera Windows Server 2008 R2, el último Node.js compatible es la rama 14 (fuera de soporte). No invalida ADR-003, pero cambia la versión a fijar y hay que saberlo antes de prometerlo.

## 2. Puestos de trabajo — ✅ respondido

| # | Pregunta | Respuesta | Estado |
|---|----------|-----------|--------|
| 2.1 | Navegador y versión exacta | **109.0.5414.120 (Build oficial) (64 bits) — cohort: Windows 7** | ✅ |
| 2.2 | ¿Los usuarios pueden instalar software o cambiar flags? | **NO** | ✅ |
| 2.3 | ¿GPO que restrinja APIs del navegador o descargas? | **NO** | ✅ |
| 2.4 | Resolución de pantalla más chica en uso | | ⏳ |
| 2.5 | ¿Usuario de Windows individual o sesión compartida? | **Un solo usuario administrador, en poder de Informática. El resto de las cuentas, compartidas y sin contraseña.** | ✅ → **ADR-017** |
| 2.6 | ¿Las cuentas compartidas son una por oficina/sector o una sola para todos? | **Una por PC**, agrupadas por oficina/sector según el caso. **Decisión: la identidad del operador no se apoya en el usuario de Windows sino en el correo institucional `@faa.mil.ar`** | ✅ → ADR-017 |
| 2.7 | ¿Las PCs tienen IP fija o reserva por DHCP? | | ⏳ *elevar* (condiciona la restricción de rol por máquina) |

> **Hallazgo crítico.** La versión 109 es **la última que Chrome y Edge publicaron para Windows 7/8.1** (enero de 2023). Esas PCs **no van a recibir otra actualización nunca**. No es "un navegador un poco viejo": es un techo permanente de plataforma. Ver **ADR-011**, que fija la línea base y lista qué queda prohibido por esto.

## 3. Carpeta de datos — ✅ parcial

| # | Pregunta | Respuesta | Estado |
|---|----------|-----------|--------|
| 3.1 | Ruta de la carpeta compartida | Unidad mapeada **`Y:`** = todas las carpetas compartidas. **`Y:\UOC`** = carpeta del Jefe de Contrataciones: **lectura para toda la organización, escritura sólo él y sólo desde su oficina** | ✅ parcial |
| 3.2 | ¿Quién administra los permisos NTFS y trámite de cambio? | **Acceso directo al administrador de informática. Trámite ágil.** | ✅ |
| 3.3 | ¿Permisos distintos por grupo (Contrataciones, Jurídica, Contaduría)? | **SÍ** | ✅ |
| 3.4 | ¿Directorio de solo lectura para el Archivo Histórico? | **SÍ** | ✅ |
| 3.5 | ¿Backup de esa carpeta? | **Se puede establecer** (hoy no existe) | ✅ |
| 3.6 | Espacio disponible y cuota | | ⏳ |
| 3.7 | ¿Antivirus que bloquee o demore escrituras en recursos compartidos? | | ⏳ |
| **3.8** | **Ruta UNC real de `Y:` (`\\servidor\recurso`)** | | ❓ **nueva** |
| 3.9 | ¿Se puede crear una carpeta de datos nueva, distinta de `Y:\UOC`? | **SÍ** | ✅ |

**3.8 — por qué se agrega:** `Y:` es una letra mapeada **por sesión de usuario**. Un servicio de Windows corriendo bajo una cuenta de servicio no ve las unidades mapeadas de nadie: necesita la ruta UNC. Sin ella no se puede configurar el servidor.

**3.9 — por qué se agrega:** hoy el único lugar escribible es `Y:\UOC`, y sólo por vos y sólo desde tu oficina. Un sistema con cinco sectores operando necesita una carpeta donde los demás también escriban — **o**, mejor, la solución de **ADR-015**: que escriba únicamente el servidor y ningún operador tenga permiso de escritura sobre los datos. En ese caso hace falta una carpeta cuya única cuenta con permiso de escritura sea la del servicio.

## 4. Catálogo de ítems — ✅ respondido

| # | Pregunta | Respuesta | Estado |
|---|----------|-----------|--------|
| 4.1 | Origen de `catalogo_incisos.json` | **Scraping propio del sitio estatal, página por página. Más de 2 horas de corrida.** | ✅ |
| 4.2 | Frecuencia de cambio y responsable | **Cambia casi a diario en el origen. Se actualizará una vez por mes, por el Jefe de Contrataciones.** | ✅ |
| 4.3 | Campo `estado` = `Activo` en el 100% | **El origen tiene inactivos, ya vienen filtrados. La columna sobra: los inactivos se borran al detectarlos.** | ✅ |
| 4.4 | ¿Los códigos son los oficiales del expediente? | **SÍ** | ✅ |
| 4.5 | ¿Se admite un ítem fuera del catálogo? | **NO** | ✅ |
| 4.6 | ¿Se conservó el script de scraping y desde qué equipo corre? | **Conservado dentro de una conversación con un LLM. Se corrió desde el equipo del Jefe de Contrataciones.** | ✅ → **ADR-018** ⚠️ |
| 4.7 | ¿Qué pasa si el ítem necesario no está en el catálogo? | **Se usa el más similar y se aclara la diferencia en un campo de texto libre de hasta 200 caracteres.** | ✅ → enmienda de ADR-014 |
| 4.8 | ¿El equipo del scraper tiene internet y a la vez intranet? | **No: se corre desde una PC fuera de la intranet y el archivo se traslada a mano.** Las PCs de la intranet tienen internet casi sin restricciones, pero **la app no debe depender de peticiones al exterior** (decisión del usuario) | ✅ → ADR-018 |
| **4.9** | **¿Cuál es el procedimiento admitido para trasladar un archivo desde una PC externa a la red interna?** | | ❓ **nueva** — *elevar* |

**4.6 — por qué se agrega:** con actualización mensual, el scraper es infraestructura del proyecto, no una herramienta descartable. Debe versionarse junto a la app y quedar documentado. Además: la corrida requiere acceso a internet, que las PCs de la intranet posiblemente no tengan — hay que definir en qué equipo se ejecuta y cómo entra el archivo a la red.

**4.7 — por qué se agrega:** con catálogo cerrado (4.5 = NO), un ítem faltante **bloquea el trámite**. Si el catálogo se actualiza una vez al mes y el origen cambia a diario, esa ventana existe y hay que decidir el procedimiento de excepción (¿se espera? ¿se agrega el ítem a mano al catálogo local con marca de "pendiente de validación"?). Es decisión de negocio, no técnica.

## 5. Proceso y organización — ✅ respondido

| # | Pregunta | Respuesta | Estado |
|---|----------|-----------|--------|
| 5.1 | ¿Los 18 pasos están validados con quienes ejecutan cada fase? | **Sí: cada sector confirmó su fase.** Cubren todo el pipeline, del requerimiento a la creación de los contratos; después interviene otro sistema. | ✅ |
| 5.2 | ¿Norma que fije plazos por fase (SLA)? | **Existe, pero se deja fuera del alcance de la v1.** Prioridad: rápido, ágil y práctico. | ✅ → **ADR-013** |
| 5.3 | ¿Integración con sistemas oficiales (SIU, COMPR.AR)? | **No. Sin integración.** La app debe (a) **emitir documentos listos para firmar, en PDF o imagen**, para un sistema de firmas existente, y (b) emitir JSON para ingesta por LLMs como contexto de auditoría. | ✅ → **ADR-012** |
| 5.4 | Referente que valida los entregables | **El Jefe de Contrataciones.** | ✅ |
| 5.5 | ¿Expedientes en curso a migrar? | **NO. Se arranca de cero, progresivamente.** | ✅ |
| 5.6 | ¿Cómo ingiere el archivo el sistema de firmas? | **Carga manual por una persona. El firmado queda en ese sistema y no vuelve a la app. Verificado: acepta PDF generado por el navegador — es la mecánica diaria actual.** | ✅ cerrada → ADR-012, ADR-016 |

**5.6 — por qué se agrega:** la respuesta 5.3 movió el entregable de "HTML imprimible" a **"PDF listo para firmar"**, que es otro problema técnico. Para elegir la estrategia (ADR-012) hace falta saber: nombre del sistema, si toma los archivos de una carpeta o si el usuario los sube a mano, y si acepta un PDF generado con "Microsoft Print to PDF".

---

## Resumen de lo que cambió por esta ronda

| Hallazgo | Consecuencia | Registro |
|---|---|---|
| Navegador congelado en Chrome/Edge 109 (Windows 7) | Línea base permanente. Prohibida una lista concreta de APIs de CSS y JS posteriores a 109 | ADR-011 |
| Sin permiso de instalación ni de cambio de flags | Confirma definitivamente el descarte de `file://`; obliga a servir por HTTP | ADR-001 (reforzada) |
| El entregable final es PDF para un sistema de firmas | El generador de documentos cambia de diseño | ADR-012 |
| SLA fuera del alcance de v1 | Se simplifican H6 y H8 | ADR-013 |
| Catálogo cerrado, sin texto libre, columna `estado` inútil | Validación estricta; el build descarta `estado` | ADR-014 |
| Permisos por grupo disponibles + trámite ágil | Se puede lograr que **ningún operador** tenga permiso de escritura sobre los datos | ADR-015 |
| Sin migración de expedientes en curso | Se elimina un riesgo del plan | — |

### Ronda 3 (2026-08-13)

| Hallazgo | Consecuencia | Registro |
|---|---|---|
| **Cuentas de Windows compartidas y sin contraseña** | No hay identidad individual del sistema operativo. El login lógico deja de ser una comodidad y pasa a ser la única identidad. Los permisos NTFS por grupo pierden valor como control de roles | **ADR-017** |
| Se puede crear una carpeta de datos nueva | Despeja el obstáculo de infraestructura de ADR-015; queda pendiente sólo la autorización del proceso servidor | ADR-015 |
| El sistema de firmas ya acepta PDF del navegador (uso diario) | ADR-012 cerrada sin pendientes; el circuito de firma no cambia hábitos | ADR-012 |
| Excepción de catálogo: ítem similar + aclaración de 200 caracteres | La validación es estricta sobre el código, con escape acotado en la descripción. La aclaración se imprime y se mide | Enmienda ADR-014 |
| El scraper vive en un historial de chat | Punto único de pérdida sobre un activo de 2 horas de corrida. Rescatarlo es la tarea más urgente del proyecto | **ADR-018** |

### Ronda 4 (2026-08-13)

| Hallazgo | Consecuencia | Registro |
|---|---|---|
| Cuentas de Windows: **una por PC**; identidad del operador basada en el **correo institucional** | Padrón de operadores propio (`config/usuarios.json`) con nombre, apellido, correo, roles y sector. El correo es la clave única y se muestra a la vista en el selector. Sin PIN en la v1 | ADR-017 (Aceptada) |
| La máquina sigue siendo un dato corroborante utilizable | Como las cuentas son una por PC, la correspondencia máquina → oficina es estable. No contradice la decisión anterior: se usa la máquina, no la cuenta de Windows | ADR-017 medidas 3 y 4 |
| El scraper corre **fuera de la intranet**; la app **no debe pedir nada a internet** | `tools/` no se despliega. El verificador de compatibilidad se amplía para fallar ante cualquier URL absoluta dentro de `app/` | ADR-018 |
