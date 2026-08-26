/*
 * namespaces.js
 * Define el namespace global único del sistema y sus sub-espacios.
 * Patrón IIFE, 'use strict'. No ensucia el objeto window con nada más que SGC.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC || (root.SGC = {});

  SGC.core = SGC.core || {};
  SGC.adapters = {};
  SGC.catalogo = {};
  SGC.views = {};
  SGC.renders = {};
  SGC.descargas = {};
})(typeof window !== 'undefined' ? window : globalThis);
