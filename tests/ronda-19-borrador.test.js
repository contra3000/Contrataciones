'use strict';

/*
 * ronda-19-borrador.test.js
 * ORDEN-RONDA-19 §5.2. El borrador local existe en modo autenticado: un
 * operador escribe medio requerimiento, "recarga la página" (misma ventana:
 * misma cookie y mismo sessionStorage) y la aplicación ofrece retomar el
 * borrador, con la firma del operador, sino que lo aplica al formulario.
 *
 * Todo por eventos del DOM y con las claves leídas de la pantalla.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const am = require('./helpers/aplicacion-montura.js');

test('§5.2 borrador en modo autenticado: se guarda, se ofrece al '
  + 'recargar y se aplica al retomar', async function () {
  const m = await am.arrancar({ prefix: 'rp19bd-' });
  try {
    const d = m.documento;

    // Ingreso admin → alta del generador → re-ingreso y cambio de clave.
    await m.prepararGenerador('generador@test.local', 'Carlos', 'Gómez');
    assert.strictEqual(d.getElementById('sgc-app').hidden, false, 'asistente visible');

    // Medio requerimiento en el paso 1 (cada campo guarda el borrador).
    m.escribir('sgc-titulo', 'Servicio de mantenimiento preventivo');
    m.escribir('sgc-anio', '2026');
    m.escribir('sgc-dependencia', 'Dirección de Infraestructura');
    assert.ok(globalThis.sessionStorage.getItem('sgc.borrador.v1') !== null,
      'el borrador quedó guardado en sessionStorage');

    // Recargar como una pestaña real: la cookie reanuda la sesión y el
    // sessionStorage conserva el borrador.
    m.recargar();
    await m.esperar(() => !d.getElementById('sgc-app').hidden, 20000,
      'asistente visible tras la recarga');
    await m.esperar(() => {
      const aviso = d.getElementById('sgc-borrador-aviso');
      const info = d.getElementById('sgc-borrador-info');
      return aviso && !aviso.hidden && info
        && info.textContent.indexOf('generador@test.local') !== -1;
    }, 20000, 'borrador ofrecido con la firma del operador');
    assert.match(d.getElementById('sgc-sesion-quien').textContent, /generador@test\.local/,
      'la sesión se reanudó por la cookie');

    // Retomar: el formulario vuelve a tener los valores del borrador.
    d.getElementById('sgc-btn-retomar').click();
    await m.esperar(() => d.getElementById('sgc-titulo').value.indexOf('mantenimiento') !== -1,
      20000, 'borrador aplicado al retomar');
    assert.strictEqual(d.getElementById('sgc-dependencia').value,
      'Dirección de Infraestructura', 'dependencia restaurada');
  } finally {
    await m.cerrar();
  }
});