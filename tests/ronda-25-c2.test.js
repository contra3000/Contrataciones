'use strict';

/*
 * ronda-25-c2.test.js
 * ORDEN-RONDA-25 pieza 2 · acciones arriba.
 *
 * La sección de acciones del expediente va debajo de la cabecera, antes de
 * todo lo demás: en el DOM precede a las secciones de requerimiento, ANEXO 1
 * y documento. (El control de la auditoría es el mismo sobre app/index.html:
 * la línea de `expediente-acciones` es menor que las otras tres.)
 */

const { test } = require('node:test');
const assert = require('node:assert');

const am = require('./helpers/aplicacion-montura.js');

function idsEnOrden(nodo, salida) {
  if (nodo && nodo.id) {
    salida.push(nodo.id);
  }
  for (const hijo of (nodo.children || [])) {
    idsEnOrden(hijo, salida);
  }
  return salida;
}

test('RONDA-25 pieza 2 · la sección de acciones va debajo de la cabecera y precede a requerimiento, ANEXO 1 y documento', () => {
  am.construirDom();
  const ids = idsEnOrden(am.documento.body, []);
  const acciones = ids.indexOf('sgc-expediente-acciones');
  assert.ok(acciones !== -1, 'la sección de acciones existe en el expediente');
  for (const id of [
    'sgc-requerimiento-seccion',
    'sgc-anexo1-seccion',
    'sgc-expediente-documento-seccion'
  ]) {
    const pos = ids.indexOf(id);
    assert.ok(pos !== -1, 'existe la sección ' + id);
    assert.ok(pos > acciones, 'la sección de acciones precede a ' + id);
  }
});