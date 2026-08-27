/*
 * anexo-uno.js
 * ORDEN-RONDA-11 §3.1. Formulario del ANEXO 1 para el rol abastecimiento en
 * el estado ANALISIS_SCo. Las catorce secciones del análisis de Abastecimiento;
 * §9–§12 son condicionales según el tipo de contratación.
 *
 * Precarga desde el requerimiento (§1, §4, §7) y permite guardar en
 * expediente.datos.anexo1 para que renders/anexo-1.js lo componga.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('anexo-uno.js requiere que namespaces.js se cargue primero');
  }

  var ESTADO_OBJETIVO = 'ANALISIS_SCo';
  var TRIMESTRES = ['', '1°', '2°', '3°', '4°'];

  var estado = {
    repo: null,
    operador: null,
    dom: {},
    expedienteId: null,
    version: null
  };

  function qs(raiz, sel) { return raiz.querySelector(sel); }

  function str(v) { return typeof v === 'string' ? v.trim() : ''; }

  function datosDe(exp) {
    return (exp && typeof exp.datos === 'object' && exp.datos) || exp || {};
  }

  function expedienteActual() {
    if (!SGC.views.expediente || typeof SGC.views.expediente.obtener !== 'function') {
      return null;
    }
    var a = SGC.views.expediente.obtener();
    return a && a.expediente ? a.expediente : null;
  }

  function contextoActual() {
    var op = estado.operador || {};
    return {
      timestamp: new Date().toISOString(),
      email: op.email || 'anonimo',
      rol: op.roles && op.roles[0],
      equipo: op.equipo || 'PC-NAVEGADOR'
    };
  }

  function avisar(m, err) {
    if (!estado.dom.msj) return;
    estado.dom.msj.textContent = m;
    estado.dom.msj.className = err ? 'exp-mensaje exp-mensaje-error' : 'exp-mensaje exp-mensaje-ok';
    estado.dom.msj.hidden = false;
  }

  function valor(raiz, id) {
    var el = qs(raiz, id);
    return el ? el.value.trim() : '';
  }

  function valorTexto(raiz, id) {
    var el = qs(raiz, id);
    return el ? el.value.trim() : '';
  }

  function fijarValor(raiz, id, v) {
    var el = qs(raiz, id);
    if (el) el.value = v || '';
  }

  // Empresas consultadas: textarea con una empresa por línea
  function leerEmpresas(raiz) {
    var txt = valorTexto(raiz, '#sgc-anexo1-empresas');
    if (!txt) return [];
    return txt.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  }

  function fijarEmpresas(raiz, arr) {
    var el = qs(raiz, '#sgc-anexo1-empresas');
    if (el) el.value = Array.isArray(arr) ? arr.join('\n') : '';
  }

  // Resumen de renglones para §7
  function resumenRenglones(expediente) {
    var datos = datosDe(expediente);
    var renglones = Array.isArray(datos.renglones) ? datos.renglones : [];
    if (renglones.length === 0) return '';
    var lineas = [];
    for (var i = 0; i < renglones.length; i++) {
      var r = renglones[i];
      var desc = str(r.descripcion || r.detalle || r.nombre || '');
      var cant = r.cantidad;
      var um = str(r.unidadMedida || r.unidad || '');
      lineas.push((i + 1) + '. ' + desc + (cant ? ' (' + cant + (um ? ' ' + um : '') + ')' : ''));
    }
    return lineas.join('\n');
  }

  // Precio de referencia derivado de preventivoContratacion (§2.3).
  function precioDerivado(expediente) {
    var datos = datosDe(expediente);
    var renglones = Array.isArray(datos.renglones) ? datos.renglones : [];
    if (renglones.length === 0) return { total: null, valido: false, empresas: [] };
    var req = SGC.core.requerimiento;
    var prev = req.preventivoContratacion(renglones);
    var empresas = [];
    for (var i = 0; i < renglones.length; i++) {
      var r = renglones[i];
      var vals = Array.isArray(r.valoresReferencia) ? r.valoresReferencia : [];
      for (var j = 0; j < vals.length; j++) {
        var v = vals[j];
        if (v && v.empresa && empresas.indexOf(v.empresa) === -1) {
          empresas.push(v.empresa);
        }
      }
    }
    return { total: prev.total, valido: prev.valido, empresas: empresas };
  }

  // Formatea un monto numérico como "$ 1.234.567,89"
  function formatearMonto(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '';
    var texto = n.toFixed(2);
    var partes = texto.split('.');
    return '$ ' + partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + partes[1];
  }

  // ---------------------------------------------------------------------------
  // Precarga desde el requerimiento (SGC.core.requerimiento.requerimientoDe)
  // ---------------------------------------------------------------------------
  function precarga(expediente) {
    var datos = datosDe(expediente);
    var info = SGC.core.requerimiento.requerimientoDe(expediente);
    var rq = info.requerimiento || {};
    var solicitante = datos.solicitante || {};

    var objeto = rq.objeto || str(expediente.titulo) || str(datos.titulo) || '';
    var justificacion = rq.justificacionNecesidad || str(datos.fundamentacion && datos.fundamentacion.justificacion) || '';
    var unidad = rq.unidadSolicitante || str(solicitante.unidad || solicitante.dependencia) || '';

    var prev = precioDerivado(expediente);

    return {
      objeto: objeto,
      justificacion: justificacion,
      unidad: unidad,
      responsables: [
        str(solicitante.responsable || rq.responsable || ''),
        str(solicitante.usuarioGde || rq.usuarioGde || '')
      ],
      direccion: str(solicitante.direccion || rq.direccion || ''),
      telefono: str(solicitante.telefono || rq.telefono || ''),
      correo: str(solicitante.correo || rq.correo || ''),
      entrega: str(solicitante.lugarEntrega || rq.lugarEntrega || ''),
      facturacion: str(solicitante.lugarFacturacion || rq.lugarFacturacion || ''),
      renglones: resumenRenglones(expediente),
      precioReferenciaCalculado: prev.valido && prev.total !== null ? formatearMonto(prev.total) : '',
      empresasCalculadas: prev.empresas
    };
  }

  // ---------------------------------------------------------------------------
  // Carga de valores previos guardados en expediente.datos.anexo1
  // ---------------------------------------------------------------------------
  function valoresGuardados(expediente) {
    var datos = datosDe(expediente);
    var a = (datos.anexo1 && typeof datos.anexo1 === 'object') ? datos.anexo1 : {};
    return a;
  }

  // ---------------------------------------------------------------------------
  // montar: wiring del DOM
  // ---------------------------------------------------------------------------
  function montar(raiz) {
    estado.dom.raiz = raiz;
    estado.dom.msj = qs(raiz, '#sgc-anexo1-msj');

    var trimSel = qs(raiz, '#sgc-anexo1-trimestre');
    if (trimSel) {
      for (var i = 0; i < TRIMESTRES.length; i++) {
        var opt = document.createElement('option');
        opt.value = TRIMESTRES[i];
        opt.textContent = TRIMESTRES[i] || '— Seleccionar —';
        trimSel.appendChild(opt);
      }
    }

    var chkPac = qs(raiz, '#sgc-anexo1-pac');
    var numOrden = qs(raiz, '#sgc-anexo1-numero-orden');
    var trimestre = qs(raiz, '#sgc-anexo1-trimestre');
    if (chkPac && numOrden && trimestre) {
      function togglePac() {
        var activo = chkPac.checked;
        numOrden.disabled = !activo;
        trimestre.disabled = !activo;
        if (!activo) {
          numOrden.value = '';
          trimestre.value = '';
        }
      }
      chkPac.addEventListener('change', togglePac);
      togglePac();
    }

    var btnGuardar = qs(raiz, '#sgc-anexo1-guardar');
    if (btnGuardar) {
      btnGuardar.addEventListener('click', guardar);
    }
  }

  // ---------------------------------------------------------------------------
  // actualizar: show/hide + precarga
  // ---------------------------------------------------------------------------
  function actualizar(expediente) {
    var visible = !!expediente &&
      SGC.core.utils.idEstado(expediente) === ESTADO_OBJETIVO &&
      expediente.archivado !== true;
    var raiz = estado.dom.raiz;
    if (!raiz) return;

    if (!visible) {
      raiz.hidden = true;
      estado.expedienteId = null;
      return;
    }
    raiz.hidden = false;

    var actual = SGC.views.expediente.obtener();
    estado.expedienteId = expediente.expedienteId || expediente.id;
    estado.version = actual.version;

    var pre = precarga(expediente);
    var guard = valoresGuardados(expediente);

    fijarValor(raiz, '#sgc-anexo1-objeto', guard.objeto || pre.objeto);
    fijarValor(raiz, '#sgc-anexo1-justificacion', guard.justificacion || pre.justificacion);
    fijarValor(raiz, '#sgc-anexo1-responsable', guard.unidadResponsable || pre.responsables[0] || '');
    fijarValor(raiz, '#sgc-anexo1-usuario-gde', guard.usuarioGde || pre.responsables[1] || '');
    fijarValor(raiz, '#sgc-anexo1-direccion', guard.unidadDireccion || pre.direccion);
    fijarValor(raiz, '#sgc-anexo1-telefono', guard.unidadTelefono || pre.telefono);
    fijarValor(raiz, '#sgc-anexo1-correo', guard.unidadCorreo || pre.correo);
    fijarValor(raiz, '#sgc-anexo1-entrega', guard.lugarEntrega || pre.entrega);
    fijarValor(raiz, '#sgc-anexo1-facturacion', guard.lugarFacturacion || pre.facturacion);
    fijarValor(raiz, '#sgc-anexo1-requisitos', guard.requisitosMinimos || pre.renglones);

    // §2.3: empresas y precio derivados de los presupuestos/renglones.
    // Si el guardado tiene valores manuales, se usan esos; si no, los calculados.
    fijarEmpresas(raiz, guard.empresasConsultadas && guard.empresasConsultadas.length > 0
      ? guard.empresasConsultadas : pre.empresasCalculadas);
    var precioCalculado = pre.precioReferenciaCalculado;
    fijarValor(raiz, '#sgc-anexo1-precio', guard.precioReferencia || precioCalculado);
    // Mostrar el valor calculado como referencia si hay edit manual
    var elPrecio = qs(raiz, '#sgc-anexo1-precio-ref');
    if (elPrecio) {
      if (guard.precioReferencia && guard.precioReferencia !== precioCalculado && precioCalculado) {
        elPrecio.textContent = '(calculado: ' + precioCalculado + ')';
        elPrecio.hidden = false;
      } else {
        elPrecio.textContent = '';
        elPrecio.hidden = true;
      }
    }
    fijarValor(raiz, '#sgc-anexo1-moneda-ext', guard.monedaExtranjera || '');

    var chkPac = qs(raiz, '#sgc-anexo1-pac');
    if (chkPac) {
      chkPac.checked = guard.pacPrevisto === true || guard.pacPrevisto === 'Si';
    }
    fijarValor(raiz, '#sgc-anexo1-numero-orden', guard.pacNumeroOrden || '');
    fijarValor(raiz, '#sgc-anexo1-trimestre', guard.pacTrimestre || '');

    fijarValor(raiz, '#sgc-anexo1-comision', guard.comisionRecepcion || '');
    fijarValor(raiz, '#sgc-anexo1-personal', guard.personalTecnico || '');
    fijarValor(raiz, '#sgc-anexo1-visita', guard.visitaMuestra || '');
    fijarValor(raiz, '#sgc-anexo1-interadmin', guard.interadministrativa || '');
    fijarValor(raiz, '#sgc-anexo1-bienes', guard.bienesUso || '');
    fijarValor(raiz, '#sgc-anexo1-hw-sw', guard.hardwareSoftware || '');
    fijarValor(raiz, '#sgc-anexo1-reparaciones', guard.reparacionesInfra || '');
    fijarValor(raiz, '#sgc-anexo1-documentacion', guard.documentacionObligatoria || '');
    fijarValor(raiz, '#sgc-anexo1-criterio', guard.criterioEvaluacion || '');

    if (chkPac) {
      var numOrd = qs(raiz, '#sgc-anexo1-numero-orden');
      var triSel = qs(raiz, '#sgc-anexo1-trimestre');
      if (numOrd) numOrd.disabled = !chkPac.checked;
      if (triSel) triSel.disabled = !chkPac.checked;
    }
  }

  // ---------------------------------------------------------------------------
  // leer
  // ---------------------------------------------------------------------------
  function leer() {
    var raiz = estado.dom.raiz;
    if (!raiz) return {};
    var chkPac = qs(raiz, '#sgc-anexo1-pac');
    return {
      objeto: valorTexto(raiz, '#sgc-anexo1-objeto'),
      justificacion: valorTexto(raiz, '#sgc-anexo1-justificacion'),
      empresasConsultadas: leerEmpresas(raiz),
      precioReferencia: valorTexto(raiz, '#sgc-anexo1-precio'),
      monedaExtranjera: valorTexto(raiz, '#sgc-anexo1-moneda-ext'),
      pacPrevisto: chkPac && chkPac.checked,
      pacNumeroOrden: valorTexto(raiz, '#sgc-anexo1-numero-orden'),
      pacTrimestre: valorTexto(raiz, '#sgc-anexo1-trimestre'),
      unidadResponsable: valorTexto(raiz, '#sgc-anexo1-responsable'),
      usuarioGde: valorTexto(raiz, '#sgc-anexo1-usuario-gde'),
      unidadDireccion: valorTexto(raiz, '#sgc-anexo1-direccion'),
      unidadTelefono: valorTexto(raiz, '#sgc-anexo1-telefono'),
      unidadCorreo: valorTexto(raiz, '#sgc-anexo1-correo'),
      lugarEntrega: valorTexto(raiz, '#sgc-anexo1-entrega'),
      lugarFacturacion: valorTexto(raiz, '#sgc-anexo1-facturacion'),
      comisionRecepcion: valorTexto(raiz, '#sgc-anexo1-comision'),
      personalTecnico: valorTexto(raiz, '#sgc-anexo1-personal'),
      requisitosMinimos: valorTexto(raiz, '#sgc-anexo1-requisitos'),
      visitaMuestra: valorTexto(raiz, '#sgc-anexo1-visita'),
      interadministrativa: valorTexto(raiz, '#sgc-anexo1-interadmin'),
      bienesUso: valorTexto(raiz, '#sgc-anexo1-bienes'),
      hardwareSoftware: valorTexto(raiz, '#sgc-anexo1-hw-sw'),
      reparacionesInfra: valorTexto(raiz, '#sgc-anexo1-reparaciones'),
      documentacionObligatoria: valorTexto(raiz, '#sgc-anexo1-documentacion'),
      criterioEvaluacion: valorTexto(raiz, '#sgc-anexo1-criterio')
    };
  }

  // ---------------------------------------------------------------------------
  // guardar
  // ---------------------------------------------------------------------------
  function guardar() {
    var expediente = expedienteActual();
    if (!expediente || !estado.repo) {
      avisar('No hay expediente seleccionado o no hay conexión.', true);
      return;
    }
    var copia = JSON.parse(JSON.stringify(expediente));
    var datos = datosDe(copia);
    if (typeof datos.anexo1 !== 'object' || datos.anexo1 === null) {
      datos.anexo1 = {};
    }
    var campos = leer();
    for (var k in campos) {
      if (Object.prototype.hasOwnProperty.call(campos, k)) {
        datos.anexo1[k] = campos[k];
      }
    }
    estado.repo.guardarExpediente(estado.expedienteId, copia, estado.version, contextoActual())
      .then(function (resp) {
        if (resp.conflicto) {
          avisar('El expediente fue modificado por otro operador (versión ' +
            resp.versionRemota + '). No se guardó nada.', true);
          return;
        }
        if (!resp.ok) {
          avisar('No se pudo guardar el ANEXO 1: ' + (resp.error || 'error desconocido'), true);
          return;
        }
        estado.version = resp.version;
        avisar('ANEXO 1 guardado (versión ' + resp.version + ').', false);
      })
      .catch(function (err) {
        avisar('No se pudo guardar el ANEXO 1: ' + err.message, true);
      });
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  SGC.views.anexoUno = {
    montar: montar,
    actualizar: actualizar,
    fijarRepo: function (repo) { estado.repo = repo; },
    seleccionarOperador: function (op) { estado.operador = op; },
    leer: leer
  };
})(typeof window !== 'undefined' ? window : globalThis);
