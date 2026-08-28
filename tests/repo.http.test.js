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
require(path.join(RAIZ, 'app', 'js', 'core', 'roles.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'auditoria.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'migraciones.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.http.js'));

const { correrBateria, contextoBase: contextoBateria } = require('./helpers/repo-bateria.js');
const { correrTransiciones } = require('./helpers/repo-transiciones-bateria.js');
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
correrTransiciones('repo.http', crearContextoHttp);

test('repo.http: archivar no expuesto y listarArchivoHistorico lee /api/archivo', async () => {
  const ctx = await crearContextoHttp();
  try {
    await assert.rejects(
      () => ctx.repo.archivar('2026-001', {}),
      (e) => e.codigo === 'NO_EXPUESTO'
    );
    // ORDEN-RONDA-08 §2.2: listarArchivoHistorico ahora habla con
    // GET /api/archivo (el directorio del histórico). En un servidor fresco,
    // sin expedientes archivados, devuelve la lista vacía.
    const archivo = await ctx.repo.listarArchivoHistorico();
    assert.deepEqual(archivo, []);
  } finally {
    await ctx.limpiar();
  }
});

test('repo.http: guardarEntregable guarda el contenido en la carpeta del expediente', async () => {
  const ctx = await crearContextoHttp();
  try {
    const creado = await ctx.repo.crearExpediente(
      { titulo: 'Con entregable', anio: '2026' },
      contextoBateria({ rol: 'generador' })
    );
    const r = await ctx.repo.guardarEntregable(
      creado.id, 'especificacion.html', '<html>contenido</html>',
      contextoBateria({ rol: 'generador' })
    );
    assert.equal(r.ruta, 'entregables/especificacion.html');
    const archivo = path.join(ctx.datosDir, creado.id.split('-')[0],
      creado.id.split('-')[1] + '_Expediente', 'entregables', 'especificacion.html');
    assert.equal(fs.readFileSync(archivo, 'utf8'), '<html>contenido</html>');
    const leido = await ctx.repo.leerExpediente(creado.id);
    assert.equal(leido.expediente.entregables.length, 1);
    assert.equal(leido.expediente.entregables[0].nombre, 'especificacion.html');
  } finally {
    await ctx.limpiar();
  }
});

test('repo.http: el GET del entregable enlaza el archivo guardado y rechaza recorridos de ruta', async () => {
  const ctx = await crearContextoHttp();
  try {
    const creado = await ctx.repo.crearExpediente(
      { titulo: 'Con enlace', anio: '2026' },
      contextoBateria({ rol: 'generador' })
    );
    await ctx.repo.guardarEntregable(
      creado.id, 'especificacion.html', '<html>guardado</html>',
      contextoBateria({ rol: 'generador' })
    );

    const base = 'http://127.0.0.1:' + ctx.servidorCtx.puerto + '/api/expedientes/' + creado.id;
    const ok = await fetch(base + '/entregables/especificacion.html');
    assert.equal(ok.status, 200, 'el archivo guardado se enlaza');
    assert.equal(await ok.text(), '<html>guardado</html>');

    const inexistente = await fetch(base + '/entregables/otro.html');
    assert.equal(inexistente.status, 404, 'un entregable que no existe da 404');

    const recorrido = await fetch(base + '/entregables/..%2F..%2Fsecreto.json');
    assert.ok(recorrido.status === 400 || recorrido.status === 404,
      'un nombre con recorrido de ruta se rechaza sin leer el disco');
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