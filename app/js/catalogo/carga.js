/*
 * carga.js
 * Carga del catálogo (ORDEN-RONDA-04 §3.3).
 *
 * Único módulo de la app que toca la red. Usa rutas relativas al documento
 * (catalogo/...) y cachea en memoria lo que ya bajó: el índice completo al
 * iniciar y los fragmentos de ítems bajo demanda. Nunca pide el catálogo
 * completo de ~40 MB: el índice pesa ~1 MB y cada fragmento menos de 300 KB.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.catalogo) {
    throw new Error('carga.js requiere que namespaces.js se cargue primero');
  }

  var estado = {
    manifiesto: null,
    rubros: null,
    clases: null,
    clasesPorId: {},
    fragmentos: {}
  };

  function peticion(ruta) {
    return fetch(ruta).then(function (res) {
      if (!res.ok) {
        throw new Error('No se pudo leer ' + ruta);
      }
      return res.json();
    });
  }

  function iniciar() {
    return Promise.all([
      peticion('catalogo/manifiesto.json'),
      peticion('catalogo/rubros.json'),
      peticion('catalogo/clases.json')
    ]).then(function (respuestas) {
      estado.manifiesto = respuestas[0];
      estado.rubros = respuestas[1];
      estado.clases = respuestas[2];
      estado.clasesPorId = {};
      for (var i = 0; i < estado.clases.length; i++) {
        var e = estado.clases[i];
        estado.clasesPorId[e[0]] = {
          idClase: e[0],
          idRubro: e[1],
          clase: e[2],
          cantidad: e[3],
          partes: e.length > 4 ? e[4] : 1
        };
      }
      SGC.catalogo.indice.montar({ rubros: estado.rubros, clases: estado.clases });
      return estado;
    });
  }

  function cargarClase(idClase) {
    var cacheado = estado.fragmentos[idClase];
    if (cacheado) {
      return Promise.resolve(cacheado);
    }
    var info = estado.clasesPorId[idClase];
    if (!info) {
      return Promise.reject(new Error('No existe la clase ' + idClase));
    }
    var partes = info.partes || 1;
    var rutas = [];
    for (var p = 0; p < partes; p++) {
      var nombre = partes === 1
        ? String(idClase) + '.json'
        : String(idClase) + '_p' + (p + 1) + '.json';
      rutas.push(peticion('catalogo/items/' + nombre));
    }
    return Promise.all(rutas).then(function (listas) {
      var items = [];
      for (var i = 0; i < listas.length; i++) {
        items = items.concat(listas[i]);
      }
      estado.fragmentos[idClase] = items;
      SGC.catalogo.indice.registrarCodigos(items);
      return items;
    });
  }

  SGC.catalogo.carga = {
    iniciar: iniciar,
    cargarClase: cargarClase,
    obtenerEstado: function () {
      return estado;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);