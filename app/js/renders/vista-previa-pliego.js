/*
 * vista-previa-pliego.js
 * ADR-030 (ORDEN-RONDA-12 §2.2). Antes pliego-bases-condiciones.js: la
 * plantilla propia del ciclo 7 que imprime un documento que NO es el pliego.
 * Convertida en vista previa, sin estado asignado, sin pie de firma y
 * rotulada arriba de todo "Vista previa — no es el Pliego de Bases y
 * Condiciones".
 *
 * El pliego real lo produce el generador de la UOC con nuestro YAML.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.renders) {
    throw new Error('vista-previa-pliego.js requiere que namespaces.js se cargue primero');
  }

  var d = SGC.renders.documento;
  var MENSAJE_VISTA_PREVIA = 'Vista previa — no es el Pliego de Bases y Condiciones';

  function seccionesHtml(m) {
    var partes = [];
    partes.push('<div class="doc-banner-advertencia">' + d.esc(MENSAJE_VISTA_PREVIA) + '</div>');
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
    var partes = [];
    partes.push('<!DOCTYPE html>');
    partes.push('<html lang="es">');
    partes.push('<head>');
    partes.push('<meta charset="utf-8">');
    partes.push('<title>' + d.esc(MENSAJE_VISTA_PREVIA) + '</title>');
    partes.push('<style>');
    partes.push(d.ESTILOS);
    partes.push('</style>');
    partes.push('</head>');
    partes.push('<body>');
    partes.push(d.encabezadoHtml(m, MENSAJE_VISTA_PREVIA));
    var secciones = seccionesHtml(m);
    for (var i = 0; i < secciones.length; i++) {
      partes.push(secciones[i]);
    }
    // ADR-030: sin firmaHtml ni pieHtml — documento que no se firma.
    partes.push('</body>');
    partes.push('</html>');
    return partes.join('\n');
  }

  function montar(contenedor, expediente) {
    if (!contenedor) {
      return;
    }
    d.limpiar(contenedor);
    var m = d.modelo(expediente);
    d.encabezadoDom(contenedor, m, MENSAJE_VISTA_PREVIA);
    var banner = document.createElement('div');
    banner.className = 'doc-banner-advertencia';
    banner.textContent = MENSAJE_VISTA_PREVIA;
    contenedor.appendChild(banner);
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
    // ADR-030: sin firmaDom ni pieDom — un documento que no se firma no lleva
    // pie de firma ni leyenda de ADR-023.
  }

  SGC.renders.vistaPreviaPliego = {
    id: 'vista-previa-pliego',
    nombre: 'vista-previa-pliego.html',
    titulo: MENSAJE_VISTA_PREVIA,
    componer: componer,
    montar: montar
  };
})(typeof window !== 'undefined' ? window : globalThis);
