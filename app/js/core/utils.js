/*
 * utils.js
 * Utilidades genéricas del núcleo.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.core) {
    throw new Error('utils.js requiere que namespaces.js se cargue primero');
  }

  // Devuelve el id del estado actual de un expediente en el esquema v2
  // (ADR-019): `expediente.estado.id`. null si no se puede determinar.
  function idEstado(expediente) {
    if (!expediente || typeof expediente !== 'object') {
      return null;
    }
    if (expediente.estado && typeof expediente.estado === 'object' &&
        typeof expediente.estado.id === 'string') {
      return expediente.estado.id;
    }
    return null;
  }

  SGC.core.utils = {
    idEstado: idEstado
  };
})(typeof window !== 'undefined' ? window : globalThis);
