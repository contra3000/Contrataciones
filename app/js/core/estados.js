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
    if (estado === null || typeof rolOperador !== 'string') {
      return false;
    }
    // ADR-033 (ORDEN-RONDA-14 §3.1): se pregunta contra el conjunto efectivo
    // —el rol propio más los heredados—, no contra el rol solo.
    var efectivos = config.rolesEfectivos(rolOperador);
    return efectivos.indexOf(estado.rolEjecutor) !== -1;
  }

  function motivoRolIncorrecto(estado, rolOperador) {
    if (estado === null) {
      return 'El expediente no tiene un estado actual válido';
    }
    return 'El rol "' + rolOperador + '" no puede operar sobre "' +
      estado.id + '" (requiere "' + estado.rolEjecutor + '")';
  }

  function puedeAvanzar(expediente, rolOperador) {
    var estado = obtener(utils.idEstado(expediente));
    if (!rolEsEjecutor(estado, rolOperador)) {
      return { permitido: false, motivo: motivoRolIncorrecto(estado, rolOperador), destinos: [] };
    }
    return { permitido: true, motivo: null, destinos: estado.estadosSiguientes.slice() };
  }

  function puedeDevolver(expediente, rolOperador) {
    var estado = obtener(utils.idEstado(expediente));
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

  function crearEntradaAuditoria(expediente, accion, de, a, motivo, observacion, contexto, rolOperador, rolEfectivo) {
    var lista = Array.isArray(expediente.auditoria) ? expediente.auditoria
      : (Array.isArray(expediente.auditLog) ? expediente.auditLog : []);
    var previa = lista.length > 0 ? lista[lista.length - 1] : null;
    var entrada = auditoria.crearEntrada(previa, {
      timestamp: contexto.timestamp,
      email: contexto.email,
      rol: contexto.rol || rolOperador,
      equipo: contexto.equipo,
      origen: contexto.origen,
      accion: accion,
      de: de,
      a: a,
      motivo: motivo,
      observacion: observacion
    });
    // ADR-033 §3 (ORDEN-RONDA-14 §3.5): el rol efectivo con el que se actuó.
    // Cuando un supervisor ejecuta un paso de su supervisado, el registro dice
    // "contrataciones_supervisor actuando como contrataciones". Va FUERA de la
    // cadena de hash (auditoria.js serializa un conjunto fijo de campos), así
    // que las entradas viejas mantienen su cadena íntegra.
    if (typeof rolEfectivo === 'string' &&
        rolEfectivo !== (contexto.rol || rolOperador)) {
      entrada.rolEfectivo = rolEfectivo;
    }
    return entrada;
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

  // Escribe el nuevo estado en el esquema v2 (ADR-019).
  function aplicarDestino(expedienteNuevo, idDestino, estadoDestino, contexto) {
    expedienteNuevo.estado = {
      id: idDestino,
      fase: estadoDestino ? estadoDestino.fase : null,
      desde: contexto.timestamp
    };
  }

  function avanzar(expediente, rolOperador, idDestino, contexto) {
    if (!expediente || typeof expediente !== 'object') {
      return { ok: false, expediente: null, error: 'El expediente no es válido' };
    }
    if (!contexto || typeof contexto !== 'object') {
      return { ok: false, expediente: null, error: 'Falta el contexto de la operación' };
    }
    var idActual = utils.idEstado(expediente);
    var estadoDef = obtener(idActual);
    if (estadoDef === null) {
      return { ok: false, expediente: null, error: 'El expediente no tiene un estado actual válido' };
    }
    if (!rolEsEjecutor(estadoDef, rolOperador)) {
      return { ok: false, expediente: null, error: motivoRolIncorrecto(estadoDef, rolOperador) };
    }
    var siguientes = estadoDef.estadosSiguientes || [];
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
    aplicarDestino(nuevo, idDestino, estadoDestino, contexto);
    actualizarMarcas(expediente, nuevo, contexto);
    var entrada = crearEntradaAuditoria(expediente, 'avanzar', idActual, idDestino, null, null, contexto, rolOperador, estadoDef.rolEjecutor);
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
    var idActual = utils.idEstado(expediente);
    var estadoDef = obtener(idActual);
    if (estadoDef === null) {
      return { ok: false, expediente: null, error: 'El expediente no tiene un estado actual válido' };
    }
    if (!rolEsEjecutor(estadoDef, rolOperador)) {
      return { ok: false, expediente: null, error: motivoRolIncorrecto(estadoDef, rolOperador) };
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
    var devoluciones = estadoDef.estadosDevolucion || [];
    if (devoluciones.indexOf(idDestino) === -1) {
      return {
        ok: false,
        expediente: null,
        error: 'El destino "' + idDestino + '" no figura entre los estados de devolución de "' + idActual + '"'
      };
    }
    var estadoDestino = obtener(idDestino);
    var nuevo = clonar(expediente);
    aplicarDestino(nuevo, idDestino, estadoDestino, contexto);
    actualizarMarcas(expediente, nuevo, contexto);
    var entrada = crearEntradaAuditoria(expediente, 'devolver', idActual, idDestino, idMotivo, observacion === undefined ? null : observacion, contexto, rolOperador, estadoDef.rolEjecutor);
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
