(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.catalogo) {
    throw new Error('busqueda-items.js requiere que namespaces.js se cargue primero');
  }

  var UNION = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'p', 'para',
    'con', 'sin', 'en', 'a', 'por']);
  var PALABRA = /[a-z0-9]+\.?/g;

  var estado = { items: [], indice: null, abreviaturas: null };

  function normalizar(texto) {
    return String(texto === undefined || texto === null ? '' : texto)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function normalizarConMapa(texto) {
    var norm = '';
    var origIdx = [];
    for (var i = 0; i < texto.length; i++) {
      var base = texto[i].normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      for (var j = 0; j < base.length; j++) {
        norm += base[j];
        origIdx.push(i);
      }
    }
    return { norm: norm.toLowerCase(), origIdx: origIdx };
  }

  function terminosDe(texto) {
    var todos = normalizar(texto).match(PALABRA) || [];
    var vistos = new Set();
    var salida = [];
    for (var i = 0; i < todos.length; i++) {
      if (UNION.has(todos[i]) || vistos.has(todos[i])) {
        continue;
      }
      vistos.add(todos[i]);
      salida.push(todos[i]);
    }
    return salida;
  }

  function base(palabra) {
    return palabra.length > 3 && palabra.charAt(palabra.length - 1) === 's'
      ? palabra.slice(0, -1) : palabra;
  }

  function preparar(palabra) {
    return { texto: palabra, base: base(palabra) };
  }

  function coincide(palabra, termino) {
    if (palabra.texto === termino.texto || palabra.texto.indexOf(termino.texto) === 0) {
      return true;
    }
    if (palabra.base === termino.base || palabra.base.indexOf(termino.base) === 0) {
      return true;
    }
    if (palabra.texto.length >= 4 &&
        palabra.texto.charCodeAt(palabra.texto.length - 1) === 46) {
      var abreviada = palabra.texto.slice(0, -1);
      return termino.texto.indexOf(abreviada) === 0 ||
        termino.base.indexOf(abreviada) === 0;
    }
    return false;
  }

  function palabrasDe(norm) {
    var salida = [];
    var re = new RegExp(PALABRA.source, 'g');
    var m;
    while ((m = re.exec(norm))) {
      salida.push({ texto: m[0], base: base(m[0]), inicio: m.index });
    }
    return salida;
  }

  function palabrasPreparadas(texto) {
    var salida = [];
    var re = new RegExp(PALABRA.source, 'g');
    var m;
    while ((m = re.exec(texto))) {
      salida.push(preparar(m[0]));
    }
    return salida;
  }

  function prepararTerminos(texto) {
    return terminosDe(texto).map(preparar);
  }

  function contiene(palabras, termino) {
    for (var i = 0; i < palabras.length; i++) {
      if (coincide(palabras[i], termino)) {
        return true;
      }
    }
    return false;
  }

  function tramosDeItem(item, terminos) {
    var mapa = normalizarConMapa(item);
    var palabras = palabrasDe(mapa.norm);
    var tramos = [];
    for (var t = 0; t < terminos.length; t++) {
      for (var p = 0; p < palabras.length; p++) {
        if (!coincide(palabras[p], terminos[t])) {
          continue;
        }
        var inicioNorm = palabras[p].inicio;
        var finNorm = inicioNorm + palabras[p].texto.length - 1;
        var inicio = mapa.origIdx[inicioNorm];
        var fin = mapa.origIdx[finNorm] + 1;
        tramos.push([inicio, fin - inicio]);
        break;
      }
    }
    return tramos;
  }

  function agregarAlIndice(mapa, clave, indice) {
    var lista = mapa.get(clave);
    if (!lista) {
      lista = [];
      mapa.set(clave, lista);
    }
    lista.push(indice);
  }

  function montar(datos) {
    estado.items = [];
    estado.indice = new Map();
    estado.abreviaturas = new Map();
    var lista = datos || [];
    for (var i = 0; i < lista.length; i++) {
      var entrada = lista[i];
      var codigo = entrada[0];
      var item = entrada[1];
      var norm = normalizar(item);
      var corte = norm.indexOf(';');
      var nombre = corte === -1 ? norm : norm.slice(0, corte);
      var resto = corte === -1 ? '' : norm.slice(corte);
      var palabras = palabrasPreparadas(nombre).concat(palabrasPreparadas(resto));
      estado.items.push({
        codigo: codigo,
        item: item,
        nombre: palabrasPreparadas(nombre),
        resto: palabrasPreparadas(resto)
      });
      var claves = new Set();
      var abreviaturas = new Set();
      for (var p = 0; p < palabras.length; p++) {
        var texto = palabras[p].texto;
        claves.add(texto.slice(0, 3));
        if (texto.length >= 4 && texto.charCodeAt(texto.length - 1) === 46) {
          abreviaturas.add(texto.slice(0, -1));
        }
      }
      claves.forEach(function (clave) {
        agregarAlIndice(estado.indice, clave, i);
      });
      abreviaturas.forEach(function (abreviatura) {
        agregarAlIndice(estado.abreviaturas, abreviatura, i);
      });
    }
    return estado.items.length;
  }

  function candidatosDe(terminos) {
    var candidatos = new Set();
    for (var t = 0; t < terminos.length; t++) {
      var termino = terminos[t];
      var variantes = [termino.texto];
      if (termino.base !== termino.texto) {
        variantes.push(termino.base);
      }
      if (termino.texto.charCodeAt(termino.texto.length - 1) === 46) {
        variantes.push(termino.texto.slice(0, -1));
      }
      for (var v = 0; v < variantes.length; v++) {
        var variante = variantes[v];
        if (variante.length < 3) {
          return null;
        }
        var lista = estado.indice.get(variante.slice(0, 3));
        if (lista) {
          for (var i = 0; i < lista.length; i++) {
            candidatos.add(lista[i]);
          }
        }
        for (var largo = 3; largo <= variante.length; largo++) {
          var abreviaturas = estado.abreviaturas.get(variante.slice(0, largo));
          if (abreviaturas) {
            for (var j = 0; j < abreviaturas.length; j++) {
              candidatos.add(abreviaturas[j]);
            }
          }
        }
      }
    }
    return candidatos;
  }

  function buscar(texto, limite) {
    var terminos = prepararTerminos(texto);
    if (terminos.length === 0) {
      return { total: 0, resultados: [] };
    }
    var tope = limite === undefined ? 60 : limite;
    var candidatos = [];
    var indices = candidatosDe(terminos);
    var listaIndices = indices === null ? null : Array.from(indices);
    var totalPosibles = listaIndices === null ? estado.items.length : listaIndices.length;
    for (var i = 0; i < totalPosibles; i++) {
      var entrada = listaIndices === null ? estado.items[i] : estado.items[listaIndices[i]];
      var encontrados = 0;
      var enNombre = 0;
      for (var t = 0; t < terminos.length; t++) {
        if (contiene(entrada.nombre, terminos[t])) {
          encontrados++;
          enNombre++;
        } else if (contiene(entrada.resto, terminos[t])) {
          encontrados++;
        }
      }
      if (encontrados === 0) {
        continue;
      }
      candidatos.push({
        codigo: entrada.codigo,
        item: entrada.item,
        encontrados: encontrados,
        enNombre: enNombre,
        largo: entrada.item.length
      });
    }
    candidatos.sort(function (a, b) {
      if (a.encontrados !== b.encontrados) {
        return b.encontrados - a.encontrados;
      }
      if (a.enNombre !== b.enNombre) {
        return b.enNombre - a.enNombre;
      }
      if (a.largo !== b.largo) {
        return a.largo - b.largo;
      }
      return a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0;
    });
    var resultados = [];
    for (var k = 0; k < candidatos.length && k < tope; k++) {
      resultados.push({
        codigo: candidatos[k].codigo,
        item: candidatos[k].item,
        coincidencias: tramosDeItem(candidatos[k].item, terminos)
      });
    }
    return { total: candidatos.length, resultados: resultados };
  }

  SGC.generadorBusqueda = {
    montar: montar,
    buscar: buscar,
    normalizar: normalizar,
    terminosDe: terminosDe
  };
})(typeof window !== 'undefined' ? window : globalThis);
