/*
 * repo.memoria.js
 * Implementación en memoria del contrato (ADR-002), para tests y fixtures.
 *
 * Reproduce fielmente la semántica del servidor real:
 *  - crearExpediente asigna ids consecutivos por año (numeración serializada,
 *    ADR-009; acá no hay carrera porque es un solo hilo).
 *  - guardarExpediente valida versionEsperada contra la versión actual; si no
 *    coincide devuelve {ok:false, conflicto:true, versionRemota} sin escribir.
 *  - El expediente y el contexto recibidos se conservan tal cual; el formato
 *    del expediente inicial y del índice es el compartido por repo.js, el
 *    mismo que usa el servidor.
 *
 * Sobre los datos de origen (ADR-017 medida 3): una implementación en memoria
 * no tiene red, pero conserva el contexto recibido por operación para que las
 * vistas lean lo mismo que leerían con repo.http.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.adapters || !SGC.adapters.repo) {
    throw new Error('repo.memoria.js requiere que namespaces.js y repo.js se carguen primero');
  }

  var repo = SGC.adapters.repo;

  function errorNoEncontrado(id) {
    var e = new Error('expediente no encontrado: ' + id);
    e.codigo = 'NO_ENCONTRADO';
    return e;
  }

  function crearRepoMemoria() {
    var expedientes = {};   // id -> { expediente, version, contexto }
    var historico = {};     // id -> [ {version, expediente, contexto} ]
    var entregables = {};   // id -> { nombre -> contenido }
    var orden = [];         // ids en orden de creación
    var contadorPorAnio = {}; // anio -> último número asignado

    function siguienteNumero(anio) {
      var actual = contadorPorAnio[anio] || 0;
      var siguiente = actual + 1;
      contadorPorAnio[anio] = siguiente;
      return siguiente;
    }

    function registroDe(id) {
      var registro = expedientes[id];
      if (!registro) {
        throw errorNoEncontrado(id);
      }
      return registro;
    }

    function entradaIndice(id) {
      var registro = expedientes[id];
      return repo.entradaIndice(id, registro.expediente, registro.contexto);
    }

    return {
      listarIndice: function () {
        var resultado = [];
        for (var i = 0; i < orden.length; i++) {
          resultado.push(entradaIndice(orden[i]));
        }
        return Promise.resolve(resultado);
      },

      leerExpediente: function (id) {
        try {
          var registro = registroDe(id);
          var copia = JSON.parse(JSON.stringify(registro.expediente));
          return Promise.resolve({ expediente: copia, version: registro.version });
        } catch (e) {
          return Promise.reject(e);
        }
      },

      crearExpediente: function (datosIniciales, contexto) {
        var anio = repo.anioDe(datosIniciales, contexto) ||
          String(new Date().getFullYear());
        var numero = siguienteNumero(anio);
        var id = anio + '-' + repo.rellenar(numero, 3);
        var expediente = repo.construirExpediente(datosIniciales, contexto, id);
        expedientes[id] = {
          expediente: expediente,
          version: 1,
          contexto: contexto || {}
        };
        historico[id] = [];
        entregables[id] = {};
        orden.push(id);
        return Promise.resolve({
          id: id,
          version: 1,
          expediente: JSON.parse(JSON.stringify(expediente))
        });
      },

      guardarExpediente: function (id, expedienteNuevo, versionEsperada, contexto) {
        try {
          var registro = registroDe(id);
          if (registro.version !== versionEsperada) {
            return Promise.resolve({
              ok: false,
              conflicto: true,
              versionRemota: registro.version
            });
          }
          var snapshot = JSON.parse(JSON.stringify(registro.expediente));
          historico[id].push({
            version: registro.version,
            expediente: snapshot,
            contexto: registro.contexto
          });
          var actualizado = JSON.parse(JSON.stringify(expedienteNuevo));
          actualizado.version = registro.version + 1;
          registro.expediente = actualizado;
          registro.version = registro.version + 1;
          registro.contexto = contexto || {};
          return Promise.resolve({ ok: true, version: registro.version });
        } catch (e) {
          return Promise.reject(e);
        }
      },

      listarArchivoHistorico: function (filtros) {
        var filtro = filtros || {};
        var resultado = [];
        var ids = filtro.id ? [filtro.id] : Object.keys(historico);
        for (var i = 0; i < ids.length; i++) {
          var id = ids[i];
          var entradas = historico[id] || [];
          for (var j = 0; j < entradas.length; j++) {
            var entrada = entradas[j];
            if (filtro.version !== undefined && entrada.version !== filtro.version) {
              continue;
            }
            resultado.push({
              id: id,
              version: entrada.version,
              expediente: entrada.expediente,
              contexto: entrada.contexto
            });
          }
        }
        resultado.sort(function (a, b) {
          return a.version - b.version;
        });
        return Promise.resolve(resultado);
      },

      archivar: function (id, contexto) {
        try {
          var registro = registroDe(id);
          var snapshot = JSON.parse(JSON.stringify(registro.expediente));
          historico[id].push({
            version: registro.version,
            expediente: snapshot,
            contexto: registro.contexto
          });
          registro.expediente.archivado = true;
          registro.expediente.version = registro.version + 1;
          registro.version = registro.version + 1;
          registro.contexto = contexto || {};
          return Promise.resolve({ ok: true, version: registro.version });
        } catch (e) {
          return Promise.reject(e);
        }
      },

      guardarEntregable: function (id, nombre, contenido, contexto) {
        try {
          registroDe(id);
          if (typeof nombre !== 'string' || nombre.length === 0) {
            throw new Error('guardarEntregable: el nombre del entregable es obligatorio');
          }
          entregables[id][nombre] = contenido;
          return Promise.resolve({
            ruta: 'entregables/' + id + '/' + nombre
          });
        } catch (e) {
          return Promise.reject(e);
        }
      }
    };
  }

  SGC.adapters.repoMemoria = { crear: crearRepoMemoria };
})(typeof window !== 'undefined' ? window : globalThis);