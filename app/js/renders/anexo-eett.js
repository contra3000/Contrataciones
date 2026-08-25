/*
 * anexo-eett.js (render)
 * ORDEN-RONDA-10 §3.2 (H12, ADR-022). Documento del anexo de Especificaciones
 * Técnicas: acá va COMPLETO el texto que desborda la celda Aclaración del
 * requerimiento, más las condiciones particulares comunes.
 *
 * La regla de desborde y la nomenclatura viven en core/anexo-eett.js; este
 * módulo sólo compone. Un documento por anexo: alfa, bravo... Cada uno lleva
 * las condiciones particulares (si las hay) y la ficha de su renglón con las
 * columnas Renglón N° | Código SIByS | Descripción ONC | Especificaciones
 * Técnicas. Si ningún renglón desborda y no hay condiciones, no se genera
 * nada (componerTodos devuelve []).
 *
 * El `estado` es null: no compite con la plantilla del requerimiento en
 * paraEstado(). Se registra con id 'anexo-eett' para que guardarEntregable lo
 * acepte; no es entregable obligatorio de ningún estado.
 *
 * Dos salidas desde un único modelo: `componer`/`componerTodos` (HTML para los
 * archivos guardados) y `montar` (nodos DOM con textContent, nunca innerHTML,
 * ADR-011).
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.renders) {
    throw new Error('anexo-eett.js requiere que namespaces.js se cargue primero');
  }

  var d = SGC.renders.documento;
  var ae = SGC.core.anexoEett;

  var TITULO_BASE = 'Anexo de Especificaciones Técnicas';

  var ENCABEZADOS_FICHA = [
    'Renglón N°', 'Código SIByS', 'Descripción ONC', 'Especificaciones Técnicas'
  ];

  function tituloDe(nombre) {
    return TITULO_BASE + ' — ' + nombre;
  }

  function celdasFicha(r, i) {
    return [
      String(i + 1),
      r.codigo || '',
      r.descripcion || r.item || '',
      typeof r.aclaracion === 'string' ? r.aclaracion : ''
    ];
  }

  function tablaHtml(filas) {
    var partes = ['<table class="doc-renglones"><thead><tr>'];
    for (var c = 0; c < ENCABEZADOS_FICHA.length; c++) {
      partes.push('<th>' + d.esc(ENCABEZADOS_FICHA[c]) + '</th>');
    }
    partes.push('</tr></thead><tbody>');
    for (var i = 0; i < filas.length; i++) {
      partes.push('<tr>');
      for (var j = 0; j < filas[i].length; j++) {
        partes.push('<td>' + d.esc(filas[i][j]) + '</td>');
      }
      partes.push('</tr>');
    }
    partes.push('</tbody></table>');
    return partes.join('\n');
  }

  function seccionesHtml(m, anexo) {
    var partes = [];
    if (m.condiciones) {
      partes.push('<h2>Condiciones particulares</h2>');
      partes.push('<p class="doc-justificacion">' + d.esc(m.condiciones) + '</p>');
    }
    if (anexo.indice !== null && anexo.indice !== undefined) {
      var r = m.renglones[anexo.indice];
      partes.push('<h2>Renglón ' + d.esc(String(anexo.indice + 1)) +
        ' — texto completo</h2>');
      partes.push(tablaHtml([celdasFicha(r, anexo.indice)]));
    }
    return partes;
  }

  // componer(expediente, nombre): el HTML autocontenido de UN anexo, el que
  // planificar() llamó `nombre`.
  function componer(expediente, nombre) {
    var plan = ae.planificar(expediente);
    var anexo = null;
    for (var i = 0; i < plan.anexos.length; i++) {
      if (plan.anexos[i].nombre === nombre) {
        anexo = plan.anexos[i];
      }
    }
    if (!anexo) {
      return '';
    }
    var base = d.modelo(expediente);
    var m = {
      base: base,
      renglones: base.renglones,
      condiciones: ae.condicionesParticulares(expediente)
    };
    return d.documentoHtml(base, tituloDe(nombre), seccionesHtml(m, anexo));
  }

  // componerTodos(expediente): [{nombre, archivo, html}] en orden. Sin
  // desbordes ni condiciones devuelve [], y entonces no se genera nada.
  function componerTodos(expediente) {
    var plan = ae.planificar(expediente);
    var salida = [];
    for (var i = 0; i < plan.anexos.length; i++) {
      var nombre = plan.anexos[i].nombre;
      salida.push({
        nombre: nombre,
        archivo: 'anexo-eett-' + nombre + '.html',
        html: componer(expediente, nombre)
      });
    }
    return salida;
  }

  function tablaDom(contenedor, filas) {
    var tabla = document.createElement('table');
    tabla.className = 'doc-renglones';
    var thead = document.createElement('thead');
    var filaH = document.createElement('tr');
    for (var c = 0; c < ENCABEZADOS_FICHA.length; c++) {
      var th = document.createElement('th');
      th.textContent = ENCABEZADOS_FICHA[c];
      filaH.appendChild(th);
    }
    thead.appendChild(filaH);
    tabla.appendChild(thead);
    var tbody = document.createElement('tbody');
    for (var i = 0; i < filas.length; i++) {
      var tr = document.createElement('tr');
      for (var j = 0; j < filas[i].length; j++) {
        var td = document.createElement('td');
        td.textContent = filas[i][j] === null || filas[i][j] === undefined
          ? '' : String(filas[i][j]);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    tabla.appendChild(tbody);
    contenedor.appendChild(tabla);
  }

  // montar(contenedor, expediente, nombre): vista previa de un anexo.
  function montar(contenedor, expediente, nombre) {
    if (!contenedor) {
      return;
    }
    d.limpiar(contenedor);
    var plan = ae.planificar(expediente);
    var anexo = null;
    for (var i = 0; i < plan.anexos.length; i++) {
      if (plan.anexos[i].nombre === nombre) {
        anexo = plan.anexos[i];
      }
    }
    if (!anexo) {
      return;
    }
    var base = d.modelo(expediente);
    var condiciones = ae.condicionesParticulares(expediente);
    d.encabezadoDom(contenedor, base, tituloDe(nombre));
    if (condiciones) {
      d.h2Dom(contenedor, 'Condiciones particulares');
      d.pDom(contenedor, 'doc-justificacion', condiciones);
    }
    if (anexo.indice !== null && anexo.indice !== undefined) {
      var r = base.renglones[anexo.indice];
      d.h2Dom(contenedor, 'Renglón ' + (anexo.indice + 1) + ' — texto completo');
      tablaDom(contenedor, [celdasFicha(r, anexo.indice)]);
    }
    d.firmaDom(contenedor, base);
    d.pieDom(contenedor, base);
  }

  SGC.renders.anexoEett = {
    estado: null,
    id: 'anexo-eett',
    nombre: 'anexo-eett.html',
    titulo: TITULO_BASE,
    componer: componer,
    componerTodos: componerTodos,
    montar: montar,
    esc: d.esc
  };
})(typeof window !== 'undefined' ? window : globalThis);
