'use strict';

/*
 * ronda-27-c1.test.js
 * ORDEN-RONDA-27 pieza 1 · el candado no te bloquea a vos mismo.
 *
 * Para apagar, el Jefe cierra la ventana negra. En Windows eso no corre el
 * código de salida: el candado queda en la carpeta, y si volvía a abrir antes
 * de los 2 minutos, su propia PC le decía que la carpeta estaba en uso.
 *
 * Con la pieza 1:
 *  - un candado de ESTA máquina cuyo proceso ya no existe (process.kill(pid, 0)
 *    da ESRCH) se toma como abandonado en el acto: arranca y avisa;
 *  - un candado de esta máquina con el proceso VIVO sigue rechazando;
 *  - un candado de OTRA máquina sigue rechazando (no se puede preguntar por un
 *    proceso que no es de acá);
 *  - se escucha SIGHUP, que es el cierre de la ventana.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  crearDirDatos,
  arrancarServidor,
  detenerServidor,
  ejecutarYEsperar,
  SERVIDOR
} = require('./helpers/servidor-util.js');

const RAIZ = path.join(__dirname, '..');
const NOMBRE_CANDADO = 'candado.json';

function rutaCandado(datosDir) {
  return path.join(datosDir, NOMBRE_CANDADO);
}

function leerCandado(datosDir) {
  try {
    return JSON.parse(fs.readFileSync(rutaCandado(datosDir), 'utf8'));
  } catch (e) {
    return null;
  }
}

// Un candado "fresco" (renovado hace un segundo) con la máquina y el pid que se
// le pasen: todavía vivo por reloj, que es lo que la pieza 1 no cambia.
function escribirCandado(datosDir, maquina, pid) {
  fs.writeFileSync(rutaCandado(datosDir), JSON.stringify({
    maquina: maquina,
    pid: pid,
    iniciado: new Date().toISOString(),
    renovado: new Date().toISOString()
  }, null, 2), 'utf8');
}

// Un pid que se acaba de morir de verdad: se arranca un proceso y se espera a
// que termine. Sirve para el caso del Jefe (cerró la ventana negra) sin
// depender de un número inventado.
function pidMuerto() {
  const hijo = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
  assert.ok(hijo.pid, 'el proceso de prueba llegó a arrancar');
  assert.equal(hijo.status, 0, 'el proceso de prueba terminó');
  assert.throws(() => process.kill(hijo.pid, 0), (e) => e.code === 'ESRCH',
    'ese pid ya no existe (ESRCH), que es lo que hace la pieza 1');
  return hijo.pid;
}

test('RONDA-27 pieza 1 · candado de esta máquina con el proceso muerto: arranca y avisa', async () => {
  const datos = crearDirDatos('sgc-p1-muerto-');
  escribirCandado(datos, os.hostname(), pidMuerto());

  const servidor = await arrancarServidor(datos, 0);
  try {
    assert.match(servidor.salida, /SGC-SERVIDOR-CANDADO-REEMPLAZADO/,
      'arranca y avisa que reemplazó el candado de esta máquina');
    const candado = leerCandado(datos);
    assert.ok(candado, 'tras reemplazar, hay candado de nuevo');
    assert.equal(candado.pid, servidor.proc.pid,
      'el candado es ahora del servidor que arrancó');
  } finally {
    await detenerServidor(servidor);
    fs.rmSync(datos, { recursive: true, force: true });
  }
});

test('RONDA-27 pieza 1 · candado de esta máquina con el proceso vivo: rechaza', async () => {
  const datos = crearDirDatos('sgc-p1-vivo-');
  // El pid de ESTE proceso de test: existe, es de esta máquina y no es el del
  // servidor que se va a arrancar. La pieza 1 no lo puede dar por abandonado.
  escribirCandado(datos, os.hostname(), process.pid);

  try {
    const segundo = await ejecutarYEsperar(
      [SERVIDOR, '--datos', datos, '--puerto', '0', '--declarado'], 10000);
    assert.notEqual(segundo.exitCode, 0, 'el segundo servidor no arranca');
    assert.match(segundo.stderr, /en uso/,
      'el rechazo explica que la carpeta ya está en uso');
  } finally {
    fs.rmSync(datos, { recursive: true, force: true });
  }
});

test('RONDA-27 pieza 1 · candado de otra máquina: rechaza', async () => {
  const datos = crearDirDatos('sgc-p1-otra-');
  // Otra máquina con un pid que acá no existe: la pieza 1 sólo pregunta por
  // procesos de ESTA máquina, así que la única señal es el reloj (fresco = vivo).
  escribirCandado(datos, 'PC-DE-OTRA-SALA', pidMuerto());

  try {
    const segundo = await ejecutarYEsperar(
      [SERVIDOR, '--datos', datos, '--puerto', '0', '--declarado'], 10000);
    assert.notEqual(segundo.exitCode, 0, 'el segundo servidor no arranca');
    assert.match(segundo.stderr, /PC-DE-OTRA-SALA/,
      'el rechazo dice qué máquina tiene el candado');
  } finally {
    fs.rmSync(datos, { recursive: true, force: true });
  }
});

test('RONDA-27 pieza 1 · SIGHUP queda escuchando (el cierre de la ventana)', () => {
  const candado = require(path.join(RAIZ, 'server', 'candado.js'));
  const antes = process.listenerCount('SIGHUP');
  candado.vigilarSalida();
  const despues = process.listenerCount('SIGHUP');
  assert.ok(despues > antes,
    'vigilarSalida registra un manejador de SIGHUP (el cierre de la ventana)');
  assert.ok(process.listenerCount('SIGINT') > 0 && process.listenerCount('SIGTERM') > 0 &&
    process.listenerCount('exit') > 0,
    'las otras señales de cierre siguen registradas');
  assert.ok(Number.isInteger(candado.VIVO_MS) && candado.VIVO_MS > 0,
    'la ventana de candado vivo sigue declarada');
});
