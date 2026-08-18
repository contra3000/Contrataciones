'use strict';

/*
 * servidor-ayudantes.test.js
 * Tests de server/servidor.js que no levantan la API: helpers exportados
 * (escritura atómica y lock de numeración, ADR-009) y el arranque con
 * argumentos inválidos. La integración con el proceso real vive en
 * servidor.test.js (ORDEN-RONDA-07 §2.2, división por responsabilidad).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const servidor = require(path.join(RAIZ, 'server', 'servidor.js'));

const {
  crearDirDatos,
  ejecutarYEsperar,
  SERVIDOR
} = require('./helpers/servidor-util.js');

// ---------------------------------------------------------------------------
// Unidad: escritura atómica
// ---------------------------------------------------------------------------
test('escribirTemporal deja el destino intacto; reemplazarTemporal lo reemplaza', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-atomic-'));
  try {
    const destino = path.join(dir, 'datos.json');
    fs.writeFileSync(destino, 'ORIGINAL', 'utf8');
    const tmp = servidor.escribirTemporal(destino, 'NUEVO');
    assert.ok(fs.existsSync(tmp), 'el temporal existe antes del rename');
    assert.equal(fs.readFileSync(destino, 'utf8'), 'ORIGINAL',
      'el destino no se toca hasta el rename (corte simulado entre escritura y rename)');
    servidor.reemplazarTemporal(tmp, destino);
    assert.equal(fs.readFileSync(destino, 'utf8'), 'NUEVO');
    assert.equal(fs.existsSync(tmp), false, 'no quedan temporales');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('escribirAtomico deja un JSON legible aunque el destino previo no exista', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-atomic-'));
  try {
    const destino = path.join(dir, 'datos.json');
    servidor.escribirAtomico(destino, JSON.stringify({ a: 1 }));
    assert.deepEqual(JSON.parse(fs.readFileSync(destino, 'utf8')), { a: 1 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Unidad: lock de numeración (ADR-009)
// ---------------------------------------------------------------------------
test('adquirirLock crea el archivo con wx; un segundo lock falla y luego libera', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-lock-'));
  try {
    const rutaLock = path.join(dir, 'contador.lock');
    assert.equal(servidor.adquirirLock(rutaLock, 3, 5), true, 'primer lock se obtiene');
    assert.ok(fs.existsSync(rutaLock));
    assert.equal(servidor.adquirirLock(rutaLock, 3, 5), false, 'segundo lock con wx falla');
    servidor.liberarLock(rutaLock);
    assert.equal(fs.existsSync(rutaLock), false);
    assert.equal(servidor.adquirirLock(rutaLock, 3, 5), true, 'después de liberar se obtiene de nuevo');
    servidor.liberarLock(rutaLock);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('siguienteNumero serializa el contador por año', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgc-contador-'));
  try {
    assert.equal(servidor.siguienteNumero(dir, '2026'), 1);
    assert.equal(servidor.siguienteNumero(dir, '2026'), 2);
    assert.equal(servidor.siguienteNumero(dir, '2027'), 1);
    const contador = JSON.parse(fs.readFileSync(path.join(dir, 'contador.json'), 'utf8'));
    assert.deepEqual(contador, { contador: { 2026: 2, 2027: 1 } });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Arranque: argumentos inválidos
// ---------------------------------------------------------------------------
test('sin --datos el servidor no arranca y explica por qué', async () => {
  const r = await ejecutarYEsperar([SERVIDOR, '--puerto', '0']);
  assert.notEqual(r.exitCode, 0);
  assert.match(r.stderr, /--datos/);
});

test('con --datos inexistente el servidor no arranca y explica por qué', async () => {
  const inexistente = path.join(os.tmpdir(), 'sgc-inexistente-' + Date.now());
  const r = await ejecutarYEsperar([SERVIDOR, '--datos', inexistente, '--puerto', '0']);
  assert.notEqual(r.exitCode, 0);
  assert.match(r.stderr, /no existe|--datos/i);
});

test('con --datos apuntando a un archivo el servidor no arranca', async () => {
  const archivo = path.join(os.tmpdir(), 'sgc-archivo-' + Date.now() + '.txt');
  fs.writeFileSync(archivo, 'x', 'utf8');
  try {
    const r = await ejecutarYEsperar([SERVIDOR, '--datos', archivo, '--puerto', '0']);
    assert.notEqual(r.exitCode, 0);
    assert.match(r.stderr, /archivo|directorio|--datos/i);
  } finally {
    fs.unlinkSync(archivo);
  }
});

test('con --puerto inválido el servidor no arranca', async () => {
  const datos = crearDirDatos('sgc-puerto-');
  try {
    const r = await ejecutarYEsperar([SERVIDOR, '--datos', datos, '--puerto', 'abc']);
    assert.notEqual(r.exitCode, 0);
    assert.match(r.stderr, /puerto/i);
  } finally {
    fs.rmSync(datos, { recursive: true, force: true });
  }
});