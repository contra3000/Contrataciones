'use strict';

/*
 * ronda-26-c3.test.js
 * ORDEN-RONDA-26 pieza 3 · "Nada del sistema espera para siempre": tope al
 * generador de pliegos.
 *
 * Un generador que se cuelga a propósito (python que escribe su pid y duerme)
 * debe terminar el pedido con un error en castellano antes de esperar para
 * siempre, y no dejar ningún proceso vivo tras el tope.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const probador = require('../server/pliego-probador.js');

function esperarMuerte(pid, ms) {
  return new Promise((resolver) => {
    const inicio = Date.now();
    function verificar() {
      try {
        process.kill(pid, 0);
        if (Date.now() - inicio < ms) {
          setTimeout(verificar, 100);
        } else {
          resolver(false);
        }
      } catch (e) {
        resolver(true);
      }
    }
    verificar();
  });
}

test('RONDA-26 pieza 3 · el generador que se cuelga se corta a tiempo, responde en castellano y no deja procesos vivos', async () => {
  const previo = process.env.SGC_GENERADOR_PLIEGOS;
  const fi = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-cuelga-'));
  try {
    const generador = path.join(fi, 'generador');
    fs.mkdirSync(path.join(generador, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(generador, 'plantillas'), { recursive: true });
    const pidPath = path.join(fi, 'pid.txt');
    // Se cuelga a propósito: escribe su pid y se queda dormido.
    fs.writeFileSync(
      path.join(generador, 'scripts', 'generar_pliego.py'),
      "import os, time\n" +
      "open(r'" + pidPath + "', 'w').write(str(os.getpid()))\n" +
      "time.sleep(600)\n",
      'utf8'
    );
    process.env.SGC_GENERADOR_PLIEGOS = generador;

    const inicio = Date.now();
    const demora = async () => Date.now() - inicio;
    await assert.rejects(
      probador.generarPliegoPrueba('bienes', { topeMs: 1500 }),
      (e) => {
        assert.ok(e && e.mensajeSeguro === true, 'el error es de los que ven los usuarios');
        assert.match(e.message, /tardó demasiado y se canceló/,
          'el error dice qué pasó, en castellano');
        assert.ok(e.message.indexOf('Error') === -1,
          'no se filtra el nombre de clase de la máquina');
        return true;
      },
      'el pedido termina con el error del tope'
    );
    assert.ok(await demora() >= 1000 && await demora() < 20000,
      'no espera para siempre (' + (await demora()) + ' ms)');

    // El proceso realmente arrancó (quedó su pid) y, tras el tope, murió.
    const pidLeido = fs.existsSync(pidPath) ? fs.readFileSync(pidPath, 'utf8').trim() : '';
    assert.ok(/^\d+$/.test(pidLeido), 'el generador colgado había arrancado (pid ' + pidLeido + ')');
    assert.ok(await esperarMuerte(Number(pidLeido), 3000),
      'el python colgado quedó muerto tras el tope');
    assert.strictEqual(probador.procesosActivos(), 0,
      'el servidor dejó de contarlo entre sus procesos abiertos');
  } finally {
    if (previo === undefined) {
      delete process.env.SGC_GENERADOR_PLIEGOS;
    } else {
      process.env.SGC_GENERADOR_PLIEGOS = previo;
    }
    fs.rmSync(fi, { recursive: true, force: true });
  }
});