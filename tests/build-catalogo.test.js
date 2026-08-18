'use strict';

/*
 * build-catalogo.test.js
 * Verifica el generador de fragmentos (ORDEN-RONDA-04 §3.6 puntos 1 a 4 y
 * ORDEN-RONDA-05 §2.2). Corre el build real contra el fixture versionado
 * tests/fixtures/catalogo-muestra.json en carpetas temporales de os.tmpdir()
 * y compara byte a byte. Así pasa en un clon recién hecho, sin archivos
 * externos. La verificación de las 159.366 filas contra el catálogo completo
 * se saltea con un aviso si datos-prueba/catalogo_incisos.json no está.
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
const FIXTURE = path.join(__dirname, 'fixtures', 'catalogo-muestra.json');
const COMPLETO = path.join(RAIZ, 'datos-prueba', 'catalogo_incisos.json');
const LIMITE_FRAGMENTO = 300 * 1024;

let dirA = null;
let dirB = null;
let esperado = null;

function ejecutarBuild(salida, entrada) {
  const res = spawnSync(NODE, [BUILD, '--entrada', entrada, '--salida', salida], {
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

function leerJson(ruta) {
  return JSON.parse(fs.readFileSync(ruta, 'utf8'));
}

function conteosDelFixture() {
  const datos = leerJson(FIXTURE);
  const rubros = new Set(datos.map((r) => r.rubro));
  const clases = new Set(datos.map((r) => r.rubro + '\u0000' + r.clase));
  return { registros: datos.length, rubros: rubros.size, clases: clases.size };
}

before(() => {
  assert.ok(fs.existsSync(FIXTURE), 'el fixture debe existir: ' + FIXTURE);
  esperado = conteosDelFixture();
  dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-catalogo-A-'));
  dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-catalogo-B-'));
  ejecutarBuild(dirA, FIXTURE);
});

after(() => {
  for (const dir of [dirA, dirB]) {
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('el fixture cumple los requisitos de la muestra (ORDEN-RONDA-05 §2.2)', () => {
  const datos = leerJson(FIXTURE);
  assert.ok(datos.length >= 400 && datos.length <= 800, 'muestra de ~500 registros reales');
  assert.ok(datos.every((r) => typeof r.codigo === 'string' && typeof r.rubro === 'string' &&
    typeof r.clase === 'string' && typeof r.item === 'string'), 'registros con los campos esperados');
  const rubros = new Set(datos.map((r) => r.rubro));
  assert.ok(rubros.size >= 5, 'al menos cinco rubros distintos');
  const conAcento = datos.filter((r) => /[\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1]/i.test(r.clase));
  assert.ok(conAcento.length > 0, 'alguna clase con acentos');
  const porClase = {};
  for (const r of datos) {
    const clave = r.rubro + '\u0000' + r.clase;
    porClase[clave] = (porClase[clave] || 0) + 1;
  }
  const mayor = Math.max.apply(null, Object.keys(porClase).map((k) => porClase[k]));
  assert.ok(mayor >= 100, 'alguna clase grande');
});

test('el build produce manifiesto con catalogoVersion y conteos del fixture', () => {
  const manifiesto = leerJson(path.join(dirA, 'manifiesto.json'));
  assert.ok(/^[0-9a-f]{8}$/.test(manifiesto.catalogoVersion), 'catalogoVersion debe ser un hash de 8 hex');
  assert.strictEqual(manifiesto.registros, esperado.registros);
  assert.strictEqual(manifiesto.rubros, esperado.rubros);
  assert.strictEqual(manifiesto.clases, esperado.clases);

  const rubros = leerJson(path.join(dirA, 'rubros.json'));
  assert.strictEqual(rubros.length, esperado.rubros);
  const clases = leerJson(path.join(dirA, 'clases.json'));
  assert.strictEqual(clases.length, esperado.clases);
  assert.ok(clases.every((e) => Array.isArray(e) && e.length === 5), 'cada clase debe ser [idClase, idRubro, clase, cantidad, partes]');
});

test('el build descarta el campo estado y los fragmentos suman los registros del fixture', () => {
  const dirItems = path.join(dirA, 'items');
  let suma = 0;
  const archivos = fs.readdirSync(dirItems);
  assert.ok(archivos.length >= esperado.clases, 'debe haber al menos un fragmento por clase');
  for (const nombre of archivos) {
    const texto = fs.readFileSync(path.join(dirItems, nombre), 'utf8');
    assert.ok(texto.indexOf('"estado"') === -1, nombre + ' no debe contener el campo estado');
    suma += JSON.parse(texto).length;
  }
  assert.strictEqual(suma, esperado.registros);
});

test('ningún fragmento supera ' + LIMITE_FRAGMENTO + ' bytes', () => {
  const dirItems = path.join(dirA, 'items');
  let max = 0;
  for (const nombre of fs.readdirSync(dirItems)) {
    const tamanio = fs.statSync(path.join(dirItems, nombre)).size;
    if (tamanio > max) {
      max = tamanio;
    }
  }
  assert.ok(max <= LIMITE_FRAGMENTO, 'el fragmento más grande es de ' + max + ' bytes');
});

test('el build es determinista: dos corridas producen archivos byte a byte idénticos', () => {
  ejecutarBuild(dirB, FIXTURE);
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

test('la verificación del catálogo completo (159.366 filas) se saltea con aviso si falta el archivo', (t) => {
  if (!fs.existsSync(COMPLETO)) {
    t.skip('datos-prueba/catalogo_incisos.json no está presente en este clon; la verificación contra el catálogo completo no corre acá.');
    return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-catalogo-C-'));
  try {
    ejecutarBuild(dir, COMPLETO);
    const manifiesto = leerJson(path.join(dir, 'manifiesto.json'));
    assert.strictEqual(manifiesto.registros, 159366);
    assert.strictEqual(manifiesto.rubros, 50);
    let suma = 0;
    const dirItems = path.join(dir, 'items');
    for (const nombre of fs.readdirSync(dirItems)) {
      suma += JSON.parse(fs.readFileSync(path.join(dirItems, nombre), 'utf8')).length;
    }
    assert.strictEqual(suma, 159366);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});