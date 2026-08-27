/*
 * requerimiento.js
 * ORDEN-RONDA-09 §3 (ADR-022). Modelo del requerimiento real —una Solicitud
 * de Gastos—, cálculo del valor preventivo y ayudas de presentación.
 *
 * - Los campos del encabezado y de la imputación son datos (modelo), no
 *   reglas: viven en `expediente.requerimiento` e `expediente.imputacion`.
 * - El valor preventivo normaliza antes de promediar (ADR-022 §2): un valor
 *   con base 'total' se divide por la cantidad. Promediar sin normalizar —
 *   mezclar un unitario con un total en la misma media— produce un número
 *   plausible y sin significado: es el defecto que esta ronda hace imposible.
 * - `totalEnLetras` y `descomponerCodigo` alimentan la plantilla del
 *   requerimiento (renders/requerimiento.js).
 *
 * Módulo puro: sin DOM y sin red.
 */
(function (root) {
  'use strict';

  var SGC = root.SGC;
  if (!SGC || !SGC.core) {
    throw new Error('requerimiento.js requiere que namespaces.js se cargue primero');
  }

  // Campos del encabezado (MODELO REQ..xlsx, ANALISIS_ENTREGABLES_REALES §3.1)
  // en orden de impresión. La plantilla los recorre.
  var CAMPOS_ENCABEZADO = [
    { clave: 'lugar', etiqueta: 'Lugar' },
    { clave: 'fecha', etiqueta: 'Fecha' },
    { clave: 'organismo', etiqueta: 'Organismo' },
    { clave: 'cuit', etiqueta: 'CUIT' },
    { clave: 'unidadSolicitante', etiqueta: 'Unidad solicitante' },
    { clave: 'rubroCodigo', etiqueta: 'Rubro comercial (código)' },
    { clave: 'rubroDescripcion', etiqueta: 'Rubro comercial (descripción)' },
    { clave: 'modalidadCompra', etiqueta: 'Modalidad de compra sugerida' },
    { clave: 'vigenciaInicio', etiqueta: 'Inicio de vigencia sugerido' },
    { clave: 'vigenciaFin', etiqueta: 'Fin de vigencia sugerido' },
    { clave: 'procedimientoSeleccion', etiqueta: 'Procedimiento de selección sugerido' },
    { clave: 'causasContratacionDirecta', etiqueta: 'Causas de contratación directa' },
    { clave: 'clase', etiqueta: 'Clase' },
    { clave: 'objeto', etiqueta: 'Objeto' },
    { clave: 'prioridad', etiqueta: 'Prioridad' },
    { clave: 'justificacionNecesidad', etiqueta: 'Justificación de la necesidad' }
  ];

  // Los dieciséis campos de la imputación presupuestaria (ADR-022 §4). Se
  // admiten varias filas; cada fila es un objeto con estos campos.
  var IMPUTACION_CAMPOS = [
    'Ejerc', 'R', 'S', 'C', 'Ft', 'PG', 'Sp', 'Py',
    'Ac', 'Ob', 'UG', 'I', 'Pppal', 'Ppcial', 'Spa', 'M'
  ];

  function esNumeroPositivo(valor) {
    return typeof valor === 'number' && isFinite(valor) && valor > 0;
  }

  // Descompone el código de catálogo en IPP / Clase / Ítem (ADR-022 §1):
  // '2.5.8-378.186' -> { ipp: '258', clase: '378', item: '186' }. Es partir
  // la cadena, no traducir: el IPP se imprime sin sus puntos.
  function descomponerCodigo(codigo) {
    if (typeof codigo !== 'string' || codigo.length === 0) {
      return { ipp: '', clase: '', item: '' };
    }
    var ippParte = codigo;
    var resto = '';
    var guion = codigo.indexOf('-');
    if (guion !== -1) {
      ippParte = codigo.slice(0, guion);
      resto = codigo.slice(guion + 1);
    }
    var clase = resto;
    var item = '';
    var punto = resto.indexOf('.');
    if (punto !== -1) {
      clase = resto.slice(0, punto);
      item = resto.slice(punto + 1);
    }
    return { ipp: ippParte.replace(/\./g, ''), clase: clase, item: item };
  }

  // Rechaza un valor de referencia mal formado. La base es obligatoria: un
  // valor sin base no se puede normalizar. Con base 'total' y cantidad cero
  // o ausente no hay normalización posible: se rechaza, nunca se divide por
  // cero (ADR-022 §2).
  function validarValoresReferencia(renglon) {
    var errores = [];
    if (!renglon || typeof renglon !== 'object') {
      return errores;
    }
    var lista = Array.isArray(renglon.valoresReferencia) ? renglon.valoresReferencia : [];
    for (var i = 0; i < lista.length; i++) {
      var v = lista[i];
      var prefijo = 'Valor de referencia ' + (i + 1) + ': ';
      if (!v || typeof v !== 'object') {
        errores.push(prefijo + 'debe ser un objeto');
        continue;
      }
      if (typeof v.presupuestoId !== 'string' || v.presupuestoId.trim() === '') {
        errores.push(prefijo + 'falta el id del presupuesto');
      }
      if (v.base !== 'unitario' && v.base !== 'total') {
        errores.push(prefijo + 'la base debe ser "unitario" o "total"');
      }
      if (typeof v.valor !== 'number' || !isFinite(v.valor) || v.valor < 0) {
        errores.push(prefijo + 'el valor debe ser un número no negativo');
      }
      if (v.base === 'total' && !esNumeroPositivo(renglon.cantidad)) {
        errores.push(prefijo +
          'con base "total" la cantidad debe ser un número positivo para poder normalizar');
      }
    }
    return errores;
  }

  // Reglas de cantidadMaxima / cantidadMinima (ORDEN-RONDA-09 §3.4). El
  // máximo es el tope por Solicitud de Provisión (uso de la División,
  // ADR-022 §3); el mínimo es opcional y vacío por defecto.
  function validarCantidades(renglon) {
    var errores = [];
    if (!renglon || typeof renglon !== 'object') {
      return errores;
    }
    if (renglon.cantidadMaxima !== undefined && renglon.cantidadMaxima !== null &&
        !(typeof renglon.cantidadMaxima === 'number' && isFinite(renglon.cantidadMaxima) &&
          renglon.cantidadMaxima > 0)) {
      errores.push('La cantidad máxima debe ser un número positivo');
    }
    if (renglon.cantidadMinima !== undefined && renglon.cantidadMinima !== null &&
        !(typeof renglon.cantidadMinima === 'number' && isFinite(renglon.cantidadMinima) &&
          renglon.cantidadMinima >= 0)) {
      errores.push('La cantidad mínima debe ser un número no negativo');
    }
    if (esNumeroPositivo(renglon.cantidadMaxima) &&
        typeof renglon.cantidadMinima === 'number' &&
        renglon.cantidadMinima > renglon.cantidadMaxima) {
      errores.push('La cantidad mínima no puede superar la cantidad máxima');
    }
    return errores;
  }

  // Normaliza un valor de referencia a unitario (ADR-022 §2 paso 1). Exige
  // que la cantidad sea positiva: la validación lo garantiza antes.
  function normalizarUnitario(valorRef, cantidad) {
    if (!valorRef || typeof valorRef !== 'object') {
      return 0;
    }
    var valor = typeof valorRef.valor === 'number' ? valorRef.valor : 0;
    if (valorRef.base === 'total') {
      return cantidad > 0 ? valor / cantidad : 0;
    }
    return valor;
  }

  // Valor preventivo del renglón: promedia los unitarios normalizados y lo
  // multiplica por la cantidad (ADR-022 §2 pasos 2 y 3). Nunca divide por
  // cero: un valor con base 'total' y cantidad inválida lo deja sin
  // preventivo y reporta el error.
  function preventivoRenglon(renglon) {
    var errores = validarValoresReferencia(renglon);
    if (errores.length > 0) {
      return { valido: false, promedio: null, preventivo: null, errores: errores };
    }
    var lista = Array.isArray(renglon.valoresReferencia) ? renglon.valoresReferencia : [];
    if (lista.length === 0) {
      return { valido: true, promedio: null, preventivo: null, errores: [] };
    }
    var suma = 0;
    for (var i = 0; i < lista.length; i++) {
      suma += normalizarUnitario(lista[i], renglon.cantidad);
    }
    var promedio = suma / lista.length;
    var cantidad = typeof renglon.cantidad === 'number' ? renglon.cantidad : 0;
    return {
      valido: true,
      promedio: promedio,
      preventivo: promedio * cantidad,
      errores: []
    };
  }

  // Valor preventivo de la contratación: suma de los preventivos de renglón
  // (ADR-022 §2 paso 4). Si algún renglón no tiene preventivo válido, el
  // total no se produce.
  function preventivoContratacion(renglones) {
    var total = 0;
    var invalidos = [];
    for (var i = 0; i < renglones.length; i++) {
      var r = preventivoRenglon(renglones[i]);
      if (!r.valido || r.preventivo === null) {
        invalidos.push(i + 1);
        continue;
      }
      total += r.preventivo;
    }
    return { valido: invalidos.length === 0, total: total, renglonesInvalidos: invalidos };
  }

  // OCA activa cuando la modalidad de compra es de orden de compra abierta
  // (campo `oca`, la modalidad lo dice, o algún renglón trae cantidadMaxima).
  function ocaActiva(requerimiento, renglones) {
    if (requerimiento && typeof requerimiento === 'object') {
      if (requerimiento.oca === true) {
        return true;
      }
      if (requerimiento.oca === false) {
        return false;
      }
      if (/oca|orden de compra abierta/i.test(String(requerimiento.modalidadCompra || ''))) {
        return true;
      }
    }
    var lista = Array.isArray(renglones) ? renglones : [];
    for (var i = 0; i < lista.length; i++) {
      if (lista[i] && lista[i].cantidadMaxima !== undefined && lista[i].cantidadMaxima !== null) {
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Causal OCA (ORDEN-RONDA-11 §2.3): texto canónico compartido por pantalla
  // y(print). Explica que OCA requiere ajuste al importe si los consumos
  // superan el contratado.
  // ---------------------------------------------------------------------------
  var NOTA_OCA =
    'La modalidad de contratación es Orden de Compra Abierta (OCA). ' +
    'Los consumos acumulados que superen el importe total contratado ' +
    'requerirán un ajuste formal (modificación o nueva contratación). ' +
    'Verificar la previsión de alcanzar el monto total del contrato.';

  // ---------------------------------------------------------------------------
  // Total en letras (ORDEN-RONDA-09 §3.5): "LA SUMA DE: PESOS ... CON 00/100.-"
  // ---------------------------------------------------------------------------
  var UNIDADES = [
    '', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS',
    'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDOS',
    'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE',
    'VEINTIOCHO', 'VEINTINUEVE'
  ];
  var DECENAS = [
    '', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA',
    'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'
  ];
  var CENTENAS = [
    '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS',
    'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'
  ];

  function palabrasDeTresDigitos(n) {
    var resultado = [];
    var centenas = Math.floor(n / 100);
    var resto = n % 100;
    if (centenas === 1 && resto === 0) {
      return 'CIEN';
    }
    if (centenas > 0) {
      resultado.push(CENTENAS[centenas]);
    }
    if (resto > 0) {
      if (resto <= 29) {
        resultado.push(UNIDADES[resto]);
      } else {
        var decena = Math.floor(resto / 10);
        var unidad = resto % 10;
        resultado.push(DECENAS[decena] + (unidad > 0 ? ' Y ' + UNIDADES[unidad] : ''));
      }
    }
    return resultado.join(' ');
  }

  function palabrasEntero(numero) {
    if (numero === 0) {
      return 'CERO';
    }
    var partes = [];
    var millones = Math.floor(numero / 1000000);
    var miles = Math.floor((numero % 1000000) / 1000);
    var resto = numero % 1000;
    if (millones > 0) {
      partes.push(millones === 1 ? 'UN MILLÓN' : palabrasDeTresDigitos(millones) + ' MILLONES');
    }
    if (miles > 0) {
      partes.push(miles === 1 ? 'MIL' : palabrasDeTresDigitos(miles) + ' MIL');
    }
    if (resto > 0) {
      partes.push(palabrasDeTresDigitos(resto));
    }
    return partes.join(' ');
  }

  // Total en letras con la fórmula oficial. Acepta el cero.
  function totalEnLetras(monto) {
    var numero = typeof monto === 'number' && isFinite(monto) ? monto : 0;
    if (numero < 0) {
      numero = 0;
    }
    var enteros = Math.floor(numero);
    var centavos = Math.round((numero - enteros) * 100);
    if (centavos === 100) {
      enteros += 1;
      centavos = 0;
    }
    return 'LA SUMA DE: PESOS ' + palabrasEntero(enteros) +
      ' CON ' + (centavos < 10 ? '0' : '') + centavos + '/100.-';
  }

  // ---------------------------------------------------------------------------
  // Acceso normalizado al expediente
  // ---------------------------------------------------------------------------
  function requerimientoDe(expediente) {
    var datos = (expediente && typeof expediente.datos === 'object' && expediente.datos) || expediente || {};
    var req = (datos.requerimiento && typeof datos.requerimiento === 'object') ? datos.requerimiento : {};
    return {
      requerimiento: req,
      imputacion: Array.isArray(datos.imputacion) ? datos.imputacion : [],
      presupuestos: Array.isArray(datos.presupuestos) ? datos.presupuestos : [],
      renglones: Array.isArray(datos.renglones) ? datos.renglones : []
    };
  }

  // Validación agregada del requerimiento: errores de valores de referencia y
  // de cantidades máximas/mínimas de todos los renglones.
  function validarRequerimiento(expediente) {
    var errores = [];
    var info = requerimientoDe(expediente);
    for (var i = 0; i < info.renglones.length; i++) {
      var prefijo = 'Renglón ' + (i + 1) + ': ';
      var valores = validarValoresReferencia(info.renglones[i]);
      var cantidades = validarCantidades(info.renglones[i]);
      for (var j = 0; j < valores.length; j++) {
        errores.push(prefijo + valores[j]);
      }
      for (var k = 0; k < cantidades.length; k++) {
        errores.push(prefijo + cantidades[k]);
      }
    }
    return { valido: errores.length === 0, errores: errores };
  }

  SGC.core.requerimiento = {
    CAMPOS_ENCABEZADO: CAMPOS_ENCABEZADO,
    IMPUTACION_CAMPOS: IMPUTACION_CAMPOS,
    NOTA_OCA: NOTA_OCA,
    descomponerCodigo: descomponerCodigo,
    validarValoresReferencia: validarValoresReferencia,
    validarCantidades: validarCantidades,
    normalizarUnitario: normalizarUnitario,
    preventivoRenglon: preventivoRenglon,
    preventivoContratacion: preventivoContratacion,
    ocaActiva: ocaActiva,
    totalEnLetras: totalEnLetras,
    requerimientoDe: requerimientoDe,
    validarRequerimiento: validarRequerimiento
  };
})(typeof window !== 'undefined' ? window : globalThis);