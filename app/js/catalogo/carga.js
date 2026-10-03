/*
 * carga.js
 * Carga del catálogo (ORDEN-RONDA-04 §3.3, ORDEN-RONDA-28 §1).
 *
 * Único módulo de la app que toca la red. Usa rutas relativas al documento
 * (catalogo/...) y cachea en memoria lo que ya bajó: el índice completo al
 * iniciar y los fragmentos de ítems bajo demanda. Nunca pide el catálogo
 * completo de ~40 MB: el índice pesa ~1 MB y cada fragmento menos de 300 KB.
 *
 * Hay una tercera cosa que se pide bajo demanda y sólo si alguien la necesita:
 * catalogo/codigos.json, el índice de código -> clase (~3 MB, ver cargarCodigos).
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
    fragmentos: {},
    codigos: null
  };

  // Peticiones esperando su <script>: clave -> { resolver, rechazar }.
  // Vive en el módulo y no en el estado del catálogo porque es machinery de
  // transporte, no parte del catálogo.
  var pendientes = {};

  // Peticiones ya en vuelo: clave -> promesa. Sin esto, resolver veinte
  // renglones a la vez (que es lo que hace una importación) mete veinte
  // <script> del mismo archivo, la última se queda con la espera de `pendientes`
  // y las otras diecinueve no se resuelven nunca. Se comparte la misma promesa
  // mientras dura, y al terminar queda la copia en el caché de siempre.
  var enVuelo = {};

  function unaSolaVez(clave, pedir) {
    if (Object.prototype.hasOwnProperty.call(enVuelo, clave)) {
      return enVuelo[clave];
    }
    var promesa = pedir().then(function (datos) {
      delete enVuelo[clave];
      return datos;
    }, function (err) {
      delete enVuelo[clave];
      throw err;
    });
    enVuelo[clave] = promesa;
    return promesa;
  }

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
    return unaSolaVez('items/' + idClase, function () {
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
    });
  }

  /*
   * cargarCodigos()
   *
   * El índice código -> idClase, que el build deja en catalogo/codigos.json
   * (~3 MB). No se pide al iniciar: pesa más que el índice entero y casi nadie
   * lo necesita. Lo piden sólo quienes deben comprobar si un código existe
   * (el generador, al importar un JSON: ORDEN-RONDA-28 §4).
   *
   * Hace falta porque el código no dice en qué fragmento está el ítem: el código
   * trae la clasificación del catálogo de origen (2.9.4-3622.1) y el id de
   * fragmento es de esta taxonomía (ese PRESILLA vive en el fragmento 378, que
   * es COPAS P/POSTRE). Sin el índice, resolver un código obligaría a leer los
   * ~6.900 fragmentos del catálogo.
   */
  function cargarCodigos() {
    if (estado.codigos) {
      return Promise.resolve(estado.codigos);
    }
    return unaSolaVez('codigos', function () {
      return peticion('catalogo/codigos.json').then(function (codigos) {
        estado.codigos = codigos;
        return codigos;
      });
    });
  }

  /*
   * resolverCodigo(codigo) -> Promise<item|null>
   *
   * El ítem del catálogo para ese código, o null si no existe. Descarga el
   * índice la primera vez y después sólo el fragmento de la clase, que ya
   * queda cacheado como cualquier otro.
   */
  function resolverCodigo(codigo) {
    if (!codigo) {
      return Promise.resolve(null);
    }
    return cargarCodigos().then(function (codigos) {
      var idClase = codigos[codigo];
      if (!idClase) {
        return null;
      }
      return cargarClase(idClase).then(function (items) {
        for (var i = 0; i < items.length; i++) {
          if (items[i].codigo === codigo) {
            return items[i];
          }
        }
        return null;
      });
    });
  }

  SGC.catalogo.carga = {
    iniciar: iniciar,
    cargarClase: cargarClase,
    cargarCodigos: cargarCodigos,
    resolverCodigo: resolverCodigo,
    obtenerEstado: function () {
      return estado;
    }
  };

  SGC.catalogo.recibir = recibir;
})(typeof window !== 'undefined' ? window : globalThis);