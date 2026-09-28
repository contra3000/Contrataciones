'use strict';

/*
 * ronda-25-c3.test.js
 * ORDEN-RONDA-25 pieza 3 · La sesión no se corta mientras trabajás.
 *
 * Dos capas:
 *
 *   1. reloj adelantado: sesion-viva.js contra un `actualDeSesion` con la MISMA
 *      regla del servidor (vence después de 15 minutos sin actividad). Con
 *      actividad la renovación mantiene la sesión pasados los 15 originales y
 *      sin actividad la sesión vence y el 401 llama al aviso. Si se quita la
 *      renovación por actividad (auditoría E3), el "a los 16 minutos sigue
 *      viva" queda rojo.
 *
 *   2. servidor real por la montura: la sesión se corta del lado del servidor
 *      (equivalente al vencimiento con la pestaña abierta), la próxima
 *      operación de la app responde 401 y el aviso "Tu sesión venció" aparece.
 */

const { test } = require('node:test');
const assert = require('node:assert');

const am = require('./helpers/aplicacion-montura.js');

const MINUTO = 60 * 1000;
const TIEMPO_SESION_MS = 15 * MINUTO;

test('RONDA-25 pieza 3 · con el reloj adelantado, la actividad mantiene la sesión y la inactividad la vence', async () => {
  am.cargarModulos();
  const real = globalThis.SGC.adapters.sesion.actualDeSesion;
  const relojReal = Date.now;
  const sv = globalThis.SGC.sesionViva;
  assert.ok(sv, 'el módulo de sesión viva está cargado');

  // Sesión "servidor" con la misma regla del real: actualDeSesion re-toca la
  // sesión al atender y la corta después de TIEMPO_SESION_MS sin actividad.
  let ahora = 0;
  let ultimaActividad = 0;
  let llamadas = 0;
  let avisado = false;
  Date.now = () => ahora;
  globalThis.SGC.adapters.sesion.actualDeSesion = function () {
    llamadas++;
    if (ahora - ultimaActividad > TIEMPO_SESION_MS) {
      return Promise.resolve({ estado: 401, datos: null });
    }
    ultimaActividad = ahora;
    return Promise.resolve({ estado: 200, datos: { autenticado: true } });
  };

  try {
    sv.montar({ alVencer: () => { avisado = true; } });

    // Actividad a los 12 minutos: el pulso renueva y la sesión queda viva.
    ahora += 12 * MINUTO;
    sv.activar();
    assert.strictEqual(await sv.pulsar(), true, 'el pulso con actividad renueva la sesión');

    // A los 16 minutos desde el ingreso (4 desde la renovación, pasados los
    // 15 originales) la sesión sigue viva: la actividad la mantiene. Sin la
    // renovación este pedido sería 401 (auditoría E3).
    ahora += 4 * MINUTO;
    assert.strictEqual((await globalThis.SGC.adapters.sesion.actualDeSesion()).estado,
      200, 'la actividad mantiene la sesión pasados los 15 minutos originales');

    // Inactividad: se dejan pasar más de 15 minutos y el pulso NO renueva.
    ahora += 17 * MINUTO;
    await sv.pulsar();
    assert.strictEqual(llamadas, 2, 'inactivo, el pulso no renueva (nada que refrescar)');
    assert.strictEqual(avisado, false, 'aún no hay aviso');

    // La próxima operación responde 401 (la sesión venció de verdad)...
    assert.strictEqual((await globalThis.SGC.adapters.sesion.actualDeSesion()).estado,
      401, 'la inactividad vence la sesión a los 15 minutos');

    // ...y al volver la actividad el pulso encuentra el 401 y llama al aviso.
    sv.activar();
    assert.strictEqual(await sv.pulsar(), false, 'la renovación tras vencer recibe 401');
    assert.strictEqual(avisado, true, 'el 401 del vencimiento llama al aviso');
  } finally {
    sv.detener();
    globalThis.SGC.adapters.sesion.actualDeSesion = real;
    Date.now = relojReal;
  }
});

test('RONDA-25 pieza 3 · servidor real: el 401 de una operación muestra el aviso "Tu sesión venció"', async () => {
  const m = await am.arrancar({ prefix: 'rp25c3b-' });
  try {
    await m.prepararOperador('generador.r25c3b@test.local', 'Generadora', 'Ronda 25', 'generador');
    const d = m.documento;
    const sv = globalThis.SGC.sesionViva;
    const aviso = d.getElementById('sgc-sesion-vencida');
    assert.ok(sv, 'la app montó la sesión viva al entrar');
    assert.ok(aviso.hidden, 'sin aviso con la sesión viva');

    // La renovación por actividad llega al servidor y responde 200.
    d.emit('mousedown');
    assert.strictEqual(await sv.pulsar(), true, 'el pulso con actividad renueva contra el servidor');

    // La sesión se corta del lado del servidor (equivale al vencimiento: la
    // pestaña sigue abierta y la cookie ya no tiene sesión detrás). La próxima
    // operación de la app —abrir el tablero— responde 401 y muestra el aviso.
    await globalThis.SGC.adapters.sesion.salir();
    d.getElementById('sgc-nav-tablero').click();
    await m.esperar(() => !d.getElementById('sgc-sesion-vencida').hidden, 20000,
      'el 401 muestra el aviso de sesión vencida');
    assert.ok(aviso.textContent.indexOf('Tu sesión venció') !== -1,
      'el aviso dice el texto pedido');
    assert.ok(aviso.textContent.indexOf('volvé a entrar en otra pestaña y guardá') !== -1,
      'el aviso indica cómo seguir: lo no guardado sigue en la pantalla');
  } finally {
    await m.cerrar();
  }
});