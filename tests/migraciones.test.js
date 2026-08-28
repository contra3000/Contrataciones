'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

require(path.join(__dirname, '..', 'app', 'js', 'core', 'namespaces.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'config.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'roles.js'));
require(path.join(__dirname, '..', 'app', 'js', 'core', 'migraciones.js'));

const migraciones = globalThis.SGC.core.migraciones;
const config = globalThis.SGC.core.config;

function leerV1() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'esquemas', 'datos.v1.ejemplo.json'), 'utf8'));
}

function leerV2() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'esquemas', 'datos.ejemplo.json'), 'utf8'));
}

test('1. VERSION_ACTUAL es un número', () => {
  assert.equal(typeof migraciones.VERSION_ACTUAL, 'number');
});

test('2. migrar un documento v1 conserva todos los campos originales', () => {
  const v1 = leerV1();
  const { documento, aplicadas } = migraciones.migrar(v1);
  assert.ok(aplicadas.length > 0);
  for (const clave of Object.keys(v1)) {
    if (clave === 'schemaVersion') {
      continue;
    }
    assert.deepEqual(documento[clave], v1[clave], 'el campo "' + clave + '" debe conservarse');
  }
});

test('3. migrar un documento v1 agrega los campos del esquema v2', () => {
  const v1 = leerV1();
  const { documento, aplicadas } = migraciones.migrar(v1);

  assert.equal(documento.schemaVersion, migraciones.VERSION_ACTUAL);
  assert.equal(documento.id, v1.expedienteId);
  assert.equal(documento.estado.id, v1.estadoActual);
  assert.equal(documento.estado.fase, config.ESTADOS.find((e) => e.id === v1.estadoActual).fase);
  assert.equal(documento.estado.desde, v1.ultimaModificacion);
  assert.equal(documento.actualizado, v1.ultimaModificacion);
  assert.equal(documento.catalogoVersion, null);
  assert.deepEqual(documento.solicitante, {});
  assert.equal(documento.fechaLimite, v1.sla.fechaLimite);
  assert.equal(documento.auditoria.length, v1.auditLog.length);
  assert.deepEqual(documento.auditoria, v1.auditLog);
  assert.ok(Array.isArray(documento.renglones));
  assert.equal(documento.renglones.length, v1.incisos.length);
  for (let i = 0; i < v1.incisos.length; i++) {
    assert.equal(documento.renglones[i].codigo, v1.incisos[i].codigo);
    assert.equal(documento.renglones[i].cantidad, v1.incisos[i].cantidad);
    assert.equal(documento.renglones[i].unidad, v1.incisos[i].unidad);
    assert.equal(documento.renglones[i].aclaracion, '', 'la aclaración se agrega con valor por defecto');
  }
  assert.ok(aplicadas.some((a) => a.indexOf('schemaVersion 1 a ' + migraciones.VERSION_ACTUAL) !== -1));
});

test('4. migrar un documento ya en v2 no lo toca', () => {
  const v2 = leerV2();
  const { documento, aplicadas } = migraciones.migrar(v2);
  assert.deepEqual(documento, v2);
  assert.deepEqual(aplicadas, []);
});

test('5. migrar no muta el documento de entrada', () => {
  const v1 = leerV1();
  const copia = JSON.parse(JSON.stringify(v1));
  migraciones.migrar(v1);
  assert.deepEqual(v1, copia);
});

test('6. migrar con entrada nula no falla', () => {
  const { documento, aplicadas } = migraciones.migrar(null);
  assert.equal(documento, null);
  assert.deepEqual(aplicadas, []);
});
