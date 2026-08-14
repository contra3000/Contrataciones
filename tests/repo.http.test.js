'use strict';

/*
 * repo.http.test.js
 * Corrida de la batería única del contrato contra repo.http apuntando al
 * servidor real (ORDEN-RONDA-03 §3.4 y §3.5.1). Cada test levanta un servidor
 * con un directorio de datos fresco en os.tmpdir().
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');

require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'config.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'auditoria.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'migraciones.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.http.js'));

const { correrBateria } = require('./helpers/repo-bateria.js');
const { crearDirDatos, arrancarServidor, detenerServidor } = require('./helpers/servidor-util.js');

async function crearContextoHttp() {
  const datosDir = crearDirDatos('sgc-repohttp-');
  const servidorCtx = await arrancarServidor(datosDir);
  const repo = globalThis.SGC.adapters.repoHttp.crear('http://127.0.0.1:' + servidorCtx.puerto);
  return {
    repo,
    servidorCtx,
    datosDir,
    limpiar: async () => {
      await detenerServidor(servidorCtx);
      fs.rmSync(datosDir, { recursive: true, force: true });
    }
  };
}

correrBateria('repo.http', crearContextoHttp, false);

test('repo.http: historico/archivar/guardarEntregable no expuestos por el servidor', async () => {
  const ctx = await crearContextoHttp();
  try {
    await assert.rejects(
      () => ctx.repo.listarArchivoHistorico({}),
      (e) => e.codigo === 'NO_EXPUESTO'
    );
    await assert.rejects(
      () => ctx.repo.archivar('2026-001', {}),
      (e) => e.codigo === 'NO_EXPUESTO'
    );
    await assert.rejects(
      () => ctx.repo.guardarEntregable('2026-001', 'a.txt', 'c', {}),
      (e) => e.codigo === 'NO_EXPUESTO'
    );
  } finally {
    await ctx.limpiar();
  }
});

test('repo.http: un servidor apagado produce error de red (RED)', async () => {
  const ctx = await crearContextoHttp();
  await detenerServidor(ctx.servidorCtx);
  await assert.rejects(
    () => ctx.repo.listarIndice(),
    (e) => e.codigo === 'RED'
  );
  await ctx.limpiar();
});