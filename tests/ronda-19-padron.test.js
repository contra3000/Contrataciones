'use strict';

/*
 * ronda-19-padron.test.js
 * ORDEN-RONDA-19 §5.2. Operaciones del padrón del Administrador sobre la app
 * real, siempre por el DOM y con la clave leída de la pantalla:
 *
 *   - Alta de un operador: la clave queda en pantalla y sobrevive a un
 *     refresco del padrón (se vuelve a generar una clave nueva al refrescar).
 *   - Importación por texto de tres operadores: tres claves en pantalla.
 *   - Reposición de clave: genera una clave nueva en pantalla.
 *
 * Cada operación arranca con su propio servidor y padrón (un test no depende
 * de lo que dejó el anterior).
 */

const { test } = require('node:test');
const assert = require('node:assert');
const am = require('./helpers/aplicacion-montura.js');

const CSV_TRES = 'nombre;apellido;email;rol;sector;activo\n'
  + 'Ana;García;ana@test.local;generador;;true\n'
  + 'Luis;Martínez;luis@test.local;abastecimiento;;true\n'
  + 'María;López;maria@test.local;juridica;;true\n';

test('§5.2 alta de operador: la clave queda en pantalla y el padrón '
  + 'la conserva tras refrescar', async function () {
  const m = await am.arrancar({ prefix: 'rp19p1-' });
  try {
    const d = m.documento;
    await m.prepararAdmin();

    d.getElementById('sgc-padron-alta').click();
    await m.esperar(() => d.getElementById('sgc-alta-nombre'), 20000,
      'formulario de alta visible');
    m.setear('sgc-alta-nombre', 'Mariano');
    m.setear('sgc-alta-apellido', 'Peralta');
    m.setear('sgc-alta-email', 'persist@test.local');
    m.setear('sgc-alta-sector', 'Compras');
    m.setear('sgc-alta-rol', 'generador');
    m.botonEn(d.getElementById('sgc-padron-formulario'), 'Guardar').click();

    await m.esperar(() => !d.getElementById('sgc-padron-clave').hidden, 20000,
      'bloque de clave del alta visible');
    const clave = m.claveEnPantalla('persist@test.local');
    assert.ok(clave && am.RE_CLAVE.test(clave),
      'clave del alta leída del DOM (' + clave + ')');

    // El padrón vuelve a pedirse; el bloque de clave sigue mostrando la misma.
    d.getElementById('sgc-padron-refrescar').click();
    await m.esperar(() => (d.getElementById('sgc-padron-conteo').textContent || '').indexOf('operadores') !== -1,
      20000, 'padrón devuelto tras refrescar');
    assert.strictEqual(m.claveEnPantalla('persist@test.local'), clave,
      'la clave sigue en pantalla tras el refresco');
    const fila = m.filaDelPadron('persist@test.local');
    assert.ok(fila && fila.textContent.indexOf('Mariano') !== -1,
      'la fila del padrón muestra al operador dado de alta');
  } finally {
    await m.cerrar();
  }
});

test('§5.2 importación por texto de tres operadores: tres claves en pantalla',
  async function () {
    const m = await am.arrancar({ prefix: 'rp19p2-' });
    try {
      const d = m.documento;
      await m.prepararAdmin();

      d.getElementById('sgc-padron-importar').click();
      const area = d.getElementById('sgc-padron-importar-area');
      await m.esperar(() => d.getElementById('sgc-padron-importar-texto'), 20000,
        'área de importación visible');
      d.getElementById('sgc-padron-importar-texto').value = CSV_TRES;
      m.botonEn(area, 'Procesar').click();

      await m.esperar(() => !d.getElementById('sgc-padron-clave').hidden, 20000,
        'bloque de claves visible');
      const claves = ['ana@test.local', 'luis@test.local', 'maria@test.local']
        .map((email) => m.claveEnPantalla(email));
      assert.ok(claves.every(Boolean), 'tres claves leídas del DOM');
      assert.ok(claves.every((c) => am.RE_CLAVE.test(c)),
        'las tres claves cumplen el formato');
      assert.ok(new Set(claves).size === 3, 'tres claves distintas');
      assert.strictEqual(d.getElementById('sgc-padron-importar-area').hidden, true,
        'el área de importación se cierra');
    } finally {
      await m.cerrar();
    }
  });

test('§5.2 reposición de clave: genera una clave nueva en pantalla',
  async function () {
    const m = await am.arrancar({ prefix: 'rp19p3-' });
    try {
      const d = m.documento;
      await m.prepararAdmin();

      d.getElementById('sgc-padron-alta').click();
      await m.esperar(() => d.getElementById('sgc-alta-nombre'), 20000,
        'formulario de alta visible');
      m.setear('sgc-alta-nombre', 'Andrea');
      m.setear('sgc-alta-apellido', 'Ruiz');
      m.setear('sgc-alta-email', 'reponer@test.local');
      m.setear('sgc-alta-sector', '');
      m.setear('sgc-alta-rol', 'generador');
      m.botonEn(d.getElementById('sgc-padron-formulario'), 'Guardar').click();
      await m.esperar(() => !d.getElementById('sgc-padron-clave').hidden, 20000,
        'clave inicial visible');
      const claveVieja = m.claveEnPantalla('reponer@test.local');
      assert.ok(claveVieja, 'clave inicial leída');

      // El alta devuelve la lista del padrón con el operador nuevo.
      await m.esperar(() => m.filaDelPadron('reponer@test.local'), 20000,
        'fila del padrón con el operador nuevo');
      const fila = m.filaDelPadron('reponer@test.local');
      const btnReponer = m.botonEn(fila, 'Reponer clave');
      assert.ok(btnReponer, 'la fila expone Reponer clave');
      btnReponer.click();

      await m.esperar(() => {
        const nueva = m.claveEnPantalla('reponer@test.local');
        return nueva && nueva !== claveVieja;
      }, 20000, 'clave nueva y distinta en pantalla');
      const claveNueva = m.claveEnPantalla('reponer@test.local');
      assert.ok(am.RE_CLAVE.test(claveNueva), 'la clave nueva cumple el formato');
    } finally {
      await m.cerrar();
    }
  });