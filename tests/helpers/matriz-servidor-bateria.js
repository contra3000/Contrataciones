'use strict';

/*
 * matriz-servidor-bateria.js
 * ORDEN-RONDA-07 §2.1 (condición de entrada): la matriz 18 × 7 por servidor.
 * Un test por estado del circuito: el rol ejecutor avanza (o recibe 403 en el
 * terminal) y los otros seis roles reciben 403; el disco se verifica después
 * de cada intento.
 *
 * ORDEN-RONDA-09 corrección 2.1: la matriz entera en un solo archivo tardaba
 * ~133 s y el runner cortaba la suite completa. Se parte en dos archivos
 * (transiciones-servidor-matriz.test.js y transiciones-servidor-matriz-2.test.js)
 * que corren en paralelo, y cada test lleva su timeout explícito. `correrMatriz`
 * recibe la mitad de los estados que le toca.
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
} = require('./transiciones-servidor-util.js');

function correrMatriz(estados) {
  let entorno = null;
  let base = null;

  before(async () => {
    entorno = await arrancarEntorno();
    base = 'http://127.0.0.1:' + entorno.ctx.puerto;
  });

  after(async () => {
    await limpiarEntorno(entorno);
  });

  for (const estadoDef of estados) {
    test('matriz por servidor: ' + estadoDef.id + ' — el rol correcto avanza y los otros seis reciben 403',
      { timeout: 300000 },
      async () => {
        const { id, version } = await crearEnEstado(base, entorno.datosDir, estadoDef.id, assert);
        const destino = (estadoDef.estadosSiguientes || [])[0] || 'PERFECCIONADA';

        for (const rol of ROLES) {
          // ADR-033 (ORDEN-RONDA-14 §3.1): la jerarquía vuelve permitido al
          // conjunto efectivo del rol (el propio más los heredados). Un
          // supervisor puede ejecutar el paso de su supervisado, así que aquí
          // solo se exige 403 para quienes no lo incluyen.
          if (config.rolesEfectivos(rol).indexOf(estadoDef.rolEjecutor) !== -1) {
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

        // ORDEN-RONDA-08 §2.1: para avanzar fuera de un estado que produce
        // documento hay que guardar antes su entregable (el motor lo exige).
        let versionFinal = version;
        const entregable = config.entregableDelEstado(estadoDef.id);
        if (entregable) {
          const g = await pedir(base, 'POST', '/api/expedientes/' + id + '/entregables', {
            id: entregable.id,
            nombre: entregable.archivo,
            contenido: '<p>Documento de ' + entregable.id + '</p>',
            contexto: contexto(estadoDef.rolEjecutor)
          });
          assert.equal(g.status, 201,
            estadoDef.id + ' guarda su entregable ' + entregable.id);
          versionFinal = g.body.version;
        }

        const ok = await pedir(base, 'POST', '/api/expedientes/' + id + '/avanzar', {
          versionEsperada: versionFinal,
          destino,
          contexto: contexto(estadoDef.rolEjecutor)
        });
        if ((estadoDef.estadosSiguientes || [])[0]) {
          assert.equal(ok.status, 200,
            estadoDef.id + ' avanza con su rol ejecutor ' + estadoDef.rolEjecutor);
          const leido = await pedir(base, 'GET', '/api/expedientes/' + id);
          assert.equal(leido.body.expediente.estado.id, estadoDef.estadosSiguientes[0]);
          assert.equal(leido.body.version, versionFinal + 1);
          assert.equal(estadoEnDisco(entorno.datosDir, id), estadoDef.estadosSiguientes[0],
            'el servidor persiste el resultado del motor');
        } else {
          assert.equal(ok.status, 403,
            'el estado terminal ' + estadoDef.id + ' no puede avanzar');
          assert.equal(estadoEnDisco(entorno.datosDir, id), estadoDef.id);
        }
      });
  }
}

module.exports = { correrMatriz, config };