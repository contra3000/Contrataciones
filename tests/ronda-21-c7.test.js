'use strict';

/*
 * ronda-21-c7.test.js
 * ORDEN-RONDA-21 §2 · C7: repartir las catorce claves.
 *
 * Se importa PADRON_INICIAL.csv (el sintético de catorce operadores con la
 * misma estructura que el real) POR EL ÁREA DE IMPORTACIÓN, se leen las
 * catorce claves DE LA PANTALLA y se entra con tres de ellas: generador,
 * jurídica y contaduría (las tres son de rol común). La batería ya cubre la
 * importación por la API; acá se cubre la persona que entra con la clave que
 * vió. Todo por el DOM, sin llamar funciones de vista a mano.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const am = require('./helpers/aplicacion-montura.js');
const { importarPadron, cambiarSesion } = require('./helpers/circuito-ronda-21.js');

// Primera y segunda palabra de la clave provisoria que el padrón muestra.
function primerasDos(clave) {
  return clave && clave.split(' ').slice(0, 2).join(' ');
}

test('C7: las catorce claves en pantalla y tres personas entran con ellas', async function () {
  const m = await am.arrancar({ prefix: 'rp21c7-' });
  try {
    const d = m.documento;
    await m.prepararAdmin();
    const padron = await importarPadron(m);

    // Las catorce claves se leyeron del DOM y la pantalla las muestra
    // como bloque visible con el formato del padrón.
    assert.strictEqual(padron.claves.length, 14, 'catorce claves leídas de la pantalla');
    for (const clave of padron.claves) {
      assert.ok(am.RE_CLAVE.test(clave), 'clave con el formato del padrón: ' + clave);
    }
    assert.strictEqual(new Set(padron.claves.map(primerasDos)).size, 14,
      'catorce claves distintas (dos primeras palabras distintas)');

    // Entrar con tres de las catorce: la persona usa la clave que vió.
    const fijas = {};
    for (const email of ['generador.c21@test.local', 'juridica.c21@test.local', 'contaduria.c21@test.local']) {
      const fija = await cambiarSesion(m, email, padron.clavesDe[email]);
      fijas[email] = fija;
      assert.match(d.getElementById('sgc-operador-actual').textContent, new RegExp(email.replace('.', '\\.')));
    }

    // Salir y reentrar con la clave fija que cambió la primera persona.
    const gen = await cambiarSesion(m, 'generador.c21@test.local', fijas['generador.c21@test.local']);
    assert.strictEqual(gen, fijas['generador.c21@test.local'],
      'C7: la clave fija se conserva entre sesiones');
  } finally {
    await m.cerrar();
  }
});