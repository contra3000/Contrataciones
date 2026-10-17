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

  // ORDEN-RONDA-35 pieza 2a: se eliminó el campo "Preventivo en dólares". El
  // preventivo de un proceso en dólares sale de los valores de referencia, como
  // el de cualquier otro; no hay nada que convertir de texto a número acá.

  function sincronizar(estado) {
    estado.datos.identificacion.titulo = leerCampo(estado, 'titulo');
    estado.datos.identificacion.anio = leerCampo(estado, 'anio');
    estado.datos.identificacion.dependenciaSolicitante = leerCampo(estado, 'dependenciaSolicitante');
    // ORDEN-RONDA-34 pieza 1: el trimestre es del generador (ADR-044). La
    // aplicación con servidor no tiene el nodo; si no existe, se saltea sin
    // error y el campo nunca llega a la validación.
    if (campoInput(estado, 'trimestre')) {
      estado.datos.identificacion.trimestre = leerCampo(estado, 'trimestre');
    }
    // ORDEN-RONDA-35 pieza 1: el lugar de entrega lo escribe la persona. Igual
    // que el trimestre, sólo se escribe si el nodo existe (generador).
    if (campoInput(estado, 'lugarEntrega')) {
      estado.datos.identificacion.lugarEntrega = leerCampo(estado, 'lugarEntrega');
    }
    // ORDEN-RONDA-34 pieza 2 (ORDEN-RONDA-35 pieza 2a): el PAC, en la misma
    // forma que viaja en el JSON ({numero, justificacion}). Ya no lleva el
    // preventivo en dólares escrito a mano: la moneda sale del proceso y el
    // preventivo, de los valores de referencia. Igual que el trimestre, sólo se
    // escribe si el nodo existe (generador).
    //
    // ORDEN-RONDA-37 pieza 2: `causas` no sale de un campo (se guarda cuando se
    // escribe o se confirma la justificación), así que reconstruir el pac no lo
    // puede perder: si venía con claves, siguen viajando. ORDEN-RONDA-38 pieza 1:
    // lo mismo con `procesoJustificado`, que se guarda en el mismo momento.
    if (campoInput(estado, 'pac')) {
      var pacAnterior = estado.datos.identificacion.pac;
      var pac = {
        numero: leerCampo(estado, 'pac'),
        justificacion: campoInput(estado, 'pacJustificacion')
          ? leerCampo(estado, 'pacJustificacion') : ''
      };
      if (pacAnterior && Array.isArray(pacAnterior.causas)) {
        pac.causas = pacAnterior.causas;
      }
      if (pacAnterior && typeof pacAnterior.procesoJustificado === 'string') {
        pac.procesoJustificado = pacAnterior.procesoJustificado;
      }
      estado.datos.identificacion.pac = pac;
    }
    // ORDEN-RONDA-38 pieza 2a: la modalidad de compra (común u OCA). Es del
    // generador: con servidor no hay nodo y no se toca (ADR-044).
    if (campoInput(estado, 'modalidad')) {
      estado.datos.identificacion.modalidad = leerCampo(estado, 'modalidad');
    }
    estado.datos.fundamentacion.justificacion = leerCampo(estado, 'justificacion');
    // ORDEN-RONDA-38 pieza 2d: "Objetivo" ya no tiene campo en el generador,
    // pero el JSON sigue llevándolo. Sólo se escribe si el nodo existe (con
    // servidor), para no pisar con vacío un objetivo que traiga un archivo.
    if (campoInput(estado, 'objetivo')) {
      estado.datos.fundamentacion.objetivo = leerCampo(estado, 'objetivo');
    }
    // ORDEN-RONDA-38 pieza 2b: la justificación de la OCA (generador).
    if (campoInput(estado, 'ocaJustificacion')) {
      estado.datos.fundamentacion.ocaJustificacion = leerCampo(estado, 'ocaJustificacion');
    }
    estado.datos.renglones = SGC.catalogo.renglones.obtener();
  }

  function aplicar(estado) {
    var id = estado.datos.identificacion || {};
    var fund = estado.datos.fundamentacion || {};
    campoInput(estado, 'titulo').value = id.titulo || '';
    campoInput(estado, 'anio').value = id.anio || '';
    campoInput(estado, 'dependenciaSolicitante').value = id.dependenciaSolicitante || '';
    if (campoInput(estado, 'trimestre')) {
      campoInput(estado, 'trimestre').value = id.trimestre || '';
    }
    if (campoInput(estado, 'lugarEntrega')) {
      campoInput(estado, 'lugarEntrega').value = id.lugarEntrega || '';
    }
    if (campoInput(estado, 'pac')) {
      var pac = id.pac && typeof id.pac === 'object' ? id.pac : {};
      campoInput(estado, 'pac').value = pac.numero || '';
      if (campoInput(estado, 'pacJustificacion')) {
        campoInput(estado, 'pacJustificacion').value = pac.justificacion || '';
      }
    }
    // ORDEN-RONDA-38 pieza 2a: la modalidad, si el nodo existe (generador).
    if (campoInput(estado, 'modalidad')) {
      campoInput(estado, 'modalidad').value = id.modalidad || '';
    }
    campoInput(estado, 'justificacion').value = fund.justificacion || '';
    // ORDEN-RONDA-38 pieza 2d: "Objetivo" ya no tiene campo en el generador. Si
    // no hay nodo, un objetivo importado se conserva en los datos (no se toca).
    if (campoInput(estado, 'objetivo')) {
      campoInput(estado, 'objetivo').value = fund.objetivo || '';
    }
    // ORDEN-RONDA-38 pieza 2b: la justificación de la OCA, si el nodo existe.
    if (campoInput(estado, 'ocaJustificacion')) {
      campoInput(estado, 'ocaJustificacion').value = fund.ocaJustificacion || '';
    }
  }

  /*
   * ORDEN-RONDA-31 pieza 2d: "Siguiente" me lleva arriba y tengo que buscar el
   * error, dice el Jefe.
   *
   * Cuando la validación no deja avanzar, el motivo de no avanzar se trae a la
   * vista: no el mensaje de arriba, sino el PRIMER CAMPO con error —por
   * ejemplo la unidad del renglón 2—, enfocado y con la clase campo-con-error
   * (borde rojo). El mensaje de arriba queda como está (el texto sigue ahí);
   * sólo se lo trae a la vista cuando ningún error tiene campo propio.
   *
   * Un error tiene campo cuando es del formulario (título, año, dependencia,
   * justificación) o cuando es de un renglón y el mensaje nombra un input de
   * esa fila (unidad, cantidad, aclaración). El código del renglón no tiene
   * input (es un texto), así que ese error no lleva el foco a ningún lado.
   */
  function campoDeError(estado, e) {
    if (e.campo && estado.dom.errores[e.campo] && estado.dom.campos[e.campo]) {
      return estado.dom.campos[e.campo];
    }
    var coincidencia = /^renglones\[(\d+)\]$/.exec(e.campo || '');
    if (!coincidencia) {
      return null;
    }
    var lista = estado.dom.listaRenglones;
    var fila = lista ? lista.children[Number(coincidencia[1])] : null;
    if (!fila) {
      return null;
    }
    // ORDEN-RONDA-33 pieza 2: el error de un renglón por buscar lleva al botón
    // "Buscar" de esa fila, que es lo que destraba el paso.
    if (/ítem del catálogo/i.test(e.mensaje)) {
      var botonBuscar = fila.querySelectorAll('[data-buscar]');
      return botonBuscar.length > 0 ? botonBuscar[0] : null;
    }
    var etiqueta = null;
    if (/unidad/i.test(e.mensaje)) {
      etiqueta = 'Unidad de medida';
    } else if (/cantidad/i.test(e.mensaje)) {
      etiqueta = 'Cantidad del ítem';
    } else if (/aclaraci/i.test(e.mensaje)) {
      etiqueta = 'Aclaración opcional';
    }
    if (!etiqueta) {
      return null;
    }
    var candidatos = fila.querySelectorAll('[aria-label="' + etiqueta + '"]');
    return candidatos.length > 0 ? candidatos[0] : null;
  }

  function mostrarErrores(estado, errores) {
    // La marca roja corresponde sólo mientras ese error siga en pie: se quita
    // al principio y se pone de vuelta si el mismo campo vuelve a fallar.
    if (estado.campoMarcado && estado.campoMarcado.classList) {
      estado.campoMarcado.classList.remove('campo-con-error');
    }
    estado.campoMarcado = null;
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
    /*
     * ORDEN-RONDA-30 pieza 1d + ORDEN-RONDA-31 pieza 2d.
     *
     * El motivo de no avanzar se escribe en #sgc-paso-msj, que está arriba de
     * todo (generador.html:127), y el botón que se apretó al final
     * (generador.html:293). En el paso 2, con la lista de renglones y los
     * presupuestos, la distancia entre los dos es de toda una pantalla.
     *
     * Por eso, cuando hay errores, se trae a la vista y se enfoca el primer
     * campo con error (pieza 2d); si ningún error tiene campo propio, se trae
     * el mensaje (pieza 1d de la ronda 30). Sólo cuando hay errores: con la
     * lista vacía el nodo está oculto y no hay nada que traer.
     */
    var campo = null;
    for (var j = 0; j < errores.length && campo === null; j++) {
      campo = campoDeError(estado, errores[j]);
    }
    if (campo) {
      estado.campoMarcado = campo;
      if (typeof campo.scrollIntoView === 'function') {
        campo.scrollIntoView({ block: 'center' });
      }
      if (typeof campo.focus === 'function') {
        campo.focus();
      }
      if (campo.classList) {
        campo.classList.add('campo-con-error');
      }
    } else if (lista.length > 0 && typeof estado.dom.pasoMsj.scrollIntoView === 'function') {
      estado.dom.pasoMsj.scrollIntoView({ block: 'center' });
    }
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