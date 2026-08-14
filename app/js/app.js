/*
 * app.js
 * Arranque de la aplicación (ORDEN-RONDA-05 §3.5): padrón de operadores,
 * el asistente de la Especificación Técnica con el buscador embebido y la
 * persistencia real contra server/servidor.js.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;

  function mostrarError(texto) {
    var nodo = document.getElementById('sgc-app-error');
    if (nodo) {
      nodo.textContent = texto;
      nodo.hidden = false;
    }
  }

  function iniciar() {
    var contenedor = document.getElementById('app');
    if (!contenedor) {
      throw new Error('No se encontró el contenedor #app');
    }

    var repo = SGC.adapters.repoHttp.crear(root.location.origin);
    SGC.adapters.repo.usar(repo);

    SGC.views.wizard.montar(contenedor);
    SGC.views.wizard.fijarRepo(repo);

    // El buscador del paso 2 inicia la carga del catálogo y actualiza su
    // propio estado. Después se le avisa al asistente para guardar borradores
    // cuando cambie un renglón.
    var panelRenglones = document.getElementById('sgc-paso-renglones');
    SGC.catalogo.buscador.montar(panelRenglones);
    SGC.views.wizard.vincularRenglones();

    // Padrón de operadores (ADR-017): se sirve desde config/.
    fetch('config/usuarios.ejemplo.json').then(function (res) {
      if (!res.ok) {
        throw new Error('el servidor respondió estado ' + res.status);
      }
      return res.json();
    }).then(function (padron) {
      SGC.views.wizard.renderOperadores(padron);
    }).catch(function (err) {
      mostrarError('No se pudo cargar el padrón de operadores: ' + err.message);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})(window);