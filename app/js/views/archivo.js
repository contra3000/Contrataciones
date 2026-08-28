/*
 * archivo.js
 * ORDEN-RONDA-08 §2.2. Vista de lectura del Archivo Histórico: lista los
 * expedientes que completaron el circuito (llegaron a PERFECCIONADA y el
 * servidor los archivó) leyendo GET /api/archivo (el directorio del histórico,
 * no el índice). Cada entrada abre el expediente en la vista de sólo lectura:
 * la vista de expediente deshabilita avanzar/devolver cuando `archivado`.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('archivo.js requiere que namespaces.js se cargue primero');
  }

  var estado = {
    repo: null,
    onAbrir: null,
    onUsarBase: null,
    dom: {}
  };

  var ESTADO_FINAL = SGC.core.config.ESTADO_FINAL;

  function qs(raiz, selector) {
    return raiz.querySelector(selector);
  }

  function limpiar(nodo) {
    while (nodo.children.length > 0) {
      nodo.removeChild(nodo.children[0]);
    }
  }

  function formatearFecha(iso) {
    if (typeof iso !== 'string' || iso.length === 0) {
      return '—';
    }
    return iso.replace('T', ' ').replace(/\.\d{3}Z?$/, '');
  }

  function refrescar() {
    if (!estado.repo || !estado.dom.lista) {
      return;
    }
    estado.dom.error.hidden = true;
    estado.dom.conteo.textContent = 'Cargando…';
    estado.repo.listarArchivoHistorico().then(function (lista) {
      limpiar(estado.dom.lista);
      estado.dom.conteo.textContent = lista.length +
        (lista.length === 1 ? ' expediente archivado.' : ' expedientes archivados.');
      if (lista.length === 0) {
        var vacio = document.createElement('li');
        vacio.textContent = 'No hay expedientes archivados todavía.';
        estado.dom.lista.appendChild(vacio);
        return;
      }
      for (var i = 0; i < lista.length; i++) {
        var entrada = lista[i];
        var li = document.createElement('li');
        li.className = 'archivo-item';
        var boton = document.createElement('button');
        boton.type = 'button';
        boton.textContent = entrada.id + ' · ' + (entrada.titulo || 'sin título') +
          ' · ' + (entrada.estado || '');
        (function (id) {
          boton.addEventListener('click', function () {
            if (typeof estado.onAbrir === 'function') {
              estado.onAbrir(id);
            }
          });
        })(entrada.id);
        li.appendChild(boton);
        // Reuso de base (ADR-025, ORDEN-RONDA-13 §4): un expediente
        // perfeccionado puede convertirse en la plantilla de uno nuevo.
        if (entrada.estado === ESTADO_FINAL) {
          var botonBase = document.createElement('button');
          botonBase.type = 'button';
          botonBase.className = 'archivo-base';
          botonBase.textContent = 'Usar como base';
          (function (id) {
            botonBase.addEventListener('click', function () {
              if (typeof estado.onUsarBase === 'function') {
                estado.onUsarBase(id);
              }
            });
          })(entrada.id);
          li.appendChild(botonBase);
        }
        var detalle = document.createElement('p');
        detalle.className = 'archivo-detalle';
        detalle.textContent = 'Archivado: ' + formatearFecha(entrada.archivadoEn) +
          ' · Último operador: ' + (entrada.ultimoOperador || '—');
        li.appendChild(detalle);
        estado.dom.lista.appendChild(li);
      }
    }).catch(function (err) {
      estado.dom.error.textContent = 'No se pudo leer el archivo histórico: ' + err.message;
      estado.dom.error.hidden = false;
    });
  }

  function montar(raiz) {
    estado.dom.lista = qs(raiz, '#sgc-archivo-lista');
    estado.dom.conteo = qs(raiz, '#sgc-archivo-conteo');
    estado.dom.error = qs(raiz, '#sgc-archivo-error');
    qs(raiz, '#sgc-archivo-refrescar').addEventListener('click', refrescar);
  }

  SGC.views.archivo = {
    montar: montar,
    fijarRepo: function (repo) {
      estado.repo = repo;
    },
    onAbrir: function (fn) {
      estado.onAbrir = fn;
    },
    onUsarBase: function (fn) {
      estado.onUsarBase = fn;
    },
    refrescar: refrescar
  };
})(typeof window !== 'undefined' ? window : globalThis);