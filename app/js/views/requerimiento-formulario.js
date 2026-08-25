/*
 * requerimiento-formulario.js
 * ORDEN-RONDA-10 §3.1 (H11). Pantalla de carga del requerimiento dentro de la
 * vista de expediente, en el estado ESPECIFICACIONES_TECNICAS (fase 1): acá
 * viven los presupuestos que hay que citar y es el estado productor del
 * requerimiento.
 *
 * Es la vista que arma la pantalla y coordina; las piezas viven en módulos
 * propios para que ningún archivo supere las 400 líneas (ORDEN-RONDA-10 §3.1):
 *  - Encabezado prellenado: requerimiento-encabezado.js
 *  - Presupuestos (lista + subida): requerimiento-presupuestos.js
 *  - Valores de referencia y cálculo vivo: requerimiento-valores.js
 *  - Cantidades de la OCA: requerimiento-oca.js
 *  - Borrador local propio por expediente: requerimiento-borrador.js
 *
 * La validación del cliente es conveniencia; el servidor re-valida todo por
 * su cuenta (server/expedientes.js, apiGuardar).
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('requerimiento-formulario.js requiere que namespaces.js se cargue primero');
  }

  var req = SGC.core.requerimiento;

  var estado = {
    repo: null,
    operador: null,
    dom: {},
    expedienteId: null,
    version: null,
    ocaVisible: null
  };

  function qs(raiz, selector) {
    return raiz.querySelector(selector);
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

  function avisar(mensaje, esError) {
    if (!estado.dom.msj) {
      return;
    }
    estado.dom.msj.textContent = mensaje;
    estado.dom.msj.className = esError ? 'exp-mensaje exp-mensaje-error' : 'exp-mensaje exp-mensaje-ok';
    estado.dom.msj.hidden = false;
  }

  function expedienteActual() {
    if (!SGC.views.expediente || typeof SGC.views.expediente.obtener !== 'function') {
      return null;
    }
    var actual = SGC.views.expediente.obtener();
    return actual && actual.expediente ? actual.expediente : null;
  }

  // El expediente llega plano (identificacion, renglones y presupuestos en el
  // primer nivel); la misma normalización que hace core/requerimiento.js.
  function datosDe(expediente) {
    return (expediente && typeof expediente.datos === 'object' && expediente.datos) ||
      expediente || {};
  }

  function leerCampos() {
    return SGC.views.requerimientoEncabezado.leerCampos();
  }

  function leerBorrador() {
    return SGC.views.requerimientoBorrador.leer();
  }

  function limpiarBorrador() {
    SGC.views.requerimientoBorrador.limpiar();
  }

  // ---------------------------------------------------------------------------
  // Guardar y anexos
  // ---------------------------------------------------------------------------
  function validarCliente(expediente) {
    var errores = SGC.views.requerimientoValores.errores();
    var leido = SGC.views.requerimientoValores.leer();
    var renglones = datosDe(expediente).renglones || [];
    for (var i = 0; i < renglones.length; i++) {
      var temp = {};
      for (var k in renglones[i]) {
        if (Object.prototype.hasOwnProperty.call(renglones[i], k)) {
          temp[k] = renglones[i][k];
        }
      }
      temp.valoresReferencia = leido.valores[i];
      if (leido.cantidades[i].maxima !== undefined) {
        temp.cantidadMaxima = leido.cantidades[i].maxima;
      }
      if (leido.cantidades[i].minima !== undefined) {
        temp.cantidadMinima = leido.cantidades[i].minima;
      }
      var v = SGC.core.validacion.validarRenglon(temp);
      for (var e = 0; e < v.errores.length; e++) {
        errores.push('Renglón ' + (i + 1) + ': ' + v.errores[e]);
      }
    }
    return errores;
  }

  function guardar() {
    var expediente = expedienteActual();
    if (!expediente || !estado.repo) {
      return;
    }
    var errores = validarCliente(expediente);
    if (errores.length > 0) {
      avisar('No se puede guardar todavía: ' + errores.join(' · '), true);
      return;
    }
    var copia = JSON.parse(JSON.stringify(expediente));
    var rq = leerCampos();
    rq.condicionesParticulares = estado.dom.condiciones.value;
    copia.requerimiento = rq;
    var leido = SGC.views.requerimientoValores.leer();
    var renglones = datosDe(copia).renglones || [];
    for (var i = 0; i < renglones.length; i++) {
      renglones[i].valoresReferencia = leido.valores[i];
      renglones[i].cantidadMaxima = leido.cantidades[i].maxima;
      renglones[i].cantidadMinima = leido.cantidades[i].minima;
    }
    estado.repo.guardarExpediente(estado.expedienteId, copia, estado.version, contextoActual())
      .then(function (respuesta) {
        if (respuesta.conflicto) {
          avisar('El expediente fue modificado por otro operador (versión actual en el servidor: ' +
            respuesta.versionRemota + '). No se guardó nada.', true);
          return;
        }
        if (!respuesta.ok) {
          avisar('No se pudo guardar el requerimiento: ' + (respuesta.error || 'error desconocido'), true);
          return;
        }
        limpiarBorrador();
        avisar('Requerimiento guardado (versión ' + respuesta.version + ').', false);
        SGC.views.expediente.abrir(estado.expedienteId);
      })
      .catch(function (err) {
        avisar('No se pudo guardar el requerimiento: ' + err.message, true);
      });
  }

  function generarAnexos() {
    var expediente = expedienteActual();
    if (!expediente || !estado.repo) {
      return;
    }
    var ae = SGC.core.anexoEett;
    if (!ae.tieneContenido(expediente)) {
      avisar('Ningún renglón desborda y no hay condiciones particulares: no se genera ningún anexo.', false);
      return;
    }
    var documentos = SGC.renders.anexoEett.componerTodos(expediente);
    var nombres = [];
    var fallos = [];
    function siguiente(k) {
      if (k >= documentos.length) {
        if (fallos.length > 0) {
          avisar('Algunos anexos no se pudieron guardar: ' + fallos.join(' · '), true);
        } else {
          avisar('Anexo(s) de EETT generado(s) y guardado(s): ' + nombres.join(', ') + '.', false);
          SGC.views.expediente.abrir(estado.expedienteId);
        }
        return;
      }
      var doc = documentos[k];
      estado.repo.guardarEntregable(estado.expedienteId, doc.archivo, doc.html,
        contextoActual(), 'anexo-eett').then(function () {
        nombres.push(doc.nombre);
        siguiente(k + 1);
      }).catch(function (err) {
        fallos.push(doc.nombre + ' (' + err.message + ')');
        siguiente(k + 1);
      });
    }
    siguiente(0);
  }

  // ---------------------------------------------------------------------------
  // Actualización desde la vista de expediente
  // ---------------------------------------------------------------------------
  function refrescarOcaSiCambia(expediente) {
    var oca = req.ocaActiva(leerCampos(), datosDe(expediente).renglones);
    if (oca === estado.ocaVisible) {
      return;
    }
    estado.ocaVisible = oca;
    fijarValores(expediente);
  }

  function fijarValores(expediente) {
    var datos = datosDe(expediente);
    var borrador = leerBorrador();
    var renglones = Array.isArray(datos.renglones) ? datos.renglones : [];
    var guardados = borrador && Array.isArray(borrador.datos.valores)
      ? borrador.datos.valores
      : renglones.map(function (r) { return r.valoresReferencia; });
    var cantidadesGuardadas = borrador && Array.isArray(borrador.datos.cantidades)
      ? borrador.datos.cantidades
      : renglones.map(function (r) {
        return { maxima: r.cantidadMaxima, minima: r.cantidadMinima };
      });
    SGC.views.requerimientoValores.fijarDatos(
      renglones,
      Array.isArray(datos.presupuestos) ? datos.presupuestos : [],
      guardados,
      cantidadesGuardadas,
      { mostrarOca: estado.ocaVisible === true, editable: true }
    );
  }

  function actualizar() {
    var expediente = expedienteActual();
    var visible = !!expediente &&
      SGC.core.utils.idEstado(expediente) === 'ESPECIFICACIONES_TECNICAS' &&
      expediente.archivado !== true;
    if (!estado.dom.seccion) {
      return;
    }
    if (!visible) {
      estado.dom.seccion.hidden = true;
      estado.expedienteId = null;
      return;
    }
    var actual = SGC.views.expediente.obtener();
    estado.dom.seccion.hidden = false;
    estado.expedienteId = expediente.expedienteId || expediente.id;
    estado.version = actual.version;
    SGC.views.requerimientoBorrador.fijarExpedienteId(estado.expedienteId);
    SGC.views.requerimientoPresupuestos.render(expediente);
    SGC.views.requerimientoEncabezado.prellenar(expediente, leerBorrador());
    estado.dom.condiciones.value = valorCondiciones(leerBorrador());
    estado.ocaVisible = req.ocaActiva(leerCampos(), datosDe(expediente).renglones);
    fijarValores(expediente);
  }

  // Condiciones particulares con la misma precedencia que el resto: borrador
  // local → valor ya guardado en el requerimiento → vacío.
  function valorCondiciones(borrador) {
    var info = req.requerimientoDe(expedienteActual());
    var rq = info.requerimiento || {};
    var condicionesBorrador = borrador && borrador.datos.condicionesParticulares;
    return typeof condicionesBorrador === 'string'
      ? condicionesBorrador
      : (typeof rq.condicionesParticulares === 'string' ? rq.condicionesParticulares : '');
  }

  // ---------------------------------------------------------------------------
  // Montaje y eventos
  // ---------------------------------------------------------------------------
  function montar(raiz) {
    estado.dom.raiz = raiz;
    estado.dom.seccion = qs(raiz, '#sgc-requerimiento-seccion');
    estado.dom.condiciones = qs(raiz, '#sgc-req-condiciones');
    estado.dom.msj = qs(raiz, '#sgc-requerimiento-msj');

    var contenedorEncabezado = qs(raiz, '#sgc-req-encabezado');
    if (contenedorEncabezado) {
      SGC.views.requerimientoEncabezado.construir(contenedorEncabezado);
    }
    SGC.views.requerimientoValores.montar(raiz);
    SGC.views.requerimientoPresupuestos.montar(raiz, {
      listos: function () {
        return !!expedienteActual() && !!estado.repo &&
          typeof estado.repo.guardarPresupuesto === 'function';
      },
      repo: function () { return estado.repo; },
      expedienteId: function () { return estado.expedienteId; },
      contexto: contextoActual,
      avisar: avisar
    });
    SGC.views.requerimientoBorrador.definirProveedor({
      campos: leerCampos,
      condiciones: function () { return estado.dom.condiciones ? estado.dom.condiciones.value : ''; },
      valoresLeidos: function () { return SGC.views.requerimientoValores.leer(); },
      operadorEmail: function () {
        return estado.operador && estado.operador.email ? estado.operador.email : '';
      }
    });

    if (estado.dom.seccion) {
      estado.dom.seccion.addEventListener('input', function (evento) {
        var objetivo = evento.target;
        if (objetivo.hasAttribute && objetivo.hasAttribute('data-campo')) {
          refrescarOcaSiCambia(expedienteActual());
        }
        if (objetivo.hasAttribute && (objetivo.hasAttribute('data-presupuesto') ||
            objetivo.hasAttribute('data-base') || objetivo.hasAttribute('data-valor') ||
            objetivo.hasAttribute('data-oca-max') || objetivo.hasAttribute('data-oca-min'))) {
          SGC.views.requerimientoValores.alCambiar(objetivo);
        }
        SGC.views.requerimientoBorrador.guardar();
      });
      estado.dom.seccion.addEventListener('click', function (evento) {
        var objetivo = evento.target;
        if (objetivo.classList && objetivo.classList.contains('req-agregar-valor')) {
          SGC.views.requerimientoValores.agregarFila(Number(objetivo.getAttribute('data-indice')));
          SGC.views.requerimientoBorrador.guardar();
        } else if (objetivo.classList && objetivo.classList.contains('req-quitar-valor')) {
          var partes = objetivo.getAttribute('data-quitar').split(':');
          SGC.views.requerimientoValores.quitarFila(Number(partes[0]), Number(partes[1]));
          SGC.views.requerimientoBorrador.guardar();
        }
      });
    }
    var btnGuardar = qs(raiz, '#sgc-requerimiento-guardar');
    if (btnGuardar) {
      btnGuardar.addEventListener('click', guardar);
    }
    var btnAnexos = qs(raiz, '#sgc-generar-anexos');
    if (btnAnexos) {
      btnAnexos.addEventListener('click', generarAnexos);
    }
  }

  SGC.views.requerimientoFormulario = {
    montar: montar,
    actualizar: actualizar,
    fijarRepo: function (repo) { estado.repo = repo; },
    seleccionarOperador: function (operador) { estado.operador = operador; },
    fijarStorage: function (s) { SGC.views.requerimientoBorrador.fijarStorage(s); },
    leerBorrador: leerBorrador
  };
})(typeof window !== 'undefined' ? window : globalThis);
