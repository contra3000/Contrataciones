'use strict';

/*
 * cotas-encabezado.js
 * ORDEN-RONDA-11 §2.3. Cota máxima por campo del encabezado del requerimiento
 * (16 campos; el orden menciona 14 — ver informe §4). Se carga después de
 * config.js y lo extiende con un mapa de cotas que validación usa para el
 * guard server-side.
 */

(function () {
  if (!SGC || !SGC.core || !SGC.core.config) {
    throw new Error('cotas-encabezado.js requiere que core/config.js se cargue primero');
  }

  var cfg = SGC.core.config;

  // Valores positivos significan longitud máxima de texto; Infinity = sin límite
  var CAMPOS_ENCABEZADO_COTAS = {
    tipoDocumento:        120,
    nroExpedienteGde:     40,
    nroExpedienteInterno: 40,
    fechaSolicitud:       10,
    NombreReqIS:          80,
    unidadReqIS:          40,
    cargadoPorIS:         40,
    aCargoDeIS:           40,
    FECHACARGAREQIS:      10,
    DEPENDENCIAREQIS:     40,
    LUGARENTREGA:         120,
    fechaEstimadaEntrega: 10,
    DUPLICADO:            40,
    observaciones:        500,
    tipoContrato:         40
  };

  cfg.CAMPOS_ENCABEZADO_COTAS = CAMPOS_ENCABEZADO_COTAS;
})();
