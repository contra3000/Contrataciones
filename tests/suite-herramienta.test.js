'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const suite = require('../tools/suite.js');

const SEIS = [
  'ronda-20.test.js',
  'ronda-21-c6.test.js',
  'transiciones-servidor-matriz.test.js',
  'transiciones-servidor-matriz-2.test.js',
  'presupuestos-servidor.test.js',
  'ronda-25-c3.test.js'
];

function nombres(lista) {
  return lista.map(function (entrada) { return entrada.nombre; });
}

test('los seis archivos de servidor de la tabla quedan en la serie', () => {
  const clasificacion = suite.clasificarSuite();
  const serie = nombres(clasificacion.serie);
  for (const archivo of SEIS) {
    assert.ok(serie.indexOf(archivo) !== -1,
      archivo + ' tiene que correr en serie; la serie es: ' + serie.join(', '));
  }
});

test('un archivo inventado que usa la montura de la aplicación cae en la serie', () => {
  const inventado = path.join(suite.RAIZ, 'tests', 'inventado-suite.test.js');
  const resultado = suite.clasificar(inventado, {
    contenido: "const m = require('./helpers/aplicacion-montura.js');\n"
  });
  assert.strictEqual(resultado.serie, true, 'la montura de la aplicación obliga a la serie');
  assert.match(resultado.motivoTexto, /aplicacion-montura\.js/);
});

test('un archivo inventado que sólo usa el generador cae en paralelo', () => {
  const inventado = path.join(suite.RAIZ, 'tests', 'inventado-generador.test.js');
  const resultado = suite.clasificar(inventado, {
    contenido: "const m = require('./helpers/generador-montura.js');\n"
  });
  assert.strictEqual(resultado.serie, false, 'el generador no levanta servidor');
});

test('ningún archivo se pierde: serie + paralelo son todos los tests', () => {
  const clasificacion = suite.clasificarSuite();
  const todos = clasificacion.todos
    .map(function (archivo) { return path.basename(archivo); })
    .sort();
  const repartidos = nombres(clasificacion.serie).concat(nombres(clasificacion.paralelo)).sort();
  assert.deepStrictEqual(repartidos, todos);
  assert.strictEqual(new Set(repartidos).size, repartidos.length,
    'ningún archivo puede estar en las dos tandas');
});
