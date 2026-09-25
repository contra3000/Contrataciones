'use strict';

/*
 * ronda-24-c3.test.js
 * ORDEN-RONDA-24 §Pieza 3 · "Agregar valor" no te manda arriba.
 *
 * El defecto: `requerimiento-valores.js render()` borra todos los bloques y los
 * vuelve a crear; el contenedor se achica un instante y el navegador vuelve al
 * principio de la página (con muchos renglones, el campo nuevo queda fuera de
 * vista). El cambio guarda la posición del scroll antes de reconstruir y la
 * restaura después; el foco queda en el campo nuevo.
 *
 * En la montura (app real + servidor real, nada se llama a mano):
 *  - el expediente tiene 20 renglones (sembrado en disco como datos de prueba);
 *  - "Agregar valor" en el renglón 15 (data-indice 14, etiqueta "Renglón 15");
 *  - el campo nuevo existe, tiene el foco y la página NO salta al tope: el
 *    scroll del documento queda donde estaba (el stub de DOM simula el colapso
 *    del documento al vaciarse el contenedor, igual que el navegador real).
 *
 * Auditoría (§E3): sin la restauración del scroll en render() este test queda
 * rojo: el documento colapsa, el navegador manda el scroll a 0 y la
 * verificación de la posición recuperada falla.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const am = require('./helpers/aplicacion-montura.js');

const ID = '2026-0243';

function botonAbrirDelTablero(d, expId) {
  const botones = d.getElementById('sgc-kanban').querySelectorAll('button');
  return botones.find((b) => (b.getAttribute('aria-label') || '') === 'Abrir el expediente ' + expId);
}

// 20 renglones del catálogo sintético: lo que importa para la pantalla es que
// existan (codigo/descripcion) y que sean veinte, para que la reconstrucción
// sea costosa en pantalla como en la incidencia real.
function renglonesDePrueba(cantidad) {
  const renglones = [];
  for (let i = 0; i < cantidad; i++) {
    renglones.push({
      codigo: 'X.100.' + (i + 1),
      descripcion: 'Insumo de prueba ' + (i + 1),
      item: 'Ítem ' + (i + 1),
      cantidad: '1',
      unidad: 'unidad',
      rubro: 'Rubro ' + (i + 1)
    });
  }
  return renglones;
}

// Siembra el expediente en el disco del servidor de la montura (datos de
// prueba, como importarPadron): datos.json + entrada del índice fragmentado.
// Después todo el recorrido es por la pantalla.
function sembrarExpediente(datosDir) {
  const SGC = globalThis.SGC;
  const contexto = {
    timestamp: '2026-09-25T12:00:00.000Z',
    email: 'generador.ronda24c3@test.local',
    rol: 'generador',
    equipo: 'PC-PRUEBA-24'
  };
  const base = {
    titulo: 'Expediente con veinte renglones',
    anio: '2026',
    fechaCreacion: '2026-09-25',
    identificacion: {
      numero: ID.slice(5),
      anio: '2026',
      dependenciaSolicitante: 'División Usuario',
      finalidad: 'Reposición de insumos'
    },
    renglones: renglonesDePrueba(20),
    presupuestos: []
  };
  const expediente = SGC.adapters.repo.construirExpediente(base, contexto, ID);
  const dirExp = path.join(datosDir, '2026', ID.slice(5) + '_Expediente');
  fs.mkdirSync(dirExp, { recursive: true });
  fs.writeFileSync(path.join(dirExp, 'datos.json'), JSON.stringify(expediente, null, 2), 'utf8');
  const entrada = SGC.adapters.repo.entradaIndice(ID, expediente, contexto);
  const dirIdx = path.join(datosDir, 'idx');
  fs.mkdirSync(dirIdx, { recursive: true });
  fs.writeFileSync(path.join(dirIdx, ID + '.json'), JSON.stringify(entrada, null, 2), 'utf8');
}

test('RONDA-24 pieza 3 · "Agregar valor" en el renglón 15: campo nuevo, con foco y sin saltar al tope', async function () {
  const m = await am.arrancar({ prefix: 'rp24-c3-' });
  const d = m.documento;
  try {
    sembrarExpediente(m.datos);

    await m.prepararOperador('generador.ronda24c3@test.local', 'Generadora', 'Ronda 24', 'generador');
    assert.match(d.getElementById('sgc-operador-actual').textContent, /generador\.ronda24c3@test\.local/);

    d.getElementById('sgc-nav-tablero').click();
    await m.esperar(() => !d.getElementById('sgc-kanban').hidden, 20000, 'tablero visible');
    await m.esperar(() => !!botonAbrirDelTablero(d, ID), 30000,
      'tarjeta del expediente sembrado en el tablero');
    botonAbrirDelTablero(d, ID).click();
    await m.esperar(() => !d.getElementById('sgc-expediente').hidden &&
      (d.getElementById('sgc-expediente-resumen').textContent || '').indexOf('Estado:') !== -1,
      30000, 'expediente abierto y renderizado');

    const seccion = d.getElementById('sgc-requerimiento-seccion');
    const valores = d.getElementById('sgc-req-valores');
    await m.esperar(() => seccion && !seccion.hidden &&
      valores.querySelectorAll('[data-renglon]').length === 20,
      30000, 'la sección de requerimiento muestra los 20 renglones');

    // Renglón 15 (1-based) = bloque data-indice 14 con la etiqueta "Renglón 15".
    const renglon15 = valores.querySelector('[data-renglon="14"]');
    assert.match(renglon15.querySelector('h4').textContent, /^Renglón 15/,
      'el bloque 15-ésimo es el renglón 15 de la pantalla');
    const botonAgregar = renglon15.querySelector('[data-indice="14"]');
    assert.ok(botonAgregar, 'hay un botón "Agregar valor" en el renglón 15');
    assert.strictEqual(botonAgregar.disabled, false, 'el botón está habilitado (fase editable)');

    // Simula el estado real: la página está caída bien abajo del documento y,
    // al desarmar el bloque, el navegador lleva el scroll al tope. El stub de
    // DOM lo reproduce: vaciar el contenedor colapsa el documento a 0.
    d.scrollingElement.scrollTop = 5000;
    // Cada fila de valores expone un botón "Quitar" (data-quitar): una fila,
    // un botón. Es el contador que el stub de DOM soporta (no hay selectores
    // de clase).
    const filasAntes = renglon15.querySelectorAll('[data-quitar]').length;

    // La app registra el click del "Agregar valor" por delegación en la
    // sección (requerimiento-formulario.js); en la montura el click se emite
    // en ese nodo con el botón real como target (el stub no burbujea y no debe
    // cambiarle el comportamiento a ninguna otra vista).
    seccion.emit('click', { target: botonAgregar });

    const campoNuevo = valores.querySelector('[data-valor="14:' + filasAntes + '"]');
    assert.ok(campoNuevo, 'el campo nuevo del renglón 15 existe tras "Agregar valor"');
    assert.strictEqual(campoNuevo.foco, true, 'el campo nuevo tiene el foco');
    assert.strictEqual(valores.querySelector('[data-renglon="14"]').querySelectorAll('[data-quitar]').length,
      filasAntes + 1, 'el renglón 15 tiene una fila de valores más');
    assert.strictEqual(d.scrollingElement.scrollTop, 5000,
      'el scroll del documento se restaura tras reconstruir el bloque (no vuelve al principio)');
  } finally {
    await m.cerrar();
  }
});