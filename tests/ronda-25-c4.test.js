'use strict';

/*
 * ronda-25-c4.test.js
 * ORDEN-RONDA-25 pieza 4 · imprimir sin hojas en blanco.
 *
 * 1) Mecanismo de impresión: bajo `@media print`, en cada nivel del árbol la
 *    única rama que se conserva es la que lleva al documento;
 *    `body.imprimiendo` deja `display: none` en todo lo demás (el documento lo
 *    excluyen los `:not(...)`). Nada de `visibility: hidden` (eso conserva el
 *    layout y estiraba las hojas en blanco al final del PDF real).
 * 2) Estructura: la rama que el CSS conserva existe tal cual en el DOM de
 *    app/index.html — body > #app > #sgc-expediente >
 *    #sgc-expediente-documento-seccion > #sgc-expediente-documento — y tiene
 *    secciones ajenas (a ocultar) en cada uno de los tres niveles.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const am = require('./helpers/aplicacion-montura.js');

const CSS = fs.readFileSync(path.join(am.APP_DIR, 'css', 'impresion.css'), 'utf8');

function bloqueMediaPrint(css) {
  const inicio = css.indexOf('@media print');
  if (inicio === -1) {
    return null;
  }
  const apertura = css.indexOf('{', inicio);
  if (apertura === -1) {
    return null;
  }
  let prof = 1;
  let i = apertura + 1;
  while (i < css.length && prof > 0) {
    if (css[i] === '{') {
      prof++;
    } else if (css[i] === '}') {
      prof--;
    }
    i++;
  }
  return css.slice(apertura + 1, i - 1);
}

// Recorre el árbol y devuelve los ids de la ruta real hasta el nodo con `id`.
function caminoHasta(nodo, id, acumulado) {
  const siguiente = acumulado.concat(nodo.id ? [nodo.id] : []);
  if (nodo.id === id) {
    return siguiente;
  }
  for (const hijo of nodo.children) {
    const res = caminoHasta(hijo, id, siguiente);
    if (res) {
      return res;
    }
  }
  return null;
}

function idsHijos(nodo) {
  return (nodo.children || []).map((h) => h.id).filter(Boolean);
}

test('RONDA-25 pieza 4 · al imprimir, las secciones ajenas al documento quedan display:none', () => {
  const bloque = bloqueMediaPrint(CSS);
  assert.ok(bloque, 'impresion.css tiene un bloque @media print');

  assert.ok(
    bloque.indexOf('body.imprimiendo > #app > *:not(#sgc-expediente)') !== -1,
    'se ocultan las secciones ajenas fuera del expediente');
  assert.ok(
    bloque.indexOf('body.imprimiendo #sgc-expediente > *:not(#sgc-expediente-documento-seccion)') !== -1,
    'dentro del expediente sólo queda la sección del documento');
  assert.ok(
    bloque.indexOf('body.imprimiendo #sgc-expediente-documento-seccion > *:not(#sgc-expediente-documento)') !== -1,
    'en la sección del documento sólo queda el documento');

  assert.ok(!/visibility/.test(bloque),
    'ya no se esconde con visibility: hidden (dejaba páginas en blanco)');

  const reglasNone = bloque.match(/display\s*:\s*none\s*;/g) || [];
  assert.ok(reglasNone.length >= 3,
    'hay por lo menos tres reglas display:none en @media print');
});

test('RONDA-25 pieza 4 · la rama del @media print existe en el DOM con secciones ajenas en cada nivel', () => {
  am.construirDom();
  const d = am.documento;

  assert.ok(d.getElementById('sgc-expediente-documento'), 'existe el documento imprimible');
  assert.deepStrictEqual(
    caminoHasta(d.body, 'sgc-expediente-documento', []),
    ['app', 'sgc-expediente', 'sgc-expediente-documento-seccion', 'sgc-expediente-documento'],
    'la rama que el CSS conserva es exactamente la del documento');

  // Nivel 1 · afuera del expediente, dentro de #app.
  const idsApp = idsHijos(d.getElementById('app'));
  for (const id of ['sgc-tablero-nav', 'sgc-seleccion-operador', 'sgc-app',
    'sgc-kanban', 'sgc-padron']) {
    assert.ok(idsApp.indexOf(id) !== -1, '#app tiene la sección ajena ' + id);
  }
  assert.ok(idsApp.indexOf('sgc-expediente') !== -1,
    '#app contiene el expediente (la rama que se conserva)');

  // Nivel 2 · dentro del expediente, ajenas a la sección del documento.
  const idsExp = idsHijos(d.getElementById('sgc-expediente'));
  for (const id of ['sgc-expediente-acciones', 'sgc-requerimiento-seccion',
    'sgc-anexo1-seccion']) {
    assert.ok(idsExp.indexOf(id) !== -1, '#sgc-expediente tiene la sección ajena ' + id);
  }
  assert.ok(idsExp.indexOf('sgc-expediente-documento-seccion') !== -1,
    '#sgc-expediente contiene la sección del documento');

  // Nivel 3 · dentro de la sección del documento, ajenas al propio documento.
  const docSeccion = d.getElementById('sgc-expediente-documento-seccion');
  const idsDoc = idsHijos(docSeccion);
  for (const id of ['sgc-expediente-entregables-bloque', 'sgc-expediente-documento-msj']) {
    assert.ok(idsDoc.indexOf(id) !== -1, 'la sección del documento tiene el bloque ajeno ' + id);
  }
  assert.ok(docSeccion.children.some((h) => h.tag === 'h3'),
    'la sección del documento tiene su título (ajeno al imprimir)');
  const accionesDoc = docSeccion.children.find((h) => h.className === 'documento-acciones');
  assert.ok(accionesDoc && idsHijos(accionesDoc).indexOf('sgc-expediente-documento-imprimir') !== -1,
    'los controles del documento son ajenos a la hoja impresa');
});