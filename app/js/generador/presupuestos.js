/*
 * presupuestos.js
 * ORDEN-RONDA-28 §3 (ADR-044) + ORDEN-RONDA-31 pieza 1.
 * Presupuestos y demás documentos de referencia del generador: NO se suben.
 *
 * En la aplicación con servidor, un presupuesto es un archivo que el operador
 * sube y que queda en la carpeta del expediente (views/requerimiento-presupuestos.js
 * llama a repo.subirPresupuesto). El generador no tiene servidor ni carpeta: no
 * hay dónde dejar el archivo, y fingir que sí lo hay sería una mentira que
 * aparece después, cuando alguien busca el PDF y no está.
 *
 * Lo que sí se hace es ELEGIRLO en la propia máquina, para leerlo y anotar su
 * huella: nombre, tamaño, SHA-256, proveedor, fecha y de qué tipo es —
 * presupuesto, precio de plaza o justificación (ORDEN-RONDA-31 pieza 1). Nada
 * sale del equipo; el PDF original sigue donde estaba. Con eso el valor de
 * referencia se cita igual que en la aplicación con servidor —el renglón guarda
 * `presupuestoId`, y ese id es el de esta lista (ADR-022)—.
 *
 * Es una vista adaptada, no la del servidor: el contrato de los renglones es el
 * mismo; la única diferencia es que aquí la huella la calcula este módulo con
 * SGC.core.utils.sha256Hex, en la máquina propia.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC) {
    throw new Error('generador/presupuestos.js requiere que namespaces.js se cargue primero');
  }

  var estado = {
    lista: [],
    siguiente: 1,
    dom: {},
    alCambio: null
  };

  /*
   * Cómo se muestra un documento en la lista: nombre · proveedor · fecha ·
   * tipo de documento, y "sin huella" cuando no la hay (un archivo viejo
   * importado sin SHA-256 no se puede citar como sellado). El orden de las
   * tres primeras partes es fijo porque los tests y el informe leen esa línea
   * tal cual: "presupuesto-resma-2026.pdf · Librería Sur · 12/02/2026".
   */
  function textoDe(p) {
    var utils = SGC.core.utils;
    // ORDEN-RONDA-41 pieza 1c: un documento que vino en la plantilla no tiene
    // archivo todavía. Se muestra por proveedor, fecha y tipo, y dice que falta
    // el PDF (no "sin huella": todavía no hay nada que sellar).
    if (p.sinPdf === true) {
      var pendiente = [];
      if (p.proveedor) {
        pendiente.push(p.proveedor);
      }
      var fechaPendiente = utils.fechaCorta(p.fecha);
      if (fechaPendiente) {
        pendiente.push(fechaPendiente);
      }
      pendiente.push(utils.etiquetaDeTipo(utils.tipoDeDocumento(p)));
      pendiente.push('falta el PDF');
      return pendiente.join(' · ');
    }
    var partes = [p.nombreOriginal];
    if (p.proveedor) {
      partes.push(p.proveedor);
    }
    var fecha = utils.fechaCorta(p.fecha);
    if (fecha) {
      partes.push(fecha);
    }
    partes.push(utils.etiquetaDeTipo(utils.tipoDeDocumento(p)));
    if (typeof p.sha256 !== 'string' || p.sha256.trim() === '') {
      partes.push('sin huella');
    }
    return partes.join(' · ');
  }

  function avisar(mensaje) {
    if (estado.dom.msj) {
      estado.dom.msj.textContent = mensaje;
      estado.dom.msj.hidden = mensaje === '';
    }
  }

  function render() {
    var lista = estado.dom.lista;
    if (!lista) {
      return;
    }
    while (lista.children.length > 0) {
      lista.removeChild(lista.children[0]);
    }
    for (var i = 0; i < estado.lista.length; i++) {
      (function (p) {
        var li = document.createElement('li');
        li.className = 'req-presupuesto';
        li.setAttribute('data-presupuesto', p.id);
        var texto = document.createElement('span');
        texto.textContent = textoDe(p);
        li.appendChild(texto);
        // ORDEN-RONDA-41 pieza 1c: un documento "sin PDF" tiene su propio
        // selector de archivo. Al elegirlo se calculan nombre, tamaño y huella,
        // y el id no cambia: los valores de los renglones lo siguen citando.
        if (p.sinPdf === true) {
          var archivo = document.createElement('input');
          archivo.type = 'file';
          archivo.className = 'req-pdf';
          archivo.setAttribute('data-pdf-de', p.id);
          archivo.setAttribute('aria-label',
            'Elegir el PDF del documento de ' + (p.proveedor || 'referencia'));
          li.appendChild(archivo);
        }
        var quitar = document.createElement('button');
        quitar.type = 'button';
        quitar.className = 'req-quitar-valor';
        quitar.setAttribute('data-quitar', p.id);
        quitar.setAttribute('aria-label', 'Quitar el documento de referencia ' +
          (p.nombreOriginal || p.proveedor || p.id));
        quitar.textContent = 'Quitar';
        li.appendChild(quitar);
        lista.appendChild(li);
      })(estado.lista[i]);
    }
    if (typeof estado.alCambio === 'function') {
      estado.alCambio();
    }
  }

  /*
   * Los bytes del archivo elegido. En el navegador es file.arrayBuffer(); en
   * los tests, el montura puede dejar los bytes directos o un texto (a ese se
   * lo convierte con TextEncoder) para no tener que tocar el disco.
   */
  function leerBytes(archivo) {
    if (archivo && typeof archivo.arrayBuffer === 'function') {
      return Promise.resolve(archivo.arrayBuffer()).then(function (buffer) {
        return new Uint8Array(buffer);
      });
    }
    if (archivo && archivo.bytes) {
      return Promise.resolve(archivo.bytes);
    }
    if (archivo && typeof archivo.contenido === 'string' && typeof root.TextEncoder === 'function') {
      return Promise.resolve(new root.TextEncoder().encode(archivo.contenido));
    }
    return Promise.resolve(null);
  }

  function limpiarEntrada() {
    if (!estado.dom.archivo) {
      return;
    }
    estado.dom.archivo.value = '';
    // En el navegador, vaciar value ya vacía la lista de archivos; en los
    // tests el montura guarda los archivos aparte y hay que vaciarlos a mano.
    try {
      estado.dom.archivo.files = null;
    } catch (e) {
      /* el navegador ya dejó la lista vacía al limpiar value */
    }
  }

  /*
   * Agregar: obligatorio el archivo (sin él no hay nombre ni huella que citar)
   * y el cálculo de la huella. Se lee y se calcula en la propia máquina, y el
   * documento se anota recién cuando la huella está: un documento sin huella no
   * sirve para la auditoría de la ronda 31.
   */
  function agregar() {
    var entrada = estado.dom.archivo;
    var archivo = entrada && entrada.files && entrada.files.length > 0 ? entrada.files[0] : null;
    if (!archivo || typeof archivo.name !== 'string' || archivo.name.trim() === '') {
      avisar('Elegí el archivo del documento: el nombre del archivo es lo que se cita.');
      return;
    }
    var utils = SGC.core.utils;
    var registro = {
      id: idSiguiente(idsEnUso()),
      nombreOriginal: archivo.name.trim(),
      proveedor: String(estado.dom.proveedor.value || '').trim(),
      fecha: utils.fechaAIso(String(estado.dom.fecha.value || '').trim()),
      tipo: utils.tipoDeDocumento({ tipo: estado.dom.tipo ? estado.dom.tipo.value : '' }),
      referencia: true
    };

    leerBytes(archivo).then(function (bytes) {
      if (!bytes || typeof bytes.length !== 'number') {
        throw new Error('no se pudieron leer los bytes del archivo');
      }
      return utils.sha256Hex(bytes).then(function (huella) {
        registro.bytes = bytes.length;
        registro.sha256 = huella;
      });
    }).then(function () {
      estado.lista.push(registro);
      limpiarEntrada();
      if (estado.dom.proveedor) {
        estado.dom.proveedor.value = '';
      }
      if (estado.dom.fecha) {
        estado.dom.fecha.value = '';
      }
      if (estado.dom.tipo) {
        estado.dom.tipo.value = 'presupuesto';
      }
      avisar('');
      render();
    }).catch(function (error) {
      // No se borra lo que el usuario eligió: si falló la huella, el archivo
      // sigue elegido y se puede reintentar arreglando el problema.
      avisar('No se pudo leer el archivo: ' +
        (error && error.message ? error.message : 'error de lectura'));
    });
  }

  /*
   * ORDEN-RONDA-41 pieza 1c: completar el PDF de un documento que vino "sin
   * PDF" en la plantilla. Es el mismo cálculo que agregar() —nombre, tamaño y
   * SHA-256—, pero sobre un documento que ya existe: el id se conserva porque
   * es lo que citan los valores de los renglones.
   */
  function completarPdf(id, archivo) {
    if (!archivo || typeof archivo.name !== 'string' || archivo.name.trim() === '') {
      avisar('Elegí el archivo del documento: el nombre del archivo es lo que se cita.');
      return;
    }
    var utils = SGC.core.utils;
    leerBytes(archivo).then(function (bytes) {
      if (!bytes || typeof bytes.length !== 'number') {
        throw new Error('no se pudieron leer los bytes del archivo');
      }
      return utils.sha256Hex(bytes).then(function (huella) {
        for (var i = 0; i < estado.lista.length; i++) {
          var p = estado.lista[i];
          if (p.id === id) {
            p.nombreOriginal = archivo.name.trim();
            p.bytes = bytes.length;
            p.sha256 = huella;
            delete p.sinPdf;
            break;
          }
        }
        render();
        avisar('');
      });
    }).catch(function (error) {
      avisar('No se pudo leer el archivo: ' +
        (error && error.message ? error.message : 'error de lectura'));
    });
  }

  function quitar(id) {
    for (var i = 0; i < estado.lista.length; i++) {
      if (estado.lista[i].id === id) {
        estado.lista.splice(i, 1);
        render();
        return;
      }
    }
  }

  /*
   * Cargar una lista venida de un archivo (ORDEN-RONDA-28 §4, pieza 4).
   *
   * Los ids se respetan: son la referencia que citan los valores de cada
   * renglón (presupuestoId, ADR-022), así que cambiarles el id al importar
   * dejaría citing un presupuesto que no está. Sólo se renumeran los que
   * vengan vacíos o repetidos, que es lo único que no se podría citar.
   */
  function cargar(lista) {
    estado.lista = [];
    estado.siguiente = 1;
    var vistos = {};
    var entrantes = Array.isArray(lista) ? lista : [];
    for (var i = 0; i < entrantes.length; i++) {
      var p = entrantes[i];
      if (!p || typeof p !== 'object') {
        continue;
      }
      var nombre = typeof p.nombreOriginal === 'string' ? p.nombreOriginal.trim() : '';
      // ORDEN-RONDA-41 pieza 1c: un documento "sin PDF" no tiene nombre de
      // archivo todavía y, aun así, se conserva: es el que vino en la plantilla.
      var sinPdf = p.sinPdf === true;
      if (nombre === '' && !sinPdf) {
        continue;
      }
      var id = typeof p.id === 'string' ? p.id.trim() : '';
      if (id === '' || Object.prototype.hasOwnProperty.call(vistos, id)) {
        id = idSiguiente(vistos);
      }
      vistos[id] = true;
      var documento = {
        id: id,
        nombreOriginal: nombre,
        proveedor: typeof p.proveedor === 'string' ? p.proveedor : '',
        fecha: typeof p.fecha === 'string' ? p.fecha : '',
        // El tipo no es obligatorio en un JSON viejo: sin él, presupuesto.
        tipo: SGC.core.utils.tipoDeDocumento(p),
        bytes: typeof p.bytes === 'number' ? p.bytes : null,
        sha256: typeof p.sha256 === 'string' ? p.sha256 : '',
        referencia: true
      };
      if (sinPdf) {
        documento.sinPdf = true;
      }
      estado.lista.push(documento);
    }
    render();
    return estado.lista.length;
  }

  /*
   * El próximo id libre con el formato de esta vista (ref-1, ref-2, ...). El
   * contador arranca en 1 después de cargar: un archivo puede traer ids que no
   * son de esta forma, y el contador tiene que seguir después del último usado
   * para no repetir uno.
   */
  function idSiguiente(vistos) {
    var id = 'ref-' + estado.siguiente++;
    while (Object.prototype.hasOwnProperty.call(vistos, id)) {
      id = 'ref-' + estado.siguiente++;
    }
    return id;
  }

  function idsEnUso() {
    var mapa = {};
    for (var i = 0; i < estado.lista.length; i++) {
      mapa[estado.lista[i].id] = true;
    }
    return mapa;
  }

  function montar(raiz) {
    estado.dom.raiz = raiz;
    estado.dom.archivo = raiz.querySelector('#sgc-presup-archivo');
    estado.dom.tipo = raiz.querySelector('#sgc-presup-tipo');
    estado.dom.proveedor = raiz.querySelector('#sgc-presup-proveedor');
    estado.dom.fecha = raiz.querySelector('#sgc-presup-fecha');
    estado.dom.lista = raiz.querySelector('#sgc-presup-lista');
    estado.dom.msj = raiz.querySelector('#sgc-presup-msj');
    if (!estado.dom.archivo || !estado.dom.lista) {
      throw new Error('generador/presupuestos.js requiere #sgc-presup-archivo y #sgc-presup-lista');
    }
    raiz.querySelector('#sgc-presup-agregar').addEventListener('click', agregar);
    raiz.addEventListener('click', function (evento) {
      var objetivo = evento && evento.target;
      if (objetivo && objetivo.classList &&
          objetivo.classList.contains('req-quitar-valor') &&
          objetivo.getAttribute('data-quitar')) {
        quitar(objetivo.getAttribute('data-quitar'));
      }
    });
    // ORDEN-RONDA-41 pieza 1c: elegir el PDF de un documento "sin PDF". El
    // cambio burbujea hasta la raíz, igual que el clic de "Quitar".
    raiz.addEventListener('change', function (evento) {
      var objetivo = evento && evento.target;
      if (!objetivo || typeof objetivo.getAttribute !== 'function') {
        return;
      }
      var id = objetivo.getAttribute('data-pdf-de');
      if (!id) {
        return;
      }
      var archivo = objetivo.files && objetivo.files.length > 0 ? objetivo.files[0] : null;
      completarPdf(id, archivo);
    });
  }

  SGC.generadorPresupuestos = {
    montar: montar,
    cargar: cargar,
    listar: function () {
      return estado.lista.map(function (p) {
        var copia = {
          id: p.id,
          proveedor: p.proveedor,
          fecha: p.fecha,
          tipo: SGC.core.utils.tipoDeDocumento(p),
          referencia: true
        };
        // ORDEN-RONDA-41 pieza 1c: el documento "sin PDF" viaja con su marca y
        // sin nombre de archivo; el que ya tiene PDF, con su nombre.
        if (p.sinPdf === true) {
          copia.sinPdf = true;
        } else {
          copia.nombreOriginal = p.nombreOriginal;
        }
        // bytes y huella no son obligatorios: un archivo importado de una
        // versión vieja no los trae, y en ese caso no se inventan.
        if (typeof p.bytes === 'number') {
          copia.bytes = p.bytes;
        }
        if (typeof p.sha256 === 'string' && p.sha256 !== '') {
          copia.sha256 = p.sha256;
        }
        return copia;
      });
    },
    // Los valores ya escritos apuntan a un presupuesto que se quitó: se limpian
    // para que el cálculo no insinúe una cita que ya no existe.
    alQuitar: function (id) {
      return estado.lista.every(function (p) {
        return p.id !== id;
      });
    },
    alCambio: function (fn) {
      estado.alCambio = fn;
    },
    limpiar: function () {
      estado.lista = [];
      estado.siguiente = 1;
      if (estado.dom.archivo) {
        limpiarEntrada();
        estado.dom.proveedor.value = '';
        estado.dom.fecha.value = '';
        if (estado.dom.tipo) {
          estado.dom.tipo.value = 'presupuesto';
        }
        avisar('');
      }
      render();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);