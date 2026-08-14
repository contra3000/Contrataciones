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

  // Devuelve el id del estado actual de un expediente soportando los dos
  // formatos del esquema: `estado.id` (esquema v2) o `estadoActual` (v1).
  // null si no se puede determinar.
  function idEstadoActual(expediente) {
    if (!expediente || typeof expediente !== 'object') {
      return null;
    }
    if (expediente.estado && typeof expediente.estado === 'object' &&
        typeof expediente.estado.id === 'string') {
      return expediente.estado.id;
    }
    if (typeof expediente.estadoActual === 'string') {
      return expediente.estadoActual;
    }
    return null;
  }

  SGC.core.utils = {
    idEstadoActual: idEstadoActual
  };
})(typeof window !== 'undefined' ? window : globalThis);
