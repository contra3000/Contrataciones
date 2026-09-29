/*
 * sco-numero.js
 * ORDEN-RONDA-26 pieza 4. La SCo se inicia y se numera en COMPR.AR; este
 * formulario de Abastecimiento en SOLICITUD_CONTRATACION carga SOLO el número
 * que COMPR.AR asignó (texto libre no vacío). Lo firmable es el ANEXO I, uno
 * por SCo, y juntar los expedientes por SCo es la ronda 27: acá nada agrupa.
 *
 * El número se guarda en `campos.numeroSCo` (forma plana del expediente, por
 * donde `validacion.campoPresente` lo exige para avanzar). Si otros
 * expedientes cargaron el mismo número, se enumeran abajo.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('sco-numero.js requiere que namespaces.js se cargue primero');
  }

  var ESTADO_OBJETIVO = 'SOLICITUD_CONTRATACION';

  var estado = {
    repo: null,
    operador: null,
    dom: {},
    expedienteId: null,
    version: null
  };

  function qs(raiz, sel) { return raiz.querySelector(sel); }

  // ADR-029 aplicado al DOM: cuando la vista busca un nodo por identificador y
  // no lo encuentra, falla ruidosamente en vez de escribir sobre null.
  function requerir(raiz, id) {
    var el = qs(raiz, id);
    if (!el) {
      throw new Error('sco-numero: no se encuentra el nodo "' + id + '" (ADR-029: lo que falta, falla ruidosamente)');
    }
    return el;
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

  // El número se lee siempre de la forma plana: `campos.numeroSCo`.
  function numeroSCoDe(expediente) {
    if (SGC.adapters.repo && typeof SGC.adapters.repo.numeroSCoDe === 'function') {
      return SGC.adapters.repo.numeroSCoDe(expediente);
    }
    var v = expediente && expediente.campos && expediente.campos.numeroSCo;
    return (v !== undefined && v !== null && v !== '') ? v : '';
  }

  // Quién edita: el ejecutor del estado, o quien lo hereda (ADR-033). Los
  // demás roles ven el número cargado pero no pueden tocarlo.
  function puedeEditar() {
    var def = null;
    for (var i = 0; i < SGC.core.config.ESTADOS.length; i++) {
      if (SGC.core.config.ESTADOS[i].id === ESTADO_OBJETIVO) {
        def = SGC.core.config.ESTADOS[i];
        break;
      }
    }
    var rolEjecutor = def ? def.rolEjecutor : null;
    if (!rolEjecutor) {
      return false;
    }
    var roles = (estado.operador && estado.operador.roles) || [];
    return roles.indexOf(rolEjecutor) !== -1;
  }

  // "Esta SCo incluye también: ..." — hermanos en el índice con el mismo
  // número. El índice queda a nombre del repo (el contrato lo expone según la
  // implementación); si la implementación no lo tiene, no se muestra nada.
  function actualizarIncluidos(expediente) {
    var nodo = estado.dom.incluye;
    if (!nodo) return;
    nodo.hidden = true;
    nodo.textContent = '';
    if (!estado.repo || typeof estado.repo.listarIndice !== 'function') {
      return;
    }
    var numero = numeroSCoDe(expediente);
    if (!numero) {
      return;
    }
    var idActual = expediente.expedienteId || expediente.id;
    estado.repo.listarIndice().then(function (indice) {
      var entradas = Array.isArray(indice) ? indice : [];
      var hermanos = [];
      for (var i = 0; i < entradas.length; i++) {
        var entry = entradas[i];
        if (entry && entry.id !== idActual && entry.numeroSCo === numero) {
          hermanos.push(entry.id);
        }
      }
      if (hermanos.length > 0) {
        nodo.textContent = 'Esta SCo incluye también: ' + hermanos.join(', ') + '.';
        nodo.hidden = false;
      }
    }).catch(function () {
      // sin índice disponible no se muestra el listado; el número ya quedó
      // guardado y el motor valida como siempre.
    });
  }

  function sincronizarBoton() {
    if (!estado.dom.guardar) return;
    var vacio = (estado.dom.numero.value || '').trim() === '';
    if (!puedeEditar()) {
      estado.dom.guardar.disabled = true;
    } else {
      estado.dom.guardar.disabled = vacio;
    }
  }

  // ---------------------------------------------------------------------------
  // montar: wiring del DOM
  // ---------------------------------------------------------------------------
  function montar(raiz) {
    estado.dom.raiz = raiz;
    estado.dom.numero = requerir(raiz, '#sgc-sco-numero');
    estado.dom.guardar = requerir(raiz, '#sgc-sco-guardar');
    estado.dom.incluye = requerir(raiz, '#sgc-sco-incluye');
    estado.dom.msj = requerir(raiz, '#sgc-sco-msj');
    estado.dom.numero.addEventListener('input', sincronizarBoton);
    estado.dom.guardar.addEventListener('click', guardar);
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

    var actual = SGC.views.expediente && typeof SGC.views.expediente.obtener === 'function'
      ? SGC.views.expediente.obtener() : null;
    estado.expedienteId = expediente.expedienteId || expediente.id;
    estado.version = actual ? actual.version : null;

    var numero = numeroSCoDe(expediente);
    if (estado.dom.numero.value !== numero) {
      estado.dom.numero.value = numero;
    }
    estado.dom.numero.disabled = !puedeEditar();
    sincronizarBoton();
    actualizarIncluidos(expediente);
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
    var numero = (estado.dom.numero.value || '').trim();
    if (!numero) {
      avisar('El número de SCo no puede quedar vacío.', true);
      return;
    }
    var copia = JSON.parse(JSON.stringify(expediente));
    if (typeof copia.campos !== 'object' || copia.campos === null) {
      copia.campos = {};
    }
    copia.campos.numeroSCo = numero;
    estado.repo.guardarExpediente(estado.expedienteId, copia, estado.version, contextoActual())
      .then(function (resp) {
        if (resp.conflicto) {
          var op = estado.operador || {};
          var esOtroOperador = !!resp.ultimoUsuario && resp.ultimoUsuario !== op.email;
          var texto = esOtroOperador
            ? 'El expediente fue modificado por otro operador'
            : 'El expediente fue modificado después de que usted lo abrió (posiblemente en otra pestaña)';
          avisar(texto + ' (versión ' +
            resp.versionRemota + '). No se guardó nada.', true);
          return;
        }
        if (!resp.ok) {
          avisar('No se pudo guardar el número de SCo: ' + (resp.error || 'error desconocido'), true);
          return;
        }
        estado.version = resp.version;
        avisar('Número de SCo guardado (versión ' + resp.version + ').', false);
        if (SGC.views.expediente && typeof SGC.views.expediente.abrir === 'function') {
          SGC.views.expediente.abrir(estado.expedienteId);
        }
      })
      .catch(function (err) {
        avisar('No se pudo guardar el número de SCo: ' + err.message, true);
      });
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  SGC.views.scoNumero = {
    montar: montar,
    actualizar: actualizar,
    fijarRepo: function (repo) { estado.repo = repo; },
    seleccionarOperador: function (op) { estado.operador = op; }
  };
})(typeof window !== 'undefined' ? window : globalThis);