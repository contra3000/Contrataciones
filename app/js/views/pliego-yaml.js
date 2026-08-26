/*
 * pliego-yaml.js (vista)
 * ORDEN-RONDA-11 §3.3. Flujo de exportación YAML del pliego: construye el
 * objeto de datos desde el expediente, lo serializa con export/pliego-yaml.js
 * y ofrece la descarga.
 *
 * Se integra como botón adicional en la sección de exportación del expediente.
 * La verificación real (correr el generador contra el YAML) se hace en tests y
 * en tools/recorrido-completo.js §3.3.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views || !SGC.descargas) {
    throw new Error('pliego-yaml.js (vista) requiere namespaces.js y export/pliego-yaml.js');
  }

  var config = SGC.core.config;
  var reqMod = SGC.core.requerimiento;
  var yaml = SGC.descargas.pliegoYaml;

  function str(v) { return typeof v === 'string' ? v.trim() : ''; }

  function datosDe(exp) {
    return (exp && typeof exp.datos === 'object' && exp.datos) || exp || {};
  }

  function idsDeRenglones(renglones) {
    var partes = [];
    for (var i = 0; i < renglones.length; i++) {
      if (renglones[i].codigo) {
        partes.push(renglones[i].codigo);
      }
    }
    return partes.join(', ');
  }

  // Construye el objeto YAML desde el expediente completo.
  function construirDatos(expediente) {
    var datos = datosDe(expediente);
    var info = reqMod.requerimientoDe(expediente);
    var rq = info.requerimiento || {};
    var campos = info.campos || {};
    var a1 = (datos.anexo1 && typeof datos.anexo1 === 'object') ? datos.anexo1 : {};
    var renglones = Array.isArray(datos.renglones) ? datos.renglones : [];
    var idExp = expediente && expediente.expedienteId ? expediente.expedienteId : (str(campos.numero) || '');

    var rubros = str(rq.rubro || campos.rubro || '');
    if (rubros && !rubros.match(/^["']/)) {
      rubros = '"' + rubros + '"';
    }

    var organismo = {
      nombre: str(a1.unidadResponsable || campos.dependenciaSolicitante || rq.dependencia || ''),
      domicilio: str(a1.unidadDireccion || ''),
      telefono: str(a1.unidadTelefono || ''),
      correo: str(a1.unidadCorreo || ''),
      horario: str(a1.horarioAtencion || ''),
      frecuencia_provision: str(a1.frecuenciaProvision || ''),
      plazo_entrega: str(a1.plazoEntrega || '')
    };
    var organismos = [];
    if (organismo.nombre || organismo.domicilio) {
      organismos.push(organismo);
    }

    var datosYaml = {
      tipo_documento: 'proyecto',
      tipo_contrato: 'bienes',
      version: '1.0',
      tipo_procedimiento: str(rq.tipoProcedimiento || campos.tipoProcedimiento || ''),
      nro_procedimiento: idExp,
      ejercicio: str(campos.anio || ''),
      clase_modalidad: str(rq.claseModalidad || campos.claseModalidad || ''),
      tipo_oc: str(a1.tipoOc || ''),
      nro_expediente_gde: str(a1.nroExpedienteGde || '') || yaml.MARCA_FALTA,
      rubros: rubros,
      nombre_proceso: str(rq.nombreProceso || campos.nombreProceso || ''),
      objeto: str(rq.objeto || campos.titulo || expediente && expediente.titulo || '')
    };

    if (organismos.length > 0) {
      datosYaml.organismos_requirentes = organismos;
    }

    if (str(a1.ofertasParciales)) {
      datosYaml.ofertas_parciales = str(a1.ofertasParciales);
    }
    if (str(a1.ofertasAlternativas)) {
      datosYaml.ofertas_alternativas = str(a1.ofertasAlternativas);
    }
    if (str(a1.duracionContrato)) {
      datosYaml.duracion_contrato = str(a1.duracionContrato);
    }

    var eett = SGC.core.anexoEett;
    if (eett && typeof eett.tieneContenido === 'function' && eett.tieneContenido(expediente)) {
      datosYaml.apendice_eett = 'EETT_' + idExp + '.pdf';
    }

    return datosYaml;
  }

  function generar(expediente) {
    var datos = construirDatos(expediente);
    return yaml.emitir(datos);
  }

  function descargar(nombreArchivo, contenido) {
    if (typeof document === 'undefined') return;
    var blob = new Blob([contenido], { type: 'text/yaml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo || 'datos_pliego.yaml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportarYaml(expediente, nombreArchivo) {
    var contenido = generar(expediente);
    var id = expediente && expediente.expedienteId ? expediente.expedienteId : 'expediente';
    descargar(nombreArchivo || ('pliego_' + id + '.yaml'), contenido);
    return contenido;
  }

  SGC.views.pliegoYaml = {
    construirDatos: construirDatos,
    generar: generar,
    exportar: exportarYaml,
    descargar: descargar
  };
})(typeof window !== 'undefined' ? window : globalThis);
