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

  var estado = {
    clases: [],
    claseActiva: -1,
    claseSeleccionada: null,
    items: [],
    itemsFiltrados: [],
    itemActivo: -1,
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
      SGC.catalogo.indice.registrarCodigos(items);
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
      SGC.catalogo.renglones.agregar(resultado);
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

  function cerrarListaItems() {
    var lista = estado.dom.listaItems;
    lista.hidden = true;
    estado.itemActivo = -1;
    estado.dom.campoItems.setAttribute('aria-activedescendant', '');
    estado.dom.campoItems.setAttribute('aria-expanded', 'false');
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
      SGC.catalogo.renglones.agregar(estado.itemsFiltrados[objetivo]);
    } else if (ev.key === 'Escape') {
      cerrarListaItems();
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
    SGC.catalogo.renglones.montar({
      listaRenglones: estado.dom.listaRenglones,
      resumen: estado.dom.resumen
    });
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