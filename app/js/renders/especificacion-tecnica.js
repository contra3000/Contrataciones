/*
 * especificacion-tecnica.js
 * ORDEN-RONDA-07 §3.1 (patrón del circuito) y ORDEN-RONDA-08 §2.1.
 * Compone el documento de la Especificación Técnica desde el expediente
 * (datos.json). HTML, no PDF: el PDF lo produce el navegador (ADR-012).
 *
 * Desde ORDEN-RONDA-09 (ADR-022) la Fase 1 del circuito imprime el
 * Requerimiento completo (Solicitud de Gastos, renders/requerimiento.js), que
 * es el documento que corresponde en la práctica al pedido de fondos. Esta
 * plantilla queda como base técnica del anexo de Especificaciones Técnicas del
 * pliego (H12, aún pendiente): por eso su `estado` es null y no compite con la
 * plantilla del requerimiento, que es la que `paraEstado` devuelve para
 * 'ESPECIFICACIONES_TECNICAS'. El acceso directo sigue funcionando
 * (renders.test.js y el resumen la usan por su nombre, no por estado).
 *
 * Dos salidas desde un único `modelo` (fuente única):
 *  - `componer(expediente)` -> string HTML escapado, para guardar el archivo
 *    en la carpeta del expediente (entregable, §3.3).
 *  - `montar(contenedor, expediente)` -> nodos DOM con textContent, para
 *    mostrarlo e imprimirlo desde la página (la app nunca asigna innerHTML).
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.renders) {
    throw new Error('especificacion-tecnica.js requiere que namespaces.js se cargue primero');
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
    return d.documentoHtml(m, 'Especificación Técnica', seccionesHtml(m));
  }

  function montar(contenedor, expediente) {
    if (!contenedor) {
      return;
    }
    d.limpiar(contenedor);
    var m = d.modelo(expediente);
    d.encabezadoDom(contenedor, m, 'Especificación Técnica');
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

  SGC.renders.especificacionTecnica = {
    estado: null,
    id: 'especificacion-tecnica',
    nombre: 'especificacion-tecnica.html',
    titulo: 'Especificación Técnica',
    modelo: d.modelo,
    componer: componer,
    montar: montar,
    esc: d.esc
  };
})(typeof window !== 'undefined' ? window : globalThis);