/*
 * indice.js
 * Índice de búsqueda del catálogo (ADR-004, ORDEN-RONDA-04 §3.2).
 *
 * Módulo puro: no toca la red ni el DOM. Normaliza el texto a minúsculas sin
 * acentos y devuelve coincidencias como tramos [inicio, largo] sobre el texto
 * original, para poder resaltar en pantalla exactamente lo que matchea.
 *
 * API:
 *   montar({ rubros, clases })           precarga el índice; devuelve el conteo
 *   buscarClases(texto, limite)          -> [{idClase, rubro, clase, cantidad, coincidencias, coincidenciasRubro}]
 *   filtrarPorRubro(rubro)               -> [{idClase, clase, cantidad}]
 *   buscarEnItems(texto, items, limite)  -> [{codigo, item, coincidencias}]
 *   registrarCodigos(lista)              alimenta el set de códigos conocidos
 *   cargarCodigos(lista)                 alimenta el set desde codigos.json
 *   codigoExiste(codigo[, items])        existencia contra el contexto o el set
 *
 * Contrato de los tramos (ORDEN-RONDA-05 §2.1): la búsqueda de clases matchea
 * sobre el texto combinado "rubro + ' ' + clase", pero los tramos se devuelven
 * traducidos a cada campo por separado, porque la interfaz resalta cada cadena
 * por su cuenta. `coincidencias` son índices [inicio, largo] válidos sobre
 * `clase`; `coincidenciasRubro` son índices válidos sobre `rubro`. En
 * `buscarEnItems`, `coincidencias` son índices válidos sobre `item`.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.catalogo) {
    throw new Error('indice.js requiere que namespaces.js se cargue primero');
  }

  var entradas = [];
  var porRubro = {};
  var codigosVistos = new Set();

  function normalizarConMapa(texto) {
    var norm = '';
    var origIdx = [];
    for (var i = 0; i < texto.length; i++) {
      var descomp = texto[i].normalize('NFD');
      var base = descomp.replace(/[\u0300-\u036f]/g, '');
      if (base.length === 0) {
        continue;
      }
      for (var j = 0; j < base.length; j++) {
        norm += base[j];
        origIdx.push(i);
      }
    }
    return { norm: norm.toLowerCase(), origIdx: origIdx };
  }

  function normalizar(texto) {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function terminosDe(texto) {
    return normalizar(texto).split(/\s+/).filter(function (t) {
      return t.length > 0;
    });
  }

  function tramosDeTermino(norm, origIdx, termino) {
    var tramos = [];
    var desde = 0;
    for (;;) {
      var pos = norm.indexOf(termino, desde);
      if (pos === -1) {
        break;
      }
      var inicio = origIdx[pos];
      var fin = origIdx[pos + termino.length - 1] + 1;
      tramos.push([inicio, fin - inicio]);
      desde = pos + termino.length;
    }
    return tramos;
  }

  // Traduce los tramos de un término (válidos contra el texto combinado
  // "rubro + ' ' + clase") a dos listas separadas: `clase` con índices de
  // `clase`, `rubro` con índices de `rubro`. La clase comienza en la posición
  // rubroLargo + 1 del texto combinado. Un término de una sola palabra nunca
  // atraviesa el espacio entre rubro y clase; el caso cruzado es defensivo.
  function tramosPorRegion(entrada, termino) {
    var claseInicio = entrada.rubroLargo + 1;
    var ts = tramosDeTermino(entrada.norm, entrada.origIdx, termino);
    var clase = [];
    var rubro = [];
    for (var i = 0; i < ts.length; i++) {
      var ini = ts[i][0];
      var lar = ts[i][1];
      if (ini >= claseInicio) {
        clase.push([ini - claseInicio, lar]);
      } else if (ini + lar <= claseInicio) {
        rubro.push([ini, lar]);
      } else {
        clase.push([0, ini + lar - claseInicio]);
      }
    }
    return { clase: clase, rubro: rubro };
  }

  function montar(opciones) {
    entradas = [];
    porRubro = {};
    var rubros = opciones.rubros || [];
    var nombreRubros = {};
    for (var i = 0; i < rubros.length; i++) {
      nombreRubros[rubros[i].idRubro] = rubros[i].rubro;
    }
    var clases = opciones.clases || [];
    for (var j = 0; j < clases.length; j++) {
      var e = clases[j];
      var rubro = nombreRubros[e[1]] || '';
      var mapa = normalizarConMapa(rubro + ' ' + e[2]);
      entradas.push({
        idClase: e[0],
        rubro: rubro,
        clase: e[2],
        rubroLargo: rubro.length,
        cantidad: e[3],
        partes: e.length > 4 ? e[4] : 1,
        norm: mapa.norm,
        origIdx: mapa.origIdx
      });
      var lista = porRubro[rubro];
      if (!lista) {
        lista = [];
        porRubro[rubro] = lista;
      }
      lista.push({ idClase: e[0], clase: e[2], cantidad: e[3] });
    }
    return entradas.length;
  }

  function buscarClases(texto, limite) {
    if (typeof texto !== 'string' || texto.trim() === '') {
      return [];
    }
    var terminos = terminosDe(texto);
    if (terminos.length === 0) {
      return [];
    }
    var resultados = [];
    for (var i = 0; i < entradas.length; i++) {
      var e = entradas[i];
      var tramosClase = [];
      var tramosRubro = [];
      var cumple = true;
      for (var t = 0; t < terminos.length; t++) {
        var porRegion = tramosPorRegion(e, terminos[t]);
        if (porRegion.clase.length === 0 && porRegion.rubro.length === 0) {
          cumple = false;
          break;
        }
        tramosClase = tramosClase.concat(porRegion.clase);
        tramosRubro = tramosRubro.concat(porRegion.rubro);
      }
      if (!cumple) {
        continue;
      }
      resultados.push({
        idClase: e.idClase,
        rubro: e.rubro,
        clase: e.clase,
        cantidad: e.cantidad,
        coincidencias: tramosClase,
        coincidenciasRubro: tramosRubro
      });
      if (limite !== undefined && resultados.length >= limite) {
        break;
      }
    }
    return resultados;
  }

  function filtrarPorRubro(rubro) {
    var lista = porRubro[rubro];
    return lista ? lista.slice() : [];
  }

  function buscarEnItems(texto, items, limite) {
    if (!items) {
      return [];
    }
    if (typeof texto !== 'string' || texto.trim() === '') {
      var todos = [];
      for (var k = 0; k < items.length; k++) {
        todos.push({ codigo: items[k].codigo, item: items[k].item, coincidencias: [] });
        if (limite !== undefined && todos.length >= limite) {
          break;
        }
      }
      return todos;
    }
    var terminos = terminosDe(texto);
    var resultados = [];
    for (var i = 0; i < items.length; i++) {
      var mapa = normalizarConMapa(items[i].item);
      var tramos = [];
      var cumple = true;
      for (var t = 0; t < terminos.length; t++) {
        var ts = tramosDeTermino(mapa.norm, mapa.origIdx, terminos[t]);
        if (ts.length === 0) {
          cumple = false;
          break;
        }
        tramos = tramos.concat(ts);
      }
      if (!cumple) {
        continue;
      }
      resultados.push({
        codigo: items[i].codigo,
        item: items[i].item,
        coincidencias: tramos
      });
      if (limite !== undefined && resultados.length >= limite) {
        break;
      }
    }
    return resultados;
  }

  function registrarCodigos(lista) {
    for (var i = 0; i < lista.length; i++) {
      codigosVistos.add(lista[i].codigo);
    }
  }

  // Registra el arreglo plano de códigos de codigos.json (ORDEN-RONDA-05 §3.4)
  // para validar existencia de códigos importados sin cargar fragmentos.
  function cargarCodigos(lista) {
    for (var i = 0; i < lista.length; i++) {
      codigosVistos.add(lista[i]);
    }
  }

  function codigoExiste(codigo, items) {
    if (items) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].codigo === codigo) {
          return true;
        }
      }
      return false;
    }
    return codigosVistos.has(codigo);
  }

  SGC.catalogo.indice = {
    montar: montar,
    buscarClases: buscarClases,
    filtrarPorRubro: filtrarPorRubro,
    buscarEnItems: buscarEnItems,
    registrarCodigos: registrarCodigos,
    cargarCodigos: cargarCodigos,
    codigoExiste: codigoExiste
  };
})(typeof window !== 'undefined' ? window : globalThis);