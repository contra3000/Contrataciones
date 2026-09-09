'use strict';

/*
 * ronda-19-estructural.test.js
 * ORDEN-RONDA-19 §5.2: comprobación estructural como TEST. Verifica que el
 * arreglo del bug ("El operador es obligatorio") quedó en el cableado de la
 * aplicación y no como un parche aislado:
 *
 *   1. análisis estático del código de app/js/app.js (las llamadas reales a
 *      las nueve vistas en operadorSeleccionado y el paso de repoActual),
 *   2. registro de los módulos de la app al cargarlos tal como los carga el
 *      navegador, y
 *   3. arranque real de la aplicación (detectarModo → ingreso) como humo.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const am = require('./helpers/aplicacion-montura.js');

const CODIGO_APP = fs.readFileSync(
  path.join(am.APP_DIR, 'js', 'app.js'), 'utf8');

const VISTAS_CON_SELECTOR = {
  expediente: 'seleccionarOperador',
  exportar: 'seleccionarOperador',
  requerimientoFormulario: 'seleccionarOperador',
  anexoUno: 'seleccionarOperador',
  usarBase: 'fijarOperador',
  sugerencias: 'fijarOperador',
  sugerenciasJefe: 'fijarOperador',
  padronAdmin: 'fijarOperador',
  wizard: 'seleccionarOperador'
};

test('§5.2 estructural · operadorSeleccionado cablea las nueve vistas con el repo',
  function () {
    for (const nombre of Object.keys(VISTAS_CON_SELECTOR)) {
      assert.ok(
        CODIGO_APP.indexOf('SGC.views.' + nombre + '.' + VISTAS_CON_SELECTOR[nombre] + '(') !== -1,
        'operadorSeleccionado llama a ' + nombre + '.' + VISTAS_CON_SELECTOR[nombre]);
    }
    assert.ok(CODIGO_APP.indexOf('repoActual = repo;') !== -1,
      'el repo se guarda en repoActual durante iniciar');
    assert.ok(
      CODIGO_APP.indexOf(
        'SGC.views.wizard.seleccionarOperador(operador, repoActual);') !== -1,
      'el arreglo del bug pasa repoActual a seleccionarOperador');
    assert.ok(CODIGO_APP.indexOf('repoActual = null;') !== -1,
      'repoActual se declara en el ámbito de app.js');
  });

test('§5.2 estructural · la app registra sus vistas y el borrador tiene firma',
  function () {
    am.cargarModulos();
    const vistas = [
      'wizard', 'kanban', 'expediente', 'archivo', 'usarBase', 'exportar',
      'requerimientoFormulario', 'anexoUno', 'sugerencias', 'sugerenciasJefe',
      'padronAdmin', 'ingreso', 'cambioClave'
    ];
    for (const nombre of vistas) {
      assert.strictEqual(typeof globalThis.SGC.views[nombre].montar, 'function',
        'SGC.views.' + nombre + '.montar es función');
    }
    for (const metodo of ['guardar', 'leer', 'limpiar', 'validarForma', 'operadorDe']) {
      assert.strictEqual(typeof globalThis.SGC.views.borrador[metodo], 'function',
        'SGC.views.borrador.' + metodo + ' es función');
    }
    assert.strictEqual(typeof globalThis.SGC.views.pasos.persistir, 'function',
      'SGC.views.pasos.persistir es función');
    assert.strictEqual(typeof globalThis.SGC.catalogo.buscador.montar, 'function',
      'el buscador está registrado');
    assert.strictEqual(typeof globalThis.SGC.catalogo.renglones.obtener, 'function',
      'los renglones están registrados');
    assert.strictEqual(typeof globalThis.SGC.catalogo.carga.iniciar, 'function',
      'la carga del catálogo está registrada');
    assert.strictEqual(typeof globalThis.SGC.adapters.sesion.ingresar, 'function',
      'el adaptador de sesión está registrado');
    assert.strictEqual(typeof globalThis.SGC.views.pasos.persistir, 'function',
      'las secciones de pasos están registradas');
  });

test('§5.2 estructural · la aplicación arranca real (detectarModo → ingreso)',
  async function () {
    const m = await am.arrancar({ prefix: 'rp19e-' });
    try {
      const d = m.documento;
      m.correr();
      await m.esperar(() => !d.getElementById('sgc-ingreso').hidden, 20000,
        'pantalla de ingreso visible');
      assert.strictEqual(d.getElementById('sgc-app-error').hidden, true,
        'arranque sin errores globales');
    } finally {
      await m.cerrar();
    }
  });