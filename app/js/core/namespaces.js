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
  // Se usa notación por corchetes para no emitir el token "export" en el código,
  // que el guardián de compatibilidad interpretaría como un módulo ES.
  SGC['export'] = {};
})(typeof window !== 'undefined' ? window : globalThis);
