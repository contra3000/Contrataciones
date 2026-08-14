/*
 * repo.http.js
 * Implementación del contrato (ADR-002) que habla con server/servidor.js.
 *
 * - Traduce el 409 del servidor a {ok:false, conflicto:true, versionRemota},
 *   sin lanzar excepción: un conflicto es un resultado esperado del negocio.
 * - Los errores de red sí son excepciones, con mensaje en español y código
 *   'RED'.
 * - Un expediente inexistente rechaza con código 'NO_ENCONTRADO'.
 * - historico / archivar / guardarEntregable no están expuestos por el
 *   servidor (ORDEN-RONDA-03 §3.4): lanzan un error en español con código
 *   'NO_EXPUESTO'.
 *
 * La base se inyecta en la factoría: este archivo no contiene ninguna
 * dirección literal (ADR-018). Usa `fetch`, presente en Chrome 42+ y en
 * Node 18+.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.adapters) {
    throw new Error('repo.http.js requiere que namespaces.js se cargue primero');
  }

  function errorNoEncontrado(id) {
    var e = new Error('expediente no encontrado: ' + id);
    e.codigo = 'NO_ENCONTRADO';
    return e;
  }

  function errorNoExpuesto(nombre) {
    var e = new Error('repo.http: ' + nombre + ' no está expuesto por el servidor (ORDEN-RONDA-03 §3.4)');
    e.codigo = 'NO_EXPUESTO';
    return e;
  }

  function errorDeRespuesta(respuesta, contexto) {
    var e = new Error('repo.http: ' + contexto + ' (el servidor respondió estado ' + respuesta.status + ')');
    e.codigo = 'HTTP_' + respuesta.status;
    return e;
  }

  function crearRepoHttp(baseUrl) {
    if (typeof baseUrl !== 'string' || baseUrl.length === 0) {
      throw new Error('repo.http: crear() requiere la base del servidor (la dirección de la PC donde corre server/servidor.js)');
    }
    var base = baseUrl.replace(/\/+$/, '');

    function ruta(segmentos) {
      var partes = [base, 'api'].concat(segmentos);
      return partes.join('/');
    }

    function pedir(metodo, url, cuerpo) {
      var opciones = {
        method: metodo,
        headers: { 'Content-Type': 'application/json' }
      };
      if (cuerpo !== undefined) {
        opciones.body = JSON.stringify(cuerpo);
      }
      return fetch(url, opciones).then(function (respuesta) {
        return respuesta.json().catch(function () {
          return null;
        }).then(function (cuerpoRespuesta) {
          return { status: respuesta.status, cuerpo: cuerpoRespuesta };
        });
      });
    }

    function pedirConErrorRed(metodo, url, cuerpo) {
      return pedir(metodo, url, cuerpo).catch(function (e) {
        var error = new Error('repo.http: error de red al conectar con el servidor: ' + e.message);
        error.codigo = 'RED';
        throw error;
      });
    }

    return {
      listarIndice: function () {
        return pedirConErrorRed('GET', ruta(['indice'])).then(function (respuesta) {
          if (respuesta.status !== 200) {
            throw errorDeRespuesta(respuesta, 'no se pudo listar el índice');
          }
          return respuesta.cuerpo;
        });
      },

      leerExpediente: function (id) {
        return pedirConErrorRed('GET', ruta(['expedientes', id])).then(function (respuesta) {
          if (respuesta.status === 404) {
            throw errorNoEncontrado(id);
          }
          if (respuesta.status !== 200) {
            throw errorDeRespuesta(respuesta, 'no se pudo leer el expediente ' + id);
          }
          return respuesta.cuerpo;
        });
      },

      crearExpediente: function (datosIniciales, contexto) {
        return pedirConErrorRed('POST', ruta(['expedientes']), {
          datosIniciales: datosIniciales,
          contexto: contexto
        }).then(function (respuesta) {
          if (respuesta.status !== 201) {
            throw errorDeRespuesta(respuesta, 'no se pudo crear el expediente');
          }
          return respuesta.cuerpo;
        });
      },

      guardarExpediente: function (id, expediente, versionEsperada, contexto) {
        return pedirConErrorRed('PUT', ruta(['expedientes', id]), {
          expediente: expediente,
          versionEsperada: versionEsperada,
          contexto: contexto
        }).then(function (respuesta) {
          if (respuesta.status === 200) {
            return { ok: true, version: respuesta.cuerpo.version };
          }
          if (respuesta.status === 409) {
            return {
              ok: false,
              conflicto: true,
              versionRemota: respuesta.cuerpo.versionRemota
            };
          }
          if (respuesta.status === 404) {
            throw errorNoEncontrado(id);
          }
          throw errorDeRespuesta(respuesta, 'no se pudo guardar el expediente ' + id);
        });
      },

      listarArchivoHistorico: function () {
        return Promise.reject(errorNoExpuesto('listarArchivoHistorico'));
      },

      archivar: function () {
        return Promise.reject(errorNoExpuesto('archivar'));
      },

      guardarEntregable: function () {
        return Promise.reject(errorNoExpuesto('guardarEntregable'));
      }
    };
  }

  SGC.adapters.repoHttp = { crear: crearRepoHttp };
})(typeof window !== 'undefined' ? window : globalThis);