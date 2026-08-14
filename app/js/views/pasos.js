/*
 * pasos.js
 * Lógica pura del wizard de la Especificación Técnica (ORDEN-RONDA-05 §3.1).
 * Sin DOM y sin red: la vista (wizard.js) sólo la consulta.
 *
 * Cada paso se valida con las funciones de SGC.core.validacion, la única
 * fuente de reglas de validación. Los renglones se validan con
 * validarRenglon más la existencia del código en el catálogo
 * (SGC.catalogo.indice.codigoExiste).
 *
 * API:
 *   PASOS                               lista de pasos [{id, titulo}]
 *   validarPaso(idPaso, datos)          -> {valido, errores:[{campo, mensaje}]}
 *   datosParaPersistir(datos, operador, catalogoVersion) -> datosIniciales
 *   resumen(datos, operador)            -> [{clave, etiqueta, valor}]
 *   persistir(repo, datos, operador, catalogoVersion, storage)
 *                                       -> Promise<{ok} | {ok:false, error}>
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('pasos.js requiere que namespaces.js se cargue primero');
  }

  var MAX_ACLARACION = 200;

  var PASOS = [
    { id: 'identificacion', titulo: 'Identificación' },
    { id: 'renglones', titulo: 'Renglones' },
    { id: 'fundamentacion', titulo: 'Fundamentación' },
    { id: 'revision', titulo: 'Revisión y confirmación' }
  ];

  function errorCampo(campo, mensaje) {
    return { campo: campo, mensaje: mensaje };
  }

  function validarIdentificacion(datos) {
    var campos = datos.identificacion || {};
    var r = SGC.core.validacion.validarIdentificacion(campos);
    return {
      valido: r.valido,
      errores: r.errores.map(function (mensaje) {
        return errorCampo(camposTituloDelError(mensaje), mensaje);
      })
    };
  }

  function camposTituloDelError(mensaje) {
    if (mensaje.indexOf('título') !== -1) {
      return 'titulo';
    }
    if (mensaje.indexOf('año') !== -1) {
      return 'anio';
    }
    if (mensaje.indexOf('dependencia') !== -1) {
      return 'dependenciaSolicitante';
    }
    if (mensaje.indexOf('operador') !== -1) {
      return 'operador';
    }
    return null;
  }

  function validarRenglones(datos) {
    var errores = [];
    var renglones = Array.isArray(datos.renglones) ? datos.renglones : [];
    if (renglones.length === 0) {
      errores.push(errorCampo('renglones', 'Cargá al menos un renglón del catálogo'));
      return { valido: false, errores: errores };
    }
    for (var i = 0; i < renglones.length; i++) {
      var r = SGC.core.validacion.validarRenglon(renglones[i]);
      if (!r.valido) {
        for (var j = 0; j < r.errores.length; j++) {
          errores.push(errorCampo('renglones[' + i + ']', 'Renglón ' + (i + 1) + ': ' + r.errores[j]));
        }
        continue;
      }
      if (!SGC.catalogo.indice.codigoExiste(renglones[i].codigo)) {
        errores.push(errorCampo('renglones[' + i + ']',
          'Renglón ' + (i + 1) + ': el código ' + renglones[i].codigo + ' no existe en el catálogo'));
      }
    }
    return { valido: errores.length === 0, errores: errores };
  }

  function validarFundamentacion(datos) {
    var campos = datos.fundamentacion || {};
    var r = SGC.core.validacion.validarFundamentacion(campos);
    return {
      valido: r.valido,
      errores: r.errores.map(function (mensaje) {
        return errorCampo('justificacion', mensaje);
      })
    };
  }

  function validarRevision(datos) {
    var chequeos = [
      validarIdentificacion(datos),
      validarRenglones(datos),
      validarFundamentacion(datos)
    ];
    var errores = [];
    for (var i = 0; i < chequeos.length; i++) {
      errores = errores.concat(chequeos[i].errores);
    }
    return { valido: errores.length === 0, errores: errores };
  }

  var VALIDADORES = {
    identificacion: validarIdentificacion,
    renglones: validarRenglones,
    fundamentacion: validarFundamentacion,
    revision: validarRevision
  };

  function validarPaso(idPaso, datos) {
    var validador = VALIDADORES[idPaso];
    if (!validador) {
      return { valido: false, errores: [errorCampo(null, 'Paso desconocido: ' + idPaso)] };
    }
    return validador(datos);
  }

  function datosParaPersistir(datos, operador, catalogoVersion) {
    var identificacion = datos.identificacion || {};
    var fundamentacion = datos.fundamentacion || {};
    var renglones = Array.isArray(datos.renglones) ? datos.renglones : [];
    var datosIniciales = {
      titulo: identificacion.titulo,
      anio: String(identificacion.anio || ''),
      solicitante: {
        nombre: operador.nombre,
        apellido: operador.apellido,
        email: operador.email,
        sector: operador.sector
      },
      catalogoVersion: catalogoVersion || null,
      campos: {
        operador: identificacion.operador,
        dependenciaSolicitante: identificacion.dependenciaSolicitante,
        justificacion: fundamentacion.justificacion,
        objetivo: fundamentacion.objetivo || ''
      },
      renglones: renglones.map(function (r) {
        return {
          codigo: r.codigo,
          cantidad: r.cantidad,
          unidad: r.unidad,
          aclaracion: typeof r.aclaracion === 'string' ? r.aclaracion : ''
        };
      })
    };
    if (identificacion.fechaLimite) {
      datosIniciales.fechaLimite = identificacion.fechaLimite;
    }
    return datosIniciales;
  }

  function resumen(datos, operador) {
    var identificacion = datos.identificacion || {};
    var fundamentacion = datos.fundamentacion || {};
    var renglones = Array.isArray(datos.renglones) ? datos.renglones : [];
    var filas = [
      { clave: 'titulo', etiqueta: 'Título', valor: identificacion.titulo || '' },
      { clave: 'anio', etiqueta: 'Año', valor: identificacion.anio || '' },
      { clave: 'dependenciaSolicitante', etiqueta: 'Dependencia solicitante', valor: identificacion.dependenciaSolicitante || '' },
      { clave: 'operador', etiqueta: 'Operador', valor: (operador ? operador.nombre + ' ' + operador.apellido : '') + ' <' + (identificacion.operador || '') + '>' },
      { clave: 'justificacion', etiqueta: 'Justificación', valor: fundamentacion.justificacion || '' }
    ];
    if (fundamentacion.objetivo) {
      filas.push({ clave: 'objetivo', etiqueta: 'Objetivo', valor: fundamentacion.objetivo });
    }
    filas.push({
      clave: 'renglones',
      etiqueta: 'Renglones (' + renglones.length + ')',
      valor: renglones.map(function (r) {
        return r.codigo + ' — ' + (r.cantidad || '') + ' ' + (r.unidad || '') +
          (r.aclaracion ? ' (' + r.aclaracion + ')' : '');
      })
    });
    return filas;
  }

  function aclaracionesValidas(renglones) {
    for (var i = 0; i < renglones.length; i++) {
      if (typeof renglones[i].aclaracion === 'string' &&
          renglones[i].aclaracion.length > MAX_ACLARACION) {
        return false;
      }
    }
    return true;
  }

  // Persistencia del paso 4 (ORDEN-RONDA-05 §3.3). El borrador sólo se limpia
  // si el alta tuvo éxito; cualquier fallo devuelve {ok:false, error} con el
  // borrador intacto, sin lanzar excepción.
  function persistir(repo, datos, operador, catalogoVersion, storage) {
    var contexto = {
      timestamp: new Date().toISOString(),
      email: operador.email,
      rol: operador.roles && operador.roles[0],
      equipo: 'PC-NAVEGADOR'
    };
    var datosIniciales = datosParaPersistir(datos, operador, catalogoVersion);
    return repo.crearExpediente(datosIniciales, contexto).then(function (respuesta) {
      try {
        SGC.views.borrador.limpiar(storage);
      } catch (e) {
        // limpiar el borrador es mejor esfuerzo; no condiciona el alta
      }
      return {
        ok: true,
        id: respuesta.id,
        numero: respuesta.expediente ? respuesta.expediente.numero : null,
        version: respuesta.version
      };
    }).catch(function (err) {
      return { ok: false, error: err && err.message ? err.message : 'No se pudo crear el expediente' };
    });
  }

  SGC.views.pasos = {
    PASOS: PASOS,
    MAX_ACLARACION: MAX_ACLARACION,
    validarPaso: validarPaso,
    datosParaPersistir: datosParaPersistir,
    resumen: resumen,
    aclaracionesValidas: aclaracionesValidas,
    persistir: persistir
  };
})(typeof window !== 'undefined' ? window : globalThis);