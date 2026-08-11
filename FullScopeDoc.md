# FULL SCOPE DOCUMENT (FSD)
Proyecto: Sistema de Gestión de Contrataciones (SGC) - Entorno Aislado
Unidad: División Contrataciones Moreno (VII Brigada Aérea)
Naturaleza del Entorno: Intranet (Air-Gapped), sin base de datos SQL, persistencia en sistema de archivos (Carpetas Compartidas de Red).

## 1. Visión General y Objetivos
El objetivo principal del SGC es resolver las deficiencias de entrada de datos ("Garbage in, Garbage out") en los requerimientos técnicos y legales, estandarizando y endureciendo el proceso de inicio. Busca disminuir los tiempos de tramitación, aumentar el porcentaje de éxito (adjudicación total de renglones) y brindar conciencia situacional en tiempo real a todos los operadores mediante un tablero visual (Kanban) y métricas de desempeño (KPIs).

## 2. Arquitectura de Software y Persistencia
Dadas las restricciones de la infraestructura, el sistema se construirá con tecnologías web estáticas (HTML/CSS/JS) ejecutadas en los navegadores de los clientes, interactuando con una unidad de red compartida.

Persistencia Híbrida (JSON): Los datos transaccionales de cada expediente vivirán en archivos .json individuales dentro de un árbol de directorios anual (/2026/001_Expediente/datos.json).

Patrón de Archivo Índice (Master Index): Para evitar la saturación de red al cargar el tablero Kanban, la aplicación leerá un único archivo liviano (master_index.json) que contendrá exclusivamente los metadatos de los trámites activos.

IndexedDB para Catálogo Pesado: El catálogo de ítems (aprox. 40MB) se alojará en la base de datos local del navegador (IndexedDB) del operador en el primer inicio de sesión, permitiendo búsquedas en tiempo real (autocompletado) mediante Web Workers sin congelar la interfaz ni saturar la red.

Control de Concurrencia (Optimistic Locking): Cada JSON transaccional incluirá una marca de versión/timestamp. Si dos operadores intentan guardar cambios simultáneos sobre el mismo expediente, el sistema bloqueará la sobreescritura ciega, protegiendo la integridad de los datos.

Cold Storage: Al alcanzar el estado de "Perfeccionada", el sistema migrará la carpeta del expediente a un directorio de sólo lectura (Archivo Histórico) y lo purgará del master_index.json.

## 3. Roles, Actores y Seguridad
El sistema operará bajo el esquema de una "PC Custodiada" (o permisos estrictos de Windows en la carpeta raíz) combinado con un sistema de "Login Lógico" en el frontend para el enrutamiento de permisos.

### Actores Identificados:

Usuario (Generador): Rol común.

Abastecimiento: Rol Gestor / Rol Supervisor.

Contrataciones: Rol Gestor / Rol Supervisor.

Asesoría Jurídica: Rol común.

Contaduría: Rol común.

Restricción funcional: El operador, tras loguearse, sólo podrá ejecutar acciones de avance/retroceso en las columnas que correspondan a su rol, aunque mantendrá visibilidad global del tablero.

## 4. Flujo de Trabajo y Estados (18 Pasos)
El sistema abandona el "Drag & Drop" libre para adoptar transiciones de estado estrictas y auditadas (mediante botones de "Avanzar" y "Devolver por Observación").

### Fase 1 (Usuario): 
1. Especificaciones Técnicas (Admite sub-estados de "Borrador" de guardado local).

### Fase 2 (Abastecimiento): 
2. Solicitud de Contratación (SCo) 
3. Análisis de SCo 
4. Autorización de SCo.

### Fase 3 (Contrataciones): 
5. Revisión de SCo 
6. Confección de Proyectos.

### Fase 4 (Asesoría Jurídica): 
7. Dictamen Inicial.

### Fase 5 (Contrataciones): 
8. Diligencia 
9. Firmas de Pliego y Disposición 
10. Publicación 
11. Apertura / Pedido de informes a Usuario y Economía 
12. Evaluación.

### Fase 6 (Asesoría Jurídica): 
13. Dictamen Final.

### Fase 7 (Contrataciones): 
14. Firma de Disposición -> 15. Adjudicación.

### Fase 8 (Contaduría): 
16. Afectación.

### Fase 9 (Contrataciones): 
17. Generación de Orden de Compra.

### Fase 10 (Abastecimiento): 
18. Perfeccionada (Cierre y Archivo Histórico).

## 5. Experiencia de Usuario e Interfaz (UI/UX)
Wizard de Onboarding: El usuario será guiado paso a paso para completar requerimientos, con campos estrictamente validados antes de permitir la generación del entregable.

Generación de Entregables: El sistema transformará los datos del JSON en documentos paginados (ej. HTML estructurado o archivos visualmente listos para firma física/digital). Estos archivos convivirán en la carpeta del expediente y serán enlazados en la vista de la tarjeta.

Fast-Track (Importación JSON): Los usuarios podrán descargar un JSON "Modelo" y subirlo posteriormente (eventualmente rellenado con herramientas IA externas) para pre-poblar los formularios de inicio.

Manejo de Rechazos: Todo retroceso de fase exigirá la selección de un motivo basado en un Catálogo de Errores cerrado, alimentando la base estadística de desempeño.

## 6. Tableros, SLAs y Preparación para IA (AI-Readiness)
Gestión de Vencimientos (SLAs): Configuración manual de fechas límite por usuario para sus procesos asignados.

Dashboard de KPIs: Consolidación de tiempos de trámite, tasas de fracaso y estadísticas basadas en el Catálogo de Errores.

Log de Auditoría Nativo: Cada JSON guardará un array de historial inmutable (quién, qué y cuándo) para cada modificación de estado.

Exportación AI-Ready: Por cada proceso, el sistema permitirá descargar el JSON transaccional crudo, adjuntando de forma automática un archivo local generado en formato Markdown (resumen narrativo de los hitos del expediente), ideal para su digestión por LLMs externos.

Compliance de Seguridad: Toda exportación de datos del sistema air-gapped hacia terminales externas disparará un Modal de Advertencia sobre la responsabilidad del manejo de datos sensibles por parte del operador.
