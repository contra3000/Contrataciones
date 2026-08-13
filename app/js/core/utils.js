/*
 * utils.js
 * Espacio reservado para utilidades genéricas del núcleo.
 * En esta ronda no se definen utilidades: sólo se declara el sub-espacio
 * para que la estructura de directorios y de namespace quede completa.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.core) {
    throw new Error('utils.js requiere que namespaces.js se cargue primero');
  }

  SGC.core.utils = {};
})(typeof window !== 'undefined' ? window : globalThis);
