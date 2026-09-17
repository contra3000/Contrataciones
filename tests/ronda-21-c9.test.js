'use strict';

/*
 * ronda-21-c9.test.js
 * ORDEN-RONDA-21 §2 · C9: salir y volver.
 *
 * Tras una sesión de operador, se sale: queda UNA pantalla de ingreso limpia
 * (la lista del modo declarado oculta y el formulario de ingreso como única
 * puerta) y se vuelve a entrar con la misma clave fija. Todo por el DOM.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const am = require('./helpers/aplicacion-montura.js');
const { importarPadron, cambiarSesion } = require('./helpers/circuito-ronda-21.js');

test('C9: salir deja una pantalla de ingreso limpia y se vuelve a entrar', async function () {
  const m = await am.arrancar({ prefix: 'rp21c9-' });
  try {
    const d = m.documento;
    await m.prepararAdmin();
    const padron = await importarPadron(m);

    const fija = await cambiarSesion(m, 'abastecimiento.c21@test.local', padron.clavesDe['abastecimiento.c21@test.local']);
    assert.match(d.getElementById('sgc-operador-actual').textContent, /abastecimiento\.c21@test\.local/);

    // Salir: una pantalla de ingreso limpia.
    d.getElementById('sgc-sesion-salir').click();
    await m.esperar(() => !d.getElementById('sgc-ingreso').hidden, 20000,
      'pantalla de ingreso tras salir');
    assert.strictEqual(d.getElementById('sgc-app').hidden, true,
      'C9: la aplicación queda oculta al salir');
    assert.strictEqual(d.getElementById('sgc-lista-operadores').hidden, true,
      'C9: la lista del modo declarado no aparece en modo autenticado');
    assert.strictEqual(d.getElementById('sgc-cambio-clave-forma').hidden, true,
      'C9: el cambio de clave no queda expuesto');
    assert.strictEqual(d.getElementById('sgc-ingreso').hidden, false,
      'C9: el formulario de ingreso es la única puerta visible');

    // Volver a entrar con la clave fija ya cambiada.
    await cambiarSesion(m, 'abastecimiento.c21@test.local', fija);
    assert.match(d.getElementById('sgc-operador-actual').textContent, /abastecimiento\.c21@test\.local/,
      'C9: la persona vuelve a entrar con su clave fija');
  } finally {
    await m.cerrar();
  }
});