/*
 * repo.js
 * Contrato de persistencia (ADR-002) y selector de implementación.
 *
 * Ninguna vista ni el núcleo de dominio saben si detrás hay un servidor, una
 * implementación en memoria o un archivo: sólo hablan con esta interfaz. La
 * implementación concreta se inyecta al arrancar con `usar(implementacion)`
 * (normalmente repo.http en producción; repo.memoria en tests y fixtures).
 *
 * Convención de resultados:
 *  - Un conflicto de versión NO es una excepción: se devuelve como valor
 *    {ok:false, conflicto:true, versionRemota}.
 *  - Las excepciones se reservan para los fallos reales (red, disco, servidor).
 *  - Un expediente inexistente rechaza la promesa con un Error cuyo código es
 *    'NO_ENCONTRADO'; los errores de red llevan 'RED'; las funciones no
 *    expuestas por el servidor llevan 'NO_EXPUESTO'.
 *
 * Los métodos que crean o modifican estado reciben `contexto` con los datos
 * que la implementación necesita para registrar identidad declarada y origen
 * (ADR-017): timestamp, email, rol, equipo, observacion.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.adapters) {
    throw new Error('repo.js requiere que namespaces.js se cargue primero');
  }

  var METODOS = [
    'listarIndice',
    'leerExpediente',
    'crearExpediente',
    'guardarExpediente',
    'listarArchivoHistorico',
    'archivar',
    'guardarEntregable'
  ];

  var activa = null;

  function exigirActiva() {
    if (!activa) {
      throw new Error('repo: no hay implementación de persistencia inyectada. Llamar a SGC.adapters.repo.usar(implementacion) antes de operar.');
    }
  }

  function usar(implementacion) {
    if (!implementacion || typeof implementacion !== 'object') {
      throw new Error('repo: usar() espera un objeto con los métodos del contrato (ADR-002).');
    }
    for (var i = 0; i < METODOS.length; i++) {
      if (typeof implementacion[METODOS[i]] !== 'function') {
        throw new Error('repo: la implementación no expone el método "' + METODOS[i] + '".');
      }
    }
    activa = implementacion;
  }

  var api = { usar: usar };
  for (var j = 0; j < METODOS.length; j++) {
    (function (metodo) {
      api[metodo] = function () {
        exigirActiva();
        return activa[metodo].apply(activa, arguments);
      };
    })(METODOS[j]);
  }

  // ---------------------------------------------------------------------------
  // Helpers compartidos por las implementaciones (memoria y servidor) para que
  // el contrato de creación y el formato del índice sean idénticos en ambas
  // caras. No son parte de la interfaz pública de persistencia, pero quedan
  // expuestos para que repo.memoria y el servidor usen exactamente el mismo
  // código.
  // ---------------------------------------------------------------------------

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

  // Año de un expediente nuevo: datosIniciales.anio o el del timestamp del
  // contexto. null si ninguno lo permite (el llamador decide el respaldo).
  function anioDe(datosIniciales, contexto) {
    if (datosIniciales && typeof datosIniciales.anio === 'string' && /^\d{4}$/.test(datosIniciales.anio)) {
      return datosIniciales.anio;
    }
    var ts = contexto && contexto.timestamp;
    if (typeof ts === 'string' && /^\d{4}/.test(ts)) {
      return ts.slice(0, 4);
    }
    return null;
  }

  function rellenar(numero, largo) {
    var texto = String(numero);
    while (texto.length < largo) {
      texto = '0' + texto;
    }
    return texto;
  }

  // Construye el expediente inicial con la forma contractual (ADR-019):
  // `estado` es un objeto {id, fase, desde} y el registro de auditoría es el
  // arreglo `auditoria`. La primera entrada de la cadena registra la creación.
  // El `id` ya viene asignado por el llamador (anio-numero).
  function construirExpediente(datosIniciales, contexto, id) {
    var base = datosIniciales && typeof datosIniciales === 'object'
      ? clonar(datosIniciales) : {};
    base.expedienteId = id;
    base.anio = id.slice(0, 4);
    base.numero = id.slice(5);
    base.schemaVersion = SGC.core.migraciones.VERSION_ACTUAL;
    var c = contexto || {};
    if (!base.estado || typeof base.estado !== 'object' || typeof base.estado.id !== 'string') {
      var defInicial = definicionEstado(SGC.core.config.ESTADO_INICIAL);
      base.estado = {
        id: SGC.core.config.ESTADO_INICIAL,
        fase: defInicial ? defInicial.fase : null,
        desde: c.timestamp || null
      };
    }
    base.version = 1;
    if (!Array.isArray(base.auditoria)) {
      base.auditoria = [];
    }
    var entrada = SGC.core.auditoria.crearEntrada(null, {
      timestamp: c.timestamp,
      email: c.email,
      rol: c.rol,
      equipo: c.equipo,
      accion: 'crearExpediente',
      de: null,
      a: base.estado.id,
      motivo: null,
      observacion: c.observacion === undefined ? null : c.observacion
    });
    base.auditoria.push(entrada);
    return base;
  }

  function estadoDe(expediente) {
    return SGC.core.utils.idEstadoActual(expediente);
  }

  function definicionEstado(idEstado) {
    var estados = SGC.core.config.ESTADOS;
    for (var i = 0; i < estados.length; i++) {
      if (estados[i].id === idEstado) {
        return estados[i];
      }
    }
    return null;
  }

  function sectorDeRol(rolEjecutor) {
    var roles = SGC.core.config.ROLES;
    for (var i = 0; i < roles.length; i++) {
      if (roles[i].id === rolEjecutor) {
        return roles[i].sector;
      }
    }
    return null;
  }

  // Entrada del índice fragmentado (ADR-005). La producen repo.memoria y el
  // servidor (idx/<id>.json) con el mismo formato.
  function entradaIndice(id, expediente, contexto) {
    var estado = estadoDe(expediente) || (expediente && expediente.estadoActual) || null;
    var def = definicionEstado(estado);
    var rolEjecutor = def ? def.rolEjecutor : null;
    var fechaLimite = null;
    if (expediente) {
      if (typeof expediente.fechaLimite === 'string') {
        fechaLimite = expediente.fechaLimite;
      } else if (expediente.sla && typeof expediente.sla.fechaLimite === 'string') {
        fechaLimite = expediente.sla.fechaLimite;
      }
    }
    return {
      id: id,
      titulo: expediente && typeof expediente.titulo === 'string' ? expediente.titulo : '',
      estado: estado,
      fase: def ? def.fase : null,
      sector: sectorDeRol(rolEjecutor),
      rolEjecutor: rolEjecutor,
      fechaLimite: fechaLimite,
      actualizado: (contexto && contexto.timestamp) ||
        (expediente && expediente.ultimaModificacion) || null
    };
  }

  api.construirExpediente = construirExpediente;
  api.anioDe = anioDe;
  api.rellenar = rellenar;
  api.entradaIndice = entradaIndice;

  SGC.adapters.repo = api;
})(typeof window !== 'undefined' ? window : globalThis);
