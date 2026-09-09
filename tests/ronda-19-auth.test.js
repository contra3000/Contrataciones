'use strict';

/*
 * ronda-19-auth.test.js
 * ORDEN-RONDA-19 §5.1. Test que arranca desde el ingreso, con un padrón real
 * servido por el servidor, y que NO llama a ninguna función de vista a mano:
 *
 *   1. Entrar con el administrador.
 *   2. Dar de alta a un operador generador desde la pantalla y leer la clave
 *      provisoria de la pantalla (del DOM, no de la respuesta HTTP).
 *   3. Salir, y entrar con ese operador y esa clave.
 *   4. Cambiar la clave provisoria.
 *   5. Crear un requerimiento completo —título, año, dependencia,
 *      justificación y UN RENGLÓN desde el catálogo real— y guardarlo.
 *
 * Todo el recorrido ocurre por eventos del DOM (click, input, submit) sobre la
 * aplicación real montada con tests/helpers/aplicacion-montura.js. Si algún
 * paso exigiera invocar una función de la app a mano, el test estaría mal
 * escrito (nota 3 de §5.1).
 */

const { test } = require('node:test');
const assert = require('node:assert');
const am = require('./helpers/aplicacion-montura.js');

test('§5.1 recorrido completo: ingreso → alta → clave del DOM → salir → '
  + 'entrar → cambio de clave → requerimiento con un renglón', async function () {
  const m = await am.arrancar({ prefix: 'rp19a-' });
  try {
    // Pasos 1-4: la montura los recorre por el DOM (ingreso del admin, alta
    // del generador con la clave leída en pantalla, salida, re-ingreso,
    // cambio de clave).
    const recorrido = await m.prepararGenerador('generador@test.local', 'Generador', 'Prueba');
    assert.ok(am.RE_CLAVE.test(recorrido.claveProvisoria),
      'la clave del generador leída del DOM cumple el formato');
    const d = m.documento;

    // Paso 5 · Identificación.
    assert.strictEqual(d.getElementById('sgc-app').hidden, false, 'asistente visible');
    assert.match(d.getElementById('sgc-operador-actual').textContent, /generador@test\.local/);
    m.escribir('sgc-titulo', 'Adquisición de insumos de oficina');
    m.escribir('sgc-anio', '2026');
    m.escribir('sgc-dependencia', 'Dirección General de Administración');
    d.getElementById('sgc-siguiente').click();
    await m.esperar(() => !d.getElementById('sgc-paso-renglones').hidden, 20000,
      'paso de renglones visible');

    // Paso 5 · Catálogo real: el índice ya cargó (buscador.montar en iniciar).
    await m.esperar(() => (d.getElementById('sgc-estado').textContent || '').indexOf('ítems') !== -1,
      30000, 'índice del catálogo cargado');
    const clases = globalThis.SGC.catalogo.carga.obtenerEstado().clases;
    const claseConItems = clases.find((c) => c[3] > 0);
    assert.ok(claseConItems && claseConItems[3] > 0,
      'el catálogo tiene al menos una clase con ítems');

    // Paso 5 · UN renglón: se elige la clase y el primer ítem por el DOM.
    m.escribir('sgc-campo-clases', claseConItems[2]);
    await m.esperar(() => d.getElementById('sgc-opcion-clase-0'), 20000,
      'opción de clase renderizada');
    m.mousedown('sgc-opcion-clase-0');
    await m.esperar(() => d.getElementById('sgc-opcion-item-0'), 30000,
      'ítems de la clase cargados');
    m.mousedown('sgc-opcion-item-0');
    await m.esperar(() => d.getElementById('sgc-lista-renglones').children.length === 1,
      20000, 'renglón agregado a la lista');
    // Cantidad 1 por defecto; falta la unidad → el renglón arranca con error.
    await m.esperar(() => (d.getElementById('sgc-resumen').textContent || '').indexOf('1 con error') !== -1,
      20000, 'el renglón sin unidad se marca con error');
    const campoUnidad = d.getElementById('sgc-lista-renglones')
      .querySelector('[aria-label="Unidad de medida"]');
    assert.ok(campoUnidad, 'la fila del renglón expone el campo de unidad');
    m.escribirEnNodo(campoUnidad, 'unidad');
    await m.esperar(() => (d.getElementById('sgc-resumen').textContent || '').indexOf('0 con error') !== -1,
      20000, 'el renglón queda sin errores');

    // Paso 5 · Fundamentación.
    d.getElementById('sgc-siguiente').click();
    await m.esperar(() => !d.getElementById('sgc-paso-fundamentacion').hidden, 20000,
      'paso de fundamentación visible');
    m.escribir('sgc-justificacion', 'Se reponen los insumos básicos de oficina para el funcionamiento del área.');

    // Paso 5 · Revisión y guardado.
    d.getElementById('sgc-siguiente').click();
    await m.esperar(() => !d.getElementById('sgc-paso-revision').hidden, 20000,
      'paso de revisión visible');
    d.getElementById('sgc-persistir').click();
    await m.esperar(() => !d.getElementById('sgc-exito').hidden, 20000,
      'expediente creado y confirmado en pantalla');
    assert.match(d.getElementById('sgc-exito-id').textContent, /Expediente\s+/, 'muestra el id');
  } finally {
    await m.cerrar();
  }
});