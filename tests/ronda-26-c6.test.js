'use strict';

/*
 * ronda-26-c6.test.js
 * ORDEN-RONDA-26 pieza 6 · un solo servidor por carpeta de datos.
 *
 * Al arrancar, el servidor deja `candado.json` en la carpeta de datos (máquina,
 * proceso y hora) y lo renueva cada 30 segundos. Un segundo servidor sobre la
 * MISMA carpeta no arranca y nombra la máquina del primero; un candado
 * abandonado (sin renovación de más de 2 minutos) se reemplaza y se avisa; un
 * cierre normal deja la carpeta sin candado.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  crearDirDatos,
  arrancarServidor,
  detenerServidor,
  ejecutarYEsperar,
  SERVIDOR
} = require('./helpers/servidor-util.js');

const NOMBRE_CANDADO = 'candado.json';
const RAIZ = path.join(__dirname, '..');

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

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('RONDA-26 pieza 6 · dos servidores sobre la misma carpeta: el segundo no arranca y nombra la máquina', async () => {
  const datos = crearDirDatos('sgc-p6-vivo-');
  const primero = await arrancarServidor(datos, 0);
  try {
    const candado = leerCandado(datos);
    assert.ok(candado, 'el servidor que arranca deja el candado en la carpeta');
    assert.equal(candado.maquina, os.hostname(), 'el candado dice qué máquina lo tiene');
    assert.equal(typeof candado.pid, 'number', 'el candado dice qué proceso lo tiene');
    assert.ok(leerCandado(datos).renovado, 'el candado registra la hora de la renovación');

    const segundo = await ejecutarYEsperar(
      [SERVIDOR, '--datos', datos, '--puerto', '0', '--declarado'], 10000);
    assert.notEqual(segundo.exitCode, 0, 'el segundo servidor no arranca');
    assert.match(segundo.stderr, new RegExp(escaparRegex(os.hostname())),
      'el rechazo dice qué máquina tiene el candado');
    assert.match(segundo.stderr, /en uso/,
      'el rechazo explica que la carpeta ya está en uso');
  } finally {
    await detenerServidor(primero);
    fs.rmSync(datos, { recursive: true, force: true });
  }
});

test('RONDA-26 pieza 6 · candado abandonado: arranca, lo reemplaza y avisa', async () => {
  const datos = crearDirDatos('sgc-p6-abandono-');
  fs.writeFileSync(rutaCandado(datos), JSON.stringify({
    maquina: 'PC-ANTERIOR',
    pid: 999999,
    iniciado: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    renovado: new Date(Date.now() - 4 * 60 * 1000).toISOString()
  }, null, 2), 'utf8');

  const servidor = await arrancarServidor(datos, 0);
  try {
    assert.match(servidor.salida, /SGC-SERVIDOR-CANDADO-REEMPLAZADO/,
      'arranca y avisa que reemplazó el candado abandonado');
    const candado = leerCandado(datos);
    assert.ok(candado, 'tras reemplazar, hay candado de nuevo');
    assert.equal(candado.pid, servidor.proc.pid,
      'el candado es ahora del servidor que arrancó');
  } finally {
    await detenerServidor(servidor);
    fs.rmSync(datos, { recursive: true, force: true });
  }
});

test('RONDA-26 pieza 6 · cierre normal: el candado desaparece', async () => {
  const datos = crearDirDatos('sgc-p6-cierre-');
  const servidor = await arrancarServidor(datos, 0);
  assert.ok(leerCandado(datos), 'al arrancar hay candado');
  await detenerServidor(servidor);
  assert.equal(leerCandado(datos), null,
    'un cierre normal borra el candado de la carpeta de datos');
  fs.rmSync(datos, { recursive: true, force: true });
});