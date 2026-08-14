/*
 * estados.js
 * Motor de transiciones del circuito (ORDEN-RONDA-02 §3.1).
 *
 * Funciones puras: ninguna modifica el expediente recibido; todas devuelven
 * objetos nuevos. El instante llega en `contexto.timestamp` (nunca se consulta
 * el reloj del sistema) y la identidad del operador es el correo (ADR-017).
 *
 * Reglas de `avanzar`: falla si el destino no figura en `estadosSiguientes`,
 * si el rol no es el `rolEjecutor` del estado actual, o si la validación de
 * §3.2 no pasa. `devolver` exige un `idMotivo` del catálogo cerrado de
 * config.js. Toda transición exitosa agrega una entrada de auditoría (ADR-006).
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.core) {
    throw new Error('estados.js requiere que namespaces.js se cargue primero');
  }

  var config = SGC.core.config;
  var auditoria = SGC.core.auditoria;
  var validacion = SGC.core.validacion;
  var utils = SGC.core.utils;

  function obtener(idEstado) {
    if (typeof idEstado !== 'string') {
      return null;
    }
    var estados = config.ESTADOS;
    for (var i = 0; i < estados.length; i++) {
      if (estados[i].id === idEstado) {
        return estados[i];
      }
    }
    return null;
  }

  function rolEsEjecutor(estado, rolOperador) {
    return estado !== null && typeof rolOperador === 'string' &&
      estado.rolEjecutor === rolOperador;
  }

  function motivoRolIncorrecto(estado, rolOperador) {
    if (estado === null) {
      return 'El expediente no tiene un estado actual válido';
    }
    return 'El rol "' + rolOperador + '" no puede operar sobre "' +
      estado.id + '" (requiere "' + estado.rolEjecutor + '")';
  }

  function puedeAvanzar(expediente, rolOperador) {
    var estado = obtener(utils.idEstadoActual(expediente));
    if (!rolEsEjecutor(estado, rolOperador)) {
      return { permitido: false, motivo: motivoRolIncorrecto(estado, rolOperador), destinos: [] };
    }
    return { permitido: true, motivo: null, destinos: estado.estadosSiguientes.slice() };
  }

  function puedeDevolver(expediente, rolOperador) {
    var estado = obtener(utils.idEstadoActual(expediente));
    if (!rolEsEjecutor(estado, rolOperador)) {
      return { permitido: false, motivo: motivoRolIncorrecto(estado, rolOperador), destinos: [] };
    }
    if (!estado.estadosDevolucion || estado.estadosDevolucion.length === 0) {
      return { permitido: false, motivo: 'Este estado no admite devoluciones', destinos: [] };
    }
    return { permitido: true, motivo: null, destinos: estado.estadosDevolucion.slice() };
  }

  // Clonado profundo de estructuras JSON planas (no hay funciones ni fechas).
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

  function crearEntradaAuditoria(expediente, accion, de, a, motivo, observacion, contexto, rolOperador) {
    var lista = Array.isArray(expediente.auditoria) ? expediente.auditoria
      : (Array.isArray(expediente.auditLog) ? expediente.auditLog : []);
    var previa = lista.length > 0 ? lista[lista.length - 1] : null;
    return auditoria.crearEntrada(previa, {
      timestamp: contexto.timestamp,
      email: contexto.email,
      rol: contexto.rol || rolOperador,
      equipo: contexto.equipo,
      accion: accion,
      de: de,
      a: a,
      motivo: motivo,
      observacion: observacion
    });
  }

  function agregarAuditoria(expedienteNuevo, entrada) {
    var lista = null;
    if (Array.isArray(expedienteNuevo.auditoria)) {
      lista = expedienteNuevo.auditoria;
    } else if (Array.isArray(expedienteNuevo.auditLog)) {
      lista = expedienteNuevo.auditLog;
    } else {
      lista = [];
      expedienteNuevo.auditoria = lista;
    }
    lista.push(entrada);
  }

  // Refresca los marcadores existentes del expediente (sólo los presentes).
  function actualizarMarcas(expediente, expedienteNuevo, contexto) {
    if (typeof expediente.version === 'number') {
      expedienteNuevo.version = expediente.version + 1;
    }
    if (typeof expediente.actualizado === 'string') {
      expedienteNuevo.actualizado = contexto.timestamp;
    }
    if (typeof expediente.ultimaModificacion === 'string') {
      expedienteNuevo.ultimaModificacion = contexto.timestamp;
    }
    if (typeof expediente.ultimoUsuario === 'string') {
      expedienteNuevo.ultimoUsuario = contexto.email;
    }
  }

  // Escribe el nuevo estado respetando el formato del expediente de entrada.
  function aplicarDestino(expedienteNuevo, expediente, idDestino, estadoDestino, contexto) {
    if (expediente.estado && typeof expediente.estado === 'object' &&
        typeof expediente.estado.id === 'string') {
      expedienteNuevo.estado = {
        id: idDestino,
        fase: estadoDestino ? estadoDestino.fase : null,
        desde: contexto.timestamp
      };
    } else {
      expedienteNuevo.estadoActual = idDestino;
    }
  }

  function avanzar(expediente, rolOperador, idDestino, contexto) {
    if (!expediente || typeof expediente !== 'object') {
      return { ok: false, expediente: null, error: 'El expediente no es válido' };
    }
    if (!contexto || typeof contexto !== 'object') {
      return { ok: false, expediente: null, error: 'Falta el contexto de la operación' };
    }
    var idActual = utils.idEstadoActual(expediente);
    var estadoActual = obtener(idActual);
    if (estadoActual === null) {
      return { ok: false, expediente: null, error: 'El expediente no tiene un estado actual válido' };
    }
    if (!rolEsEjecutor(estadoActual, rolOperador)) {
      return { ok: false, expediente: null, error: motivoRolIncorrecto(estadoActual, rolOperador) };
    }
    var siguientes = estadoActual.estadosSiguientes || [];
    if (siguientes.indexOf(idDestino) === -1) {
      return {
        ok: false,
        expediente: null,
        error: 'El destino "' + idDestino + '" no figura entre los estados siguientes de "' + idActual + '"'
      };
    }
    var revision = validacion.validarParaAvanzar(expediente);
    if (!revision.valido) {
      var detalle = [];
      if (revision.faltantes.campos.length > 0) {
        detalle.push('campos: ' + revision.faltantes.campos.join(', '));
      }
      if (revision.faltantes.entregables.length > 0) {
        detalle.push('entregables: ' + revision.faltantes.entregables.join(', '));
      }
      return {
        ok: false,
        expediente: null,
        error: 'Faltan requisitos para avanzar (' + detalle.join('; ') + ')'
      };
    }
    var estadoDestino = obtener(idDestino);
    var nuevo = clonar(expediente);
    aplicarDestino(nuevo, expediente, idDestino, estadoDestino, contexto);
    actualizarMarcas(expediente, nuevo, contexto);
    var entrada = crearEntradaAuditoria(expediente, 'avanzar', idActual, idDestino, null, null, contexto, rolOperador);
    agregarAuditoria(nuevo, entrada);
    return { ok: true, expediente: nuevo, error: null };
  }

  function devolver(expediente, rolOperador, idDestino, idMotivo, observacion, contexto) {
    if (!expediente || typeof expediente !== 'object') {
      return { ok: false, expediente: null, error: 'El expediente no es válido' };
    }
    if (!contexto || typeof contexto !== 'object') {
      return { ok: false, expediente: null, error: 'Falta el contexto de la operación' };
    }
    var idActual = utils.idEstadoActual(expediente);
    var estadoActual = obtener(idActual);
    if (estadoActual === null) {
      return { ok: false, expediente: null, error: 'El expediente no tiene un estado actual válido' };
    }
    if (!rolEsEjecutor(estadoActual, rolOperador)) {
      return { ok: false, expediente: null, error: motivoRolIncorrecto(estadoActual, rolOperador) };
    }
    var motivoValido = false;
    var motivos = config.MOTIVOS_DEVOLUCION;
    for (var i = 0; i < motivos.length; i++) {
      if (motivos[i].id === idMotivo) {
        motivoValido = true;
        break;
      }
    }
    if (!motivoValido) {
      return {
        ok: false,
        expediente: null,
        error: 'El motivo de devolución "' + idMotivo + '" no pertenece al catálogo'
      };
    }
    var devoluciones = estadoActual.estadosDevolucion || [];
    if (devoluciones.indexOf(idDestino) === -1) {
      return {
        ok: false,
        expediente: null,
        error: 'El destino "' + idDestino + '" no figura entre los estados de devolución de "' + idActual + '"'
      };
    }
    var estadoDestino = obtener(idDestino);
    var nuevo = clonar(expediente);
    aplicarDestino(nuevo, expediente, idDestino, estadoDestino, contexto);
    actualizarMarcas(expediente, nuevo, contexto);
    var entrada = crearEntradaAuditoria(expediente, 'devolver', idActual, idDestino, idMotivo, observacion === undefined ? null : observacion, contexto, rolOperador);
    agregarAuditoria(nuevo, entrada);
    return { ok: true, expediente: nuevo, error: null };
  }

  SGC.core.estados = {
    obtener: obtener,
    puedeAvanzar: puedeAvanzar,
    avanzar: avanzar,
    puedeDevolver: puedeDevolver,
    devolver: devolver
  };
})(typeof window !== 'undefined' ? window : globalThis);
