/*
 * repo.memoria.js
 * Implementación en memoria del contrato (ADR-002), para tests y fixtures.
 *
 * Reproduce fielmente la semántica del servidor real:
 *  - crearExpediente asigna ids consecutivos por año (numeración serializada,
 *    ADR-009; acá no hay carrera porque es un solo hilo).
 *  - guardarExpediente valida versionEsperada contra la versión actual; si no
 *    coincide devuelve {ok:false, conflicto:true, versionRemota} sin escribir.
 *  - avanzar/devolver reproducen la semántica del servidor (ADR-021): antes de
 *    correr el motor cruzan el contexto contra el padrón de usuarios
 *    (config/usuarios.ejemplo.json, leído en Node); el rechazo se devuelve
 *    como {ok:false, error} y sólo el resultado del motor se persiste.
 *  - guardarExpediente conserva la auditoría de disco: el PUT edita campos,
 *    no puede agregar ni borrar entradas de la cadena (ADR-021).
 *  - guardarEntregable guarda el contenido, lo registra en `entregables` del
 *    expediente y versiona (igual que el servidor, ORDEN-RONDA-07 §3.3).
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

  // Padrón de usuarios para el cruce de autorización (ADR-021). En Node se lee
  // del archivo de configuración; si no hay `require` (navegador) o el archivo
  // no está, queda vacío y la verificación rechaza todo (fail closed).
  var PADRON = [];
  if (typeof require === 'function') {
    try {
      var nodeFs = require('node:fs');
      var nodePath = require('node:path');
      var padron = JSON.parse(nodeFs.readFileSync(
        nodePath.join(__dirname, '..', '..', '..', 'config', 'usuarios.ejemplo.json'), 'utf8'));
      if (Array.isArray(padron.usuarios)) {
        PADRON.push(...padron.usuarios);
      }
    } catch (e) {
      // Padrón vacío: verificar() rechaza todo contexto.
    }
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

  function motor() {
    if (!SGC.core || !SGC.core.estados) {
      throw new Error('repo.memoria: avanzar/devolver requieren que estados.js se cargue primero');
    }
    return SGC.core.estados;
  }

  // Aplica una transición con la misma semántica que el servidor real
  // (ADR-021): primero cruza el contexto contra el padrón de usuarios; después
  // el motor decide con el rol del contexto; el rechazo se devuelve como
  // {ok:false, error} y sólo el resultado del motor se persiste.
  function transicionEnMemoria(id, versionEsperada, tipo, args) {
    var registro = registroDe(id);
    var ctx = args.contexto || {};
    if (!SGC.core || !SGC.core.autorizacion) {
      throw new Error('repo.memoria: las transiciones requieren que autorizacion.js se cargue primero');
    }
    var autorizacion = SGC.core.autorizacion.verificar(PADRON, ctx);
    if (!autorizacion.ok) {
      return Promise.resolve({ ok: false, conflicto: false, error: autorizacion.error });
    }
    if (registro.version !== versionEsperada) {
      return Promise.resolve({ ok: false, conflicto: true, versionRemota: registro.version });
    }
    var resultado = tipo === 'avanzar'
      ? motor().avanzar(registro.expediente, ctx.rol, args.destino, ctx)
      : motor().devolver(registro.expediente, ctx.rol, args.destino, args.idMotivo,
        args.observacion === undefined ? null : args.observacion, ctx);
    if (!resultado.ok) {
      return Promise.resolve({ ok: false, conflicto: false, error: resultado.error });
    }
    var snapshot = JSON.parse(JSON.stringify(registro.expediente));
    historico[id].push({
      version: registro.version,
      expediente: snapshot,
      contexto: registro.contexto
    });
    var actualizado = JSON.parse(JSON.stringify(resultado.expediente));
    registro.expediente = actualizado;
    registro.version = actualizado.version;
    registro.contexto = ctx;
    return Promise.resolve({ ok: true, version: registro.version, expediente: actualizado });
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
          // ADR-021: la auditoría la escribe el servidor (acá, el adaptador
          // que reproduce su semántica). El PUT edita campos pero no puede
          // agregar ni borrar entradas de la cadena.
          actualizado.auditoria = JSON.parse(JSON.stringify(registro.expediente.auditoria));
          registro.expediente = actualizado;
          registro.version = registro.version + 1;
          registro.contexto = contexto || {};
          return Promise.resolve({ ok: true, version: registro.version });
        } catch (e) {
          return Promise.reject(e);
        }
      },

      // Archivo Histórico (ORDEN-RONDA-08 §2.2): lista los expedientes archivados
      // con el mismo formato que GET /api/archivo (entradas de índice más
      // archivadoEn). El filtro por id acota la lista.
      listarArchivoHistorico: function (filtros) {
        var filtro = filtros || {};
        var resultado = [];
        for (var i = 0; i < orden.length; i++) {
          var id = orden[i];
          var registro = expedientes[id];
          if (registro.expediente.archivado === true) {
            if (filtro.id && filtro.id !== id) {
              continue;
            }
            var entrada = repo.entradaIndice(id, registro.expediente, registro.contexto);
            entrada.archivadoEn = typeof registro.expediente.archivadoEn === 'string'
              ? registro.expediente.archivadoEn : null;
            resultado.push(entrada);
          }
        }
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
          var c = contexto || {};
          registro.expediente.archivado = true;
          registro.expediente.archivadoEn = typeof c.timestamp === 'string' ? c.timestamp : null;
          registro.expediente.version = registro.version + 1;
          registro.version = registro.version + 1;
          registro.contexto = c;
          return Promise.resolve({ ok: true, version: registro.version });
        } catch (e) {
          return Promise.reject(e);
        }
      },

      guardarEntregable: function (id, nombre, contenido, contexto, idEntregable) {
        try {
          var registro = registroDe(id);
          if (typeof nombre !== 'string' || nombre.length === 0) {
            throw new Error('guardarEntregable: el nombre del entregable es obligatorio');
          }
          // ORDEN-RONDA-08 §2.1: el id del entregable debe existir en el
          // catálogo de entregables; si viene, se registra para que la
          // validación del circuito lo dé por cumplido.
          if (typeof idEntregable === 'string' && idEntregable.length > 0) {
            var conocido = false;
            var catalogo = SGC.core.config.ENTREGABLES;
            for (var c = 0; catalogo && c < catalogo.length; c++) {
              if (catalogo[c].id === idEntregable) {
                conocido = true;
                break;
              }
            }
            if (!conocido) {
              throw new Error('guardarEntregable: id de entregable desconocido: ' + idEntregable);
            }
          }
          var snapshot = JSON.parse(JSON.stringify(registro.expediente));
          historico[id].push({
            version: registro.version,
            expediente: snapshot,
            contexto: registro.contexto
          });
          var actualizado = JSON.parse(JSON.stringify(registro.expediente));
          actualizado.version = registro.version + 1;
          if (!Array.isArray(actualizado.entregables)) {
            actualizado.entregables = [];
          }
          var ctx = contexto || {};
          var entrada = {
            nombre: nombre,
            ruta: 'entregables/' + nombre,
            guardado: typeof ctx.timestamp === 'string' ? ctx.timestamp : null,
            email: typeof ctx.email === 'string' ? ctx.email : null,
            equipo: typeof ctx.equipo === 'string' ? ctx.equipo : null
          };
          if (typeof idEntregable === 'string' && idEntregable.length > 0) {
            entrada.id = idEntregable;
          }
          actualizado.entregables.push(entrada);
          if (typeof ctx.timestamp === 'string') {
            if (typeof actualizado.actualizado === 'string') {
              actualizado.actualizado = ctx.timestamp;
            }
            if (typeof actualizado.ultimaModificacion === 'string') {
              actualizado.ultimaModificacion = ctx.timestamp;
            }
          }
          if (typeof ctx.email === 'string' && typeof actualizado.ultimoUsuario === 'string') {
            actualizado.ultimoUsuario = ctx.email;
          }
          registro.expediente = actualizado;
          registro.version = actualizado.version;
          registro.contexto = ctx;
          entregables[id][nombre] = contenido;
          return Promise.resolve({ ruta: 'entregables/' + nombre, version: registro.version });
        } catch (e) {
          return Promise.reject(e);
        }
      },

      avanzar: function (id, versionEsperada, destino, contexto) {
        try {
          return transicionEnMemoria(id, versionEsperada, 'avanzar', {
            destino: destino,
            contexto: contexto
          });
        } catch (e) {
          return Promise.reject(e);
        }
      },

      devolver: function (id, versionEsperada, destino, idMotivo, observacion, contexto) {
        try {
          return transicionEnMemoria(id, versionEsperada, 'devolver', {
            destino: destino,
            idMotivo: idMotivo,
            observacion: observacion,
            contexto: contexto
          });
        } catch (e) {
          return Promise.reject(e);
        }
      }
    };
  }

  SGC.adapters.repoMemoria = { crear: crearRepoMemoria };
})(typeof window !== 'undefined' ? window : globalThis);