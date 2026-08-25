/*
 * pliego-yaml.js
 * ORDEN-RONDA-11 §3.3. Emisor YAML de cero dependencias (ADR-003) para el
 * formato que consume el generador de pliegos existente.
 *
 * Emite exactamente la forma de EJEMPLO_DATOS.yaml: escalares, listas de
 * mapas, dos niveles. Cuidado con el escapado: dos puntos sin entrecomillar
 * rompen el YAML en silencio.
 *
 * Verificación: el generador (tools/recorrido-completo.js o
 * tools/generar_pliego.py) debe procesar el YAML sin edición manual.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.descargas) {
    throw new Error('pliego-yaml.js requiere que namespaces.js se cargue primero');
  }

  // Patrones que fuerzan entrecomillado doble en YAML.
  var RE_DOS_PUNTOS = /:\s/;
  var RE_NUMERO = /^\d/;
  var RE_HASH = /#\s/;
  var RE_GUION = /^-/;
  var RE_GUION_BAJO = /^_/;
  var RE_SIMBOLOS = /[{}[\],&*?|>!%@`]/;

  function necesitaEscapar(valor) {
    if (typeof valor !== 'string') return false;
    if (valor === '') return true;
    if (RE_DOS_PUNTOS.test(valor)) return true;
    if (RE_NUMERO.test(valor)) return true;
    if (RE_HASH.test(valor)) return true;
    if (RE_GUION.test(valor)) return true;
    if (RE_GUION_BAJO.test(valor)) return true;
    if (RE_SIMBOLOS.test(valor)) return true;
    if (/^["']/.test(valor)) return true;
    if (/\n/.test(valor)) return true;
    if (valor === 'true' || valor === 'false' || valor === 'null' ||
        valor === 'yes' || valor === 'no' || valor === 'on' || valor === 'off') {
      return true;
    }
    return false;
  }

  function escapeDouble(valor) {
    return valor
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t');
  }

  function escalar(valor) {
    if (valor === null || valor === undefined) return '""';
    if (typeof valor === 'boolean') return valor ? 'true' : 'false';
    if (typeof valor === 'number') return String(valor);
    var s = String(valor);
    if (s === '') return '""';
    if (necesitaEscapar(s)) {
      return '"' + escapeDouble(s) + '"';
    }
    return s;
  }

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
        lineas.push(prefijo + escalar(clave) + ': ' + escalar(valor));
      } else if (Array.isArray(valor)) {
        lineas.push(prefijo + escalar(clave) + ':');
        var bloques = emitirLista(valor, prefijo + '  ');
        lineas.push(bloques);
      } else if (typeof valor === 'object') {
        lineas.push(prefijo + escalar(clave) + ':');
        lineas.push(emitirMapa(valor, prefijo + '  '));
      } else {
        lineas.push(prefijo + escalar(clave) + ': ' + escalar(valor));
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
    necesitaEscapar: necesitaEscapar
  };
})(typeof window !== 'undefined' ? window : globalThis);
