/*
 * requerimiento-valores.js
 * ORDEN-RONDA-10 §3.1 (H11, ADR-022). Bloque de valores de referencia de la
 * pantalla de carga del requerimiento: por renglón, tantas filas como citas a
 * presupuestos tenga, cada una con el presupuesto elegido de una LISTA (los
 * que de verdad tiene el expediente; un id fantasma deja de ser posible),
 * la base elegida explícitamente SIN valor por defecto y el valor.
 *
 * El cálculo es vivo pero no es dueño de la regla: delega en las funciones del
 * núcleo (preventivoRenglon / preventivoContratacion) sobre un renglón temporal,
 * así la pantalla calcula exactamente lo mismo que el servidor valida y que
 * imprime el documento. La validación del cliente es conveniencia; la regla
 * vive en core/ (y el servidor re-valida por su cuenta).
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('requerimiento-valores.js requiere que namespaces.js se cargue primero');
  }

  var estado = {
    dom: {},
    renglones: [],
    presupuestos: [],
    valores: [],
    mostrarOca: false,
    editable: false,
    onCambio: null
  };

  function qs(raiz, selector) {
    return raiz.querySelector(selector);
  }

  function montar(raiz) {
    estado.dom.raiz = raiz;
    estado.dom.contenedor = qs(raiz, '#sgc-req-valores');
    estado.dom.total = qs(raiz, '#sgc-req-total');
  }

  function filaVacia() {
    return { presupuestoId: '', base: '', valor: '' };
  }

  function copiarFila(f) {
    return {
      presupuestoId: f && f.presupuestoId !== undefined && f.presupuestoId !== null ? String(f.presupuestoId) : '',
      base: f && f.base !== undefined && f.base !== null ? String(f.base) : '',
      valor: f && (f.valor !== undefined && f.valor !== null) ? String(f.valor) : ''
    };
  }

  // fijarDatos(renglones, presupuestos, valoresGuardados, cantidadesGuardadas,
  // opciones): (re)construye el bloque. Los guardados son los que trae el
  // expediente o el borrador local; si no hay, arranca con una fila vacía.
  // Las cantidades de la OCA las guarda su propio módulo (requerimiento-oca.js).
  function fijarDatos(renglones, presupuestos, valoresGuardados, cantidadesGuardadas, opciones) {
    var op = opciones || {};
    estado.renglones = Array.isArray(renglones) ? renglones : [];
    estado.presupuestos = Array.isArray(presupuestos) ? presupuestos : [];
    estado.valores = estado.renglones.map(function (r, i) {
      var g = valoresGuardados && valoresGuardados[i];
      if (Array.isArray(g) && g.length > 0) {
        return g.map(copiarFila);
      }
      return [filaVacia()];
    });
    estado.mostrarOca = op.mostrarOca === true;
    estado.editable = op.editable === true;
    if (SGC.views.requerimientoOca &&
        typeof SGC.views.requerimientoOca.fijar === 'function') {
      SGC.views.requerimientoOca.fijar(estado.renglones, cantidadesGuardadas, estado.mostrarOca);
    }
    render();
  }

  function monto(n) {
    if (typeof n !== 'number' || !isFinite(n)) {
      return '—';
    }
    var texto = n.toFixed(2);
    var partes = texto.split('.');
    return partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + partes[1];
  }

  // El renglón temporal con lo que hay en pantalla: es lo que se le pasa a las
  // funciones del núcleo, para que el cálculo vivo sea el mismo cálculo. Las
  // cantidades de la OCA vienen de su módulo, ya numéricas.
  function renglonTemporal(i) {
    var base = estado.renglones[i] || {};
    var temp = {};
    for (var k in base) {
      if (Object.prototype.hasOwnProperty.call(base, k)) {
        temp[k] = base[k];
      }
    }
    temp.valoresReferencia = valoresLimpios(i);
    if (estado.mostrarOca && SGC.views.requerimientoOca &&
        typeof SGC.views.requerimientoOca.valoresNumericos === 'function') {
      var oc = SGC.views.requerimientoOca.valoresNumericos(i);
      temp.cantidadMaxima = oc.maxima;
      temp.cantidadMinima = oc.minima;
    }
    return temp;
  }

  // Filas completas (las vacías no se mandan ni se validan).
  function valoresLimpios(i) {
    var salida = [];
    var filas = estado.valores[i] || [];
    for (var j = 0; j < filas.length; j++) {
      var f = filas[j];
      if ((f.presupuestoId === '' && f.base === '' && String(f.valor).trim() === '') ||
          !f.base || String(f.valor).trim() === '') {
        continue;
      }
      salida.push({
        presupuestoId: f.presupuestoId,
        base: f.base,
        valor: Number(String(f.valor).replace(',', '.'))
      });
    }
    return salida;
  }

  function recalcular() {
    if (!estado.dom.contenedor) {
      return;
    }
    var req = SGC.core.requerimiento;
    var totalGeneral = null;
    for (var i = 0; i < estado.renglones.length; i++) {
      var prev = req.preventivoRenglon(renglonTemporal(i));
      var linea = qs(estado.dom.contenedor, '[data-calculo="' + i + '"]');
      if (!linea) {
        continue;
      }
      if (prev.promedio === null && prev.preventivo === null) {
        linea.textContent = 'Sin valores suficientes: cargá al menos dos cotizaciones o una base "total".';
      } else {
        linea.textContent = 'Promedio unitario: $ ' + monto(prev.promedio) +
          ' · Preventivo del renglón: $ ' + monto(prev.preventivo);
      }
      var t = req.preventivoContratacion([renglonTemporal(i)]);
      if (t.valido && typeof t.total === 'number') {
        totalGeneral = (totalGeneral === null ? 0 : totalGeneral) + t.total;
      }
    }
    if (estado.dom.total) {
      var todos = [];
      for (var r = 0; r < estado.renglones.length; r++) {
        todos.push(renglonTemporal(r));
      }
      var total = req.preventivoContratacion(todos);
      estado.dom.total.textContent = total.valido && estado.renglones.length > 0
        ? 'Valor preventivo de la contratación: $ ' + monto(total.total)
        : 'Valor preventivo de la contratación: —';
    }
    if (typeof estado.onCambio === 'function') {
      estado.onCambio();
    }
  }

  function selectPresupuesto(doc, fila) {
    var sel = doc.createElement('select');
    var placeholder = doc.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— elegir presupuesto —';
    sel.appendChild(placeholder);
    for (var p = 0; p < estado.presupuestos.length; p++) {
      var pr = estado.presupuestos[p];
      var opt = doc.createElement('option');
      opt.value = pr.id;
      opt.textContent = pr.nombreOriginal + ' (' + pr.id + ')';
      if (fila.presupuestoId === pr.id) {
        opt.selected = true;
      }
      sel.appendChild(opt);
    }
    sel.setAttribute('aria-label', 'Presupuesto citado');
    return sel;
  }

  function render() {
    var contenedor = estado.dom.contenedor;
    if (!contenedor) {
      return;
    }
    while (contenedor.children.length > 0) {
      contenedor.removeChild(contenedor.children[0]);
    }
    var doc = document;
    var req = SGC.core.requerimiento;
    for (var i = 0; i < estado.renglones.length; i++) {
      var r = estado.renglones[i];
      var bloque = doc.createElement('div');
      bloque.className = 'req-renglon';
      bloque.setAttribute('data-renglon', String(i));

      var titulo = doc.createElement('h4');
      titulo.textContent = 'Renglón ' + (i + 1) + ' · ' + (r.codigo || '') +
        (r.item || r.descripcion ? ' · ' + (r.item || r.descripcion) : '');
      bloque.appendChild(titulo);

      var tabla = doc.createElement('div');
      tabla.className = 'req-valores-filas';
      bloque.appendChild(tabla);

      var acciones = doc.createElement('p');
      var btnAgregar = doc.createElement('button');
      btnAgregar.type = 'button';
      btnAgregar.className = 'req-agregar-valor';
      btnAgregar.setAttribute('data-indice', String(i));
      btnAgregar.textContent = 'Agregar valor';
      btnAgregar.disabled = !estado.editable;
      acciones.appendChild(btnAgregar);
      bloque.appendChild(acciones);

      var calculo = doc.createElement('p');
      calculo.className = 'req-calculo';
      calculo.setAttribute('data-calculo', String(i));
      bloque.appendChild(calculo);

      if (estado.mostrarOca && SGC.views.requerimientoOca &&
          typeof SGC.views.requerimientoOca.bloque === 'function') {
        bloque.appendChild(SGC.views.requerimientoOca.bloque(doc, i));
      }
      contenedor.appendChild(bloque);
      pintarFilas(tabla, i, doc);
    }
    recalcular();
  }

  function pintarFilas(tabla, i, doc) {
    while (tabla.children.length > 0) {
      tabla.removeChild(tabla.children[0]);
    }
    var filas = estado.valores[i] || [];
    for (var j = 0; j < filas.length; j++) {
      var filaDiv = doc.createElement('div');
      filaDiv.className = 'req-valor-fila';

      var selP = selectPresupuesto(doc, filas[j]);
      selP.setAttribute('data-presupuesto', i + ':' + j);
      selP.disabled = !estado.editable;
      filaDiv.appendChild(selP);

      var selBase = doc.createElement('select');
      selBase.setAttribute('data-base', i + ':' + j);
      selBase.setAttribute('aria-label', 'Base del valor');
      selBase.disabled = !estado.editable;
      var ph = doc.createElement('option');
      ph.value = '';
      ph.textContent = '— elegir base —';
      selBase.appendChild(ph);
      ['unitario', 'total'].forEach(function (b) {
        var opt = doc.createElement('option');
        opt.value = b;
        opt.textContent = b === 'unitario'
          ? 'unitario — precio por unidad'
          : 'total — por todo el renglón (decir cantidad)';
        if (filas[j].base === b) {
          opt.selected = true;
        }
        selBase.appendChild(opt);
      });
      filaDiv.appendChild(selBase);

      var inValor = doc.createElement('input');
      inValor.type = 'text';
      inValor.inputMode = 'decimal';
      inValor.placeholder = 'Valor en pesos';
      inValor.value = filas[j].valor;
      inValor.setAttribute('data-valor', i + ':' + j);
      inValor.setAttribute('aria-label', 'Valor en pesos');
      inValor.disabled = !estado.editable;
      filaDiv.appendChild(inValor);

      var btnQuitar = doc.createElement('button');
      btnQuitar.type = 'button';
      btnQuitar.className = 'req-quitar-valor';
      btnQuitar.setAttribute('data-quitar', i + ':' + j);
      btnQuitar.textContent = 'Quitar';
      btnQuitar.disabled = !estado.editable;
      filaDiv.appendChild(btnQuitar);

      tabla.appendChild(filaDiv);
    }
  }

  function errores() {
    var req = SGC.core.requerimiento;
    var salida = [];
    for (var i = 0; i < estado.renglones.length; i++) {
      var temp = renglonTemporal(i);
      // validarValoresReferencia devuelve el arreglo de errores directamente.
      var v = req.validarValoresReferencia(temp);
      for (var e = 0; e < v.length; e++) {
        salida.push('Renglón ' + (i + 1) + ': ' + v[e]);
      }
      var ids = {};
      for (var p = 0; p < estado.presupuestos.length; p++) {
        ids[estado.presupuestos[p].id] = true;
      }
      var filas = temp.valoresReferencia || [];
      for (var f = 0; f < filas.length; f++) {
        if (filas[f].presupuestoId && !ids[filas[f].presupuestoId]) {
          salida.push('Renglón ' + (i + 1) + ': el presupuesto citado no existe en este expediente');
        }
      }
    }
    return salida;
  }

  function leer() {
    var valores = [];
    var cantidades = [];
    for (var i = 0; i < estado.renglones.length; i++) {
      valores.push(valoresLimpios(i));
      if (SGC.views.requerimientoOca &&
          typeof SGC.views.requerimientoOca.leer === 'function') {
        var leido = SGC.views.requerimientoOca.leer();
        cantidades.push(leido[i] || { maxima: undefined, minima: undefined });
      } else {
        cantidades.push({ maxima: undefined, minima: undefined });
      }
    }
    return { valores: valores, cantidades: cantidades };
  }

  // Manejo de eventos delegado desde el formulario (un solo listener en la
  // sección): cambia el estado interno y recalcula. Los campos de la OCA los
  // atiende su propio módulo; si consumió el evento, no hay nada más que
  // hacer acá.
  function alCambiar(objetivo) {
    if (SGC.views.requerimientoOca &&
        typeof SGC.views.requerimientoOca.alCambiar === 'function' &&
        SGC.views.requerimientoOca.alCambiar(objetivo)) {
      recalcular();
      return;
    }
    var dato = objetivo.getAttribute('data-presupuesto') ||
      objetivo.getAttribute('data-base') || objetivo.getAttribute('data-valor');
    if (dato) {
      var partes = dato.split(':');
      var i = Number(partes[0]);
      var j = Number(partes[1]);
      var fila = estado.valores[i] && estado.valores[i][j];
      if (fila) {
        if (objetivo.hasAttribute('data-presupuesto')) {
          fila.presupuestoId = objetivo.value;
        } else if (objetivo.hasAttribute('data-base')) {
          fila.base = objetivo.value;
        } else {
          fila.valor = objetivo.value;
        }
      }
    }
    recalcular();
  }

  function agregarFila(i) {
    if (!estado.valores[i]) {
      return;
    }
    estado.valores[i].push(filaVacia());
    render();
  }

  function quitarFila(i, j) {
    if (!estado.valores[i] || estado.valores[i].length <= 1) {
      return;
    }
    estado.valores[i].splice(j, 1);
    render();
  }

  SGC.views.requerimientoValores = {
    montar: montar,
    fijarDatos: fijarDatos,
    leer: leer,
    errores: errores,
    alCambiar: alCambiar,
    agregarFila: agregarFila,
    quitarFila: quitarFila
  };
})(typeof window !== 'undefined' ? window : globalThis);
