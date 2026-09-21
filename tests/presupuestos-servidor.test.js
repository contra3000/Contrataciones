'use strict';

/*
 * presupuestos-servidor.test.js
 * ORDEN-RONDA-09 §3.2 (ADR-022) y ORDEN-RONDA-23 §3: los presupuestos de los
 * proveedores se adjuntan al expediente como PDF o imágenes.
 *
 *  - El archivo viaja como BYTES CRUDOS (no base64 en un JSON): el tipo en la
 *    cabecera Content-Type, el nombre original en X-SGC-Nombre-Original y el
 *    contexto (modo declarado) en X-SGC-Contexto. Así el servidor lo escribe
 *    directo a un temporal y lo renombra, sin juntarlo entero en memoria.
 *  - El nombre del archivo en disco lo decide el servidor
 *    (`presupuesto-<n>.<ext>`), con un id estable que los valores de
 *    referencia citan. El `nombreOriginal` queda sólo como dato del registro.
 *  - El servidor valida tipo (PDF, PNG, JPG), firma (magic bytes) y tamaño
 *    (el declarado una sola vez en core/limites.js, ORDEN-RONDA-23 §4) y lo
 *    escribe en binario en `presupuestos/` dentro del expediente.
 *  - El registro queda en datos.json (con versión), el archivo se persiste en
 *    disco, y repo.http.guardarPresupuesto lo resuelve desde el cliente.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');

require(path.join(RAIZ, 'app', 'js', 'core', 'namespaces.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'config.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'limites.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'roles.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'cotas-encabezado.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'utils.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'autorizacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'auditoria.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'migraciones.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'requerimiento.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'anexo-eett.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'validacion.js'));
require(path.join(RAIZ, 'app', 'js', 'core', 'estados.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.js'));
require(path.join(RAIZ, 'app', 'js', 'adapters', 'repo.http.js'));

const {
  contexto,
  arrancarEntorno,
  limpiarEntorno,
  docEnDisco,
  pedir,
  enviarBytes
} = require('./helpers/transiciones-servidor-util.js');

const ENTORNO = {};

before(async () => {
  Object.assign(ENTORNO, await arrancarEntorno());
});

after(async () => {
  await limpiarEntorno(ENTORNO);
});

async function crearExpediente() {
  const r = await pedir(ENTORNO.base, 'POST', '/api/expedientes', {
    datosIniciales: {
      titulo: 'Con presupuestos', anio: '2026',
      renglones: [{ codigo: '2.1.1-439.102', cantidad: 2, unidad: 'UN' }]
    },
    contexto: contexto('generador')
  });
  assert.equal(r.status, 201, 'se crea el expediente');
  return r.body.id;
}

const FIRMA_PDF = Buffer.from('%PDF-1.4 presupuesto de ejemplo');
const FIRMA_PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('png')]);
const FIRMA_JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('jpg')]);

function cabeceras(tipo, nombre) {
  return {
    'Content-Type': tipo,
    'X-SGC-Nombre-Original': encodeURIComponent(nombre),
    'X-SGC-Contexto': encodeURIComponent(JSON.stringify(contexto('generador')))
  };
}

function subir(id, bytes, tipo, nombre) {
  return enviarBytes(ENTORNO.base, '/api/expedientes/' + id + '/presupuestos',
    bytes, cabeceras(tipo, nombre));
}

function rutaPresupuesto(datosDir, id, archivo) {
  return path.join(datosDir, id.split('-')[0], id.split('-')[1] + '_Expediente',
    'presupuestos', archivo);
}

test('el servidor guarda un presupuesto PDF con id estable y lo persiste en disco', async () => {
  const id = await crearExpediente();
  const contenido = FIRMA_PDF;
  const r = await subir(id, contenido, 'application/pdf', 'cotizacion-proveedor.pdf');
  assert.equal(r.status, 201, 'el servidor acepta el presupuesto');
  assert.equal(r.body.id, 'presupuesto-1');
  assert.equal(r.body.archivo, 'presupuesto-1.pdf');
  assert.equal(r.body.peso, contenido.length);
  assert.equal(r.body.version, 2, 'el registro sube la versión');

  const guardado = rutaPresupuesto(ENTORNO.datosDir, id, 'presupuesto-1.pdf');
  assert.ok(fs.existsSync(guardado), 'el archivo binario queda en la carpeta');
  assert.deepEqual(fs.readFileSync(guardado), contenido, 'se escribe el mismo byte a byte');

  const enDisco = docEnDisco(ENTORNO.datosDir, id);
  assert.equal(enDisco.presupuestos.length, 1);
  assert.equal(enDisco.presupuestos[0].id, 'presupuesto-1');
  assert.equal(enDisco.presupuestos[0].nombreOriginal, 'cotizacion-proveedor.pdf');
  assert.equal(enDisco.presupuestos[0].tipo, 'application/pdf');
  assert.equal(enDisco.presupuestos[0].ruta, 'presupuestos/presupuesto-1.pdf');
  assert.equal(enDisco.version, 2);
});

test('un segundo presupuesto recibe el siguiente número y el primero no se pisa', async () => {
  const id = await crearExpediente();
  const primero = await subir(id, FIRMA_PNG, 'image/png', 'a.png');
  assert.equal(primero.status, 201);
  const segundo = await subir(id, FIRMA_JPG, 'image/jpeg', 'b.jpg');
  assert.equal(segundo.status, 201);
  assert.equal(segundo.body.id, 'presupuesto-2');
  assert.equal(segundo.body.archivo, 'presupuesto-2.jpg');

  const enDisco = docEnDisco(ENTORNO.datosDir, id);
  assert.deepEqual(enDisco.presupuestos.map((p) => p.id),
    ['presupuesto-1', 'presupuesto-2']);
  assert.equal(enDisco.version, 3);
});

test('un tipo de archivo no permitido se rechaza con 400 sin escribir nada', async () => {
  const id = await crearExpediente();
  const r = await subir(id, Buffer.from('texto'), 'text/plain', 'virus.txt');
  assert.equal(r.status, 400);
  assert.match(r.body.error, /no permitido/);
  const enDisco = docEnDisco(ENTORNO.datosDir, id);
  assert.equal((enDisco.presupuestos || []).length, 0);
});

test('un cuerpo vacío o con la firma equivocada se rechaza con 400', async () => {
  const id = await crearExpediente();
  const vacio = await subir(id, Buffer.alloc(0), 'application/pdf', 'x.pdf');
  assert.equal(vacio.status, 400);
  assert.match(vacio.body.error, /vacío/);

  const sinFirma = await subir(id, Buffer.from('no soy un pdf'), 'application/pdf', 'x.pdf');
  assert.equal(sinFirma.status, 400);
  assert.match(sinFirma.body.error, /firma/);
  const enDisco = docEnDisco(ENTORNO.datosDir, id);
  assert.equal((enDisco.presupuestos || []).length, 0);
});

const LIMITES = globalThis.SGC.core.limites;

function pdfDe(bytes) {
  const contenido = Buffer.alloc(bytes, 7);
  contenido.write('%PDF-1.4', 0, 'utf8');
  return contenido;
}

// ORDEN-RONDA-23 §4/§7: 19 MB entra y 21 MB se rechaza con el tamaño real y el
// máximo. El número no se escribe acá: sale de core/limites.js.
test('un presupuesto de 19 MB entra y se guarda byte a byte', async () => {
  const id = await crearExpediente();
  const contenido = pdfDe(19 * 1024 * 1024);
  const r = await subir(id, contenido, 'application/pdf', 'grande.pdf');
  assert.equal(r.status, 201, '19 MB entra');
  assert.equal(r.body.peso, contenido.length);
  const guardado = rutaPresupuesto(ENTORNO.datosDir, id, 'presupuesto-1.pdf');
  assert.equal(fs.statSync(guardado).size, contenido.length, 'el archivo pesa lo que viajó');
  assert.deepEqual(fs.readFileSync(guardado).subarray(0, 16), contenido.subarray(0, 16));
});

test('un presupuesto de 21 MB se rechaza con el tamaño real y el máximo', async () => {
  const id = await crearExpediente();
  const contenido = pdfDe(21 * 1024 * 1024);
  const r = await subir(id, contenido, 'application/pdf', 'enorme.pdf');
  assert.equal(r.status, 413, 'lo que se pasa del límite se rechaza');
  assert.ok(r.body.error.indexOf('límite de ' + LIMITES.textoLimite()) !== -1,
    'el mensaje dice el máximo declarado');
  assert.match(r.body.error, /llegaron/);
  assert.match(r.body.error, /21 MB/, 'el mensaje dice el tamaño real');
  const enDisco = docEnDisco(ENTORNO.datosDir, id);
  assert.equal((enDisco.presupuestos || []).length, 0);
  const carpeta = path.dirname(rutaPresupuesto(ENTORNO.datosDir, id, 'x.pdf'));
  const sobrantes = fs.existsSync(carpeta)
    ? fs.readdirSync(carpeta).filter((n) => n.indexOf('.tmp') !== -1)
    : [];
  assert.deepEqual(sobrantes, [], 'el temporal del rechazo se borra');
});

test('un expediente inexistente da 404', async () => {
  const r = await enviarBytes(ENTORNO.base, '/api/expedientes/2099-999/presupuestos',
    FIRMA_PDF, cabeceras('application/pdf', 'x.pdf'));
  assert.equal(r.status, 404);
});

test('un nombre de archivo con "../" no escapa de la carpeta del expediente', async () => {
  const id = await crearExpediente();
  const contenido = FIRMA_PDF;
  const r = await subir(id, contenido, 'application/pdf', '../../secreto.pdf');
  assert.equal(r.status, 201, 'el nombre se acepta como dato');
  assert.equal(r.body.archivo, 'presupuesto-1.pdf', 'el nombre en disco lo decide el servidor');

  const carpeta = path.join(ENTORNO.datosDir, id.split('-')[0], id.split('-')[1] + '_Expediente');
  assert.deepEqual(fs.readFileSync(path.join(carpeta, 'presupuestos', 'presupuesto-1.pdf')),
    contenido, 'el archivo está dentro de presupuestos/');
  assert.ok(!fs.existsSync(path.join(ENTORNO.datosDir, 'secreto.pdf')),
    'no se escribió nada fuera de la carpeta del expediente');

  const enDisco = docEnDisco(ENTORNO.datosDir, id);
  assert.equal(enDisco.presupuestos[0].nombreOriginal, '../../secreto.pdf',
    'el nombre original queda sólo como dato del registro');
});

test('repo.http.guardarPresupuesto sube el archivo y el expediente lo refleja', async () => {
  const repo = globalThis.SGC.adapters.repoHttp.crear('http://127.0.0.1:' + ENTORNO.ctx.puerto);
  const creado = await repo.crearExpediente(
    { titulo: 'Vía cliente', anio: '2026' },
    contexto('generador')
  );
  const contenido = FIRMA_PNG;
  const guardado = await repo.guardarPresupuesto(creado.id, {
    nombreOriginal: 'plano.png',
    tipo: 'image/png',
    archivo: new Blob([contenido])
  }, contexto('generador'));
  assert.equal(guardado.id, 'presupuesto-1');
  assert.equal(guardado.archivo, 'presupuesto-1.png');

  const leido = await repo.leerExpediente(creado.id);
  assert.equal(leido.expediente.presupuestos.length, 1);
  assert.equal(leido.expediente.presupuestos[0].id, 'presupuesto-1');

  const guardadoDisco = rutaPresupuesto(ENTORNO.datosDir, creado.id, 'presupuesto-1.png');
  assert.deepEqual(fs.readFileSync(guardadoDisco), contenido);
});
