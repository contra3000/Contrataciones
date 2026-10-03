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

  SGC.core.utils = {
    idEstado: idEstado,
    contarCaracteres: contarCaracteres,
    numeroConPuntos: numeroConPuntos
  };
})(typeof window !== 'undefined' ? window : globalThis);
