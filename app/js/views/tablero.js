/*
 * tablero.js
 * ORDEN-RONDA-12 §3.4 (ADR-024). Tablero de indicadores por rol. Cada rol ve
 * sus fichas en un orden guardado en el padrón, no en el navegador. Un tablero
 * por defecto por rol para que nadie tenga que configurar nada el primer día.
 *
 * Agregar, quitar y reordenar fichas es configuración del operador.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('tablero.js requiere que namespaces.js se cargue primero');
  }

  var estado = {
    eventos: [],
    rol: null,
    operador: null,
    fichas: []
  };

  function qs(raiz, sel) { return raiz.querySelector(sel); }

  function formatearValor(ficha, resultado) {
    if (ficha.formato === 'duracion') {
      var ms = resultado.valor;
      if (ms < 1000) return ms + ' ms';
      if (ms < 60000) return (ms / 1000).toFixed(1) + ' s';
      return (ms / 60000).toFixed(1) + ' min';
    }
    if (ficha.formato === 'porcentaje') {
      return resultado.valor.toFixed(1) + ' %';
    }
    if (ficha.formato === 'numero') {
      if (typeof resultado.valor === 'number') {
        return resultado.valor % 1 === 0 ? String(resultado.valor) : resultado.valor.toFixed(2);
      }
      return String(resultado.valor);
    }
    return String(resultado.valor);
  }

  function crearTarjeta(ficha, resultado) {
    var div = document.createElement('div');
    div.className = 'tablero-tarjeta';
    div.setAttribute('data-ficha', ficha.id);

    var h3 = document.createElement('h3');
    h3.textContent = ficha.nombre;
    div.appendChild(h3);

    var valor = document.createElement('div');
    valor.className = 'tablero-valor';
    valor.textContent = formatearValor(ficha, resultado);
    div.appendChild(valor);

    if (resultado.detalle && typeof resultado.detalle === 'object') {
      var lista = document.createElement('ul');
      lista.className = 'tablero-detalle';
      var claves = Object.keys(resultado.detalle).sort(function (a, b) {
        return resultado.detalle[b] - resultado.detalle[a];
      });
      for (var i = 0; i < Math.min(claves.length, 10); i++) {
        var li = document.createElement('li');
        li.textContent = claves[i] + ': ' + resultado.detalle[claves[i]];
        lista.appendChild(li);
      }
      div.appendChild(lista);
    }

    return div;
  }

  function montar(contenedor, operador, eventos) {
    if (!contenedor || !SGC.core.indicadores) return;
    estado.operador = operador || {};
    estado.rol = estado.operador.roles && estado.operador.roles[0] || 'generador';
    estado.eventos = eventos || [];

    // Fichas del tablero: preferencia del operador o default del rol
    var preferencia = (typeof estado.operador.tableroFichas === 'object' && estado.operador.tableroFichas)
      ? estado.operador.tableroFichas
      : null;
    estado.fichas = preferencia && preferencia[estado.rol]
      ? preferencia[estado.rol]
      : SGC.core.indicadores.tableroPorDefecto(estado.rol);

    contenedor.innerHTML = '';
    var h2 = document.createElement('h2');
    h2.textContent = 'Tablero — ' + (estado.operador.nombre || estado.rol);
    contenedor.appendChild(h2);

    var resultados = SGC.core.indicadores.calcularTodas(estado.eventos, estado.fichas);
    var grid = document.createElement('div');
    grid.className = 'tablero-grid';

    for (var i = 0; i < resultados.length; i++) {
      grid.appendChild(crearTarjeta(resultados[i].ficha, resultados[i]));
    }
    contenedor.appendChild(grid);
  }

  function fijarEventos(eventos) {
    estado.eventos = eventos || [];
  }

  SGC.views.tablero = {
    montar: montar,
    fijarEventos: fijarEventos,
    estado: estado
  };
})(typeof window !== 'undefined' ? window : globalThis);
