/*
 * fasttrack.js
 * Fast-Track de la Especificación Técnica (ORDEN-RONDA-05 §3.4, FSD §5):
 * el usuario baja un JSON modelo, lo completa por fuera y lo sube para
 * pre-poblar el wizard.
 *
 * El archivo se trata como entrada no confiable: estructura y tipos campo por
 * campo, cada código de renglón debe existir en el catálogo vigente, las
 * aclaraciones de más de 2000 caracteres se rechazan (MAX_ACLARACION_TOTAL,
 * config.js), y ningún valor llega como
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

  // Definición única en config.js (ORDEN-RONDA-10 §2.1); lectura perezosa.
  function maxAclaracionTotal() {
    return SGC.core.config.MAX_ACLARACION_TOTAL;
  }

  /*
   * El formato del archivo que viaja entre el generador y Abastecimiento
   * (ORDEN-RONDA-28 §4). Vive acá y no en el generador por una razón práctica:
   * fasttrack.js es el único módulo que está en las dos aplicaciones, y la
   * plantilla y el sello del archivo exportado tienen que decir lo mismo. Si
   * cada uno tuviera su copia, un cambio de versión dejaría viejo un archivo sin
   * que nadie lo note.
   */
  var FORMATO = 'sgc-requerimiento/1';

  function modelo() {
    return {
      formato: FORMATO,
      titulo: 'Adquisición de insumos para la División',
      anio: '2026',
      dependenciaSolicitante: 'División Usuario',
      justificacion: 'Se necesita reponer insumos en uso corriente.',
      objetivo: '',
      // ORDEN-RONDA-33 pieza 1: las reglas para el asistente de IA que llena la
      // plantilla. No es parte del requerimiento: importar() lo ignora, y eso
      // se prueba en ronda-32-p2 / ronda-33-p1.
      instrucciones: [
        'Sos un asistente que completa esta plantilla de requerimiento del SGC a partir de',
        'los documentos que te adjunta la persona (Word, Excel, PDF, correos). Reglas:',
        '1) Devolvé SÓLO el JSON, con esta misma forma, sin texto antes ni después.',
        '2) titulo: qué se compra, en pocas palabras. anio: el año en cuatro dígitos.',
        'dependenciaSolicitante: la dependencia que pide. justificacion: por qué se',
        'necesita, con lo que digan los documentos.',
        '3) renglones: uno por cada bien o servicio distinto. "codigo": copialo SÓLO si',
        'en los documentos aparece un código del catálogo ONC con la forma 2.9.6-1115.1;',
        'si no aparece, dejalo vacío (""). Nunca inventes ni completes un código.',
        '"buscar": el nombre del producto en dos a cuatro palabras, como se buscaría en un',
        'catálogo (por ejemplo "resma papel A4"). "cantidad": un número. "unidad": corta',
        '(UN, KG, M, L, CAJA); si no se sabe, vacía. "aclaracion": sólo lo que el producto',
        'tiene que cumplir y no está en su nombre (medidas, normas, compatibilidades), sin',
        'marcas y hasta 256 caracteres.',
        '4) No escribas descripciones de ítems: las pone el catálogo.',
        '5) Si algo no está en los documentos, dejá el campo vacío. No lo inventes.',
        '6) Los precios y los presupuestos no van en este JSON: se cargan aparte en el SGC.'
      ].join('\n'),
      renglones: [
        // ORDEN-RONDA-33 pieza 1: un renglón con un código real del catálogo
        // vigente (versión 98201747) y su "buscar", y un renglón con el código
        // vacío, que muestra cómo se deja el código que no se sabe.
        { codigo: '2.3.1-6563.129', buscar: 'resma papel A4', cantidad: 2, unidad: 'UN', aclaracion: '' },
        { codigo: '', buscar: 'resma papel A4', cantidad: 1, unidad: 'UN', aclaracion: '' }
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

    /*
     * ORDEN-RONDA-32 pieza 2: "instrucciones" es el texto para el asistente
     * que llena la plantilla — no es parte del requerimiento. Se ignora a
     * propósito, y el test ronda-32-p2 lo prueba: la plantilla con
     * instrucciones importa igual que sin ellas.
     */
    crudo.instrucciones = undefined;

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
      // ORDEN-RONDA-33 pieza 1: un renglón sin código ya no rechaza el archivo.
      // Entra "por buscar": la persona elige el ítem del catálogo desde el
      // formulario. No se le exigen cantidad ni unidad; sólo la aclaración
      // respeta el máximo.
      if (typeof r.codigo !== 'string' || r.codigo.trim() === '') {
        var aclaracionPorBuscar = typeof r.aclaracion === 'string' ? r.aclaracion : '';
        if (SGC.core.utils.contarCaracteres(aclaracionPorBuscar) > maxAclaracionTotal()) {
          errores.push(prefijo + 'la aclaración supera los ' + maxAclaracionTotal() + ' caracteres');
          aclaracionesLargas++;
          continue;
        }
        var cantidadPorBuscar = (typeof r.cantidad === 'number' && r.cantidad > 0) ? r.cantidad : '';
        renglones.push({
          codigo: '',
          item: '',
          buscar: typeof r.buscar === 'string' ? r.buscar.trim() : '',
          cantidad: cantidadPorBuscar,
          unidad: typeof r.unidad === 'string' ? r.unidad.trim() : '',
          aclaracion: aclaracionPorBuscar,
          porBuscar: true
        });
        continue;
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
      if (SGC.core.utils.contarCaracteres(aclaracion) > maxAclaracionTotal()) {
        errores.push(prefijo + 'la aclaración supera los ' + maxAclaracionTotal() + ' caracteres');
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
    MAX_ACLARACION: SGC.core.config.MAX_ACLARACION,
    FORMATO: FORMATO,
    modelo: modelo,
    importar: importar
  };
})(typeof window !== 'undefined' ? window : globalThis);