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
    consolidado: [],
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

  function monedaDe(requerimiento) {
    return requerimiento && requerimiento.moneda === 'USD' ? 'USD' : 'ARS';
  }

  function hayConflictoDeMonedas() {
    var hayPesos = false;
    var hayDolares = false;
    for (var i = 0; i < estado.requerimientos.length; i++) {
      if (monedaDe(estado.requerimientos[i]) === 'USD') {
        hayDolares = true;
      } else {
        hayPesos = true;
      }
    }
    return hayPesos && hayDolares;
  }

  function titulosEn(moneda) {
    var titulos = [];
    for (var i = 0; i < estado.requerimientos.length; i++) {
      var req = estado.requerimientos[i];
      if (monedaDe(req) === moneda) {
        titulos.push(req.titulo || req.dependenciaSolicitante || 'sin título');
      }
    }
    return titulos.join(' · ');
  }

  function textoConflicto() {
    if (!hayConflictoDeMonedas()) {
      return '';
    }
    return 'No se juntan requerimientos en pesos y en dólares en una misma SCo. ' +
      'En ARS: ' + titulosEn('ARS') + '. En USD: ' + titulosEn('USD') + '.';
  }

  // El aviso de unidades sale de los renglones que llegaron, en el orden en que
  // se pidieron: el mismo código con dos unidades distintas va en dos renglones,
  // como en el servidor.
  function advertenciaDeUnidades() {
    var orden = [];
    var unidades = {};
    for (var i = 0; i < estado.requerimientos.length; i++) {
      var renglones = Array.isArray(estado.requerimientos[i].renglones)
        ? estado.requerimientos[i].renglones : [];
      for (var j = 0; j < renglones.length; j++) {
        var r = renglones[j];
        if (!r || typeof r.codigo !== 'string' || r.codigo.trim() === '') {
          continue;
        }
        var unidad = typeof r.unidad === 'string' ? r.unidad : '';
        if (unidad === '') {
          continue;
        }
        if (!unidades[r.codigo]) {
          unidades[r.codigo] = [];
          orden.push(r.codigo);
        }
        if (unidades[r.codigo].indexOf(unidad) === -1) {
          unidades[r.codigo].push(unidad);
        }
      }
    }
    var frases = [];
    for (var k = 0; k < orden.length; k++) {
      var codigo = orden[k];
      if (unidades[codigo].length > 1) {
        frases.push('el ' + codigo + ' viene en ' + unidades[codigo].join(' y en ') +
          ': van en renglones separados');
      }
    }
    return frases.join(' · ');
  }

  function entradas() {
    var etiquetasDe = etiquetas();
    var salida = [];
    for (var i = 0; i < estado.requerimientos.length; i++) {
      salida.push({
        etiqueta: etiquetasDe[i],
        renglones: Array.isArray(estado.requerimientos[i].renglones)
          ? estado.requerimientos[i].renglones : []
      });
    }
    return salida;
  }

  function formatearDesglose(desglose) {
    var partes = [];
    var lista = Array.isArray(desglose) ? desglose : [];
    for (var i = 0; i < lista.length; i++) {
      partes.push((lista[i].expediente || '') + ': ' + lista[i].cantidad);
    }
    return partes.join(' · ');
  }

  function avisar() {
    var nodo = estado.dom.msj;
    if (!nodo) {
      return;
    }
    var partes = estado.mensajes.slice();
    var conflicto = textoConflicto();
    if (conflicto !== '') {
      partes.push(conflicto);
    }
    if (partes.length === 0) {
      nodo.textContent = '';
      nodo.hidden = true;
      return;
    }
    nodo.textContent = partes.join(' · ');
    nodo.hidden = false;
  }

  function limpiarTabla() {
    var tbody = estado.dom.tbody;
    if (!tbody) {
      return;
    }
    while (tbody.children.length > 0) {
      tbody.removeChild(tbody.children[0]);
    }
  }

  function celda(fila, valor) {
    var td = document.createElement('td');
    td.textContent = valor === null || valor === undefined ? '' : String(valor);
    fila.appendChild(td);
  }

  function pintarTabla(filas) {
    var tbody = estado.dom.tbody;
    if (!tbody) {
      return;
    }
    limpiarTabla();
    for (var i = 0; i < filas.length; i++) {
      var r = filas[i];
      var tr = document.createElement('tr');
      celda(tr, r.codigo);
      celda(tr, r.descripcion);
      celda(tr, r.cantidad);
      celda(tr, r.unidad);
      celda(tr, formatearDesglose(r.desglose));
      tbody.appendChild(tr);
    }
  }

  function actualizarConsolidado() {
    var tabla = estado.dom.consolidado;
    var unidades = estado.dom.unidades;
    var boton = estado.dom.imprimir;
    if (!tabla) {
      return;
    }
    if (hayConflictoDeMonedas()) {
      estado.consolidado = [];
      limpiarTabla();
      tabla.hidden = true;
      if (unidades) {
        unidades.textContent = '';
        unidades.hidden = true;
      }
      if (boton) {
        boton.disabled = true;
      }
      return;
    }
    estado.consolidado = estado.requerimientos.length === 0 ? [] :
      SGC.core.consolidacion.renglones(entradas());
    pintarTabla(estado.consolidado);
    tabla.hidden = estado.consolidado.length === 0;
    if (unidades) {
      var aviso = advertenciaDeUnidades();
      unidades.textContent = aviso;
      unidades.hidden = aviso === '';
    }
    if (boton) {
      boton.disabled = estado.requerimientos.length === 0;
    }
  }

  function nodoConClase(contenedor, clase) {
    for (var i = 0; i < contenedor.children.length; i++) {
      var hijo = contenedor.children[i];
      if ((' ' + hijo.className + ' ').indexOf(' ' + clase + ' ') !== -1) {
        return hijo;
      }
    }
    return null;
  }

  // El stub de los tests no tiene insertBefore (children es un arreglo); el
  // navegador sí. La inserción después del encabezado se hace por los dos
  // caminos, sin depender de uno solo.
  function insertarDespues(contenedor, referencia, nodo) {
    if (typeof contenedor.insertBefore === 'function') {
      contenedor.insertBefore(nodo, referencia ? referencia.nextSibling : null);
      return nodo;
    }
    var hijos = contenedor.children;
    var indice = referencia ? hijos.indexOf(referencia) : hijos.length - 1;
    if (indice < 0) {
      contenedor.appendChild(nodo);
      return nodo;
    }
    hijos.splice(indice + 1, 0, nodo);
    nodo.parentNode = contenedor;
    return nodo;
  }

  function parrafo(texto, clase) {
    var p = document.createElement('p');
    if (clase) {
      p.className = clase;
    }
    p.textContent = texto;
    return p;
  }

  function titulo(texto) {
    var h = document.createElement('h2');
    h.textContent = texto;
    return h;
  }

  function tablaDeImpresion(filas) {
    var tabla = document.createElement('table');
    tabla.className = 'doc-tabla';
    var thead = document.createElement('thead');
    var filaEncabezado = document.createElement('tr');
    var columnas = ['Código', 'Descripción', 'Cantidad', 'Unidad', 'Desglose por expediente'];
    for (var c = 0; c < columnas.length; c++) {
      var th = document.createElement('th');
      th.textContent = columnas[c];
      filaEncabezado.appendChild(th);
    }
    thead.appendChild(filaEncabezado);
    tabla.appendChild(thead);
    var tbody = document.createElement('tbody');
    for (var i = 0; i < filas.length; i++) {
      var r = filas[i];
      var tr = document.createElement('tr');
      celda(tr, r.codigo);
      celda(tr, r.descripcion);
      celda(tr, r.cantidad);
      celda(tr, r.unidad);
      celda(tr, formatearDesglose(r.desglose));
      tbody.appendChild(tr);
    }
    tabla.appendChild(tbody);
    return tabla;
  }

  /*
   * ORDEN-RONDA-42 pieza 2c: el ANEXO I del generador. Se monta con la misma
   * plantilla del servidor (montar no imprime el bloque de la SCo, así que el
   * encabezado de la SCo y la tabla se agregan acá con nodos DOM, después del
   * encabezado). El número es el 7c: por ahora "SCo a asignar".
   */
  function imprimir() {
    if (estado.requerimientos.length === 0 || hayConflictoDeMonedas()) {
      return { ok: false };
    }
    if (!SGC.renders || !SGC.renders.anexoUno) {
      throw new Error('generador/abastecimiento.js requiere renders/anexo-1.js');
    }
    var filas = SGC.core.consolidacion.renglones(entradas());
    var seccion = estado.dom.impresion;
    if (!seccion) {
      return { ok: false };
    }
    SGC.renders.documento.limpiar(seccion);
    var hoja = document.createElement('div');
    hoja.className = 'documento-generador';
    seccion.appendChild(hoja);
    var expediente = {
      expedienteId: '',
      datos: {
        titulo: '',
        renglones: [],
        identificacion: {
          numero: 'SCo a asignar',
          unidadSolicitante: etiquetas().join(' · ')
        }
      }
    };
    SGC.renders.anexoUno.montar(hoja, expediente);
    var referencia = nodoConClase(hoja, 'doc-unidad');
    var datoSco = insertarDespues(hoja, referencia, parrafo('SCo: a asignar', 'doc-sco'));
    var tituloTabla = insertarDespues(hoja, datoSco, titulo('Renglones de la SCo'));
    insertarDespues(hoja, tituloTabla, tablaDeImpresion(filas));
    SGC.renders.documento.fijarTituloImpresion('ANEXO 1');
    document.body.classList.add('imprimiendo');
    if (typeof root.print === 'function') {
      root.print();
    }
    document.body.classList.remove('imprimiendo');
    return { ok: true };
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
    actualizarConsolidado();
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
    estado.dom.consolidado = porId('sgc-abast-consolidado');
    estado.dom.unidades = porId('sgc-abast-unidades');
    estado.dom.imprimir = porId('sgc-abast-imprimir');
    estado.dom.impresion = porId('sgc-generador-impresion');
    estado.dom.tbody = estado.dom.consolidado
      ? estado.dom.consolidado.querySelector('tbody') : null;
    estado.requerimientos = [];
    estado.consolidado = [];
    estado.mensajes = [];
    estado.operador = null;
    if (!estado.dom.archivo || !estado.dom.lista || !estado.dom.msj ||
        !estado.dom.consolidado || !estado.dom.tbody || !estado.dom.imprimir) {
      throw new Error('generador/abastecimiento.js requiere #sgc-abast-archivos, ' +
        '#sgc-abast-lista, #sgc-abast-msj, #sgc-abast-consolidado y #sgc-abast-imprimir');
    }
    estado.dom.archivo.addEventListener('change', function () {
      return alElegirArchivos();
    });
    estado.dom.imprimir.addEventListener('click', function () {
      return imprimir();
    });
    pintar();
  }

  SGC.generadorAbastecimiento = {
    montar: montar,
    abrir: abrir,
    requerimientos: function () {
      return estado.requerimientos.slice();
    },
    consolidado: function () {
      return estado.consolidado.slice();
    },
    etiquetas: etiquetas,
    imprimir: imprimir
  };
})(typeof window !== 'undefined' ? window : globalThis);
