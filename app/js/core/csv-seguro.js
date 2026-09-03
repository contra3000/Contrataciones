/*
 * csv-seguro.js
 * ORDEN-RONDA-18 §3.3 (ADR-031). Neutralización de fórmulas en la exportación
 * de CSV. Definición ÚNICA, compartida entre el servidor (padron-csv.js) y la
 * vista del navegador (exploracion.js): no se detectan casos, se neutraliza
 * todo texto que empiece con `=`, `+`, `-`, `@` o tabulador, poniendo un
 * apóstrofo delante SIN romper el dato — la planilla lo muestra sin el
 * prefijo y al reimportar el texto vuelve igual.
 *
 * Sigue la forma de ADR-031 (como el YAML): neutralizar siempre. El apóstrofo
 * se aplica ANTES del escapado de comilla/separador, que es responsabilidad de
 * cada exportador (usa ';' el padrón y ',' el registro de eventos).
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.core) {
    throw new Error('csv-seguro.js requiere que namespaces.js se cargue primero');
  }

  // Prefijos que una planilla trata como fórmula al abrir el CSV. El tabulador
  // es Ctrl-V en algunos Excel. Siempre se antepone un apóstrofo.
  function neutralizarFormulas(texto) {
    var s = texto === null || texto === undefined ? '' : String(texto);
    var primero = s.charAt(0);
    if (primero === '=' || primero === '+' || primero === '-' ||
        primero === '@' || primero === '\t') {
      return "'" + s;
    }
    return s;
  }

  // Neutraliza un campo y luego decide si hace falta comilla doble para el
  // separador `sep`. Devuelve el campo listo para intercalar con `sep`.
  function campoCSV(valor, sep) {
    var s = neutralizarFormulas(valor);
    var separador = sep === undefined ? ';' : sep;
    if (s.indexOf('"') !== -1 || s.indexOf(separador) !== -1 ||
        s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  // Reversa de neutralizarFormulas para la importación: si un valor empieza
  // con apóstrofo y lo que sigue es un prefijo que la planilla trataría como
  // fórmula (`= + - @` o tabulador), el apóstrofo era sólo la marca de
  // neutralización del ciclo 18 §3.3 y se quita para que el dato —que viaja
  // neutralizado pero íntegro— vuelva exactamente como entró. Un apóstrofo que
  // no cumple eso es dato real y se conserva.
  function desneutralizarFormulas(texto) {
    var s = texto === null || texto === undefined ? '' : String(texto);
    if (s.charAt(0) !== "'") {
      return s;
    }
    var siguiente = s.charAt(1);
    if (siguiente === '=' || siguiente === '+' || siguiente === '-' ||
        siguiente === '@' || siguiente === '\t') {
      return s.slice(1);
    }
    return s;
  }

  SGC.core.csvSeguro = {
    neutralizarFormulas: neutralizarFormulas,
    desneutralizarFormulas: desneutralizarFormulas,
    campoCSV: campoCSV
  };
})(typeof window !== 'undefined' ? window : globalThis);