/*
 * config-carga.js
 * ORDEN-RONDA-28 §2 (ADR-044). La configuración de la aplicación llega como un
 * .js hermano y no por fetch, porque el generador se abre con doble clic
 * (file://) y Chrome no deja hacer fetch ahí.
 *
 * El archivo que la entrega lo escribe tools/build-config.js desde
 * config/aplicacion.json, y llama a SGC.cargaConfig.recibir con la ruta lógica
 * del .json y los mismos datos: una sola fuente de verdad, sin copia a mano.
 *
 * La aplicación con servidor NO usa este módulo: sigue leyendo
 * config/aplicacion.json con fetch (app/js/app.js), que es su comportamiento de
 * siempre y no se toca.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC) {
    throw new Error('config-carga.js requiere que namespaces.js se cargue primero');
  }

  // ruta lógica (config/aplicacion.json) -> contenido.
  var entregadas = {};

  function recibir(ruta, datos) {
    if (typeof ruta !== 'string' || ruta === '') {
      throw new Error('SGC.cargaConfig.recibir necesita la ruta del archivo');
    }
    entregadas[ruta] = datos;
  }

  function obtener(ruta) {
    return Object.prototype.hasOwnProperty.call(entregadas, ruta) ? entregadas[ruta] : null;
  }

  SGC.cargaConfig = {
    recibir: recibir,
    obtener: obtener,
    entregadas: function () {
      return Object.keys(entregadas).sort();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);