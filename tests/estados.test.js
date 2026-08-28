'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '..', 'app', 'js', 'core', 'namespaces.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'config.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'roles.js'));

const config = globalThis.SGC.core.config;
const ESTADOS = config.ESTADOS;

function estadoPorId(id) {
  return ESTADOS.find((e) => e.id === id);
}

test('8. alcanzabilidad: desde ESTADO_INICIAL se llega a ESTADO_FINAL siguiendo estadosSiguientes', () => {
  const visitados = new Set();
  const pila = [config.ESTADO_INICIAL];
  while (pila.length > 0) {
    const actual = pila.pop();
    if (visitados.has(actual)) {
      continue;
    }
    visitados.add(actual);
    const estado = estadoPorId(actual);
    assert.ok(estado, 'estado inicial alcanzable inexistente: ' + actual);
    for (const siguiente of estado.estadosSiguientes) {
      pila.push(siguiente);
    }
  }
  assert.ok(visitados.has(config.ESTADO_FINAL),
    'no se alcanza ESTADO_FINAL desde ESTADO_INICIAL');
});

test('9. sin estados huérfanos: todo estado distinto del inicial es citado por al menos otro estado', () => {
  const citados = new Set();
  for (const estado of ESTADOS) {
    for (const s of estado.estadosSiguientes) {
      citados.add(s);
    }
    for (const d of estado.estadosDevolucion) {
      citados.add(d);
    }
  }
  for (const estado of ESTADOS) {
    if (estado.id === config.ESTADO_INICIAL) {
      continue;
    }
    assert.ok(citados.has(estado.id),
      'estado huérfano (no citado por ningún otro): ' + estado.id);
  }
});
