/*
 * requerimiento-oca.js
 * ORDEN-RONDA-10 §3.1 (H11, ADR-022 §3). Bloque de cantidades de la OCA
 * dentro de la pantalla de carga del requerimiento: cantidad máxima —el tope
 * por Solicitud de Provisión, no un total del año— y cantidad mínima opcional.
 *
 * Es la parte del bloque de valores que toca cantidades: vive separado de
 * requerimiento-valores.js para que ningún archivo de la pantalla supere las
 * 400 líneas (ORDEN-RONDA-10 §3.1). El cálculo y las reglas siguen siendo del
 * núcleo (core/requerimiento.js, validarCantidades): acá sólo hay estado del
 * formulario y DOM.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.views) {
    throw new Error('requerimiento-oca.js requiere que namespaces.js se cargue primero');
  }

  var estado = {
    cantidades: [],
    activa: false
  };

  function fijar(renglones, cantidadesGuardadas, mostrarOca) {
    var lista = Array.isArray(renglones) ? renglones : [];
    estado.activa = mostrarOca === true;
    estado.cantidades = lista.map(function (r, i) {
      var g = cantidadesGuardadas && cantidadesGuardadas[i];
      return {
        maxima: g && g.maxima !== undefined && g.maxima !== null ? String(g.maxima) : '',
        minima: g && g.minima !== undefined && g.minima !== null ? String(g.minima) : ''
      };
    });
  }

  function activa() {
    return estado.activa;
  }

  function numeroDe(texto) {
    if (typeof texto !== 'string' || texto.trim() === '') {
      return undefined;
    }
    var n = Number(texto);
    return isFinite(n) ? n : undefined;
  }

  // Valores numéricos del renglón i, tal como los consume el cálculo del
  // núcleo (renglonTemporal): undefined cuando están vacíos o la OCA no está
  // activa, para que nadie invente cantidades que el operador no cargó.
  function valoresNumericos(i) {
    var c = estado.cantidades[i] || { maxima: '', minima: '' };
    return {
      maxima: estado.activa ? numeroDe(c.maxima) : undefined,
      minima: estado.activa ? numeroDe(c.minima) : undefined
    };
  }

  // Igual que leer() del bloque de valores: lo que se guarda en el expediente
  // y en el borrador local.
  function leer() {
    var salida = [];
    for (var i = 0; i < estado.cantidades.length; i++) {
      salida.push(valoresNumericos(i));
    }
    return salida;
  }

  function bloque(doc, i) {
    var div = doc.createElement('div');
    div.className = 'req-oca-campos';
    var c = estado.cantidades[i] || { maxima: '', minima: '' };
    var lblMax = doc.createElement('label');
    lblMax.textContent = 'Cantidad máxima (por Solicitud de Provisión)';
    var inMax = doc.createElement('input');
    inMax.type = 'number';
    inMax.min = '0';
    inMax.step = 'any';
    inMax.value = c.maxima;
    inMax.setAttribute('data-oca-max', String(i));
    inMax.setAttribute('aria-label', 'Cantidad máxima del renglón ' + (i + 1));
    lblMax.appendChild(inMax);
    div.appendChild(lblMax);
    var lblMin = doc.createElement('label');
    lblMin.textContent = 'Cantidad mínima (opcional)';
    var inMin = doc.createElement('input');
    inMin.type = 'number';
    inMin.min = '0';
    inMin.step = 'any';
    inMin.value = c.minima;
    inMin.setAttribute('data-oca-min', String(i));
    inMin.setAttribute('aria-label', 'Cantidad mínima del renglón ' + (i + 1));
    lblMin.appendChild(inMin);
    div.appendChild(lblMin);
    return div;
  }

  // Manejo delegado desde el formulario: si el objetivo es un campo de la
  // OCA, actualiza el estado y avisa que lo consumió.
  function alCambiar(objetivo) {
    var ocaMax = objetivo.getAttribute('data-oca-max');
    var ocaMin = objetivo.getAttribute('data-oca-min');
    if (ocaMax === null && ocaMin === null) {
      return false;
    }
    if (ocaMax !== null && estado.cantidades[Number(ocaMax)]) {
      estado.cantidades[Number(ocaMax)].maxima = objetivo.value;
    }
    if (ocaMin !== null && estado.cantidades[Number(ocaMin)]) {
      estado.cantidades[Number(ocaMin)].minima = objetivo.value;
    }
    return true;
  }

  SGC.views.requerimientoOca = {
    fijar: fijar,
    activa: activa,
    valoresNumericos: valoresNumericos,
    leer: leer,
    bloque: bloque,
    alCambiar: alCambiar
  };
})(typeof window !== 'undefined' ? window : globalThis);
