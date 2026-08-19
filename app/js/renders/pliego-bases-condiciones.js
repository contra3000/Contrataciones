/*
 * pliego-bases-condiciones.js
 * ORDEN-RONDA-08 §2.1. Compone el Pliego de Bases y Condiciones, el documento
 * que produce la Fase 5 (estado FIRMAS_PLIEGO_DISPOSICION). Las cláusulas
 * propias del pliego se arman desde los datos del expediente (objeto, lugar,
 * vigencia y renglones); las partes comunes viven en renders/documento.js.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.renders) {
    throw new Error('pliego-bases-condiciones.js requiere que namespaces.js se cargue primero');
  }

  var d = SGC.renders.documento;

  function seccionesHtml(m) {
    var partes = [];
    partes.push('<h2>Objeto del pliego</h2>');
    partes.push('<p class="doc-titulo">' + d.esc(m.titulo) + '</p>');
    partes.push('<dl class="doc-datos">');
    partes.push(d.campo('Expediente', m.id));
    partes.push(d.campo('Dependencia solicitante', m.dependencia));
    partes.push(d.campo('Finalidad', m.finalidad));
    partes.push('</dl>');
    partes.push('<h2>Condiciones de presentación</h2>');
    partes.push('<dl class="doc-datos">');
    partes.push(d.campo('Lugar de entrega', m.lugar));
    partes.push(d.campo('Vigencia de la oferta', m.vigencia));
    partes.push(d.campo('Renglones ofertados', String(m.renglones.length)));
    partes.push('</dl>');
    partes.push('<h2>Renglones</h2>');
    partes.push(d.tablaRenglonesHtml(m));
    return partes;
  }

  function componer(expediente) {
    var m = d.modelo(expediente);
    return d.documentoHtml(m, 'Pliego de Bases y Condiciones', seccionesHtml(m));
  }

  function montar(contenedor, expediente) {
    if (!contenedor) {
      return;
    }
    d.limpiar(contenedor);
    var m = d.modelo(expediente);
    d.encabezadoDom(contenedor, m, 'Pliego de Bases y Condiciones');
    d.h2Dom(contenedor, 'Objeto del pliego');
    d.pDom(contenedor, 'doc-titulo', m.titulo);
    d.dlDom(contenedor, [
      ['Expediente', m.id],
      ['Dependencia solicitante', m.dependencia],
      ['Finalidad', m.finalidad]
    ]);
    d.h2Dom(contenedor, 'Condiciones de presentación');
    d.dlDom(contenedor, [
      ['Lugar de entrega', m.lugar],
      ['Vigencia de la oferta', m.vigencia],
      ['Renglones ofertados', String(m.renglones.length)]
    ]);
    d.h2Dom(contenedor, 'Renglones');
    d.tablaRenglonesDom(contenedor, m);
    d.firmaDom(contenedor, m);
    d.pieDom(contenedor, m);
  }

  SGC.renders.pliegoBasesCondiciones = {
    estado: 'FIRMAS_PLIEGO_DISPOSICION',
    id: 'pliego-bases-condiciones',
    nombre: 'pliego-bases-condiciones.html',
    titulo: 'Pliego de Bases y Condiciones',
    componer: componer,
    montar: montar
  };
})(typeof window !== 'undefined' ? window : globalThis);