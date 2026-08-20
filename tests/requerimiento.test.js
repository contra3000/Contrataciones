'use strict';

/*
 * requerimiento.test.js
 * ORDEN-RONDA-09 §3 (ADR-022). El modelo del requerimiento y sus reglas:
 *
 *  - Descomposición del código de catálogo en IPP / Clase / Ítem.
 *  - Valores de referencia: la base es obligatoria y con base "total" la
 *    cantidad debe ser positiva (se normaliza dividiendo; nunca se divide
 *    por cero).
 *  - Valor preventivo: normalizar, promediar, multiplicar por la cantidad y
 *    sumar (ADR-022 §2).
 *  - Total en letras con la fórmula oficial.
 *  - Reglas de cantidadMaxima / cantidadMinima y OCA activa.
 *  - validarRequerimiento agrega los errores de todos los renglones.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'requerimiento.js'));

const SGC = globalThis.SGC;
const req = SGC.core.requerimiento;

test('descomponerCodigo parte IPP / Clase / Ítem (ADR-022 §1)', () => {
  assert.deepEqual(req.descomponerCodigo('2.5.8-378.186'),
    { ipp: '258', clase: '378', item: '186' });
  assert.deepEqual(req.descomponerCodigo('1.1.1-110.250'),
    { ipp: '111', clase: '110', item: '250' });
  assert.deepEqual(req.descomponerCodigo('2.5.8'),
    { ipp: '258', clase: '', item: '' });
  assert.deepEqual(req.descomponerCodigo(''),
    { ipp: '', clase: '', item: '' });
  assert.deepEqual(req.descomponerCodigo(null),
    { ipp: '', clase: '', item: '' });
});

test('validarValoresReferencia: la base es obligatoria y "total" exige cantidad', () => {
  const ok = req.validarValoresReferencia({
    codigo: '2.1.1-439.101', cantidad: 2, unidad: 'UN',
    valoresReferencia: [
      { presupuestoId: 'presupuesto-1', base: 'unitario', valor: 100 },
      { presupuestoId: 'presupuesto-2', base: 'total', valor: 300 }
    ]
  });
  assert.deepEqual(ok, []);

  const sinBase = req.validarValoresReferencia({
    codigo: 'x', cantidad: 2, valoresReferencia: [{ presupuestoId: 'p', valor: 10 }]
  });
  assert.ok(sinBase.some((e) => /la base debe ser/.test(e)));

  const totalSinCantidad = req.validarValoresReferencia({
    codigo: 'x', cantidad: 0, valoresReferencia: [{ presupuestoId: 'p', base: 'total', valor: 10 }]
  });
  assert.ok(totalSinCantidad.some((e) => /la cantidad debe ser un número positivo/.test(e)));

  const sinId = req.validarValoresReferencia({
    codigo: 'x', cantidad: 1, valoresReferencia: [{ base: 'unitario', valor: 10 }]
  });
  assert.ok(sinId.some((e) => /falta el id del presupuesto/.test(e)));

  const valorNegativo = req.validarValoresReferencia({
    codigo: 'x', cantidad: 1, valoresReferencia: [{ presupuestoId: 'p', base: 'unitario', valor: -1 }]
  });
  assert.ok(valorNegativo.some((e) => /no negativo/.test(e)));
});

test('validarCantidades: máximo positivo, mínimo opcional y no mayor que el máximo', () => {
  assert.deepEqual(req.validarCantidades({ cantidadMaxima: 100 }), []);
  assert.deepEqual(req.validarCantidades({ cantidadMaxima: 100, cantidadMinima: 25 }), []);
  assert.deepEqual(req.validarCantidades({}), []);

  const maximoCero = req.validarCantidades({ cantidadMaxima: 0 });
  assert.ok(maximoCero.some((e) => /máxima debe ser un número positivo/.test(e)));

  const minimoNegativo = req.validarCantidades({ cantidadMinima: -1 });
  assert.ok(minimoNegativo.some((e) => /mínima debe ser un número no negativo/.test(e)));

  const minimoMayor = req.validarCantidades({ cantidadMaxima: 10, cantidadMinima: 11 });
  assert.ok(minimoMayor.some((e) => /mínima no puede superar la cantidad máxima/.test(e)));
});

test('normalizarUnitario: con base "total" divide por la cantidad; unitario se conserva', () => {
  assert.equal(req.normalizarUnitario({ base: 'unitario', valor: 100 }, 2), 100);
  assert.equal(req.normalizarUnitario({ base: 'total', valor: 300 }, 2), 150);
  assert.equal(req.normalizarUnitario({ base: 'total', valor: 300 }, 0), 0,
    'con cantidad cero no normaliza ni divide por cero');
});

test('preventivoRenglon promedia los unitarios normalizados y multiplica por la cantidad', () => {
  const r = req.preventivoRenglon({
    codigo: '2.1.1-439.101', cantidad: 2, unidad: 'UN',
    valoresReferencia: [
      { presupuestoId: 'presupuesto-1', base: 'unitario', valor: 100 },
      { presupuestoId: 'presupuesto-2', base: 'total', valor: 300 }
    ]
  });
  // normalizados: 100 y 150 -> promedio 125 -> preventivo 125 * 2 = 250
  assert.equal(r.valido, true);
  assert.equal(r.promedio, 125);
  assert.equal(r.preventivo, 250);

  const sinValores = req.preventivoRenglon({ codigo: 'x', cantidad: 2 });
  assert.equal(sinValores.valido, true);
  assert.equal(sinValores.promedio, null);
  assert.equal(sinValores.preventivo, null);

  const invalido = req.preventivoRenglon({
    codigo: 'x', cantidad: 0,
    valoresReferencia: [{ presupuestoId: 'p', base: 'total', valor: 10 }]
  });
  assert.equal(invalido.valido, false);
  assert.equal(invalido.preventivo, null);
});

test('preventivoContratacion suma los preventivos y se invalida si falta alguno', () => {
  const total = req.preventivoContratacion([
    {
      codigo: '2.1.1-439.101', cantidad: 2, unidad: 'UN',
      valoresReferencia: [{ presupuestoId: 'p1', base: 'unitario', valor: 100 }]
    },
    {
      codigo: '2.1.1-439.102', cantidad: 1, unidad: 'UN',
      valoresReferencia: [{ presupuestoId: 'p1', base: 'unitario', valor: 50 }]
    }
  ]);
  // 100*2 + 50*1 = 250
  assert.equal(total.valido, true);
  assert.equal(total.total, 250);
  assert.deepEqual(total.renglonesInvalidos, []);

  const conFaltante = req.preventivoContratacion([
    { codigo: 'x', cantidad: 1 },
    {
      codigo: 'y', cantidad: 1,
      valoresReferencia: [{ presupuestoId: 'p', base: 'unitario', valor: 10 }]
    }
  ]);
  assert.equal(conFaltante.valido, false);
  assert.deepEqual(conFaltante.renglonesInvalidos, [1]);
});

test('totalEnLetras: la fórmula oficial con ceros, unidades, decenas compuestas y centavos', () => {
  assert.equal(req.totalEnLetras(0), 'LA SUMA DE: PESOS CERO CON 00/100.-');
  assert.equal(req.totalEnLetras(21), 'LA SUMA DE: PESOS VEINTIUNO CON 00/100.-');
  assert.equal(req.totalEnLetras(100), 'LA SUMA DE: PESOS CIEN CON 00/100.-');
  assert.equal(req.totalEnLetras(1234.56),
    'LA SUMA DE: PESOS MIL DOSCIENTOS TREINTA Y CUATRO CON 56/100.-');
  assert.equal(req.totalEnLetras(999999.99),
    'LA SUMA DE: PESOS NOVECIENTOS NOVENTA Y NUEVE MIL NOVECIENTOS NOVENTA Y NUEVE CON 99/100.-');
  assert.equal(req.totalEnLetras(-5), 'LA SUMA DE: PESOS CERO CON 00/100.-');
  assert.equal(req.totalEnLetras(2.999), 'LA SUMA DE: PESOS TRES CON 00/100.-',
    'el redondeo de centavos 100 pasa al entero');
});

test('ocaActiva se enciende por modalidad, por el campo oca o por cantidadMaxima', () => {
  assert.equal(req.ocaActiva({ oca: true }, []), true);
  assert.equal(req.ocaActiva({ oca: false }, [{ cantidadMaxima: 5 }]), false,
    'el campo oca explícito manda');
  assert.equal(req.ocaActiva({ modalidadCompra: 'Orden de compra abierta' }, []), true);
  assert.equal(req.ocaActiva({ modalidadCompra: 'Compra directa' }, []), false);
  assert.equal(req.ocaActiva({}, [{ cantidadMaxima: 100 }]), true);
  assert.equal(req.ocaActiva({}, [{ cantidadMinima: 1 }]), false,
    'sólo cantidadMinima no activa la OCA');
  assert.equal(req.ocaActiva({}, []), false);
});

test('validarRequerimiento agrega los errores de todos los renglones con su número', () => {
  const expediente = {
    renglones: [
      {
        codigo: 'x', cantidad: 0,
        valoresReferencia: [{ presupuestoId: 'p', base: 'total', valor: 10 }]
      },
      { codigo: 'y', cantidad: 1, cantidadMaxima: -1 }
    ]
  };
  const resultado = req.validarRequerimiento(expediente);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.errores.some((e) => /Renglón 1: .*la cantidad debe ser un número positivo/.test(e)));
  assert.ok(resultado.errores.some((e) => /Renglón 2: .*máxima debe ser un número positivo/.test(e)));

  const limpio = req.validarRequerimiento({ renglones: [] });
  assert.equal(limpio.valido, true);
  assert.deepEqual(limpio.errores, []);
});

test('requerimientoDe normaliza el acceso al expediente con o sin envoltorio .datos', () => {
  const plano = {
    requerimiento: { lugar: 'FAA' },
    imputacion: [{ Ejerc: '2026' }],
    presupuestos: [{ id: 'presupuesto-1' }],
    renglones: [{ codigo: 'x' }]
  };
  const conDatos = { datos: plano };
  for (const expediente of [plano, conDatos]) {
    const info = req.requerimientoDe(expediente);
    assert.equal(info.requerimiento.lugar, 'FAA');
    assert.equal(info.imputacion[0].Ejerc, '2026');
    assert.equal(info.presupuestos[0].id, 'presupuesto-1');
    assert.equal(info.renglones[0].codigo, 'x');
  }
  const vacio = req.requerimientoDe(null);
  assert.deepEqual(vacio.requerimiento, {});
  assert.deepEqual(vacio.imputacion, []);
  assert.deepEqual(vacio.presupuestos, []);
  assert.deepEqual(vacio.renglones, []);
});