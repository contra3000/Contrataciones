/*
 * wizard-formulario.js
 * Formulario del wizard (ORDEN-RONDA-07 §2.2): sincronización entre el estado
 * de datos y los campos, presentación de errores junto al campo y el manejo
 * del borrador local. Sin reglas de validación (las tiene SGC.views.pasos).
 * El núcleo de navegación y persistencia queda en wizard.js.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('wizard-formulario.js requiere que namespaces.js se cargue primero');
  }

  var borrador = SGC.views.borrador;

  function campoInput(estado, idCampo) {
    return estado.dom.campos[idCampo];
  }

  function leerCampo(estado, idCampo) {
    var nodo = campoInput(estado, idCampo);
    return nodo ? nodo.value : '';
  }

  function sincronizar(estado) {
    estado.datos.identificacion.titulo = leerCampo(estado, 'titulo');
    estado.datos.identificacion.anio = leerCampo(estado, 'anio');
    estado.datos.identificacion.dependenciaSolicitante = leerCampo(estado, 'dependenciaSolicitante');
    estado.datos.fundamentacion.justificacion = leerCampo(estado, 'justificacion');
    estado.datos.fundamentacion.objetivo = leerCampo(estado, 'objetivo');
    estado.datos.renglones = SGC.catalogo.renglones.obtener();
  }

  function aplicar(estado) {
    var id = estado.datos.identificacion || {};
    var fund = estado.datos.fundamentacion || {};
    campoInput(estado, 'titulo').value = id.titulo || '';
    campoInput(estado, 'anio').value = id.anio || '';
    campoInput(estado, 'dependenciaSolicitante').value = id.dependenciaSolicitante || '';
    campoInput(estado, 'justificacion').value = fund.justificacion || '';
    campoInput(estado, 'objetivo').value = fund.objetivo || '';
  }

  function mostrarErrores(estado, errores) {
    for (var clave in estado.dom.errores) {
      if (Object.prototype.hasOwnProperty.call(estado.dom.errores, clave)) {
        estado.dom.errores[clave].textContent = '';
        estado.dom.errores[clave].hidden = true;
      }
    }
    var lista = [];
    for (var i = 0; i < errores.length; i++) {
      var e = errores[i];
      var nodo = estado.dom.errores[e.campo];
      if (nodo) {
        nodo.textContent = e.mensaje;
        nodo.hidden = false;
      } else {
        lista.push(e.mensaje);
      }
    }
    estado.dom.pasoMsj.textContent = lista.join(' · ');
    estado.dom.pasoMsj.hidden = lista.length === 0;
  }

  function guardarBorrador(estado, storage) {
    if (!estado.operador) {
      return;
    }
    sincronizar(estado);
    try {
      borrador.guardar(storage, estado.datos, estado.operador.email);
    } catch (e) {
      // sessionStorage puede estar bloqueado; el borrador es mejor esfuerzo
    }
  }

  function ofrecer(estado, registro) {
    estado.dom.borradorAviso.hidden = false;
    estado.dom.borradorInfo.textContent =
      'Hay un borrador de ' + registro.operador + ' guardado el ' + registro.guardado + '.';
  }

  function retomar(estado, registro, irAPaso) {
    var chequeo = borrador.validarForma(registro.datos);
    if (!chequeo.valido) {
      estado.dom.borradorInfo.textContent =
        'El borrador guardado no se puede aplicar: ' + chequeo.motivo +
        '. Puede descartarlo y empezar de nuevo.';
      estado.dom.borradorAviso.hidden = false;
      return;
    }
    estado.datos = JSON.parse(JSON.stringify(registro.datos));
    if (estado.datos.identificacion && estado.datos.identificacion.operador) {
      estado.datos.identificacion.operador = estado.operador.email;
    }
    estado.dom.borradorAviso.hidden = true;
    aplicar(estado);
    SGC.catalogo.renglones.cargar(estado.datos.renglones);
    irAPaso(0, false);
  }

  function descartar(estado, storage) {
    try {
      borrador.limpiar(storage);
    } catch (e) {
      // ignorar
    }
    estado.dom.borradorAviso.hidden = true;
  }

  SGC.views.wizardFormulario = {
    sincronizar: sincronizar,
    aplicar: aplicar,
    mostrarErrores: mostrarErrores,
    guardarBorrador: guardarBorrador,
    ofrecer: ofrecer,
    retomar: retomar,
    descartar: descartar
  };
})(typeof window !== 'undefined' ? window : globalThis);