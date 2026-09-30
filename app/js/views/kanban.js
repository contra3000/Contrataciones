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
 *
 * ORDEN-RONDA-27 pieza 6: desde que la SCo sale de `SOLICITUD_CONTRATACION` el
 * tablero muestra UNA tarjeta por SCo, con sus requerimientos adentro, porque
 * desde ahí la SCo se mueve en bloque (pieza 4) y anotar cada requerimiento por
 * separado mostraría un movimiento que en realidad es de todos. Antes de eso los
 * requerimientos van sueltos, como siempre: cada uno se mueve por su cuenta.
 *
 * La agrupación sale del propio índice (`numeroSCo` en cada entrada, ORDEN-RONDA-26
 * pieza 4): el tablero sigue armándose SÓLO con GET /api/indice y no abre un solo
 * expediente. Para saber si la SCo ya salió de SOLICITUD_CONTRATACION alcanza con
 * los estados de sus miembros en el índice: la pieza 4 los mueve a todos juntos.
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
    return coincideConTexto(entrada, texto);
  }

  // Texto que se busca en una entrada: número, título, estado y último operador
  // (más el número de SCo, que es por donde se busca una SCo).
  function coincideConTexto(entrada, texto) {
    var def = definicionEstado(entrada.estado);
    var estadoTxt = def ? def.titulo : entrada.estado;
    var combinado = (entrada.id + ' ' + (entrada.titulo || '') + ' ' +
      estadoTxt + ' ' + (entrada.ultimoOperador || '') + ' ' +
      (entrada.numeroSCo || '')).toLowerCase();
    return combinado.indexOf(texto) !== -1;
  }

// ORDEN-RONDA-27 pieza 6: los miembros de una SCo, en el orden del índice, y si
// esa SCo se muestra como una sola tarjeta. Mientras todos sus miembros siguen
// en SOLICITUD_CONTRATACION, cada uno se mueve solo y van sueltos. Y una SCo de
// UN solo requerimiento no se agrupa: no hay nada que agrupar y su tarjeta de
// siempre dice lo mismo que la de SCo.
  function miembrosDeSco(numeroSCo) {
    var miembros = [];
    var todosEnSolicitud = true;
    for (var i = 0; i < estado.entradas.length; i++) {
      var entrada = estado.entradas[i];
      if (entrada.numeroSCo !== numeroSCo) {
        continue;
      }
      miembros.push(entrada);
      if (entrada.estado !== 'SOLICITUD_CONTRATACION') {
        todosEnSolicitud = false;
      }
    }
    return { miembros: miembros, agrupada: !todosEnSolicitud && miembros.length > 1 };
  }

  // Un renglón de la tarjeta de la SCo: número, título y su botón de abrir. Se
  // abre el requerimiento, que es lo que la persona quiere hacer; la SCo no se
  // abre porque no es un expediente.
  function crearMiembroDeSco(entrada) {
    var li = document.createElement('li');
    li.className = 'kanban-sco-miembro';
    li.setAttribute('data-id', entrada.id);

    var numero = document.createElement('span');
    numero.className = 'kanban-numero';
    numero.textContent = entrada.id;

    var titulo = document.createElement('span');
    titulo.className = 'kanban-sco-titulo';
    titulo.textContent = entrada.titulo || '(sin título)';

    var boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'kanban-abrir';
    boton.textContent = 'Abrir';
    boton.setAttribute('aria-label', 'Abrir el expediente ' + entrada.id +
      ' de la SCo ' + entrada.numeroSCo);
    boton.addEventListener('click', function () {
      if (typeof estado.onAbrir === 'function') {
        estado.onAbrir(entrada.id);
      }
    });

    li.appendChild(numero);
    li.appendChild(titulo);
    li.appendChild(boton);
    return li;
  }

  // Una tarjeta por SCo. Va en la columna de la fase más temprana de sus
  // miembros: si algo quedó atrás, la tarjeta tiene que verse donde hay que
  // trabajar, no donde llegó la más avanzada.
  function crearTarjetaDeSco(numeroSCo, miembros, visibles) {
    var art = document.createElement('article');
    art.className = 'kanban-tarjeta kanban-tarjeta-sco';
    art.setAttribute('data-sco', numeroSCo);

    var encabezado = document.createElement('h3');
    encabezado.className = 'kanban-titulo';
    encabezado.textContent = 'SCo ' + numeroSCo + ' (' + miembros.length + ' requerimientos)';

    var etiqueta = document.createElement('span');
    etiqueta.className = 'kanban-etiqueta';
    etiqueta.textContent = 'Se mueve en bloque';

    var fecha = document.createElement('span');
    fecha.className = 'kanban-fecha';
    var masReciente = null;
    for (var i = 0; i < miembros.length; i++) {
      if (!masReciente || (miembros[i].actualizado || '') > (masReciente.actualizado || '')) {
        masReciente = miembros[i];
      }
    }
    fecha.textContent = 'Actualizado: ' + formatearFecha(masReciente ? masReciente.actualizado : null);

    var lista = document.createElement('ul');
    lista.className = 'kanban-sco-miembros';
    for (var j = 0; j < visibles.length; j++) {
      lista.appendChild(crearMiembroDeSco(visibles[j]));
    }

    art.appendChild(encabezado);
    art.appendChild(etiqueta);
    art.appendChild(fecha);
    art.appendChild(lista);
    return art;
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

  // Qué columna va una fase: la primera si el índice no trae una fase conocida,
  // la última si trae una que el tablero no tiene (y así la tarjeta nunca se
  // pierde de vista).
  function columnaDeFase(fase) {
    return fase >= 1 && fase <= estado.dom.columnas.length
      ? fase - 1 : estado.dom.columnas.length - 1;
  }

  // ORDEN-RONDA-27 pieza 6: se arma la lista de tarjetas. Las entradas que
  // pertenecen a una SCo que ya salió de SOLICITUD_CONTRATACION se juntan en una
  // sola tarjeta; el resto va suelta, como siempre.
  function tarjetasVisibles(visibles) {
    var tarjetas = [];
    var porSco = {};
    for (var i = 0; i < visibles.length; i++) {
      var entrada = visibles[i];
      var numeroSCo = typeof entrada.numeroSCo === 'string' ? entrada.numeroSCo : '';
      var grupo = numeroSCo === '' ? null : miembrosDeSco(numeroSCo);
      if (grupo && grupo.agrupada) {
        var abierta = porSco[numeroSCo];
        if (!abierta) {
          abierta = { sco: numeroSCo, visibles: [], grupo: grupo };
          porSco[numeroSCo] = abierta;
          tarjetas.push(abierta);
        }
        abierta.visibles.push(entrada);
      } else {
        tarjetas.push({ entrada: entrada });
      }
    }
    return tarjetas;
  }

  // En una tarjeta de SCo manda el filtro: si la SCo quedó afuera, no se pinta;
  // si quedó adentro, van todos sus miembros (salvo los que el filtro de fase
  // dejó afuera, que no se muestran porque no están en esa columna).
  function tarjetaDeScoPasa(tarjeta) {
    var texto = estado.dom.busqueda.value.trim().toLowerCase();
    if (texto === '') {
      return true;
    }
    for (var i = 0; i < tarjeta.grupo.miembros.length; i++) {
      if (coincideConTexto(tarjeta.grupo.miembros[i], texto)) {
        return true;
      }
    }
    return false;
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
    var tarjetas = tarjetasVisibles(visibles);
    var scos = 0;
    for (var j = 0; j < tarjetas.length; j++) {
      var tarjeta = tarjetas[j];
      if (tarjeta.sco) {
        if (!tarjetaDeScoPasa(tarjeta)) {
          continue;
        }
        // La fase se toma del miembro visible más temprano: la tarjeta tiene que
        // verse donde hay algo que hacer.
        var fase = null;
        for (var m = 0; m < tarjeta.visibles.length; m++) {
          if (fase === null || tarjeta.visibles[m].fase < fase) {
            fase = tarjeta.visibles[m].fase;
          }
        }
        if (fase === null) {
          continue;
        }
        estado.dom.columnas[columnaDeFase(fase)]
          .appendChild(crearTarjetaDeSco(tarjeta.sco, tarjeta.grupo.miembros, tarjeta.visibles));
        scos += 1;
      } else {
        estado.dom.columnas[columnaDeFase(tarjeta.entrada.fase)].appendChild(crearTarjeta(tarjeta.entrada));
      }
    }
    var extraScos = scos === 0 ? '' : ' · ' + scos + ' SCo';
    estado.dom.conteo.textContent =
      visibles.length + ' de ' + estado.entradas.length + ' expedientes en el índice' + extraScos;
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