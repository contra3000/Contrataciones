/*
 * orden-compra.js
 * ORDEN-RONDA-08 §2.1. Compone la Orden de Compra, el documento que produce
 * la Fase 9 (estado GENERACION_ORDEN_COMPRA). El proveedor se define en el
 * circuito de compras que queda fuera de este sistema (ADR-016): la orden
 * documenta objeto, renglones y condiciones de entrega. Las partes comunes
 * viven en renders/documento.js.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.renders) {
    throw new Error('orden-compra.js requiere que namespaces.js se cargue primero');
  }

  var d = SGC.renders.documento;

  function seccionesHtml(m) {
    var partes = [];
    partes.push('<h2>Identificación</h2>');
    partes.push('<dl class="doc-datos">');
    partes.push(d.campo('Expediente', m.id));
    partes.push(d.campo('Dependencia solicitante', m.dependencia));
    partes.push(d.campo('Finalidad', m.finalidad));
    partes.push('</dl>');
    partes.push('<h2>Objeto de la orden</h2>');
    partes.push('<p class="doc-titulo">' + d.esc(m.titulo) + '</p>');
    partes.push('<h2>Renglones del pedido</h2>');
    partes.push(d.tablaRenglonesHtml(m));
    partes.push('<h2>Condiciones de entrega</h2>');
    partes.push('<dl class="doc-datos">');
    partes.push(d.campo('Lugar de entrega', m.lugar));
    partes.push(d.campo('Vigencia', m.vigencia));
    partes.push('</dl>');
    partes.push('<p class="doc-parrafo">El proveedor y las condiciones ' +
      'comerciales constan en el circuito de firmas vigente (ADR-016).</p>');
    return partes;
  }

  function componer(expediente) {
    var m = d.modelo(expediente);
    return d.documentoHtml(m, 'Orden de Compra', seccionesHtml(m));
  }

  function montar(contenedor, expediente) {
    if (!contenedor) {
      return;
    }
    d.limpiar(contenedor);
    var m = d.modelo(expediente);
    d.encabezadoDom(contenedor, m, 'Orden de Compra');
    d.h2Dom(contenedor, 'Identificación');
    d.dlDom(contenedor, [
      ['Expediente', m.id],
      ['Dependencia solicitante', m.dependencia],
      ['Finalidad', m.finalidad]
    ]);
    d.h2Dom(contenedor, 'Objeto de la orden');
    d.pDom(contenedor, 'doc-titulo', m.titulo);
    d.h2Dom(contenedor, 'Renglones del pedido');
    d.tablaRenglonesDom(contenedor, m);
    d.h2Dom(contenedor, 'Condiciones de entrega');
    d.dlDom(contenedor, [
      ['Lugar de entrega', m.lugar],
      ['Vigencia', m.vigencia]
    ]);
    d.pDom(contenedor, 'doc-parrafo', 'El proveedor y las condiciones ' +
      'comerciales constan en el circuito de firmas vigente (ADR-016).');
    d.firmaDom(contenedor, m);
    d.pieDom(contenedor, m);
  }

  SGC.renders.ordenCompra = {
    estado: 'GENERACION_ORDEN_COMPRA',
    id: 'orden-compra',
    nombre: 'orden-compra.html',
    titulo: 'Orden de Compra',
    componer: componer,
    montar: montar
  };
})(typeof window !== 'undefined' ? window : globalThis);