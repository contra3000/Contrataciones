# INFORME RONDA 12 — H13 cierre + H15 observabilidad y dashboards

## Resumen

Ronda 12 cierra el bloque H13 con 7 correcciones (2 ADRs nuevos: ADR-030 y ADR-031) e implementa H15 (observabilidad, indicadores declarativos y dashboards por rol). El árbol queda limpio, 315 tests pasan, 0 fallos.

## 1. ADR-031: YAML siempre entrecomillado

**Archivo:** `app/js/export/pliego-yaml.js`

El emisor de YAML siempre escribe strings entre comillas dobles. Se eliminó `necesitaEscapar` (ya no es necesario). Las claves del objeto raíz quedan sin comillas (son claves YAML, no valores). Se agregó `\r` al regex de escape. Se exporta `MARCA_FALTA` = `_FALTA_` para campos genuinamente ausentes.

**Tests que validan:**
- YAML roundtrip 20 textos contra PyYAML (test ida y vuelta)
- Valor terminado en ':' no rompe
- Tabulador no rompe
- Espacios al inicio/final sobreviven
- MARCA_FALTA entrecomillado

## 2. ADR-030: Vista previa del Pliego de Bases y Condiciones

**Archivos:**
- `app/js/core/config.js`: `pliego-bases-condiciones` eliminado de ENTREGABLES y entregablesObligatorios. Agregado `yaml-pliego` (fase 5, sin firma).
- `app/js/renders/vista-previa-pliego.js` (104 líneas): Render nuevo — sin estado, sin firma, sin leyenda ADR-023, con banner "Vista previa — no es el Pliego de Bases y Condiciones". Se registra como `SGC.renders.vistaPreviaPliego`.
- `app/js/renders/pliego-bases-condiciones.js`: Código muerto (ya no se carga desde index.html).

**Tests que validan:**
- `pliego-bases-condiciones` no es entregable obligatorio de ningún estado
- `vista-previa-pliego` compone HTML sin firma ni ADR-023
- `yaml-pliego` no tiene `pliego-bases-condiciones` como entregable

## 3. ANEXO 1: precio derivado y trazabilidad de precarga

**Archivos:**
- `app/js/views/anexo-uno.js` (381 líneas): `precioDerivado()` calcula desde `preventivoContratacion(renglones)`. Muestra valor calculado al usuario; si corrige manualmente, muestra `(calculado: $ X.XXX)`. Los valores derivados se guardan como `precioReferenciaCalculado` y `empresasCalculadas` en el objeto precarga (se ignoran al guardar).
- `server/expedientes.js` (393 líneas): `apiGuardar` detecta cambios en 13 campos de precarga del ANEXO 1 y llama a `registrarPrecargaEditada`. La detección y escritura se extrajeron a `eventos.registrarGuardado()` para mantener < 400 líneas.

**Tests que validan:**
- `preventivoContratacion` retorna total correcto para renglones
- `registrarPrecargaEditada` escribe evento con tipo, campo, valores

## 4. H13: Otras correcciones

- **§2.5 Integridad:** Test que quita `SGC.core.config` del objeto (no del array). `verificarModulos` lanza `/faltan los módulos/`. El test lo restaura después.
- **§2.6 CAUSAL_OCA / NOTA_OCA:** Dos nombres, una definición cada uno. `NOTA_OCA` en `core/requerimiento.js` (operativo), `CAUSAL_OCA_NORMATIVA` en `renders/requerimiento.js` (cita normativa).
- **§2.7 Campos YAML:** `frecuencia_provision`, `plazo_entrega`, `horario` mapeados desde ANEXO 1 a organismo. `nro_expediente_gde` usa MARCA_FALTA cuando está vacío.

## 5. H15: Observabilidad (ADR-024)

**Archivos nuevos:**
- `server/eventos.js` (254 líneas): Módulo append-only con escritura atómica. 14 funciones `registrar*`, `registrarGuardado` (helper para apiGuardar), `leerEventos` (por expediente), `rutaEventos` (endpoint para exploración).
- `app/js/core/indicadores.js` (207 líneas): Catálogo declarativo de 10 fichas (TIEMPO_POR_FASE, TIEMPO_TOTAL, TASA_DEVOLUCION_MOTIVO, TASA_DEVOLUCION_SECTOR, RENGLONES_ACLARACION_RUBRO, BUSQUEDAS_SIN_RESULTADO, DISPERSION_PRESUPUESTOS, RENGLONES_POR_AREA, EDICIONES_POR_GRUPO, ENTREGABLES_GENERADOS). Cada ficha: `{id, nombre, evento, agregacion, formato}`. Motor: `calcularFicha(ficha, eventos)` y `calcularTodas(eventos)`. `tableroPorDefecto(rol)` retorna IDs de fichas para cada rol.
- `app/js/views/tablero.js` (114 líneas): Dashboard por rol con renderizado de fichas y comparatorio.
- `app/js/views/exploracion.js` (234 líneas): Vista de eventos con filtros por tipo/texto, exportación CSV/JSON, límite de 200 filas visibles, banner de datos sensibles.

**Tests que validan:**
- `escribirEvento` append-only (10 eventos no se pierden)
- `leerEventos` retorna todos los eventos
- Indicador calculado desde eventos (tiempo_total, tasa_devolucion_motivo)
- Agregar ficha al catálogo se refleja sin tocar la vista
- `tableroPorDefecto` retorna array para cada rol
- Preferencia de tablero en el padrón del operador

## 6. Metricas

| Métrica | Valor |
|---------|-------|
| Tests totales | 315 |
| Tests pass | 315 |
| Tests fail | 0 |
| Archivos inspeccionados (check-compat) | 55 |
| Violaciones (check-compat) | 0 |
| Commit | pendiente |
