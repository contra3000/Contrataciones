/*
 * validacion.js
 * Validación del dominio (ORDEN-RONDA-02 §3.2).
 *
 *  - `validarParaAvanzar` deriva las exigencias de `camposRequeridos` y
 *    `entregablesObligatorios` del estado actual. Trabaja con arreglos vacíos
 *    (todo es válido) y con arreglos poblados; no los puebla por su cuenta.
 *  - `validarRenglon` aplica la enmienda de ADR-014: `codigo` obligatorio,
 *    `cantidad` numérica positiva, `unidad` presente y `aclaracion` opcional
 *    de máximo MAX_ACLARACION_TOTAL caracteres (config.js, hoy 2000). Sólo
 *    valida forma: la existencia del código en el catálogo real se valida en
 *    otra capa, fuera de esta ronda.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.core) {
    throw new Error('validacion.js requiere que namespaces.js se cargue primero');
  }

  // La definición única del límite vive en config.js (ORDEN-RONDA-10 §2.1).
  // Se lee perezosamente dentro de cada función para no depender del orden de
  // carga entre módulos.
  function maxAclaracionTotal() {
    return SGC.core.config.MAX_ACLARACION_TOTAL;
  }

  function obtenerEstado(expediente) {
    var id = SGC.core.utils.idEstado(expediente);
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

  // Un entregable puede registrarse como cadena (id directo, como en los
  // tests de configuración) o como objeto {id, nombre, ruta, ...} (como lo
  // guarda el servidor desde la ronda 8). Ambas formas cierran la exigencia.
  function entregablePresente(expediente, idEntregable) {
    var lista = Array.isArray(expediente.entregables) ? expediente.entregables : [];
    for (var i = 0; i < lista.length; i++) {
      var e = lista[i];
      if (typeof e === 'string' && e === idEntregable) {
        return true;
      }
      if (e && typeof e === 'object' && e.id === idEntregable) {
        return true;
      }
    }
    return false;
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
    // ORDEN-RONDA-10 §2.1: el tope duro de entrada es MAX_ACLARACION_TOTAL
    // (config.js). Superar los 256 no es error acá: ese texto desborda al
    // anexo de EETT (core/anexo-eett.js) y se acepta hasta el tope. El conteo
    // es el mismo criterio de todo el sistema: puntos de código
    // (utils.contarCaracteres, ORDEN-RONDA-10-CIERRE §2).
    if (renglon.aclaracion !== undefined && renglon.aclaracion !== null &&
        typeof renglon.aclaracion === 'string' &&
        SGC.core.utils.contarCaracteres(renglon.aclaracion) > maxAclaracionTotal()) {
      errores.push('La aclaración no puede superar los ' + maxAclaracionTotal() + ' caracteres');
    }
    // ORDEN-RONDA-09 §3.3/§3.4 (ADR-022): valores de referencia y cantidades
    // máximas/mínimas. Requerimiento.js es el dueño de esas reglas; si el
    // módulo no está cargado (tests de configuración), no se agregan errores.
    if (SGC.core.requerimiento) {
      errores = errores.concat(SGC.core.requerimiento.validarValoresReferencia(renglon));
      errores = errores.concat(SGC.core.requerimiento.validarCantidades(renglon));
    }
    return { valido: errores.length === 0, errores: errores };
  }

  // Validación agregada del requerimiento (ORDEN-RONDA-09 §3.6): valores de
  // referencia de todos los renglones y cantidades máximas/mínimas. Sin
  // estado: valida el expediente completo, no una transición.
  function validarRequerimiento(expediente) {
    if (SGC.core.requerimiento) {
      return SGC.core.requerimiento.validarRequerimiento(expediente);
    }
    return { valido: true, errores: [] };
  }

  // Validación del paso Identificación del wizard (ORDEN-RONDA-05 §3.1): el
  // operador viene del padrón y se guarda como correo; el año debe tener
  // cuatro dígitos.
  function validarIdentificacion(campos) {
    var errores = [];
    if (!campos || typeof campos !== 'object') {
      return { valido: false, errores: ['Faltan los campos de identificación'] };
    }
    if (typeof campos.titulo !== 'string' || campos.titulo.trim() === '') {
      errores.push('El título del requerimiento es obligatorio');
    }
    if (typeof campos.anio !== 'string' || !/^\d{4}$/.test(campos.anio)) {
      errores.push('El año debe tener cuatro dígitos');
    }
    if (typeof campos.dependenciaSolicitante !== 'string' || campos.dependenciaSolicitante.trim() === '') {
      errores.push('La dependencia solicitante es obligatoria');
    }
    if (typeof campos.operador !== 'string' || campos.operador.trim() === '') {
      errores.push('El operador es obligatorio');
    }
    return { valido: errores.length === 0, errores: errores };
  }

  // Validación del paso Fundamentación del wizard (ORDEN-RONDA-05 §3.1).
  function validarFundamentacion(campos) {
    var errores = [];
    if (!campos || typeof campos !== 'object') {
      return { valido: false, errores: ['Faltan los campos de fundamentación'] };
    }
    if (typeof campos.justificacion !== 'string' || campos.justificacion.trim() === '') {
      errores.push('La justificación del requerimiento es obligatoria');
    } else if (campos.justificacion.length > SGC.core.config.MAX_JUSTIFICACION) {
      // ORDEN-RONDA-10-CIERRE §1.3: mismo criterio que valida el servidor
      // (validarJustificaciones); la constante vive en config.js.
      errores.push('La justificación no puede superar los ' +
        SGC.core.config.MAX_JUSTIFICACION + ' caracteres');
    }
    return { valido: errores.length === 0, errores: errores };
  }

  // Tope duro de los textos de justificación (ORDEN-RONDA-10-CIERRE §1.3,
  // auditoría §2.4): el servidor lo aplica por su cuenta al crear (POST) y al
  // guardar (PUT), sin ayuda de la pantalla. Cubre los dos lugares donde vive
  // una justificación: la fundamentación del wizard y el campo del encabezado
  // del requerimiento que se prellena desde ella.
  function validarJustificaciones(expediente) {
    var errores = [];
    if (!expediente || typeof expediente !== 'object') {
      return errores;
    }
    var limite = SGC.core.config.MAX_JUSTIFICACION;
    var candidatos = [];
    var fund = expediente.fundamentacion;
    if (fund && typeof fund.justificacion === 'string') {
      candidatos.push({ nombre: 'la justificación de la necesidad', texto: fund.justificacion });
    }
    var rq = expediente.requerimiento;
    if (rq && typeof rq.justificacionNecesidad === 'string') {
      candidatos.push({
        nombre: '"Justificación de la necesidad" del requerimiento',
        texto: rq.justificacionNecesidad
      });
    }
    for (var i = 0; i < candidatos.length; i++) {
      if (candidatos[i].texto.length > limite) {
        errores.push(candidatos[i].nombre + ' no puede superar los ' + limite + ' caracteres');
      }
    }
    return errores;
  }

  SGC.core.validacion = {
    validarParaAvanzar: validarParaAvanzar,
    validarRenglon: validarRenglon,
    validarIdentificacion: validarIdentificacion,
    validarFundamentacion: validarFundamentacion,
    validarJustificaciones: validarJustificaciones,
    validarRequerimiento: validarRequerimiento
  };
})(typeof window !== 'undefined' ? window : globalThis);
