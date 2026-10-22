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
    buscarItem: [],
    buscarItemTotal: 0,
    buscarItemActivo: -1,
    busquedaCargada: false,
    busquedaCargando: false,
    opciones: {},
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
      if (estado.dom.listaItems.hidden) {
        return;
      }
      SGC.catalogo.renglones.agregar(resultado);
      if (estado.opciones.cerrarListaAlElegir) {
        cerrarListaItems();
      }
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

  function claseDeCodigo(codigo) {
    var catalogo = SGC.catalogo.carga.obtenerEstado();
    var idClase = catalogo.codigos && catalogo.codigos[codigo];
    var info = idClase && catalogo.clasesPorId[idClase];
    return info ? info.clase : '';
  }

  function opcionBuscarItem(resultado, indice) {
    var li = document.createElement('li');
    li.id = 'sgc-opcion-buscar-item-' + indice;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');
    li.tabIndex = -1;
    var codigo = document.createElement('span');
    codigo.className = 'opcion-codigo';
    codigo.textContent = resultado.codigo;
    var texto = document.createElement('span');
    texto.className = 'opcion-titulo';
    resaltar(texto, resultado.item, resultado.coincidencias);
    var clase = document.createElement('span');
    clase.className = 'opcion-detalle';
    clase.textContent = claseDeCodigo(resultado.codigo);
    li.appendChild(codigo);
    li.appendChild(texto);
    li.appendChild(clase);
    li.addEventListener('mousedown', function (ev) {
      ev.preventDefault();
      if (estado.dom.listaBuscarItem.hidden) {
        return;
      }
      elegirItemBusqueda(resultado);
    });
    return li;
  }

  function elegirItemBusqueda(resultado) {
    SGC.catalogo.indice.registrarCodigos([resultado]);
    SGC.catalogo.renglones.agregar(resultado);
    cerrarListaBuscarItem();
    if (estado.dom.campoBuscarItem && typeof estado.dom.campoBuscarItem.focus === 'function') {
      estado.dom.campoBuscarItem.focus();
    }
  }

  function renderBuscarItem() {
    var lista = estado.dom.listaBuscarItem;
    lista.textContent = '';
    for (var i = 0; i < estado.buscarItem.length; i++) {
      lista.appendChild(opcionBuscarItem(estado.buscarItem[i], i));
    }
    estado.buscarItemActivo = -1;
    if (estado.buscarItem.length === 0) {
      var vacio = document.createElement('li');
      vacio.className = 'opcion-vacia';
      vacio.textContent = 'Sin coincidencias';
      lista.appendChild(vacio);
    }
    abrirLista(lista, estado.dom.campoBuscarItem);
    var total = estado.buscarItemTotal;
    var texto = total + ' coincidencia' + (total === 1 ? '' : 's');
    if (total > LIMITE_ITEMS) {
      texto += ' — se muestran las primeras ' + LIMITE_ITEMS;
    }
    estado.dom.conteoBuscarItem.textContent = texto;
  }

  function cerrarListaBuscarItem() {
    var lista = estado.dom.listaBuscarItem;
    if (!lista) {
      return;
    }
    lista.hidden = true;
    estado.buscarItemActivo = -1;
    estado.dom.campoBuscarItem.setAttribute('aria-activedescendant', '');
    estado.dom.campoBuscarItem.setAttribute('aria-expanded', 'false');
  }

  function marcarBuscarItemActivo(campo, lista) {
    for (var i = 0; i < lista.children.length; i++) {
      var op = lista.children[i];
      var activa = i === estado.buscarItemActivo;
      op.setAttribute('aria-selected', activa ? 'true' : 'false');
      if (activa) {
        op.classList.add('activo');
      } else {
        op.classList.remove('activo');
      }
    }
    if (estado.buscarItemActivo >= 0 && estado.buscarItemActivo < estado.buscarItem.length) {
      var id = 'sgc-opcion-buscar-item-' + estado.buscarItemActivo;
      campo.setAttribute('aria-activedescendant', id);
      var activaOp = qs(lista, '#' + id);
      if (activaOp) {
        activaOp.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function iniciarBusquedaItems() {
    if (estado.busquedaCargando) {
      return;
    }
    estado.busquedaCargando = true;
    estado.dom.conteoBuscarItem.textContent = 'Cargando los ítems del catálogo.';
    cerrarListaBuscarItem();
    SGC.catalogo.carga.cargarBusqueda().then(function (datos) {
      SGC.generadorBusqueda.montar(datos);
      estado.busquedaCargada = true;
      estado.busquedaCargando = false;
      alEscribirBuscarItem();
    }).catch(function (err) {
      estado.busquedaCargando = false;
      estado.dom.conteoBuscarItem.textContent =
        'No se pudieron cargar los ítems del catálogo: ' + err.message;
    });
  }

  function alEscribirBuscarItem() {
    var valor = estado.dom.campoBuscarItem.value;
    if (valor.trim() === '') {
      estado.buscarItem = [];
      estado.buscarItemTotal = 0;
      cerrarListaBuscarItem();
      estado.dom.conteoBuscarItem.textContent = '';
      return;
    }
    if (!estado.busquedaCargada) {
      iniciarBusquedaItems();
      return;
    }
    var resultado = SGC.generadorBusqueda.buscar(valor, LIMITE_ITEMS);
    estado.buscarItem = resultado.resultados;
    estado.buscarItemTotal = resultado.total;
    renderBuscarItem();
  }

  function tecladoBuscarItem(ev) {
    var n = estado.buscarItem.length;
    if (n === 0) {
      if (ev.key === 'Escape') {
        cerrarListaBuscarItem();
      }
      return;
    }
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      estado.buscarItemActivo = (estado.buscarItemActivo + 1) % n;
      marcarBuscarItemActivo(estado.dom.campoBuscarItem, estado.dom.listaBuscarItem);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      estado.buscarItemActivo = (estado.buscarItemActivo - 1 + n) % n;
      marcarBuscarItemActivo(estado.dom.campoBuscarItem, estado.dom.listaBuscarItem);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (estado.dom.listaBuscarItem.hidden) {
        return;
      }
      var objetivo = estado.buscarItemActivo >= 0 ? estado.buscarItemActivo : 0;
      elegirItemBusqueda(estado.buscarItem[objetivo]);
    } else if (ev.key === 'Escape') {
      cerrarListaBuscarItem();
    }
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
      if (estado.dom.listaItems.hidden) {
        return;
      }
      var objetivo = estado.itemActivo >= 0 ? estado.itemActivo : 0;
      SGC.catalogo.renglones.agregar(estado.itemsFiltrados[objetivo]);
      if (estado.opciones.cerrarListaAlElegir) {
        cerrarListaItems();
      }
    } else if (ev.key === 'Escape') {
      cerrarListaItems();
    }
  }

  function vincularEventos() {
    estado.dom.campoClases.addEventListener('input', alEscribirClases);
    estado.dom.campoClases.addEventListener('keydown', tecladoClases);
    estado.dom.campoItems.addEventListener('input', alEscribirItems);
    estado.dom.campoItems.addEventListener('keydown', tecladoItems);
    if (estado.dom.campoBuscarItem) {
      estado.dom.campoBuscarItem.addEventListener('input', alEscribirBuscarItem);
      estado.dom.campoBuscarItem.addEventListener('keydown', tecladoBuscarItem);
    }
  }

  function montar(raiz, opciones) {
    estado.opciones = opciones || {};
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
    estado.dom.campoBuscarItem = qs(raiz, '#sgc-buscar-item');
    estado.dom.listaBuscarItem = qs(raiz, '#sgc-lista-buscar-item');
    estado.dom.conteoBuscarItem = qs(raiz, '#sgc-conteo-buscar-item');
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
    /*
     * ORDEN-RONDA-33 pieza 2: poner un texto en el campo de clases desde otro
     * lado de la pantalla (el botón "Buscar" de un renglón por buscar), como si
     * la persona lo hubiera escrito: corre la misma búsqueda y deja el foco en
     * el buscador para que elija la clase y el ítem.
     */
    buscar: function (texto) {
      var campo = estado.dom.campoBuscarItem || estado.dom.campoClases;
      if (!campo) {
        return;
      }
      campo.value = texto === undefined || texto === null ? '' : String(texto);
      if (estado.dom.campoBuscarItem) {
        alEscribirBuscarItem();
      } else {
        alEscribirClases();
      }
      if (typeof campo.focus === 'function') {
        campo.focus();
      }
      if (typeof campo.scrollIntoView === 'function') {
        campo.scrollIntoView({ block: 'center' });
      }
    },
    obtenerEstado: function () {
      return estado;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);