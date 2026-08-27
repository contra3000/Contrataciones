/*
 * sugerencias-jefe.js
 * ORDEN-RONDA-13 §6 (H19). Vista del Jefe de Contrataciones sobre las
 * sugerencias del piloto.
 *
 * Lista los reportes (activas, atendidas o todas), permite marcarlos como
 * atendidos (el servidor agrega una línea, nunca edita ni borra el JSONL) y
 * exporta un Markdown en el que cada línea del reporte va citada con `> `.
 * La exportación pasa por un diálogo de advertencia: las sugerencias
 * contienen fragmentos de los expedientes en uso.
 *
 * Sin innerHTML: lista, avisos y filas se arman con createElement y
 * textContent.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('sugerencias-jefe.js requiere que namespaces.js se cargue primero');
  }

  var estado = {
    repo: null,
    operador: null,
    descargar: null,
    onVolver: null,
    sugerencias: [],
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

  function filtro() {
    return estado.dom.filtro.value;
  }

  function formatearFecha(iso) {
    if (typeof iso !== 'string' || iso.length === 0) {
      return '—';
    }
    return iso.replace('T', ' ').replace(/\.\d{3}Z?$/, '');
  }

  function aplicarFiltro(lista) {
    var f = filtro();
    var salida = [];
    for (var i = 0; i < lista.length; i++) {
      var s = lista[i];
      if (f === 'activas' && s.atendido) {
        continue;
      }
      if (f === 'atendidas' && !s.atendido) {
        continue;
      }
      salida.push(s);
    }
    return salida;
  }

  // Markdown de exportación: cada línea del contenido citada con `> ` (se
  // usa textContent, así nada de la sugerencia se interpreta como HTML).
  function aMarkdown(lista) {
    var lineas = [
      '# Sugerencias del piloto',
      '',
      '> Archivo generado por la vista del Jefe de Contrataciones. Contiene',
      '> fragmentos de los expedientes en uso: no distribuya sin revisar.',
      ''
    ];
    for (var i = 0; i < lista.length; i++) {
      var s = lista[i];
      lineas.push('## ' + (s.id || ''));
      lineas.push('- Recibida: ' + formatearFecha(s.timestamp) + ' · ' + (s.email || '—'));
      lineas.push('- Pantalla: ' + (s.pantalla || '—') +
        (s.expediente ? ' · Expediente: ' + s.expediente : '') +
        (s.paso !== undefined && s.paso !== null ? ' · Paso: ' + s.paso : ''));
      lineas.push('- Estado: ' + (s.atendido ? 'Atendida' : 'Pendiente'));
      lineas.push('');
      var contenido = String(s.contenido || '').split(/\r?\n/);
      for (var j = 0; j < contenido.length; j++) {
        lineas.push('> ' + contenido[j]);
      }
      lineas.push('');
    }
    return lineas.join('\n');
  }

  function marcarAtendida(id) {
    var operador = estado.operador || {};
    var contexto = {
      email: operador.email || null,
      rol: Array.isArray(operador.roles) ? operador.roles[0] : null,
      equipo: operador.equipo || null
    };
    estado.repo.marcarSugerenciaAtendida(id, contexto).then(function () {
      return refrescar();
    }).catch(function (err) {
      estado.dom.error.textContent = 'No se pudo marcar: ' + err.message;
      estado.dom.error.hidden = false;
    });
  }

  function refrescar() {
    if (!estado.repo || !estado.dom.lista) {
      return;
    }
    estado.dom.error.hidden = true;
    estado.dom.conteo.textContent = 'Cargando…';
    estado.repo.listarSugerencias().then(function (respuesta) {
      estado.sugerencias = respuesta.sugerencias || [];
      var visibles = aplicarFiltro(estado.sugerencias);
      limpiar(estado.dom.lista);
      var pendientes = estado.sugerencias.filter(function (s) {
        return !s.atendido;
      }).length;
      estado.dom.conteo.textContent = estado.sugerencias.length +
        ' reportes · ' + pendientes + ' pendientes' +
        (respuesta.completo ? '' : ' · el diálogo alcanzó su tope');
      if (visibles.length === 0) {
        var vacio = document.createElement('li');
        vacio.textContent = 'No hay reportes para este filtro.';
        estado.dom.lista.appendChild(vacio);
        return;
      }
      for (var i = 0; i < visibles.length; i++) {
        (function (s) {
          var li = document.createElement('li');
          li.className = 'sugerencia-item' + (s.atendido ? ' atendida' : '');
          var cabecera = document.createElement('p');
          cabecera.className = 'sugerencia-cabecera';
          cabecera.textContent = s.id + ' · ' + formatearFecha(s.timestamp) + ' · ' + (s.email || '—') +
            ' · ' + (s.pantalla || '—') +
            (s.expediente ? ' · Expediente: ' + s.expediente : '');
          li.appendChild(cabecera);
          var contexto = document.createElement('p');
          contexto.className = 'sugerencia-contexto';
          contexto.textContent = 'Catálogo ' + (s.catalogoVersion || '—') +
            (s.paso !== undefined && s.paso !== null ? ' · Paso: ' + s.paso : '') +
            ' · App ' + (s.appVersion || '—');
          li.appendChild(contexto);
          var contenido = document.createElement('pre');
          contenido.textContent = s.contenido || '';
          li.appendChild(contenido);
          if (s.atendido) {
            var nota = document.createElement('p');
            nota.className = 'sugerencia-nota';
            nota.textContent = 'Atendida por ' + (s.atendidaPor || '—') + ' en ' + formatearFecha(s.atendidaEn);
            li.appendChild(nota);
          } else {
            var boton = document.createElement('button');
            boton.type = 'button';
            boton.textContent = 'Marcar como atendida';
            boton.addEventListener('click', function () {
              marcarAtendida(s.id);
            });
            li.appendChild(boton);
          }
          estado.dom.lista.appendChild(li);
        })(visibles[i]);
      }
    }).catch(function (err) {
      estado.dom.error.textContent = 'No se pudieron leer las sugerencias: ' + err.message;
      estado.dom.error.hidden = false;
    });
  }

  function exportar() {
    var visibles = aplicarFiltro(estado.sugerencias);
    if (visibles.length === 0) {
      return;
    }
    var cargo = aMarkdown(visibles);
    estado.dom.advertencia.showModal();
    estado.pendiente = { nombre: 'sugerencias.md', contenido: cargo };
  }

  function montar(raiz) {
    estado.dom.filtro = qs(raiz, '#sgc-sugerencias-filtro');
    estado.dom.lista = qs(raiz, '#sgc-sugerencias-lista');
    estado.dom.conteo = qs(raiz, '#sgc-sugerencias-conteo');
    estado.dom.error = qs(raiz, '#sgc-sugerencias-error');
    estado.dom.advertencia = qs(raiz, '#sgc-sugerencias-advertencia');
    qs(raiz, '#sgc-sugerencias-refrescar').addEventListener('click', refrescar);
    qs(raiz, '#sgc-sugerencias-volver').addEventListener('click', function () {
      if (typeof estado.onVolver === 'function') {
        estado.onVolver();
      }
    });
    estado.dom.filtro.addEventListener('change', refrescar);
    qs(raiz, '#sgc-exportar-sugerencias').addEventListener('click', exportar);
    qs(raiz, '#sgc-sugerencias-advertencia-aceptar').addEventListener('click', function () {
      estado.dom.advertencia.close();
      if (estado.pendiente && typeof estado.descargar === 'function') {
        estado.descargar(estado.pendiente.nombre, estado.pendiente.contenido);
        estado.pendiente = null;
      }
    });
    qs(raiz, '#sgc-sugerencias-advertencia-cancelar').addEventListener('click', function () {
      estado.dom.advertencia.close();
      estado.pendiente = null;
    });
  }

  SGC.views.sugerenciasJefe = {
    montar: montar,
    fijarRepo: function (repo) {
      estado.repo = repo;
    },
    fijarOperador: function (operador) {
      estado.operador = operador;
    },
    fijarDescargador: function (fn) {
      estado.descargar = fn;
    },
    onVolver: function (fn) {
      estado.onVolver = fn;
    },
    refrescar: refrescar,
    aMarkdown: aMarkdown
  };
})(typeof window !== 'undefined' ? window : globalThis);