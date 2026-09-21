/*
 * requerimiento-presupuestos.js
 * ORDEN-RONDA-10 §3.1 (H11). Presupuestos de la pantalla de carga del
 * requerimiento: lista visible con nombre original, tamaño e id que asigna el
 * servidor; la subida verifica el archivo acá antes de llamar al servidor y
 * los errores se muestran en español junto al archivo.
 *
 * Vive separado de requerimiento-formulario.js para que ningún archivo de la
 * pantalla supere las 400 líneas (ORDEN-RONDA-10 §3.1). Los tipos admitidos
 * están repetidos a propósito (es la verificación previa que evita viajes al
 * servidor por un archivo que ya se ve mal acá), pero el LÍMITE del presupuesto
 * NO: se lee de core/limites.js, el único lugar donde se declara
 * (ORDEN-RONDA-23 §4), para que el aviso de acá y el rechazo del servidor no
 * digan números distintos.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('requerimiento-presupuestos.js requiere que namespaces.js se cargue primero');
  }

  var TIPOS_ADMITIDOS = ['application/pdf', 'image/png', 'image/jpeg'];
  var EXTENSIONES = ['pdf', 'png', 'jpg', 'jpeg'];

  var estado = { dom: {}, ganchos: null };

  // El límite no se escribe acá: se lee vivo del único lugar donde se declara
  // (core/limites.js, ORDEN-RONDA-23 §4).
  function limiteBytes() {
    return SGC.core.limites.LIMITE_PRESUPUESTO_BYTES;
  }

  function pesoLegible(bytes) {
    var n = typeof bytes === 'number' ? bytes : 0;
    if (n >= 1024 * 1024) {
      return SGC.core.limites.aMB(n) + ' MB';
    }
    return Math.round(n / 1024) + ' KB';
  }

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

  // MIME que se manda al servidor: el del archivo si es uno admitido; si no,
  // se deduce de la extensión (mismo criterio que tipoValido).
  function tipoDeArchivo(file) {
    if (file.type && TIPOS_ADMITIDOS.indexOf(file.type) !== -1) {
      return file.type;
    }
    var m = /\.([a-z0-9]+)$/i.exec(String(file.name || ''));
    var extension = m ? m[1].toLowerCase() : '';
    if (extension === 'pdf') {
      return 'application/pdf';
    }
    if (extension === 'png') {
      return 'image/png';
    }
    if (extension === 'jpg' || extension === 'jpeg') {
      return 'image/jpeg';
    }
    return file.type || 'application/octet-stream';
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
          li.textContent = file.name + ' (' + pesoLegible(file.size) + ')…';
          ul.appendChild(li);
        }
        function fallar(mensaje) {
          fallarArchivo(li, file, mensaje);
        }
        if (!tipoValido(file)) {
          fallar('el formato no es admitido; usá PDF, PNG o JPG.');
          return;
        }
        // El aviso es ANTES de subir y con el tamaño real y el máximo, al lado
        // del archivo (ORDEN-RONDA-23 §4). Ambos números salen de limites.js.
        if (file.size > limiteBytes()) {
          fallar('supera el máximo de ' + SGC.core.limites.textoLimite() +
            '; el archivo pesa ' + pesoLegible(file.size) + '.');
          return;
        }
        // ORDEN-RONDA-23 §3: el archivo viaja crudo, sin pasar por base64.
        // §4: mientras sube, la lista del archivo muestra el avance para que
        // nadie lo lea como "se colgó" y vuelva a apretar.
        estado.ganchos.repo().guardarPresupuesto(estado.ganchos.expedienteId(), {
          nombreOriginal: file.name,
          tipo: tipoDeArchivo(file),
          archivo: file,
          onProgress: function (cargado, total) {
            if (!li || !total) {
              return;
            }
            li.textContent = file.name + ' (' + pesoLegible(file.size) + ') · subiendo ' +
              Math.round((cargado / total) * 100) + '%';
          }
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
