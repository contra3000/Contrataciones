/*
 * app.js
 * Arranque de la pantalla de búsqueda (ORDEN-RONDA-04 §3.4).
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.catalogo || !SGC.catalogo.buscador) {
    throw new Error('app.js requiere namespaces.js, indice.js, carga.js y buscador.js');
  }

  var contenedor = document.getElementById('app');
  if (!contenedor) {
    throw new Error('No se encontró el contenedor #app');
  }

  SGC.catalogo.buscador.montar(contenedor);
})(window);