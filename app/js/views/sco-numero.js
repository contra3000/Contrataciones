/*
 * sco-numero.js
 * ORDEN-RONDA-26 pieza 4. La SCo se inicia y se numera en COMPR.AR; este
 * formulario de Abastecimiento en SOLICITUD_CONTRATACION carga SOLO el número
 * que COMPR.AR asignó (texto libre no vacío). Lo firmable es el ANEXO I, uno
 * por SCo, y juntar los expedientes por SCo es la ronda 27: acá nada agrupa.
 *
 * El número se guarda en `campos.numeroSCo` (forma plana del expediente, por
 * donde `validacion.campoPresente` lo exige para avanzar) y, al guardarlo, el
 * servidor suma o saca el expediente del registro de la SCo
 * (`datos/sco/<año>/<n>.json`, ORDEN-RONDA-27 §3). Los hermanos de abajo salen
 * de ese registro, no de barrer el índice.
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
    version: null,
    versionSCo: null
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

  // "Esta SCo incluye también: ..." — hermanos según el REGISTRO de la SCo
  // (ORDEN-RONDA-27 §3). Antes salían de barrer el índice entero buscando
  // coincidencias de `numeroSCo`: cualquier expediente con el mismo texto
  // contaba como hermano, aunque nunca se hubiera sumado, y había que
  // traer el índice entero para mostrar una línea. Ahora la lista sale del
  // registro, que es el que sabe quiénes son.
  // De paso se guarda la versión del registro: es la que viaja al guardar, para
  // que el servidor detecte si otro operador se sumó o salió en el medio.
  function actualizarIncluidos(expediente) {
    var nodo = estado.dom.incluye;
    if (nodo) {
      nodo.hidden = true;
      nodo.textContent = '';
    }
    estado.versionSCo = null;
    if (!estado.repo || typeof estado.repo.leerSCo !== 'function') {
      return;
    }
    var numero = numeroSCoDe(expediente);
    if (!numero) {
      return;
    }
    var idActual = expediente.expedienteId || expediente.id;
    estado.repo.leerSCo(numero).then(function (registro) {
      if (!registro) {
        return;
      }
      estado.versionSCo = typeof registro.version === 'number' ? registro.version : null;
      var miembros = Array.isArray(registro.expedientes) ? registro.expedientes : [];
      var hermanos = [];
      for (var i = 0; i < miembros.length; i++) {
        if (miembros[i] !== idActual) {
          hermanos.push(miembros[i]);
        }
      }
      if (nodo && hermanos.length > 0) {
        nodo.textContent = 'Esta SCo incluye también: ' + hermanos.join(', ') + '.';
        nodo.hidden = false;
      }
    }).catch(function () {
      // sin registro disponible no se muestra el listado; el número ya quedó
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
    // La versión del registro que se leyó al abrir la pantalla viaja con el
    // guardado: si otro operador se sumó o salió de esta SCo entre la lectura y
    // este guardado, el servidor responde 409 y no escribe nada.
    estado.repo.guardarExpediente(estado.expedienteId, copia, estado.version, contextoActual(),
      estado.versionSCo)
      .then(function (resp) {
        if (resp.conflicto) {
          if (resp.versionRemota === null || resp.versionRemota === undefined) {
            avisar(resp.error || 'No se pudo guardar el número de SCo.', true);
            return;
          }
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
          // Regla de SCo del servidor (no se puede sumar a una SCo que ya
          // avanzó, no se puede salir de una que ya avanzó): el motivo llega
          // en castellano y se muestra tal cual.
          avisar(resp.error || 'No se pudo guardar el número de SCo: error desconocido', true);
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