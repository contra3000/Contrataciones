'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '..', 'app', 'js', 'core', 'namespaces.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'config.js'));

const config = globalThis.SGC.core.config;
const ESTADOS = config.ESTADOS;
const ROLES = config.ROLES;
const MOTIVOS = config.MOTIVOS_DEVOLUCION;

const CLAVES_OBLIGATORIAS = [
  'id',
  'numero',
  'titulo',
  'fase',
  'rolEjecutor',
  'estadosSiguientes',
  'estadosDevolucion',
  'camposRequeridos',
  'entregablesObligatorios'
];

test('1. hay exactamente 18 estados', () => {
  assert.equal(ESTADOS.length, 18);
});

test('2. ids únicos y numeros 1..18 sin huecos ni repeticiones', () => {
  const ids = ESTADOS.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'los id deben ser únicos');

  const numeros = ESTADOS.map((e) => e.numero).sort((a, b) => a - b);
  for (let i = 0; i < 18; i++) {
    assert.equal(numeros[i], i + 1, 'los numero deben cubrir 1..18 sin huecos ni repeticiones');
  }
});

test('3. todo id citado en estadosSiguientes/estadosDevolucion existe en ESTADOS', () => {
  const ids = new Set(ESTADOS.map((e) => e.id));
  for (const estado of ESTADOS) {
    const citados = estado.estadosSiguientes.concat(estado.estadosDevolucion);
    for (const citado of citados) {
      assert.ok(ids.has(citado), 'id citado inexistente: ' + citado + ' (en ' + estado.id + ')');
    }
  }
});

test('4. todo rolEjecutor existe en ROLES', () => {
  const roles = new Set(ROLES.map((r) => r.id));
  for (const estado of ESTADOS) {
    assert.ok(roles.has(estado.rolEjecutor), 'rol inexistente: ' + estado.rolEjecutor);
  }
});

test('5. las fases cubren 1..10', () => {
  const fases = new Set(ESTADOS.map((e) => e.fase));
  for (let f = 1; f <= 10; f++) {
    assert.ok(fases.has(f), 'falta la fase ' + f);
  }
});

test('6. los 18 estados tienen todas las claves obligatorias', () => {
  for (const estado of ESTADOS) {
    for (const clave of CLAVES_OBLIGATORIAS) {
      assert.ok(Object.prototype.hasOwnProperty.call(estado, clave),
        estado.id + ' no tiene la clave obligatoria "' + clave + '"');
    }
  }
});

test('7. ESTADO_FINAL es terminal: no tiene estadosSiguientes', () => {
  const final = ESTADOS.find((e) => e.id === config.ESTADO_FINAL);
  assert.ok(final, 'ESTADO_FINAL debe existir');
  assert.deepEqual(final.estadosSiguientes, []);
});

test('10. todo motivo de devolución tiene id único', () => {
  const ids = MOTIVOS.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length, 'los id de motivos deben ser únicos');
  assert.ok(MOTIVOS.length >= 8, 'debe haber al menos 8 motivos de devolución');
  for (const motivo of MOTIVOS) {
    assert.equal(typeof motivo.id, 'string');
    assert.equal(typeof motivo.texto, 'string');
    assert.equal(typeof motivo.sector, 'string');
  }
});
