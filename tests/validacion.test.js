'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '..', 'app', 'js', 'core', 'namespaces.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'config.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'cotas-encabezado.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'utils.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'requerimiento.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'anexo-eett.js'));
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

test('1. sin requisitos todo es válido; con entregablesObligatorios los exige (ORDEN-RONDA-08 §2.1)', () => {
  for (const estado of config.ESTADOS) {
    const r = validacion.validarParaAvanzar(expedienteEn(estado.id));
    const obligatorios = estado.entregablesObligatorios || [];
    if (obligatorios.length === 0) {
      assert.deepEqual(r, { valido: true, faltantes: { campos: [], entregables: [] } },
        'en ' + estado.id);
    } else {
      assert.equal(r.valido, false, 'en ' + estado.id + ' sin su documento no se avanza');
      assert.deepEqual(r.faltantes.entregables, obligatorios, 'en ' + estado.id);
    }
  }
});

test('1b. los cinco estados que producen documento exigen su entregable y lo aceptan guardado como objeto', () => {
  for (const estado of config.ESTADOS) {
    const obligatorios = estado.entregablesObligatorios || [];
    if (obligatorios.length === 0) {
      continue;
    }
    for (const idEntregable of obligatorios) {
      const conObjeto = expedienteEn(estado.id);
      conObjeto.entregables = [{ id: idEntregable, nombre: 'documento.html', ruta: 'entregables/documento.html' }];
      const r = validacion.validarParaAvanzar(conObjeto);
      assert.deepEqual(r, { valido: true, faltantes: { campos: [], entregables: [] } },
        'en ' + estado.id + ' el entregable ' + idEntregable + ' cierra la exigencia');
    }
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

test('8. la aclaración que desborda se acepta (va al anexo); el tope duro es 2000', () => {
  // ORDEN-RONDA-10 §2.1: superar los 256 no es error de forma; ese texto
  // desborda al anexo de EETT (core/anexo-eett.js). El rechazo empieza en
  // MAX_ACLARACION_TOTAL (config.js, hoy 2000).
  const impresa = validacion.validarRenglon({ codigo: '102030', cantidad: 1, unidad: 'UN', aclaracion: 'x'.repeat(256) });
  assert.equal(impresa.valido, true);
  const desbordada = validacion.validarRenglon({ codigo: '102030', cantidad: 1, unidad: 'UN', aclaracion: 'x'.repeat(257) });
  assert.equal(desbordada.valido, true, 'lo que supera los 256 va al anexo, no se rechaza');
  const alTope = validacion.validarRenglon({ codigo: '102030', cantidad: 1, unidad: 'UN', aclaracion: 'x'.repeat(2000) });
  assert.equal(alTope.valido, true);
  const mal = validacion.validarRenglon({ codigo: '102030', cantidad: 1, unidad: 'UN', aclaracion: 'x'.repeat(2001) });
  assert.equal(mal.valido, false);
  assert.ok(mal.errores.some((e) => e.indexOf('2000') !== -1));
});

test('9. validarRenglon rechaza un renglón nulo', () => {
  const r = validacion.validarRenglon(null);
  assert.equal(r.valido, false);
  assert.ok(r.errores.length > 0);
});

test('10. el conteo de la aclaración es en puntos de código, igual en todo el sistema', () => {
  // ORDEN-RONDA-10-CIERRE §2: un solo criterio (utils.contarCaracteres) para
  // el validador, el contador visible y la regla de desborde. '🛩'.length es 2
  // en unidades UTF-16 pero el usuario ve un carácter: cuenta 1.
  const emoji = '\u{1F6E9}';
  assert.equal(emoji.length, 2, 'sanity UTF-16');
  const conEmojisAlTope = validacion.validarRenglon({
    codigo: '102030', cantidad: 1, unidad: 'UN', aclaracion: emoji.repeat(2000)
  });
  assert.equal(conEmojisAlTope.valido, true,
    '2000 puntos de código entran aunque .length sea 4000');
  const unMas = validacion.validarRenglon({
    codigo: '102030', cantidad: 1, unidad: 'UN', aclaracion: emoji.repeat(2001)
  });
  assert.equal(unMas.valido, false,
    '2001 puntos de código no entran aunque .length sea 4002');
});
