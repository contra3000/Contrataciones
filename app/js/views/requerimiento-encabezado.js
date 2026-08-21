/*
 * requerimiento-encabezado.js
 * ORDEN-RONDA-10 §3.1 (H11). Encabezado del requerimiento en la pantalla de
 * carga: los dieciséis campos de core/requerimiento.js, con lo derivable del
 * expediente prellenado (unidad ← dependencia solicitante, lugar, fecha de
 * hoy, objeto ← título, justificación ← fundamentación, rubro).
 *
 * Vive separado de requerimiento-formulario.js para que ningún archivo de la
 * pantalla supere las 400 líneas (ORDEN-RONDA-10 §3.1). Las reglas de qué es
 * obligatorio y qué se deriva siguen siendo del núcleo; acá hay estado del
 * formulario y DOM.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('requerimiento-encabezado.js requiere que namespaces.js se cargue primero');
  }

  var req = SGC.core.requerimiento;
  var estado = { campos: {} };

  // El expediente llega plano (identificacion, renglones y presupuestos en el
  // primer nivel); la misma normalización que hace core/requerimiento.js.
  function datosDe(expediente) {
    return (expediente && typeof expediente.datos === 'object' && expediente.datos) ||
      expediente || {};
  }

  function fechaHoy() {
    return new Date().toISOString().slice(0, 10);
  }

  function valorDeIdentificacion(expediente, clave) {
    var id = datosDe(expediente).identificacion;
    return id && typeof id[clave] === 'string' ? id[clave] : '';
  }

  var PRELLENADO = {
    lugar: function (exp) { return valorDeIdentificacion(exp, 'lugar'); },
    fecha: function () { return fechaHoy(); },
    unidadSolicitante: function (exp) { return valorDeIdentificacion(exp, 'dependenciaSolicitante'); },
    rubroCodigo: function (exp) {
      return typeof datosDe(exp).rubro === 'string' ? datosDe(exp).rubro : '';
    },
    objeto: function (exp) { return typeof exp.titulo === 'string' ? exp.titulo : ''; },
    justificacionNecesidad: function (exp) {
      var f = datosDe(exp).fundamentacion;
      return f && typeof f.justificacion === 'string' ? f.justificacion : '';
    }
  };

  function construir(contenedor) {
    while (contenedor.children.length > 0) {
      contenedor.removeChild(contenedor.children[0]);
    }
    var doc = document;
    for (var i = 0; i < req.CAMPOS_ENCABEZADO.length; i++) {
      var c = req.CAMPOS_ENCABEZADO[i];
      var lbl = doc.createElement('label');
      lbl.className = 'req-campo';
      lbl.textContent = c.etiqueta;
      var input = doc.createElement('input');
      input.type = c.clave === 'vigenciaInicio' || c.clave === 'vigenciaFin' ? 'date' : 'text';
      input.setAttribute('data-campo', c.clave);
      input.setAttribute('aria-label', c.etiqueta);
      lbl.appendChild(input);
      contenedor.appendChild(lbl);
      estado.campos[c.clave] = input;
    }
  }

  function valorGuardado(rq, clave) {
    return rq && typeof rq[clave] === 'string' && rq[clave] !== '' ? rq[clave] : '';
  }

  // Orden de precedencia por campo: borrador local → valor ya guardado en el
  // requerimiento → lo derivable del expediente → vacío. El borrador entra por
  // parámetro: lo lee el formulario con su módulo propio.
  function prellenar(expediente, borrador) {
    var info = req.requerimientoDe(expediente);
    var rq = info.requerimiento || {};
    for (var i = 0; i < req.CAMPOS_ENCABEZADO.length; i++) {
      var c = req.CAMPOS_ENCABEZADO[i];
      var delBorrador = borrador && borrador.datos.campos && typeof borrador.datos.campos[c.clave] === 'string'
        ? borrador.datos.campos[c.clave] : null;
      var input = estado.campos[c.clave];
      if (!input) {
        continue;
      }
      if (delBorrador !== null) {
        input.value = delBorrador;
      } else if (valorGuardado(rq, c.clave) !== '') {
        input.value = valorGuardado(rq, c.clave);
      } else if (PRELLENADO[c.clave]) {
        input.value = PRELLENADO[c.clave](expediente);
      } else {
        input.value = '';
      }
    }
  }

  function leerCampos() {
    var rq = {};
    for (var i = 0; i < req.CAMPOS_ENCABEZADO.length; i++) {
      var c = req.CAMPOS_ENCABEZADO[i];
      rq[c.clave] = estado.campos[c.clave] ? estado.campos[c.clave].value.trim() : '';
    }
    return rq;
  }

  SGC.views.requerimientoEncabezado = {
    construir: construir,
    prellenar: prellenar,
    leerCampos: leerCampos
  };
})(typeof window !== 'undefined' ? window : globalThis);
