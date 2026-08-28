/*
 * usar-base.js
 * ORDEN-RONDA-13 §4 (ADR-025). Revisión de la base de un expediente
 * perfeccionado antes de crear el nuevo.
 *
 * Muestra la lista blanca que el servidor propone (GET /api/archivo/<id>/base)
 * y deja seleccionar renglones por índice; los códigos dados de baja en el
 * catálogo vigente se marcan y no se pueden copiar. POST /api/expedientes/base
 * crea el expediente nuevo con `basadoEn` y el evento reuso_base.
 *
 * La sección y sus nodos viven en index.html; este módulo sólo la puebla.
 * Sin innerHTML: todo se arma con createElement y textContent.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('usar-base.js requiere que namespaces.js se cargue primero');
  }

  var estado = {
    repo: null,
    onCreado: null,
    onVolver: null,
    operador: null,
    base: null,
    dom: {}
  };

  var CAMPOS = [
    { clave: 'titulo', etiqueta: 'Objeto' },
    { clave: 'justificacion', etiqueta: 'Justificación de la necesidad' },
    { clave: 'rubroCodigo', etiqueta: 'Rubro comercial (código)' },
    { clave: 'rubroDescripcion', etiqueta: 'Rubro comercial (descripción)' },
    { clave: 'modalidadCompra', etiqueta: 'Modalidad de compra sugerida' },
    { clave: 'procedimientoSeleccion', etiqueta: 'Procedimiento de selección sugerido' },
    { clave: 'condicionesParticulares', etiqueta: 'Especificaciones técnicas' }
  ];

  function qs(raiz, selector) {
    return raiz.querySelector(selector);
  }

  function limpiar(nodo) {
    while (nodo.children.length > 0) {
      nodo.removeChild(nodo.children[0]);
    }
  }

  function contextoOperador() {
    var o = estado.operador || {};
    return {
      email: o.email || null,
      rol: Array.isArray(o.roles) ? o.roles[0] || null : null,
      equipo: o.equipo || null
    };
  }

  function mostrarMensaje(texto) {
    estado.dom.mensaje.textContent = texto;
    estado.dom.mensaje.hidden = false;
  }

  function mostrarError(texto) {
    estado.dom.error.textContent = texto;
    estado.dom.error.hidden = false;
  }

  function renderCampos(base) {
    limpiar(estado.dom.campos);
    for (var i = 0; i < CAMPOS.length; i++) {
      var c = CAMPOS[i];
      var valor = base[c.clave];
      if (valor === null || valor === undefined || valor === '') {
        continue;
      }
      var dt = document.createElement('dt');
      dt.textContent = c.etiqueta;
      var dd = document.createElement('dd');
      dd.textContent = String(valor);
      estado.dom.campos.appendChild(dt);
      estado.dom.campos.appendChild(dd);
    }
  }

  function renderRenglones(base) {
    limpiar(estado.dom.lista);
    for (var i = 0; i < base.renglones.length; i++) {
      (function (indice) {
        var r = base.renglones[indice];
        var li = document.createElement('li');
        var rotulo = document.createElement('label');
        var casilla = document.createElement('input');
        casilla.type = 'checkbox';
        casilla.className = 'renglon-base';
        casilla.value = String(indice);
        if (r.dadoDeBaja) {
          casilla.disabled = true;
          li.className = 'dado-de-baja';
        }
        rotulo.appendChild(casilla);
        var texto = document.createElement('span');
        texto.textContent = r.descripcion
          ? r.codigo + ' · ' + r.descripcion + ' · ' + r.cantidad + ' ' + (r.unidad || '')
          : r.codigo + ' · ' + r.cantidad + ' ' + (r.unidad || '');
        rotulo.appendChild(texto);
        li.appendChild(rotulo);
        if (r.dadoDeBaja) {
          var aviso = document.createElement('p');
          aviso.className = 'base-invalida';
          aviso.textContent = 'Dado de baja en el catálogo vigente. Reemplácelo editando la propuesta.';
          li.appendChild(aviso);
        }
        estado.dom.lista.appendChild(li);
      })(i);
    }
  }

  function crear() {
    estado.dom.error.hidden = true;
    estado.dom.mensaje.hidden = true;
    var indices = [];
    var casillas = estado.dom.lista.querySelectorAll('.renglon-base');
    for (var i = 0; i < casillas.length; i++) {
      if (casillas[i].checked) {
        indices.push(parseInt(casillas[i].value, 10));
      }
    }
    if (indices.length === 0) {
      mostrarError('Seleccione al menos un renglón para copiar.');
      return;
    }
    mostrarMensaje('Creando expediente…');
    estado.repo.crearDesdeBase(estado.base.id, indices, contextoOperador()).then(function (respuesta) {
      if (typeof estado.onCreado === 'function') {
        estado.onCreado(respuesta.id);
      }
    }).catch(function (err) {
      estado.dom.mensaje.hidden = true;
      mostrarError('No se pudo crear el expediente: ' + err.message);
    });
  }

  function abrir(origenId) {
    limpiar(estado.dom.campos);
    limpiar(estado.dom.lista);
    estado.dom.error.hidden = true;
    estado.dom.mensaje.hidden = true;
    estado.dom.titulo.textContent = 'Revisar base: ' + origenId;
    estado.dom.resumen.textContent = 'Cargando…';
    estado.repo.baseDe(origenId).then(function (base) {
      estado.base = base;
      estado.dom.titulo.textContent = 'Revisar base: ' + base.id;
      estado.dom.resumen.textContent = 'Catálogo vigente ' + base.catalogoVersion +
        (base.codigosInvalidos.length > 0
          ? ' · ' + base.codigosInvalidos.length + ' códigos dados de baja'
          : ' · todos los códigos están vigentes');
      renderCampos(base);
      renderRenglones(base);
    }).catch(function (err) {
      estado.dom.resumen.textContent = '';
      mostrarError('No se pudo leer la base: ' + err.message);
    });
  }

  function montar(raiz) {
    estado.dom.titulo = qs(raiz, '#sgc-base-titulo');
    estado.dom.resumen = qs(raiz, '#sgc-base-resumen');
    estado.dom.error = qs(raiz, '#sgc-base-error');
    estado.dom.mensaje = qs(raiz, '#sgc-base-mensaje');
    estado.dom.campos = qs(raiz, '#sgc-base-campos');
    estado.dom.lista = qs(raiz, '#sgc-base-lista');
    qs(raiz, '#sgc-base-crear').addEventListener('click', crear);
    qs(raiz, '#sgc-base-volver').addEventListener('click', function () {
      if (typeof estado.onVolver === 'function') {
        estado.onVolver();
      }
    });
    qs(raiz, '#sgc-base-cancelar').addEventListener('click', function () {
      if (typeof estado.onVolver === 'function') {
        estado.onVolver();
      }
    });
  }

  SGC.views.usarBase = {
    montar: montar,
    fijarRepo: function (repo) {
      estado.repo = repo;
    },
    fijarOperador: function (operador) {
      estado.operador = operador;
    },
    onCreado: function (fn) {
      estado.onCreado = fn;
    },
    onVolver: function (fn) {
      estado.onVolver = fn;
    },
    abrir: abrir
  };
})(typeof window !== 'undefined' ? window : globalThis);