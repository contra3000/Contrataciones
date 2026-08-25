'use strict';

/*
 * catalogo.test.js
 * Ejercita SGC.catalogo.indice y la composición de renglones contra el
 * catálogo real generado en app/catalogo (ORDEN-RONDA-04 §3.6, puntos 5 a 8).
 */

const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const CAT = path.join(RAIZ, 'app', 'catalogo');

require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'config.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'cotas-encabezado.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'anexo-eett.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'validacion.js'));
require(path.join(RAIZ, 'app', 'js', 'catalogo', 'indice.js'));

const SGC = globalThis.SGC;

let clases = [];

function leerFragmento(idClase) {
  const entrada = clases.filter((e) => e[0] === idClase)[0];
  const partes = entrada ? entrada[4] : 1;
  let items = [];
  for (let p = 1; p <= partes; p++) {
    const nombre = partes === 1 ? String(idClase) + '.json' : String(idClase) + '_p' + p + '.json';
    items = items.concat(JSON.parse(fs.readFileSync(path.join(CAT, 'items', nombre), 'utf8')));
  }
  return items;
}

before(() => {
  const rubros = JSON.parse(fs.readFileSync(path.join(CAT, 'rubros.json'), 'utf8'));
  clases = JSON.parse(fs.readFileSync(path.join(CAT, 'clases.json'), 'utf8'));
  SGC.catalogo.indice.montar({ rubros: rubros, clases: clases });
});

test('buscarClases("valvula") encuentra clases con VÁLVULA sin acentos ni mayúsculas', () => {
  const resultados = SGC.catalogo.indice.buscarClases('valvula', 20);
  assert.ok(resultados.length > 0, 'debe haber resultados');
  assert.ok(resultados.some((r) => r.clase.indexOf('VALVULAS') !== -1), 'debe incluir clases con VALVULAS');
});

test('la búsqueda ignora los acentos', () => {
  const conAcento = SGC.catalogo.indice.buscarClases('baño', 5);
  const sinAcento = SGC.catalogo.indice.buscarClases('bano', 5);
  assert.ok(conAcento.length > 0);
  assert.strictEqual(conAcento.length, sinAcento.length);
  assert.ok(conAcento.some((r) => r.clase === 'ALQ. DE BAÑO QUIMICO'));
  assert.ok(sinAcento.some((r) => r.clase === 'ALQ. DE BAÑO QUIMICO'));
});

test('la búsqueda ignora las mayúsculas', () => {
  const resultados = SGC.catalogo.indice.buscarClases('GARRAPIÑADAS', 3);
  assert.ok(resultados.length > 0);
  assert.strictEqual(resultados[0].clase, 'GARRAPIÑADAS');
});

test('buscarClases devuelve tramos de coincidencia válidos sobre resultado.clase', () => {
  const resultados = SGC.catalogo.indice.buscarClases('valvula', 10);
  const encontrada = resultados.filter((r) => r.clase === 'VALVULAS P/ELECTRONICA')[0];
  assert.ok(encontrada, 'debe encontrar VALVULAS P/ELECTRONICA');
  // El contrato (ORDEN-RONDA-05 §2.1): los tramos son índices de `clase`,
  // no del texto combinado rubro + clase.
  assert.deepStrictEqual(encontrada.coincidencias, [[0, 7]]);
  for (const [ini, lar] of encontrada.coincidencias) {
    assert.ok(ini >= 0 && ini + lar <= encontrada.clase.length,
      'tramo fuera de rango de la clase: [' + ini + ',' + lar + '] en "' + encontrada.clase + '"');
    const fragmento = encontrada.clase.slice(ini, ini + lar).normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase();
    assert.strictEqual(fragmento, 'valvula', 'el fragmento resaltado debe ser el término buscado');
  }
});

test('los tramos de coincidencia son índices válidos de clase sobre el catálogo real', () => {
  const terminos = ['valvula', 'termostato', 'cable', 'bano', 'electronica', 'manguera', 'filtro', 'galletita'];
  for (const termino of terminos) {
    const resultados = SGC.catalogo.indice.buscarClases(termino, 30);
    assert.ok(resultados.length > 0, 'sin resultados para "' + termino + '"');
    for (const r of resultados) {
      for (const [ini, lar] of r.coincidencias) {
        assert.ok(ini >= 0 && ini + lar <= r.clase.length,
          'tramo fuera de rango de clase para "' + termino + '": [' + ini + ',' + lar + '] en "' + r.clase + '"');
      }
      for (const [ini, lar] of r.coincidenciasRubro) {
        assert.ok(ini >= 0 && ini + lar <= r.rubro.length,
          'tramo fuera de rango de rubro para "' + termino + '": [' + ini + ',' + lar + '] en "' + r.rubro + '"');
      }
    }
  }
});

test('una clase conocida devuelve la cantidad de ítems que declara clases.json', () => {
  const resultados = SGC.catalogo.indice.buscarClases('termostatos p/calef', 3);
  assert.ok(resultados.length > 0);
  const clase = resultados[0];
  const items = JSON.parse(fs.readFileSync(path.join(CAT, 'items', clase.idClase + '.json'), 'utf8'));
  assert.strictEqual(items.length, clase.cantidad);
});

test('una clase partida mantiene la cantidad total entre sus partes', () => {
  const clasePartida = clases.filter((e) => e[4] > 1)[0];
  assert.ok(clasePartida, 'debe existir al menos una clase partida');
  const idClase = clasePartida[0];
  const cantidad = clasePartida[3];
  const partes = clasePartida[4];
  let total = 0;
  for (let p = 1; p <= partes; p++) {
    const items = JSON.parse(fs.readFileSync(path.join(CAT, 'items', idClase + '_p' + p + '.json'), 'utf8'));
    total += items.length;
  }
  assert.strictEqual(total, cantidad);
});

test('buscarEnItems filtra y devuelve los ítems de una clase cargada', () => {
  const resultados = SGC.catalogo.indice.buscarClases('valvulas', 3);
  const clase = resultados[0];
  const items = leerFragmento(clase.idClase);
  const todos = SGC.catalogo.indice.buscarEnItems('', items, 5);
  assert.ok(todos.length > 0);
  assert.deepStrictEqual(todos[0].coincidencias, []);
  assert.strictEqual(todos[0].codigo, items[0].codigo);
});

test('un renglón con un código que no existe en el catálogo se rechaza', () => {
  const resultados = SGC.catalogo.indice.buscarClases('valvulas', 3);
  const items = leerFragmento(resultados[0].idClase);
  SGC.catalogo.indice.registrarCodigos(items);
  assert.strictEqual(SGC.catalogo.indice.codigoExiste(items[0].codigo, items), true);
  assert.strictEqual(SGC.catalogo.indice.codigoExiste(items[0].codigo), true);

  const fantasma = '99.9-9999.9';
  assert.strictEqual(SGC.catalogo.indice.codigoExiste(fantasma, items), false);
  assert.strictEqual(SGC.catalogo.indice.codigoExiste(fantasma), false);

  const forma = SGC.core.validacion.validarRenglon({
    codigo: fantasma,
    cantidad: 1,
    unidad: 'u'
  });
  assert.strictEqual(forma.valido, true, 'la forma del renglón es válida');
  const errores = [];
  if (forma.valido && !SGC.catalogo.indice.codigoExiste(fantasma)) {
    errores.push('El código no existe en el catálogo');
  }
  assert.strictEqual(errores.length, 1, 'la composición rechaza el código inexistente');
});
