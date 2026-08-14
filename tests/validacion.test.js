'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '..', 'app', 'js', 'core', 'namespaces.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'config.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'utils.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'validacion.js'));

const config = globalThis.SGC.core.config;
const validacion = globalThis.SGC.core.validacion;

function expedienteEn(idEstado) {
  return {
    id: '2026-001',
    estado: { id: idEstado, fase: 1, desde: '2026-08-01T10:15:00.000Z' },
    version: 1,
    actualizado: '2026-08-01T10:15:00.000Z',
    campos: {},
    entregables: [],
    auditoria: []
  };
}

test('1. con arreglos de requisitos vacíos todo es válido', () => {
  for (const estado of config.ESTADOS) {
    const r = validacion.validarParaAvanzar(expedienteEn(estado.id));
    assert.deepEqual(r, { valido: true, faltantes: { campos: [], entregables: [] } },
      'en ' + estado.id);
  }
});

test('2. con arreglos poblados exige los campos y entregables del estado', () => {
  const original = config.ESTADOS[0];
  config.ESTADOS[0] = Object.assign({}, original, {
    camposRequeridos: ['objetoGasto', 'unidadSolicitante'],
    entregablesObligatorios: ['PLIEGO', 'SOLICITUD_FIRMADA']
  });
  try {
    const completo = expedienteEn(original.id);
    completo.campos = { objetoGasto: 'Papel A4', unidadSolicitante: 'Administración' };
    completo.entregables = ['PLIEGO', 'SOLICITUD_FIRMADA'];
    assert.deepEqual(validacion.validarParaAvanzar(completo),
      { valido: true, faltantes: { campos: [], entregables: [] } });

    const incompleto = expedienteEn(original.id);
    incompleto.campos = { objetoGasto: 'Papel A4' };
    incompleto.entregables = ['PLIEGO'];
    const r = validacion.validarParaAvanzar(incompleto);
    assert.equal(r.valido, false);
    assert.deepEqual(r.faltantes.campos, ['unidadSolicitante']);
    assert.deepEqual(r.faltantes.entregables, ['SOLICITUD_FIRMADA']);
  } finally {
    config.ESTADOS[0] = original;
  }
});

test('3. un expediente sin estado actual no es válido', () => {
  const r = validacion.validarParaAvanzar({ id: '2026-001', campos: {}, entregables: [] });
  assert.equal(r.valido, false);
  assert.deepEqual(r.faltantes, { campos: [], entregables: [] });
});

test('4. validarRenglon acepta un renglón bien formado', () => {
  const r = validacion.validarRenglon({ codigo: '102030', cantidad: 10, unidad: 'UN', aclaracion: '' });
  assert.deepEqual(r, { valido: true, errores: [] });
  const sinAclaracion = validacion.validarRenglon({ codigo: '102030', cantidad: 10, unidad: 'UN' });
  assert.deepEqual(sinAclaracion, { valido: true, errores: [] });
});

test('5. validarRenglon rechaza código faltante', () => {
  const r = validacion.validarRenglon({ cantidad: 10, unidad: 'UN' });
  assert.equal(r.valido, false);
  assert.ok(r.errores.some((e) => e.indexOf('código') !== -1));
});

test('6. validarRenglon rechaza cantidad no positiva', () => {
  for (const cantidad of [0, -3, '10', null, NaN]) {
    const r = validacion.validarRenglon({ codigo: '102030', cantidad: cantidad, unidad: 'UN' });
    assert.equal(r.valido, false, 'cantidad: ' + cantidad);
    assert.ok(r.errores.some((e) => e.indexOf('número positivo') !== -1));
  }
});

test('7. validarRenglon rechaza unidad faltante', () => {
  const r = validacion.validarRenglon({ codigo: '102030', cantidad: 10, unidad: '' });
  assert.equal(r.valido, false);
  assert.ok(r.errores.some((e) => e.indexOf('unidad') !== -1));
});

test('8. validarRenglon limita la aclaración a 200 caracteres', () => {
  const ok = validacion.validarRenglon({ codigo: '102030', cantidad: 1, unidad: 'UN', aclaracion: 'x'.repeat(200) });
  assert.equal(ok.valido, true);
  const mal = validacion.validarRenglon({ codigo: '102030', cantidad: 1, unidad: 'UN', aclaracion: 'x'.repeat(201) });
  assert.equal(mal.valido, false);
  assert.ok(mal.errores.some((e) => e.indexOf('200') !== -1));
});

test('9. validarRenglon rechaza un renglón nulo', () => {
  const r = validacion.validarRenglon(null);
  assert.equal(r.valido, false);
  assert.ok(r.errores.length > 0);
});
