'use strict';

/*
 * archivo.test.js
 * ORDEN-RONDA-08 §2.2: el Archivo Histórico.
 *
 *  - Al llegar a PERFECCIONADA, el servidor archiva: el original queda marcado
 *    (archivado, archivadoEn y entrada de auditoría "archivar"), desaparece
 *    del /api/indice y aparece en /api/archivo, y la copia del histórico queda
 *    en disco bajo ArchivoHistorico/<anio>/<numero>_Expediente/.
 *  - Un archivo interrumpido (staging abandonado, original sin marcar, índice
 *    huérfano) se cierra al arrancar con recuperarArchivados.
 *  - GET /api/archivo lee el directorio, no el índice: una entrada del índice
 *    sin carpeta en el histórico no figura en el archivo.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'config.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'roles.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'auditoria.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'migraciones.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'validacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'estados.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));

const { arrancarServidor, detenerServidor, pedir } = require('./helpers/servidor-util.js');
const { arrancarEntorno, crearEnEstado, limpiarEntorno } =
  require('./helpers/transiciones-servidor-util.js');

const SGC = globalThis.SGC;

const CONTEXTO = {
  timestamp: '2026-08-19T10:00:00.000Z',
  email: 'maria.gonzalez@faa.mil.ar',
  rol: 'generador',
  equipo: 'PC-PRUEBA-01'
};

function crearDirDatos(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// Expediente válido en PERFECCIONADA para fabricar un disco "cortado a mano".
function expedienteFinal(id) {
  const base = {
    titulo: 'Expediente finalizado',
    anio: '2026',
    identificacion: {
      numero: id.slice(5),
      anio: '2026',
      dependenciaSolicitante: 'División Usuario',
      finalidad: 'Reposición de insumos'
    },
    fechaCreacion: '2026-08-19',
    renglones: []
  };
  const exp = SGC.adapters.repo.construirExpediente(base, CONTEXTO, id);
  exp.estado = { id: 'PERFECCIONADA', fase: 10, desde: CONTEXTO.timestamp };
  return exp;
}

function escribirExpediente(datosDir, id, expediente) {
  const dir = path.join(datosDir, id.slice(0, 4), id.slice(5) + '_Expediente');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'datos.json'), JSON.stringify(expediente, null, 2));
  return dir;
}

// Fabrica un disco con un archivo interrumpido: copia histórica completa pero
// original sin marcar, un staging abandonado y un índice huérfano.
function discoInterrumpido() {
  const datosDir = crearDirDatos('sgc-archivo-cortado-');
  const id = '2026-001';
  const original = expedienteFinal(id);

  const dirOriginal = escribirExpediente(datosDir, id, original);
  const anio = path.join(datosDir, 'ArchivoHistorico', '2026');
  const dirHistorico = path.join(anio, '001_Expediente');
  fs.mkdirSync(dirHistorico, { recursive: true });
  fs.writeFileSync(path.join(dirHistorico, 'datos.json'), JSON.stringify(original, null, 2));
  fs.mkdirSync(path.join(anio, '.staging-002'), { recursive: true });
  fs.writeFileSync(path.join(anio, '.staging-002', 'datos.json'), '{"corto":true}');

  fs.mkdirSync(path.join(datosDir, 'idx'), { recursive: true });
  fs.writeFileSync(path.join(datosDir, 'idx', id + '.json'),
    JSON.stringify(original, null, 2));

  return { datosDir, id };
}

test('al llegar a PERFECCIONADA el servidor archiva y el histórico aparece en /api/archivo', async () => {
  const entorno = await arrancarEntorno();
  try {
    const { base, datosDir } = entorno;
    const creado = await crearEnEstado(base, datosDir, 'PERFECCIONADA', assert);
    const id = creado.id;

    const leido = await pedir(base, 'GET', '/api/expedientes/' + id);
    assert.equal(leido.status, 200, 'el original no se borra jamás');
    assert.equal(leido.body.expediente.archivado, true, 'el original queda marcado');
    assert.ok(typeof leido.body.expediente.archivadoEn === 'string' &&
      leido.body.expediente.archivadoEn.length > 0,
      'registra cuándo se archivó');
    const ultima = leido.body.expediente.auditoria[leido.body.expediente.auditoria.length - 1];
    assert.equal(ultima.accion, 'archivar', 'la entrada "archivar" encadena la auditoría');

    const indice = await pedir(base, 'GET', '/api/indice');
    assert.ok(!indice.body.some((e) => e.id === id),
      'el archivado desaparece del índice');

    const archivo = await pedir(base, 'GET', '/api/archivo');
    assert.equal(archivo.status, 200);
    const entrada = archivo.body.expedientes.find((e) => e.id === id);
    assert.ok(entrada, 'el archivado figura en /api/archivo');
    assert.equal(entrada.estado, 'PERFECCIONADA');

    const copia = path.join(datosDir, 'ArchivoHistorico', '2026', '001_Expediente', 'datos.json');
    assert.ok(fs.existsSync(copia), 'la copia del histórico queda en disco');
  } finally {
    await limpiarEntorno(entorno);
  }
});

test('un archivo interrumpido se cierra al arrancar con recuperarArchivados', async () => {
  const { datosDir, id } = discoInterrumpido();
  const ctx = await arrancarServidor(datosDir);
  const base = 'http://127.0.0.1:' + ctx.puerto;
  try {
    const leido = await pedir(base, 'GET', '/api/expedientes/' + id);
    assert.equal(leido.body.expediente.archivado, true,
      'el original sin marcar se marca en el arranque');

    assert.ok(!fs.existsSync(path.join(datosDir, 'idx', id + '.json')),
      'el índice huérfano se purga');
    assert.ok(!fs.existsSync(path.join(datosDir, 'ArchivoHistorico', '2026', '.staging-002')),
      'el staging abandonado se limpia');

    const archivo = await pedir(base, 'GET', '/api/archivo');
    assert.ok(archivo.body.expedientes.some((e) => e.id === id),
      'el histórico recuperado aparece en /api/archivo');

    fs.writeFileSync(path.join(datosDir, 'idx', '2026-999.json'),
      JSON.stringify({ id: '2026-999', titulo: 'Huérfana', estado: 'PERFECCIONADA' }, null, 2));
    const archivo2 = await pedir(base, 'GET', '/api/archivo');
    assert.ok(!archivo2.body.expedientes.some((e) => e.id === '2026-999'),
      '/api/archivo lee el directorio, no el índice');
    const indice = await pedir(base, 'GET', '/api/indice');
    assert.ok(indice.body.some((e) => e.id === '2026-999'),
      'el índice sí ve la entrada huérfana');
  } finally {
    await detenerServidor(ctx);
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});