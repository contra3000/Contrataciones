'use strict';

/*
 * servidor-concurrencia.test.js
 * Los dos tests de concurrencia que definen la ronda 3 contra el proceso
 * real: 20 PUT simultáneos dan exactamente un 200 y 19×409, y 20 POST
 * simultáneos × 10 corridas dan 20 ids distintos sin huecos ni duplicados
 * (ADR-009). Separados de servidor.test.js por responsabilidad y por tiempo
 * de ejecución (ORDEN-RONDA-07 §2.2).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  crearDirDatos,
  arrancarServidor,
  detenerServidor,
  pedir
} = require('./helpers/servidor-util.js');

function contextoBase(extra) {
  return Object.assign({
    timestamp: '2026-08-14T10:00:00.000Z',
    email: 'operador@faa.mil.ar',
    rol: 'contrataciones',
    equipo: 'PC-PRUEBA-01'
  }, extra || {});
}

// ---------------------------------------------------------------------------
// Concurrencia: 20 PUT simultáneos
// ---------------------------------------------------------------------------
test('CONCURRENCIA PUT: 20 PUT simultáneos dan exactamente 1×200 y 19×409', { timeout: 60000 }, async () => {
  const datosDir = crearDirDatos('sgc-put-');
  const ctx = await arrancarServidor(datosDir);
  try {
    const base = 'http://127.0.0.1:' + ctx.puerto;
    const creado = await pedir(base, 'POST', '/api/expedientes', {
      datosIniciales: { titulo: 'Base', anio: '2026' },
      contexto: contextoBase()
    });
    const id = creado.body.id;

    const resultados = await Promise.all(
      Array.from({ length: 20 }, (_, i) => pedir(base, 'PUT', '/api/expedientes/' + id, {
        expediente: {
          expedienteId: id,
          titulo: 'Base',
          estadoActual: 'ESPECIFICACIONES_TECNICAS',
          marca: 'put-' + i
        },
        versionEsperada: 1,
        contexto: contextoBase()
      }))
    );

    const ok = resultados.filter((r) => r.status === 200);
    const conf = resultados.filter((r) => r.status === 409);
    assert.equal(ok.length, 1, 'exactamente un PUT gana');
    assert.equal(conf.length, 19, 'los otros 19 pierden por conflicto');

    const indiceGanador = resultados.findIndex((r) => r.status === 200);
    assert.notEqual(indiceGanador, -1);
    assert.deepEqual(ok[0].body, { version: 2 });

    const doc = JSON.parse(fs.readFileSync(
      path.join(datosDir, '2026', id.split('-')[1] + '_Expediente', 'datos.json'),
      'utf8'
    ));
    assert.equal(doc.marca, 'put-' + indiceGanador,
      'datos.json contiene exactamente el contenido del ganador');
    assert.equal(doc.version, 2);
  } finally {
    await detenerServidor(ctx);
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Concurrencia: 20 POST simultáneos × 10 corridas
// ---------------------------------------------------------------------------
test('CONCURRENCIA POST: 20 POST simultáneos dan 20 ids distintos, 10 corridas', { timeout: 180000 }, async () => {
  for (let corrida = 0; corrida < 10; corrida++) {
    const datosDir = crearDirDatos('sgc-post-');
    const ctx = await arrancarServidor(datosDir);
    try {
      const base = 'http://127.0.0.1:' + ctx.puerto;
      const respuestas = await Promise.all(
        Array.from({ length: 20 }, () => pedir(base, 'POST', '/api/expedientes', {
          datosIniciales: { titulo: 'Concurrente', anio: '2026' },
          contexto: contextoBase()
        }))
      );
      for (const r of respuestas) {
        assert.equal(r.status, 201, 'corrida ' + corrida + ': todos los POST deben responder 201');
      }
      const ids = respuestas.map((r) => r.body.id);
      const numeros = ids.map((i) => parseInt(i.split('-')[1], 10)).sort((a, b) => a - b);
      assert.equal(new Set(ids).size, 20, 'corrida ' + corrida + ': 20 ids distintos');
      assert.deepEqual(numeros,
        Array.from({ length: 20 }, (_, i) => i + 1),
        'corrida ' + corrida + ': sin huecos ni duplicados');
    } finally {
      await detenerServidor(ctx);
      fs.rmSync(datosDir, { recursive: true, force: true });
    }
  }
});