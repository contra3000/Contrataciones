/*
 * documento.js
 * ORDEN-RONDA-08 §2.1. Partes comunes de los documentos del circuito.
 *
 * Todas las plantillas de app/js/renders/ comparten: el escapado, la
 * normalización del expediente (modelo), el encabezado institucional, la
 * tabla de renglones con sus aclaraciones, el pie con el origen del
 * documento, la firma y los estilos. Acá viven esas partes; cada plantilla
 * aporta sólo sus secciones y se registra con {estado, id, nombre, titulo,
 * componer, montar}.
 *
 * - `componer(expediente)` produce HTML autocontenido (para el archivo que se
 *   guarda como entregable) y `montar(contenedor, expediente)` produce nodos
 *   DOM con textContent (para la página y la impresión): la app nunca asigna
 *   innerHTML (ADR-011).
 * - `paraEstado(idEstado)` devuelve la plantilla que produce el estado, o null
 *   si el estado no produce documento.
 * - `fijarTituloImpresion(titulo)` sobreescribe el título del encabezado de
 *   impresión (@page de app/css/impresion.css) con la hoja del documento que
 *   se está mostrando.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.renders) {
    throw new Error('documento.js requiere que namespaces.js se cargue primero');
  }

  function esc(valor) {
    var s = valor === null || valor === undefined ? '' : String(valor);
    return s.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Normaliza ambas formas de expediente (identificacion y campos) a un único
  // objeto con las partes que los documentos usan.
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
    var estadoActual = SGC.core.utils.idEstado(expediente);
    var estadoDef = null;
    for (var i = 0; i < SGC.core.config.ESTADOS.length; i++) {
      if (SGC.core.config.ESTADOS[i].id === estadoActual) {
        estadoDef = SGC.core.config.ESTADOS[i];
        break;
      }
    }

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
      fecha: datos.fechaCreacion || '',
      estadoActual: estadoActual || '—',
      estadoTitulo: estadoDef ? estadoDef.titulo : (estadoActual || '—'),
      catalogoVersion: datos.catalogoVersion === undefined || datos.catalogoVersion === null
        ? 'no registrada' : String(datos.catalogoVersion)
    };
  }

  function campo(nombre, valor) {
    return '<dt>' + esc(nombre) + '</dt><dd>' + esc(valor) + '</dd>';
  }

  // ---------------------------------------------------------------------------
  // HTML (para el archivo guardado como entregable)
  // ---------------------------------------------------------------------------
  // H16-4: los entregables adoptan el sistema de estilos directo, igual que el
  // generador de la UOC. Valores del paquete (tokens.json) escritos acá porque
  // el archivo guardado es autocontenido: un documento salido de la aplicación
  // y uno del generador se ven de la misma familia (crit. H16).
  var SERIF = "'IBM Plex Serif',Georgia,'Times New Roman',serif";
  var SANS = "'IBM Plex Sans','Helvetica Neue',Arial,sans-serif";
  var MONO = "'IBM Plex Mono','Consolas','Courier New',monospace";
  var ESTILOS = [
    'body{font-family:' + SERIF + ';margin:25mm 25mm 22mm 30mm;color:#111418;background:#FAF8F3;line-height:1.55;}',
    '.doc-membrete{font-family:' + SANS + ';text-align:center;text-transform:uppercase;color:#0E2748;letter-spacing:0.12em;}',
    '.doc-membrete .doc-l1{font-weight:700;font-size:11.5pt;letter-spacing:0.12em;}',
    '.doc-membrete .doc-l2,.doc-membrete .doc-l3{font-weight:500;font-size:10.5pt;letter-spacing:0.14em;}',
    'h1{font-size:18pt;font-weight:600;color:#111418;text-align:center;margin-top:10mm;}',
    '.doc-unidad{font-family:' + SANS + ';font-size:9pt;color:#5C6470;text-align:center;text-transform:uppercase;' +
      'letter-spacing:0.2em;border-bottom:1pt solid #0E2748;padding:2mm 0 3mm;}',
    'h2{font-family:' + SANS + ';font-size:11pt;font-weight:600;color:#0E2748;text-transform:uppercase;' +
      'letter-spacing:0.22em;margin-top:8mm;padding-bottom:1mm;border-bottom:1pt solid #0E2748;}',
    'table{border-collapse:collapse;width:100%;margin:4mm 0;}',
    'th{background:#0E2748;color:#FFFFFF;font-family:' + SANS + ';font-size:9pt;font-weight:600;' +
      'text-transform:uppercase;letter-spacing:0.1em;text-align:left;padding:2mm;}',
    'td{border-bottom:0.5pt solid #D6D8DC;padding:2mm;font-size:10pt;vertical-align:top;}',
    'tbody tr:nth-child(even){background:#F2EFE7;}',
    '.doc-renglones td:first-child{font-family:' + MONO + ';color:#0E2748;}',
    'dt{font-family:' + SANS + ';font-weight:600;font-size:9pt;color:#0E2748;text-transform:uppercase;' +
      'letter-spacing:0.1em;margin-top:3mm;}',
    'dd{margin:0 0 1mm 0;font-size:11pt;}',
    '.doc-operador{font-size:11pt;}',
    '.doc-fecha{font-size:9pt;color:#5C6470;}',
    '.doc-firma{margin-top:2cm;}',
    '.doc-firma-linea{border-bottom:1pt solid #111418;width:8cm;height:1.2cm;}',
    '.doc-pie{margin-top:2cm;font-size:9pt;border-top:0.5pt solid #D6D8DC;padding-top:2mm;' +
      'color:#5C6470;font-family:' + SANS + ';}'
  ].join('\n');

  // Membrete obligatorio del sistema (design-system.md §1): bloque de tres
  // líneas en versales, familia sans, tracking amplio. Sin escudo: el paquete
  // exige el archivo de imagen que la app no puede enlazar (ADR-018).
  function membreteHtml() {
    return '<p class="doc-membrete">' +
      '<span class="doc-l1">Fuerza Aérea Argentina</span><br>' +
      '<span class="doc-l2">VII Brigada Aérea</span><br>' +
      '<span class="doc-l3">División Contrataciones Moreno</span></p>';
  }

  function encabezadoHtml(m, tituloDocumento) {
    return membreteHtml() +
      '<h1>' + esc(tituloDocumento) + '</h1>' +
      '<p class="doc-unidad">Unidad solicitante: ' + esc(m.unidad) +
      ' — Expediente Nº ' + esc(m.numero) + '</p>';
  }

  function tablaRenglonesHtml(m) {
    var partes = [];
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
    return partes.join('\n');
  }

  function firmaHtml(m) {
    return '<h2>Operador solicitante</h2>' +
      '<p class="doc-operador">' + esc(m.operadorNombre) + ' — ' + esc(m.operadorEmail) + '</p>' +
      '<p class="doc-fecha">Fecha: ' + esc(m.fecha) + '</p>' +
      '<div class="doc-firma">' +
      '<p>Firma y aclaración</p>' +
      '<p class="doc-firma-linea"></p>' +
      '</div>';
  }

  // Leyendas obligatorias del pie (ADR-016 y ADR-023 §5). La segunda va en
  // el pie de cada entregable generado, en la pantalla del expediente y en el
  // resumen.md del export; el texto es el textual de la decisión.
  var LEYENDA_ADR016 = 'Documento generado por SGC, sin firmas digitales (ADR-016).';
  var LEYENDA_ADR023 = 'Este sistema genera documentos, registra tiempos y sigue el estado del trámite. No autoriza, no imputa y no adjudica: esos actos se perfeccionan con la firma de la autoridad competente, fuera de este sistema.';

  // Pie con el origen del documento: de qué expediente es, en qué estado se
  // generó y con qué versión del catálogo (ORDEN-RONDA-08 §2.1).
  function pieHtml(m) {
    return '<p class="doc-pie">Expediente ' + esc(m.id) + ' · Generado en el estado ' +
      esc(m.estadoTitulo) + ' · Catálogo ' + esc(m.catalogoVersion) +
      ' · ' + esc(LEYENDA_ADR016) + '</p>' +
      '<p class="doc-pie doc-pie-leyenda">' + esc(LEYENDA_ADR023) + '</p>';
  }

  // Documento HTML autocontenido: `secciones` es el arreglo de HTML de las
  // secciones propias de la plantilla (identificación, renglones, etc.).
  function documentoHtml(m, tituloDocumento, secciones) {
    var partes = [];
    partes.push('<!DOCTYPE html>');
    partes.push('<html lang="es">');
    partes.push('<head>');
    partes.push('<meta charset="utf-8">');
    partes.push('<title>' + esc(tituloDocumento) + ' ' + esc(m.numero) + '</title>');
    partes.push('<style>');
    partes.push(ESTILOS);
    partes.push('</style>');
    partes.push('</head>');
    partes.push('<body>');
    partes.push(encabezadoHtml(m, tituloDocumento));
    for (var i = 0; i < secciones.length; i++) {
      partes.push(secciones[i]);
    }
    partes.push(firmaHtml(m));
    partes.push(pieHtml(m));
    partes.push('</body>');
    partes.push('</html>');
    return partes.join('\n');
  }

  // ---------------------------------------------------------------------------
  // DOM (para la página y la vista de impresión): textContent, nunca innerHTML
  // ---------------------------------------------------------------------------
  function limpiar(contenedor) {
    while (contenedor.children.length > 0) {
      contenedor.removeChild(contenedor.children[0]);
    }
  }

  function nuevo(contenedor, tag, clase, texto) {
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

  function h2Dom(contenedor, texto) {
    return nuevo(contenedor, 'h2', null, texto);
  }

  function pDom(contenedor, clase, texto) {
    return nuevo(contenedor, 'p', clase, texto);
  }

  function dlDom(contenedor, pares) {
    var dl = nuevo(contenedor, 'dl', 'doc-datos');
    for (var i = 0; i < pares.length; i++) {
      var dt = document.createElement('dt');
      dt.textContent = pares[i][0];
      dl.appendChild(dt);
      var dd = document.createElement('dd');
      dd.textContent = pares[i][1] === null || pares[i][1] === undefined ? '—' : String(pares[i][1]);
      dl.appendChild(dd);
    }
    return dl;
  }

  function encabezadoDom(contenedor, m, tituloDocumento) {
    membreteDom(contenedor);
    nuevo(contenedor, 'h1', null, tituloDocumento);
    pDom(contenedor, 'doc-unidad', 'Unidad solicitante: ' + m.unidad + ' — Expediente Nº ' + m.numero);
  }

  function membreteDom(contenedor) {
    var p = nuevo(contenedor, 'p', 'doc-membrete');
    var lineas = ['Fuerza Aérea Argentina', 'VII Brigada Aérea', 'División Contrataciones Moreno'];
    for (var i = 0; i < lineas.length; i++) {
      var span = document.createElement('span');
      span.className = 'doc-l' + (i + 1);
      span.textContent = lineas[i];
      p.appendChild(span);
      if (i < lineas.length - 1) {
        var salto = document.createElement('br');
        p.appendChild(salto);
      }
    }
  }

  function tablaRenglonesDom(contenedor, m) {
    var tabla = nuevo(contenedor, 'table', 'doc-renglones');
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
  }

  function firmaDom(contenedor, m) {
    h2Dom(contenedor, 'Operador solicitante');
    pDom(contenedor, 'doc-operador', m.operadorNombre + ' — ' + m.operadorEmail);
    pDom(contenedor, 'doc-fecha', 'Fecha: ' + m.fecha);
    var firma = nuevo(contenedor, 'div', 'doc-firma');
    var pFirma = document.createElement('p');
    pFirma.textContent = 'Firma y aclaración';
    firma.appendChild(pFirma);
    var linea = document.createElement('p');
    linea.className = 'doc-firma-linea';
    firma.appendChild(linea);
  }

  function pieDom(contenedor, m) {
    pDom(contenedor, 'doc-pie', 'Expediente ' + m.id + ' · Generado en el estado ' +
      m.estadoTitulo + ' · Catálogo ' + m.catalogoVersion +
      ' · ' + LEYENDA_ADR016);
    pDom(contenedor, 'doc-pie doc-pie-leyenda', LEYENDA_ADR023);
  }

  // ---------------------------------------------------------------------------
  // Selección de plantilla por estado
  // ---------------------------------------------------------------------------
  function paraEstado(idEstado) {
    var renders = SGC.renders;
    for (var clave in renders) {
      if (Object.prototype.hasOwnProperty.call(renders, clave)) {
        var r = renders[clave];
        if (r && typeof r === 'object' && r.estado === idEstado &&
            typeof r.componer === 'function') {
          return r;
        }
      }
    }
    return null;
  }

  // Sobreescribe el título del @page de impresion.css con la hoja visible.
  function fijarTituloImpresion(tituloDocumento) {
    if (typeof document === 'undefined' || !document.head) {
      return;
    }
    var id = 'sgc-impresion-titulo';
    var estilo = document.getElementById(id);
    if (!estilo) {
      estilo = document.createElement('style');
      estilo.id = id;
      document.head.appendChild(estilo);
    }
    estilo.textContent = '@page{@top-center{content:"SGC — ' +
      String(tituloDocumento).replace(/"/g, '\\"') +
      '";font-family:' + SANS + ';font-size:9pt;color:#0E2748;}}';
  }

  SGC.renders.documento = {
    esc: esc,
    modelo: modelo,
    campo: campo,
    ESTILOS: ESTILOS,
    LEYENDA_ADR016: LEYENDA_ADR016,
    LEYENDA_ADR023: LEYENDA_ADR023,
    membreteHtml: membreteHtml,
    membreteDom: membreteDom,
    encabezadoHtml: encabezadoHtml,
    tablaRenglonesHtml: tablaRenglonesHtml,
    firmaHtml: firmaHtml,
    pieHtml: pieHtml,
    documentoHtml: documentoHtml,
    limpiar: limpiar,
    nuevo: nuevo,
    h2Dom: h2Dom,
    pDom: pDom,
    dlDom: dlDom,
    encabezadoDom: encabezadoDom,
    tablaRenglonesDom: tablaRenglonesDom,
    firmaDom: firmaDom,
    pieDom: pieDom,
    paraEstado: paraEstado,
    fijarTituloImpresion: fijarTituloImpresion
  };
})(typeof window !== 'undefined' ? window : globalThis);