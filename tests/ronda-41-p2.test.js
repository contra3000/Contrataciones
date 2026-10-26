'use strict';

/*
 * ronda-41-p2.test.js
 * RONDA-41 · pieza 2 · "Los pasos se clickean"
 * (ORDEN-RONDA-41 pieza 2).
 *
 * En el generador, la barra de pasos dejó de ser texto: cada paso es un
 * <button type="button" data-ir-paso="...">. El clic burbujea hasta #sgc-pasos
 * y la vista sincroniza el formulario y navega sin validar, igual que
 * "Anterior". "Siguiente" sigue validando como hoy.
 *
 * El stub del DOM no burbujea eventos, así que el clic de un botón se emite en
 * #sgc-pasos con `target` apuntando al botón, que es lo que hace el navegador
 * cuando el clic sube desde el <button> hasta el <ol>.
 */

const { test, before } = require('node:test');
const assert = require('node:assert');

const gm = require('./helpers/generador-montura.js');

const TITULO = 'Insumos de papelería';

let m = null;

before(async () => {
  m = await gm.arrancar();
});

function SGC() {
  return globalThis.SGC;
}

function pasoVisible() {
  const d = m.documento;
  return ['identificacion', 'renglones', 'fundamentacion', 'revision']
    .find((p) => !d.getElementById('sgc-paso-' + p).hidden);
}

function botonDePaso(id) {
  return m.documento.getElementById('sgc-pasos')
    .querySelector('[data-ir-paso="' + id + '"]');
}

function clickEnPaso(id) {
  const boton = botonDePaso(id);
  if (!boton) {
    throw new Error('no existe el botón del paso ' + id);
  }
  m.documento.getElementById('sgc-pasos').emit('click', { target: boton });
  return boton;
}

async function entrarComoUsuario() {
  await m.correr();
  await m.esperar(() => {
    const est = SGC().catalogo.carga.obtenerEstado();
    return !!(est.manifiesto && est.rubros && est.clases);
  }, 30000, 'el catálogo no llegó');
  m.setear('sgc-generador-nombre', 'Ana Pérez');
  m.completarIdentidad();
  m.elegirRol('generador');
  await m.esperar(() => SGC().generadorValores, 20000, 'el rol Usuario montado');
}

test('RONDA-41 pieza 2-1 · desde Identificación vacía, un clic en "4 · Revisión" va a Revisión con aria-current y no exporta', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  assert.strictEqual(pasoVisible(), 'identificacion', 'arranca en Identificación');

  const boton = clickEnPaso('revision');
  assert.strictEqual(boton.tag, 'button', 'el paso es un botón');
  assert.strictEqual(boton.getAttribute('type'), 'button',
    'con type=button, para que no envíe formularios');
  assert.strictEqual(pasoVisible(), 'revision', 'el clic lleva directo a Revisión');

  const li = d.getElementById('sgc-pasos').querySelector('[data-paso="revision"]');
  assert.strictEqual(li.getAttribute('aria-current'), 'step',
    'el paso actual queda con aria-current=step');

  const exportar = d.getElementById('sgc-btn-exportar');
  const msj = d.getElementById('sgc-exportar-msj');
  assert.strictEqual(exportar.disabled, true, 'con la Identificación vacía no exporta');
  assert.match(msj.textContent, /Todavía no se puede exportar\. Falta:/,
    'y dice qué falta: ' + msj.textContent);
});

test('RONDA-41 pieza 2-2 · desde Revisión, "2 · Renglones" vuelve a Renglones', async () => {
  await entrarComoUsuario();
  clickEnPaso('revision');
  assert.strictEqual(pasoVisible(), 'revision', 'primero va a Revisión');

  clickEnPaso('renglones');
  assert.strictEqual(pasoVisible(), 'renglones', 'y el clic vuelve a Renglones');
});

test('RONDA-41 pieza 2-3 · lo escrito no se pierde: el título sobrevive a ir al 3 y volver al 1', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  m.escribir('sgc-titulo', TITULO);

  clickEnPaso('fundamentacion');
  assert.strictEqual(pasoVisible(), 'fundamentacion', 'va al paso 3');
  clickEnPaso('identificacion');
  assert.strictEqual(pasoVisible(), 'identificacion', 'y vuelve al paso 1');

  assert.strictEqual(d.getElementById('sgc-titulo').value, TITULO,
    'el título sigue escrito en el formulario');
  assert.strictEqual(SGC().views.wizard.datos().identificacion.titulo, TITULO,
    'y el asistente lo sincronizó antes de navegar');
});

test('RONDA-41 pieza 2-4 · con Tab se llega a cada botón y con Enter se va al paso', async () => {
  const d = m.documento;
  await entrarComoUsuario();

  const boton = botonDePaso('revision');
  boton.focus();
  assert.strictEqual(d.activeElement, boton,
    'el botón recibe el foco (se llega con Tab)');

  // Enter en un <button> dispara su clic, que burbujea hasta #sgc-pasos.
  d.getElementById('sgc-pasos').emit('click', { target: boton });
  assert.strictEqual(pasoVisible(), 'revision',
    'y con Enter (el clic del botón) se va al paso');
});

test('RONDA-41 pieza 2-5 · "Siguiente" sigue frenando con la Identificación vacía', async () => {
  const d = m.documento;
  await entrarComoUsuario();
  assert.strictEqual(pasoVisible(), 'identificacion', 'arranca en Identificación');

  d.getElementById('sgc-siguiente').click();
  assert.strictEqual(pasoVisible(), 'identificacion',
    '"Siguiente" no deja avanzar sin los datos');

  const error = d.getElementById('sgc-error-titulo');
  assert.strictEqual(error.hidden, false, 'y marca el título que falta');
  assert.match(error.textContent, /título/i, 'con el motivo: ' + error.textContent);
});
