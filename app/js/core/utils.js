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

  // Conteo de caracteres en PUNTOS DE CÓDIGO, no unidades UTF-16
  // (ORDEN-RONDA-10-CIERRE §2: un solo criterio para el validador, el contador
  // visible y la regla de desborde del anexo). `String.length` cuenta
  // unidades UTF-16: para acentos y eñes coincide con lo que ve el usuario,
  // para emojis no ('🛩'.length === 2 pero el usuario ve un carácter). Acá el
  // emoji cuenta 1, igual que cualquier otro carácter visible.
  function contarCaracteres(texto) {
    if (typeof texto !== 'string') {
      return 0;
    }
    return Array.from(texto).length;
  }

  SGC.core.utils = {
    idEstado: idEstado,
    contarCaracteres: contarCaracteres
  };
})(typeof window !== 'undefined' ? window : globalThis);
