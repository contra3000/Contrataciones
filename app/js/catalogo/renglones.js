/*
 * renglones.js
 * Composición y validación de los renglones del pedido (ORDEN-RONDA-04 §3.4,
 * ORDEN-RONDA-05 §3.1 paso 2). Extraído de buscador.js para que el wizard
 * embeba la misma lista de renglones y para poder restaurarla desde un
 * borrador. Cada renglón compone {codigo, cantidad, unidad, aclaracion} y se
 * valida con SGC.core.validacion.validarRenglon más la existencia del código
 * en el catálogo cargado (SGC.catalogo.indice.codigoExiste).
 *
 * API:
 *   montar({ listaRenglones, resumen })   fija los nodos del DOM
 *   agregar(resultado)                    agrega un renglón desde un ítem
 *   obtener()                             copia de los renglones actuales
 *   cargar(lista)                         reemplaza la lista y re-renderiza
 *   vaciar()                              quita todos los renglones
 *   erroresDeRenglon(renglon)             lista de errores (forma + catálogo)
 *   actualizarResumen()                   refresca el contador de renglones
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.catalogo) {
    throw new Error('renglones.js requiere que namespaces.js se cargue primero');
  }

  // Texto de ayuda visible de la aclaración (ORDEN-RONDA-23 §1). No valida ni
  // obliga: es la regla que hace evaluable una oferta. Visible, no globito.
  var AYUDA_ACLARACION = 'Qué agrega esta aclaración por sobre la descripción del ítem. ' +
    'No repita la descripción. Evite nombrar marcas para indicar calidad: escriba los ' +
    'parámetros técnicos exigibles —medidas, materiales, normas, tolerancias, garantía—, ' +
    'que son los que después permiten comparar y evaluar las ofertas.';

  // Definición única en config.js (ORDEN-RONDA-10 §2.1). Se lee perezosamente
  // para no depender del orden de carga.
  function limitesAclaracion() {
    return {
      total: SGC.core.config.MAX_ACLARACION_TOTAL,
      impreso: SGC.core.config.MAX_ACLARACION
    };
  }

  var estado = {
    renglones: [],
    siguienteId: 1,
    dom: {},
    onCambio: null,
    suscriptor: null,
    // ORDEN-RONDA-33 pieza 2: el renglón "por buscar" que está esperando que se
    // elija un ítem del buscador. El próximo ítem elegido lo Reemplaza en vez de
    // agregar uno nuevo.
    destinoPorBuscar: null
  };

  // Un renglón "por buscar" todavía no tiene código: no se le aplican las
  // reglas de forma del renglón (eso lo mostrará la fila en rojo).
  function esPorBuscar(renglon) {
    return renglon && renglon.porBuscar === true;
  }

  function erroresDeRenglon(renglon) {
    if (esPorBuscar(renglon)) {
      return [];
    }
    var v = SGC.core.validacion.validarRenglon({
      codigo: renglon.codigo,
      cantidad: renglon.cantidad,
      unidad: renglon.unidad,
      aclaracion: renglon.aclaracion
    });
    var errores = v.errores.slice();
    if (errores.length === 0 && !SGC.catalogo.indice.codigoExiste(renglon.codigo)) {
      errores.push('El código no existe en el catálogo');
    }
    return errores;
  }

  function filaRenglon(renglon) {
    var porBuscar = esPorBuscar(renglon);
    var li = document.createElement('li');
    li.className = porBuscar ? 'renglon renglon-por-buscar' : 'renglon';

    var cab = document.createElement('div');
    cab.className = 'renglon-cab';
    var codigo = document.createElement('span');
    codigo.className = 'renglon-codigo';
    codigo.textContent = renglon.codigo;
    var item = document.createElement('span');
    item.className = 'renglon-item';
    item.textContent = porBuscar
      ? 'Falta elegir el ítem del catálogo — buscado como: «' + (renglon.buscar || '') + '»'
      : renglon.item;
    cab.appendChild(codigo);
    cab.appendChild(item);
    if (porBuscar) {
      var btnBuscar = document.createElement('button');
      btnBuscar.type = 'button';
      btnBuscar.className = 'buscar';
      btnBuscar.setAttribute('data-buscar', '');
      btnBuscar.setAttribute('aria-label', 'Buscar el ítem del renglón por buscar');
      btnBuscar.textContent = 'Buscar';
      btnBuscar.addEventListener('click', function () {
        estado.destinoPorBuscar = renglon;
        if (SGC.catalogo.buscador && typeof SGC.catalogo.buscador.buscar === 'function') {
          SGC.catalogo.buscador.buscar(renglon.buscar || '');
        }
      });
      cab.appendChild(btnBuscar);
    }
    li.appendChild(cab);

    var editor = document.createElement('div');
    editor.className = 'renglon-editor';

    var lblCantidad = document.createElement('label');
    lblCantidad.textContent = 'Cantidad';
    var cantidad = document.createElement('input');
    cantidad.type = 'number';
    cantidad.min = '0';
    cantidad.step = 'any';
    cantidad.value = String(renglon.cantidad);
    cantidad.setAttribute('aria-label', 'Cantidad del ítem');
    lblCantidad.appendChild(cantidad);
    editor.appendChild(lblCantidad);

    var lblUnidad = document.createElement('label');
    lblUnidad.textContent = 'Unidad';
    var unidad = document.createElement('input');
    unidad.type = 'text';
    unidad.maxLength = 40;
    unidad.placeholder = 'Ej.: unidad, kg, m';
    unidad.value = renglon.unidad !== undefined && renglon.unidad !== null ? String(renglon.unidad) : '';
    unidad.setAttribute('aria-label', 'Unidad de medida');
    lblUnidad.appendChild(unidad);
    editor.appendChild(lblUnidad);

    var lblAclaracion = document.createElement('label');
    lblAclaracion.className = 'aclaracion';
    lblAclaracion.textContent = 'Aclaración';
    var limites = limitesAclaracion();
    var aclaracion = document.createElement('textarea');
    aclaracion.maxLength = limites.total;
    aclaracion.rows = 2;
    aclaracion.value = renglon.aclaracion !== undefined && renglon.aclaracion !== null ? String(renglon.aclaracion) : '';
    aclaracion.setAttribute('aria-label', 'Aclaración opcional');
    var contador = document.createElement('span');
    contador.className = 'contador';
    contador.textContent = '0/' + limites.total;
    var ayuda = document.createElement('p');
    ayuda.className = 'ayuda-aclaracion';
    ayuda.textContent = AYUDA_ACLARACION;
    lblAclaracion.appendChild(aclaracion);
    lblAclaracion.appendChild(contador);
    lblAclaracion.appendChild(ayuda);
    editor.appendChild(lblAclaracion);

    var btnQuitar = document.createElement('button');
    btnQuitar.type = 'button';
    btnQuitar.className = 'quitar';
    btnQuitar.textContent = 'Quitar';
    btnQuitar.setAttribute('aria-label', 'Quitar el renglón ' + renglon.codigo);
    editor.appendChild(btnQuitar);
    li.appendChild(editor);

    var error = document.createElement('p');
    error.className = 'renglon-error';
    error.setAttribute('role', 'alert');
    error.hidden = true;
    li.appendChild(error);

    function validarYMostrar() {
      renglon.cantidad = cantidad.value === '' ? NaN : Number(cantidad.value);
      renglon.unidad = unidad.value;
      renglon.aclaracion = aclaracion.value;
      var limites = limitesAclaracion();
      // El conteo del contador es el mismo criterio de todo el sistema:
      // puntos de código (utils.contarCaracteres, ORDEN-RONDA-10-CIERRE §2).
      var contados = SGC.core.utils.contarCaracteres(aclaracion.value);
      contador.textContent = contados + '/' + limites.total +
        (contados > limites.impreso ? ' · supera ' + limites.impreso + ': va al anexo de EETT' : '');
      var errores = erroresDeRenglon(renglon);
      if (errores.length > 0) {
        error.textContent = errores.join(' · ');
        error.hidden = false;
      } else {
        error.textContent = '';
        error.hidden = true;
      }
      actualizarResumen();
      notificar();
    }

    cantidad.addEventListener('input', validarYMostrar);
    unidad.addEventListener('input', validarYMostrar);
    aclaracion.addEventListener('input', validarYMostrar);
    btnQuitar.addEventListener('click', function () {
      var indice = estado.renglones.indexOf(renglon);
      if (indice !== -1) {
        estado.renglones.splice(indice, 1);
      }
      if (estado.destinoPorBuscar === renglon) {
        estado.destinoPorBuscar = null;
      }
      li.remove();
      actualizarResumen();
    });

    validarYMostrar();
    return li;
  }

  function actualizarResumen() {
    var total = estado.renglones.length;
    var conErrores = 0;
    for (var i = 0; i < estado.renglones.length; i++) {
      if (erroresDeRenglon(estado.renglones[i]).length > 0) {
        conErrores++;
      }
    }
    var texto = total === 0
      ? 'Sin renglones todavía.'
      : total + ' renglón' + (total === 1 ? '' : 'es') + ' — ' +
        conErrores + ' con error' + (conErrores === 1 ? '' : 'es');
    estado.dom.resumen.textContent = texto;
  }

  function notificar() {
    if (typeof estado.onCambio === 'function') {
      estado.onCambio();
    }
    // Un segundo interesado, además del dueño que puso montar(): el generador
    // rearma su bloque de valores de referencia cuando la lista cambia
    // (ORDEN-RONDA-28 §3). Es un lugar, no una lista: la pantalla que se
    // suscribe es una sola, y volver a suscribirse la reemplaza.
    if (typeof estado.suscriptor === 'function') {
      estado.suscriptor();
    }
  }

  // Vuelve a dibujar la lista entera, en orden. Se usa al reemplazar un renglón
  // por buscar: el DOM del stub no tiene insertBefore ni replaceChild, así que
  // la forma portable es vaciar y volver a poner todas las filas (como cargar).
  function reconstruirLista() {
    estado.dom.listaRenglones.textContent = '';
    for (var i = 0; i < estado.renglones.length; i++) {
      estado.dom.listaRenglones.appendChild(filaRenglon(estado.renglones[i]));
    }
  }

  function agregar(resultado) {
    // ORDEN-RONDA-33 pieza 2: si había un renglón esperando ("Buscar"), el ítem
    // elegido lo reemplaza en su lugar, conservando cantidad, unidad y
    // aclaración que la persona ya hubiera escrito.
    if (estado.destinoPorBuscar) {
      var destino = estado.destinoPorBuscar;
      estado.destinoPorBuscar = null;
      if (estado.renglones.indexOf(destino) !== -1) {
        destino.codigo = resultado.codigo;
        destino.item = resultado.item;
        delete destino.porBuscar;
        delete destino.buscar;
        reconstruirLista();
        actualizarResumen();
        notificar();
        return;
      }
    }
    var renglon = {
      id: estado.siguienteId++,
      codigo: resultado.codigo,
      item: resultado.item,
      cantidad: 1,
      unidad: '',
      aclaracion: ''
    };
    estado.renglones.push(renglon);
    estado.dom.listaRenglones.appendChild(filaRenglon(renglon));
    actualizarResumen();
    notificar();
  }

  function obtener() {
    return JSON.parse(JSON.stringify(estado.renglones));
  }

  function cargar(lista) {
    estado.renglones = [];
    estado.destinoPorBuscar = null;
    estado.dom.listaRenglones.textContent = '';
    for (var i = 0; i < lista.length; i++) {
      // RONDA-25 pieza 6: el editor de renglones vuelve a cargar los que ya
      // están en disco, que pueden traer campos del requerimiento
      // (valoresReferencia, cantidadMaxima/minima). Se preservan para que una
      // corrección de cantidad o aclaración no los borre de la escritura.
      var renglon = {
        id: estado.siguienteId++,
        codigo: lista[i].codigo,
        item: lista[i].item,
        cantidad: lista[i].cantidad,
        unidad: lista[i].unidad,
        aclaracion: lista[i].aclaracion
      };
      for (var k in lista[i]) {
        if (Object.prototype.hasOwnProperty.call(lista[i], k) && k !== 'id' &&
            renglon[k] === undefined) {
          renglon[k] = lista[i][k];
        }
      }
      estado.renglones.push(renglon);
      estado.dom.listaRenglones.appendChild(filaRenglon(renglon));
    }
    actualizarResumen();
    notificar();
  }

  function vaciar() {
    estado.renglones = [];
    estado.destinoPorBuscar = null;
    estado.dom.listaRenglones.textContent = '';
    actualizarResumen();
    notificar();
  }

  /*
   * Montar es empezar una lista nueva: se vacía la que hubiera y se vuelve a 1
   * la numeración, porque los ids de renglón son de esta lista (los valores de
   * referencia se guardan por id de renglón, ORDEN-RONDA-28 §3, y el editor los
   * restaura de un renglón al otro). Quien necesite recargar renglones en esta
   * misma lista —un borrador, un expediente— usa cargar(), no montar().
   */
  function montar(dom) {
    estado.dom.listaRenglones = dom.listaRenglones;
    estado.dom.resumen = dom.resumen;
    estado.renglones = [];
    estado.siguienteId = 1;
    estado.destinoPorBuscar = null;
    estado.dom.listaRenglones.textContent = '';
    if (dom.onCambio) {
      estado.onCambio = dom.onCambio;
    }
    actualizarResumen();
  }

  SGC.catalogo.renglones = {
    MAX_ACLARACION: SGC.core.config.MAX_ACLARACION,
    montar: montar,
    agregar: agregar,
    obtener: obtener,
    cargar: cargar,
    vaciar: vaciar,
    erroresDeRenglon: erroresDeRenglon,
    actualizarResumen: actualizarResumen,
    alCambiar: function (fn) {
      estado.suscriptor = typeof fn === 'function' ? fn : null;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);