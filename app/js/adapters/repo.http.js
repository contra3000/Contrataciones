/*
 * repo.http.js
 * Implementación del contrato (ADR-002) que habla con server/servidor.js.
 * Reglas generales: un 409 es {ok:false, conflicto:true, versionRemota} (sin
 * excepción); un 403 por rol/destino es {ok:false, error}; errores de red son
 * excepción código 'RED'; inexistente es excepción 'NO_ENCONTRADO'; archivar
 * es 'NO_EXPUESTO'. Las transiciones se piden por intención (ADR-021) y el
 * servidor ejecuta el motor. La base se inyecta en la factoría (ADR-018).
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
    var motivo = respuesta.cuerpo && respuesta.cuerpo.error ? ': ' + respuesta.cuerpo.error : '';
    var e = new Error('repo.http: ' + contexto + ' (el servidor respondió estado ' + respuesta.status + motivo + ')');
    e.codigo = 'HTTP_' + respuesta.status;
    return e;
  }

  function errorDelServidor(respuesta, contexto) {
    return errorDeRespuesta(respuesta, contexto);
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

      // Transiciones por intención (ADR-021): un 403 por rol/destino/validación
      // es un resultado esperado (motivo del motor), no una excepción.
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

      // Valida códigos inexistentes contra el catálogo del servidor (§2.2).
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

      // Archivo Histórico (ORDEN-RONDA-08 §2.2): GET /api/archivo lee el
      // directorio ArchivoHistorico (no el índice).
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
      },

      // Guarda un presupuesto adjunto (ORDEN-RONDA-09 §3.2): PDF o imagen en
      // base64; el servidor valida y elige el nombre en disco.
      guardarPresupuesto: function (id, datos, contexto) {
        return pedirConErrorRed('POST', ruta(['expedientes', id, 'presupuestos']), {
          nombreOriginal: datos.nombreOriginal,
          tipo: datos.tipo,
          contenido: datos.contenido,
          contexto: contexto
        }).then(function (respuesta) {
          if (respuesta.status === 201) {
            return respuesta.cuerpo;
          }
          if (respuesta.status === 400) {
            throw errorDeRespuesta(respuesta, 'el servidor rechazó el presupuesto del expediente ' + id);
          }
          if (respuesta.status === 404) {
            throw errorNoEncontrado(id);
          }
          throw errorDeRespuesta(respuesta, 'no se pudo guardar el presupuesto del expediente ' + id);
        });
      },

      // Base de un expediente del archivo (ADR-025, ORDEN-RONDA-13 §4): lista
      // blanca de campos reutilizables de un perfeccionado archivado.
      baseDe: function (id) {
        return pedirConErrorRed('GET', ruta(['archivo', id, 'base'])).then(function (respuesta) {
          if (respuesta.status === 404) {
            throw errorNoEncontrado(id);
          }
          if (respuesta.status !== 200) {
            throw errorDelServidor(respuesta, 'no se pudo leer la base del expediente ' + id);
          }
          return respuesta.cuerpo;
        });
      },

      // Crea un expediente desde la base (ADR-025, ORDEN-RONDA-13 §4): copia los
      // renglones seleccionados por índice, marca `basadoEn` y registra reuso_base.
      crearDesdeBase: function (origenId, indices, contexto) {
        return pedirConErrorRed('POST', ruta(['expedientes', 'base']), {
          origenId: origenId,
          indices: indices,
          contexto: contexto
        }).then(function (respuesta) {
          if (respuesta.status === 201) {
            return respuesta.cuerpo;
          }
          if (respuesta.status === 404) {
            throw errorNoEncontrado(origenId);
          }
          throw errorDelServidor(respuesta, 'no se pudo crear el expediente base');
        });
      },

      // Sugerencias del piloto (H19, RONDA-13 §6): el JSONL nunca se edita.
      listarSugerencias: function () {
        return pedirConErrorRed('GET', ruta(['sugerencias'])).then(function (respuesta) {
          if (respuesta.status !== 200) {
            throw errorDeRespuesta(respuesta, 'no se pudieron listar las sugerencias');
          }
          return respuesta.cuerpo;
        });
      },

      enviarSugerencia: function (datos, contexto) {
        var cuerpo = { contexto: contexto, contenido: datos.contenido };
        var campos = ['pantalla', 'expediente', 'paso', 'appVersion', 'catalogoVersion', 'navegador'];
        for (var i = 0; i < campos.length; i++) {
          var valor = datos[campos[i]];
          if (typeof valor === 'string' && valor !== '') {
            cuerpo[campos[i]] = valor;
          }
        }
        return pedirConErrorRed('POST', ruta(['sugerencias']), cuerpo).then(function (respuesta) {
          if (respuesta.status === 201) {
            return respuesta.cuerpo;
          }
          throw errorDelServidor(respuesta, 'no se pudo enviar la sugerencia');
        });
      },

      marcarSugerenciaAtendida: function (id, contexto) {
        return pedirConErrorRed('POST', ruta(['sugerencias', id, 'atender']), {
          contexto: contexto
        }).then(function (respuesta) {
          if (respuesta.status === 200) {
            return respuesta.cuerpo;
          }
          if (respuesta.status === 404) {
            throw new Error('repo.http: sugerencia no encontrada: ' + id);
          }
          throw errorDelServidor(respuesta, 'no se pudo marcar la sugerencia como atendida');
        });
      },

      // Administración del padrón (H21, ORDEN-RONDA-17): exige sesión de
      // administrador; el contexto sale de la sesión del lado del servidor.
      padronAdmin: {
        listar: function () {
          return pedirConErrorRed('GET', ruta(['padron'])).then(function (respuesta) {
            if (respuesta.status !== 200) throw errorDelServidor(respuesta, 'no se pudo listar el padrón');
            return respuesta.cuerpo.usuarios;
          });
        },
        alta: function (datos) {
          return pedirConErrorRed('POST', ruta(['padron', 'alta']), datos).then(function (respuesta) {
            if (respuesta.status !== 200) throw errorDelServidor(respuesta, 'no se pudo dar de alta al operador');
            return respuesta.cuerpo;
          });
        },
        accion: function (email, accion, datos) {
          return pedirConErrorRed('POST', ruta(['padron', encodeURIComponent(email), accion]), datos || {}).then(function (respuesta) {
            if (respuesta.status !== 200) throw errorDelServidor(respuesta, 'no se pudo ejecutar ' + accion + ' sobre ' + email);
            return respuesta.cuerpo;
          });
        },
        exportar: function () {
          return fetch(ruta(['padron', 'exportar'])).then(function (respuesta) {
            if (respuesta.status !== 200) {
              return respuesta.json().catch(function () { return null; }).then(function (c) {
                throw new Error('repo.http: no se pudo exportar el padrón' + (c && c.error ? ': ' + c.error : ''));
              });
            }
            return respuesta.text();
          });
        },
        importar: function (csv, desactivarAusentes, soloPrever) {
          return pedirConErrorRed('POST', ruta(['padron', 'importar']), {
            csv: csv,
            desactivarAusentes: desactivarAusentes === true,
            soloPrever: soloPrever === true
          }).then(function (respuesta) {
            if (respuesta.status !== 200) throw errorDelServidor(respuesta, 'no se pudo importar el padrón');
            return respuesta.cuerpo;
          });
        }
      }
    };
  }

  SGC.adapters.repoHttp = { crear: crearRepoHttp };
})(typeof window !== 'undefined' ? window : globalThis);