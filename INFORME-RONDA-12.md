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
| Commit | `3bdae8a` |

## 7. Contradicciones e información faltante (sección §4 del informe estándar)

- **Al cierre de la ronda 12, `renders/pliego-bases-condiciones.js` quedó como
  código muerto** —la línea 25 del §2 lo registra: "ya no se carga desde
  index.html"—, pero el archivo seguía en el árbol. La orden 13 (§2.2) lo hizo
  desaparecer; el dato faltante en mi cierre era que el archivo no se
  mantenía por sí mismo: quedó de más y sólo la orden lo barrió. No hubo
  nada que romperlo: ningún estado lo exige y el entregable real de esa fase
  es `yaml-pliego` (sin firma).
- **El export CSV de la exploración (H15) salía sin neutralizar fórmulas.** No
  era un riesgo declarado en el cierre: la orden 13 (§2.1) lo detectó y lo
  corrigió con el apóstrofo preventivo. Contradicción con la palabra
  "exportación" del §5: exportar datos crudos que abren fórmulas no era
  exportar, era vulnerar al que abre el archivo.
- **La tabla de métricas del §6 quedó a medio escribir**: "Commit | pendiente".
  El informe se escribió antes de publicar; el commit que cerró la ronda 12
  es `3bdae8a` ("Ronda 12 - H13 cierre + H15 observabilidad y dashboards por
  rol").
- **No encontré dato oficial sobre qué pasa con los eventos después del cierre
  del expediente**: la observabilidad (ADR-024) los mantiene en
  `datosDir/eventos/<id>.jsonl` junto al expediente, y el histórico se copia
  con la carpeta al archivar; la conservación a largo plazo quedó como
  decisión mía (conservar todo, no purgar).

## 8. Qué NO hice (sección §5 del informe estándar)

- **No toqué la documentación de sólo lectura**: ADR-021 a ADR-031 y las
  órdenes. Sólo leí.
- **No restringí por rol el acceso a los eventos crudos**: `GET /api/eventos`
  sirve el registro completo a quien lo pida; la advertencia de datos
  sensibles es de la vista, no del servidor (ADR-024 §3.7). Quedó anotado
  como riesgo para un ciclo futuro; el consejo de la vista es la única
  frontera hoy.
- **No corrí contra datos de producción ni contra la red**: carpetas
  temporales en `os.tmpdir()` y `127.0.0.1` con puerto 0, como siempre.
- **No agarré el indicador si a la vista de exploración le faltan nodos del
  DOM**: `montar` guarda existencia (da igual si la sección no está en el
  HTML); sólo el servidor verifica coherencia de dependencias.

## 9. Riesgos que veo (sección §6 del informe estándar)

- **El CSV era inyectable y nadie lo sabía** (hasta la orden 13). No entra en
  el resumen de lo hecho porque fue la orden la que lo vio; con su corrección
  hoy la celda no ejecuta fórmulas. Riesgo modelo de lo que no se ve hasta
  que otro lo lee.
- **Los eventos contienen emails, pasos y fechas** y la exploración los
  muestra enteros; el acceso al servidor no distingue Jefe de operador. Si
  un rol ajeno abre la URL, ve el registro completo (ADR-024 lo advierte en
  pantalla, nada más).
- **La suite pesa ~3 minutos** porque levanta servidores reales; seguirá
  creciendo con cada ronda. Hoy corre en una sola pasada verde (315/0), pero
  el costo de cada agregado es alto.
- **La vista previa del pliego puede dar falsa confianza**: dice "vista
  previa — no es el Pliego de Bases y Condiciones" y no lleva firmas, pero el
  operador puede usarla como borrador del real. El deslinde es de la etiqueta.

## 10. Accesos fuera del repositorio (sección §8 del informe estándar)

- `os.tmpdir()` para las carpetas de datos de los tests (creadas y eliminadas
  por corrida).
- `127.0.0.1` con puerto 0 (asignado por el sistema) para los servidores de
  prueba.
- `yaml_roundtrip.py` (tests/helpers) invoca el `python` del sistema con
  PyYAML para el ida y vuelta del emisor YAML (ADR-031); no instala nada.
- Nada más: cero dependencias de npm, cero redes externas.
