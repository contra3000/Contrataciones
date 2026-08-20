'use strict';

/*
 * recorrido.test.js
 * ORDEN-RONDA-06 §3.5 punto 8. Corre el recorrido completo de
 * tools/recorrido-completo.js contra el servidor real (arrancado en un
 * directorio temporal): expediente de Especificaciones Técnicas hasta
 * Perfeccionada, una devolución por observación con su reavance, cambio de
 * operador por fase y cadena de auditoría íntegra.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const { crearDirDatos, arrancarServidor, detenerServidor, pedir } =
  require('./helpers/servidor-util.js');

const { recorrer } = require(path.join(RAIZ, 'tools', 'recorrido-completo.js'));

const SGC = globalThis.SGC;

let datosDir = null;
let ctx = null;

before(async () => {
  datosDir = crearDirDatos('sgc-recorrido-');
  ctx = await arrancarServidor(datosDir);
});

after(async () => {
  await detenerServidor(ctx);
  if (datosDir) {
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

test('el recorrido completo llega a Perfeccionada con devolución, reavance y cadena íntegra', async () => {
  const base = 'http://127.0.0.1:' + ctx.puerto;
  const resultado = await recorrer(base);

  assert.equal(resultado.pasos[0][0], 'crearExpediente');
  assert.equal(resultado.pasos[0][1], 'ESPECIFICACIONES_TECNICAS');

  const devoluciones = resultado.pasos.filter((p) => p[0] === 'devolver');
  assert.equal(devoluciones.length, 1, 'exactamente una devolución en el recorrido');
  assert.equal(devoluciones[0][1], 'ANALISIS_SCo',
    'AUTORIZACION_SCo devuelve a ANÁLISIS_SCo, su destino de devolución');

  const ultimo = resultado.pasos[resultado.pasos.length - 1];
  assert.equal(ultimo[0], 'avanzar');
  assert.equal(ultimo[1], 'PERFECCIONADA', 'el recorrido termina en el estado final');

  const esperados = 1 + resultado.pasos.filter((p) => p[0] === 'avanzar').length + 1 + 1;
  assert.equal(resultado.expediente.auditoria.length, esperados,
    'creación + avances + devolución + archivo quedan en la auditoría');

  assert.deepEqual(resultado.verificacion, { integra: true, rotaEn: null },
    'la cadena de auditoría queda íntegra (ADR-006)');

  const ultima = resultado.expediente.auditoria[resultado.expediente.auditoria.length - 1];
  assert.equal(ultima.accion, 'archivar',
    'al llegar a Perfeccionada el servidor archiva y encadena la entrada');

  const leido = await pedir(base, 'GET', '/api/expedientes/' + resultado.id);
  assert.equal(leido.status, 200);
  assert.equal(leido.body.expediente.estado.id, 'PERFECCIONADA',
    'el servidor persiste el estado final');
  assert.equal(leido.body.expediente.estado.fase, 10);
  assert.equal(leido.body.expediente.archivado, true,
    'el original queda marcado como archivado (no se borra)');
  assert.ok(leido.body.expediente.archivadoEn, 'se registra cuándo se archivó');

  // ORDEN-RONDA-08 §2.2: al archivar, el expediente sale del índice activo y
  // pasa al Archivo Histórico, que se lee del directorio (GET /api/archivo).
  const indice = await pedir(base, 'GET', '/api/indice');
  const entrada = indice.body.find((e) => e.id === resultado.id);
  assert.equal(entrada, undefined, 'el expediente archivado ya no figura en el índice activo');

  const archivo = await pedir(base, 'GET', '/api/archivo');
  const arch = archivo.body.expedientes.find((e) => e.id === resultado.id);
  assert.ok(arch, 'el expediente figura en el archivo histórico');
  assert.equal(arch.estado, 'PERFECCIONADA');
  assert.equal(arch.fase, 10);
  assert.ok(arch.archivadoEn, 'la entrada del histórico lleva cuándo se archivó');
});

test('cada avance del plan usa el rol ejecutor del estado que se abandona', () => {
  const plan = require(path.join(RAIZ, 'tools', 'recorrido-completo.js')).planDePasos();
  const estados = SGC.core.config.ESTADOS;
  const porId = {};
  for (const estado of estados) {
    porId[estado.id] = estado;
  }
  for (const paso of plan) {
    assert.equal(paso.rol, porId[paso.desde].rolEjecutor,
      paso.desde + ' lo opera ' + porId[paso.desde].rolEjecutor);
  }
  const devoluciones = plan.filter((p) => p.accion === 'devolver');
  assert.equal(devoluciones.length, 1);
});
