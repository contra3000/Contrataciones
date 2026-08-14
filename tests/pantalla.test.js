'use strict';

/*
 * pantalla.test.js
 * La pantalla de búsqueda se sirve (ORDEN-RONDA-04 §3.6, punto 9):
 * GET / responde 200 con el campo de búsqueda en el HTML, y el catálogo
 * generado se sirve como estático.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const {
  crearDirDatos,
  arrancarServidor,
  detenerServidor,
  pedir
} = require('./helpers/servidor-util');

test('GET / sirve la pantalla de búsqueda con el campo correspondiente', async () => {
  const datosDir = crearDirDatos('sgc-pantalla-');
  const srv = await arrancarServidor(datosDir);
  try {
    const res = await pedir('http://127.0.0.1:' + srv.puerto, 'GET', '/');
    assert.strictEqual(res.status, 200);
    assert.ok(res.raw.indexOf('sgc-campo-clases') !== -1, 'el HTML debe contener el campo de búsqueda');
    assert.ok(res.raw.indexOf('js/catalogo/buscador.js') !== -1);
  } finally {
    await detenerServidor(srv);
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

test('el catálogo generado se sirve como contenido estático', async () => {
  const datosDir = crearDirDatos('sgc-pantalla-');
  const srv = await arrancarServidor(datosDir);
  try {
    const res = await pedir('http://127.0.0.1:' + srv.puerto, 'GET', '/catalogo/clases.json');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body), 'debe ser un JSON de arreglo');
    assert.ok(res.body.length > 6000);
  } finally {
    await detenerServidor(srv);
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});
