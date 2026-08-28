'use strict';

/*
 * repo.memoria.test.js
 * Corrida de la batería única del contrato contra la implementación en
 * memoria (ORDEN-RONDA-03 §3.5.1 y §3.2).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');

require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'config.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'roles.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'cotas-encabezado.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'autorizacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'auditoria.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'migraciones.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'anexo-eett.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'validacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'estados.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.memoria.js'));

const { correrBateria } = require('./helpers/repo-bateria.js');
const { correrTransiciones } = require('./helpers/repo-transiciones-bateria.js');

function crearContextoMemoria() {
  const repo = globalThis.SGC.adapters.repoMemoria.crear();
  return { repo, limpiar: async () => {} };
}

correrBateria('repo.memoria', crearContextoMemoria, true);
correrTransiciones('repo.memoria', crearContextoMemoria);

test('repo.memoria: cada instancia tiene estado propio', async () => {
  const a = globalThis.SGC.adapters.repoMemoria.crear();
  const b = globalThis.SGC.adapters.repoMemoria.crear();
  const creado = await a.crearExpediente(
    { titulo: 'X', anio: '2026' },
    { timestamp: '2026-08-14T10:00:00.000Z' }
  );
  const indiceB = await b.listarIndice();
  assert.deepEqual(indiceB, []);
  const leido = await a.leerExpediente(creado.id);
  assert.equal(leido.version, 1);
});

test('repo.memoria: guardarExpediente conserva el contexto recibido', async () => {
  const repo = globalThis.SGC.adapters.repoMemoria.crear();
  const creado = await repo.crearExpediente(
    { titulo: 'X', anio: '2026' },
    { timestamp: '2026-08-14T10:00:00.000Z', email: 'a@faa.mil.ar', rol: 'generador', equipo: 'PC-01' }
  );
  await repo.guardarExpediente(
    creado.id,
    Object.assign({}, creado.expediente, { marca: 'nuevo' }),
    1,
    { timestamp: '2026-08-14T11:00:00.000Z', email: 'b@faa.mil.ar', rol: 'abastecimiento', equipo: 'PC-02' }
  );
  const indice = await repo.listarIndice();
  assert.equal(indice[0].actualizado, '2026-08-14T11:00:00.000Z');
});