/*
 * pliego-yaml.js
 * ORDEN-RONDA-12 §2.1 (ADR-031). Emisor YAML de cero dependencias (ADR-003)
 * para el formato que consume el generador de pliegos existente.
 *
 * ADR-031: todo escalar de tipo cadena se emite entre comillas dobles, siempre.
 * La lista de "cuándo entrecomillar" se invirtió: en vez de detectar peligros,
 * se entrecomilla todo. El escapado es el único punto delicado: barra invertida,
 * comilla doble, salto de línea, tabulador, retorno de carro. La barra invertida
 * primero para no escapar las escapadas.
 *
 * Las claves siguen sin comillas: las controlamos nosotros.
 *
 * Verificación: ida y vuelta contra un parser de verdad (tests/ronda-12.test.js).
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.descargas) {
    throw new Error('pliego-yaml.js requiere que namespaces.js se cargue primero');
  }

  function escapeDouble(valor) {
    return valor
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\x00/g, '\\u0000')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/\r/g, '\\r');
  }

  function escalar(valor) {
    if (valor === null || valor === undefined) return '""';
    if (typeof valor === 'boolean') return valor ? 'true' : 'false';
    if (typeof valor === 'number') return String(valor);
    var s = String(valor);
    return '"' + escapeDouble(s) + '"';
  }

  // Valores especiales para campos que genuinamente no tenemos (§2.7).
  // Un campo FALTA se emite con un valor que el parser de Python parsea
  // como texto normal, pero que la persona que lee el YAML identifica
  // como dato faltante.
  var MARCA_FALTA = '_FALTA_';

  function emitirValor(valor, indent) {
    if (Array.isArray(valor)) {
      return emitirLista(valor, indent);
    }
    if (valor && typeof valor === 'object') {
      return emitirMapa(valor, indent);
    }
    return escalar(valor);
  }

  function emitirMapa(mapa, indent) {
    var lineas = [];
    var prefijo = indent || '';
    for (var clave in mapa) {
      if (!Object.prototype.hasOwnProperty.call(mapa, clave)) continue;
      var valor = mapa[clave];
      if (valor === null || valor === undefined ||
          (typeof valor === 'string' && valor === '')) {
        lineas.push(prefijo + clave + ': ' + escalar(valor));
      } else if (Array.isArray(valor)) {
        lineas.push(prefijo + clave + ':');
        var bloques = emitirLista(valor, prefijo + '  ');
        lineas.push(bloques);
      } else if (typeof valor === 'object') {
        lineas.push(prefijo + clave + ':');
        lineas.push(emitirMapa(valor, prefijo + '  '));
      } else {
        lineas.push(prefijo + clave + ': ' + escalar(valor));
      }
    }
    return lineas.join('\n');
  }

  function emitirLista(lista, indent) {
    if (lista.length === 0) return indent + '[]';
    var prefijo = indent || '';
    var bloques = [];
    for (var i = 0; i < lista.length; i++) {
      var item = lista[i];
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        var lineasMapa = emitirMapa(item, prefijo + '  ');
        bloques.push(prefijo + '- ' + lineasMapa.replace(new RegExp('^' + prefijo + '  ', 'm'), ''));
      } else {
        bloques.push(prefijo + '- ' + escalar(item));
      }
    }
    return bloques.join('\n');
  }

  function emitir(datos) {
    if (!datos || typeof datos !== 'object') return '';
    return emitirMapa(datos, '') + '\n';
  }

  SGC.descargas.pliegoYaml = {
    escalar: escalar,
    emitir: emitir,
    MARCA_FALTA: MARCA_FALTA
  };
})(typeof window !== 'undefined' ? window : globalThis);
