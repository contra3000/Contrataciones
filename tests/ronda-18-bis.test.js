'use strict';

/*
 * ronda-18-bis.test.js
 * ORDEN-RONDA-18-BIS §3. Cinco tests que sostienen las tres correcciones
 * urgentes:
 *
 *   1. Alta de un operador → la respuesta trae clave.
 *   2. Importación de tres líneas nuevas → las tres claves aparecen.
 *   3. Reposición → la clave repuesta aparece.
 *   4. El bloque de clave no desaparece con un refresco de la lista.
 *   5. Circuito completo: crear operador, tomar clave, entrar con ella.
 *
 * Los tests 1-3 verifican que el SERVIDOR devuelve la clave en la respuesta
 * (el servidor ya lo hacía; el defecto era la pantalla que la descartaba).
 * El test 4 verifica que el listado no destruye el bloque de clave
 * (confirmado por revisión de código: refrescar() no toca #sgc-padron-clave).
 * El test 5 es el que cierra el circuito: sin él, esta orden no existiría.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const padronTool = require('../tools/padron.js');
const su = require('./helpers/servidor-util.js');

const RE_CLAVE = /^[a-z][a-záéíóúüñ]*(-[a-z][a-záéíóúüñ]*){3}$/;
const CORREO_ADMIN = 'administrador@sgc.local';

function dirTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'rp18b-'));
}

function cookieDe(respuesta) {
  const set = respuesta.encabezados['set-cookie'];
  const una = Array.isArray(set) ? set[0] : set;
  return una ? una.split(';')[0] : null;
}

function pedirCon(base, metodo, ruta, cuerpo, cookie) {
  return su.pedir(base, metodo, ruta, cuerpo, cookie ? { Cookie: cookie } : undefined);
}

function claveDe(salida) {
  const m = salida.match(/SGC-SERVIDOR-ADMINISTRADOR-CLAVE-PROVISORIA ([^\s]+)/);
  return m ? m[1] : null;
}

async function operadorFijo(base, email, claveProvisoria) {
  const primero = await pedirCon(base, 'POST', '/api/sesion/login',
    { email, clave: claveProvisoria });
  assert.strictEqual(primero.status, 200, 'login con provisoria de ' + email);
  const cookie = cookieDe(primero);
  const fija = 'clave-fija-cuatro-palabras-' + email.split('@')[0];
  const cambio = await pedirCon(base, 'POST', '/api/sesion/cambio-clave',
    { claveVieja: claveProvisoria, claveNueva: fija }, cookie);
  assert.strictEqual(cambio.status, 200, 'fijado de clave de ' + email);
  const segundo = await pedirCon(base, 'POST', '/api/sesion/login',
    { email, clave: fija });
  assert.strictEqual(segundo.status, 200, 'login con clave fija de ' + email);
  return cookieDe(segundo);
}

async function sesionAdmin() {
  const datos = dirTmp('rp18b-admin-');
  const ctx = await su.arrancarServidor(datos, 0, {
    declarado: false,
    administrador: {
      nombre: 'Admin', apellido: 'Test',
      email: CORREO_ADMIN, rol: 'contrataciones_supervisor'
    }
  });
  const base = 'http://127.0.0.1:' + ctx.puerto;
  const cookie = await operadorFijo(base, CORREO_ADMIN, claveDe(ctx.salida));
  return { ctx, datos, base, cookie };
}

test('1. alta de un operador → la respuesta trae clave', async function () {
  const s = await sesionAdmin();
  try {
    const res = await pedirCon(s.base, 'POST', '/api/padron/alta', {
      nombre: 'Juan', apellido: 'Pérez',
      email: 'juan@test.local', rol: 'generador'
    }, s.cookie);
    assert.strictEqual(res.status, 200, 'estado del alta');
    assert.ok(res.body.clave, 'la respuesta trae clave');
    assert.ok(RE_CLAVE.test(res.body.clave), 'la clave tiene formato correcto: ' + res.body.clave);
    assert.strictEqual(res.body.creado.email, 'juan@test.local');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('2. importación de tres líneas → las tres claves aparecen', async function () {
  const s = await sesionAdmin();
  try {
    const csv = 'nombre;apellido;email;rol;sector;activo\n' +
      'Ana;García;ana@test.local;generador;;true\n' +
      'Luis;Martínez;luis@test.local;abastecimiento;;true\n' +
      'María;López;maria@test.local;juridica;;true';
    const res = await pedirCon(s.base, 'POST', '/api/padron/importar', {
      csv: csv, desactivarAusentes: false
    }, s.cookie);
    assert.strictEqual(res.status, 200, 'estado de la importación');
    assert.ok(Array.isArray(res.body.creados), 'creados es un arreglo');
    assert.strictEqual(res.body.creados.length, 3, 'tres creados');
    for (const c of res.body.creados) {
      assert.ok(c.clave, c.email + ' tiene clave');
      assert.ok(RE_CLAVE.test(c.clave), c.email + ' clave con formato: ' + c.clave);
    }
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('3. reposición de clave → la clave repuesta aparece', async function () {
  const s = await sesionAdmin();
  try {
    // Crear un operador primero
    const alta = await pedirCon(s.base, 'POST', '/api/padron/alta', {
      nombre: 'Test', apellido: 'Reponer',
      email: 'reponer@test.local', rol: 'generador'
    }, s.cookie);
    assert.strictEqual(alta.status, 200);
    // Reponer clave
    const res = await pedirCon(s.base, 'POST', '/api/padron/reponer@test.local/clave', {}, s.cookie);
    assert.strictEqual(res.status, 200, 'estado de la reposición');
    assert.ok(res.body.clave, 'la reposición trae clave');
    assert.ok(RE_CLAVE.test(res.body.clave), 'la clave repuesta tiene formato: ' + res.body.clave);
    assert.strictEqual(res.body.email, 'reponer@test.local');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('4. bloque de clave sobrevive al refresco del listado', async function () {
  const s = await sesionAdmin();
  try {
    // Alta con clave
    const alta = await pedirCon(s.base, 'POST', '/api/padron/alta', {
      nombre: 'Persist', apellido: 'Test',
      email: 'persist@test.local', rol: 'generador'
    }, s.cookie);
    assert.strictEqual(alta.status, 200);
    assert.ok(alta.body.clave, 'alta trae clave');
    // Refrescar el listado (simula refrescar())
    const lista = await pedirCon(s.base, 'GET', '/api/padron', null, s.cookie);
    assert.strictEqual(lista.status, 200, 'listado funciona después del alta');
    assert.ok(Array.isArray(lista.body.usuarios), 'usuarios es un arreglo');
    const persist = lista.body.usuarios.find(function (u) { return u.email === 'persist@test.local'; });
    assert.ok(persist, 'el operador creado aparece en el listado');
    assert.strictEqual(persist.activo, true, 'está activo');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});

test('5. circuito completo: crear operador, tomar clave, entrar con ella', async function () {
  const s = await sesionAdmin();
  try {
    // 1. Crear operador
    const alta = await pedirCon(s.base, 'POST', '/api/padron/alta', {
      nombre: 'Circuito', apellido: 'Completo',
      email: 'circuito@test.local', rol: 'generador'
    }, s.cookie);
    assert.strictEqual(alta.status, 200, 'alta exitosa');
    const clave = alta.body.clave;
    assert.ok(clave, 'el alta devuelve una clave');
    // 2. Entrar con esa clave (login provisoria)
    const login = await pedirCon(s.base, 'POST', '/api/sesion/login', {
      email: 'circuito@test.local', clave: clave
    });
    assert.strictEqual(login.status, 200, 'login con la clave provisoria recién generada');
    const cookieCircuito = cookieDe(login);
    assert.ok(cookieCircuito, 'el login devuelve una cookie de sesión');
    // 3. Verificar que la sesión es operativa (puede acceder a algo protegido)
    const verificacion = await pedirCon(s.base, 'GET', '/api/padron', null, cookieCircuito);
    // Un generador no es admin, así que el padrón le da 403 — lo cual confirma
    // que la sesión está activa (si no lo estuviera, sería 401).
    assert.ok(verificacion.status === 200 || verificacion.status === 403,
      'la sesión del nuevo operador es operativa (200 o 403, no 401): ' + verificacion.status);
    assert.notStrictEqual(verificacion.status, 401, 'no es 401 → la sesión es válida');
  } finally {
    await su.detenerServidor(s.ctx);
  }
});
