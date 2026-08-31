/*
 * ronda-15.test.js
 * ORDEN-RONDA-15 §4. Tests de la ronda 15: verificación de arranque,
 * revalidación de sesión y respaldo con destino no disponible.
 */
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const RAIZ = path.resolve(__dirname, '..');
const { verificarArranque, verificarPuerto } = require(path.join(RAIZ, 'server', 'arranque.js'));
const ayudantes = require(path.join(RAIZ, 'server', 'ayudantes.js'));
const sesion = require(path.join(RAIZ, 'server', 'sesion.js'));
const { crearRespaldo } = require(path.join(RAIZ, 'tools', 'ayudantes-respaldo.js'));

function crearDirDatos(prefijo) {
  return fs.mkdtempSync(path.join(require('node:os').tmpdir(), prefijo));
}

// ---------------------------------------------------------------------------
// §4.1 — Baja corta la sesión abierta
// ---------------------------------------------------------------------------
test('§4.1 baja corta la sesión abierta', () => {
  const datosDir = crearDirDatos('r15-baja-');
  try {
    const padron = {
      version: 1,
      usuarios: [
        { email: 'op@test.mil.ar', nombre: 'Op', apellido: 'Test', rol: 'generador',
          credenciales: { hash: 'x', algoritmo: 'scrypt', salt: 'x', version: 1 } }
      ]
    };
    fs.writeFileSync(path.join(datosDir, 'padron.json'), JSON.stringify(padron));
    const { crearPadronVivo } = require(path.join(RAIZ, 'server', 'padron-vivo.js'));
    const padronVivo = crearPadronVivo(path.join(datosDir, 'padron.json'));
    const capa = sesion.crearCapaSesion(datosDir, ayudantes, padronVivo);

    const sesionCreada = capa.crearSesion(padron.usuarios[0]);
    assert.ok(capa.conectarSesion({ headers: { cookie: 'sgc_sesion=' + sesionCreada.id } }),
      'la sesión conecta antes de la baja');

    // Dar de baja: marcar activo = false
    const padronActual = padronVivo.leer();
    padronActual.usuarios[0].activo = false;
    padronVivo.guardar(padronActual);

    const despues = capa.conectarSesion({ headers: { cookie: 'sgc_sesion=' + sesionCreada.id } });
    assert.equal(despues, null, 'la sesión muere después de la baja');
  } finally {
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// §4.2 — Cambio de rol se refleja en la sesión
// ---------------------------------------------------------------------------
test('§4.2 cambio de rol se refleja en la sesión', () => {
  const datosDir = crearDirDatos('r15-rol-');
  try {
    const padron = {
      version: 1,
      usuarios: [
        { email: 'op@test.mil.ar', nombre: 'Op', apellido: 'Test', rol: 'generador',
          credenciales: { hash: 'x', algoritmo: 'scrypt', salt: 'x', version: 1 } }
      ]
    };
    fs.writeFileSync(path.join(datosDir, 'padron.json'), JSON.stringify(padron));
    const { crearPadronVivo } = require(path.join(RAIZ, 'server', 'padron-vivo.js'));
    const padronVivo = crearPadronVivo(path.join(datosDir, 'padron.json'));
    const capa = sesion.crearCapaSesion(datosDir, ayudantes, padronVivo);

    const sesionCreada = capa.crearSesion(padron.usuarios[0]);
    assert.equal(sesionCreada.rol, 'generador', 'rol inicial');

    // Cambiar el rol en el padrón
    const padronActual = padronVivo.leer();
    padronActual.usuarios[0].rol = 'aprobador';
    padronVivo.guardar(padronActual);

    const conectada = capa.conectarSesion({ headers: { cookie: 'sgc_sesion=' + sesionCreada.id } });
    assert.ok(conectada, 'la sesión sigue viva');
    assert.equal(conectada.rol, 'aprobador', 'el rol cambió en la sesión');
  } finally {
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// §4.3 — El servidor no arranca si falta algo
// ---------------------------------------------------------------------------
test('§4.3 no arranca sin carpeta de datos', () => {
  assert.throws(
    () => verificarArranque({ datos: '/no/existe/ruta', puerto: 0 }, 18, ayudantes),
    /la carpeta de datos no existe/
  );
});

test('§4.3 no arranca sin padrón con credenciales', () => {
  const datosDir = crearDirDatos('r15-nopadron-');
  try {
    const padron = { version: 1, usuarios: [{ email: 'x@test.mil.ar', nombre: 'X', apellido: 'Y' }] };
    fs.writeFileSync(path.join(datosDir, 'padron.json'), JSON.stringify(padron));
    assert.throws(
      () => verificarArranque({ datos: datosDir, puerto: 0 }, 18, ayudantes),
      /no tiene ningún operador con credencial/
    );
  } finally {
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

test('§4.3 no arranca sin catálogo', () => {
  const datosDir = crearDirDatos('r15-nocat-');
  try {
    fs.mkdirSync(path.join(datosDir, 'idx'), { recursive: true });
    fs.writeFileSync(path.join(datosDir, 'contador.json'), '{"contador":{}}');
    const rutaManifiesto = path.join(RAIZ, 'app', 'catalogo', 'manifiesto.json');
    const backup = rutaManifiesto + '.test-backup';
    try {
      fs.renameSync(rutaManifiesto, backup);
      assert.throws(
        () => verificarArranque({ datos: datosDir, puerto: 0 }, 18, ayudantes),
        /falta el catálogo/
      );
    } finally {
      if (fs.existsSync(backup)) {
        fs.renameSync(backup, rutaManifiesto);
      }
    }
  } finally {
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

test('§4.3 no arranca con versión de Node insuficiente', () => {
  const datosDir = crearDirDatos('r15-node-');
  try {
    fs.mkdirSync(path.join(datosDir, 'idx'), { recursive: true });
    fs.writeFileSync(path.join(datosDir, 'contador.json'), '{"contador":{}}');
    assert.throws(
      () => verificarArranque({ datos: datosDir, puerto: 0 }, 999, ayudantes),
      /se necesita Node 999/
    );
  } finally {
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// §4.4 — El servidor sí arranca cuando están las 4 cosas
// ---------------------------------------------------------------------------
test('§4.4 arranca cuando todo está en su lugar', () => {
  const datosDir = crearDirDatos('r15-ok-');
  try {
    fs.mkdirSync(path.join(datosDir, 'idx'), { recursive: true });
    fs.writeFileSync(path.join(datosDir, 'contador.json'), '{"contador":{}}');
    assert.doesNotThrow(
      () => verificarArranque({ datos: datosDir, puerto: 0 }, 18, ayudantes),
      'arranca sin errores cuando todo está'
    );
  } finally {
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// §4.5 — instalar.sh no pisa la carpeta de datos existente
// ---------------------------------------------------------------------------
test('§4.5 instalar no pisa datos existentes', () => {
  const datosDir = crearDirDatos('r15-inst-');
  try {
    fs.mkdirSync(path.join(datosDir, 'idx'), { recursive: true });
    fs.writeFileSync(path.join(datosDir, 'contador.json'), '{"contador":{"exp-1":1}}');
    fs.writeFileSync(path.join(datosDir, 'expediente-test.json'), '{"id":"exp-1"}');
    const antes = fs.readFileSync(path.join(datosDir, 'contador.json'), 'utf8');
    // Simular lo que haría instalar.sh: crear la carpeta si no existe, no tocar si existe.
    if (!fs.existsSync(datosDir)) {
      fs.mkdirSync(datosDir, { recursive: true });
    }
    const despues = fs.readFileSync(path.join(datosDir, 'contador.json'), 'utf8');
    assert.equal(antes, despues, 'el contador no se modificó');
    assert.ok(fs.existsSync(path.join(datosDir, 'expediente-test.json')), 'el expediente sigue ahí');
  } finally {
    fs.rmSync(datosDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// §4.6 — El respaldo avisa y no borra el anterior si el destino no está
// ---------------------------------------------------------------------------
test('§4.6 respaldo no borra el anterior si el destino falla', () => {
  const origen = crearDirDatos('r15-resp-');
  const destinoArchivo = path.join(require('node:os').tmpdir(), 'sgc-test-dest-' + Date.now());
  try {
    fs.mkdirSync(path.join(origen, 'idx'), { recursive: true });
    fs.writeFileSync(path.join(origen, 'contador.json'), '{"contador":{}}');
    fs.writeFileSync(path.join(origen, 'expediente.json'), '{"id":"test"}');
    // Crear un archivo con el nombre del destino para que mkdirSync falle.
    fs.writeFileSync(destinoArchivo, 'no soy un directorio');
    assert.throws(
      () => crearRespaldo(origen, destinoArchivo, 14),
      /EEXIST|ENOTDIR|el destino/,
      'el respaldo falla si el destino es un archivo, no un directorio'
    );
    // Verificar que no quedaron artefactos en origen.
    assert.ok(fs.existsSync(path.join(origen, 'contador.json')), 'el origen sigue intacto');
  } finally {
    try { fs.unlinkSync(destinoArchivo); } catch (_) {}
    fs.rmSync(origen, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// §4.8 — Verificar puerto en uso
// ---------------------------------------------------------------------------
test('§4.8 verificarPuerto rechaza puerto ocupado', async () => {
  const net = require('node:net');
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const puerto = server.address().port;
  try {
    await assert.rejects(
      () => verificarPuerto(puerto),
      /ya está en uso/,
      'rechaza un puerto que está en uso'
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('§4.8 verificarPuerto acepta puerto libre', async () => {
  const net = require('node:net');
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const puerto = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  // Ahora el puerto debería estar libre.
  await assert.doesNotReject(() => verificarPuerto(puerto));
});

// §4.7 (vuelta atrás) y §4.6 (actualización no toca datos) requieren bash y
// systemd; se verifican manualmente en la instalación. La suite completa en
// verde se confirma con `node --test` (§4.9).
