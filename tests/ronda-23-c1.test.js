'use strict';

/*
 * ronda-23-c1.test.js
 * ORDEN-RONDA-23 §1: el texto de ayuda de la aclaración es un párrafo VISIBLE
 * en la pantalla del renglón (no un atributo que sólo ve el mouse), dice lo que
 * el Jefe de Contrataciones pidió y no valida ni traba nada. Se comprueba sobre
 * el DOM que arma SGC.catalogo.renglones, sin innerHTML (ADR-011).
 */

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const { documento, obtenerConteoInnerHTML } = require('./helpers/dom-stub.js');

const RAIZ = path.join(__dirname, '..');
require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'config.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'validacion.js'));
require(path.join(RAIZ, 'app', 'js', 'catalogo', 'renglones.js'));

const SGC = globalThis.SGC;

function buscarPorClase(nodo, clase) {
  if (String(nodo.className).split(/\s+/).indexOf(clase) !== -1) {
    return nodo;
  }
  for (const hijo of nodo.children) {
    const encontrado = buscarPorClase(hijo, clase);
    if (encontrado) {
      return encontrado;
    }
  }
  return null;
}

test('§1 la ayuda de la aclaración es un párrafo visible en el renglón', () => {
  globalThis.document = documento;
  SGC.catalogo.indice = { codigoExiste: () => true };
  const lista = documento.createElement('ul');
  const resumen = documento.createElement('p');
  SGC.catalogo.renglones.montar({ listaRenglones: lista, resumen });
  SGC.catalogo.renglones.agregar({ codigo: '2.1.1-439.101', item: 'Resma A4' });

  const ayuda = buscarPorClase(lista, 'ayuda-aclaracion');
  assert.ok(ayuda, 'la ayuda está en la fila del renglón');
  assert.equal(ayuda.tag, 'p', 'es un párrafo de texto, no un globito');
  assert.equal(ayuda.hidden, false, 'está visible');
  assert.equal(ayuda.getAttribute('title'), null, 'no se esconde en un title');
  assert.ok(/No repita la descripción/.test(ayuda.textContent),
    'dice que no se repita la descripción');
  assert.ok(/parámetros técnicos exigibles/.test(ayuda.textContent),
    'pide los parámetros técnicos exigibles');
  assert.ok(/marcas/.test(ayuda.textContent), 'advierte sobre nombrar marcas');
  assert.equal(obtenerConteoInnerHTML(), 0, 'la ayuda se monta sin innerHTML');
});

test('§1 la ayuda no es una traba: sin aclaración el renglón es válido', () => {
  globalThis.document = documento;
  SGC.catalogo.indice = { codigoExiste: () => true };
  const lista = documento.createElement('ul');
  const resumen = documento.createElement('p');
  SGC.catalogo.renglones.montar({ listaRenglones: lista, resumen });
  SGC.catalogo.renglones.agregar({ codigo: '2.1.1-439.101', item: 'Resma A4' });
  const renglones = SGC.catalogo.renglones.obtener();
  assert.equal(renglones[0].aclaracion, '', 'la aclaración arranca vacía');
  assert.deepEqual(
    SGC.catalogo.renglones.erroresDeRenglon(
      { codigo: '2.1.1-439.101', cantidad: 1, unidad: 'UN', aclaracion: '' }),
    [],
    'la falta de aclaración no es un error');
});
