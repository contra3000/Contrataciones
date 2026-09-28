/*
 * renglones-editor.js
 * ORDEN-RONDA-25 §6. Pantalla de corrección de renglones dentro de la vista
 * de expediente. La ve quien ejecuta el estado actual, en los estados en los
 * que el requerimiento todavía no se firmó (mínimamente ESPECIFICACIONES_
 * TECNICAS, fase 1, donde el generador hace las EETT).
 *
 * Por qué sólo ahí: los renglones pasan a citarse en la documentación a
 * partir del documento de EETT; una vez que el expediente sale de la fase de
 * generación no se vuelven a tocar (el servidor además exige el rol ejecutor
 * del estado actual para cualquier PUT que los cambie).
 *
 * Reusa catálogo/renglones.js con cargar(lista): el módulo pinta la lista,
 * valida cantidad/unidad/aclaración línea a línea y lleva el resumen. La
 * escritura es un PUT con versionEsperada, igual que el resto de la pantalla.
 * La validación del cliente es conveniencia; el servidor re-valida todo.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('renglones-editor.js requiere que namespaces.js se cargue primero');
  }

  var LIMITE_CLASES = 8;
  var LIMITE_ITEMS = 60;
  var ESTADOS_EDITABLES = ['ESPECIFICACIONES_TECNICAS'];

  var estado = {
    repo: null,
    operador: null,
    dom: {},
    expedienteId: null,
    version: null,
    clases: [],
    items: [],
    itemsFiltrados: [],
    claseActiva: -1,
    itemActivo: -1
  };

  function qs(raiz, selector) {
    return raiz.querySelector(selector);
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

  function avisar(mensaje, esError) {
    if (!estado.dom.msj) {
      return;
    }
    estado.dom.msj.textContent = mensaje;
    estado.dom.msj.className = esError ? 'exp-mensaje exp-mensaje-error' : 'exp-mensaje exp-mensaje-ok';
    estado.dom.msj.hidden = false;
  }

  function expedienteActual() {
    if (!SGC.views.expediente || typeof SGC.views.expediente.obtener !== 'function') {
      return null;
    }
    var actual = SGC.views.expediente.obtener();
    return actual && actual.expediente ? actual.expediente : null;
  }

  // ---------------------------------------------------------------------------
  // Mini buscador del editor (ids propios, distintos del wizard para no
  // colisionar: el wizard usa sgc-campo-clases/sgc-opcion-clase-N).
  // ---------------------------------------------------------------------------
  function opcionClase(resultado, indice) {
    var li = document.createElement('li');
    li.id = 'sgc-renglones-opcion-clase-' + indice;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');
    li.tabIndex = -1;
    var titulo = document.createElement('span');
    titulo.className = 'opcion-titulo';
    titulo.textContent = resultado.clase;
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
    lista.hidden = estado.clases.length === 0;
    estado.dom.buscar.setAttribute('aria-expanded', lista.hidden ? 'false' : 'true');
  }

  function alEscribirBuscar() {
    estado.clases = SGC.catalogo.indice.buscarClases(estado.dom.buscar.value, LIMITE_CLASES);
    renderClases();
  }

  function seleccionarClase(clase) {
    estado.dom.buscar.value = clase.clase;
    estado.dom.listaClases.hidden = true;
    estado.dom.panelItems.hidden = false;
    estado.dom.tituloClase.textContent = clase.clase + ' — ' + clase.rubro;
    estado.dom.detalleClase.textContent = clase.cantidad + ' ítems';
    estado.dom.buscarItem.value = '';
    SGC.catalogo.carga.cargarClase(clase.idClase).then(function (items) {
      estado.items = items;
      SGC.catalogo.indice.registrarCodigos(items);
      estado.itemsFiltrados = SGC.catalogo.indice.buscarEnItems('', items, LIMITE_ITEMS);
      renderItems();
      estado.dom.buscarItem.focus();
    }).catch(function (err) {
      estado.dom.tituloClase.textContent = 'Error al cargar la clase: ' + err.message;
    });
  }

  function opcionItem(resultado, indice) {
    var li = document.createElement('li');
    li.id = 'sgc-renglones-opcion-item-' + indice;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');
    li.tabIndex = -1;
    var codigo = document.createElement('span');
    codigo.className = 'opcion-codigo';
    codigo.textContent = resultado.codigo;
    var texto = document.createElement('span');
    texto.className = 'opcion-titulo';
    texto.textContent = resultado.item;
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
    lista.hidden = false;
    estado.dom.buscarItem.setAttribute('aria-expanded', 'true');
    var mostrados = estado.itemsFiltrados.length;
    estado.dom.conteoItems.textContent = mostrados >= LIMITE_ITEMS
      ? 'primeros ' + LIMITE_ITEMS + ' de ' + estado.items.length + ' ítems'
      : mostrados + ' de ' + estado.items.length + ' ítems';
  }

  function alEscribirItems() {
    estado.itemsFiltrados = SGC.catalogo.indice.buscarEnItems(
      estado.dom.buscarItem.value, estado.items, LIMITE_ITEMS);
    renderItems();
  }

  function seleccionarPrimeraClase() {
    if (estado.clases.length > 0) {
      seleccionarClase(estado.clases[0]);
    }
  }

  function agregarPrimerItem() {
    if (estado.itemsFiltrados.length > 0) {
      SGC.catalogo.renglones.agregar(estado.itemsFiltrados[0]);
    }
  }

  function teclado(ev, esItems) {
    if (ev.key === 'Escape') {
      (esItems ? estado.dom.listaItems : estado.dom.listaClases).hidden = true;
      return;
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (esItems) {
        agregarPrimerItem();
      } else {
        seleccionarPrimeraClase();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Guardado por PUT con versionEsperada
  // ---------------------------------------------------------------------------
  // El editor conserva los campos del requerimiento (valoresReferencia,
  // cantidadMaxima/minima) y sólo descarta la marca interna `id` del módulo.
  function renglonesParaPersistir(lista) {
    var fuera = [];
    for (var i = 0; i < lista.length; i++) {
      var limpio = {};
      for (var k in lista[i]) {
        if (Object.prototype.hasOwnProperty.call(lista[i], k) && k !== 'id') {
          limpio[k] = lista[i][k];
        }
      }
      fuera.push(limpio);
    }
    return fuera;
  }

  function guardar() {
    var expediente = expedienteActual();
    if (!expediente || !estado.repo) {
      return;
    }
    var errores = [];
    var lista = SGC.catalogo.renglones.obtener();
    if (lista.length === 0) {
      errores.push('el expediente no puede quedar sin renglones');
    }
    for (var i = 0; i < lista.length; i++) {
      var val = SGC.core.validacion.validarRenglon(lista[i]);
      for (var e = 0; e < val.errores.length; e++) {
        errores.push('Renglón ' + (i + 1) + ': ' + val.errores[e]);
      }
    }
    if (errores.length > 0) {
      avisar('No se puede guardar todavía: ' + errores.join(' · '), true);
      return;
    }
    var copia = JSON.parse(JSON.stringify(expediente));
    copia.renglones = renglonesParaPersistir(lista);
    estado.repo.guardarExpediente(estado.expedienteId, copia, estado.version, contextoActual())
      .then(function (respuesta) {
        if (respuesta.conflicto) {
          avisar('El expediente fue modificado por otro operador después de abrirlo' +
            ' (versión actual: ' + respuesta.versionRemota + '). No se guardó nada.', true);
          return;
        }
        if (!respuesta.ok) {
          avisar('No se pudieron guardar los renglones: ' + (respuesta.error || 'error desconocido'), true);
          return;
        }
        avisar('Renglones guardados (versión ' + respuesta.version + ').', false);
        SGC.views.expediente.abrir(estado.expedienteId);
      })
      .catch(function (err) {
        avisar('No se pudieron guardar los renglones: ' + err.message, true);
      });
  }

  // ---------------------------------------------------------------------------
  // Actualización desde la vista de expediente
  // ---------------------------------------------------------------------------
  // Vuelve a apuntar el módulo de renglones a los nodos del editor (el wizard
  // lo re-apunta a los suyos cuando arranca un alta). El onCambio se deja en
  // un no-op para no disparar el guardado de borrador del wizard.
  function actualizar() {
    var expediente = expedienteActual();
    var visible = !!expediente &&
      ESTADOS_EDITABLES.indexOf(SGC.core.utils.idEstado(expediente)) !== -1 &&
      expediente.archivado !== true;
    if (!estado.dom.seccion) {
      return;
    }
    if (!visible) {
      estado.dom.seccion.hidden = true;
      estado.expedienteId = null;
      return;
    }
    var actual = SGC.views.expediente.obtener();
    estado.dom.seccion.hidden = false;
    estado.expedienteId = expediente.expedienteId || expediente.id;
    estado.version = actual.version;
    SGC.catalogo.renglones.montar({
      listaRenglones: estado.dom.listaRenglones,
      resumen: estado.dom.resumen,
      onCambio: function () {}
    });
    SGC.catalogo.renglones.cargar(Array.isArray(expediente.renglones) ? expediente.renglones : []);
  }

  function montar(raiz) {
    estado.dom.raiz = raiz;
    estado.dom.seccion = raiz;
    estado.dom.buscar = qs(raiz, '#sgc-renglones-buscar');
    estado.dom.listaClases = qs(raiz, '#sgc-renglones-lista-clases');
    estado.dom.panelItems = qs(raiz, '#sgc-renglones-panel-items');
    estado.dom.tituloClase = qs(raiz, '#sgc-renglones-titulo-clase');
    estado.dom.detalleClase = qs(raiz, '#sgc-renglones-detalle-clase');
    estado.dom.buscarItem = qs(raiz, '#sgc-renglones-buscar-item');
    estado.dom.listaItems = qs(raiz, '#sgc-renglones-lista-items');
    estado.dom.conteoItems = qs(raiz, '#sgc-renglones-conteo-items');
    estado.dom.listaRenglones = qs(raiz, '#sgc-renglones-lista-renglones');
    estado.dom.resumen = qs(raiz, '#sgc-renglones-resumen');
    estado.dom.msj = qs(raiz, '#sgc-renglones-msj');

    if (estado.dom.buscar) {
      estado.dom.buscar.addEventListener('input', alEscribirBuscar);
      estado.dom.buscar.addEventListener('keydown', function (ev) { teclado(ev, false); });
    }
    if (estado.dom.buscarItem) {
      estado.dom.buscarItem.addEventListener('input', alEscribirItems);
      estado.dom.buscarItem.addEventListener('keydown', function (ev) { teclado(ev, true); });
    }
    var btnGuardar = qs(raiz, '#sgc-renglones-guardar');
    if (btnGuardar) {
      btnGuardar.addEventListener('click', guardar);
    }
  }

  SGC.views.renglonesEditor = {
    montar: montar,
    actualizar: actualizar,
    fijarRepo: function (repo) { estado.repo = repo; },
    seleccionarOperador: function (operador) { estado.operador = operador; }
  };
})(typeof window !== 'undefined' ? window : globalThis);