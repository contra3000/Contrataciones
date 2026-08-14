'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '..', 'app', 'js', 'core', 'namespaces.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'config.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'auditoria.js'));

const auditoria = globalThis.SGC.core.auditoria;

function datosBase(accion, de, a, extra) {
  return Object.assign({
    timestamp: '2026-08-13T14:05:00.000Z',
    email: 'carlos.ramirez@faa.mil.ar',
    rol: 'contrataciones',
    equipo: 'PC-CONTRAT-03',
    accion: accion,
    de: de,
    a: a,
    motivo: null,
    observacion: null
  }, extra || {});
}

test('1. hash es determinista y devuelve hexadecimal', () => {
  const a = auditoria.hash('mismo texto');
  const b = auditoria.hash('mismo texto');
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]+$/);
  assert.notEqual(auditoria.hash('mismo texto'), auditoria.hash('otro texto'));
});

test('2. crearEntrada copia los campos y deja hashPrevio null en la primera', () => {
  const entrada = auditoria.crearEntrada(null, datosBase('avanzar', 'A', 'B'));
  assert.equal(entrada.hashPrevio, null);
  assert.equal(entrada.timestamp, '2026-08-13T14:05:00.000Z');
  assert.equal(entrada.email, 'carlos.ramirez@faa.mil.ar');
  assert.equal(entrada.rol, 'contrataciones');
  assert.equal(entrada.equipo, 'PC-CONTRAT-03');
  assert.equal(entrada.accion, 'avanzar');
  assert.equal(entrada.de, 'A');
  assert.equal(entrada.a, 'B');
});

test('3. la segunda entrada enlaza con el hash de la primera', () => {
  const primera = auditoria.crearEntrada(null, datosBase('avanzar', 'A', 'B'));
  const segunda = auditoria.crearEntrada(primera, datosBase('avanzar', 'B', 'C'));
  assert.equal(typeof segunda.hashPrevio, 'string');
  assert.ok(segunda.hashPrevio.length > 0);
  assert.deepEqual(auditoria.verificarCadena([primera, segunda]), { integra: true, rotaEn: null });
});

test('4. una cadena bien formada da integra true; la vacía también', () => {
  const entradas = [];
  let previa = null;
  for (let i = 0; i < 5; i++) {
    const entrada = auditoria.crearEntrada(previa, datosBase('avanzar', 'E' + i, 'E' + (i + 1)));
    entradas.push(entrada);
    previa = entrada;
  }
  assert.deepEqual(auditoria.verificarCadena(entradas), { integra: true, rotaEn: null });
  assert.deepEqual(auditoria.verificarCadena([]), { integra: true, rotaEn: null });
});

test('5. alterar una entrada intermedia rompe la cadena en la siguiente', () => {
  const entradas = [];
  let previa = null;
  for (let i = 0; i < 4; i++) {
    const entrada = auditoria.crearEntrada(previa, datosBase('avanzar', 'E' + i, 'E' + (i + 1)));
    entradas.push(entrada);
    previa = entrada;
  }
  entradas[1].accion = 'avanzar-modificado';
  const r = auditoria.verificarCadena(entradas);
  assert.equal(r.integra, false);
  assert.equal(r.rotaEn, 2, 'la primera entrada cuya cadena no cierra es la que sigue a la alterada');
});

test('6. una primera entrada con hashPrevio no nulo rompe en el índice 0', () => {
  const entradas = [];
  let previa = null;
  for (let i = 0; i < 3; i++) {
    entradas.push(auditoria.crearEntrada(previa, datosBase('avanzar', 'E' + i, 'E' + (i + 1))));
    previa = entradas[i];
  }
  entradas[0].hashPrevio = '00000000';
  assert.deepEqual(auditoria.verificarCadena(entradas), { integra: false, rotaEn: 0 });
});

test('7. un auditLog que no es arreglo se reporta como roto', () => {
  assert.deepEqual(auditoria.verificarCadena(null), { integra: false, rotaEn: 0 });
  assert.deepEqual(auditoria.verificarCadena('cadena'), { integra: false, rotaEn: 0 });
});
