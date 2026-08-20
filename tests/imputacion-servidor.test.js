'use strict';

/*
 * imputacion-servidor.test.js
 * ORDEN-RONDA-09 §3.1 (ADR-022 §4): la imputación presupuestaria la completa
 * Contaduría en la Afectación (paso 16). La restricción vive en el servidor,
 * en el PUT: quien la trae debe pasar la matriz de autorización (ADR-021), ser
 * el rol "contaduria" y estar en el estado "AFECTACION"; si la petición no la
 * trae (un generador que edita otros campos tras una devolución), se conserva
 * la de disco.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'config.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'auditoria.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'migraciones.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'validacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'estados.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));

const {
  contexto,
  crearEnEstado,
  arrancarEntorno,
  limpiarEntorno,
  docEnDisco,
  pedir
} = require('./helpers/transiciones-servidor-util.js');

const FILA_IMPUTACION = {
  Ejerc: '2026', R: '1', S: '2', C: '3', Ft: '4', PG: '5', Sp: '6',
  Py: '7', Ac: '8', Ob: '9', UG: '10', I: '11', Pppal: '12',
  Ppcial: '13', Spa: '14', M: '15'
};

const ENTORNO = {};

before(async () => {
  Object.assign(ENTORNO, await arrancarEntorno());
});

after(async () => {
  await limpiarEntorno(ENTORNO);
});

async function leerExpediente(id) {
  const r = await pedir(ENTORNO.base, 'GET', '/api/expedientes/' + id);
  assert.equal(r.status, 200, 'se lee el expediente');
  return r.body.expediente;
}

async function ponerImputacion(id, expediente, imputacion, rol) {
  const copia = JSON.parse(JSON.stringify(expediente));
  copia.imputacion = imputacion;
  return pedir(ENTORNO.base, 'PUT', '/api/expedientes/' + id, {
    expediente: copia,
    versionEsperada: expediente.version,
    contexto: contexto(rol)
  });
}

test('contaduria en AFECTACION escribe la imputación y el servidor la persiste', { timeout: 300000 }, async () => {
  const { id } = await crearEnEstado(ENTORNO.base, ENTORNO.datosDir, 'AFECTACION', assert);
  const expediente = await leerExpediente(id);

  const r = await ponerImputacion(id, expediente, [FILA_IMPUTACION], 'contaduria');
  assert.equal(r.status, 200, 'el PUT autorizado pasa');
  assert.equal(r.body.version, expediente.version + 1, 'la versión sube');

  const enDisco = docEnDisco(ENTORNO.datosDir, id);
  assert.equal(enDisco.version, expediente.version + 1);
  assert.equal(enDisco.imputacion.length, 1, 'la imputación queda persistida');
  assert.deepEqual(enDisco.imputacion[0], FILA_IMPUTACION, 'se guarda la fila completa');
  assert.equal(enDisco.auditoria.length, expediente.auditoria.length,
    'la auditoría no se pisa');
});

test('la imputación rechaza a un rol que no es contaduria con 403 y no escribe', { timeout: 300000 }, async () => {
  const { id } = await crearEnEstado(ENTORNO.base, ENTORNO.datosDir, 'AFECTACION', assert);
  const expediente = await leerExpediente(id);

  const r = await ponerImputacion(id, expediente, [FILA_IMPUTACION], 'generador');
  assert.equal(r.status, 403, 'el generador no puede imputar');
  assert.match(r.body.error, /contaduria/);

  const enDisco = docEnDisco(ENTORNO.datosDir, id);
  assert.equal((enDisco.imputacion || []).length, 0, 'el disco no cambió');
  assert.equal(enDisco.version, expediente.version, 'la versión no cambió');
});

test('la imputación rechaza fuera del estado AFECTACION con 403', { timeout: 300000 }, async () => {
  const { id } = await crearEnEstado(ENTORNO.base, ENTORNO.datosDir, 'SOLICITUD_CONTRATACION', assert);
  const expediente = await leerExpediente(id);

  const r = await ponerImputacion(id, expediente, [FILA_IMPUTACION], 'contaduria');
  assert.equal(r.status, 403, 'en otro estado no se imputa');
  assert.match(r.body.error, /AFECTACION/);

  const enDisco = docEnDisco(ENTORNO.datosDir, id);
  assert.equal((enDisco.imputacion || []).length, 0, 'el disco no cambió');
});

test('editar otros campos sin tocar la imputación no exige contaduria', { timeout: 300000 }, async () => {
  const { id } = await crearEnEstado(ENTORNO.base, ENTORNO.datosDir, 'AFECTACION', assert);
  const expediente = await leerExpediente(id);

  // Contaduría carga la imputación primero.
  const cargar = await ponerImputacion(id, expediente, [FILA_IMPUTACION], 'contaduria');
  assert.equal(cargar.status, 200);

  // Un generador edita el título y envía la misma imputación que ya está en
  // disco: el PUT no cambia la imputación, así que no se exige el rol.
  const conTitulo = JSON.parse(JSON.stringify(expediente));
  conTitulo.titulo = 'Título editado por el generador';
  conTitulo.imputacion = [FILA_IMPUTACION];
  const r = await pedir(ENTORNO.base, 'PUT', '/api/expedientes/' + id, {
    expediente: conTitulo,
    versionEsperada: expediente.version + 1,
    contexto: contexto('generador')
  });
  assert.equal(r.status, 200, 'el generador edita el resto del expediente');
  const enDisco = docEnDisco(ENTORNO.datosDir, id);
  assert.equal(enDisco.titulo, 'Título editado por el generador');
  assert.equal(enDisco.imputacion.length, 1, 'la imputación se conserva');
});

test('una petición que trae la imputación vacía conserva la de disco (no la borra)', { timeout: 300000 }, async () => {
  const { id } = await crearEnEstado(ENTORNO.base, ENTORNO.datosDir, 'AFECTACION', assert);
  const expediente = await leerExpediente(id);

  const cargar = await ponerImputacion(id, expediente, [FILA_IMPUTACION], 'contaduria');
  assert.equal(cargar.status, 200);

  // Un generador guarda cambios en otros campos sin la imputación (vino vacía
  // en su copia de trabajo): el servidor no borra la de disco.
  const sinImputacion = JSON.parse(JSON.stringify(expediente));
  delete sinImputacion.imputacion;
  const r = await pedir(ENTORNO.base, 'PUT', '/api/expedientes/' + id, {
    expediente: sinImputacion,
    versionEsperada: expediente.version + 1,
    contexto: contexto('generador')
  });
  assert.equal(r.status, 200, 'el generador edita sin pisar la imputación');
  const enDisco = docEnDisco(ENTORNO.datosDir, id);
  assert.equal(enDisco.imputacion.length, 1, 'la imputación sigue en disco');
});