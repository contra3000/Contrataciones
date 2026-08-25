/*
 * anexo-1.js
 * ORDEN-RONDA-11 §3.4. Plantilla impresa del ANEXO 1, el documento que
 * produce el estado ANALISIS_SCo. Las catorce secciones del análisis de
 * Abastecimiento; las 9 a 12 son condicionales y sólo se imprimen cuando
 * corresponden al tipo de contratación.
 *
 * Reutiliza renders/documento.js (ADR-029: carga encabezada en index.html).
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.renders) {
    throw new Error('anexo-1.js requiere que namespaces.js se cargue primero');
  }

  var d = SGC.renders.documento;

  function texto(v) {
    return typeof v === 'string' ? v : '';
  }

  function seccionesHtml(a) {
    var partes = [];
    partes.push('<dl class="doc-datos">');
    partes.push(d.campo('Expediente', a.expediente));
    partes.push(d.campo('Título', a.titulo));
    partes.push('</dl>');

    partes.push('<h2>§1 Objeto y justificación</h2>');
    partes.push('<p>' + d.esc(a.objeto) + '</p>');
    if (a.justificacion) {
      partes.push('<p><em>Justificación:</em> ' + d.esc(a.justificacion) + '</p>');
    }

    partes.push('<h2>§2 Precio de referencia</h2>');
    if (Array.isArray(a.empresasConsultadas) && a.empresasConsultadas.length > 0) {
      partes.push('<ul>');
      for (var i = 0; i < a.empresasConsultadas.length; i++) {
        partes.push('<li>' + d.esc(a.empresasConsultadas[i]) + '</li>');
      }
      partes.push('</ul>');
    }
    if (a.precioReferencia) {
      partes.push('<p><em>Valor preventivo:</em> ' + d.esc(a.precioReferencia) + '</p>');
    }
    if (a.monedaExtranjera) {
      partes.push('<h2>§2.1 Justificación de moneda extranjera</h2>');
      partes.push('<p>' + d.esc(a.monedaExtranjera) + '</p>');
    }

    partes.push('<h2>§3 PAC</h2>');
    partes.push('<p>Previsto: ' + d.esc(a.pacPrevisto || 'No') + '</p>');
    if (a.pacNumeroOrden) {
      partes.push('<p>N° de orden: ' + d.esc(a.pacNumeroOrden) + '</p>');
    }
    if (a.pacTrimestre) {
      partes.push('<p>Trimestre de ejecución: ' + d.esc(a.pacTrimestre) + '</p>');
    }

    partes.push('<h2>§4 Unidad requirente</h2>');
    partes.push('<dl class="doc-datos">');
    partes.push(d.campo('Responsable', a.unidadResponsable));
    partes.push(d.campo('Usuario GDE', a.usuarioGde));
    partes.push(d.campo('Dirección', a.unidadDireccion));
    partes.push(d.campo('Teléfono', a.unidadTelefono));
    partes.push(d.campo('Correo', a.unidadCorreo));
    partes.push(d.campo('Lugar de entrega', a.lugarEntrega));
    partes.push(d.campo('Lugar de facturación', a.lugarFacturacion));
    partes.push('</dl>');

    partes.push('<h2>§5 Comisión de recepción</h2>');
    if (a.comisionRecepcion) {
      partes.push('<p>' + d.esc(a.comisionRecepcion) + '</p>');
    }

    partes.push('<h2>§6 Personal técnico</h2>');
    if (a.personalTecnico) {
      partes.push('<p>' + d.esc(a.personalTecnico) + '</p>');
    }

    partes.push('<h2>§7 Requisitos mínimos</h2>');
    if (a.requisitosMinimos) {
      partes.push('<p>' + d.esc(a.requisitosMinimos) + '</p>');
    }

    if (a.visitaMuestra) {
      partes.push('<h2>§8 Visita o muestra patrón</h2>');
      partes.push('<p>' + d.esc(a.visitaMuestra) + '</p>');
    }

    if (a.interadministrativa) {
      partes.push('<h2>§9 Caso interadministrativo</h2>');
      partes.push('<p>' + d.esc(a.interadministrativa) + '</p>');
    }
    if (a.bienesUso) {
      partes.push('<h2>§10 Bienes de uso</h2>');
      partes.push('<p>' + d.esc(a.bienesUso) + '</p>');
    }
    if (a.hardwareSoftware) {
      partes.push('<h2>§11 Hardware / Software</h2>');
      partes.push('<p>' + d.esc(a.hardwareSoftware) + '</p>');
    }
    if (a.reparacionesInfra) {
      partes.push('<h2>§12 Reparaciones de infraestructura</h2>');
      partes.push('<p>' + d.esc(a.reparacionesInfra) + '</p>');
    }

    partes.push('<h2>§13 Documentación obligatoria</h2>');
    if (a.documentacionObligatoria) {
      partes.push('<p>' + d.esc(a.documentacionObligatoria) + '</p>');
    }

    partes.push('<h2>§14 Criterio de evaluación</h2>');
    if (a.criterioEvaluacion) {
      partes.push('<p>' + d.esc(a.criterioEvaluacion) + '</p>');
    }

    return partes;
  }

  function modelo(expediente) {
    var datos = (expediente && typeof expediente.datos === 'object' && expediente.datos) ||
      expediente || {};
    var a = (datos.anexo1 && typeof datos.anexo1 === 'object') ? datos.anexo1 : {};
    var identificacion = (datos.identificacion && typeof datos.identificacion === 'object') ?
      datos.identificacion : {};
    return {
      expediente: expediente && expediente.expedienteId || identificacion.numero || '',
      titulo: a.titulo || datos.titulo || '',
      objeto: a.objeto || datos.titulo || '',
      justificacion: a.justificacion || '',
      empresasConsultadas: a.empresasConsultadas || [],
      precioReferencia: a.precioReferencia || '',
      monedaExtranjera: a.monedaExtranjera || '',
      pacPrevisto: a.pacPrevisto || 'No',
      pacNumeroOrden: a.pacNumeroOrden || '',
      pacTrimestre: a.pacTrimestre || '',
      unidadResponsable: a.unidadResponsable || '',
      usuarioGde: a.usuarioGde || '',
      unidadDireccion: a.unidadDireccion || '',
      unidadTelefono: a.unidadTelefono || '',
      unidadCorreo: a.unidadCorreo || '',
      lugarEntrega: a.lugarEntrega || '',
      lugarFacturacion: a.lugarFacturacion || '',
      comisionRecepcion: a.comisionRecepcion || '',
      personalTecnico: a.personalTecnico || '',
      requisitosMinimos: a.requisitosMinimos || '',
      visitaMuestra: a.visitaMuestra || '',
      interadministrativa: a.interadministrativa || '',
      bienesUso: a.bienesUso || '',
      hardwareSoftware: a.hardwareSoftware || '',
      reparacionesInfra: a.reparacionesInfra || '',
      documentacionObligatoria: a.documentacionObligatoria || '',
      criterioEvaluacion: a.criterioEvaluacion || ''
    };
  }

  function componer(expediente) {
    var m = modelo(expediente);
    return d.documentoHtml(m, 'ANEXO 1', seccionesHtml(m));
  }

  function montar(contenedor, expediente) {
    if (!contenedor) {
      return;
    }
    d.limpiar(contenedor);
    var m = modelo(expediente);
    d.encabezadoDom(contenedor, m, 'ANEXO 1');
    d.dlDom(contenedor, [
      ['Expediente', m.expediente],
      ['Título', m.titulo]
    ]);
    d.h2Dom(contenedor, '§1 Objeto y justificación');
    d.pDom(contenedor, '', m.objeto);
    if (m.justificacion) {
      d.pDom(contenedor, '', 'Justificación: ' + m.justificacion);
    }
    d.h2Dom(contenedor, '§2 Precio de referencia');
    if (Array.isArray(m.empresasConsultadas) && m.empresasConsultadas.length > 0) {
      var ul = document.createElement('ul');
      for (var i = 0; i < m.empresasConsultadas.length; i++) {
        var li = document.createElement('li');
        li.textContent = m.empresasConsultadas[i];
        ul.appendChild(li);
      }
      contenedor.appendChild(ul);
    }
    if (m.precioReferencia) {
      d.pDom(contenedor, '', 'Valor preventivo: ' + m.precioReferencia);
    }
    if (m.monedaExtranjera) {
      d.h2Dom(contenedor, '§2.1 Justificación de moneda extranjera');
      d.pDom(contenedor, '', m.monedaExtranjera);
    }
    d.h2Dom(contenedor, '§3 PAC');
    d.pDom(contenedor, '', 'Previsto: ' + m.pacPrevisto);
    if (m.pacNumeroOrden) {
      d.pDom(contenedor, '', 'N° de orden: ' + m.pacNumeroOrden);
    }
    if (m.pacTrimestre) {
      d.pDom(contenedor, '', 'Trimestre de ejecución: ' + m.pacTrimestre);
    }
    d.h2Dom(contenedor, '§4 Unidad requirente');
    d.dlDom(contenedor, [
      ['Responsable', m.unidadResponsable],
      ['Usuario GDE', m.usuarioGde],
      ['Dirección', m.unidadDireccion],
      ['Teléfono', m.unidadTelefono],
      ['Correo', m.unidadCorreo],
      ['Lugar de entrega', m.lugarEntrega],
      ['Lugar de facturación', m.lugarFacturacion]
    ]);
    d.h2Dom(contenedor, '§5 Comisión de recepción');
    if (m.comisionRecepcion) { d.pDom(contenedor, '', m.comisionRecepcion); }
    d.h2Dom(contenedor, '§6 Personal técnico');
    if (m.personalTecnico) { d.pDom(contenedor, '', m.personalTecnico); }
    d.h2Dom(contenedor, '§7 Requisitos mínimos');
    if (m.requisitosMinimos) { d.pDom(contenedor, '', m.requisitosMinimos); }
    if (m.visitaMuestra) {
      d.h2Dom(contenedor, '§8 Visita o muestra patrón');
      d.pDom(contenedor, '', m.visitaMuestra);
    }
    if (m.interadministrativa) {
      d.h2Dom(contenedor, '§9 Caso interadministrativo');
      d.pDom(contenedor, '', m.interadministrativa);
    }
    if (m.bienesUso) {
      d.h2Dom(contenedor, '§10 Bienes de uso');
      d.pDom(contenedor, '', m.bienesUso);
    }
    if (m.hardwareSoftware) {
      d.h2Dom(contenedor, '§11 Hardware / Software');
      d.pDom(contenedor, '', m.hardwareSoftware);
    }
    if (m.reparacionesInfra) {
      d.h2Dom(contenedor, '§12 Reparaciones de infraestructura');
      d.pDom(contenedor, '', m.reparacionesInfra);
    }
    d.h2Dom(contenedor, '§13 Documentación obligatoria');
    if (m.documentacionObligatoria) { d.pDom(contenedor, '', m.documentacionObligatoria); }
    d.h2Dom(contenedor, '§14 Criterio de evaluación');
    if (m.criterioEvaluacion) { d.pDom(contenedor, '', m.criterioEvaluacion); }
    d.firmaDom(contenedor, m);
    d.pieDom(contenedor, m);
  }

  SGC.renders.anexoUno = {
    estado: 'ANALISIS_SCo',
    id: 'anexo-1',
    nombre: 'anexo-1.html',
    titulo: 'ANEXO 1',
    componer: componer,
    montar: montar,
    modelo: modelo
  };
})(typeof window !== 'undefined' ? window : globalThis);
