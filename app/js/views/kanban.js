/*
 * kanban.js
 * Tablero Kanban (ORDEN-RONDA-06 §3.1, ADR-005, ADR-010, FSD §3).
 *
 * Una columna por fase (las diez del FSD §4), no por estado: dieciocho
 * columnas obligarían a desplazamiento horizontal permanente. El estado
 * puntual va como etiqueta dentro de la tarjeta.
 *
 * Las tarjetas se arman EXCLUSIVAMENTE desde GET /api/indice (lista de
 * entradas livianas del índice fragmentado). El tablero nunca abre los
 * datos.json: leer un expediente completo por tarjeta no escala.
 *
 * Sin arrastrar y soltar (FSD §4): el movimiento es por botón, en la vista de
 * expediente. Visibilidad global para todos los roles: lo que cambia por rol
 * es qué se puede hacer, no qué se puede ver.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('kanban.js requiere que namespaces.js se cargue primero');
  }

  var config = SGC.core.config;

  var estado = {
    repo: null,
    onAbrir: null,
    entradas: [],
    dom: {}
  };

  function qs(raiz, selector) {
    return raiz.querySelector(selector);
  }

  function limpiar(nodo) {
    while (nodo.children.length > 0) {
      nodo.removeChild(nodo.children[0]);
    }
  }

  function definicionEstado(idEstado) {
    for (var i = 0; i < config.ESTADOS.length; i++) {
      if (config.ESTADOS[i].id === idEstado) {
        return config.ESTADOS[i];
      }
    }
    return null;
  }

  function formatearFecha(iso) {
    if (typeof iso !== 'string' || iso.length === 0) {
      return '—';
    }
    return iso.replace('T', ' ').replace(/\.\d{3}Z?$/, '');
  }

  function cumpleFiltro(entrada) {
    var texto = estado.dom.busqueda.value.trim().toLowerCase();
    var fase = estado.dom.fase.value;
    if (fase !== '' && String(entrada.fase) !== fase) {
      return false;
    }
    if (texto === '') {
      return true;
    }
    var def = definicionEstado(entrada.estado);
    var estadoTxt = def ? def.titulo : entrada.estado;
    var combinado = (entrada.id + ' ' + (entrada.titulo || '') + ' ' +
      estadoTxt + ' ' + (entrada.ultimoOperador || '')).toLowerCase();
    return combinado.indexOf(texto) !== -1;
  }

  function crearTarjeta(entrada) {
    var art = document.createElement('article');
    art.className = 'kanban-tarjeta';
    art.setAttribute('data-id', entrada.id);

    var numero = document.createElement('span');
    numero.className = 'kanban-numero';
    numero.textContent = entrada.id;

    var titulo = document.createElement('h3');
    titulo.className = 'kanban-titulo';
    titulo.textContent = entrada.titulo || '(sin título)';

    var def = definicionEstado(entrada.estado);
    var etiqueta = document.createElement('span');
    etiqueta.className = 'kanban-etiqueta';
    etiqueta.textContent = def ? def.titulo : entrada.estado;

    var operador = document.createElement('span');
    operador.className = 'kanban-operador';
    operador.textContent = 'Último operador: ' + (entrada.ultimoOperador || '—');

    var fecha = document.createElement('span');
    fecha.className = 'kanban-fecha';
    fecha.textContent = 'Actualizado: ' + formatearFecha(entrada.actualizado);

    var boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'kanban-abrir';
    boton.textContent = 'Abrir';
    boton.setAttribute('aria-label', 'Abrir el expediente ' + entrada.id);
    boton.addEventListener('click', function () {
      if (typeof estado.onAbrir === 'function') {
        estado.onAbrir(entrada.id);
      }
    });

    art.appendChild(numero);
    art.appendChild(titulo);
    art.appendChild(etiqueta);
    art.appendChild(operador);
    art.appendChild(fecha);
    art.appendChild(boton);
    return art;
  }

  function render() {
    var visibles = [];
    for (var i = 0; i < estado.entradas.length; i++) {
      if (cumpleFiltro(estado.entradas[i])) {
        visibles.push(estado.entradas[i]);
      }
    }
    for (var c = 0; c < estado.dom.columnas.length; c++) {
      limpiar(estado.dom.columnas[c]);
    }
    for (var j = 0; j < visibles.length; j++) {
      var e = visibles[j];
      var indice = e.fase >= 1 && e.fase <= estado.dom.columnas.length
        ? e.fase - 1 : estado.dom.columnas.length - 1;
      estado.dom.columnas[indice].appendChild(crearTarjeta(e));
    }
    estado.dom.conteo.textContent =
      visibles.length + ' de ' + estado.entradas.length + ' expedientes en el índice';
  }

  function refrescar() {
    estado.dom.error.hidden = true;
    if (!estado.repo) {
      return;
    }
    estado.repo.listarIndice().then(function (entradas) {
      estado.entradas = entradas || [];
      render();
    }).catch(function (err) {
      estado.dom.error.textContent = 'No se pudo cargar el tablero: ' + err.message;
      estado.dom.error.hidden = false;
    });
  }

  function construirColumnas() {
    var contenedor = estado.dom.columnasContenedor;
    limpiar(contenedor);
    for (var i = 0; i < config.FASES.length; i++) {
      var fase = config.FASES[i];
      var seccion = document.createElement('section');
      seccion.className = 'kanban-columna';
      seccion.setAttribute('data-fase', String(fase.numero));
      var titulo = document.createElement('h3');
      titulo.className = 'kanban-columna-titulo';
      titulo.textContent = fase.titulo;
      var lista = document.createElement('ul');
      lista.className = 'kanban-lista';
      lista.id = 'sgc-kanban-lista-' + fase.numero;
      seccion.appendChild(titulo);
      seccion.appendChild(lista);
      contenedor.appendChild(seccion);
    }
  }

  function montar(raiz) {
    estado.dom.raiz = raiz;
    estado.dom.busqueda = qs(raiz, '#sgc-kanban-busqueda');
    estado.dom.fase = qs(raiz, '#sgc-kanban-fase');
    estado.dom.conteo = qs(raiz, '#sgc-kanban-conteo');
    estado.dom.error = qs(raiz, '#sgc-kanban-error');
    estado.dom.columnasContenedor = qs(raiz, '#sgc-kanban-columnas');
    construirColumnas();
    estado.dom.columnas = [];
    for (var i = 0; i < config.FASES.length; i++) {
      estado.dom.columnas.push(qs(raiz, '#sgc-kanban-lista-' + config.FASES[i].numero));
    }
    limpiar(estado.dom.fase);
    var opcionTodas = document.createElement('option');
    opcionTodas.value = '';
    opcionTodas.textContent = 'Todas las fases';
    estado.dom.fase.appendChild(opcionTodas);
    for (var j = 0; j < config.FASES.length; j++) {
      var opcion = document.createElement('option');
      opcion.value = String(config.FASES[j].numero);
      opcion.textContent = config.FASES[j].titulo;
      estado.dom.fase.appendChild(opcion);
    }
    estado.dom.busqueda.addEventListener('input', render);
    estado.dom.fase.addEventListener('change', render);
    qs(raiz, '#sgc-kanban-refrescar').addEventListener('click', refrescar);
  }

  SGC.views.kanban = {
    montar: montar,
    fijarRepo: function (repo) {
      estado.repo = repo;
    },
    onAbrir: function (fn) {
      estado.onAbrir = fn;
    },
    refrescar: refrescar
  };
})(typeof window !== 'undefined' ? window : globalThis);