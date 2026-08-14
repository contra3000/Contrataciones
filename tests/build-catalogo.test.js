'use strict';

/*
 * build-catalogo.test.js
 * Verifica el generador de fragmentos (ORDEN-RONDA-04 §3.6, puntos 1 a 4).
 * Corre el build real dos veces sobre datos-prueba/catalogo_incisos.json en
 * carpetas temporales de os.tmpdir() y compara byte a byte.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const NODE = process.execPath;
const BUILD = path.join(RAIZ, 'tools', 'build-catalogo.js');
const ENTRADA = path.join(RAIZ, 'datos-prueba', 'catalogo_incisos.json');
const LIMITE_FRAGMENTO = 300 * 1024;
const REGISTROS_ESPERADOS = 159366;

let dirA = null;
let dirB = null;

function ejecutarBuild(salida) {
  const res = spawnSync(NODE, [BUILD, '--entrada', ENTRADA, '--salida', salida], {
    encoding: 'utf8',
    timeout: 180000
  });
  assert.strictEqual(res.status, 0, 'el build falló:\n' + res.stdout + res.stderr);
  return res.stdout;
}

function listar(dir) {
  const salida = [];
  const pila = [dir];
  while (pila.length > 0) {
    const actual = pila.pop();
    for (const entrada of fs.readdirSync(actual, { withFileTypes: true })) {
      const ruta = path.join(actual, entrada.name);
      if (entrada.isDirectory()) {
        pila.push(ruta);
      } else {
        salida.push(ruta);
      }
    }
  }
  return salida.sort();
}

before(() => {
  dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-catalogo-A-'));
  dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-catalogo-B-'));
  ejecutarBuild(dirA);
});

after(() => {
  for (const dir of [dirA, dirB]) {
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('el build produce manifiesto con catalogoVersion y rubros/clases esperados', () => {
  const manifiesto = JSON.parse(fs.readFileSync(path.join(dirA, 'manifiesto.json'), 'utf8'));
  assert.ok(/^[0-9a-f]{8}$/.test(manifiesto.catalogoVersion), 'catalogoVersion debe ser un hash de 8 hex');
  assert.strictEqual(manifiesto.registros, REGISTROS_ESPERADOS);
  assert.strictEqual(manifiesto.rubros, 50);
  assert.strictEqual(manifiesto.clases, 6909);

  const rubros = JSON.parse(fs.readFileSync(path.join(dirA, 'rubros.json'), 'utf8'));
  assert.strictEqual(rubros.length, 50);
  const clases = JSON.parse(fs.readFileSync(path.join(dirA, 'clases.json'), 'utf8'));
  assert.strictEqual(clases.length, 6909);
  assert.ok(clases.every((e) => Array.isArray(e) && e.length === 5), 'cada clase debe ser [idClase, idRubro, clase, cantidad, partes]');
});

test('el build descarta el campo estado y la suma de ítems de los fragmentos es exactamente 159366', () => {
  const dirItems = path.join(dirA, 'items');
  let suma = 0;
  const archivos = fs.readdirSync(dirItems);
  assert.ok(archivos.length >= 6909, 'debe haber al menos un fragmento por clase');
  for (const nombre of archivos) {
    const texto = fs.readFileSync(path.join(dirItems, nombre), 'utf8');
    assert.ok(texto.indexOf('"estado"') === -1, nombre + ' no debe contener el campo estado');
    const items = JSON.parse(texto);
    suma += items.length;
  }
  assert.strictEqual(suma, REGISTROS_ESPERADOS);
});

test('ningún fragmento supera 300 KB', () => {
  const dirItems = path.join(dirA, 'items');
  let max = 0;
  let nombreMax = '';
  for (const nombre of fs.readdirSync(dirItems)) {
    const tamanio = fs.statSync(path.join(dirItems, nombre)).size;
    if (tamanio > max) {
      max = tamanio;
      nombreMax = nombre;
    }
  }
  assert.ok(max <= LIMITE_FRAGMENTO, 'el fragmento más grande (' + nombreMax + ') es de ' + max + ' bytes');
});

test('el build es determinista: dos corridas producen archivos byte a byte idénticos', () => {
  ejecutarBuild(dirB);
  const archivosA = listar(dirA);
  const archivosB = listar(dirB);
  assert.strictEqual(archivosA.length, archivosB.length, 'ambas corridas deben producir la misma cantidad de archivos');
  for (let i = 0; i < archivosA.length; i++) {
    const relA = path.relative(dirA, archivosA[i]);
    const relB = path.relative(dirB, archivosB[i]);
    assert.strictEqual(relA, relB, 'los conjuntos de archivos deben coincidir');
    const bytesA = fs.readFileSync(archivosA[i]);
    const bytesB = fs.readFileSync(archivosB[i]);
    assert.ok(bytesA.equals(bytesB), 'difiere: ' + relA);
  }
});
