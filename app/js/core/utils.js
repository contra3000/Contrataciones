/*
 * utils.js
 * Utilidades genéricas del núcleo.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.core) {
    throw new Error('utils.js requiere que namespaces.js se cargue primero');
  }

  // Devuelve el id del estado actual de un expediente en el esquema v2
  // (ADR-019): `expediente.estado.id`. null si no se puede determinar.
  function idEstado(expediente) {
    if (!expediente || typeof expediente !== 'object') {
      return null;
    }
    if (expediente.estado && typeof expediente.estado === 'object' &&
        typeof expediente.estado.id === 'string') {
      return expediente.estado.id;
    }
    return null;
  }

  // Conteo de caracteres en PUNTOS DE CÓDIGO, no unidades UTF-16
  // (ORDEN-RONDA-10-CIERRE §2: un solo criterio para el validador, el contador
  // visible y la regla de desborde del anexo). `String.length` cuenta
  // unidades UTF-16: para acentos y eñes coincide con lo que ve el usuario,
  // para emojis no ('🛩'.length === 2 pero el usuario ve un carácter). Acá el
  // emoji cuenta 1, igual que cualquier otro carácter visible.
  function contarCaracteres(texto) {
    if (typeof texto !== 'string') {
      return 0;
    }
    return Array.from(texto).length;
  }

  // Un entero con puntos de miles: 12345 -> 12.345. Se cuenta a mano y no
  // con toLocaleString para que dé lo mismo en cualquier navegador y en las
  // pruebas, sin depender de los datos de idioma que traiga el equipo
  // (ORDEN-RONDA-29 pieza 2: el número de control se muestra con puntos).
  function numeroConPuntos(numero) {
    var digitos = String(numero);
    var salida = '';
    for (var i = 0; i < digitos.length; i++) {
      if (i > 0 && (digitos.length - i) % 3 === 0) {
        salida += '.';
      }
      salida += digitos.charAt(i);
    }
    return salida;
  }

  /*
   * ORDEN-RONDA-31 pieza 1: la huella SHA-256 de un archivo, en hex.
   *
   * Es UNA sola función para todo el sistema: la que calcula la huella del
   * sello del JSON exportado (generador/intercambio.js) y la que anota la
   * huella de cada documento de referencia (generador/presupuestos.js). Si
   * hubiera dos, un día divergirían y dos archivos "iguales" dirían cosas
   * distintas. Devuelve una promesa con el hex en minúsculas.
   */
  function sha256Hex(bytes) {
    if (!root.crypto || !root.crypto.subtle || typeof root.crypto.subtle.digest !== 'function') {
      return Promise.reject(new Error(
        'este navegador no tiene WebCrypto, así que no se puede calcular ni verificar la huella'));
    }
    return root.crypto.subtle.digest('SHA-256', bytes).then(function (buffer) {
      var octetos = new Uint8Array(buffer);
      var hex = '';
      for (var i = 0; i < octetos.length; i++) {
        hex += (octetos[i] < 16 ? '0' : '') + octetos[i].toString(16);
      }
      return hex;
    });
  }

  /*
   * Fechas. El campo de la pantalla es type="date", así que lo que se GUARDA
   * es ISO (aaaa-mm-dd) y lo que se MUESTRA es dd/mm/aaaa, como lo lee todo el
   * mundo. Un JSON viejo trae "12/02/2026": fechaAIso lo convierte a ISO para
   * guardarlo y fechaCorta lo deja pasar tal cual, así que las dos formas se
   * leen igual en pantalla.
   */
  function fechaAIso(texto) {
    var t = String(texto === undefined || texto === null ? '' : texto).trim();
    var partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
    if (partes) {
      return partes[3] + '-' + partes[2] + '-' + partes[1];
    }
    return t;
  }

  function fechaCorta(texto) {
    var t = String(texto === undefined || texto === null ? '' : texto).trim();
    var partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
    if (partes) {
      return partes[3] + '/' + partes[2] + '/' + partes[1];
    }
    return t;
  }

  /*
   * El tipo de un documento de referencia (ORDEN-RONDA-31 pieza 1): presupuesto,
   * precio de plaza o justificación. En la aplicación con servidor `tipo` es el
   * MIME del archivo subido (application/pdf, image/png...), y un documento
   * subido sin tipo es un presupuesto: por eso todo lo que no sea uno de los
   * tres tipos conocidos cuenta como presupuesto.
   */
  var TIPOS_DOCUMENTO = ['presupuesto', 'precio-plaza', 'justificacion'];

  function tipoDeDocumento(p) {
    var t = p && typeof p.tipo === 'string' ? p.tipo.trim() : '';
    return TIPOS_DOCUMENTO.indexOf(t) === -1 ? 'presupuesto' : t;
  }

  function etiquetaDeTipo(tipo) {
    if (tipo === 'precio-plaza') {
      return 'Precio de plaza';
    }
    if (tipo === 'justificacion') {
      return 'Justificación';
    }
    return 'Presupuesto';
  }

  SGC.core.utils = {
    idEstado: idEstado,
    contarCaracteres: contarCaracteres,
    numeroConPuntos: numeroConPuntos,
    sha256Hex: sha256Hex,
    fechaAIso: fechaAIso,
    fechaCorta: fechaCorta,
    tipoDeDocumento: tipoDeDocumento,
    etiquetaDeTipo: etiquetaDeTipo
  };
})(typeof window !== 'undefined' ? window : globalThis);
