/*
 * consolidacion.js
 * ORDEN-RONDA-42 pieza 2a (ADR-043). La regla de la SCo en el núcleo del
 * generador: un renglón por código de catálogo y unidad, con la cantidad
 * sumada y el desglose de qué requerimiento aporta cada parte.
 *
 * Es la misma clave, la misma suma y el mismo orden que server/sco.js, pero
 * con una diferencia a propósito: la descripción es la del renglón y, si viene
 * vacía, el `item` del catálogo. Los renglones que se guardan traen `item`, no
 * `descripcion`, y el ANEXO I no puede salir con la descripción vacía.
 *
 * Sólo lo carga generador.html: la aplicación con servidor sigue con su regla
 * hasta que se haga el puerto (ADR-044).
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.core) {
    throw new Error('core/consolidacion.js requiere que namespaces.js se cargue primero');
  }

  function descripcionDe(r) {
    if (typeof r.descripcion === 'string' && r.descripcion !== '') {
      return r.descripcion;
    }
    return typeof r.item === 'string' ? r.item : '';
  }

  // requerimientos: [{etiqueta, renglones}]. La etiqueta es lo que se imprime
  // como expediente en el desglose (la dependencia solicitante).
  function renglones(requerimientos) {
    var lista = Array.isArray(requerimientos) ? requerimientos : [];
    var porClave = {};
    var claves = [];
    for (var i = 0; i < lista.length; i++) {
      var entrada = lista[i] || {};
      var etiqueta = typeof entrada.etiqueta === 'string' ? entrada.etiqueta : '';
      var renglonesEntrada = Array.isArray(entrada.renglones) ? entrada.renglones : [];
      for (var j = 0; j < renglonesEntrada.length; j++) {
        var r = renglonesEntrada[j];
        if (!r || typeof r.codigo !== 'string' || r.codigo.trim() === '') {
          continue;
        }
        var unidad = typeof r.unidad === 'string' ? r.unidad : '';
        var clave = r.codigo + '|' + unidad;
        var fila = porClave[clave];
        if (!fila) {
          fila = {
            codigo: r.codigo,
            descripcion: descripcionDe(r),
            unidad: unidad,
            cantidad: 0,
            desglose: []
          };
          porClave[clave] = fila;
          claves.push(clave);
        }
        var cantidad = typeof r.cantidad === 'number' && isFinite(r.cantidad) ? r.cantidad : 0;
        fila.cantidad += cantidad;
        fila.desglose.push({ expediente: etiqueta, cantidad: cantidad });
      }
    }
    claves.sort(function (a, b) {
      if (porClave[a].codigo === porClave[b].codigo) {
        return porClave[a].unidad < porClave[b].unidad ? -1 :
          (porClave[a].unidad > porClave[b].unidad ? 1 : 0);
      }
      return porClave[a].codigo < porClave[b].codigo ? -1 : 1;
    });
    var salida = [];
    for (var k = 0; k < claves.length; k++) {
      salida.push(porClave[claves[k]]);
    }
    return salida;
  }

  SGC.core.consolidacion = {
    renglones: renglones
  };
})(typeof window !== 'undefined' ? window : globalThis);
