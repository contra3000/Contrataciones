/*
 * resumen.js
 * ORDEN-RONDA-07 §3.4. Compone `resumen.md`: un relato en prosa de los hitos
 * del expediente, armado desde la auditoría (ADR-006), en orden cronológico y
 * en español legible — quién hizo qué, cuándo y desde qué equipo.
 *
 * Declara explícitamente ADR-016: los instrumentos firmados (pliego,
 * disposición, orden de compra) se firman fuera de este sistema y aquí sólo
 * se referencian. Sin esa línea, un modelo que lea el export concluiría que
 * el expediente está incompleto o adulterado.
 *
 * El histórico de versiones del servidor no se expone al cliente por diseño
 * (ADR-005/ADR-010), y la auditoría es el registro cronológico autoritativo:
 * el resumen se compone desde ella.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.renders) {
    throw new Error('resumen.js requiere que namespaces.js se cargue primero');
  }

  function escaparMd(valor) {
    return String(valor === null || valor === undefined ? '' : valor)
      .replace(/\\/g, '\\\\')
      .replace(/\|/g, '\\|');
  }

  function fechaLegible(iso) {
    if (typeof iso !== 'string' || iso.length === 0) {
      return 'fecha no registrada';
    }
    return iso.replace('T', ' a las ').replace(/\.\d{3}Z?$/, ' UTC');
  }

  function accionLegible(accion) {
    if (accion === 'crearExpediente') {
      return 'creó el expediente';
    }
    if (accion === 'avanzar') {
      return 'avanzó el expediente';
    }
    if (accion === 'devolver') {
      return 'devolvió el expediente por observación';
    }
    if (accion === 'archivar') {
      return 'archivó el expediente en el Archivo Histórico';
    }
    return accion;
  }

  function definirEstado(idEstado) {
    var estados = SGC.core.config.ESTADOS;
    for (var i = 0; i < estados.length; i++) {
      if (estados[i].id === idEstado) {
        return estados[i];
      }
    }
    return null;
  }

  function estadoLegible(idEstado) {
    var def = definirEstado(idEstado);
    return def ? def.titulo : (idEstado || '—');
  }

  function motivoDe(idMotivo) {
    var motivos = SGC.core.config.MOTIVOS_DEVOLUCION;
    for (var i = 0; i < motivos.length; i++) {
      if (motivos[i].id === idMotivo) {
        return motivos[i].texto;
      }
    }
    return null;
  }

  function componer(expediente) {
    var modelo = SGC.renders.especificacionTecnica.modelo(expediente);
    var idEstado = SGC.core.utils.idEstado(expediente);
    var lista = Array.isArray(expediente.auditoria) ? expediente.auditoria : [];

    var lineas = [];
    lineas.push('# Resumen del expediente ' + expediente.expedienteId);
    lineas.push('');
    lineas.push('- Título: ' + escaparMd(modelo.titulo));
    lineas.push('- Estado actual: ' + estadoLegible(idEstado));
    lineas.push('- Unidad solicitante: ' + escaparMd(modelo.unidad));
    lineas.push('- Operador solicitante: ' + escaparMd(modelo.operadorNombre) +
      ' (' + escaparMd(modelo.operadorEmail) + ')');
    lineas.push('- Renglones del pedido: ' + modelo.renglones.length);
    lineas.push('');
    lineas.push('## Hitos');
    lineas.push('');

    for (var i = 0; i < lista.length; i++) {
      var entrada = lista[i];
      var partes = ['- **' + fechaLegible(entrada.timestamp) + '** — ' + accionLegible(entrada.accion)];
      if (entrada.de !== null && entrada.de !== undefined && entrada.a !== null && entrada.a !== undefined) {
        partes.push(' de ' + estadoLegible(entrada.de) + ' a ' + estadoLegible(entrada.a));
      }
      var quien = (entrada.email || 'operador no registrado') +
        ' (rol ' + (entrada.rol || '—') + ') desde ' + (entrada.equipo || '—');
      partes.push(' por ' + quien);
      var motivo = motivoDe(entrada.motivo);
      if (motivo) {
        partes.push('. Motivo: ' + escaparMd(motivo));
      }
      if (entrada.observacion) {
        partes.push('. Observación: ' + escaparMd(entrada.observacion));
      }
      lineas.push(partes.join(''));
    }

    lineas.push('');
    lineas.push('## Instrumentos firmados');
    lineas.push('');
    lineas.push('> **ADR-016**: los instrumentos firmados de este circuito ' +
      '(pliego y especificaciones, disposición de autorización, orden de ' +
      'compra y demás) se firman fuera de este sistema, en el circuito de ' +
      'firmas vigente. Este sistema guarda y referencia el documento generado ' +
      'de la Especificación Técnica, no la versión firmada; por lo tanto, ' +
      'la ausencia de firmas dentro del expediente digital no es una omisión.');
    lineas.push('');
    return lineas.join('\n');
  }

  SGC.renders.resumen = { componer: componer };
})(typeof window !== 'undefined' ? window : globalThis);