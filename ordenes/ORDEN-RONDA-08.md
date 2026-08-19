# ORDEN DE TRABAJO — RONDA 8

Proyecto: Sistema de Gestión de Contrataciones (SGC)
Hito cubierto: **H7 completo (entregables de todas las fases) + H8 parcial (Archivo Histórico) + H3-8 (respaldo)**
Emitida: 2026-08-19

---

## 0. Antes de empezar

Vale íntegramente la §0 de `ordenes/ORDEN-RONDA-01.md`.

El ciclo anterior se aprobó **sin observaciones y sin hallazgos**: el primero del proyecto. No hay correcciones arrastradas. El agujero de autorización quedó cerrado y verificado tres veces —por vos, por el auditor y por el revisor—, y el cruce del rol declarado contra el padrón, que no estaba en la orden, fue una buena decisión.

**La aplicación se probó a mano con datos reales** y funcionó de punta a punta, Fast-Track incluido. El criterio de recorrido por teclado, que llevaba tres ciclos sin poder verificarse, quedó cerrado.

### Accesos fuera del repositorio

`os.tmpdir()` y puertos locales `127.0.0.1`. Nada más.

---

## 1. Alcance

Cerrar el circuito. Hoy el expediente recorre los dieciocho pasos y produce el documento de la Fase 1; falta que produzca **los documentos de las fases que faltan**, que **se archive** al llegar al final, y que los datos **tengan respaldo**.

Con esto la primera versión queda funcionalmente completa, salvo el tablero de indicadores, que va en el ciclo 9 junto con los ajustes operativos que el usuario está listando.

**Fuera de alcance:** el tablero de KPIs y las estadísticas del catálogo de errores.

---

## 2. Entregables

### 2.1 — Las plantillas que faltan

En el ciclo 7 hiciste la Especificación Técnica de la Fase 1, bien terminada. Ese es el patrón. Ahora las cuatro que faltan, en `app/js/renders/`:

| Documento | Fase | Estado que lo produce |
|---|---|---|
| Solicitud de Contratación (SCo) | 2 | `SOLICITUD_CONTRATACION` |
| Pliego de Bases y Condiciones | 5 | `FIRMAS_PLIEGO_DISPOSICION` |
| Disposición de Adjudicación | 7 | `FIRMA_DISPOSICION` |
| Orden de Compra | 9 | `GENERACION_ORDEN_COMPRA` |

Reglas, todas heredadas de lo que ya funciona:

- **Reutilizá lo común.** Encabezado institucional, pie, numeración de páginas y la tabla de renglones son los mismos. Si terminás con cinco copias del encabezado, está mal hecho: extraé las partes compartidas a un módulo y que cada plantilla aporte sólo lo suyo.
- **Las aclaraciones de los renglones se imprimen en todas** las que lleven tabla de renglones. Es la regla que ya está y no se negocia.
- Todo texto que venga de datos del usuario pasa por el escapado que ya usás.
- Cada documento declara de qué expediente es, en qué estado se generó y con qué `catalogoVersion`.

`config.js` ya declara `entregablesObligatorios` por estado, vacío desde la ronda 1. **Ahora poblalo** para los cinco estados que producen documento, y que `validacion.validarParaAvanzar` los exija de verdad: no se puede avanzar desde `SOLICITUD_CONTRATACION` sin haber generado la SCo.

### 2.2 — Archivo Histórico (ADR del FSD §2, `InstruccionesCodigo.md` §8)

Al alcanzar `PERFECCIONADA`, el expediente se archiva:

1. Se copia la carpeta completa del expediente a `<datos>/ArchivoHistorico/<anio>/<numero>_Expediente/`.
2. Se **purga del índice** `idx/` — el tablero sólo muestra trámites activos (ADR-005).
3. El expediente original se marca como archivado. **No se borra sin confirmación explícita** (`InstruccionesCodigo.md` §14).
4. Nuevo extremo `GET /api/archivo` que lista el histórico **leyendo el directorio**, no un índice (§8.3).
5. La operación la ejecuta el servidor, no el navegador.

El listado del histórico se muestra en una vista propia, separada del tablero.

**Lo que hay que probar y es lo que se rompe:** ¿qué pasa si el archivado falla a mitad de camino? La copia parcial no puede dejar el expediente perdido: ni fuera del índice ni fuera del histórico. Definí el orden de las operaciones para que cualquier interrupción sea recuperable, y explicalo en el informe.

### 2.3 — Respaldo de la carpeta de datos (H3-8, pendiente desde la ronda 3)

Es el último hueco de infraestructura y el más caro si falla. Con archivos planos como fuente de verdad, **el respaldo es el sistema de recuperación ante desastres**.

`tools/respaldo.js`:

```
node tools/respaldo.js --datos <ruta> --destino <ruta> [--retener N]
```

- Copia consistente de toda la carpeta de datos, con fecha en el nombre.
- Retención configurable, por defecto los últimos 14.
- **No corrompe si se ejecuta mientras el servidor está escribiendo:** copiá a un temporal y renombrá al final, igual que hace el servidor.
- Informe por pantalla: qué copió, cuánto pesa, cuántos respaldos quedan.

Y lo que de verdad importa: **`tools/restaurar.js`**, que hace el camino inverso. Un respaldo que nunca se restauró no es un respaldo. El test tiene que crear datos, respaldar, borrar, restaurar y verificar que todo volvió idéntico — expedientes, índice, histórico y auditoría con la cadena íntegra.

### 2.4 — Tests

Conservando en verde los 159 actuales, en un clon limpio:

1. Cada plantilla nueva genera su documento con los renglones completos y **las aclaraciones visibles**.
2. Inyección en cada plantilla nueva: `<script>` en título y aclaración salen escapados.
3. No se puede avanzar desde un estado con `entregablesObligatorios` sin el documento generado.
4. Archivado: al llegar a `PERFECCIONADA`, la carpeta está en `ArchivoHistorico/`, el `idx/` ya no la tiene, y `GET /api/archivo` la lista.
5. Archivado interrumpido: el expediente queda recuperable, ni perdido ni duplicado.
6. `GET /api/archivo` arma el listado leyendo el directorio, no un índice.
7. Respaldo y restauración: ciclo completo con verificación de la cadena de auditoría después de restaurar.
8. Respaldo con el servidor escribiendo en paralelo: la copia no queda corrupta.

### 2.5 — `INFORME-RONDA-08.md`

Las nueve secciones de siempre. En la 2, explicá el orden de operaciones del archivado y por qué una interrupción es recuperable.

---

## 3. Reglas de conducta y cierre

Las siete de `ORDEN-RONDA-01.md` §3. La documentación es de sólo lectura.

Cierre: `node --test` y el guardián en verde en un clon limpio, informe completo, **un solo commit** con mensaje `Ronda 8 — Entregables, Archivo Historico y respaldo`, `git status` limpio.

**Novedad: esta vez sí se hace push.** El repositorio pasa a sincronizarse con el remoto al cerrar cada ronda. Después del commit:

```
git push
```

---

## 4. Criterios de aceptación

| # | Verificación | Resultado exigido |
|---|---|---|
| 1 | `node --test` en un clon recién hecho | Todo en verde |
| 2 | `node tools/check-compat.js` | Salida 0 |
| 3 | Las cuatro plantillas nuevas | Generan documento completo, aclaraciones impresas |
| 4 | Encabezado y pie | Compartidos, no copiados en cada plantilla |
| 5 | Inyección en las plantillas nuevas | Escapada |
| 6 | `entregablesObligatorios` poblado en los 5 estados | La validación los exige |
| 7 | Archivado al llegar a `PERFECCIONADA` | Copiado, purgado del índice, marcado |
| 8 | Archivado interrumpido | Expediente recuperable |
| 9 | `GET /api/archivo` | Lista leyendo el directorio |
| 10 | `node tools/respaldo.js` | Copia con fecha y retención |
| 11 | `node tools/restaurar.js` | Restaura idéntico, cadena de auditoría íntegra |
| 12 | Respaldo con escritura concurrente | Copia no corrupta |
| 13 | Archivos sobre 400 líneas | Ninguno |
| 14 | `INFORME-RONDA-08.md` con sus 9 secciones | Completo |

---

## 5. Qué se está evaluando

Que el expediente termine bien: con sus documentos, archivado donde corresponde y con los datos respaldados.

Pesa, en este orden: (1) el ciclo completo de respaldo y **restauración** verificado, (2) que el archivado sea recuperable ante una interrupción, (3) que las cuatro plantillas compartan lo común en vez de copiarlo, (4) que los entregables obligatorios se exijan de verdad, (5) honestidad del informe, (6) prolijidad.

El punto 1 va primero por una razón: es lo único de esta lista que, si falla, no se puede arreglar después.
