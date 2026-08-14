/*
 * fasttrack.js
 * Fast-Track de la Especificación Técnica (ORDEN-RONDA-05 §3.4, FSD §5):
 * el usuario baja un JSON modelo, lo completa por fuera y lo sube para
 * pre-poblar el wizard.
 *
 * El archivo se trata como entrada no confiable: estructura y tipos campo por
 * campo, cada código de renglón debe existir en el catálogo vigente, las
 * aclaraciones de más de 200 caracteres se rechazan, y ningún valor llega como
 * HTML (la vista usa textContent). Un error produce un listado legible, nunca
 * una excepción ni un formulario a medio llenar.
 *
 * Módulo puro: `verificarCodigo` se inyecta para que el testeo en Node no
 * dependa del catálogo.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('fasttrack.js requiere que namespaces.js se cargue primero');
  }

  var MAX_ACLARACION = 200;

  function modelo() {
    return {
      titulo: 'Adquisición de insumos para la División',
      anio: '2026',
      dependenciaSolicitante: 'División Usuario',
      justificacion: 'Se necesita reponer insumos en uso corriente.',
      objetivo: '',
      renglones: [
        { codigo: '2.9.6-1115.1', cantidad: 2, unidad: 'UN', aclaracion: '' }
      ]
    };
  }

  function esObjeto(valor) {
    return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
  }

  function importar(texto, verificarCodigo) {
    if (typeof verificarCodigo !== 'function') {
      verificarCodigo = function () {
        return true;
      };
    }
    var errores = [];
    var crudo = null;
    try {
      crudo = JSON.parse(texto);
    } catch (e) {
      return {
        ok: false,
        errores: ['El archivo no es JSON válido: ' + (e && e.message ? e.message : 'no se pudo leer')]
      };
    }
    if (!esObjeto(crudo)) {
      return { ok: false, errores: ['El archivo debe ser un objeto JSON, no un arreglo ni un valor suelto'] };
    }

    function textoObligatorio(campo) {
      if (typeof crudo[campo] !== 'string' || crudo[campo].trim() === '') {
        errores.push('El campo "' + campo + '" debe ser un texto no vacío');
        return '';
      }
      return crudo[campo].trim();
    }

    var titulo = textoObligatorio('titulo');
    var dependenciaSolicitante = textoObligatorio('dependenciaSolicitante');
    var justificacion = textoObligatorio('justificacion');

    var anio = '';
    if (typeof crudo.anio === 'string' && /^\d{4}$/.test(crudo.anio)) {
      anio = crudo.anio;
    } else if (typeof crudo.anio === 'number' && Number.isInteger(crudo.anio) &&
        crudo.anio >= 1000 && crudo.anio <= 9999) {
      anio = String(crudo.anio);
    } else {
      errores.push('El campo "anio" debe tener cuatro dígitos (por ejemplo "2026")');
    }

    var objetivo = typeof crudo.objetivo === 'string' ? crudo.objetivo : '';

    if (!Array.isArray(crudo.renglones) || crudo.renglones.length === 0) {
      errores.push('El campo "renglones" debe ser un arreglo con al menos un renglón');
    }

    var renglones = [];
    var inexistentes = [];
    var aclaracionesLargas = 0;
    for (var i = 0; i < (Array.isArray(crudo.renglones) ? crudo.renglones.length : 0); i++) {
      var r = crudo.renglones[i];
      var prefijo = 'Renglón ' + (i + 1) + ': ';
      if (!esObjeto(r)) {
        errores.push(prefijo + 'debe ser un objeto');
        continue;
      }
      var valido = true;
      if (typeof r.codigo !== 'string' || r.codigo.trim() === '') {
        errores.push(prefijo + 'falta el código del catálogo');
        valido = false;
      }
      if (typeof r.cantidad !== 'number' || !(r.cantidad > 0)) {
        errores.push(prefijo + 'la cantidad debe ser un número positivo');
        valido = false;
      }
      if (typeof r.unidad !== 'string' || r.unidad.trim() === '') {
        errores.push(prefijo + 'falta la unidad de medida');
        valido = false;
      }
      var aclaracion = typeof r.aclaracion === 'string' ? r.aclaracion : '';
      if (aclaracion.length > MAX_ACLARACION) {
        errores.push(prefijo + 'la aclaración supera los ' + MAX_ACLARACION + ' caracteres');
        aclaracionesLargas++;
        valido = false;
      }
      if (!valido) {
        continue;
      }
      if (!verificarCodigo(r.codigo.trim())) {
        inexistentes.push(r.codigo.trim());
      }
      renglones.push({
        codigo: r.codigo.trim(),
        item: r.codigo.trim(),
        cantidad: r.cantidad,
        unidad: r.unidad.trim(),
        aclaracion: aclaracion
      });
    }

    if (inexistentes.length > 0) {
      errores.push('Los siguientes códigos no existen en el catálogo vigente: ' +
        inexistentes.join(', '));
    }

    if (errores.length > 0) {
      return { ok: false, errores: errores };
    }

    return {
      ok: true,
      datos: {
        identificacion: {
          titulo: titulo,
          anio: anio,
          dependenciaSolicitante: dependenciaSolicitante,
          operador: ''
        },
        renglones: renglones,
        fundamentacion: {
          justificacion: justificacion,
          objetivo: objetivo
        }
      }
    };
  }

  SGC.views.fasttrack = {
    MAX_ACLARACION: MAX_ACLARACION,
    modelo: modelo,
    importar: importar
  };
})(typeof window !== 'undefined' ? window : globalThis);