'use strict';

/*
 * transiciones-servidor-matriz.test.js
 * ORDEN-RONDA-07 §2.1 (condición de entrada): matriz 18 × 7 por el servidor.
 * Un test por estado del circuito: el rol ejecutor avanza (o recibe 403 en el
 * terminal) y los otros seis roles reciben 403; el disco se verifica después
 * de cada intento. Andamiaje en helpers/transiciones-servidor-util.js.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const {
  config,
  ROLES,
  contexto,
  docEnDisco,
  estadoEnDisco,
  crearEnEstado,
  arrancarEntorno,
  limpiarEntorno,
  pedir
} = require('./helpers/transiciones-servidor-util.js');

let entorno = null;
let base = null;

before(async () => {
  entorno = await arrancarEntorno();
  base = 'http://127.0.0.1:' + entorno.ctx.puerto;
});

after(async () => {
  await limpiarEntorno(entorno);
});

for (const estadoDef of config.ESTADOS) {
  test('matriz por servidor: ' + estadoDef.id + ' — el rol correcto avanza y los otros seis reciben 403', async () => {
    const { id, version } = await crearEnEstado(base, entorno.datosDir, estadoDef.id, assert);
    const destino = (estadoDef.estadosSiguientes || [])[0] || 'PERFECCIONADA';

    for (const rol of ROLES) {
      if (rol === estadoDef.rolEjecutor) {
        continue;
      }
      const r = await pedir(base, 'POST', '/api/expedientes/' + id + '/avanzar', {
        versionEsperada: version,
        destino,
        contexto: contexto(rol)
      });
      assert.equal(r.status, 403,
        estadoDef.id + ' debe rechazar con 403 al rol ' + rol);
      assert.equal(estadoEnDisco(entorno.datosDir, id), estadoDef.id,
        'el disco no cambia tras el intento de ' + rol + ' sobre ' + estadoDef.id);
      assert.equal(docEnDisco(entorno.datosDir, id).version, version,
        'la versión no cambia tras el intento de ' + rol);
    }

    const ok = await pedir(base, 'POST', '/api/expedientes/' + id + '/avanzar', {
      versionEsperada: version,
      destino,
      contexto: contexto(estadoDef.rolEjecutor)
    });
    if ((estadoDef.estadosSiguientes || [])[0]) {
      assert.equal(ok.status, 200,
        estadoDef.id + ' avanza con su rol ejecutor ' + estadoDef.rolEjecutor);
      const leido = await pedir(base, 'GET', '/api/expedientes/' + id);
      assert.equal(leido.body.expediente.estado.id, estadoDef.estadosSiguientes[0]);
      assert.equal(leido.body.version, version + 1);
      assert.equal(estadoEnDisco(entorno.datosDir, id), estadoDef.estadosSiguientes[0],
        'el servidor persiste el resultado del motor');
    } else {
      assert.equal(ok.status, 403,
        'el estado terminal ' + estadoDef.id + ' no puede avanzar');
      assert.equal(estadoEnDisco(entorno.datosDir, id), estadoDef.id);
    }
  });
}