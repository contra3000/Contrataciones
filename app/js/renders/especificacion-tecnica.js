/*
 * especificacion-tecnica.js
 * ORDEN-RONDA-07 §3.1. Compone el documento de la Especificación Técnica
 * desde el expediente (datos.json). HTML, no PDF: el PDF lo produce el
 * navegador (ADR-012).
 *
 * El documento incluye: encabezado con la unidad y el número de expediente,
 * identificación del requerimiento, la tabla de renglones con código,
 * cantidad, unidad y la aclaración cuando exista (si no se imprime, la
 * diferencia queda sólo en la base), la fundamentación, el operador
 * solicitante con su correo, la fecha y el espacio de firma.
 *
 * Dos salidas desde un único `modelo` (fuente única):
 *  - `componer(expediente)` -> string HTML escapado, para guardar el archivo
 *    en la carpeta del expediente (entregable, §3.3).
 *  - `montar(contenedor, expediente)` -> nodos DOM con textContent, para
 *    mostrarlo e imprimirlo desde la página (la app nunca asigna innerHTML).
 *
 * El escape cubre títulos y aclaraciones: son datos de usuario y el documento
 * es la superficie de inyección que revisa el auditor (§3.1).
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.renders) {
    throw new Error('especificacion-tecnica.js requiere que namespaces.js se cargue primero');
  }

  function esc(valor) {
    var s = valor === null || valor === undefined ? '' : String(valor);
    return s.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Normaliza ambas formas de expediente (identificacion y campos, según cómo
  // se haya creado) a un único objeto con las partes que el documento usa.
  function modelo(expediente) {
    var datos = (expediente && typeof expediente.datos === 'object' && expediente.datos) || expediente || {};
    var identificacion = (datos.identificacion && typeof datos.identificacion === 'object') ? datos.identificacion : {};
    var campos = (datos.campos && typeof datos.campos === 'object') ? datos.campos : {};
    var fundamentacion = (datos.fundamentacion && typeof datos.fundamentacion === 'object') ? datos.fundamentacion : {};
    var solicitante = (datos.solicitante && typeof datos.solicitante === 'object') ? datos.solicitante : {};
    var renglones = Array.isArray(datos.renglones) ? datos.renglones : [];

    var operadorEmail = campos.operador || identificacion.operador || solicitante.email || '';
    if (!operadorEmail && Array.isArray(datos.auditoria)) {
      var primera = datos.auditoria[0];
      if (primera && typeof primera.email === 'string') {
        operadorEmail = primera.email;
      }
    }
    var nombreSolicitante = [solicitante.nombre, solicitante.apellido]
      .filter(function (v) { return typeof v === 'string' && v.length > 0; })
      .join(' ') || operadorEmail || '—';

    return {
      id: expediente ? (expediente.expedienteId || expediente.id || '—') : '—',
      numero: datos.numero || identificacion.numero || '—',
      unidad: identificacion.unidadSolicitante || identificacion.dependenciaSolicitante ||
        campos.dependenciaSolicitante || '—',
      titulo: datos.titulo || '—',
      dependencia: identificacion.dependenciaSolicitante || campos.dependenciaSolicitante || '—',
      finalidad: identificacion.finalidad || '—',
      lugar: identificacion.lugar || '—',
      vigencia: identificacion.vigencia || datos.fechaLimite || '—',
      renglones: renglones,
      justificacion: fundamentacion.justificacion || campos.justificacion || '—',
      objetivo: fundamentacion.objetivo || campos.objetivo || '',
      operadorNombre: nombreSolicitante,
      operadorEmail: operadorEmail || '—',
      fecha: datos.fechaCreacion || ''
    };
  }

  function campo(nombre, valor) {
    return '<dt>' + esc(nombre) + '</dt><dd>' + esc(valor) + '</dd>';
  }

  // Documento HTML autocontenido (estilos en línea) para el archivo guardado.
  function componer(expediente) {
    var m = modelo(expediente);
    var partes = [];
    partes.push('<!DOCTYPE html>');
    partes.push('<html lang="es">');
    partes.push('<head>');
    partes.push('<meta charset="utf-8">');
    partes.push('<title>Especificación Técnica ' + esc(m.numero) + '</title>');
    partes.push('<style>');
    partes.push('body{font-family:Georgia,"Times New Roman",serif;margin:2cm;color:#000;background:#fff;}');
    partes.push('h1{font-size:20pt;text-align:center;}');
    partes.push('h2{font-size:13pt;margin-top:1.2cm;border-bottom:1px solid #000;padding-bottom:2mm;}');
    partes.push('table{border-collapse:collapse;width:100%;}');
    partes.push('th,td{border:1px solid #000;padding:2mm;font-size:10pt;vertical-align:top;}');
    partes.push('dt{font-weight:bold;margin-top:2mm;}');
    partes.push('dd{margin:0 0 1mm 0;}');
    partes.push('.doc-firma{margin-top:2cm;}');
    partes.push('.doc-firma-linea{border-bottom:1px solid #000;width:8cm;height:1.2cm;}');
    partes.push('</style>');
    partes.push('</head>');
    partes.push('<body>');
    partes.push('<h1>Especificación Técnica</h1>');
    partes.push('<p class="doc-unidad">Unidad solicitante: ' + esc(m.unidad) +
      ' — Expediente Nº ' + esc(m.numero) + '</p>');
    partes.push('<h2>Identificación del requerimiento</h2>');
    partes.push('<p class="doc-titulo">' + esc(m.titulo) + '</p>');
    partes.push('<dl class="doc-datos">');
    partes.push(campo('Expediente', m.id));
    partes.push(campo('Dependencia solicitante', m.dependencia));
    partes.push(campo('Finalidad', m.finalidad));
    partes.push(campo('Lugar de entrega', m.lugar));
    partes.push(campo('Vigencia', m.vigencia));
    partes.push('</dl>');
    partes.push('<h2>Renglones</h2>');
    partes.push('<table class="doc-renglones">');
    partes.push('<thead><tr><th>Código</th><th>Cantidad</th><th>Unidad</th><th>Aclaración</th></tr></thead>');
    partes.push('<tbody>');
    for (var i = 0; i < m.renglones.length; i++) {
      var r = m.renglones[i];
      partes.push('<tr><td>' + esc(r.codigo) + '</td><td>' + esc(r.cantidad) +
        '</td><td>' + esc(r.unidad) + '</td><td>' + esc(r.aclaracion || '') + '</td></tr>');
    }
    partes.push('</tbody>');
    partes.push('</table>');
    partes.push('<h2>Fundamentación</h2>');
    partes.push('<p class="doc-justificacion">' + esc(m.justificacion) + '</p>');
    if (m.objetivo) {
      partes.push('<p class="doc-objetivo"><strong>Objetivo:</strong> ' + esc(m.objetivo) + '</p>');
    }
    partes.push('<h2>Operador solicitante</h2>');
    partes.push('<p class="doc-operador">' + esc(m.operadorNombre) + ' — ' + esc(m.operadorEmail) + '</p>');
    partes.push('<p class="doc-fecha">Fecha: ' + esc(m.fecha) + '</p>');
    partes.push('<div class="doc-firma">');
    partes.push('<p>Firma y aclaración</p>');
    partes.push('<p class="doc-firma-linea"></p>');
    partes.push('</div>');
    partes.push('</body>');
    partes.push('</html>');
    return partes.join('\n');
  }

  // Misma estructura como nodos DOM (textContent, sin innerHTML) para la
  // página: muestra y vista de impresión.
  function montar(contenedor, expediente) {
    if (!contenedor) {
      return;
    }
    while (contenedor.children.length > 0) {
      contenedor.removeChild(contenedor.children[0]);
    }
    var m = modelo(expediente);

    function nuevo(tag, clase, texto) {
      var n = document.createElement(tag);
      if (clase) {
        n.className = clase;
      }
      if (texto !== undefined && texto !== null) {
        n.textContent = String(texto);
      }
      contenedor.appendChild(n);
      return n;
    }

    nuevo('h1', null, 'Especificación Técnica');
    nuevo('p', 'doc-unidad', 'Unidad solicitante: ' + m.unidad + ' — Expediente Nº ' + m.numero);
    nuevo('h2', null, 'Identificación del requerimiento');
    nuevo('p', 'doc-titulo', m.titulo);

    var dl = nuevo('dl', 'doc-datos');
    var pares = [
      ['Expediente', m.id],
      ['Dependencia solicitante', m.dependencia],
      ['Finalidad', m.finalidad],
      ['Lugar de entrega', m.lugar],
      ['Vigencia', m.vigencia]
    ];
    for (var i = 0; i < pares.length; i++) {
      var dt = document.createElement('dt');
      dt.textContent = pares[i][0];
      dl.appendChild(dt);
      var dd = document.createElement('dd');
      dd.textContent = pares[i][1];
      dl.appendChild(dd);
    }

    nuevo('h2', null, 'Renglones');
    var tabla = nuevo('table', 'doc-renglones');
    var thead = document.createElement('thead');
    var filaEncabezado = document.createElement('tr');
    var columnas = ['Código', 'Cantidad', 'Unidad', 'Aclaración'];
    for (var c = 0; c < columnas.length; c++) {
      var th = document.createElement('th');
      th.textContent = columnas[c];
      filaEncabezado.appendChild(th);
    }
    thead.appendChild(filaEncabezado);
    tabla.appendChild(thead);
    var tbody = document.createElement('tbody');
    for (var j = 0; j < m.renglones.length; j++) {
      var r = m.renglones[j];
      var tr = document.createElement('tr');
      var valores = [r.codigo, r.cantidad, r.unidad, r.aclaracion || ''];
      for (var k = 0; k < valores.length; k++) {
        var td = document.createElement('td');
        td.textContent = valores[k] === null || valores[k] === undefined ? '' : String(valores[k]);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    tabla.appendChild(tbody);

    nuevo('h2', null, 'Fundamentación');
    nuevo('p', 'doc-justificacion', m.justificacion);
    if (m.objetivo) {
      nuevo('p', 'doc-objetivo', 'Objetivo: ' + m.objetivo);
    }
    nuevo('h2', null, 'Operador solicitante');
    nuevo('p', 'doc-operador', m.operadorNombre + ' — ' + m.operadorEmail);
    nuevo('p', 'doc-fecha', 'Fecha: ' + m.fecha);
    var firma = nuevo('div', 'doc-firma');
    var pFirma = document.createElement('p');
    pFirma.textContent = 'Firma y aclaración';
    firma.appendChild(pFirma);
    var linea = document.createElement('p');
    linea.className = 'doc-firma-linea';
    firma.appendChild(linea);
  }

  SGC.renders.especificacionTecnica = {
    modelo: modelo,
    componer: componer,
    montar: montar,
    esc: esc
  };
})(typeof window !== 'undefined' ? window : globalThis);