/*
 * disposicion-adjudicacion.js
 * ORDEN-RONDA-08 §2.1. Compone la Disposición de Adjudicación, el documento
 * que produce la Fase 7 (estado FIRMA_DISPOSICION). Usa la forma breve de un
 * acto administrativo (Visto / Considerando / Artículos) armada desde los
 * datos del expediente; las partes comunes viven en renders/documento.js.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.renders) {
    throw new Error('disposicion-adjudicacion.js requiere que namespaces.js se cargue primero');
  }

  var d = SGC.renders.documento;

  function seccionesHtml(m) {
    var partes = [];
    partes.push('<h2>Visto</h2>');
    partes.push('<p class="doc-parrafo">El expediente Nº ' + d.esc(m.id) +
      ' de la dependencia solicitante ' + d.esc(m.dependencia) + '.</p>');
    partes.push('<h2>Considerando</h2>');
    partes.push('<p class="doc-parrafo">Que el objeto del requerimiento es ' +
      d.esc(m.titulo) + ', con la finalidad ' + d.esc(m.finalidad) + ', y que la ' +
      'evaluación del procedimiento de selección determinó la adjudicación ' +
      'según los renglones que se detallan.</p>');
    partes.push('<h2>Artículo 1° — Adjudicar</h2>');
    partes.push('<p class="doc-parrafo">Adjudicar el objeto del requerimiento ' +
      d.esc(m.titulo) + ' de acuerdo con los siguientes renglones:</p>');
    partes.push(d.tablaRenglonesHtml(m));
    partes.push('<h2>Artículo 2° — Condiciones</h2>');
    partes.push('<dl class="doc-datos">');
    partes.push(d.campo('Lugar de entrega', m.lugar));
    partes.push(d.campo('Plazo de ejecución / vigencia', m.vigencia));
    partes.push('</dl>');
    partes.push('<p class="doc-parrafo">Notifíquese, comuníquese y archívese.</p>');
    return partes;
  }

  function componer(expediente) {
    var m = d.modelo(expediente);
    return d.documentoHtml(m, 'Disposición de Adjudicación', seccionesHtml(m));
  }

  function montar(contenedor, expediente) {
    if (!contenedor) {
      return;
    }
    d.limpiar(contenedor);
    var m = d.modelo(expediente);
    d.encabezadoDom(contenedor, m, 'Disposición de Adjudicación');
    d.h2Dom(contenedor, 'Visto');
    d.pDom(contenedor, 'doc-parrafo', 'El expediente Nº ' + m.id +
      ' de la dependencia solicitante ' + m.dependencia + '.');
    d.h2Dom(contenedor, 'Considerando');
    d.pDom(contenedor, 'doc-parrafo', 'Que el objeto del requerimiento es ' +
      m.titulo + ', con la finalidad ' + m.finalidad + ', y que la evaluación ' +
      'del procedimiento de selección determinó la adjudicación según los ' +
      'renglones que se detallan.');
    d.h2Dom(contenedor, 'Artículo 1° — Adjudicar');
    d.pDom(contenedor, 'doc-parrafo', 'Adjudicar el objeto del requerimiento ' +
      m.titulo + ' de acuerdo con los siguientes renglones:');
    d.tablaRenglonesDom(contenedor, m);
    d.h2Dom(contenedor, 'Artículo 2° — Condiciones');
    d.dlDom(contenedor, [
      ['Lugar de entrega', m.lugar],
      ['Plazo de ejecución / vigencia', m.vigencia]
    ]);
    d.pDom(contenedor, 'doc-parrafo', 'Notifíquese, comuníquese y archívese.');
    d.firmaDom(contenedor, m);
    d.pieDom(contenedor, m);
  }

  SGC.renders.disposicionAdjudicacion = {
    estado: 'FIRMA_DISPOSICION',
    id: 'disposicion-adjudicacion',
    nombre: 'disposicion-adjudicacion.html',
    titulo: 'Disposición de Adjudicación',
    componer: componer,
    montar: montar
  };
})(typeof window !== 'undefined' ? window : globalThis);