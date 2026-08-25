/*
 * requerimiento.js
 * ORDEN-RONDA-09 §3.5 (ADR-022). La plantilla del requerimiento —una Solicitud
 * de Gastos— reemplaza a la Especificación Técnica genérica del ciclo 7 como
 * documento de la Fase 1. Reutiliza lo común de renders/documento.js.
 *
 * El id estable del entregable no cambia (ADR de la ronda 8: el id no cambia
 * aunque cambie el título impreso): la Fase 1 sigue siendo
 * 'especificacion-tecnica'; lo que se imprime es el requerimiento real.
 *
 * - El código de catálogo se descompone en IPP / Clase / Ítem (ADR-022 §1):
 *   '2.5.8-378.186' se imprime como '258 | 378 | 186'. Es partir la cadena.
 * - La tabla de renglones lleva el importe unitario (el promedio normalizado,
 *   ADR-022 §2) y el total del renglón.
 * - Total general en números y en letras ("LA SUMA DE: PESOS ... CON 00/100.-").
 * - Bloque de imputación presupuestaria, vacío o completo según el estado.
 * - Justificación de OCA y planilla de máximos, cuando la modalidad lo activa.
 * - Regla de desborde de la aclaración (ORDEN-RONDA-10 §3.2, H12): lo que
 *   supera MAX_ACLARACION no se imprime acá; la celda dice "según anexo X" y
 *   el texto completo va al anexo de EETT (core/anexo-eett.js +
 *   renders/anexo-eett.js).
 *
 * Dos salidas desde un único `modelo`: `componer` (HTML para el archivo que
 * se guarda) y `montar` (nodos DOM con textContent, nunca innerHTML, ADR-011).
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.renders) {
    throw new Error('requerimiento.js requiere que namespaces.js se cargue primero');
  }

  var d = SGC.renders.documento;
  var req = SGC.core.requerimiento;

  var TITULO = 'Solicitud de Gastos (Requerimiento)';

  var ENCABEZADOS_RENGLONES = [
    'N°', 'Código', 'IPP', 'Clase', 'Ítem', 'Descripción', 'U.M.', 'Cantidad',
    'Importe unitario (promedio)', 'Total', 'Aclaración'
  ];

  var ENCABEZADOS_OCA = [
    'N°', 'Código', 'Cantidad solicitada',
    'Cantidad máxima (por Solicitud de Provisión)', 'Cantidad mínima (opcional)'
  ];

  var CAUSAL_OCA =
    'La causal de la OCA está en el Art. 25 inc. c) del Decreto 1023/01 y en el ' +
    'Art. 111 del Decreto 1030/16: cuando no se pudiere prefijar con suficiente ' +
    'precisión la cantidad de unidades o las fechas o plazos de entrega.';

  function formatearMonto(n) {
    if (typeof n !== 'number' || !isFinite(n)) {
      return '—';
    }
    var texto = n.toFixed(2);
    var partes = texto.split('.');
    return partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + partes[1];
  }

  function modelo(expediente) {
    var base = d.modelo(expediente);
    var info = req.requerimientoDe(expediente);
    return {
      base: base,
      requerimiento: info.requerimiento,
      imputacion: info.imputacion,
      presupuestos: info.presupuestos,
      renglones: info.renglones.length > 0 ? info.renglones : base.renglones,
      // Nombres de anexo por posición de renglón (H12). Si core/anexo-eett.js
      // no está cargado, no hay referencias y la celda imprime el texto.
      referencias: SGC.core.anexoEett
        ? SGC.core.anexoEett.planificar(expediente).referencias
        : {}
    };
  }

  // Pares etiqueta/valor del encabezado: los campos del requerimiento con
  // respaldo en los datos básicos del expediente (lugar, unidad, vigencia).
  function paresEncabezado(m) {
    var rq = m.requerimiento;
    var pares = [['Expediente', m.base.id], ['Título', m.base.titulo]];
    var saltearVigencia = { vigenciaInicio: true, vigenciaFin: true };
    for (var i = 0; i < req.CAMPOS_ENCABEZADO.length; i++) {
      var c = req.CAMPOS_ENCABEZADO[i];
      if (saltearVigencia[c.clave]) {
        continue;
      }
      var valor = rq[c.clave];
      if ((valor === undefined || valor === null || valor === '') && c.clave === 'lugar') {
        valor = m.base.lugar;
      }
      if ((valor === undefined || valor === null || valor === '') && c.clave === 'unidadSolicitante') {
        valor = m.base.unidad;
      }
      if (valor !== undefined && valor !== null && valor !== '') {
        pares.push([c.etiqueta, valor]);
      }
    }
    if (rq.vigenciaInicio || rq.vigenciaFin) {
      pares.push(['Vigencia sugerida',
        [rq.vigenciaInicio, rq.vigenciaFin].filter(Boolean).join(' — ')]);
    } else if (m.base.vigencia) {
      pares.push(['Vigencia', m.base.vigencia]);
    }
    return pares;
  }

  function celdasDeRenglon(r, i, referencias) {
    var descomp = req.descomponerCodigo(r.codigo);
    var prev = req.preventivoRenglon(r);
    var aclaracion = r.aclaracion || '';
    if (SGC.core.anexoEett && SGC.core.anexoEett.desborda(r.aclaracion)) {
      aclaracion = SGC.core.anexoEett.aclaracionImpresa(r, referencias ? referencias[i] : null);
    }
    return [
      String(i + 1),
      r.codigo,
      descomp.ipp,
      descomp.clase,
      descomp.item,
      r.descripcion || r.item || '',
      r.unidad || '',
      r.cantidad === undefined || r.cantidad === null ? '' : String(r.cantidad),
      prev.promedio === null ? '—' : formatearMonto(prev.promedio),
      prev.preventivo === null ? '—' : formatearMonto(prev.preventivo),
      aclaracion
    ];
  }

  function celdasDeOca(r, i) {
    var minima = r.cantidadMinima !== undefined && r.cantidadMinima !== null
      ? String(r.cantidadMinima) : '';
    return [
      String(i + 1),
      r.codigo,
      r.cantidad === undefined || r.cantidad === null ? '' : String(r.cantidad),
      r.cantidadMaxima === undefined || r.cantidadMaxima === null ? '' : String(r.cantidadMaxima),
      minima
    ];
  }

  function celdasDeImputacion(fila) {
    var celdas = [];
    for (var i = 0; i < req.IMPUTACION_CAMPOS.length; i++) {
      var v = fila[req.IMPUTACION_CAMPOS[i]];
      celdas.push(v === undefined || v === null ? '' : String(v));
    }
    return celdas;
  }

  function tablaHtml(encabezados, filas) {
    var partes = ['<table class="doc-renglones"><thead><tr>'];
    for (var c = 0; c < encabezados.length; c++) {
      partes.push('<th>' + d.esc(encabezados[c]) + '</th>');
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

  function seccionesHtml(m) {
    var rq = m.requerimiento;
    var partes = [];

    partes.push('<h2>Identificación del requerimiento</h2>');
    partes.push('<dl class="doc-datos">');
    var pares = paresEncabezado(m);
    for (var i = 0; i < pares.length; i++) {
      partes.push(d.campo(pares[i][0], pares[i][1]));
    }
    partes.push('</dl>');

    partes.push('<h2>Renglones</h2>');
    partes.push(tablaHtml(ENCABEZADOS_RENGLONES,
      m.renglones.map(function (r, i) { return celdasDeRenglon(r, i, m.referencias); })));

    partes.push('<h2>Valor preventivo</h2>');
    var total = req.preventivoContratacion(m.renglones);
    if (total.valido && m.renglones.length > 0) {
      partes.push('<p class="doc-total">Total general: $ ' + formatearMonto(total.total) + '</p>');
      partes.push('<p class="doc-total-letras">' + d.esc(req.totalEnLetras(total.total)) + '</p>');
    } else {
      partes.push('<p class="doc-total">Sin valores de referencia: el promedio se carga contra los presupuestos adjuntos.</p>');
    }

    partes.push('<h2>Imputación presupuestaria</h2>');
    var filasImputacion = m.imputacion.length > 0
      ? m.imputacion.map(celdasDeImputacion)
      : [req.IMPUTACION_CAMPOS.map(function () { return '—'; })];
    partes.push(tablaHtml(req.IMPUTACION_CAMPOS, filasImputacion));
    if (m.imputacion.length === 0) {
      partes.push('<p class="doc-nota">Sin imputación: la completa Contaduría en la Afectación (paso 16).</p>');
    }

    if (req.ocaActiva(rq, m.renglones)) {
      partes.push('<h2>Orden de Compra Abierta</h2>');
      var justificacionOCA = rq.ocaJustificacion || rq.justificacionOCA || '';
      if (justificacionOCA) {
        partes.push('<p class="doc-justificacion"><strong>Justificación:</strong> ' +
          d.esc(justificacionOCA) + '</p>');
      }
      partes.push(tablaHtml(ENCABEZADOS_OCA, m.renglones.map(celdasDeOca)));
      partes.push('<p class="doc-nota">La cantidad máxima es el tope que se le puede requerir al proveedor en una sola Solicitud de Provisión (uso de la División, ADR-022 §3).</p>');
      partes.push('<p class="doc-nota">' + d.esc(CAUSAL_OCA) + '</p>');
    }

    return partes;
  }

  function componer(expediente) {
    var m = modelo(expediente);
    return d.documentoHtml(m.base, TITULO, seccionesHtml(m));
  }

  function tablaDom(contenedor, encabezados, filas) {
    var tabla = document.createElement('table');
    tabla.className = 'doc-renglones';
    var thead = document.createElement('thead');
    var filaH = document.createElement('tr');
    for (var c = 0; c < encabezados.length; c++) {
      var th = document.createElement('th');
      th.textContent = encabezados[c];
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

  function montar(contenedor, expediente) {
    if (!contenedor) {
      return;
    }
    d.limpiar(contenedor);
    var m = modelo(expediente);
    var rq = m.requerimiento;
    d.encabezadoDom(contenedor, m.base, TITULO);

    d.h2Dom(contenedor, 'Identificación del requerimiento');
    d.dlDom(contenedor, paresEncabezado(m));

    d.h2Dom(contenedor, 'Renglones');
    tablaDom(contenedor, ENCABEZADOS_RENGLONES,
      m.renglones.map(function (r, i) { return celdasDeRenglon(r, i, m.referencias); }));

    d.h2Dom(contenedor, 'Valor preventivo');
    var total = req.preventivoContratacion(m.renglones);
    if (total.valido && m.renglones.length > 0) {
      d.pDom(contenedor, 'doc-total', 'Total general: $ ' + formatearMonto(total.total));
      d.pDom(contenedor, 'doc-total-letras', req.totalEnLetras(total.total));
    } else {
      d.pDom(contenedor, 'doc-total',
        'Sin valores de referencia: el promedio se carga contra los presupuestos adjuntos.');
    }

    d.h2Dom(contenedor, 'Imputación presupuestaria');
    var filasImputacion = m.imputacion.length > 0
      ? m.imputacion.map(celdasDeImputacion)
      : [req.IMPUTACION_CAMPOS.map(function () { return '—'; })];
    tablaDom(contenedor, req.IMPUTACION_CAMPOS, filasImputacion);
    if (m.imputacion.length === 0) {
      d.pDom(contenedor, 'doc-nota',
        'Sin imputación: la completa Contaduría en la Afectación (paso 16).');
    }

    if (req.ocaActiva(rq, m.renglones)) {
      d.h2Dom(contenedor, 'Orden de Compra Abierta');
      var justificacionOCA = rq.ocaJustificacion || rq.justificacionOCA || '';
      if (justificacionOCA) {
        d.pDom(contenedor, 'doc-justificacion', 'Justificación: ' + justificacionOCA);
      }
      tablaDom(contenedor, ENCABEZADOS_OCA, m.renglones.map(celdasDeOca));
      d.pDom(contenedor, 'doc-nota',
        'La cantidad máxima es el tope que se le puede requerir al proveedor en una sola Solicitud de Provisión (uso de la División, ADR-022 §3).');
      d.pDom(contenedor, 'doc-nota', CAUSAL_OCA);
    }

    d.firmaDom(contenedor, m.base);
    d.pieDom(contenedor, m.base);
  }

  SGC.renders.requerimiento = {
    estado: 'ESPECIFICACIONES_TECNICAS',
    id: 'especificacion-tecnica',
    nombre: 'especificacion-tecnica.html',
    titulo: TITULO,
    modelo: modelo,
    componer: componer,
    montar: montar,
    esc: d.esc
  };
})(typeof window !== 'undefined' ? window : globalThis);