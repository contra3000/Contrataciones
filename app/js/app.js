/*
 * app.js
 * Arranque de la aplicación (ORDEN-RONDA-05 §3.5 y ORDEN-RONDA-06 §3):
 * padrón de operadores, asistente de la Especificación Técnica con el
 * buscador embebido, tablero Kanban (una columna por fase) y vista de
 * expediente con Avanzar / Devolver, contra server/servidor.js.
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

  function alternarAlta() {
    document.getElementById('sgc-app').hidden = false;
    document.getElementById('sgc-kanban').hidden = true;
    document.getElementById('sgc-expediente').hidden = true;
  }

  function alternarTablero() {
    document.getElementById('sgc-app').hidden = true;
    document.getElementById('sgc-expediente').hidden = true;
    document.getElementById('sgc-kanban').hidden = false;
    SGC.views.kanban.refrescar();
  }

  function operadorSeleccionado(operador) {
    // La vista de expediente necesita los roles del operador para habilitar o
    // no los botones. El tablero es de visibilidad global (ADR-010).
    SGC.views.expediente.seleccionarOperador(operador);
    SGC.views.exportar.seleccionarOperador(operador);
    document.getElementById('sgc-tablero-nav').hidden = false;
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
    SGC.views.kanban.montar(contenedor);
    SGC.views.kanban.fijarRepo(repo);
    SGC.views.kanban.onAbrir(function (id) {
      document.getElementById('sgc-kanban').hidden = true;
      document.getElementById('sgc-app').hidden = true;
      document.getElementById('sgc-expediente').hidden = false;
      SGC.views.expediente.abrir(id);
    });
    SGC.views.expediente.montar(contenedor);
    SGC.views.expediente.fijarRepo(repo);
    SGC.views.expediente.onVolver(alternarTablero);

    // Documento y exportación (ORDEN-RONDA-07 §3.2-§3.4): imprime, guarda el
    // documento generado en la carpeta del expediente y exporta JSON o
    // resumen.md. Las descargas pasan por el modal de advertencia (FSD §6).
    SGC.views.exportar.montar(contenedor);
    SGC.views.exportar.fijarRepo(repo);
    SGC.views.exportar.fijarProveedor(function () {
      return SGC.views.expediente.obtener();
    });
    SGC.views.exportar.fijarDescargador(function (nombre, contenido) {
      var blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(url);
    });
    SGC.views.exportar.fijarNavegador(function (url) {
      window.open(url, '_blank');
    });

    // El buscador del paso 2 inicia la carga del catálogo y actualiza su
    // propio estado. Después se le avisa al asistente para guardar borradores
    // cuando cambie un renglón.
    var panelRenglones = document.getElementById('sgc-paso-renglones');
    SGC.catalogo.buscador.montar(panelRenglones);
    SGC.views.wizard.vincularRenglones();

    document.getElementById('sgc-nav-alta').addEventListener('click', alternarAlta);
    document.getElementById('sgc-nav-tablero').addEventListener('click', alternarTablero);

    // Padrón de operadores (ADR-017): se sirve desde config/.
    fetch('config/usuarios.ejemplo.json').then(function (res) {
      if (!res.ok) {
        throw new Error('el servidor respondió estado ' + res.status);
      }
      return res.json();
    }).then(function (padron) {
      SGC.views.wizard.renderOperadores(padron);
      var lista = document.getElementById('sgc-lista-operadores');
      var usuarios = (padron.usuarios || []).filter(function (u) {
        return u.activo;
      });
      for (var i = 0; i < usuarios.length; i++) {
        (function (operador) {
          var boton = lista.children[i].querySelector('button');
          boton.addEventListener('click', function () {
            operadorSeleccionado(operador);
          });
        })(usuarios[i]);
      }
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