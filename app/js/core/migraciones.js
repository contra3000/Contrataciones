/*
 * migraciones.js
 * Migración hacia adelante de los esquemas (ORDEN-RONDA-02 §3.4).
 *
 * Regla (InstruccionesCodigo.md §4.10): se migra hacia adelante y nunca se
 * descartan datos. Un campo que ya no se usa se conserva; uno nuevo se agrega
 * con valor por defecto.
 *
 * La migración concreta de esta ronda lleva el esquema original de
 * InstruccionesCodigo.md §6.1 (`schemaVersion: 1`, con `incisos`, `auditLog`
 * y `estadoActual`) al esquema v2 de ADR-019, que incorpora `catalogoVersion`,
 * `renglones` con `aclaracion`, `auditoria`, `solicitante`, `fechaLimite` y el
 * estado como objeto. VERSION_ACTUAL = 2.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.core) {
    throw new Error('migraciones.js requiere que namespaces.js se cargue primero');
  }

  var VERSION_ACTUAL = 2;

  function clonar(valor) {
    if (Array.isArray(valor)) {
      var arr = [];
      for (var i = 0; i < valor.length; i++) {
        arr.push(clonar(valor[i]));
      }
      return arr;
    }
    if (valor && typeof valor === 'object') {
      var obj = {};
      for (var k in valor) {
        if (Object.prototype.hasOwnProperty.call(valor, k)) {
          obj[k] = clonar(valor[k]);
        }
      }
      return obj;
    }
    return valor;
  }

  function numeroDeVersion(documento) {
    var v = documento.schemaVersion;
    if (typeof v === 'number') {
      return v;
    }
    if (typeof v === 'string') {
      var n = parseInt(v, 10);
      if (!isNaN(n)) {
        return n;
      }
    }
    return 1;
  }

  function faseDeEstado(idEstado) {
    var estados = SGC.core.config.ESTADOS;
    for (var i = 0; i < estados.length; i++) {
      if (estados[i].id === idEstado) {
        return estados[i].fase;
      }
    }
    return null;
  }

  function renglonDesdeInciso(inciso) {
    if (!inciso || typeof inciso !== 'object') {
      return { codigo: undefined, cantidad: undefined, unidad: undefined, aclaracion: '' };
    }
    return {
      codigo: inciso.codigo,
      cantidad: inciso.cantidad,
      unidad: inciso.unidad,
      aclaracion: inciso.aclaracion || ''
    };
  }

  function migrarV1(documento) {
    var incisos = Array.isArray(documento.incisos) ? documento.incisos : [];
    var renglones = [];
    for (var i = 0; i < incisos.length; i++) {
      renglones.push(renglonDesdeInciso(incisos[i]));
    }
    documento.renglones = renglones;
    if (documento.catalogoVersion === undefined) {
      documento.catalogoVersion = null;
    }
    if (documento.id === undefined) {
      documento.id = documento.expedienteId;
    }
    if (documento.solicitante === undefined) {
      documento.solicitante = {};
    }
    documento.estado = {
      id: documento.estadoActual,
      fase: faseDeEstado(documento.estadoActual),
      desde: documento.ultimaModificacion
    };
    if (documento.actualizado === undefined) {
      documento.actualizado = documento.ultimaModificacion === undefined ? null : documento.ultimaModificacion;
    }
    if (documento.fechaLimite === undefined) {
      documento.fechaLimite = documento.sla && documento.sla.fechaLimite !== undefined
        ? documento.sla.fechaLimite : null;
    }
    if (documento.auditoria === undefined) {
      documento.auditoria = Array.isArray(documento.auditLog) ? documento.auditLog.slice() : [];
    }
    documento.schemaVersion = VERSION_ACTUAL;
    return documento;
  }

  function migrar(documento) {
    if (!documento || typeof documento !== 'object') {
      return { documento: documento, aplicadas: [] };
    }
    var resultado = clonar(documento);
    var aplicadas = [];
    // El guardián estructural evita re-migrar documentos que ya tienen la
    // forma del esquema v2 aunque su etiqueta schemaVersion sea ambigua.
    if (numeroDeVersion(resultado) < VERSION_ACTUAL && !Array.isArray(resultado.renglones)) {
      resultado = migrarV1(resultado);
      aplicadas.push('v1: migrado de schemaVersion 1 a ' + VERSION_ACTUAL);
    }
    return { documento: resultado, aplicadas: aplicadas };
  }

  SGC.core.migraciones = {
    VERSION_ACTUAL: VERSION_ACTUAL,
    migrar: migrar
  };
})(typeof window !== 'undefined' ? window : globalThis);
