'use strict';

/*
 * ronda-26-c1.test.js
 * ORDEN-RONDA-26 pieza 1 · los datos del expediente sin guiones.
 *
 * Con un expediente CREADO por la montura (alta real por el wizard, no
 * fabricado), el panel "Datos" muestra "Expediente 2026-0001" y el número.
 * Antes de la pieza el panel leía `expediente.id` e `identificacion.numero`,
 * que el expediente real no guarda, y salía "—".
 */

const { test } = require('node:test');
const assert = require('node:assert');

const am = require('./helpers/aplicacion-montura.js');

function botonAbrirDelTablero(d, expId) {
  const botones = d.getElementById('sgc-kanban').querySelectorAll('button');
  return botones.find((b) => (b.getAttribute('aria-label') || '') === 'Abrir el expediente ' + expId);
}

function campoDelPanel(d, nombre) {
  const dl = d.getElementById('sgc-expediente-datos');
  const hijos = dl.children;
  for (let i = 0; i < hijos.length - 1; i++) {
    if (hijos[i].tag === 'dt' && hijos[i].textContent === nombre) {
      return hijos[i + 1].textContent;
    }
  }
  return null;
}

test('RONDA-26 pieza 1 · un expediente creado por la montura muestra 2026-0001 y su número en el panel Datos', async function () {
  const m = await am.arrancar({ prefix: 'rp26c1-' });
  const d = m.documento;
  try {
    await m.prepararOperador('generador.r26c1@test.local', 'Generadora', 'Ronda 26', 'generador');

    m.escribir('sgc-titulo', 'Insumos para la unidad de pieza 1');
    m.escribir('sgc-anio', '2026');
    m.escribir('sgc-dependencia', 'División Logística');
    d.getElementById('sgc-siguiente').click();
    await m.esperar(() => !d.getElementById('sgc-paso-renglones').hidden, 20000,
      'paso de renglones visible');
    await m.esperar(() => (d.getElementById('sgc-estado').textContent || '').indexOf('ítems') !== -1,
      30000, 'índice del catálogo cargado');

    const clases = globalThis.SGC.catalogo.carga.obtenerEstado().clases;
    const clasesConItems = clases.filter((c) => c[3] > 0);
    assert.ok(clasesConItems.length >= 2, 'el catálogo real tiene al menos dos clases con ítems');
    for (let i = 0; i < 2; i++) {
      m.escribir('sgc-campo-clases', clasesConItems[i][2]);
      await m.esperar(() => d.getElementById('sgc-opcion-clase-0'), 20000,
        'opción de la clase ' + (i + 1) + ' renderizada');
      m.mousedown('sgc-opcion-clase-0');
      await m.esperar(() => d.getElementById('sgc-opcion-item-0'), 30000,
        'ítems de la clase ' + (i + 1) + ' cargados');
      m.mousedown('sgc-opcion-item-0');
      await m.esperar(() => d.getElementById('sgc-lista-renglones').children.length === i + 1,
        20000, 'renglón ' + (i + 1) + ' agregado');
    }

    for (const fila of d.getElementById('sgc-lista-renglones').children) {
      const unidad = fila.querySelector('[aria-label="Unidad de medida"]');
      assert.ok(unidad, 'cada fila expone el campo de unidad');
      m.escribirEnNodo(unidad, 'unidad');
    }
    await m.esperar(() => (d.getElementById('sgc-resumen').textContent || '').indexOf('0 con error') !== -1,
      20000, 'los renglones quedan sin errores');

    d.getElementById('sgc-siguiente').click();
    await m.esperar(() => !d.getElementById('sgc-paso-fundamentacion').hidden, 20000,
      'paso de fundamentación visible');
    m.escribir('sgc-justificacion', 'Se reponen ítems del catálogo para el funcionamiento del área.');
    d.getElementById('sgc-siguiente').click();
    await m.esperar(() => !d.getElementById('sgc-paso-revision').hidden, 20000,
      'paso de revisión visible');
    d.getElementById('sgc-persistir').click();
    await m.esperar(() => !d.getElementById('sgc-exito').hidden, 30000,
      'expediente creado para la pieza 1');
    const expId = d.getElementById('sgc-exito-id').textContent.replace(/^Expediente\s*/, '').trim();
    assert.strictEqual(expId, '2026-001', 'el expediente creado por la montura es el 2026-001');
    const numeroEsperado = expId.slice(5);

    d.getElementById('sgc-nav-tablero').click();
    await m.esperar(() => !d.getElementById('sgc-kanban').hidden, 20000, 'tablero visible');
    await m.esperar(() => !!botonAbrirDelTablero(d, expId), 30000,
      'tarjeta del expediente creado en el tablero');
    botonAbrirDelTablero(d, expId).click();
    await m.esperar(() => !d.getElementById('sgc-expediente').hidden, 30000,
      'expediente abierto');

    await m.esperar(() => campoDelPanel(d, 'Expediente') !== null &&
      campoDelPanel(d, 'Número') !== null, 30000,
      'el panel Datos tiene Expediente y Número');
    assert.strictEqual(campoDelPanel(d, 'Expediente'), expId,
      'el panel muestra el id del expediente sin guiones de más');
    assert.strictEqual(campoDelPanel(d, 'Número'), numeroEsperado,
      'el panel muestra el número del expediente');
  } finally {
    await m.cerrar();
  }
});