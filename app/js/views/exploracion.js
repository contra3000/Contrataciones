/*
 * exploracion.js
 * ORDEN-RONDA-12 §3.5 (ADR-024). Vista cruda del registro de eventos: filtrar
 * y exportar a CSV y JSON. Es lo que permite que dentro de seis meses aparezca
 * un indicador que hoy no se nos ocurre.
 *
 * §3.7: el registro de eventos es dato sensible — se advierte antes de
 * cualquier descarga.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('exploracion.js requiere que namespaces.js se cargue primero');
  }

  var estado = {
    eventos: [],
    filtrados: [],
    contenedor: null
  };

  var ADVERTENCIA_SENSIBLE = 'ATENCIÓN: El registro de eventos contiene datos sensibles sobre el desempeño de personas identificadas. Su uso queda sujeto al criterio del Jefe de Contrataciones (ADR-024).';

  function qs(raiz, sel) { return raiz.querySelector(sel); }

  function aplicarFiltros() {
    var tipo = estado.tipoFiltro || '';
    var texto = estado.textoFiltro || '';
    estado.filtrados = estado.eventos.filter(function (e) {
      if (tipo && e.tipo !== tipo) return false;
      if (texto) {
        var s = JSON.stringify(e).toLowerCase();
        if (s.indexOf(texto.toLowerCase()) === -1) return false;
      }
      return true;
    });
  }

  function exportarJSON() {
    var contenido = JSON.stringify(estado.filtrados, null, 2);
    descargar('eventos.json', contenido, 'application/json');
  }

  // §2.1 ORDEN-RONDA-13: neutralización de fórmulas (ADR-031, misma forma que
  // el YAML: neutralizar siempre, no detectar). Todo texto que empiece con =,
  // +, -, @ o tabulador lleva un apóstrofo delante, sin excepción: así un
  // campo no se ejecuta al abrir el CSV en una planilla. Se aplica ANTES del
  // escapado de coma/comilla, y el apóstrofo conserva el dato (la planilla lo
  // muestra sin el prefijo).
  function neutralizarFormulas(texto) {
    var primero = texto.charAt(0);
    if (primero === '=' || primero === '+' || primero === '-' ||
        primero === '@' || primero === '\t') {
      return "'" + texto;
    }
    return texto;
  }

  function valorCSV(valor) {
    var str = valor === null || valor === undefined ? '' : String(valor);
    str = neutralizarFormulas(str);
    if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  // Líneas de un CSV (con cabecera), puras y exportadas para poder testearlas
  // byte a byte sin pasar por el navegador.
  function lineasCSV(registros) {
    if (!Array.isArray(registros) || registros.length === 0) {
      return [];
    }
    var columnas = [];
    var mapaCols = {};
    for (var i = 0; i < registros.length; i++) {
      var e = registros[i];
      if (!e || typeof e !== 'object') {
        continue;
      }
      var claves = Object.keys(e);
      for (var j = 0; j < claves.length; j++) {
        if (!mapaCols[claves[j]]) {
          mapaCols[claves[j]] = true;
          columnas.push(claves[j]);
        }
      }
    }
    var lineas = [columnas.join(',')];
    for (var k = 0; k < registros.length; k++) {
      var fila = [];
      for (var c = 0; c < columnas.length; c++) {
        var val = registros[k] ? registros[k][columnas[c]] : undefined;
        fila.push(valorCSV(val));
      }
      lineas.push(fila.join(','));
    }
    return lineas;
  }

  function exportarCSV() {
    if (estado.filtrados.length === 0) return;
    var lineas = lineasCSV(estado.filtrados);
    descargar('eventos.csv', lineas.join('\n'), 'text/csv');
  }

  function descargar(nombre, contenido, mime) {
    if (typeof document === 'undefined') return;
    var blob = new Blob([contenido], { type: mime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function montar(contenedor, eventos) {
    if (!contenedor) return;
    estado.contenedor = contenedor;
    estado.eventos = Array.isArray(eventos) ? eventos : [];
    estado.filtrados = estado.eventos.slice();
    estado.tipoFiltro = '';
    estado.textoFiltro = '';

    contenedor.innerHTML = '';

    // §3.7: advertencia de dato sensible
    var adv = document.createElement('div');
    adv.className = 'exploracion-advertencia';
    adv.textContent = ADVERTENCIA_SENSIBLE;
    contenedor.appendChild(adv);

    var h2 = document.createElement('h2');
    h2.textContent = 'Exploración de eventos';
    contenedor.appendChild(h2);

    // Filtros
    var filtros = document.createElement('div');
    filtros.className = 'exploracion-filtros';

    var selTipo = document.createElement('select');
    selTipo.id = 'sgc-exploracion-tipo';
    var optTodas = document.createElement('option');
    optTodas.value = '';
    optTodas.textContent = 'Todos los tipos';
    selTipo.appendChild(optTodas);
    var tipos = ['transicion', 'devolucion', 'edicion', 'conflicto', 'rechazo',
      'entregable', 'exportacion', 'renglon', 'aclaracion', 'busqueda_catalogo',
      'permanencia', 'area_solicitante', 'precarga_editada', 'valor_referencia',
      'reuso_base'];
    for (var t = 0; t < tipos.length; t++) {
      var opt = document.createElement('option');
      opt.value = tipos[t];
      opt.textContent = tipos[t];
      selTipo.appendChild(opt);
    }
    selTipo.addEventListener('change', function () {
      estado.tipoFiltro = selTipo.value;
      aplicarFiltros();
      actualizarTabla();
    });
    filtros.appendChild(selTipo);

    var inpTexto = document.createElement('input');
    inpTexto.type = 'search';
    inpTexto.placeholder = 'Buscar en JSON...';
    inpTexto.id = 'sgc-exploracion-buscar';
    inpTexto.addEventListener('input', function () {
      estado.textoFiltro = inpTexto.value;
      aplicarFiltros();
      actualizarTabla();
    });
    filtros.appendChild(inpTexto);
    contenedor.appendChild(filtros);

    // Contador
    var contador = document.createElement('div');
    contador.className = 'exploracion-contador';
    contador.id = 'sgc-exploracion-contador';
    contador.textContent = estado.filtrados.length + ' de ' + estado.eventos.length + ' eventos';
    contenedor.appendChild(contador);

    // Tabla
    var tablaDiv = document.createElement('div');
    tablaDiv.className = 'exploracion-tabla';
    tablaDiv.id = 'sgc-exploracion-tabla';
    contenedor.appendChild(tablaDiv);
    actualizarTabla();

    // Botones de exportación
    var btns = document.createElement('div');
    btns.className = 'exploracion-botones';

    var btnJSON = document.createElement('button');
    btnJSON.textContent = 'Exportar JSON';
    btnJSON.addEventListener('click', exportarJSON);
    btns.appendChild(btnJSON);

    var btnCSV = document.createElement('button');
    btnCSV.textContent = 'Exportar CSV';
    btnCSV.addEventListener('click', exportarCSV);
    btns.appendChild(btnCSV);

    contenedor.appendChild(btns);
  }

  function actualizarTabla() {
    var tablaDiv = estado.contenedor && qs(estado.contenedor, '#sgc-exploracion-tabla');
    var contador = estado.contenedor && qs(estado.contenedor, '#sgc-exploracion-contador');
    if (!tablaDiv) return;

    tablaDiv.innerHTML = '';
    if (contador) {
      contador.textContent = estado.filtrados.length + ' de ' + estado.eventos.length + ' eventos';
    }

    if (estado.filtrados.length === 0) {
      var p = document.createElement('p');
      p.textContent = 'No hay eventos que coincidan con los filtros.';
      tablaDiv.appendChild(p);
      return;
    }

    var tabla = document.createElement('table');
    tabla.className = 'doc-renglones';
    var thead = document.createElement('thead');
    var trH = document.createElement('tr');
    var cols = ['tipo', 'timestamp', 'email', 'rol'];
    for (var c = 0; c < cols.length; c++) {
      var th = document.createElement('th');
      th.textContent = cols[c];
      trH.appendChild(th);
    }
    thead.appendChild(trH);
    tabla.appendChild(thead);

    var tbody = document.createElement('tbody');
    var maxFilas = Math.min(estado.filtrados.length, 200);
    for (var i = 0; i < maxFilas; i++) {
      var e = estado.filtrados[i];
      var tr = document.createElement('tr');
      for (var j = 0; j < cols.length; j++) {
        var td = document.createElement('td');
        td.textContent = e[cols[j]] !== undefined && e[cols[j]] !== null ? String(e[cols[j]]) : '';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    tabla.appendChild(tbody);
    tablaDiv.appendChild(tabla);

    if (estado.filtrados.length > 200) {
      var aviso = document.createElement('p');
      aviso.textContent = 'Mostrando 200 de ' + estado.filtrados.length + ' eventos. Exporte a JSON para el completo.';
      tablaDiv.appendChild(aviso);
    }
  }

  SGC.views.exploracion = {
    montar: montar,
    estado: estado,
    neutralizarFormulas: neutralizarFormulas,
    lineasCSV: lineasCSV
  };
})(typeof window !== 'undefined' ? window : globalThis);
