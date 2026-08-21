/*
 * requerimiento-presupuestos.js
 * ORDEN-RONDA-10 §3.1 (H11). Presupuestos de la pantalla de carga del
 * requerimiento: lista visible con nombre original, tamaño e id que asigna el
 * servidor; la subida verifica el archivo acá antes de llamar al servidor y
 * los errores se muestran en español junto al archivo.
 *
 * Vive separado de requerimiento-formulario.js para que ningún archivo de la
 * pantalla supere las 400 líneas (ORDEN-RONDA-10 §3.1). Las reglas del lado
 * servidor (tipos admitidos, tope de 2 MB) están repetidas a propósito: es la
 * misma verificación previa que evita viajes al servidor por un archivo que ya
 * se ve mal acá.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('requerimiento-presupuestos.js requiere que namespaces.js se cargue primero');
  }

  var TIPOS_ADMITIDOS = ['application/pdf', 'image/png', 'image/jpeg'];
  var EXTENSIONES = ['pdf', 'png', 'jpg', 'jpeg'];
  var LIMITE_BYTES = 2 * 1024 * 1024;

  var estado = { dom: {}, ganchos: null };

  // El expediente llega plano; la misma normalización que hace
  // core/requerimiento.js.
  function datosDe(expediente) {
    return (expediente && typeof expediente.datos === 'object' && expediente.datos) ||
      expediente || {};
  }

  function tipoValido(file) {
    if (file.type && TIPOS_ADMITIDOS.indexOf(file.type) !== -1) {
      return true;
    }
    var m = /\.([a-z0-9]+)$/i.exec(String(file.name || ''));
    return !!m && EXTENSIONES.indexOf(m[1].toLowerCase()) !== -1;
  }

  function render(expediente) {
    var ul = estado.dom.presupuestosLista;
    if (!ul) {
      return;
    }
    while (ul.children.length > 0) {
      ul.removeChild(ul.children[0]);
    }
    var doc = document;
    var lista = Array.isArray(datosDe(expediente).presupuestos)
      ? datosDe(expediente).presupuestos : [];
    for (var i = 0; i < lista.length; i++) {
      var p = lista[i];
      var li = doc.createElement('li');
      li.textContent = p.nombreOriginal + ' · ' + Math.round((p.peso || 0) / 1024) + ' KB · id asignado: ' + p.id;
      ul.appendChild(li);
    }
  }

  function fallarArchivo(li, file, mensaje) {
    if (li) {
      li.textContent = file.name + ': ' + mensaje;
    }
    estado.ganchos.avisar('No se pudo subir "' + file.name + '": ' + mensaje, true);
  }

  function subirArchivos(archivos) {
    if (!estado.ganchos || !estado.ganchos.listos()) {
      return;
    }
    var ul = estado.dom.presupuestosLista;
    var doc = document;
    for (var i = 0; i < archivos.length; i++) {
      (function (file) {
        var li = doc ? doc.createElement('li') : null;
        if (li) {
          li.textContent = file.name + ' (' + Math.round(file.size / 1024) + ' KB)…';
          ul.appendChild(li);
        }
        function fallar(mensaje) {
          fallarArchivo(li, file, mensaje);
        }
        if (!tipoValido(file)) {
          fallar('el formato no es admitido; usá PDF, PNG o JPG.');
          return;
        }
        if (file.size > LIMITE_BYTES) {
          fallar('supera el límite de 2 MB.');
          return;
        }
        if (typeof root.FileReader !== 'function') {
          fallar('este navegador no permite leer archivos.');
          return;
        }
        var lector = new root.FileReader();
        lector.onload = function () {
          var base64 = String(lector.result).split(',')[1] || '';
          estado.ganchos.repo().guardarPresupuesto(estado.ganchos.expedienteId(), {
            nombreOriginal: file.name,
            tipo: file.type || 'application/octet-stream',
            contenidoBase64: base64
          }, estado.ganchos.contexto()).then(function (respuesta) {
            if (respuesta.conflicto || respuesta.error) {
              fallar(respuesta.error || 'conflicto de versión.');
              return;
            }
            estado.ganchos.avisar('Presupuesto guardado: "' + file.name + '" quedó como ' + respuesta.id + '.', false);
            SGC.views.expediente.abrir(estado.ganchos.expedienteId());
          }).catch(function (err) {
            fallar(err.message);
          });
        };
        lector.onerror = function () {
          fallar('no se pudo leer el archivo.');
        };
        lector.readAsDataURL(file);
      })(archivos[i]);
    }
  }

  // ganchos: { listos, repo, expedienteId, contexto, avisar } — todo lo que
  // depende del formulario (repo, operador, mensajes), inyectado en el montaje
  // para que el estado viva en un solo lugar.
  function montar(raiz, ganchos) {
    estado.dom.presupuestosArchivo = raiz.querySelector('#sgc-req-presupuesto-archivo');
    estado.dom.presupuestosLista = raiz.querySelector('#sgc-req-presupuestos-lista');
    estado.ganchos = ganchos;
    if (estado.dom.presupuestosArchivo) {
      estado.dom.presupuestosArchivo.addEventListener('change', function () {
        subirArchivos(estado.dom.presupuestosArchivo.files || []);
        estado.dom.presupuestosArchivo.value = '';
      });
    }
  }

  SGC.views.requerimientoPresupuestos = {
    montar: montar,
    render: render,
    subirArchivos: subirArchivos
  };
})(typeof window !== 'undefined' ? window : globalThis);
