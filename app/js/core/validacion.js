/*
 * validacion.js
 * Validación del dominio (ORDEN-RONDA-02 §3.2).
 *
 *  - `validarParaAvanzar` deriva las exigencias de `camposRequeridos` y
 *    `entregablesObligatorios` del estado actual. Trabaja con arreglos vacíos
 *    (todo es válido) y con arreglos poblados; no los puebla por su cuenta.
 *  - `validarRenglon` aplica la enmienda de ADR-014: `codigo` obligatorio,
 *    `cantidad` numérica positiva, `unidad` presente y `aclaracion` opcional
 *    de máximo 200 caracteres. Sólo valida forma: la existencia del código en
 *    el catálogo real se valida en otra capa, fuera de esta ronda.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.core) {
    throw new Error('validacion.js requiere que namespaces.js se cargue primero');
  }

  var MAX_ACLARACION = 200;

  function obtenerEstado(expediente) {
    var id = SGC.core.utils.idEstadoActual(expediente);
    if (id === null) {
      return null;
    }
    var estados = SGC.core.config.ESTADOS;
    for (var i = 0; i < estados.length; i++) {
      if (estados[i].id === id) {
        return estados[i];
      }
    }
    return null;
  }

  function campoPresente(expediente, nombre) {
    if (!expediente.campos || typeof expediente.campos !== 'object') {
      return false;
    }
    if (!Object.prototype.hasOwnProperty.call(expediente.campos, nombre)) {
      return false;
    }
    var valor = expediente.campos[nombre];
    return valor !== undefined && valor !== null && valor !== '';
  }

  function entregablePresente(expediente, idEntregable) {
    return Array.isArray(expediente.entregables) &&
      expediente.entregables.indexOf(idEntregable) !== -1;
  }

  function validarParaAvanzar(expediente) {
    var faltantes = { campos: [], entregables: [] };
    var estado = obtenerEstado(expediente);
    if (estado === null) {
      return { valido: false, faltantes: faltantes };
    }
    var requeridos = estado.camposRequeridos || [];
    var obligatorios = estado.entregablesObligatorios || [];
    for (var i = 0; i < requeridos.length; i++) {
      if (!campoPresente(expediente, requeridos[i])) {
        faltantes.campos.push(requeridos[i]);
      }
    }
    for (var j = 0; j < obligatorios.length; j++) {
      if (!entregablePresente(expediente, obligatorios[j])) {
        faltantes.entregables.push(obligatorios[j]);
      }
    }
    return {
      valido: faltantes.campos.length === 0 && faltantes.entregables.length === 0,
      faltantes: faltantes
    };
  }

  function validarRenglon(renglon) {
    var errores = [];
    if (!renglon || typeof renglon !== 'object') {
      return { valido: false, errores: ['El renglón no es válido'] };
    }
    if (typeof renglon.codigo !== 'string' || renglon.codigo.trim() === '') {
      errores.push('El código es obligatorio');
    }
    if (typeof renglon.cantidad !== 'number' || !(renglon.cantidad > 0)) {
      errores.push('La cantidad debe ser un número positivo');
    }
    if (typeof renglon.unidad !== 'string' || renglon.unidad.trim() === '') {
      errores.push('La unidad de medida es obligatoria');
    }
    if (renglon.aclaracion !== undefined && renglon.aclaracion !== null &&
        typeof renglon.aclaracion === 'string' &&
        renglon.aclaracion.length > MAX_ACLARACION) {
      errores.push('La aclaración no puede superar los ' + MAX_ACLARACION + ' caracteres');
    }
    return { valido: errores.length === 0, errores: errores };
  }

  SGC.core.validacion = {
    validarParaAvanzar: validarParaAvanzar,
    validarRenglon: validarRenglon
  };
})(typeof window !== 'undefined' ? window : globalThis);
