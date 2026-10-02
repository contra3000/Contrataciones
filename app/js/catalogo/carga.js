/*
 * carga.js
 * Carga del catálogo (ORDEN-RONDA-04 §3.3, ORDEN-RONDA-28 §1).
 *
 * Único módulo de la app que toca la red. Usa rutas relativas al documento
 * (catalogo/...) y cachea en memoria lo que ya bajó: el índice completo al
 * iniciar y los fragmentos de ítems bajo demanda. Nunca pide el catálogo
 * completo de ~40 MB: el índice pesa ~1 MB y cada fragmento menos de 300 KB.
 *
 * Cómo llega cada archivo (ORDEN-RONDA-28 §1, ADR-044):
 *   - con servidor (http:), por fetch, como siempre;
 *   - abierto como archivo (file:), Chrome no deja hacer fetch, así que se
 *     inyecta un <script> que llama a SGC.catalogo.recibir. Para eso el build
 *     escribe, junto a cada .json, un .js hermano con los mismos datos.
 * La rama se elige sola según location.protocol, así que la aplicación con
 * servidor no cambia de comportamiento.
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

  // Peticiones esperando su <script>: clave -> { resolver, rechazar }.
  // Vive en el módulo y no en el estado del catálogo porque es machinery de
  // transporte, no parte del catálogo.
  var pendientes = {};

  function esArchivo() {
    // En los tests y en Node no hay location: se asume red, que es el caso
    // viejo. location.protocol es 'file:' exactamente con doble clic.
    return !!(root.location && root.location.protocol === 'file:');
  }

  /*
   * SGC.catalogo.recibir(clave, datos)
   *
   * Lo llaman los .js hermanos del catálogo. Si hay una promesa esperando esa
   * clave, la resuelve; si no, se guarda, por si el script llegó antes de que
   * alguien pidiera el archivo (no debería pasar, pero no cuesta nada).
   */
  function recibir(clave, datos) {
    var pendiente = pendientes[clave];
    if (pendiente) {
      delete pendientes[clave];
      pendiente.resolver(datos);
      return;
    }
    estado.porRecibir = estado.porRecibir || {};
    estado.porRecibir[clave] = datos;
  }

  function porFetch(ruta) {
    return fetch(ruta).then(function (res) {
      if (!res.ok) {
        throw new Error('No se pudo leer ' + ruta);
      }
      return res.json();
    });
  }

  /*
   * Inyecta <script src="ruta.js"> y espera a que el archivo llame a recibir().
   * El script lleva la misma ruta que se le pidió, con la extensión .js, que es
   * la clave con la que el build lo entrega.
   */
  function porScript(ruta) {
    var clave = ruta.replace(/\.json$/, '.js');
    if (estado.porRecibir && Object.prototype.hasOwnProperty.call(estado.porRecibir, clave)) {
      var yaVino = estado.porRecibir[clave];
      delete estado.porRecibir[clave];
      return Promise.resolve(yaVino);
    }
    return new Promise(function (resolver, rechazar) {
      pendientes[clave] = { resolver: resolver, rechazar: rechazar };
      var etiqueta = document.createElement('script');
      etiqueta.src = clave;
      etiqueta.onerror = function () {
        delete pendientes[clave];
        rechazar(new Error('No se pudo leer ' + clave));
      };
      document.head.appendChild(etiqueta);
    });
  }

  function peticion(ruta) {
    if (esArchivo()) {
      return porScript(ruta);
    }
    return porFetch(ruta);
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

  SGC.catalogo.recibir = recibir;
})(typeof window !== 'undefined' ? window : globalThis);