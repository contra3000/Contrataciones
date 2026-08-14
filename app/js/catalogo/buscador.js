/*
 * buscador.js
 * Pantalla de búsqueda en cascada (ORDEN-RONDA-04 §3.4).
 *
 * Flujo: el operador escribe en el campo de clases (rubro + clase), elige una
 * clase, filtra sus ítems y agrega renglones al pedido. Cada renglón compone
 * {codigo, cantidad, unidad, aclaracion} y se valida con
 * SGC.core.validacion.validarRenglon además de verificar que el código exista
 * en el catálogo cargado.
 *
 * Teclado: flechas arriba/abajo para moverse por las opciones, Enter para
 * elegir, Escape para cerrar el desplegable. Todo con roles ARIA (listbox,
 * option, combobox) y aria-activedescendant.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.catalogo) {
    throw new Error('buscador.js requiere que namespaces.js se cargue primero');
  }

  var LIMITE_SUGERENCIAS = 8;
  var LIMITE_ITEMS = 60;
  var MAX_ACLARACION = 200;

  var estado = {
    clases: [],
    claseActiva: -1,
    claseSeleccionada: null,
    items: [],
    itemsFiltrados: [],
    itemActivo: -1,
    renglones: [],
    siguienteId: 1,
    dom: {}
  };

  function qs(raiz, selector) {
    return raiz.querySelector(selector);
  }

  function resaltar(nodo, texto, tramos) {
    var lista = (tramos || []).slice().sort(function (a, b) {
      return a[0] - b[0];
    });
    var fusionados = [];
    for (var i = 0; i < lista.length; i++) {
      var ultimo = fusionados[fusionados.length - 1];
      if (ultimo && lista[i][0] <= ultimo[0] + ultimo[1]) {
        var finNuevo = Math.max(ultimo[0] + ultimo[1], lista[i][0] + lista[i][1]);
        ultimo[1] = finNuevo - ultimo[0];
      } else {
        fusionados.push([lista[i][0], lista[i][1]]);
      }
    }
    var frag = document.createDocumentFragment();
    var pos = 0;
    for (var j = 0; j < fusionados.length; j++) {
      var ini = fusionados[j][0];
      var lar = fusionados[j][1];
      if (ini > pos) {
        frag.appendChild(document.createTextNode(texto.slice(pos, ini)));
      }
      var marca = document.createElement('mark');
      marca.textContent = texto.slice(ini, ini + lar);
      frag.appendChild(marca);
      pos = ini + lar;
    }
    if (pos < texto.length) {
      frag.appendChild(document.createTextNode(texto.slice(pos)));
    }
    nodo.appendChild(frag);
  }

  function opcionClase(resultado, indice) {
    var li = document.createElement('li');
    li.id = 'sgc-opcion-clase-' + indice;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');
    li.tabIndex = -1;
    var titulo = document.createElement('span');
    titulo.className = 'opcion-titulo';
    resaltar(titulo, resultado.clase, resultado.coincidencias);
    var detalle = document.createElement('span');
    detalle.className = 'opcion-detalle';
    detalle.textContent = resultado.rubro + ' - ' + resultado.cantidad + ' ítems';
    li.appendChild(titulo);
    li.appendChild(detalle);
    li.addEventListener('mousedown', function (ev) {
      ev.preventDefault();
      seleccionarClase(resultado);
    });
    return li;
  }

  function renderClases() {
    var lista = estado.dom.listaClases;
    lista.textContent = '';
    for (var i = 0; i < estado.clases.length; i++) {
      lista.appendChild(opcionClase(estado.clases[i], i));
    }
    estado.claseActiva = -1;
  }

  function abrirLista(lista, campo) {
    lista.hidden = false;
    campo.setAttribute('aria-expanded', 'true');
  }

  function cerrarLista() {
    var lista = estado.dom.listaClases;
    lista.hidden = true;
    estado.claseActiva = -1;
    estado.dom.campoClases.setAttribute('aria-activedescendant', '');
    estado.dom.campoClases.setAttribute('aria-expanded', 'false');
  }

  function marcarClaseActiva(campo, lista) {
    for (var i = 0; i < lista.children.length; i++) {
      var op = lista.children[i];
      var activa = i === estado.claseActiva;
      op.setAttribute('aria-selected', activa ? 'true' : 'false');
      if (activa) {
        op.classList.add('activo');
      } else {
        op.classList.remove('activo');
      }
    }
    if (estado.claseActiva >= 0 && estado.claseActiva < estado.clases.length) {
      var id = 'sgc-opcion-clase-' + estado.claseActiva;
      campo.setAttribute('aria-activedescendant', id);
      var activaOp = qs(lista, '#' + id);
      if (activaOp) {
        activaOp.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function alEscribirClases() {
    var valor = estado.dom.campoClases.value;
    estado.clases = SGC.catalogo.indice.buscarClases(valor, LIMITE_SUGERENCIAS);
    renderClases();
    if (estado.clases.length > 0) {
      abrirLista(estado.dom.listaClases, estado.dom.campoClases);
    } else {
      cerrarLista();
    }
  }

  function seleccionarClase(clase) {
    estado.claseSeleccionada = clase;
    estado.dom.campoClases.value = clase.clase;
    cerrarLista();
    estado.dom.panelItems.hidden = false;
    estado.dom.tituloClase.textContent = clase.clase + ' — ' + clase.rubro;
    estado.dom.detalleClase.textContent = clase.cantidad + ' ítems';
    estado.dom.campoItems.value = '';
    SGC.catalogo.carga.cargarClase(clase.idClase).then(function (items) {
      estado.items = items;
      estado.itemsFiltrados = SGC.catalogo.indice.buscarEnItems('', items, LIMITE_ITEMS);
      renderItems();
      estado.dom.campoItems.focus();
    }).catch(function (err) {
      estado.dom.tituloClase.textContent = 'Error al cargar la clase: ' + err.message;
    });
  }

  function opcionItem(resultado, indice) {
    var li = document.createElement('li');
    li.id = 'sgc-opcion-item-' + indice;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');
    li.tabIndex = -1;
    var codigo = document.createElement('span');
    codigo.className = 'opcion-codigo';
    codigo.textContent = resultado.codigo;
    var texto = document.createElement('span');
    texto.className = 'opcion-titulo';
    resaltar(texto, resultado.item, resultado.coincidencias);
    li.appendChild(codigo);
    li.appendChild(texto);
    li.addEventListener('mousedown', function (ev) {
      ev.preventDefault();
      agregarRenglon(resultado);
    });
    return li;
  }

  function renderItems() {
    var lista = estado.dom.listaItems;
    lista.textContent = '';
    for (var i = 0; i < estado.itemsFiltrados.length; i++) {
      lista.appendChild(opcionItem(estado.itemsFiltrados[i], i));
    }
    estado.itemActivo = -1;
    if (estado.itemsFiltrados.length === 0) {
      var vacio = document.createElement('li');
      vacio.className = 'opcion-vacia';
      vacio.textContent = 'Sin coincidencias';
      lista.appendChild(vacio);
    }
    abrirLista(lista, estado.dom.campoItems);
    var cantidad = estado.items.length;
    var mostrados = estado.itemsFiltrados.length;
    var texto = mostrados >= LIMITE_ITEMS
      ? 'primeros ' + LIMITE_ITEMS + ' de ' + cantidad + ' ítems'
      : mostrados + ' de ' + cantidad + ' ítems';
    estado.dom.conteoItems.textContent = texto;
  }

  function marcarItemActivo(campo, lista) {
    for (var i = 0; i < lista.children.length; i++) {
      var op = lista.children[i];
      var activa = i === estado.itemActivo;
      op.setAttribute('aria-selected', activa ? 'true' : 'false');
      if (activa) {
        op.classList.add('activo');
      } else {
        op.classList.remove('activo');
      }
    }
    if (estado.itemActivo >= 0 && estado.itemActivo < estado.itemsFiltrados.length) {
      var id = 'sgc-opcion-item-' + estado.itemActivo;
      campo.setAttribute('aria-activedescendant', id);
      var activaOp = qs(lista, '#' + id);
      if (activaOp) {
        activaOp.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function alEscribirItems() {
    var valor = estado.dom.campoItems.value;
    estado.itemsFiltrados = SGC.catalogo.indice.buscarEnItems(valor, estado.items, LIMITE_ITEMS);
    renderItems();
  }

  function agregarRenglon(resultado) {
    var renglon = {
      id: estado.siguienteId++,
      codigo: resultado.codigo,
      item: resultado.item,
      cantidad: 1,
      unidad: '',
      aclaracion: ''
    };
    estado.renglones.push(renglon);
    estado.dom.listaRenglones.appendChild(filaRenglon(renglon));
    actualizarResumen();
  }

  function erroresDeRenglon(renglon) {
    var v = SGC.core.validacion.validarRenglon({
      codigo: renglon.codigo,
      cantidad: renglon.cantidad,
      unidad: renglon.unidad,
      aclaracion: renglon.aclaracion
    });
    var errores = v.errores.slice();
    if (errores.length === 0 && !SGC.catalogo.indice.codigoExiste(renglon.codigo, estado.items)) {
      errores.push('El código no existe en el catálogo');
    }
    return errores;
  }

  function filaRenglon(renglon) {
    var li = document.createElement('li');
    li.className = 'renglon';

    var cab = document.createElement('div');
    cab.className = 'renglon-cab';
    var codigo = document.createElement('span');
    codigo.className = 'renglon-codigo';
    codigo.textContent = renglon.codigo;
    var item = document.createElement('span');
    item.className = 'renglon-item';
    item.textContent = renglon.item;
    cab.appendChild(codigo);
    cab.appendChild(item);
    li.appendChild(cab);

    var editor = document.createElement('div');
    editor.className = 'renglon-editor';

    var lblCantidad = document.createElement('label');
    lblCantidad.textContent = 'Cantidad';
    var cantidad = document.createElement('input');
    cantidad.type = 'number';
    cantidad.min = '0';
    cantidad.step = 'any';
    cantidad.value = String(renglon.cantidad);
    cantidad.setAttribute('aria-label', 'Cantidad del ítem');
    lblCantidad.appendChild(cantidad);
    editor.appendChild(lblCantidad);

    var lblUnidad = document.createElement('label');
    lblUnidad.textContent = 'Unidad';
    var unidad = document.createElement('input');
    unidad.type = 'text';
    unidad.maxLength = 40;
    unidad.placeholder = 'Ej.: unidad, kg, m';
    unidad.setAttribute('aria-label', 'Unidad de medida');
    lblUnidad.appendChild(unidad);
    editor.appendChild(lblUnidad);

    var lblAclaracion = document.createElement('label');
    lblAclaracion.className = 'aclaracion';
    lblAclaracion.textContent = 'Aclaración';
    var aclaracion = document.createElement('textarea');
    aclaracion.maxLength = MAX_ACLARACION;
    aclaracion.rows = 2;
    aclaracion.setAttribute('aria-label', 'Aclaración opcional');
    var contador = document.createElement('span');
    contador.className = 'contador';
    contador.textContent = '0/' + MAX_ACLARACION;
    lblAclaracion.appendChild(aclaracion);
    lblAclaracion.appendChild(contador);
    editor.appendChild(lblAclaracion);

    var btnQuitar = document.createElement('button');
    btnQuitar.type = 'button';
    btnQuitar.className = 'quitar';
    btnQuitar.textContent = 'Quitar';
    btnQuitar.setAttribute('aria-label', 'Quitar el renglón ' + renglon.codigo);
    editor.appendChild(btnQuitar);
    li.appendChild(editor);

    var error = document.createElement('p');
    error.className = 'renglon-error';
    error.setAttribute('role', 'alert');
    error.hidden = true;
    li.appendChild(error);

    function validarYMostrar() {
      renglon.cantidad = cantidad.value === '' ? NaN : Number(cantidad.value);
      renglon.unidad = unidad.value;
      renglon.aclaracion = aclaracion.value;
      contador.textContent = aclaracion.value.length + '/' + MAX_ACLARACION;
      var errores = erroresDeRenglon(renglon);
      if (errores.length > 0) {
        error.textContent = errores.join(' · ');
        error.hidden = false;
      } else {
        error.textContent = '';
        error.hidden = true;
      }
      actualizarResumen();
    }

    cantidad.addEventListener('input', validarYMostrar);
    unidad.addEventListener('input', validarYMostrar);
    aclaracion.addEventListener('input', validarYMostrar);
    btnQuitar.addEventListener('click', function () {
      var indice = estado.renglones.indexOf(renglon);
      if (indice !== -1) {
        estado.renglones.splice(indice, 1);
      }
      li.remove();
      actualizarResumen();
    });

    validarYMostrar();
    return li;
  }

  function actualizarResumen() {
    var total = estado.renglones.length;
    var conErrores = 0;
    for (var i = 0; i < estado.renglones.length; i++) {
      if (erroresDeRenglon(estado.renglones[i]).length > 0) {
        conErrores++;
      }
    }
    var texto = total === 0
      ? 'Sin renglones todavía.'
      : total + ' renglón' + (total === 1 ? '' : 'es') + ' — ' +
        conErrores + ' con error' + (conErrores === 1 ? '' : 'es');
    estado.dom.resumen.textContent = texto;
  }

  function tecladoClases(ev) {
    var n = estado.clases.length;
    if (n === 0) {
      return;
    }
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      estado.claseActiva = (estado.claseActiva + 1) % n;
      marcarClaseActiva(estado.dom.campoClases, estado.dom.listaClases);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      estado.claseActiva = (estado.claseActiva - 1 + n) % n;
      marcarClaseActiva(estado.dom.campoClases, estado.dom.listaClases);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      var objetivo = estado.claseActiva >= 0 ? estado.claseActiva : 0;
      seleccionarClase(estado.clases[objetivo]);
    } else if (ev.key === 'Escape') {
      cerrarLista();
    }
  }

  function tecladoItems(ev) {
    var n = estado.itemsFiltrados.length;
    if (n === 0) {
      return;
    }
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      estado.itemActivo = (estado.itemActivo + 1) % n;
      marcarItemActivo(estado.dom.campoItems, estado.dom.listaItems);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      estado.itemActivo = (estado.itemActivo - 1 + n) % n;
      marcarItemActivo(estado.dom.campoItems, estado.dom.listaItems);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      var objetivo = estado.itemActivo >= 0 ? estado.itemActivo : 0;
      agregarRenglon(estado.itemsFiltrados[objetivo]);
    }
  }

  function vincularEventos() {
    estado.dom.campoClases.addEventListener('input', alEscribirClases);
    estado.dom.campoClases.addEventListener('keydown', tecladoClases);
    estado.dom.campoItems.addEventListener('input', alEscribirItems);
    estado.dom.campoItems.addEventListener('keydown', tecladoItems);
  }

  function montar(raiz) {
    estado.dom.raiz = raiz;
    estado.dom.estado = qs(raiz, '#sgc-estado');
    estado.dom.campoClases = qs(raiz, '#sgc-campo-clases');
    estado.dom.listaClases = qs(raiz, '#sgc-lista-clases');
    estado.dom.panelItems = qs(raiz, '#sgc-panel-items');
    estado.dom.tituloClase = qs(raiz, '#sgc-titulo-clase');
    estado.dom.detalleClase = qs(raiz, '#sgc-detalle-clase');
    estado.dom.campoItems = qs(raiz, '#sgc-campo-items');
    estado.dom.listaItems = qs(raiz, '#sgc-lista-items');
    estado.dom.conteoItems = qs(raiz, '#sgc-conteo-items');
    estado.dom.listaRenglones = qs(raiz, '#sgc-lista-renglones');
    estado.dom.resumen = qs(raiz, '#sgc-resumen');
    vincularEventos();

    SGC.catalogo.carga.iniciar().then(function (est) {
      estado.dom.estado.textContent =
        est.manifiesto.registros + ' ítems en ' + est.manifiesto.clases +
        ' clases (catálogo ' + est.manifiesto.catalogoVersion + ')';
      estado.dom.campoClases.focus();
    }).catch(function (err) {
      estado.dom.estado.textContent = 'No se pudo cargar el catálogo: ' + err.message;
    });
  }

  SGC.catalogo.buscador = {
    montar: montar,
    obtenerEstado: function () {
      return estado;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);