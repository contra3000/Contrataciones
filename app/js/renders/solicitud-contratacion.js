/*
 * solicitud-contratacion.js
 * ORDEN-RONDA-08 §2.1. Compone la Solicitud de Contratación (SCo), el
 * documento que produce la Fase 2 (estado SOLICITUD_CONTRATACION). La
 * estructura es la de la Especificación Técnica (el patrón del circuito) y
 * reutiliza las partes comunes de renders/documento.js.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.renders) {
    throw new Error('solicitud-contratacion.js requiere que namespaces.js se cargue primero');
  }

  var d = SGC.renders.documento;

  function seccionesHtml(m) {
    var partes = [];
    partes.push('<h2>Identificación del requerimiento</h2>');
    partes.push('<p class="doc-titulo">' + d.esc(m.titulo) + '</p>');
    partes.push('<dl class="doc-datos">');
    partes.push(d.campo('Expediente', m.id));
    partes.push(d.campo('Dependencia solicitante', m.dependencia));
    partes.push(d.campo('Finalidad', m.finalidad));
    partes.push(d.campo('Lugar de entrega', m.lugar));
    partes.push(d.campo('Vigencia', m.vigencia));
    partes.push('</dl>');
    partes.push('<h2>Renglones</h2>');
    partes.push(d.tablaRenglonesHtml(m));
    partes.push('<h2>Fundamentación</h2>');
    partes.push('<p class="doc-justificacion">' + d.esc(m.justificacion) + '</p>');
    if (m.objetivo) {
      partes.push('<p class="doc-objetivo"><strong>Objetivo:</strong> ' + d.esc(m.objetivo) + '</p>');
    }
    return partes;
  }

  function componer(expediente) {
    var m = d.modelo(expediente);
    return d.documentoHtml(m, 'Solicitud de Contratación (SCo)', seccionesHtml(m));
  }

  function montar(contenedor, expediente) {
    if (!contenedor) {
      return;
    }
    d.limpiar(contenedor);
    var m = d.modelo(expediente);
    d.encabezadoDom(contenedor, m, 'Solicitud de Contratación (SCo)');
    d.h2Dom(contenedor, 'Identificación del requerimiento');
    d.pDom(contenedor, 'doc-titulo', m.titulo);
    d.dlDom(contenedor, [
      ['Expediente', m.id],
      ['Dependencia solicitante', m.dependencia],
      ['Finalidad', m.finalidad],
      ['Lugar de entrega', m.lugar],
      ['Vigencia', m.vigencia]
    ]);
    d.h2Dom(contenedor, 'Renglones');
    d.tablaRenglonesDom(contenedor, m);
    d.h2Dom(contenedor, 'Fundamentación');
    d.pDom(contenedor, 'doc-justificacion', m.justificacion);
    if (m.objetivo) {
      d.pDom(contenedor, 'doc-objetivo', 'Objetivo: ' + m.objetivo);
    }
    d.firmaDom(contenedor, m);
    d.pieDom(contenedor, m);
  }

  SGC.renders.solicitudContratacion = {
    estado: 'SOLICITUD_CONTRATACION',
    id: 'solicitud-contratacion',
    nombre: 'solicitud-contratacion.html',
    titulo: 'Solicitud de Contratación (SCo)',
    componer: componer,
    montar: montar
  };
})(typeof window !== 'undefined' ? window : globalThis);