'use strict';

/*
 * ronda-42-p1.test.js
 * ORDEN-RONDA-42 · pieza 1 · "El rol Abastecimiento: entrar y juntar los
 * requerimientos" (7a, ADR-043).
 *
 * Todo entra por la pantalla del generador: se elige el rol, se eligen los
 * archivos en #sgc-abast-archivos y se mira lo que la pantalla muestra. Los
 * fixtures son los que exportó el revisor con el generador r41-1c112e5 y no se
 * editan: el caso de la huella arma su copia en memoria.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const gm = require('./helpers/generador-montura.js');

let m = null;

before(async () => {
  m = await gm.arrancar();
});

function SGC() {
  return globalThis.SGC;
}

function fixture(nombre) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', nombre), 'utf8');
}

async function entrarComoAbastecimiento() {
  await m.correr();
  m.completarIdentidad();
  m.setear('sgc-generador-nombre', 'Ana');
  m.elegirRol('abastecimiento');
  return m.documento.getElementById('sgc-abastecimiento');
}

function filas() {
  return m.documento.getElementById('sgc-abast-lista').children;
}

function msj() {
  return m.documento.getElementById('sgc-abast-msj');
}

async function elegir(lista) {
  m.elegirRequerimientos(lista);
  await m.esperar(() => {
    const nodo = msj();
    return filas().length > 0 || (nodo && nodo.hidden === false);
  }, 20000, 'la pantalla no contestó a los archivos');
}

test('RONDA-42 pieza 1c-1 · Abastecimiento entra con la identidad completa y sin ella avisa como Usuario', async () => {
  await m.correr();
  m.elegirRol('abastecimiento');

  const error = m.documento.getElementById('sgc-generador-error');
  const seccion = m.documento.getElementById('sgc-abastecimiento');
  assert.strictEqual(error.hidden, false, 'sin identidad avisa');
  assert.strictEqual(error.textContent, 'Elegí el grado.',
    'con el mismo aviso de la identidad que usa el rol Usuario');
  assert.strictEqual(seccion.hidden, true, 'y no abre la sección');

  m.completarIdentidad();
  m.setear('sgc-generador-nombre', 'Ana');
  m.elegirRol('abastecimiento');

  assert.strictEqual(seccion.hidden, false, 'con la identidad completa abre #sgc-abastecimiento');
  assert.strictEqual(m.documento.getElementById('sgc-generador-identidad').hidden, true,
    'y esconde la pantalla de identidad');
  assert.strictEqual(error.hidden, true, 'sin errores');
});

test('RONDA-42 pieza 1c-2 · dos requerimientos exportados: dos filas con dependencia, título, año, moneda y renglones', async () => {
  await entrarComoAbastecimiento();

  await elegir([
    { nombre: 'r42-req-goe.json', contenido: fixture('r42-req-goe.json') },
    { nombre: 'r42-req-gb7.json', contenido: fixture('r42-req-gb7.json') }
  ]);

  assert.strictEqual(filas().length, 2, 'entran las dos filas');
  assert.match(filas()[0].textContent,
    /GOE · Matafuegos y papel GOE · 2026 · ARS · 2 renglones/,
    'la fila de GOE: ' + filas()[0].textContent);
  assert.match(filas()[1].textContent,
    /Grupo Base 7 · Matafuegos Grupo Base 7 · 2026 · ARS · 3 renglones/,
    'la fila del Grupo Base 7: ' + filas()[1].textContent);
  assert.strictEqual(msj().hidden, true, 'sin rechazos');
});

test('RONDA-42 pieza 1c-3 · un avance no entra y el aviso nombra el archivo y que es un avance', async () => {
  await entrarComoAbastecimiento();

  await elegir([{ nombre: 'r42-avance-goe.json', contenido: fixture('r42-avance-goe.json') }]);

  assert.strictEqual(filas().length, 0, 'el avance no se suma a la lista');
  assert.strictEqual(msj().hidden, false, 'el rechazo se ve');
  assert.match(msj().textContent, /r42-avance-goe\.json/,
    'el aviso nombra el archivo: ' + msj().textContent);
  assert.match(msj().textContent, /es un avance: lo tiene que terminar y exportar quien lo pidió/,
    'y dice que es un avance: ' + msj().textContent);
});

test('RONDA-42 pieza 1c-4 · una copia con una cantidad cambiada no entra por la huella', async () => {
  await entrarComoAbastecimiento();

  const copia = JSON.parse(fixture('r42-req-goe.json'));
  copia.expediente.renglones[0].cantidad = copia.expediente.renglones[0].cantidad + 1;

  await elegir([{ nombre: 'copia-modificada.json', contenido: JSON.stringify(copia) }]);

  assert.strictEqual(filas().length, 0, 'el archivo modificado no entra');
  assert.strictEqual(msj().hidden, false, 'el rechazo se ve');
  assert.match(msj().textContent, /copia-modificada\.json/,
    'el aviso nombra el archivo: ' + msj().textContent);
  assert.match(msj().textContent, /modificad[oó] fuera del generador/,
    'y dice que se modificó fuera del generador: ' + msj().textContent);
});

test('RONDA-42 pieza 1c-5 · el mismo archivo dos veces deja una sola fila y avisa que ya estaba', async () => {
  await entrarComoAbastecimiento();

  await elegir([
    { nombre: 'r42-req-goe.json', contenido: fixture('r42-req-goe.json') },
    { nombre: 'r42-req-goe.json', contenido: fixture('r42-req-goe.json') }
  ]);

  assert.strictEqual(filas().length, 1, 'una sola fila');
  assert.strictEqual(msj().hidden, false, 'el aviso se ve');
  assert.match(msj().textContent, /ya está en la lista/,
    'y dice que ya estaba: ' + msj().textContent);
  assert.strictEqual(SGC().generadorAbastecimiento.requerimientos().length, 1,
    'la lista de requerimientos no lo suma dos veces');
});

test('RONDA-42 pieza 1c-6 · "Quitar" saca la fila', async () => {
  await entrarComoAbastecimiento();

  await elegir([{ nombre: 'r42-req-goe.json', contenido: fixture('r42-req-goe.json') }]);
  assert.strictEqual(filas().length, 1, 'entra la fila');

  const boton = filas()[0].querySelector('[data-quitar-req]');
  assert.ok(boton, 'la fila trae su botón Quitar');
  assert.strictEqual(boton.getAttribute('aria-label'),
    'Quitar el requerimiento Matafuegos y papel GOE', 'con su aria-label');
  boton.click();

  assert.strictEqual(filas().length, 0, 'la fila se fue');
  assert.strictEqual(SGC().generadorAbastecimiento.requerimientos().length, 0,
    'y no queda en la lista');
});
