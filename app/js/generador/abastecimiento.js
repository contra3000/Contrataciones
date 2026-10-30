/*
 * abastecimiento.js
 * ORDEN-RONDA-42 pieza 1a (ADR-043). El rol Abastecimiento del generador:
 * entrar con la identidad completa, elegir varios requerimientos exportados y
 * verlos en una lista. La consolidación llega en la pieza 2.
 *
 * Lo importante: el archivo que entra a esta pantalla es el que exportó quien
 * lo pidió, con su huella. Un avance, una plantilla o un archivo modificado no
 * se aceptan, y el rechazo dice el nombre del archivo. Nada se guarda entre
 * sesiones: el JSON de la SCo es el 7c.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.generadorIntercambio) {
    throw new Error('generador/abastecimiento.js requiere generador/intercambio.js');
  }

  var estado = {
    operador: null,
    requerimientos: [],
    mensajes: [],
    dom: {}
  };

  function porId(id) {
    return document.getElementById(id);
  }

  function textoDeRenglones(n) {
    return n === 1 ? '1 renglón' : n + ' renglones';
  }

  function claveDe(requerimiento) {
    if (requerimiento && typeof requerimiento.huella === 'string' &&
        requerimiento.huella !== '') {
      return requerimiento.huella;
    }
    return [requerimiento.titulo, requerimiento.anio, requerimiento.version].join('|');
  }

  function yaEsta(requerimiento) {
    var clave = claveDe(requerimiento);
    for (var i = 0; i < estado.requerimientos.length; i++) {
      if (claveDe(estado.requerimientos[i]) === clave) {
        return true;
      }
    }
    return false;
  }

  /*
   * La etiqueta de cada requerimiento para el consolidado y el ANEXO I: la
   * dependencia solicitante. Si dos requerimientos son de la misma dependencia,
   * se agrega el título entre paréntesis para no confundirlos.
   */
  function etiquetas() {
    var cuenta = {};
    var i;
    for (i = 0; i < estado.requerimientos.length; i++) {
      var d = estado.requerimientos[i].dependenciaSolicitante || '';
      cuenta[d] = (cuenta[d] || 0) + 1;
    }
    var salida = [];
    for (i = 0; i < estado.requerimientos.length; i++) {
      var req = estado.requerimientos[i];
      var dep = req.dependenciaSolicitante || '';
      var titulo = req.titulo || '';
      if (cuenta[dep] > 1 && titulo !== '') {
        salida.push(dep + ' (' + titulo + ')');
      } else {
        salida.push(dep || titulo);
      }
    }
    return salida;
  }

  function avisar() {
    var nodo = estado.dom.msj;
    if (!nodo) {
      return;
    }
    if (estado.mensajes.length === 0) {
      nodo.textContent = '';
      nodo.hidden = true;
      return;
    }
    nodo.textContent = estado.mensajes.join(' · ');
    nodo.hidden = false;
  }

  function pintarLista() {
    var lista = estado.dom.lista;
    if (!lista) {
      return;
    }
    while (lista.children.length > 0) {
      lista.removeChild(lista.children[0]);
    }
    for (var i = 0; i < estado.requerimientos.length; i++) {
      (function (req) {
        var li = document.createElement('li');
        li.setAttribute('data-huella', claveDe(req));
        var info = document.createElement('span');
        info.className = 'abast-requerimiento';
        info.textContent = (req.dependenciaSolicitante || '') + ' · ' +
          (req.titulo || '') + ' · ' + (req.anio || '') + ' · ' +
          (req.moneda || '') + ' · ' +
          textoDeRenglones(Array.isArray(req.renglones) ? req.renglones.length : 0);
        li.appendChild(info);
        var quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.className = 'secundario';
        quitar.textContent = 'Quitar';
        quitar.setAttribute('data-quitar-req', claveDe(req));
        quitar.setAttribute('aria-label', 'Quitar el requerimiento ' + (req.titulo || ''));
        quitar.addEventListener('click', function () {
          quitarRequerimiento(claveDe(req));
        });
        li.appendChild(quitar);
        lista.appendChild(li);
      })(estado.requerimientos[i]);
    }
  }

  function quitarRequerimiento(clave) {
    for (var i = 0; i < estado.requerimientos.length; i++) {
      if (claveDe(estado.requerimientos[i]) === clave) {
        estado.requerimientos.splice(i, 1);
        estado.mensajes = [];
        pintar();
        return;
      }
    }
  }

  function pintar() {
    pintarLista();
    avisar();
  }

  function leerTexto(archivo) {
    return new Promise(function (resolve, reject) {
      var lector = new FileReader();
      lector.onload = function () {
        resolve(lector.result);
      };
      lector.onerror = function () {
        reject(new Error('no se pudo leer'));
      };
      lector.readAsText(archivo);
    });
  }

  function agregarArchivo(archivo) {
    var nombre = archivo && archivo.name ? archivo.name : 'archivo.json';
    return leerTexto(archivo).then(function (texto) {
      return SGC.generadorIntercambio.leerRequerimiento(texto).then(function (resultado) {
        if (!resultado.ok) {
          estado.mensajes.push(nombre + ': ' + resultado.errores.join(' '));
          return;
        }
        if (yaEsta(resultado.requerimiento)) {
          estado.mensajes.push(nombre + ': ya está en la lista');
          return;
        }
        estado.requerimientos.push(resultado.requerimiento);
      });
    }).catch(function (err) {
      estado.mensajes.push(nombre + ': no se pudo leer (' +
        (err && err.message ? err.message : 'error') + ')');
    });
  }

  function alElegirArchivos() {
    var input = estado.dom.archivo;
    var archivos = input && input.files ? Array.prototype.slice.call(input.files) : [];
    if (archivos.length === 0) {
      return Promise.resolve();
    }
    estado.mensajes = [];
    var cadena = Promise.resolve();
    for (var i = 0; i < archivos.length; i++) {
      (function (archivo) {
        cadena = cadena.then(function () {
          return agregarArchivo(archivo);
        });
      })(archivos[i]);
    }
    return cadena.then(function () {
      pintar();
    });
  }

  function abrir(operador) {
    estado.operador = operador || null;
    var identidad = porId('sgc-generador-identidad');
    if (identidad) {
      identidad.hidden = true;
    }
    var seccion = porId('sgc-abastecimiento');
    if (seccion) {
      seccion.hidden = false;
    }
  }

  function montar() {
    estado.dom.archivo = porId('sgc-abast-archivos');
    estado.dom.lista = porId('sgc-abast-lista');
    estado.dom.msj = porId('sgc-abast-msj');
    estado.dom.seccion = porId('sgc-abastecimiento');
    estado.requerimientos = [];
    estado.mensajes = [];
    estado.operador = null;
    if (!estado.dom.archivo || !estado.dom.lista || !estado.dom.msj) {
      throw new Error('generador/abastecimiento.js requiere #sgc-abast-archivos, ' +
        '#sgc-abast-lista y #sgc-abast-msj');
    }
    estado.dom.archivo.addEventListener('change', function () {
      return alElegirArchivos();
    });
    pintar();
  }

  SGC.generadorAbastecimiento = {
    montar: montar,
    abrir: abrir,
    requerimientos: function () {
      return estado.requerimientos.slice();
    },
    etiquetas: etiquetas
  };
})(typeof window !== 'undefined' ? window : globalThis);
