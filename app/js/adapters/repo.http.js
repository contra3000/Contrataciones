/*
 * repo.http.js
 * Implementación del contrato (ADR-002) que habla con server/servidor.js.
 *
 * - Traduce el 409 del servidor a {ok:false, conflicto:true, versionRemota},
 *   sin lanzar excepción: un conflicto es un resultado esperado del negocio.
 * - Los errores de red sí son excepciones, con mensaje en español y código
 *   'RED'.
 * - Un expediente inexistente rechaza con código 'NO_ENCONTRADO'.
 * - archivar no está expuesto por el servidor (ORDEN-RONDA-03 §3.4): lanza un
 *   error en español con código 'NO_EXPUESTO'. guardarEntregable sí se expone
 *   desde la ronda 7 (ORDEN-RONDA-07 §3.3) y listarArchivoHistorico desde la
 *   ronda 8 (ORDEN-RONDA-08 §2.2): GET /api/archivo lee el directorio del
 *   Archivo Histórico, no el índice.
 * - Las transiciones por intención (ADR-021) se piden con avanzar/devolver: el
 *   servidor ejecuta el motor y persiste su resultado. Un 403 (rechazo por rol,
 *   destino o validación) se devuelve como {ok:false, error} con el motivo del
 *   motor, nunca como excepción.
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

      // Transiciones por intención (ADR-021): el cliente declara el destino y
      // el contexto; el servidor ejecuta el motor y persiste su resultado. El
      // rechazo por rol, destino o validación (403) se devuelve como un
      // resultado {ok:false, error} con el motivo del motor, igual que un
      // conflicto de versión: es un resultado esperado del negocio, no una
      // excepción.
      avanzar: function (id, versionEsperada, destino, contexto) {
        return pedirConErrorRed('POST', ruta(['expedientes', id, 'avanzar']), {
          versionEsperada: versionEsperada,
          destino: destino,
          contexto: contexto
        }).then(function (respuesta) {
          if (respuesta.status === 200) {
            return {
              ok: true,
              version: respuesta.cuerpo.version,
              expediente: respuesta.cuerpo.expediente
            };
          }
          if (respuesta.status === 403) {
            return {
              ok: false,
              conflicto: false,
              error: respuesta.cuerpo.error
            };
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
          throw errorDeRespuesta(respuesta, 'no se pudo avanzar el expediente ' + id);
        });
      },

      devolver: function (id, versionEsperada, destino, idMotivo, observacion, contexto) {
        return pedirConErrorRed('POST', ruta(['expedientes', id, 'devolver']), {
          versionEsperada: versionEsperada,
          destino: destino,
          idMotivo: idMotivo,
          observacion: observacion === undefined ? null : observacion,
          contexto: contexto
        }).then(function (respuesta) {
          if (respuesta.status === 200) {
            return {
              ok: true,
              version: respuesta.cuerpo.version,
              expediente: respuesta.cuerpo.expediente
            };
          }
          if (respuesta.status === 403) {
            return {
              ok: false,
              conflicto: false,
              error: respuesta.cuerpo.error
            };
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
          throw errorDeRespuesta(respuesta, 'no se pudo devolver el expediente ' + id);
        });
      },

      // Valida contra el catálogo del servidor qué códigos no existen
      // (ORDEN-RONDA-06 §2.2). No es parte del contrato ADR-002: es una
      // capacidad propia del adaptador HTTP, porque la verificación vive del
      // lado del servidor. Devuelve {invalidos, catalogoVersion}.
      validarCodigos: function (codigos) {
        return pedirConErrorRed('POST', ruta(['catalogo', 'validar-codigos']), {
          codigos: codigos
        }).then(function (respuesta) {
          if (respuesta.status !== 200) {
            throw errorDeRespuesta(respuesta, 'no se pudo validar los códigos contra el catálogo del servidor');
          }
          return respuesta.cuerpo;
        });
      },

      // Archivo Histórico (ORDEN-RONDA-08 §2.2): el servidor expone
      // GET /api/archivo, que lee el directorio ArchivoHistorico (no el
      // índice) y devuelve las entradas de los expedientes archivados.
      listarArchivoHistorico: function () {
        return pedirConErrorRed('GET', ruta(['archivo'])).then(function (respuesta) {
          if (respuesta.status !== 200) {
            throw errorDeRespuesta(respuesta, 'no se pudo listar el archivo histórico');
          }
          return respuesta.cuerpo.expedientes;
        });
      },

      archivar: function () {
        return Promise.reject(errorNoExpuesto('archivar'));
      },

      // Guarda el entregable generado en la carpeta del expediente y lo
      // registra en `entregables` de datos.json (ORDEN-RONDA-07 §3.3). El
      // `idEntregable` (opcional, ORDEN-RONDA-08 §2.1) identifica el documento
      // del circuito según config.ENTREGABLES; el servidor lo valida.
      guardarEntregable: function (id, nombre, contenido, contexto, idEntregable) {
        var cuerpo = {
          nombre: nombre,
          contenido: contenido,
          contexto: contexto
        };
        if (typeof idEntregable === 'string' && idEntregable.length > 0) {
          cuerpo.id = idEntregable;
        }
        return pedirConErrorRed('POST', ruta(['expedientes', id, 'entregables']), cuerpo).then(function (respuesta) {
          if (respuesta.status === 201) {
            return {
              ruta: respuesta.cuerpo.ruta,
              version: respuesta.cuerpo.version
            };
          }
          if (respuesta.status === 400) {
            throw errorDeRespuesta(respuesta, 'el servidor rechazó el entregable del expediente ' + id);
          }
          if (respuesta.status === 404) {
            throw errorNoEncontrado(id);
          }
          throw errorDeRespuesta(respuesta, 'no se pudo guardar el entregable "' + nombre + '" del expediente ' + id);
        });
      }
    };
  }

  SGC.adapters.repoHttp = { crear: crearRepoHttp };
})(typeof window !== 'undefined' ? window : globalThis);