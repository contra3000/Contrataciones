/*
 * valores.js
 * ORDEN-RONDA-28 §3 (ADR-044). Los dos valores de referencia por renglón, en el
 * generador.
 *
 * El bloque de valores NO se reescribe: se reutiliza tal cual
 * SGC.views.requerimientoValores (views/requerimiento-valores.js), que ya sabe
 * pintar las filas, elegir la base, calcular el promedio con el núcleo y decir
 * qué falta. Es el mismo archivo que usa la pantalla de carga del requerimiento
 * con servidor, y por eso la regla de la ronda 26 —cada renglón con al menos dos
 * valores completos (ADR-022)— es aquí la misma regla, con el mismo texto.
 *
 * Lo que este módulo agrega es de dónde salen los presupuestos que se citan: en
 * el generador son referencias (generador/presupuestos.js), no archivos
 * subidos. Y de dónde sale el valor de cada fila cuando hay que llevar todo eso
 * al expediente local que se imprime y se exporta.
 *
 * Los valores se guardan por el id del renglón (no por posición): quitar el
 * segundo renglón de una lista no puede correr los valores del tercero.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views || !SGC.views.requerimientoValores) {
    throw new Error('generador/valores.js requiere que se cargue primero views/requerimiento-valores.js');
  }

  var valores = SGC.views.requerimientoValores;

  var estado = {
    porId: {},
    // ORDEN-RONDA-38 pieza 2e: las cantidades de la OCA por id de renglón
    // ({maxima, minima}), para que viajen al JSON y vuelvan. Viven acá igual que
    // los valores, por id y no por posición.
    cantidadesPorId: {},
    renglones: [],
    presupuestos: [],
    moneda: null,
    // ORDEN-RONDA-38 pieza 2: con la modalidad "orden de compra abierta" el
    // bloque pide las cantidades de la OCA. Se recuerda entre llamadas.
    mostrarOca: false,
    alCambio: null
  };

  function guardar() {
    var leido = valores.leer();
    for (var i = 0; i < estado.renglones.length; i++) {
      var r = estado.renglones[i];
      if (!r || r.id === undefined || r.id === null) {
        continue;
      }
      var clave = String(r.id);
      estado.porId[clave] = leido.valores[i] || [];
      // ORDEN-RONDA-38 pieza 2e: lo que `leer` da de cantidades es undefined
      // cuando la OCA no está activa, así que sólo se pisa lo que hay: las
      // cantidades ya cargadas sobreviven a un cambio de modalidad.
      var c = leido.cantidades && leido.cantidades[i];
      if (c && (c.maxima !== undefined || c.minima !== undefined)) {
        estado.cantidadesPorId[clave] = { maxima: c.maxima, minima: c.minima };
      }
    }
    if (typeof estado.alCambio === 'function') {
      estado.alCambio();
    }
  }

  // (Re)arma el bloque para la lista de renglones de ahora. Se llama cada vez
  // que cambia la lista y también al entrar, porque el renglón recién agregado
  // nace con sus dos filas vacías (así lo deja la vista, ORDEN-RONDA-26 p5).
  // (Re)arma el bloque para la lista de renglones de ahora. Se llama cada vez
  // que cambia la lista y también al entrar, porque el renglón recién agregado
  // nace con sus dos filas vacías (así lo deja la vista, ORDEN-RONDA-26 p5).
  //
  // ORDEN-RONDA-35 pieza 2a: la moneda del proceso elegido viaja hasta la vista
  // para que el bloque hable en dólares cuando el proceso es en dólares. Se
  // recuerda entre llamadas: un renglón que cambia no puede olvidar la moneda.
  // ORDEN-RONDA-38 pieza 2: `mostrarOca` decide si el bloque pide las cantidades
  // de la OCA (cantidad máxima por Solicitud de Provisión y cantidad mínima).
  function sincronizar(renglones, presupuestos, moneda, mostrarOca) {
    if (moneda !== undefined) {
      estado.moneda = moneda;
    }
    if (mostrarOca !== undefined) {
      estado.mostrarOca = mostrarOca === true;
    }
    estado.renglones = Array.isArray(renglones) ? renglones : [];
    estado.presupuestos = Array.isArray(presupuestos) ? presupuestos : [];
    var guardados = estado.renglones.map(function (r) {
      var guardado = estado.porId[String(r && r.id)];
      return Array.isArray(guardado) ? guardado : null;
    });
    var cantidades = estado.renglones.map(function (r) {
      var c = estado.cantidadesPorId[String(r && r.id)];
      return c || null;
    });
    valores.fijarDatos(estado.renglones, estado.presupuestos, guardados, cantidades,
      { mostrarOca: estado.mostrarOca, editable: true, moneda: estado.moneda });
    guardar();
  }

  // Los renglones con sus valores, para el expediente local. Copia superficial
  // por renglón: los valores son objetos del núcleo y no se tocan. ORDEN-RONDA-38
  // pieza 2e: con la modalidad OCA cada renglón lleva además su cantidad máxima y
  // mínima (los números que el núcleo espera), para que el requerimiento las
  // imprima y el JSON las exporte.
  function renglonesConValores() {
    return estado.renglones.map(function (r) {
      var copia = {};
      for (var k in r) {
        if (Object.prototype.hasOwnProperty.call(r, k)) {
          copia[k] = r[k];
        }
      }
      copia.valoresReferencia = estado.porId[String(r.id)] || [];
      if (estado.mostrarOca) {
        var c = estado.cantidadesPorId[String(r.id)];
        if (c) {
          if (typeof c.maxima === 'number') {
            copia.cantidadMaxima = c.maxima;
          }
          if (typeof c.minima === 'number') {
            copia.cantidadMinima = c.minima;
          }
        }
      }
      return copia;
    });
  }

  function montar(raiz) {
    valores.montar(raiz);
    var contenedor = raiz.querySelector('#sgc-req-valores');
    if (!contenedor) {
      throw new Error('generador/valores.js requiere #sgc-req-valores');
    }
    // Delegación como en la pantalla del servidor: un solo escucha por tipo de
    // evento sobre el bloque, sin un listener por fila.
    contenedor.addEventListener('change', function (evento) {
      valores.alCambiar(evento.target);
      guardar();
    });
    contenedor.addEventListener('input', function (evento) {
      valores.alCambiar(evento.target);
      guardar();
    });
    contenedor.addEventListener('click', function (evento) {
      var objetivo = evento && evento.target;
      if (!objetivo || !objetivo.classList) {
        return;
      }
      if (objetivo.classList.contains('req-agregar-valor')) {
        valores.agregarFila(Number(objetivo.getAttribute('data-indice')));
        guardar();
      } else if (objetivo.classList.contains('req-quitar-valor')) {
        var partes = String(objetivo.getAttribute('data-quitar')).split(':');
        valores.quitarFila(Number(partes[0]), Number(partes[1]));
        guardar();
      }
    });
  }

  SGC.generadorValores = {
    montar: montar,
    sincronizar: sincronizar,
    renglonesConValores: renglonesConValores,
    alCambio: function (fn) {
      estado.alCambio = fn;
    },
    // Volver a empezar: los valores eran de una pantalla que ya no está (el
    // rol se elige una vez, y una recarga deja la memoria como el navegador la
    // deja). Sin esto, el renglón 1 de la nueva lista heredaría los valores del
    // renglón 1 de la anterior, que era otro renglón.
    limpiar: function () {
      estado.porId = {};
      estado.cantidadesPorId = {};
    },
    errores: function () {
      return valores.errores();
    },
    fijar: function (renglones, presupuestos, valoresPorRenglon, moneda,
      cantidadesPorRenglon, mostrarOca) {
      // Importar o retomar (pieza 4): los valores llegan del archivo, en el
      // mismo orden que los renglones. ORDEN-RONDA-35 pieza 2a: la moneda,
      // también (el avance exportado la trae; sus valores y el PAC ya estaban
      // resueltos, así que se saltea el ínterin en que la lista no está).
      // ORDEN-RONDA-38 pieza 2e: las cantidades de la OCA y la modalidad, también.
      estado.porId = {};
      estado.cantidadesPorId = {};
      for (var i = 0; i < (renglones || []).length; i++) {
        var r = renglones[i];
        if (r && r.id !== undefined && r.id !== null) {
          var clave = String(r.id);
          estado.porId[clave] = Array.isArray(valoresPorRenglon[i])
            ? valoresPorRenglon[i] : [];
          var c = cantidadesPorRenglon && cantidadesPorRenglon[i];
          if (c && typeof c === 'object') {
            estado.cantidadesPorId[clave] = c;
          }
        }
      }
      sincronizar(renglones, presupuestos, moneda, mostrarOca);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);