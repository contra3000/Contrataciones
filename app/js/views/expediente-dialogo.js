/*
 * expediente-dialogo.js
 * Diálogo de transición de la vista de expediente (ORDEN-RONDA-06 §3.2 y §3.3).
 *
 * Extraído de expediente.js para no superar las 400 líneas por archivo. Aquí
 * vive:
 *
 *  - El avance con destino único (se ejecuta sin preguntar) o con varios
 *    destinos (el operador elige en el diálogo).
 *  - La devolución por observación: exige un motivo del catálogo cerrado de
 *    config.js y admite una observación opcional; sin motivo el confirmar
 *    queda deshabilitado.
 *  - La escritura (`repo.guardarExpediente`) y la traducción del 409 a un
 *    resultado con `conflicto` (nunca una excepción, nunca una sobrescritura
 *    silenciosa).
 *
 * La vista de expediente llama `avanzar(...)` / `devolver(...)` y recibe el
 * resultado por callback: `{ok:true, version}` o `{ok:false, conflicto:true,
 * versionRemota}` o `{ok:false, error}`.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('expediente-dialogo.js requiere que namespaces.js se cargue primero');
  }

  var config = SGC.core.config;
  var estados = SGC.core.estados;

  var estado = {
    repo: null,
    transicion: null,
    dom: {}
  };

  function qs(raiz, selector) {
    return raiz.querySelector(selector);
  }

  function limpiar(nodo) {
    while (nodo.children.length > 0) {
      nodo.removeChild(nodo.children[0]);
    }
  }

  function definirEstado(idEstado) {
    for (var i = 0; i < config.ESTADOS.length; i++) {
      if (config.ESTADOS[i].id === idEstado) {
        return config.ESTADOS[i];
      }
    }
    return null;
  }

  function contexto(operador, rol) {
    var op = operador || {};
    return {
      timestamp: new Date().toISOString(),
      email: op.email || 'anonimo',
      rol: rol,
      equipo: op.equipo || 'PC-NAVEGADOR'
    };
  }

  function guardar(expediente, nuevo, version, contexto, onResultado) {
    estado.repo.guardarExpediente(expediente.expedienteId, nuevo, version, contexto)
      .then(function (respuesta) {
        if (respuesta && respuesta.conflicto) {
          onResultado({ ok: false, conflicto: true, versionRemota: respuesta.versionRemota });
          return;
        }
        onResultado({ ok: true, version: respuesta.version });
      })
      .catch(function (err) {
        onResultado({ ok: false, conflicto: false, error: err.message });
      });
  }

  function ejecutarAvance(expediente, version, rol, destino, operador, onResultado) {
    var ctx = contexto(operador, rol);
    var resultado = estados.avanzar(expediente, rol, destino, ctx);
    if (!resultado.ok) {
      onResultado({ ok: false, conflicto: false, error: resultado.error });
      return;
    }
    guardar(expediente, resultado.expediente, version, ctx, onResultado);
  }

  function cerrarDialogo() {
    estado.dom.dialogo.hidden = true;
    estado.transicion = null;
    estado.dom.confirmar.disabled = true;
    limpiar(estado.dom.destino);
    limpiar(estado.dom.motivo);
    estado.dom.observacion.value = '';
  }

  function abrirDialogo(transicion) {
    estado.transicion = transicion;
    estado.dom.titulo.textContent = transicion.tipo === 'devolver'
      ? 'Devolver por observación' : 'Avanzar de fase';
    limpiar(estado.dom.destino);
    for (var i = 0; i < transicion.destinos.length; i++) {
      var opcion = document.createElement('option');
      opcion.value = transicion.destinos[i];
      var def = definirEstado(transicion.destinos[i]);
      opcion.textContent = def ? def.titulo : transicion.destinos[i];
      estado.dom.destino.appendChild(opcion);
    }
    estado.dom.destinoBloque.hidden = transicion.destinos.length <= 1;
    var esDevolver = transicion.tipo === 'devolver';
    estado.dom.motivoBloque.hidden = !esDevolver;
    estado.dom.observacionBloque.hidden = !esDevolver;
    if (esDevolver) {
      limpiar(estado.dom.motivo);
      for (var j = 0; j < config.MOTIVOS_DEVOLUCION.length; j++) {
        var m = config.MOTIVOS_DEVOLUCION[j];
        var op = document.createElement('option');
        op.value = m.id;
        op.textContent = m.texto;
        estado.dom.motivo.appendChild(op);
      }
      estado.dom.confirmar.disabled = true;
    } else {
      estado.dom.confirmar.disabled = false;
    }
    estado.dom.dialogo.hidden = false;
  }

  function confirmarTransicion() {
    var t = estado.transicion;
    if (!t) {
      return;
    }
    var motivo = estado.dom.motivo.value;
    var observacion = estado.dom.observacion.value.trim() || null;
    var destino = t.destinos.length === 1 ? t.destinos[0] : estado.dom.destino.value;
    cerrarDialogo();
    if (t.tipo === 'avanzar') {
      ejecutarAvance(t.expediente, t.version, t.rol, destino, t.operador, t.onResultado);
      return;
    }
    var ctx = contexto(t.operador, t.rol);
    var resultado = estados.devolver(t.expediente, t.rol, destino, motivo, observacion, ctx);
    if (!resultado.ok) {
      t.onResultado({ ok: false, conflicto: false, error: resultado.error });
      return;
    }
    guardar(t.expediente, resultado.expediente, t.version, ctx, t.onResultado);
  }

  function pedirAvanzar(expediente, version, rol, destinos, operador, onResultado) {
    if (destinos.length === 1) {
      ejecutarAvance(expediente, version, rol, destinos[0], operador, onResultado);
      return;
    }
    abrirDialogo({
      tipo: 'avanzar',
      expediente: expediente,
      version: version,
      rol: rol,
      destinos: destinos,
      operador: operador,
      onResultado: onResultado
    });
  }

  function pedirDevolver(expediente, version, rol, destinos, operador, onResultado) {
    abrirDialogo({
      tipo: 'devolver',
      expediente: expediente,
      version: version,
      rol: rol,
      destinos: destinos,
      operador: operador,
      onResultado: onResultado
    });
  }

  function montar(raiz) {
    estado.dom.dialogo = qs(raiz, '#sgc-expediente-dialogo');
    estado.dom.titulo = qs(raiz, '#sgc-expediente-dialogo-titulo');
    estado.dom.destinoBloque = qs(raiz, '#sgc-expediente-dialogo-destino-bloque');
    estado.dom.destino = qs(raiz, '#sgc-expediente-dialogo-destino');
    estado.dom.motivoBloque = qs(raiz, '#sgc-expediente-dialogo-motivo-bloque');
    estado.dom.motivo = qs(raiz, '#sgc-expediente-dialogo-motivo');
    estado.dom.observacionBloque = qs(raiz, '#sgc-expediente-dialogo-observacion-bloque');
    estado.dom.observacion = qs(raiz, '#sgc-expediente-dialogo-observacion');
    estado.dom.confirmar = qs(raiz, '#sgc-expediente-dialogo-confirmar');
    estado.dom.cancelar = qs(raiz, '#sgc-expediente-dialogo-cancelar');
    estado.dom.dialogo.hidden = true;

    estado.dom.confirmar.addEventListener('click', confirmarTransicion);
    estado.dom.cancelar.addEventListener('click', cerrarDialogo);
    estado.dom.motivo.addEventListener('change', function () {
      estado.dom.confirmar.disabled = estado.dom.motivo.value === '';
    });
  }

  SGC.views.expedienteDialogo = {
    montar: montar,
    fijarRepo: function (repo) {
      estado.repo = repo;
    },
    avanzar: pedirAvanzar,
    devolver: pedirDevolver
  };
})(typeof window !== 'undefined' ? window : globalThis);