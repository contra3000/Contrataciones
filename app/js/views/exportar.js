/*
 * exportar.js
 * ORDEN-RONDA-07 §3.2, §3.3 y §3.4. Acciones del documento en la vista de
 * expediente:
 *
 *  - Imprimir / Guardar como PDF: window.print() con la hoja de impresión
 *    (app/css/impresion.css, ADR-012).
 *  - Guardar documento generado: repo.guardarEntregable con el HTML compuesto
 *    por la plantilla del estado actual (SGC.renders.documento.paraEstado,
 *    ORDEN-RONDA-08 §2.1), y enlace al archivo guardado desde la vista (§3.3,
 *    ADR-016: se guarda el generado, no el firmado).
 *  - Exportar JSON: el datos.json crudo del expediente (§3.4).
 *  - Exportar resumen.md: el relato generado por SGC.renders.resumen (§3.4).
 *
 * Toda descarga o apertura fuera del sistema pasa por el modal de advertencia
 * obligatorio (FSD §6): recuerda que se está sacando información de un
 * sistema aislado y el manejo queda bajo responsabilidad del operador. La
 * descarga se produce únicamente desde el botón de confirmación descriptivo.
 *
 * El descargador y el navegador son inyectables para poder testear que nada
 * se descarga ni se abre sin el modal.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('exportar.js requiere que namespaces.js se cargue primero');
  }

  var estado = {
    repo: null,
    operador: null,
    proveedor: null,
    descargador: null,
    navegador: null,
    dom: {},
    pendiente: null,
    plantilla: null
  };

  function qs(raiz, selector) {
    return raiz.querySelector(selector);
  }

  // Plantilla del documento que produce el estado actual (ORDEN-RONDA-08
  // §2.1): documento, nombre de archivo e id del entregable del circuito.
  function plantillaActual() {
    var expediente = expedienteActual();
    if (!expediente) {
      return null;
    }
    return SGC.renders.documento.paraEstado(SGC.core.utils.idEstado(expediente));
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

  function expedienteActual() {
    if (typeof estado.proveedor === 'function') {
      var actual = estado.proveedor();
      if (actual && actual.expediente) {
        return actual.expediente;
      }
    }
    return null;
  }

  function avisar(mensaje, esError) {
    estado.dom.mensaje.textContent = mensaje;
    estado.dom.mensaje.className = esError ? 'exp-mensaje exp-mensaje-error' : 'exp-mensaje exp-mensaje-ok';
    estado.dom.mensaje.hidden = false;
  }

  function abrirModal(texto) {
    estado.dom.modalTexto.textContent = texto;
    estado.dom.modal.hidden = false;
  }

  function cerrarModal() {
    estado.dom.modal.hidden = true;
    estado.pendiente = null;
  }

  function confirmarModal() {
    var pendiente = estado.pendiente;
    cerrarModal();
    if (!pendiente) {
      return;
    }
    if (pendiente.tipo === 'descargar' && typeof estado.descargador === 'function') {
      estado.descargador(pendiente.nombre, pendiente.contenido);
    } else if (pendiente.tipo === 'abrir' && typeof estado.navegador === 'function') {
      estado.navegador(pendiente.url);
    }
  }

  // La descarga nunca ocurre acá: sólo se agenda detrás del modal.
  function agendarDescarga(nombre, contenido, texto) {
    estado.pendiente = { tipo: 'descargar', nombre: nombre, contenido: contenido };
    abrirModal(texto);
  }

  function exportarJson() {
    var expediente = expedienteActual();
    if (!expediente) {
      return;
    }
    agendarDescarga('datos.json', JSON.stringify(expediente, null, 2),
      'Va a exportar el datos.json del expediente ' + expediente.expedienteId +
      '. Se está sacando información de un sistema aislado; el manejo de la ' +
      'copia queda bajo su responsabilidad. ¿Confirma la descarga?');
  }

  function exportarResumen() {
    var expediente = expedienteActual();
    if (!expediente) {
      return;
    }
    agendarDescarga('resumen.md', SGC.renders.resumen.componer(expediente),
      'Va a exportar el resumen.md del expediente ' + expediente.expedienteId +
      '. Se está sacando información de un sistema aislado; el manejo de la ' +
      'copia queda bajo su responsabilidad. ¿Confirma la descarga?');
  }

  function enlazarDocumento(ruta, plantilla) {
    var expediente = expedienteActual();
    if (!expediente) {
      return;
    }
    var titulo = plantilla ? plantilla.titulo : 'documento';
    var idEntregable = plantilla ? plantilla.id : null;
    estado.dom.enlace.href = ruta;
    estado.dom.enlace.hidden = false;
    estado.dom.enlace.addEventListener('click', function (ev) {
      if (ev && typeof ev.preventDefault === 'function') {
        ev.preventDefault();
      }
      estado.pendiente = { tipo: 'abrir', url: estado.dom.enlace.href };
      abrirModal('Va a abrir el ' + titulo + ' guardado del expediente ' +
        expediente.expedienteId + '. Es información de un sistema aislado; su ' +
        'manejo queda bajo su responsabilidad. ¿Confirma?');
    });
  }

  function guardarDocumento() {
    var expediente = expedienteActual();
    if (!expediente) {
      return;
    }
    var plantilla = plantillaActual();
    if (!plantilla) {
      avisar('Este estado no produce un documento para guardar.', true);
      return;
    }
    var contenido = plantilla.componer(expediente);
    if (!estado.repo || typeof estado.repo.guardarEntregable !== 'function') {
      avisar('No hay repositorio configurado para guardar el documento.', true);
      return;
    }
    estado.repo.guardarEntregable(expediente.expedienteId, plantilla.nombre,
      contenido, contextoActual(), plantilla.id).then(function (respuesta) {
      avisar('Documento guardado en la carpeta del expediente (' + respuesta.ruta +
        ', versión ' + respuesta.version + ').', false);
      enlazarDocumento('api/expedientes/' + expediente.expedienteId +
        '/entregables/' + plantilla.nombre, plantilla);
    }).catch(function (err) {
      avisar('No se pudo guardar el documento: ' + err.message, true);
    });
  }

  function imprimir() {
    var plantilla = plantillaActual();
    if (plantilla) {
      // ORDEN-RONDA-08 §2.1: el @page de impresion.css declara el título del
      // documento; se sobreescribe con el de la hoja visible.
      SGC.renders.documento.fijarTituloImpresion(plantilla.titulo);
    }
    root.document.body.classList.add('imprimiendo');
    if (typeof root.print === 'function') {
      root.print();
    }
    root.document.body.classList.remove('imprimiendo');
  }

  function montar(raiz) {
    estado.dom.mensaje = qs(raiz, '#sgc-expediente-documento-msj');
    estado.dom.enlace = qs(raiz, '#sgc-expediente-documento-enlace');
    estado.dom.modal = qs(raiz, '#sgc-modal-advertencia');
    estado.dom.modalTexto = qs(raiz, '#sgc-modal-advertencia-texto');

    qs(raiz, '#sgc-expediente-documento-imprimir').addEventListener('click', imprimir);
    qs(raiz, '#sgc-expediente-documento-guardar').addEventListener('click', guardarDocumento);
    qs(raiz, '#sgc-expediente-exportar-json').addEventListener('click', exportarJson);
    qs(raiz, '#sgc-expediente-exportar-resumen').addEventListener('click', exportarResumen);
    qs(raiz, '#sgc-modal-advertencia-confirmar').addEventListener('click', confirmarModal);
    qs(raiz, '#sgc-modal-advertencia-cancelar').addEventListener('click', cerrarModal);
  }

  SGC.views.exportar = {
    montar: montar,
    fijarRepo: function (repo) {
      estado.repo = repo;
    },
    seleccionarOperador: function (operador) {
      estado.operador = operador;
    },
    fijarProveedor: function (fn) {
      estado.proveedor = fn;
    },
    fijarDescargador: function (fn) {
      estado.descargador = fn;
    },
    fijarNavegador: function (fn) {
      estado.navegador = fn;
    },
    // Lo llama la vista de expediente en cada render: recalcula la plantilla
    // del documento según el estado actual.
    actualizar: function () {
      estado.plantilla = plantillaActual();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);